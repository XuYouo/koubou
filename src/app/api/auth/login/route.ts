import { NextResponse } from "next/server";

import { ensureBootstrap } from "@/lib/server/bootstrap";
import { prisma } from "@/lib/server/db";
import { verifyPassword } from "@/lib/server/password";
import { badRequest, readJson } from "@/lib/server/responses";
import { createSession } from "@/lib/server/session";

export async function POST(request: Request) {
  await ensureBootstrap();
  const body = await readJson(request);
  const username = String(body?.username || "").trim();
  const password = String(body?.password || "");

  if (!username || !password) {
    return badRequest("Username and password are required");
  }

  const user = await prisma.user.findUnique({ where: { username } });
  if (!user || user.deletedAt || user.status !== "ACTIVE") {
    return NextResponse.json({ error: "Invalid credentials" }, { status: 401 });
  }

  const validPassword = await verifyPassword(password, user.passwordHash);
  if (!validPassword) {
    return NextResponse.json({ error: "Invalid credentials" }, { status: 401 });
  }

  const response = NextResponse.json({
    user: {
      id: user.id,
      username: user.username,
      role: user.role,
    },
  });
  await createSession(user.id, response);
  return response;
}
