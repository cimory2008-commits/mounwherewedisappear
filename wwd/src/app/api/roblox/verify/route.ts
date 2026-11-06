import { NextResponse } from "next/server";
import { timingSafeEqual } from "crypto";
import { db } from "@/lib/supabase";

export const runtime = "nodejs";

function validKey(h: string | null) {
  const s = process.env.ROBLOX_API_KEY;
  if (!s || s.length < 32 || !h) return false;
  const a = Buffer.from(h), b = Buffer.from(s);
  return a.length === b.length && timingSafeEqual(a, b);
}

// Dipanggil HANYA oleh server game Roblox. userId berasal dari Player.UserId asli.
export async function POST(req: Request) {
  if (!validKey(req.headers.get("x-api-key"))) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  let code = "", userId = 0;
  try { const b = await req.json(); code = String(b.code ?? "").toUpperCase().replace(/[^A-Z0-9]/g, ""); userId = Number(b.userId); } catch {}
  if (code.length < 4 || code.length > 12 || !Number.isSafeInteger(userId) || userId <= 0)
    return NextResponse.json({ error: "bad request" }, { status: 400 });

  try {
    const client = db();
    const { data } = await client.from("login_codes").select("id,roblox_user_id,expires_at")
      .eq("code", code).eq("status", "pending").maybeSingle();
    if (!data || new Date(data.expires_at) < new Date()) return NextResponse.json({ error: "not_found" }, { status: 404 });
    if (Number(data.roblox_user_id) !== userId) return NextResponse.json({ error: "wrong_account" }, { status: 403 });
    const { error } = await client.from("login_codes").update({ status: "verified" }).eq("id", data.id).eq("status", "pending");
    if (error) throw error;
    return NextResponse.json({ ok: true });
  } catch (e) {
    console.error("verify error", e);
    return NextResponse.json({ error: "database error" }, { status: 500 });
  }
}
