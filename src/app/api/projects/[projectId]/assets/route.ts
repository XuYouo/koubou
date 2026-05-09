import { NextResponse } from "next/server";

import { prisma } from "@/lib/server/db";
import { badRequest, notFound } from "@/lib/server/responses";
import { requireUser } from "@/lib/server/session";
import { writeAssetFile } from "@/lib/server/storage";

type Params = {
  params: Promise<{ projectId: string }>;
};

export async function POST(request: Request, context: Params) {
  const { user, response } = await requireUser();
  if (response) return response;

  const { projectId } = await context.params;
  const project = await prisma.project.findFirst({
    where: { id: projectId, userId: user.id },
  });
  if (!project) return notFound("Project not found");

  const form = await request.formData();
  const file = form.get("file");
  if (!(file instanceof File)) {
    return badRequest("An image file is required");
  }
  if (!file.type.startsWith("image/")) {
    return badRequest("Only image uploads are supported");
  }

  const bytes = new Uint8Array(await file.arrayBuffer());
  const storagePath = await writeAssetFile({
    userId: user.id,
    projectId: project.id,
    mime: file.type,
    bytes,
  });

  const asset = await prisma.asset.create({
    data: {
      userId: user.id,
      projectId: project.id,
      type: "UPLOAD",
      mime: file.type,
      storagePath,
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
  });
}
