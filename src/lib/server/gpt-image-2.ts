import path from "node:path";

import type { Asset, ModelConfig } from "@prisma/client";

import {
  IMAGE_OUTPUT_FORMATS,
  IMAGE_QUALITIES,
  IMAGE_SIZES,
  type ImageOutputFormat,
  type ImageQuality,
  type ImageSize,
} from "@/lib/image-options";
import { readAssetBytes } from "@/lib/server/storage";

export type GptImageSettings = {
  size: ImageSize;
  quality: ImageQuality;
  outputFormat: ImageOutputFormat;
};

export type GptImageResult = {
  bytes: Uint8Array;
  mime: string;
};

export type GptImageMask = {
  bytes: Uint8Array;
  mime: string;
  filename: string;
};

export function validateGptImageSettings(input: {
  size?: unknown;
  quality?: unknown;
  outputFormat?: unknown;
}) {
  const size = typeof input.size === "string" ? input.size : "1024x1024";
  const quality =
    typeof input.quality === "string" ? input.quality : "auto";
  const outputFormat =
    typeof input.outputFormat === "string" ? input.outputFormat : "png";

  if (!IMAGE_SIZES.includes(size as ImageSize)) {
    throw new Error("Unsupported image size");
  }
  if (!IMAGE_QUALITIES.includes(quality as ImageQuality)) {
    throw new Error("Unsupported image quality");
  }
  if (!IMAGE_OUTPUT_FORMATS.includes(outputFormat as ImageOutputFormat)) {
    throw new Error("Unsupported output format");
  }

  return {
    size: size as ImageSize,
    quality: quality as ImageQuality,
    outputFormat: outputFormat as ImageOutputFormat,
  };
}

export function imageApiUrl(baseUrl: string, operation: "generations" | "edits") {
  const base = baseUrl.replace(/\/+$/, "");
  if (!/^https?:\/\//.test(base)) {
    throw new Error("Model base URL must start with http:// or https://");
  }
  if (base.endsWith(`/v1/images/${operation}`)) return base;
  if (base.endsWith("/v1/images")) return `${base}/${operation}`;
  if (base.endsWith("/v1")) return `${base}/images/${operation}`;
  return `${base}/v1/images/${operation}`;
}

function outputMime(outputFormat: ImageOutputFormat) {
  if (outputFormat === "jpeg") return "image/jpeg";
  if (outputFormat === "webp") return "image/webp";
  return "image/png";
}

function payloadFor({
  model,
  prompt,
  settings,
}: {
  model: string;
  prompt: string;
  settings: GptImageSettings;
}) {
  return {
    model,
    prompt,
    size: settings.size,
    quality: settings.quality,
    output_format: settings.outputFormat,
    response_format: "b64_json",
  };
}

async function parseJsonResponse(response: Response) {
  const text = await response.text();
  let json: any = null;
  try {
    json = text ? JSON.parse(text) : null;
  } catch {
    // Keep the raw body below for the error message.
  }

  if (!response.ok) {
    const message =
      json?.error?.message ||
      json?.error ||
      text ||
      `Image API returned HTTP ${response.status}`;
    throw new Error(String(message));
  }

  if (!json) {
    throw new Error("Image API returned an empty response");
  }
  return json;
}

function decodeDataUrl(dataUrl: string) {
  const match = dataUrl.match(/^data:(image\/[a-zA-Z0-9.+-]+);base64,(.*)$/);
  if (!match) return null;
  return {
    mime: match[1],
    bytes: Buffer.from(match[2], "base64"),
  };
}

async function extractImageResult(
  response: any,
  fallbackMime: string
): Promise<GptImageResult> {
  const candidates = Array.isArray(response?.data)
    ? response.data.filter((item: unknown) => item && typeof item === "object")
    : [];

  if (
    response &&
    typeof response === "object" &&
    ("b64_json" in response || "image_base64" in response || "url" in response)
  ) {
    candidates.push(response);
  }

  for (const item of candidates) {
    const b64 = item.b64_json || item.image_base64;
    if (typeof b64 === "string" && b64) {
      return { bytes: Buffer.from(b64, "base64"), mime: fallbackMime };
    }

    if (typeof item.url === "string" && item.url) {
      const dataUrl = decodeDataUrl(item.url);
      if (dataUrl) return dataUrl;

      const remote = await fetch(item.url);
      if (!remote.ok) {
        throw new Error(`Failed to download generated image: ${remote.status}`);
      }
      return {
        bytes: new Uint8Array(await remote.arrayBuffer()),
        mime: remote.headers.get("content-type") || fallbackMime,
      };
    }
  }

  throw new Error("API response did not include data[0].b64_json or data[0].url");
}

async function requestJson({
  url,
  apiKey,
  body,
}: {
  url: string;
  apiKey: string;
  body: unknown;
}) {
  const response = await fetch(url, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
  });
  return parseJsonResponse(response);
}

async function requestMultipart({
  url,
  apiKey,
  fields,
  images,
  imageFieldName,
  mask,
}: {
  url: string;
  apiKey: string;
  fields: Record<string, string>;
  images: Asset[];
  imageFieldName: "image" | "image[]";
  mask?: GptImageMask;
}) {
  const form = new FormData();
  for (const [key, value] of Object.entries(fields)) {
    form.append(key, value);
  }

  for (const [index, image] of images.entries()) {
    const bytes = await readAssetBytes(image.storagePath);
    const extension = path.extname(image.storagePath) || ".png";
    const blob = new Blob([bytes], { type: image.mime });
    form.append(imageFieldName, blob, `image-${index + 1}${extension}`);
  }

  if (mask) {
    form.append(
      "mask",
      new Blob([mask.bytes], { type: mask.mime }),
      mask.filename
    );
  }

  const response = await fetch(url, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
    },
    body: form,
  });
  return parseJsonResponse(response);
}

function isImageFieldCompatibilityError(error: unknown) {
  if (!(error instanceof Error)) return false;
  return /image.*(required|missing|file|array|invalid)|required.*image/i.test(
    error.message
  );
}

export async function callGptImage2({
  config,
  apiKey,
  prompt,
  settings,
  inputAssets,
  mask,
}: {
  config: Pick<ModelConfig, "baseUrl" | "model">;
  apiKey: string;
  prompt: string;
  settings: GptImageSettings;
  inputAssets: Asset[];
  mask?: GptImageMask;
}) {
  const model = config.model || "gpt-image-2";
  const fallbackMime = outputMime(settings.outputFormat);
  const payload = payloadFor({ model, prompt, settings });

  const json =
    inputAssets.length > 0
      ? await (async () => {
          const editUrl = imageApiUrl(config.baseUrl, "edits");
          try {
            return await requestMultipart({
              url: editUrl,
              apiKey,
              fields: payload,
              images: inputAssets,
              imageFieldName: "image",
              mask,
            });
          } catch (error) {
            if (!isImageFieldCompatibilityError(error)) {
              throw error;
            }

            return requestMultipart({
              url: editUrl,
              apiKey,
              fields: payload,
              images: inputAssets,
              imageFieldName: "image[]",
              mask,
            });
          }
        })()
      : await requestJson({
          url: imageApiUrl(config.baseUrl, "generations"),
          apiKey,
          body: payload,
        });

  return extractImageResult(json, fallbackMime);
}
