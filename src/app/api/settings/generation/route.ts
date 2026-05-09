import { NextResponse } from "next/server";

import { readJson } from "@/lib/server/responses";
import { requireUser } from "@/lib/server/session";
import {
  getUserImageSettings,
  updateUserImageSettings,
} from "@/lib/server/user-settings";

export async function GET() {
  const { user, response } = await requireUser();
  if (response) return response;

  const settings = await getUserImageSettings(user.id);
  return NextResponse.json({ settings });
}

export async function PUT(request: Request) {
  const { user, response } = await requireUser();
  if (response) return response;

  const body = await readJson(request);
  const settings = await updateUserImageSettings(user.id, {
    size: body?.size,
    quality: body?.quality,
    outputFormat: body?.outputFormat,
  });

  return NextResponse.json({ settings });
}
