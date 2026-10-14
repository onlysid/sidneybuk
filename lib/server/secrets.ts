import "server-only";
import { createCipheriv, createDecipheriv, createHash, createHmac, randomBytes, timingSafeEqual } from "node:crypto";

// APP_SECRET is the one secret the server is given from outside (in .env).
function master() {
  const secret = process.env.APP_SECRET;
  if (!secret || secret.length < 16) throw new Error("APP_SECRET is not set (or is shorter than 16 characters)");
  return secret;
}
const key = (purpose: string) => createHash("sha256").update(`${purpose}:${master()}`).digest();

// API keys are stored encrypted (AES-256-GCM), so a copy of the database alone does not give them away.
export function lock(plain: string) {
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", key("settings"), iv);
  const body = Buffer.concat([cipher.update(plain, "utf8"), cipher.final()]);
  return [iv, cipher.getAuthTag(), body].map((b) => b.toString("base64url")).join(".");
}
export function unlock(locked: string) {
  try {
    const [iv, tag, body] = locked.split(".").map((p) => Buffer.from(p, "base64url"));
    const decipher = createDecipheriv("aes-256-gcm", key("settings"), iv);
    decipher.setAuthTag(tag);
    return Buffer.concat([decipher.update(body), decipher.final()]).toString("utf8");
  } catch {
    return "";
  }
}

export const sign = (text: string) => createHmac("sha256", key("session")).update(text).digest("base64url");
export function same(a: string, b: string) {
  const x = createHash("sha256").update(a).digest(), y = createHash("sha256").update(b).digest();
  return timingSafeEqual(x, y);
}
