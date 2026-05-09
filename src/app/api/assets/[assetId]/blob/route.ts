import { NextResponse } from "next/server";

import { prisma } from "@/lib/server/db";
import { notFound } from "@/lib/server/responses";
import { requireUser } from "@/lib/server/session";
import { readAssetBytes } from "@/lib/server/storage";

type Params = {
  params: Promise<{ assetId: string }>;
};

export async function GET(_request: Request, context: Params) {
  const { user, response } = await requireUser();
  if (response) return response;

  const { assetId } = await context.params;
  const asset = await prisma.asset.findFirst({
    where: {
      id: assetId,
      ...(user.role === "ADMIN" ? {} : { userId: user.id }),
    },
  });

  if (!asset) return notFound("Asset not found");

  const bytes = await readAssetBytes(asset.storagePath);
  return new NextResponse(bytes, {
    headers: {
      "Content-Type": asset.mime,
      "Cache-Control": "private, max-age=31536000, immutable",
    },
  });
}
