import { NextResponse } from "next/server";

import { ensureBootstrap } from "@/lib/server/bootstrap";
import { getCurrentUser } from "@/lib/server/session";

export async function GET() {
  await ensureBootstrap();
  const user = await getCurrentUser();
  return NextResponse.json({ user });
}
