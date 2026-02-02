"use client";

import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/lib/supabaseClient";

type Candidate = {
  id: string;
  display_name: string;
  role: string;
  looking: string;
  bio: string;
  show_city: boolean;
  city: string | null;
  photoUrl?: string | null;
};

type MatchRow = {
  id: string;
  user_a: string;
  user_b: string;
  created_at: string;
};

export default function BrowsePage() {
  const [loading, setLoading] = useState(true);
  const [cands, setCands] = useState<Candidate[]>([]);
  const [me, setMe] = useState<string | null>(null);

  const [matchOverlay, setMatchOverlay] = useState<{
    matchId: string;
    name: string;
    photoUrl: string | null;
  } | null>(null);

  const current = useMemo(() => cands[0] ?? null, [cands]);

  useEffect(() => {
    (async () => {
      const user = (await supabase.auth.getUser()).data.user;
      if (!user) {
        window.location.href = "/login";
        return;
      }
      setMe(user.id);

      // ensure profile exists
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

  async function signedUrl(path: string) {
    const { data, error } = await supabase.storage
      .from("photos")
      .createSignedUrl(path, 60 * 10);
    if (error) return null;
    return data.signedUrl;
  }

  async function loadCandidates() {
    const user = (await supabase.auth.getUser()).data.user;
    if (!user) return;

    // profiles
    const { data, error } = await supabase
      .from("profiles")
      .select("id, display_name, role, looking, bio, show_city, city, is_active")
      .eq("is_active", true)
      .neq("id", user.id)
      .limit(60);

    if (error) {
      alert(error.message);
      return;
    }

    const base = ((data ?? []) as any[])
      .filter((p) => p.id !== user.id)
      .map((p) => ({
        id: p.id,
        display_name: p.display_name ?? "",
        role: p.role ?? "none",
        looking: p.looking ?? "open",
        bio: p.bio ?? "",
        show_city: !!p.show_city,
        city: p.city ?? null,
      })) as Candidate[];

    if (base.length === 0) {
      setCands([]);
      return;
    }

    // primary photos in one query
    const ids = base.map((p) => p.id);

    const { data: photos } = await supabase
      .from("photos")
      .select("user_id, path")
      .in("user_id", ids)
      .eq("is_primary", true);

    const photoMap = new Map<string, string>();
    (photos ?? []).forEach((r: any) => photoMap.set(r.user_id, r.path));

    const enriched = await Promise.all(
      base.map(async (p) => {
        const path = photoMap.get(p.id);
        const url = path ? await signedUrl(path) : null;
        return { ...p, photoUrl: url };
      })
    );

    // shuffle
    setCands(enriched.sort(() => Math.random() - 0.5));
  }

  function skip() {
    setCands((prev) => prev.slice(1));
  }

  async function like() {
    if (!current) return;

    const user = (await supabase.auth.getUser()).data.user;
    if (!user) return alert("Et ole kirjautunut");

    // anti-self just in case
    if (current.id === user.id) {
      skip();
      return;
    }

    // insert like
    const { error } = await supabase.from("likes").insert({
      from_user: user.id,
      to_user: current.id,
    });

    // ignore duplicate key
    if (error && !String(error.message).toLowerCase().includes("duplicate")) {
      alert(error.message);
      return;
    }

    // check if match exists now
    const low = user.id < current.id ? user.id : current.id;
    const high = user.id < current.id ? current.id : user.id;

    const matchRes = await supabase
      .from("matches")
      .select("id, user_a, user_b, created_at")
      .eq("user_low", low)
      .eq("user_high", high)
      .maybeSingle();

    // NOTE: if you don't have user_low/user_high selectable via RLS,
    // fallback query:
    // .or(`and(user_a.eq.${user.id},user_b.eq.${current.id}),and(user_a.eq.${current.id},user_b.eq.${user.id})`)

    const match = matchRes.data as MatchRow | null;

    if (match?.id) {
      setMatchOverlay({
        matchId: match.id,
        name: current.display_name,
        photoUrl: current.photoUrl ?? null,
      });
    }

    skip();
  }

  async function block() {
    if (!current) return;

    const user = (await supabase.auth.getUser()).data.user;
    if (!user) return alert("Et ole kirjautunut");

    const { error } = await supabase.from("blocks").insert({
      blocker: user.id,
      blocked: current.id,
    });

    if (error) {
      alert(error.message);
      return;
    }

    skip();
  }

  async function report() {
    if (!current) return;

    const user = (await supabase.auth.getUser()).data.user;
    if (!user) return alert("Et ole kirjautunut");

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
      {/* Top bar */}
      <header className="max-w-xl mx-auto px-6 pt-6 flex items-center justify-between">
        <h1 className="text-xl font-bold tracking-wide">NITE</h1>
        <div className="flex gap-2">
          <a
            className="px-3 py-2 rounded-xl bg-zinc-900 border border-zinc-700 text-sm"
            href="/profile"
          >
            Profiili
          </a>
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

      {/* Content */}
      <section className="max-w-xl mx-auto px-6 py-8">
        {!current ? (
          <div className="rounded-2xl border border-zinc-800 bg-zinc-950 p-8 text-center">
            <p className="text-lg font-semibold">Ei enempää profiileja nyt.</p>
            <p className="text-zinc-400 mt-2">Päivitä myöhemmin.</p>
            <button
              className="mt-6 w-full p-3 rounded-xl bg-white text-black font-semibold"
              onClick={loadCandidates}
            >
              Lataa lisää
            </button>
          </div>
        ) : (
          <div className="rounded-2xl border border-zinc-800 bg-zinc-950 overflow-hidden">
            {/* Photo */}
            <div className="h-96 bg-zinc-900 relative">
              {current.photoUrl ? (
                <img
                  src={current.photoUrl}
                  alt=""
                  className="w-full h-full object-cover"
                />
              ) : (
                <div className="w-full h-full flex items-center justify-center text-zinc-400">
                  Ei kuvaa
                </div>
              )}

              {/* Gradient + main info */}
              <div className="absolute inset-x-0 bottom-0 p-5 bg-gradient-to-t from-black/85 to-transparent">
                <div className="flex items-end justify-between gap-4">
                  <div>
                    <h2 className="text-2xl font-bold leading-tight">
                      {current.display_name}
                    </h2>
                    <p className="text-zinc-200 mt-1">
                      {current.role} · {current.looking}
                    </p>
                  </div>

                  <div className="text-right text-zinc-300 text-sm">
                    {current.show_city && current.city ? current.city : ""}
                  </div>
                </div>

                {current.bio ? (
                  <p className="text-zinc-200/90 text-sm mt-3 line-clamp-3">
                    {current.bio}
                  </p>
                ) : (
                  <p className="text-zinc-400 text-sm mt-3">
                    Ei bioa.
                  </p>
                )}
              </div>
            </div>

            {/* Buttons */}
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

      {/* MATCH OVERLAY */}
      {matchOverlay && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-6">
          <div className="w-full max-w-sm rounded-2xl border border-zinc-800 bg-zinc-950 overflow-hidden">
            <div className="h-56 bg-zinc-900">
              {matchOverlay.photoUrl ? (
                <img
                  src={matchOverlay.photoUrl}
                  alt=""
                  className="w-full h-full object-cover"
                />
              ) : (
                <div className="w-full h-full flex items-center justify-center text-zinc-400">
                  Match!
                </div>
              )}
            </div>

            <div className="p-6 text-center">
              <p className="text-zinc-400 text-sm">It’s a match</p>
              <p className="text-2xl font-bold mt-1">{matchOverlay.name}</p>

              <div className="mt-5 grid grid-cols-2 gap-3">
                <button
                  className="p-3 rounded-xl bg-zinc-900 border border-zinc-700"
                  onClick={() => setMatchOverlay(null)}
                >
                  Sulje
                </button>
                <a
                  className="p-3 rounded-xl bg-white text-black font-semibold text-center"
                  href={`/chat/${matchOverlay.matchId}`}
                  onClick={() => setMatchOverlay(null)}
                >
                  Avaa chatti
                </a>
              </div>
            </div>
          </div>
        </div>
      )}
    </main>
  );
}
