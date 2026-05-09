import { NextResponse } from "next/server";

import { prisma } from "@/lib/server/db";
import { callGptImage2, validateGptImageSettings } from "@/lib/server/gpt-image-2";
import { getActiveModelConfig } from "@/lib/server/model-config";
import { badRequest, notFound, readJson } from "@/lib/server/responses";
import { requireUser } from "@/lib/server/session";
import { writeAssetFile } from "@/lib/server/storage";

export async function POST(request: Request) {
  const { user, response } = await requireUser();
  if (response) return response;

  const body = await readJson(request);
  const prompt = String(body?.prompt || "").trim();
  const projectId = String(body?.projectId || "");
  if (!prompt) return badRequest("Prompt is required");
  if (!projectId) return badRequest("Project is required");

  const project = await prisma.project.findFirst({
    where: { id: projectId, userId: user.id },
  });
  if (!project) return notFound("Project not found");

  let settings;
  try {
    settings = validateGptImageSettings({
      size: body?.size,
      quality: body?.quality,
      outputFormat: body?.outputFormat,
    });
  } catch (error) {
    return badRequest(error instanceof Error ? error.message : "Invalid settings");
  }

  const selectedAssetIds = Array.isArray(body?.selectedAssetIds)
    ? body.selectedAssetIds
        .map((id: unknown) => String(id))
        .filter(Boolean)
        .slice(0, 16)
    : [];

  const inputAssets =
    selectedAssetIds.length > 0
      ? await prisma.asset.findMany({
          where: {
            id: { in: selectedAssetIds },
            userId: user.id,
            projectId: project.id,
          },
        })
      : [];

  if (inputAssets.length !== selectedAssetIds.length) {
    return badRequest("One or more selected images are unavailable");
  }

  const modelConfig = await getActiveModelConfig();
  if (!modelConfig) {
    return badRequest("No enabled model configuration is available");
  }

  const operation = inputAssets.length > 0 ? "EDIT" : "GENERATION";
  const job = await prisma.generationJob.create({
    data: {
      userId: user.id,
      projectId: project.id,
      modelConfigId: modelConfig.id,
      prompt,
      operation,
      status: "RUNNING",
      size: settings.size,
      quality: settings.quality,
      outputFormat: settings.outputFormat,
    },
  });

  try {
    const result = await callGptImage2({
      config: modelConfig,
      apiKey: modelConfig.apiKey,
      prompt,
      settings,
      inputAssets,
    });

    const storagePath = await writeAssetFile({
      userId: user.id,
      projectId: project.id,
      mime: result.mime,
      bytes: result.bytes,
    });

    const asset = await prisma.asset.create({
      data: {
        userId: user.id,
        projectId: project.id,
        type: "GENERATED",
        mime: result.mime,
        storagePath,
      },
    });

    await prisma.generationJob.update({
      where: { id: job.id },
      data: {
        status: "SUCCEEDED",
        outputAssetId: asset.id,
      },
    });

    return NextResponse.json({
      asset: {
        id: asset.id,
        url: `/api/assets/${asset.id}/blob`,
        mime: asset.mime,
        width: asset.width,
        height: asset.height,
      },
      job: {
        id: job.id,
        operation,
        status: "SUCCEEDED",
      },
    });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Image generation failed";

    await prisma.generationJob.update({
      where: { id: job.id },
      data: {
        status: "FAILED",
        error: message.slice(0, 2000),
      },
    });

    return NextResponse.json({ error: message }, { status: 502 });
  }
}
