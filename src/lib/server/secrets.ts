import crypto from "node:crypto";

function keyFromSecret(secret: string) {
  return crypto.createHash("sha256").update(secret).digest();
}

export function requireEnv(name: string) {
  const value = process.env[name];
  if (!value || !value.trim()) {
    throw new Error(`${name} is required`);
  }
  return value;
}

export function encryptSecret(value: string) {
  const key = keyFromSecret(requireEnv("MODEL_CONFIG_ENCRYPTION_KEY"));
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv("aes-256-gcm", key, iv);
  const encrypted = Buffer.concat([
    cipher.update(value, "utf8"),
    cipher.final(),
  ]);
  const tag = cipher.getAuthTag();
  return [iv, tag, encrypted].map((part) => part.toString("base64url")).join(".");
}

export function decryptSecret(value: string) {
  const [ivPart, tagPart, encryptedPart] = value.split(".");
  if (!ivPart || !tagPart || !encryptedPart) {
    throw new Error("Stored secret is invalid");
  }

  const key = keyFromSecret(requireEnv("MODEL_CONFIG_ENCRYPTION_KEY"));
  const decipher = crypto.createDecipheriv(
    "aes-256-gcm",
    key,
    Buffer.from(ivPart, "base64url")
  );
  decipher.setAuthTag(Buffer.from(tagPart, "base64url"));
  const decrypted = Buffer.concat([
    decipher.update(Buffer.from(encryptedPart, "base64url")),
    decipher.final(),
  ]);
  return decrypted.toString("utf8");
}

export function sha256(value: string) {
  return crypto.createHash("sha256").update(value).digest("hex");
}
