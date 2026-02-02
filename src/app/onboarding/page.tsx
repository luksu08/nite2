"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabaseClient";

type Role = "top" | "bottom" | "vers" | "side" | "none";
type Looking = "hookup" | "fwb" | "date" | "chat" | "open";

export default function OnboardingPage() {
  const [name, setName] = useState("");
  const [birthdate, setBirthdate] = useState("");
  const [role, setRole] = useState<Role>("none");
  const [looking, setLooking] = useState<Looking>("hookup");
  const [showCity, setShowCity] = useState(false);
  const [city, setCity] = useState("");
  const [msg, setMsg] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    (async () => {
      const user = (await supabase.auth.getUser()).data.user;
      if (!user) window.location.href = "/login";

      // jos profiili on jo olemassa, täytetään kentät valmiiksi
      const { data } = await supabase
        .from("profiles")
        .select("display_name, birthdate, role, looking, show_city, city")
        .eq("id", user!.id)
        .maybeSingle();

      if (data) {
        setName(data.display_name ?? "");
        setBirthdate(data.birthdate ?? "");
        setRole((data.role ?? "none") as Role);
        setLooking((data.looking ?? "hookup") as Looking);
        setShowCity(!!data.show_city);
        setCity(data.city ?? "");
      }
    })();
  }, []);

  function calcAge(dateStr: string) {
    const d = new Date(dateStr);
    if (Number.isNaN(d.getTime())) return null;
    const now = new Date();
    let a = now.getFullYear() - d.getFullYear();
    const m = now.getMonth() - d.getMonth();
    if (m < 0 || (m === 0 && now.getDate() < d.getDate())) a--;
    return a;
  }

  async function save() {
    setMsg("");
    setBusy(true);

    const user = (await supabase.auth.getUser()).data.user;
    if (!user) return;

    const n = name.trim();
    if (n.length < 2 || n.length > 24) {
      setBusy(false);
      return setMsg("Nimi pitää olla 2–24 merkkiä.");
    }

    if (!birthdate) {
      setBusy(false);
      return setMsg("Syntymäaika puuttuu.");
    }

    const a = calcAge(birthdate);
    if (a !== null && a < 18) {
      setBusy(false);
      return setMsg("18+ only.");
    }

    const c = showCity ? city.trim() : "";
    if (showCity && c.length === 0) {
      setBusy(false);
      return setMsg("Kaupunki puuttuu (tai ota asetus pois).");
    }

    const { error } = await supabase.from("profiles").upsert({
      id: user.id,
      display_name: n,
      birthdate, // TÄRKEÄ: tallennetaan aina
      role,
      looking,
      show_city: showCity,
      city: showCity ? c : null,
      is_active: true,
    });

    setBusy(false);

    if (error) setMsg(error.message);
    else window.location.href = "/browse";
  }

  return (
    <main className="min-h-screen bg-black text-white flex items-center justify-center">
      <div className="w-full max-w-md space-y-4 p-6">
        <h1 className="text-2xl font-bold">Luo profiili</h1>

        <input
          className="w-full p-3 rounded-xl bg-zinc-900 border border-zinc-700"
          placeholder="nimi"
          value={name}
          onChange={(e) => setName(e.target.value)}
        />

        <input
          type="date"
          className="w-full p-3 rounded-xl bg-zinc-900 border border-zinc-700"
          value={birthdate}
          onChange={(e) => setBirthdate(e.target.value)}
        />

        <div className="grid grid-cols-2 gap-3">
          <select
            className="w-full p-3 rounded-xl bg-zinc-900 border border-zinc-700"
            value={role}
            onChange={(e) => setRole(e.target.value as Role)}
          >
            <option value="none">ei kerro</option>
            <option value="top">top</option>
            <option value="bottom">bottom</option>
            <option value="vers">vers</option>
            <option value="side">side</option>
          </select>

          <select
            className="w-full p-3 rounded-xl bg-zinc-900 border border-zinc-700"
            value={looking}
            onChange={(e) => setLooking(e.target.value as Looking)}
          >
            <option value="hookup">pano</option>
            <option value="fwb">FWB</option>
            <option value="date">deitti</option>
            <option value="chat">chatti</option>
            <option value="open">avoin</option>
          </select>
        </div>

        <label className="flex items-center gap-3 text-zinc-200">
          <input
            type="checkbox"
            checked={showCity}
            onChange={(e) => setShowCity(e.target.checked)}
          />
          Näytä kaupunki
        </label>

        {showCity && (
          <input
            className="w-full p-3 rounded-xl bg-zinc-900 border border-zinc-700"
            placeholder="Kaupunki"
            value={city}
            onChange={(e) => setCity(e.target.value)}
          />
        )}

        <button
          onClick={save}
          disabled={busy}
          className="w-full p-3 rounded-xl bg-white text-black font-semibold disabled:opacity-60"
        >
          Jatka
        </button>

        {msg && <p className="text-zinc-400 text-sm">{msg}</p>}
      </div>
    </main>
  );
}
