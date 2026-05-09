import { NextResponse } from "next/server";

import { prisma } from "@/lib/server/db";
import { notFound } from "@/lib/server/responses";
import { requireUser } from "@/lib/server/session";

type Params = {
  params: Promise<{ jobId: string }>;
};

export async function GET(_request: Request, context: Params) {
  const { user, response } = await requireUser();
  if (response) return response;

  const { jobId } = await context.params;
  const job = await prisma.generationJob.findFirst({
    where: {
      id: jobId,
      userId: user.id,
    },
    include: {
      outputAsset: true,
    },
  });

  if (!job) return notFound("Generation job not found");

  return NextResponse.json({
    job: {
      id: job.id,
      operation: job.operation,
      status: job.status,
      error: job.error,
      asset: job.outputAsset
        ? {
            id: job.outputAsset.id,
            url: `/api/assets/${job.outputAsset.id}/blob`,
            mime: job.outputAsset.mime,
            width: job.outputAsset.width,
            height: job.outputAsset.height,
          }
        : null,
    },
  });
}
