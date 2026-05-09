import crypto from "node:crypto";
import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import type { User } from "@prisma/client";

import { prisma } from "@/lib/server/db";
import { requireEnv, sha256 } from "@/lib/server/secrets";

export const SESSION_COOKIE = "koubou_session";
const SESSION_DAYS = 7;

export type AuthenticatedUser = Pick<User, "id" | "username" | "role">;

function sessionExpiresAt() {
  return new Date(Date.now() + SESSION_DAYS * 24 * 60 * 60 * 1000);
}

function cookieOptions(expires?: Date) {
  return {
    httpOnly: true,
    sameSite: "lax" as const,
    secure: process.env.NODE_ENV === "production",
    path: "/",
    expires,
  };
}

export async function createSession(userId: string, response: NextResponse) {
  requireEnv("SESSION_SECRET");
  const token = crypto.randomBytes(32).toString("base64url");
  const expiresAt = sessionExpiresAt();

  await prisma.session.create({
    data: {
      tokenHash: sha256(token),
      userId,
      expiresAt,
    },
  });

  response.cookies.set(SESSION_COOKIE, token, cookieOptions(expiresAt));
}

export async function clearSession(response: NextResponse) {
  const cookieStore = await cookies();
  const token = cookieStore.get(SESSION_COOKIE)?.value;
  if (token) {
    await prisma.session.deleteMany({
      where: {
        tokenHash: sha256(token),
      },
    });
  }
  response.cookies.set(SESSION_COOKIE, "", cookieOptions(new Date(0)));
}

export async function getCurrentUser(): Promise<AuthenticatedUser | null> {
  const cookieStore = await cookies();
  const token = cookieStore.get(SESSION_COOKIE)?.value;
  if (!token) return null;

  const session = await prisma.session.findUnique({
    where: { tokenHash: sha256(token) },
    include: { user: true },
  });

  if (
    !session ||
    session.expiresAt <= new Date() ||
    session.user.status !== "ACTIVE" ||
    session.user.deletedAt
  ) {
    if (session) {
      await prisma.session.delete({ where: { id: session.id } }).catch(() => {});
    }
    return null;
  }

  return {
    id: session.user.id,
    username: session.user.username,
    role: session.user.role,
  };
}

export async function requireUser() {
  const user = await getCurrentUser();
  if (!user) {
    return {
      user: null,
      response: NextResponse.json({ error: "Unauthorized" }, { status: 401 }),
    };
  }
  return { user, response: null };
}

export async function requireAdmin() {
  const { user, response } = await requireUser();
  if (response) return { user: null, response };
  if (!user || user.role !== "ADMIN") {
    return {
      user: null,
      response: NextResponse.json({ error: "Forbidden" }, { status: 403 }),
    };
  }
  return { user, response: null };
}
