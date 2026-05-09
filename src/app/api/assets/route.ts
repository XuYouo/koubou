import { NextResponse } from "next/server";

import { prisma } from "@/lib/server/db";
import { badRequest } from "@/lib/server/responses";
import { requireUser } from "@/lib/server/session";

const DEFAULT_LIMIT = 60;
const MAX_LIMIT = 100;
const MAX_IDS = 80;

type AssetWithDetails = {
  id: string;
  type: "GENERATED" | "UPLOAD";
  mime: string;
  width: number | null;
  height: number | null;
  createdAt: Date;
  project: {
    name: string;
  };
  generationJobs: Array<{
    prompt: string;
    operation: "GENERATION" | "EDIT";
    createdAt: Date;
    size: string;
    quality: string;
    outputFormat: string;
  }>;
};

function parseLimit(value: string | null) {
  if (!value) return DEFAULT_LIMIT;

  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return DEFAULT_LIMIT;

  return Math.min(Math.max(Math.floor(parsed), 1), MAX_LIMIT);
}

function parseAssetIds(searchParams: URLSearchParams) {
  const ids = [
    ...searchParams.getAll("id"),
    ...(searchParams.get("ids")?.split(",") || []),
  ]
    .map((id) => id.trim())
    .filter(Boolean);

  return Array.from(new Set(ids)).slice(0, MAX_IDS);
}

function serializeAsset(asset: AssetWithDetails) {
  const job = asset.generationJobs[0] || null;

  return {
    id: asset.id,
    type: asset.type,
    url: `/api/assets/${asset.id}/blob`,
    mime: asset.mime,
    width: asset.width,
    height: asset.height,
    projectName: asset.project.name,
    createdAt: asset.createdAt.toISOString(),
    prompt: job?.prompt || null,
    operation: job?.operation || null,
    generationCreatedAt: job?.createdAt.toISOString() || null,
    generationSettings: job
      ? {
          size: job.size,
          quality: job.quality,
          outputFormat: job.outputFormat,
        }
      : null,
  };
}

export async function GET(request: Request) {
  const { user, response } = await requireUser();
  if (response) return response;

  const { searchParams } = new URL(request.url);
  const ids = parseAssetIds(searchParams);

  if (ids.length > 0) {
    const assets = await prisma.asset.findMany({
      where: {
        id: { in: ids },
        userId: user.id,
      },
      select: {
        id: true,
        type: true,
        mime: true,
        width: true,
        height: true,
        createdAt: true,
        project: {
          select: {
            name: true,
          },
        },
        generationJobs: {
          orderBy: { createdAt: "desc" },
          take: 1,
          select: {
            prompt: true,
            operation: true,
            createdAt: true,
            size: true,
            quality: true,
            outputFormat: true,
          },
        },
      },
    });

    const byId = new Map(assets.map((asset) => [asset.id, asset]));
    return NextResponse.json({
      assets: ids.flatMap((id) => {
        const asset = byId.get(id);
        return asset ? [serializeAsset(asset)] : [];
      }),
      nextCursor: null,
    });
  }

  const limit = parseLimit(searchParams.get("limit"));
  const cursor = searchParams.get("cursor");

  try {
    const assets = await prisma.asset.findMany({
      where: { userId: user.id },
      take: limit + 1,
      ...(cursor
        ? {
            cursor: { id: cursor },
            skip: 1,
          }
        : {}),
      orderBy: [{ createdAt: "desc" }, { id: "desc" }],
      select: {
        id: true,
        type: true,
        mime: true,
        width: true,
        height: true,
        createdAt: true,
        project: {
          select: {
            name: true,
          },
        },
        generationJobs: {
          orderBy: { createdAt: "desc" },
          take: 1,
          select: {
            prompt: true,
            operation: true,
            createdAt: true,
            size: true,
            quality: true,
            outputFormat: true,
          },
        },
      },
    });

    const page = assets.slice(0, limit);
    const nextCursor = assets.length > limit ? page.at(-1)?.id ?? null : null;

    return NextResponse.json({
      assets: page.map(serializeAsset),
      nextCursor,
    });
  } catch {
    return badRequest("Invalid cursor");
  }
}
