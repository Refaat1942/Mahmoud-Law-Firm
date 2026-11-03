import { createCipheriv, createDecipheriv, createHash, randomBytes } from "node:crypto";

// Secrets stored in the database (e.g. AI provider API keys) are encrypted with AES-256-GCM using a key
// derived from AUTH_SECRET, so a database dump alone does not reveal them.
const key = (secret = process.env.AUTH_SECRET ?? "") => {
  if (!secret) throw new Error("AUTH_SECRET is not set");
  return createHash("sha256").update(`settings-secret:${secret}`).digest();
};

export function encryptSecret(plain: string, secret?: string) {
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", key(secret), iv);
  const data = Buffer.concat([cipher.update(plain, "utf8"), cipher.final()]);
  return ["v1", iv.toString("base64"), cipher.getAuthTag().toString("base64"), data.toString("base64")].join(":");
}

/** Returns null when the value is missing, malformed or was encrypted with another AUTH_SECRET. */
export function decryptSecret(stored: string | null | undefined, secret?: string): string | null {
  if (!stored) return null;
  const [v, iv, tag, data] = stored.split(":");
  if (v !== "v1" || !iv || !tag || !data) return null;
  try {
    const decipher = createDecipheriv("aes-256-gcm", key(secret), Buffer.from(iv, "base64"));
    decipher.setAuthTag(Buffer.from(tag, "base64"));
    return Buffer.concat([decipher.update(Buffer.from(data, "base64")), decipher.final()]).toString("utf8");
  } catch {
    return null;
  }
}

/** "sk-…abcd" style hint for showing that a key is set without revealing it. */
export const maskSecret = (plain: string | null) => (plain ? `${plain.slice(0, 3)}…${plain.slice(-4)}` : "");
