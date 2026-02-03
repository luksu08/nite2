import { notFound } from "next/navigation";
import { supabaseServer } from "@/lib/supabaseServer";

export default async function AdminPage() {
  const supabase = await supabaseServer();

  const { data } = await supabase.auth.getUser();
  const user = data.user;
  if (!user) notFound();

  // Check admin table
  const { data: adminRow } = await supabase
    .from("admins")
    .select("user_id")
    .eq("user_id", user.id)
    .maybeSingle();

  if (!adminRow) notFound();

  // Minimal dashboard data: latest reports
  const { data: reports } = await supabase
    .from("reports")
    .select("id, created_at, reporter, reported, reason, status")
    .order("created_at", { ascending: false })
    .limit(50);

  return (
    <main className="min-h-screen bg-black text-white">
      <div className="max-w-3xl mx-auto px-6 py-10">
        <h1 className="text-2xl font-bold">Admin</h1>
        <p className="text-zinc-400 mt-2">Vain sinä näet tämän. Muut saavat 404.</p>

        <div className="mt-8 rounded-2xl border border-zinc-800 bg-zinc-950 overflow-hidden">
          <div className="p-4 border-b border-zinc-800">
            <h2 className="font-semibold">Report queue (viimeiset 50)</h2>
          </div>

          <div className="divide-y divide-zinc-800">
            {(reports ?? []).map((r: any) => (
              <div key={r.id} className="p-4">
                <div className="text-sm text-zinc-400">{new Date(r.created_at).toLocaleString("fi-FI")}</div>
                <div className="mt-1 text-sm">
                  <b>reported:</b> {r.reported} <span className="text-zinc-500">|</span> <b>by:</b> {r.reporter}
                </div>
                <div className="mt-2 text-zinc-200">{r.reason}</div>
                <div className="mt-2 text-xs text-zinc-500">status: {r.status}</div>
              </div>
            ))}
            {(reports ?? []).length === 0 && (
              <div className="p-4 text-zinc-400">Ei raportteja.</div>
            )}
          </div>
        </div>
      </div>
    </main>
  );
}
