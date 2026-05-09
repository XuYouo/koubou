import type { ImageSettings } from "@/lib/image-options";
import { DEFAULT_IMAGE_SETTINGS, normalizeImageSettings } from "@/lib/image-options";
import { parseModelOptions } from "@/lib/server/model-config";
import { prisma } from "@/lib/server/db";

export async function getUserImageSettings(userId: string): Promise<ImageSettings> {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { defaultImageSettings: true },
  });

  if (user?.defaultImageSettings) {
    return parseImageSettings(user.defaultImageSettings);
  }

  const modelConfig = await prisma.modelConfig.findFirst({
    where: { enabled: true },
    orderBy: { updatedAt: "desc" },
    select: { defaultOptions: true },
  });

  return modelConfig
    ? parseModelOptions(modelConfig.defaultOptions)
    : DEFAULT_IMAGE_SETTINGS;
}

export async function updateUserImageSettings(
  userId: string,
  input: Partial<ImageSettings>
) {
  const settings = normalizeImageSettings(input);

  await prisma.user.update({
    where: { id: userId },
    data: { defaultImageSettings: JSON.stringify(settings) },
  });

  return settings;
}

function parseImageSettings(value: string) {
  try {
    return normalizeImageSettings(JSON.parse(value));
  } catch {
    return DEFAULT_IMAGE_SETTINGS;
  }
}
