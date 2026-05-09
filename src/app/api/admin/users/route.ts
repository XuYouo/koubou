import { NextResponse } from "next/server";

import { prisma } from "@/lib/server/db";
import { hashPassword } from "@/lib/server/password";
import { badRequest, readJson } from "@/lib/server/responses";
import { requireAdmin } from "@/lib/server/session";

export async function GET() {
  const { response } = await requireAdmin();
  if (response) return response;

  const users = await prisma.user.findMany({
    where: { deletedAt: null },
    orderBy: { createdAt: "desc" },
    select: {
      id: true,
      username: true,
      role: true,
      status: true,
      createdAt: true,
    },
  });

  return NextResponse.json({
    users: users.map((user) => ({
      ...user,
      createdAt: user.createdAt.toISOString(),
    })),
  });
}

export async function POST(request: Request) {
  const { response } = await requireAdmin();
  if (response) return response;

  const body = await readJson(request);
  const username = String(body?.username || "").trim();
  const password = String(body?.password || "");
  const role = body?.role === "ADMIN" ? "ADMIN" : "USER";

  if (!username || !password) {
    return badRequest("Username and password are required");
  }
  if (password.length < 8) {
    return badRequest("Password must be at least 8 characters");
  }

  const passwordHash = await hashPassword(password);

  try {
    const user = await prisma.user.create({
      data: {
        username,
        passwordHash,
        role,
      },
    });

    return NextResponse.json({
      user: {
        id: user.id,
        username: user.username,
        role: user.role,
        status: user.status,
        createdAt: user.createdAt.toISOString(),
      },
    });
  } catch {
    return badRequest("Username already exists");
  }
}
