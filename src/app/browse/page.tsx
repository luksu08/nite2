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

const SEEN_KEY = (uid: string) => `getnite_seen_${uid}`;

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
      if (!user) return (window.location.href = "/login");
      setMe(user.id);

      const prof = await supabase
        .from("profiles")
        .select("id")
        .eq("id", user.id)
        .maybeSingle();

      if (!prof.data) return (window.location.href = "/onboarding");

      await loadCandidates(false);
      setLoading(false);
    })();
  }, []);

  function getSeen(uid: string): Set<string> {
    try {
      const raw = localStorage.getItem(SEEN_KEY(uid));
      const arr = raw ? (JSON.parse(raw) as string[]) : [];
      return new Set(arr);
    } catch {
      return new Set();
    }
  }

  function setSeen(uid: string, s: Set<string>) {
    try {
      localStorage.setItem(SEEN_KEY(uid), JSON.stringify(Array.from(s)));
    } catch {}
  }

  async function signedUrl(path: string) {
    const { data, error } = await supabase.storage
      .from("photos")
      .createSignedUrl(path, 60 * 10);
    if (error) return null;
    return data.signedUrl;
  }

  async function loadCandidates(allowRepeatsIfEmpty: boolean) {
    const user = (await supabase.auth.getUser()).data.user;
    if (!user) return;

    // 1) hae matchatut
    const { data: matches, error: mErr } = await supabase
      .from("matches")
      .select("id, user_a, user_b, created_at")
      .or(`user_a.eq.${user.id},user_b.eq.${user.id}`);

    if (mErr) {
      alert(mErr.message);
      return;
    }

    const matchedIds = new Set<string>();
    (matches ?? []).forEach((m: any) => {
      const other = m.user_a === user.id ? m.user_b : m.user_a;
      matchedIds.add(other);
    });

    // 2) hae jo liketetyt (ettei tule uudestaan)
    const { data: myLikes, error: lErr } = await supabase
      .from("likes")
      .select("to_user")
      .eq("from_user", user.id);

    if (lErr) {
      alert(lErr.message);
      return;
    }

    const likedIds = new Set<string>((myLikes ?? []).map((r: any) => r.to_user));

    // 3) hae blokit (molempiin suuntiin)
    const { data: blocks, error: bErr } = await supabase
      .from("blocks")
      .select("blocker, blocked")
      .or(`blocker.eq.${user.id},blocked.eq.${user.id}`);

    if (bErr) {
      alert(bErr.message);
      return;
    }

    const blockedIds = new Set<string>();
    (blocks ?? []).forEach((r: any) => {
      if (r.blocker === user.id) blockedIds.add(r.blocked);
      if (r.blocked === user.id) blockedIds.add(r.blocker);
    });

    // 4) seen list (local)
    const seen = getSeen(user.id);

    // 5) hae profiilit
    const { data: profs, error: pErr } = await supabase
      .from("profiles")
      .select("id, display_name, role, looking, bio, show_city, city, is_active")
      .eq("is_active", true)
      .neq("id", user.id)
      .limit(120);

    if (pErr) {
      alert(pErr.message);
      return;
    }

    const baseAll = (profs ?? []).map((p: any) => ({
      id: p.id,
      display_name: p.display_name ?? "",
      role: p.role ?? "none",
      looking: p.looking ?? "open",
      bio: p.bio ?? "",
      show_city: !!p.show_city,
      city: p.city ?? null,
    })) as Candidate[];

    // 6) suodatus: ei omaa, ei match, ei liked, ei blocked, ei seen
    const filtered = baseAll.filter((p) => {
      if (p.id === user.id) return false;
      if (matchedIds.has(p.id)) return false;
      if (likedIds.has(p.id)) return false;
      if (blockedIds.has(p.id)) return false;
      if (!allowRepeatsIfEmpty && seen.has(p.id)) return false;
      return true;
    });

    // jos tyhjä ja ei sallittu repeat → sallitaan repeat (mut silti ei match/liked/blocked)
    const finalList =
      filtered.length > 0
        ? filtered
        : baseAll.filter((p) => {
            if (p.id === user.id) return false;
            if (matchedIds.has(p.id)) return false;
            if (likedIds.has(p.id)) return false;
            if (blockedIds.has(p.id)) return false;
            return true;
          });

    if (finalList.length === 0) {
      setCands([]);
      return;
    }

    // 7) hae primary-kuvat ja signed urlit
    const ids = finalList.map((p) => p.id);
    const { data: photos } = await supabase
      .from("photos")
      .select("user_id, path")
      .in("user_id", ids)
      .eq("is_primary", true);

    const photoMap = new Map<string, string>();
    (photos ?? []).forEach((r: any) => photoMap.set(r.user_id, r.path));

    const enriched = await Promise.all(
      finalList.map(async (p) => {
        const path = photoMap.get(p.id);
        const url = path ? await signedUrl(path) : null;
        return { ...p, photoUrl: url };
      })
    );

    setCands(enriched.sort(() => Math.random() - 0.5));
  }

  function markSeen(id: string) {
    if (!me) return;
    const s = getSeen(me);
    s.add(id);
    setSeen(me, s);
  }

  function skip() {
    if (current) markSeen(current.id);
    setCands((prev) => prev.slice(1));
  }

  async function like() {
    if (!current) return;

    const user = (await supabase.auth.getUser()).data.user;
    if (!user) return alert("Et ole kirjautunut");

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

    // tarkista match (fallback: OR query, ei vaadi user_low/user_high)
    const { data: match } = await supabase
      .from("matches")
      .select("id, user_a, user_b, created_at")
      .or(
        `and(user_a.eq.${user.id},user_b.eq.${current.id}),and(user_a.eq.${current.id},user_b.eq.${user.id})`
      )
      .maybeSingle();

    if (match?.id) {
      setMatchOverlay({
        matchId: match.id,
        name: current.display_name,
        photoUrl: current.photoUrl ?? null,
      });
    }

    markSeen(current.id);
    setCands((prev) => prev.slice(1));
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
      <header className="max-w-xl mx-auto px-6 pt-6 flex items-center justify-between">
        <h1 className="text-xl font-bold tracking-wide">NITE</h1>
        <div className="flex gap-2">
          <a className="px-3 py-2 rounded-xl bg-zinc-900 border border-zinc-700 text-sm" href="/profile">
            Profiili
          </a>
          <a className="px-3 py-2 rounded-xl bg-zinc-900 border border-zinc-700 text-sm" href="/matches">
            Matchit
          </a>
          <button className="px-3 py-2 rounded-xl bg-zinc-900 border border-zinc-700 text-sm" onClick={logout}>
            Kirjaudu ulos
          </button>
        </div>
      </header>

      <section className="max-w-xl mx-auto px-6 py-8">
        {!current ? (
          <div className="rounded-2xl border border-zinc-800 bg-zinc-950 p-8 text-center">
            <p className="text-lg font-semibold">Ei enempää profiileja nyt.</p>
            <p className="text-zinc-400 mt-2">
              Voit ladata lisää. Jos näit jo kaikki, se alkaa lopulta näyttää samoja (mut ei matchattuja / liketettyjä).
            </p>
            <div className="mt-6 grid grid-cols-2 gap-3">
              <button
                className="w-full p-3 rounded-xl bg-zinc-900 border border-zinc-700"
                onClick={() => loadCandidates(false)}
              >
                Lataa uudet
              </button>
              <button
                className="w-full p-3 rounded-xl bg-white text-black font-semibold"
                onClick={() => loadCandidates(true)}
              >
                Salli toistot
              </button>
            </div>
          </div>
        ) : (
          <div className="rounded-2xl border border-zinc-800 bg-zinc-950 overflow-hidden">
            <div className="h-96 bg-zinc-900 relative">
              {current.photoUrl ? (
                <img src={current.photoUrl} alt="" className="w-full h-full object-cover" />
              ) : (
                <div className="w-full h-full flex items-center justify-center text-zinc-400">Ei kuvaa</div>
              )}

              <div className="absolute inset-x-0 bottom-0 p-5 bg-gradient-to-t from-black/85 to-transparent">
                <div className="flex items-end justify-between gap-4">
                  <div>
                    <h2 className="text-2xl font-bold leading-tight">{current.display_name}</h2>
                    <p className="text-zinc-200 mt-1">
                      {current.role} · {current.looking}
                    </p>
                  </div>
                  <div className="text-right text-zinc-300 text-sm">
                    {current.show_city && current.city ? current.city : ""}
                  </div>
                </div>

                {current.bio ? (
                  <p className="text-zinc-200/90 text-sm mt-3 line-clamp-3">{current.bio}</p>
                ) : (
                  <p className="text-zinc-400 text-sm mt-3">Ei bioa.</p>
                )}
              </div>
            </div>

            <div className="p-5 grid grid-cols-2 gap-3">
              <button className="p-3 rounded-xl bg-zinc-900 border border-zinc-700" onClick={skip}>
                Skip
              </button>
              <button className="p-3 rounded-xl bg-white text-black font-semibold" onClick={like}>
                Like
              </button>
              <button className="p-3 rounded-xl bg-zinc-900 border border-zinc-700 text-zinc-300" onClick={block}>
                Block
              </button>
              <button className="p-3 rounded-xl bg-zinc-900 border border-zinc-700 text-zinc-300" onClick={report}>
                Report
              </button>
            </div>
          </div>
        )}
      </section>

      {matchOverlay && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-6">
          <div className="w-full max-w-sm rounded-2xl border border-zinc-800 bg-zinc-950 overflow-hidden">
            <div className="h-56 bg-zinc-900">
              {matchOverlay.photoUrl ? (
                <img src={matchOverlay.photoUrl} alt="" className="w-full h-full object-cover" />
              ) : (
                <div className="w-full h-full flex items-center justify-center text-zinc-400">Match!</div>
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
