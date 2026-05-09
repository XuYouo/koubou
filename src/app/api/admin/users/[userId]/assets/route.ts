import { NextResponse } from "next/server";

import { prisma } from "@/lib/server/db";
import { badRequest, notFound } from "@/lib/server/responses";
import { requireAdmin } from "@/lib/server/session";

type Params = {
  params: Promise<{ userId: string }>;
};

const DEFAULT_LIMIT = 60;
const MAX_LIMIT = 100;

function parseLimit(value: string | null) {
  if (!value) return DEFAULT_LIMIT;

  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return DEFAULT_LIMIT;

  return Math.min(Math.max(Math.floor(parsed), 1), MAX_LIMIT);
}

export async function GET(request: Request, context: Params) {
  const { response } = await requireAdmin();
  if (response) return response;

  const { userId } = await context.params;
  const user = await prisma.user.findFirst({
    where: { id: userId, deletedAt: null },
    select: {
      id: true,
      username: true,
    },
  });

  if (!user) return notFound("User not found");

  const { searchParams } = new URL(request.url);
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
      },
    });

    const page = assets.slice(0, limit);
    const nextCursor = assets.length > limit ? page.at(-1)?.id ?? null : null;

    return NextResponse.json({
      user,
      assets: page.map((asset) => ({
        id: asset.id,
        type: asset.type,
        url: `/api/assets/${asset.id}/blob`,
        mime: asset.mime,
        width: asset.width,
        height: asset.height,
        projectName: asset.project.name,
        createdAt: asset.createdAt.toISOString(),
      })),
      nextCursor,
    });
  } catch {
    return badRequest("Invalid cursor");
  }
}
