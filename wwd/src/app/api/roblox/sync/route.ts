import { NextResponse } from "next/server";
import { timingSafeEqual } from "crypto";
import { db } from "@/lib/supabase";

export const runtime = "nodejs";

type Incoming = { userId: number; username: string; displayName: string; summit: number; playtime: number };

function validKey(header: string | null) {
  const secret = process.env.ROBLOX_API_KEY;
  if (!secret || secret.length < 32 || !header) return false;
  const a = Buffer.from(header);
  const b = Buffer.from(secret);
  return a.length === b.length && timingSafeEqual(a, b);
}

function parse(p: unknown): Incoming | null {
  const o = p as Record<string, unknown>;
  const userId = Number(o?.userId), summit = Number(o?.summit), playtime = Number(o?.playtime);
  if (!Number.isSafeInteger(userId) || userId <= 0) return null;
  if (!Number.isSafeInteger(summit) || summit < 0 || summit > 1_000_000) return null;
  if (!Number.isFinite(playtime) || playtime < 0 || playtime > 1e10) return null;
  if (typeof o.username !== "string" || o.username.length < 1 || o.username.length > 50) return null;
  if (typeof o.displayName !== "string" || o.displayName.length > 50) return null;
  return { userId, username: o.username, displayName: o.displayName || o.username, summit, playtime: Math.floor(playtime) };
}

async function headshots(ids: number[]) {
  const map = new Map<number, string>();
  try {
    const r = await fetch(
      `https://thumbnails.roblox.com/v1/users/avatar-headshot?userIds=${ids.join(",")}&size=150x150&format=Png&isCircular=false`,
      { cache: "no-store" }
    );
    if (r.ok) {
      const j = (await r.json()) as { data?: { targetId: number; state: string; imageUrl: string }[] };
      for (const d of j.data ?? []) if (d.state === "Completed" && d.imageUrl) map.set(d.targetId, d.imageUrl);
    }
  } catch {}
  return map;
}

export async function POST(req: Request) {
  if (!validKey(req.headers.get("x-api-key"))) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  let body: unknown;
  try { body = await req.json(); } catch { return NextResponse.json({ error: "invalid json" }, { status: 400 }); }

  const list = (body as { players?: unknown })?.players;
  if (!Array.isArray(list) || list.length === 0 || list.length > 100)
    return NextResponse.json({ error: "players harus array 1-100" }, { status: 400 });

  const players = list.map(parse);
  if (players.some((p) => !p)) return NextResponse.json({ error: "data pemain tidak valid" }, { status: 400 });
  const valid = players as Incoming[];

  const avatars = await headshots(valid.map((p) => p.userId));
  const rows = valid.map((p) => ({
    roblox_user_id: p.userId,
    username: p.username,
    displayname: p.displayName,
    total_summit: p.summit,
    total_playtime: p.playtime,
    updated_at: new Date().toISOString(),
    ...(avatars.has(p.userId) ? { avatar_url: avatars.get(p.userId) } : {}),
  }));

  try {
    const { error } = await db().from("players").upsert(rows, { onConflict: "roblox_user_id" });
    if (error) throw error;
  } catch (e) {
    console.error("sync db error", e);
    return NextResponse.json({ error: "database error" }, { status: 500 });
  }
  return NextResponse.json({ ok: true, count: rows.length });
}
