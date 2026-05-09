import { after, NextResponse } from "next/server";
import type { Asset, ModelConfig } from "@prisma/client";

import { prisma } from "@/lib/server/db";
import {
  callGptImage2,
  validateGptImageSettings,
  type GptImageMask,
  type GptImageSettings,
} from "@/lib/server/gpt-image-2";
import { validateImageEditFiles } from "@/lib/server/image-edit-validation";
import { getActiveModelConfig } from "@/lib/server/model-config";
import { badRequest, notFound } from "@/lib/server/responses";
import { requireUser } from "@/lib/server/session";
import { readAssetBytes, writeAssetFile } from "@/lib/server/storage";

export const runtime = "nodejs";

export async function POST(request: Request) {
  const { user, response } = await requireUser();
  if (response) return response;

  const form = await request.formData();
  const projectId = String(form.get("projectId") || "");
  const assetId = String(form.get("assetId") || "");
  const prompt = String(form.get("prompt") || "").trim();
  const maskFile = form.get("mask");

  if (!projectId) return badRequest("Project is required");
  if (!assetId) return badRequest("Source image is required");
  if (!prompt) return badRequest("Prompt is required");
  if (!(maskFile instanceof File)) return badRequest("Mask is required");

  const project = await prisma.project.findFirst({
    where: { id: projectId, userId: user.id },
  });
  if (!project) return notFound("Project not found");

  const sourceAsset = await prisma.asset.findFirst({
    where: {
      id: assetId,
      userId: user.id,
      projectId: project.id,
    },
    include: {
      generationJobs: {
        orderBy: { createdAt: "desc" },
        take: 1,
        select: {
          size: true,
          quality: true,
          outputFormat: true,
        },
      },
    },
  });
  if (!sourceAsset) return badRequest("Source image is unavailable");

  let settings: GptImageSettings;
  const inheritedSettings = sourceAsset.generationJobs[0] || null;
  try {
    settings = validateGptImageSettings({
      size: stringFormValue(form, "size") || inheritedSettings?.size,
      quality: stringFormValue(form, "quality") || inheritedSettings?.quality,
      outputFormat:
        stringFormValue(form, "outputFormat") ||
        inheritedSettings?.outputFormat,
    });
  } catch (error) {
    return badRequest(error instanceof Error ? error.message : "Invalid settings");
  }

  const sourceBytes = await readAssetBytes(sourceAsset.storagePath);
  const maskBytes = new Uint8Array(await maskFile.arrayBuffer());

  try {
    validateImageEditFiles({
      sourceBytes,
      sourceMime: sourceAsset.mime,
      maskBytes,
      maskMime: maskFile.type,
    });
  } catch (error) {
    return badRequest(error instanceof Error ? error.message : "Invalid mask");
  }

  const modelConfig = await getActiveModelConfig();
  if (!modelConfig) {
    return badRequest("No enabled model configuration is available");
  }

  const job = await prisma.generationJob.create({
    data: {
      userId: user.id,
      projectId: project.id,
      modelConfigId: modelConfig.id,
      prompt,
      operation: "EDIT",
      status: "RUNNING",
      size: settings.size,
      quality: settings.quality,
      outputFormat: settings.outputFormat,
    },
  });

  after(() =>
    runImageEditJob({
      jobId: job.id,
      sourceAsset,
      modelConfig,
      apiKey: modelConfig.apiKey,
      prompt,
      settings,
      mask: {
        bytes: maskBytes,
        mime: "image/png",
        filename: "mask.png",
      },
    })
  );

  return NextResponse.json(
    {
      job: {
        id: job.id,
        operation: "EDIT",
        status: "RUNNING",
      },
    },
    { status: 202 }
  );
}

async function runImageEditJob({
  jobId,
  sourceAsset,
  modelConfig,
  apiKey,
  prompt,
  settings,
  mask,
}: {
  jobId: string;
  sourceAsset: Asset & { generationJobs?: unknown };
  modelConfig: Pick<ModelConfig, "baseUrl" | "model">;
  apiKey: string;
  prompt: string;
  settings: GptImageSettings;
  mask: GptImageMask;
}) {
  try {
    const result = await callGptImage2({
      config: modelConfig,
      apiKey,
      prompt,
      settings,
      inputAssets: [sourceAsset],
      mask,
    });

    const storagePath = await writeAssetFile({
      userId: sourceAsset.userId,
      projectId: sourceAsset.projectId,
      mime: result.mime,
      bytes: result.bytes,
    });

    const asset = await prisma.asset.create({
      data: {
        userId: sourceAsset.userId,
        projectId: sourceAsset.projectId,
        type: "GENERATED",
        mime: result.mime,
        storagePath,
      },
    });

    await prisma.generationJob.update({
      where: { id: jobId },
      data: {
        status: "SUCCEEDED",
        outputAssetId: asset.id,
      },
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Image edit failed";
    await prisma.generationJob.update({
      where: { id: jobId },
      data: {
        status: "FAILED",
        error: message.slice(0, 2000),
      },
    });
  }
}

function stringFormValue(form: FormData, key: string) {
  const value = form.get(key);
  return typeof value === "string" ? value : undefined;
}
