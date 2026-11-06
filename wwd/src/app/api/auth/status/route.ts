import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { db } from "@/lib/supabase";
import { PENDING_COOKIE, SESSION_COOKIE, SESSION_TTL, cookieOpts, makeSession } from "@/lib/session";

export const runtime = "nodejs";

// Dipanggil browser berkala (polling) setelah user menampilkan kode.
export async function GET() {
  const token = (await cookies()).get(PENDING_COOKIE)?.value;
  if (!token) return NextResponse.json({ status: "none" });
  try {
    const client = db();
    const { data } = await client.from("login_codes").select("id,roblox_user_id,status,expires_at")
      .eq("pending_token", token).maybeSingle();
    if (!data) return NextResponse.json({ status: "none" });
    if (new Date(data.expires_at) < new Date()) return NextResponse.json({ status: "expired" });
    if (data.status !== "verified") return NextResponse.json({ status: "pending" });

    // Tandai terpakai (sekali pakai), lalu buat session.
    const { data: used } = await client.from("login_codes").update({ status: "used" })
      .eq("id", data.id).eq("status", "verified").select("id");
    if (!used?.length) return NextResponse.json({ status: "none" });
    const res = NextResponse.json({ status: "verified" });
    res.cookies.set(SESSION_COOKIE, makeSession(Number(data.roblox_user_id)), cookieOpts(SESSION_TTL));
    res.cookies.set(PENDING_COOKIE, "", cookieOpts(0));
    return res;
  } catch (e) {
    console.error("auth status error", e);
    return NextResponse.json({ error: "Database error." }, { status: 500 });
  }
}
