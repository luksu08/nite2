"use client";

import { useEffect, useState } from "react";
import { usePathname } from "next/navigation";
import { supabase } from "@/lib/supabaseClient";

type Msg = {
  id: string;
  match_id: string;
  sender: string;
  body: string;
  created_at: string;
};

export default function ChatPage() {
  const pathname = usePathname(); // e.g. /chat/<matchId>
  const matchId = pathname?.split("/chat/")[1] ?? "";

  const [me, setMe] = useState<string | null>(null);
  const [msgs, setMsgs] = useState<Msg[]>([]);
  const [text, setText] = useState("");
  const [loading, setLoading] = useState(true);

  // Guard
  if (!matchId) {
    return (
      <main className="min-h-screen bg-black text-white flex items-center justify-center">
        <p>Ladataan chattia…</p>
      </main>
    );
  }

  useEffect(() => {
    let cancelled = false;

    (async () => {
      const user = (await supabase.auth.getUser()).data.user;
      if (!user) {
        window.location.href = "/login";
        return;
      }
      if (cancelled) return;

      setMe(user.id);

      const { data, error } = await supabase
        .from("messages")
        .select("id, match_id, sender, body, created_at")
        .eq("match_id", matchId)
        .order("created_at", { ascending: true });

      if (error) alert(error.message);

      if (!cancelled) {
        setMsgs((data ?? []) as Msg[]);
        setLoading(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [matchId]);

  async function reload() {
    const { data, error } = await supabase
      .from("messages")
      .select("id, match_id, sender, body, created_at")
      .eq("match_id", matchId)
      .order("created_at", { ascending: true });

    if (error) {
      alert(error.message);
      return;
    }
    setMsgs((data ?? []) as Msg[]);
  }

  async function send() {
    const user = (await supabase.auth.getUser()).data.user;
    if (!user) return;

    const body = text.trim();
    if (!body) return;

    const { error } = await supabase.from("messages").insert({
      match_id: matchId,
      sender: user.id,
      body,
    });

    if (error) {
      alert(error.message);
      return;
    }

    setText("");
    await reload();
  }

  if (loading) {
    return (
      <main className="min-h-screen bg-black text-white flex items-center justify-center">
        <p>Ladataan…</p>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-black text-white flex flex-col">
      <header className="max-w-xl w-full mx-auto px-6 pt-6 flex items-center justify-between">
        <a
          className="px-3 py-2 rounded-xl bg-zinc-900 border border-zinc-700 text-sm"
          href="/matches"
        >
          Takas
        </a>
        <h1 className="text-sm text-zinc-400">Chatti</h1>
        <button
          onClick={reload}
          className="px-3 py-2 rounded-xl bg-zinc-900 border border-zinc-700 text-sm"
        >
          Päivitä
        </button>
      </header>

      <section className="max-w-xl w-full mx-auto px-6 py-6 flex-1 space-y-2 overflow-auto">
        {msgs.length === 0 ? (
          <div className="text-zinc-400 text-sm">Ei viestejä vielä.</div>
        ) : (
          msgs.map((m) => {
            const mine = me === m.sender;
            return (
              <div
                key={m.id}
                className={`max-w-[80%] p-3 rounded-2xl border ${
                  mine
                    ? "ml-auto bg-white text-black border-white"
                    : "mr-auto bg-zinc-900 text-white border-zinc-700"
                }`}
              >
                <p className="text-sm">{m.body}</p>
                <p
                  className={`text-[10px] mt-1 ${
                    mine ? "text-black/60" : "text-white/50"
                  }`}
                >
                  {new Date(m.created_at).toLocaleTimeString()}
                </p>
              </div>
            );
          })
        )}
      </section>

      <footer className="max-w-xl w-full mx-auto px-6 pb-6">
        <div className="flex gap-2">
          <input
            className="flex-1 p-3 rounded-xl bg-zinc-900 border border-zinc-700"
            placeholder="kirjoita…"
            value={text}
            onChange={(e) => setText(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") send();
            }}
          />
          <button
            onClick={send}
            className="px-5 rounded-xl bg-white text-black font-semibold"
          >
            Send
          </button>
        </div>
      </footer>
    </main>
  );
}
