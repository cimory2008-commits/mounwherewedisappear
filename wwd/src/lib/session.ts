import { createHmac, timingSafeEqual } from "crypto";
import { cookies } from "next/headers";

export const SESSION_COOKIE = "wwd_session";
export const PENDING_COOKIE = "wwd_pending";
const SESSION_TTL = 60 * 60 * 24 * 7; // 7 hari

function secret() {
  const s = process.env.SESSION_SECRET;
  if (!s || s.length < 32) throw new Error("SESSION_SECRET belum diisi (min 32 karakter)");
  return s;
}
const sign = (data: string) => createHmac("sha256", secret()).update(data).digest("base64url");

export const cookieOpts = (maxAge: number) => ({
  httpOnly: true,
  secure: process.env.NODE_ENV === "production",
  sameSite: "lax" as const,
  path: "/",
  maxAge,
});

export function makeSession(userId: number) {
  const payload = Buffer.from(JSON.stringify({ uid: userId, exp: Math.floor(Date.now() / 1000) + SESSION_TTL })).toString("base64url");
  return `${payload}.${sign(payload)}`;
}

export function readSession(token: string | undefined): number | null {
  if (!token) return null;
  const [payload, sig] = token.split(".");
  if (!payload || !sig) return null;
  const a = Buffer.from(sig), b = Buffer.from(sign(payload));
  if (a.length !== b.length || !timingSafeEqual(a, b)) return null;
  try {
    const { uid, exp } = JSON.parse(Buffer.from(payload, "base64url").toString());
    return Number.isSafeInteger(uid) && exp > Date.now() / 1000 ? uid : null;
  } catch { return null; }
}

export async function currentUserId() {
  return readSession((await cookies()).get(SESSION_COOKIE)?.value);
}
export { SESSION_TTL };
