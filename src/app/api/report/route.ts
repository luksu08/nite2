import { NextResponse } from "next/server";
import { supabaseServer } from "@/lib/supabaseServer";

export async function POST(req: Request) {
  const supabase = await supabaseServer();

  const { data } = await supabase.auth.getUser();
  const user = data.user;
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const body = await req.json();
  const reported = String(body?.reported || "");
  const reason = String(body?.reason || "").slice(0, 500);

  if (!reported || reason.length < 3) {
    return NextResponse.json({ error: "missing fields" }, { status: 400 });
  }

  // Report rate limit: max 5 per hour, max 10 per day
  const { data: okHour } = await supabase.rpc("check_rate_limit", {
    p_actor: user.id,
    p_action: "report",
    p_window_seconds: 3600,
    p_max: 5,
  });
  if (!okHour) return NextResponse.json({ error: "rate_limited" }, { status: 429 });

  const { data: okDay } = await supabase.rpc("check_rate_limit", {
    p_actor: user.id,
    p_action: "report",
    p_window_seconds: 86400,
    p_max: 10,
  });
  if (!okDay) return NextResponse.json({ error: "daily_limit" }, { status: 429 });

  const { error } = await supabase.from("reports").insert({
    reporter: user.id,
    reported,
    reason,
  });

  if (error) return NextResponse.json({ error: error.message }, { status: 400 });

  return NextResponse.json({ ok: true });
}
