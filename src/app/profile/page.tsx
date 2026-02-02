"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabaseClient";

export default function ProfilePage() {
  const [userId, setUserId] = useState<string | null>(null);
  const [photoUrl, setPhotoUrl] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const [msg, setMsg] = useState<string>("");

  useEffect(() => {
    (async () => {
      const user = (await supabase.auth.getUser()).data.user;
      if (!user) {
        window.location.href = "/login";
        return;
      }
      setUserId(user.id);
      await loadMyPhoto(user.id);
    })();
  }, []);

  async function loadMyPhoto(uid: string) {
    setMsg("");
    const { data, error } = await supabase
      .from("photos")
      .select("path")
      .eq("user_id", uid)
      .order("is_primary", { ascending: false })
      .order("created_at", { ascending: true })
      .limit(1);

    if (error) {
      setMsg(error.message);
      return;
    }

    const path = data?.[0]?.path as string | undefined;
    if (!path) {
      setPhotoUrl(null);
      return;
    }

    const { data: signed, error: sErr } = await supabase.storage
      .from("photos")
      .createSignedUrl(path, 60 * 10);

    if (sErr) {
      setMsg(sErr.message);
      return;
    }

    setPhotoUrl(signed.signedUrl);
  }

  async function upload(file: File) {
    if (!userId) return;
    setUploading(true);
    setMsg("");

    const ext = (file.name.split(".").pop() || "jpg").toLowerCase();
    const safeExt = ["jpg", "jpeg", "png", "webp"].includes(ext) ? ext : "jpg";
    const filename = `${crypto.randomUUID()}.${safeExt}`;
    const path = `${userId}/${filename}`;

    // Upload storageen
    const { error: upErr } = await supabase.storage
      .from("photos")
      .upload(path, file, { upsert: false });

    if (upErr) {
      setUploading(false);
      setMsg(upErr.message);
      return;
    }

    // Merkitään kaikki omat kuvat ei-primaryksi (että tulee vain 1 primary)
    await supabase.from("photos").update({ is_primary: false }).eq("user_id", userId);

    // Lisätään uusi primary-kuva
    const { error: dbErr } = await supabase.from("photos").insert({
      user_id: userId,
      path,
      is_primary: true,
    });

    if (dbErr) {
      setUploading(false);
      setMsg(dbErr.message);
      return;
    }

    await loadMyPhoto(userId);
    setUploading(false);
    setMsg("Kuva päivitetty.");
  }

  return (
    <main className="min-h-screen bg-black text-white">
      <header className="max-w-xl mx-auto px-6 pt-6 flex items-center justify-between">
        <h1 className="text-xl font-bold">Profiili</h1>
        <a className="px-3 py-2 rounded-xl bg-zinc-900 border border-zinc-700 text-sm" href="/browse">
          Takas
        </a>
      </header>

      <section className="max-w-xl mx-auto px-6 py-8 space-y-4">
        <div className="rounded-2xl border border-zinc-800 bg-zinc-950 overflow-hidden">
          <div className="h-96 bg-zinc-900 flex items-center justify-center">
            {photoUrl ? (
              <img src={photoUrl} alt="Profiilikuva" className="w-full h-full object-cover" />
            ) : (
              <p className="text-zinc-400">Ei profiilikuvaa vielä</p>
            )}
          </div>

          <div className="p-6 space-y-3">
            <p className="text-zinc-300">Lisää / vaihda profiilikuva</p>
            <input
              type="file"
              accept="image/*"
              disabled={uploading}
              onChange={(e) => {
                const f = e.target.files?.[0];
                if (f) upload(f);
              }}
            />
            {msg && <p className="text-zinc-400 text-sm">{msg}</p>}
            <p className="text-zinc-500 text-xs">
              Huom: kuva tallennetaan private-bucketiin ja näytetään signed-linkillä.
            </p>
          </div>
        </div>
      </section>
    </main>
  );
}
