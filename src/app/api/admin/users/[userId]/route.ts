import { NextResponse } from "next/server";

import { prisma } from "@/lib/server/db";
import { notFound } from "@/lib/server/responses";
import { requireAdmin } from "@/lib/server/session";

type Params = {
  params: Promise<{ userId: string }>;
};

export async function DELETE(_request: Request, context: Params) {
  const { user, response } = await requireAdmin();
  if (response) return response;

  const { userId } = await context.params;
  if (userId === user.id) {
    return NextResponse.json(
      { error: "Admin cannot delete their own account" },
      { status: 400 }
    );
  }

  const target = await prisma.user.findFirst({
    where: { id: userId, deletedAt: null },
  });
  if (!target) return notFound("User not found");

  await prisma.$transaction([
    prisma.user.update({
      where: { id: target.id },
      data: {
        status: "DISABLED",
        deletedAt: new Date(),
      },
    }),
    prisma.session.deleteMany({ where: { userId: target.id } }),
  ]);

  return NextResponse.json({ ok: true });
}
