import { NextResponse } from "next/server";

import { prisma } from "@/lib/server/db";
import { badRequest, notFound, readJson } from "@/lib/server/responses";
import { requireUser } from "@/lib/server/session";

type Params = {
  params: Promise<{ projectId: string }>;
};

async function findProject(projectId: string, userId: string) {
  return prisma.project.findFirst({
    where: {
      id: projectId,
      userId,
    },
  });
}

export async function PATCH(request: Request, context: Params) {
  const { user, response } = await requireUser();
  if (response) return response;

  const { projectId } = await context.params;
  const project = await findProject(projectId, user.id);
  if (!project) return notFound("Project not found");

  const body = await readJson(request);
  const data: { name?: string; canvasJson?: string } = {};

  if (typeof body?.name === "string") {
    const name = body.name.trim();
    if (!name) return badRequest("Project name is required");
    data.name = name;
  }

  if (typeof body?.canvasJson === "string") {
    data.canvasJson = body.canvasJson;
  }

  const updated = await prisma.project.update({
    where: { id: project.id },
    data,
  });

  return NextResponse.json({
    project: {
      id: updated.id,
      name: updated.name,
      canvasJson: updated.canvasJson,
      createdAt: updated.createdAt.toISOString(),
      updatedAt: updated.updatedAt.toISOString(),
    },
  });
}

export async function DELETE(_request: Request, context: Params) {
  const { user, response } = await requireUser();
  if (response) return response;

  const { projectId } = await context.params;
  const project = await findProject(projectId, user.id);
  if (!project) return notFound("Project not found");

  await prisma.project.delete({ where: { id: project.id } });
  return NextResponse.json({ ok: true });
}
