import { NextResponse } from "next/server";
import { db } from "@/lib/supabase";
import { getRank } from "@/lib/ranks";

export const runtime = "nodejs";
export const revalidate = 30;
const PAGE_SIZE = 10;

export async function GET(req: Request) {
  const u = new URL(req.url);
  const type = u.searchParams.get("type") === "summit" ? "summit" : "playtime";
  const page = Math.max(1, Math.min(10000, parseInt(u.searchParams.get("page") ?? "1", 10) || 1));
  const q = (u.searchParams.get("q") ?? "").trim().replace(/[^\w.]/g, "").slice(0, 30); // aman untuk filter
  const col = type === "summit" ? "total_summit" : "total_playtime";

  try {
    const client = db();
    let query = client
      .from("players")
      .select("roblox_user_id,username,displayname,avatar_url,total_summit,total_playtime", { count: "exact" })
      .order(col, { ascending: false })
      .order("roblox_user_id", { ascending: true })
      .range((page - 1) * PAGE_SIZE, page * PAGE_SIZE - 1);
    if (q) query = query.or(`username.ilike.%${q}%,displayname.ilike.%${q}%`);

    const { data, count, error } = await query;
    if (error) throw error;

    // Ranking asli (global), bukan urutan hasil pencarian.
    const rows = await Promise.all(
      (data ?? []).map(async (p) => {
        const { count: ahead } = await client
          .from("players").select("id", { count: "exact", head: true }).gt(col, p[col]);
        const rank = getRank(p.total_summit);
        return {
          rank: (ahead ?? 0) + 1,
          robloxUserId: p.roblox_user_id,
          username: p.username,
          displayName: p.displayname,
          avatarUrl: p.avatar_url,
          totalSummit: p.total_summit,
          totalPlaytime: p.total_playtime,
          summitRank: { id: rank.id, name: rank.name, icon: rank.icon },
        };
      })
    );
    return NextResponse.json({ type, page, pageSize: PAGE_SIZE, total: count ?? 0, rows });
  } catch (e) {
    console.error("leaderboard error", e);
    return NextResponse.json({ error: "gagal memuat leaderboard" }, { status: 500 });
  }
}
