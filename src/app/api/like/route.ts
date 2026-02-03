import { NextResponse } from "next/server";
import { supabaseServer } from "@/lib/supabaseServer";

export async function POST(req: Request) {
  const supabase = await supabaseServer();

  const { data } = await supabase.auth.getUser();
  const user = data.user;
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const body = await req.json();
  const to_user = String(body?.to_user || "");

  if (!to_user) return NextResponse.json({ error: "missing to_user" }, { status: 400 });
  if (to_user === user.id) return NextResponse.json({ error: "no self-like" }, { status: 400 });

  // A2 rate limit: like max 50/day + 8/min (example)
  // 8 per 60s
  const { data: okFast } = await supabase.rpc("check_rate_limit", {
    p_actor: user.id,
    p_action: "like",
    p_window_seconds: 60,
    p_max: 8,
  });

  if (!okFast) return NextResponse.json({ error: "rate_limited_fast" }, { status: 429 });

  // 50 per day
  const { data: okDay } = await supabase.rpc("check_rate_limit", {
    p_actor: user.id,
    p_action: "like",
    p_window_seconds: 86400,
    p_max: 50,
  });

  if (!okDay) return NextResponse.json({ error: "daily_limit" }, { status: 429 });

  // Insert like via DB (RLS will require auth.uid() == from_user, which is true)
  const { error } = await supabase.from("likes").insert({
    from_user: user.id,
    to_user,
  });

  // Ignore duplicate
  if (error && !String(error.message).toLowerCase().includes("duplicate")) {
    return NextResponse.json({ error: error.message }, { status: 400 });
  }

  return NextResponse.json({ ok: true });
}
