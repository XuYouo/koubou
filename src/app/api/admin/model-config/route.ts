import { NextResponse } from "next/server";

import { prisma } from "@/lib/server/db";
import {
  toSafeModelConfig,
  upsertModelConfig,
} from "@/lib/server/model-config";
import { badRequest, readJson } from "@/lib/server/responses";
import { requireAdmin } from "@/lib/server/session";

export async function GET() {
  const { response } = await requireAdmin();
  if (response) return response;

  const config = await prisma.modelConfig.findFirst({
    orderBy: { updatedAt: "desc" },
  });

  return NextResponse.json({ config: toSafeModelConfig(config) });
}

export async function PUT(request: Request) {
  const { response } = await requireAdmin();
  if (response) return response;

  const body = await readJson(request);
  const model = String(body?.model || "gpt-image-2").trim();
  const baseUrl = String(body?.baseUrl || "").trim();
  const apiKey =
    typeof body?.apiKey === "string" ? String(body.apiKey).trim() : undefined;
  const enabled = Boolean(body?.enabled);

  if (!model) return badRequest("Model is required");
  if (!baseUrl) return badRequest("Base URL is required");

  try {
    const config = await upsertModelConfig({
      model,
      baseUrl,
      apiKey,
      enabled,
    });

    return NextResponse.json({ config: toSafeModelConfig(config) });
  } catch (error) {
    return badRequest(error instanceof Error ? error.message : "Invalid config");
  }
}
