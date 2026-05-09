import { NextResponse } from "next/server";

import { prisma } from "@/lib/server/db";
import { requireAdmin } from "@/lib/server/session";

export async function GET() {
  const { response } = await requireAdmin();
  if (response) return response;

  const users = await prisma.user.findMany({
    where: { deletedAt: null },
    select: {
      id: true,
      username: true,
      role: true,
      status: true,
      generationJobs: {
        select: {
          status: true,
          createdAt: true,
        },
      },
    },
    orderBy: { createdAt: "desc" },
  });

  return NextResponse.json({
    usage: users.map((user) => {
      const total = user.generationJobs.length;
      const succeeded = user.generationJobs.filter(
        (job) => job.status === "SUCCEEDED"
      ).length;
      const failed = user.generationJobs.filter(
        (job) => job.status === "FAILED"
      ).length;
      const latest = user.generationJobs
        .map((job) => job.createdAt.getTime())
        .sort((a, b) => b - a)[0];

      return {
        userId: user.id,
        username: user.username,
        role: user.role,
        status: user.status,
        requests: total,
        succeeded,
        failed,
        generatedImages: succeeded,
        lastUsedAt: latest ? new Date(latest).toISOString() : null,
      };
    }),
  });
}
