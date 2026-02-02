"use client";

import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/lib/supabaseClient";

type Candidate = {
  id: string;
  display_name: string;
  role: string;
  looking: string;
  show_city: boolean;
  city: string | null;
};

export default function BrowsePage() {
  const [cands, setCands] = useState<Candidate[]>([]);
  const [loading, setLoading] = useState(true);

  const current = useMemo(() => cands[0] ?? null, [cands]);

  useEffect(() => {
    (async () => {
      const user = (await supabase.auth.getUser()).data.user;
      if (!user) {
        window.location.href = "/login";
        return;
      }

      // Varmista että profiili on tehty
      const prof = await supabase
        .from("profiles")
        .select("id")
        .eq("id", user.id)
        .maybeSingle();

      if (!prof.data) {
        window.location.href = "/onboarding";
        return;
      }

      await loadCandidates();
      setLoading(false);
    })();
  }, []);

  async function loadCandidates() {
    const user = (await supabase.auth.getUser()).data.user;
    if (!user) return;

    const { data, error } = await supabase
      .from("profiles")
      .select("id, display_name, role, looking, show_city, city")
      .eq("is_active", true)
      .neq("id", user.id) // TÄRKEÄ: ei omaa profiilia
      .limit(50);

    if (error) {
      alert(error.message);
      return;
    }

    // extra-varmistus frontissa
    const filtered = (data ?? []).filter((p) => p.id !== user.id);
    const shuffled = filtered.sort(() => Math.random() - 0.5);
    setCands(shuffled as Candidate[]);
  }

  function skip() {
    setCands((prev) => prev.slice(1));
  }

  async function like() {
    if (!current) return;

    const user = (await supabase.auth.getUser()).data.user;
    if (!user) {
      alert("Et ole kirjautunut sisään");
      return;
    }

    // absoluuttinen varmistus
    if (current.id === user.id) {
      skip();
      return;
    }

    const { error } = await supabase.from("likes").insert({
      from_user: user.id,
      to_user: current.id,
    });

    if (error && !String(error.message).toLowerCase().includes("duplicate")) {
      alert(error.message);
      return;
    }

    skip();
  }

  async function block() {
    if (!current) return;

    const user = (await supabase.auth.getUser()).data.user;
    if (!user) return alert("Et ole kirjautunut sisään");

    const { error } = await supabase
      .from("blocks")
      .insert({ blocker: user.id, blocked: current.id });

    if (error) {
      alert(error.message);
      return;
    }
    skip();
  }

  async function report() {
    if (!current) return;

    const user = (await supabase.auth.getUser()).data.user;
    if (!user) return alert("Et ole kirjautunut sisään");

    const reason = prompt("Miksi raportoit?");
    if (!reason) return;

    const { error } = await supabase.from("reports").insert({
      reporter: user.id,
      reported: current.id,
      reason,
    });

    if (error) {
      alert(error.message);
      return;
    }
    skip();
  }

  async function logout() {
    await supabase.auth.signOut();
    window.location.href = "/login";
  }

  if (loading) {
    return (
      <main className="min-h-screen bg-black text-white flex items-center justify-center">
        <p>Ladataan…</p>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-black text-white">
      <header className="max-w-xl mx-auto px-6 pt-6 flex items-center justify-between">
        <h1 className="text-xl font-bold">NITE</h1>
        <div className="flex gap-2">
          <a
            className="px-3 py-2 rounded-xl bg-zinc-900 border border-zinc-700 text-sm"
            href="/matches"
          >
            Matchit
          </a>
          <button
            className="px-3 py-2 rounded-xl bg-zinc-900 border border-zinc-700 text-sm"
            onClick={logout}
          >
            Ulos
          </button>
        </div>
      </header>

      <section className="max-w-xl mx-auto px-6 py-8">
        {!current ? (
          <div className="rounded-2xl border border-zinc-800 bg-zinc-950 p-8 text-center">
            <p className="text-lg font-semibold">Ei enempää profiileja nyt.</p>
            <button
              className="mt-6 w-full p-3 rounded-xl bg-white text-black font-semibold"
              onClick={loadCandidates}
            >
              Lataa lisää
            </button>
          </div>
        ) : (
          <div className="rounded-2xl border border-zinc-800 bg-zinc-950 overflow-hidden">
            <div className="h-80 bg-gradient-to-b from-zinc-900 to-black flex items-end">
              <div className="p-5 w-full">
                <div className="flex items-center justify-between">
                  <h2 className="text-2xl font-bold">
                    {current.display_name}
                  </h2>
                  <span className="text-zinc-400 text-sm">
                    {current.show_city && current.city ? current.city : ""}
                  </span>
                </div>
                <p className="text-zinc-300 mt-1">
                  {current.role} · {current.looking}
                </p>
              </div>
            </div>

            <div className="p-5 grid grid-cols-2 gap-3">
              <button
                className="p-3 rounded-xl bg-zinc-900 border border-zinc-700"
                onClick={skip}
              >
                Skip
              </button>
              <button
                className="p-3 rounded-xl bg-white text-black font-semibold"
                onClick={like}
              >
                Like
              </button>

              <button
                className="p-3 rounded-xl bg-zinc-900 border border-zinc-700 text-zinc-300"
                onClick={block}
              >
                Block
              </button>
              <button
                className="p-3 rounded-xl bg-zinc-900 border border-zinc-700 text-zinc-300"
                onClick={report}
              >
                Report
              </button>
            </div>
          </div>
        )}
      </section>
    </main>
  );
}
