"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabaseClient";

type MatchRow = {
  id: string;
  user_a: string;
  user_b: string;
  created_at: string;
};

type ProfileMini = {
  id: string;
  display_name: string;
  role: string;
  looking: string;
  show_city: boolean;
  city: string | null;
};

export default function MatchesPage() {
  const [me, setMe] = useState<string | null>(null);
  const [items, setItems] = useState<
    { match: MatchRow; other: ProfileMini | null }[]
  >([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      const user = (await supabase.auth.getUser()).data.user;
      if (!user) {
        window.location.href = "/login";
        return;
      }
      setMe(user.id);

      const { data: matches, error } = await supabase
        .from("matches")
        .select("id, user_a, user_b, created_at")
        .or(`user_a.eq.${user.id},user_b.eq.${user.id}`)
        .order("created_at", { ascending: false });

      if (error) {
        alert(error.message);
        setLoading(false);
        return;
      }

      const rows = (matches ?? []) as MatchRow[];

      // Collect other user ids
      const otherIds = rows
        .map((m) => (m.user_a === user.id ? m.user_b : m.user_a))
        .filter(Boolean);

      // Fetch profiles for all others in one query
      const { data: profs, error: pErr } = await supabase
        .from("profiles")
        .select("id, display_name, role, looking, show_city, city")
        .in("id", otherIds);

      if (pErr) {
        alert(pErr.message);
        setLoading(false);
        return;
      }

      const map = new Map<string, ProfileMini>();
      (profs ?? []).forEach((p: any) => map.set(p.id, p as ProfileMini));

      setItems(
        rows.map((m) => {
          const otherId = m.user_a === user.id ? m.user_b : m.user_a;
          return { match: m, other: map.get(otherId) ?? null };
        })
      );

      setLoading(false);
    })();
  }, []);

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
        <h1 className="text-xl font-bold">Matchit</h1>
        <a
          className="px-3 py-2 rounded-xl bg-zinc-900 border border-zinc-700 text-sm"
          href="/browse"
        >
          Takas
        </a>
      </header>

      <section className="max-w-xl mx-auto px-6 py-8 space-y-3">
        {items.length === 0 ? (
          <div className="rounded-2xl border border-zinc-800 bg-zinc-950 p-6">
            <p className="font-semibold">Ei matcheja vielä.</p>
            <p className="text-zinc-400 mt-1">Likea enemmän.</p>
          </div>
        ) : (
          items.map(({ match, other }) => (
            <a
              key={match.id}
              href={`/chat/${match.id}`}
              className="block rounded-2xl border border-zinc-800 bg-zinc-950 p-5 hover:bg-zinc-900 transition"
            >
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-zinc-400 text-sm">Match</p>
                  <p className="mt-1 text-lg font-semibold">
                    {other ? other.display_name : "Tuntematon"}
                  </p>
                  {other && (
                    <p className="text-zinc-400 text-sm mt-1">
                      {other.role} · {other.looking}
                      {other.show_city && other.city ? ` · ${other.city}` : ""}
                    </p>
                  )}
                </div>
                <span className="text-zinc-500 text-xs">
                  {new Date(match.created_at).toLocaleString()}
                </span>
              </div>
              <p className="text-zinc-500 text-xs mt-3">Avaa chatti →</p>
            </a>
          ))
        )}
      </section>
    </main>
  );
}
