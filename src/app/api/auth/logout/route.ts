import { NextResponse } from "next/server";

import { clearSession } from "@/lib/server/session";

export async function POST() {
  const response = NextResponse.json({ ok: true });
  await clearSession(response);
  return response;
}
