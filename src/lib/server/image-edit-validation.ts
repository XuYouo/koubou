import {
  pngHasTransparentPixels,
  readImageDimensions,
  readPngMetadata,
  type ImageDimensions,
} from "@/lib/server/image-metadata";

const MAX_SOURCE_BYTES = 25 * 1024 * 1024;
const MAX_MASK_BYTES = 4 * 1024 * 1024;
const SUPPORTED_SOURCE_MIME = new Set([
  "image/png",
  "image/jpeg",
  "image/jpg",
  "image/webp",
]);

export type ImageEditFileValidation = {
  sourceDimensions: ImageDimensions;
  maskDimensions: ImageDimensions;
};

export function validateImageEditFiles({
  sourceBytes,
  sourceMime,
  maskBytes,
  maskMime,
}: {
  sourceBytes: Uint8Array;
  sourceMime: string;
  maskBytes: Uint8Array;
  maskMime: string;
}): ImageEditFileValidation {
  if (!SUPPORTED_SOURCE_MIME.has(sourceMime)) {
    throw new Error("Source image must be PNG, JPEG, or WebP");
  }
  if (sourceBytes.byteLength > MAX_SOURCE_BYTES) {
    throw new Error("Source image must be smaller than 25MB");
  }
  if (maskMime && maskMime !== "image/png") {
    throw new Error("Mask must be a PNG file");
  }
  if (maskBytes.byteLength > MAX_MASK_BYTES) {
    throw new Error("Mask must be smaller than 4MB");
  }

  const sourceDimensions = readImageDimensions(sourceBytes, sourceMime);
  const maskMetadata = readPngMetadata(maskBytes);

  if (!maskMetadata.hasAlpha) {
    throw new Error("Mask must include an alpha channel");
  }
  if (
    sourceDimensions.width !== maskMetadata.width ||
    sourceDimensions.height !== maskMetadata.height
  ) {
    throw new Error("Mask must be the same size as the source image");
  }
  if (!pngHasTransparentPixels(maskBytes)) {
    throw new Error("Paint the area you want to edit before submitting");
  }

  return {
    sourceDimensions,
    maskDimensions: {
      width: maskMetadata.width,
      height: maskMetadata.height,
    },
  };
}
