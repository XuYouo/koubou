import { NextResponse } from "next/server";

import { prisma } from "@/lib/server/db";
import { badRequest, readJson } from "@/lib/server/responses";
import { requireUser } from "@/lib/server/session";

export async function GET() {
  const { user, response } = await requireUser();
  if (response) return response;

  const projects = await prisma.project.findMany({
    where: { userId: user.id },
    orderBy: { updatedAt: "desc" },
  });

  return NextResponse.json({
    projects: projects.map((project) => ({
      id: project.id,
      name: project.name,
      canvasJson: project.canvasJson,
      createdAt: project.createdAt.toISOString(),
      updatedAt: project.updatedAt.toISOString(),
    })),
  });
}

export async function POST(request: Request) {
  const { user, response } = await requireUser();
  if (response) return response;

  const body = await readJson(request);
  const name = String(body?.name || "Untitled project").trim();
  if (!name) return badRequest("Project name is required");

  const project = await prisma.project.create({
    data: {
      userId: user.id,
      name,
      canvasJson: "{\"images\":[]}",
    },
  });

  return NextResponse.json({
    project: {
      id: project.id,
      name: project.name,
      canvasJson: project.canvasJson,
      createdAt: project.createdAt.toISOString(),
      updatedAt: project.updatedAt.toISOString(),
    },
  });
}
