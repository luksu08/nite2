import { NextResponse } from "next/server";
import { supabaseServer } from "@/lib/supabaseServer";

export async function POST(req: Request) {
  const supabase = await supabaseServer();

  const { data } = await supabase.auth.getUser();
  const user = data.user;
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const body = await req.json();
  const match_id = String(body?.match_id || "");
  const text = String(body?.body || "").slice(0, 1000).trim();

  if (!match_id || text.length < 1) {
    return NextResponse.json({ error: "missing fields" }, { status: 400 });
  }

  // Flood control: 1 msg / 1s and max 200/day
  const { data: ok1s } = await supabase.rpc("check_rate_limit", {
    p_actor: user.id,
    p_action: "message",
    p_window_seconds: 1,
    p_max: 1,
  });
  if (!ok1s) return NextResponse.json({ error: "too_fast" }, { status: 429 });

  const { data: okDay } = await supabase.rpc("check_rate_limit", {
    p_actor: user.id,
    p_action: "message",
    p_window_seconds: 86400,
    p_max: 200,
  });
  if (!okDay) return NextResponse.json({ error: "daily_limit" }, { status: 429 });

  const { error } = await supabase.from("messages").insert({
    match_id,
    sender: user.id,
    body: text,
  });

  if (error) return NextResponse.json({ error: error.message }, { status: 400 });

  return NextResponse.json({ ok: true });
}
