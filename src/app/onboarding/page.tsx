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

  useEffect(() => {
    (async () => {
      const user = (await supabase.auth.getUser()).data.user;
      if (!user) window.location.href = "/login";
    })();
  }, []);

  function isAdult(dateStr: string) {
    const d = new Date(dateStr);
    const now = new Date();
    const adult = new Date(now.getFullYear() - 18, now.getMonth(), now.getDate());
    return d <= adult;
  }

  async function save() {
    const user = (await supabase.auth.getUser()).data.user;
    if (!user) return alert("Et ole kirjautunut.");

    if (!name || name.length < 2) return alert("Nimi liian lyhyt.");
    if (!birthdate) return alert("Syntymäaika puuttuu.");
    if (!isAdult(birthdate)) return alert("18+ only.");
    if (showCity && !city.trim()) return alert("Kirjoita kaupunki tai ota asetus pois.");

    const { error } = await supabase.from("profiles").upsert({
      id: user.id,
      display_name: name,
      birthdate,
      role,
      looking,
      show_city: showCity,
      city: showCity ? city.trim() : null,
      is_active: true,
    });

    if (error) alert(error.message);
    else window.location.href = "/browse";
  }

  return (
    <main className="min-h-screen bg-black text-white flex items-center justify-center">
      <div className="w-full max-w-md space-y-4 p-6">
        <h1 className="text-2xl font-bold">Profiili</h1>
        <p className="text-zinc-400">Nopea. Ytimekäs. 18+.</p>

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
            className="h-4 w-4"
          />
          Näytä kaupunki
        </label>

        {showCity && (
          <input
            className="w-full p-3 rounded-xl bg-zinc-900 border border-zinc-700"
            placeholder="Kaupunki (esim. Kotka)"
            value={city}
            onChange={(e) => setCity(e.target.value)}
          />
        )}

        <button
          onClick={save}
          className="w-full p-3 rounded-xl bg-white text-black font-semibold"
        >
          Valmis
        </button>
      </div>
    </main>
  );
}
