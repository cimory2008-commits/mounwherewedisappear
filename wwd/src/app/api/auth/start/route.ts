import { NextResponse } from "next/server";
import { randomBytes, randomInt } from "crypto";
import { db } from "@/lib/supabase";
import { PENDING_COOKIE, cookieOpts } from "@/lib/session";

export const runtime = "nodejs";
const ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"; // tanpa karakter yang mirip (0/O, 1/I)
const TTL_SEC = 600;

const makeCode = () => Array.from({ length: 6 }, () => ALPHABET[randomInt(ALPHABET.length)]).join("");

export async function POST(req: Request) {
  let username = "";
  try { username = String((await req.json()).username ?? "").trim(); } catch {}
  if (!/^[A-Za-z0-9_]{3,20}$/.test(username))
    return NextResponse.json({ error: "Username Roblox tidak valid (3-20 karakter: huruf, angka, _)." }, { status: 400 });

  // Roblox: cari User ID dari USERNAME (bukan displayname)
  let user: { id: number; name: string; displayName: string } | undefined;
  try {
    const r = await fetch("https://users.roblox.com/v1/usernames/users", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ usernames: [username], excludeBannedUsers: true }),
      cache: "no-store",
    });
    if (!r.ok) throw new Error(`roblox ${r.status}`);
    user = (await r.json()).data?.[0];
  } catch (e) {
    console.error("roblox lookup error", e);
    return NextResponse.json({ error: "Roblox API sedang bermasalah, coba lagi sebentar." }, { status: 502 });
  }
  if (!user) return NextResponse.json({ error: "Username Roblox tidak ditemukan." }, { status: 404 });

  try {
    const client = db();
    await client.from("login_codes").delete().eq("roblox_user_id", user.id).neq("status", "used"); // 1 kode aktif per akun
    const token = randomBytes(24).toString("hex");
    const expires = new Date(Date.now() + TTL_SEC * 1000).toISOString();
    let code = "";
    for (let i = 0; i < 5; i++) {
      code = makeCode();
      const { error } = await client.from("login_codes").insert({ code, pending_token: token, roblox_user_id: user.id, expires_at: expires });
      if (!error) break;
      if (i === 4) throw error;
    }
    const res = NextResponse.json({
      user: { id: user.id, username: user.name, displayName: user.displayName },
      code, expiresAt: expires,
    });
    res.cookies.set(PENDING_COOKIE, token, cookieOpts(TTL_SEC));
    return res;
  } catch (e) {
    console.error("auth start db error", e);
    return NextResponse.json({ error: "Database error." }, { status: 500 });
  }
}
