import { prisma } from "@/lib/server/db";
import { DEFAULT_IMAGE_SETTINGS, normalizeImageSettings } from "@/lib/image-options";
import { decryptSecret, encryptSecret } from "@/lib/server/secrets";

export function parseModelOptions(value: string | null | undefined) {
  if (!value) return DEFAULT_IMAGE_SETTINGS;
  try {
    return normalizeImageSettings(JSON.parse(value));
  } catch {
    return DEFAULT_IMAGE_SETTINGS;
  }
}

export async function getActiveModelConfig() {
  const config = await prisma.modelConfig.findFirst({
    where: { enabled: true },
    orderBy: { updatedAt: "desc" },
  });

  if (!config) return null;

  return {
    ...config,
    apiKey: decryptSecret(config.encryptedApiKey),
    options: parseModelOptions(config.defaultOptions),
  };
}

export async function upsertModelConfig({
  model,
  baseUrl,
  apiKey,
  enabled,
  defaultOptions,
}: {
  model: string;
  baseUrl: string;
  apiKey?: string;
  enabled: boolean;
  defaultOptions: string;
}) {
  const existing = await prisma.modelConfig.findFirst({
    orderBy: { createdAt: "asc" },
  });

  const encryptedApiKey =
    apiKey && apiKey.trim()
      ? encryptSecret(apiKey.trim())
      : existing?.encryptedApiKey;

  if (!encryptedApiKey) {
    throw new Error("API key is required");
  }

  const data = {
    provider: "openai-compatible",
    model,
    baseUrl,
    encryptedApiKey,
    enabled,
    defaultOptions,
  };

  if (existing) {
    return prisma.modelConfig.update({
      where: { id: existing.id },
      data,
    });
  }

  return prisma.modelConfig.create({ data });
}

export function toSafeModelConfig(
  config: Awaited<ReturnType<typeof prisma.modelConfig.findFirst>>
) {
  if (!config) return null;
  return {
    id: config.id,
    provider: config.provider,
    model: config.model,
    baseUrl: config.baseUrl,
    enabled: config.enabled,
    hasApiKey: Boolean(config.encryptedApiKey),
    defaultOptions: parseModelOptions(config.defaultOptions),
    updatedAt: config.updatedAt.toISOString(),
  };
}
