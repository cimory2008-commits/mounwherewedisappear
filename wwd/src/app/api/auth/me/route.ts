import { NextResponse } from "next/server";
import { db } from "@/lib/supabase";
import { currentUserId } from "@/lib/session";
import { getRank } from "@/lib/ranks";

export const runtime = "nodejs";

export async function GET() {
  const uid = await currentUserId();
  if (!uid) return NextResponse.json({ error: "unauthenticated" }, { status: 401 });
  try {
    const client = db();
    const { data: p } = await client.from("players")
      .select("roblox_user_id,username,displayname,avatar_url,total_summit,total_playtime")
      .eq("roblox_user_id", uid).maybeSingle();
    if (!p) return NextResponse.json({ error: "player_not_synced" }, { status: 404 }); // belum pernah tersinkron dari game

    const ahead = async (col: "total_summit" | "total_playtime") =>
      ((await client.from("players").select("id", { count: "exact", head: true }).gt(col, p[col])).count ?? 0) + 1;
    const [summitPos, playtimePos] = await Promise.all([ahead("total_summit"), ahead("total_playtime")]);
    const rank = getRank(p.total_summit);
    return NextResponse.json({
      robloxUserId: p.roblox_user_id, username: p.username, displayName: p.displayname, avatarUrl: p.avatar_url,
      totalSummit: p.total_summit, totalPlaytime: p.total_playtime,
      rank: { id: rank.id, name: rank.name, icon: rank.icon },
      summitPosition: summitPos, playtimePosition: playtimePos,
    });
  } catch (e) {
    console.error("me error", e);
    return NextResponse.json({ error: "Database error." }, { status: 500 });
  }
}
