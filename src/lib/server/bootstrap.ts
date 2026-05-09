import { prisma } from "@/lib/server/db";
import { hashPassword } from "@/lib/server/password";
import { encryptSecret } from "@/lib/server/secrets";
import { DEFAULT_IMAGE_SETTINGS } from "@/lib/image-options";

let bootstrapPromise: Promise<void> | null = null;

export function ensureBootstrap() {
  bootstrapPromise ??= bootstrap();
  return bootstrapPromise;
}

async function bootstrap() {
  const adminUsername = process.env.ADMIN_USERNAME?.trim();
  const adminPassword = process.env.ADMIN_PASSWORD;

  if (adminUsername && adminPassword) {
    const passwordHash = await hashPassword(adminPassword);
    await prisma.user.upsert({
      where: { username: adminUsername },
      update: {
        passwordHash,
        role: "ADMIN",
        status: "ACTIVE",
        deletedAt: null,
      },
      create: {
        username: adminUsername,
        passwordHash,
        role: "ADMIN",
        status: "ACTIVE",
      },
    });
  }

  const baseUrl = process.env.GPT_IMAGE_2_BASE_URL?.trim();
  const apiKey = process.env.BASE_URL_API_KEY?.trim();
  const model = process.env.IMAGE_MODEL?.trim() || "gpt-image-2";

  if (baseUrl && apiKey && process.env.MODEL_CONFIG_ENCRYPTION_KEY) {
    const existing = await prisma.modelConfig.findFirst({
      where: { model },
      orderBy: { createdAt: "asc" },
    });
    const data = {
      provider: "openai-compatible",
      model,
      baseUrl,
      encryptedApiKey: encryptSecret(apiKey),
      enabled: true,
      defaultOptions: JSON.stringify(DEFAULT_IMAGE_SETTINGS),
    };

    if (existing) {
      await prisma.modelConfig.update({
        where: { id: existing.id },
        data,
      });
    } else {
      await prisma.modelConfig.create({ data });
    }
  }
}
