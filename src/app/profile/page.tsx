"use client";

import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/lib/supabaseClient";

type Role = "top" | "bottom" | "vers" | "side" | "none";
type Looking = "hookup" | "fwb" | "date" | "chat" | "open";
type Gender =
  | "male"
  | "female"
  | "nonbinary"
  | "trans_man"
  | "trans_woman"
  | "other"
  | "prefer_not_say";

export default function ProfilePage() {
  const [userId, setUserId] = useState<string | null>(null);

  // core
  const [displayName, setDisplayName] = useState("");
  const [birthdate, setBirthdate] = useState(""); // pidetään syntymäaika, ikä lasketaan tästä
  const [showAge, setShowAge] = useState(true);

  const [bio, setBio] = useState("");
  const [role, setRole] = useState<Role>("none");
  const [looking, setLooking] = useState<Looking>("open");

  // extras
  const [heightCm, setHeightCm] = useState<string>(""); // string -> int save-vaiheessa
  const [weightKg, setWeightKg] = useState<string>("");
  const [gender, setGender] = useState<Gender>("prefer_not_say");
  const [pronouns, setPronouns] = useState("");

  const [showCity, setShowCity] = useState(false);
  const [city, setCity] = useState("");

  // photo
  const [photoUrl, setPhotoUrl] = useState<string | null>(null);

  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string>("");

  const age = useMemo(() => {
    if (!birthdate) return null;
    const b = new Date(birthdate);
    if (Number.isNaN(b.getTime())) return null;

    const now = new Date();
    let a = now.getFullYear() - b.getFullYear();
    const m = now.getMonth() - b.getMonth();
    if (m < 0 || (m === 0 && now.getDate() < b.getDate())) a--;
    return a;
  }, [birthdate]);

  useEffect(() => {
    (async () => {
      const user = (await supabase.auth.getUser()).data.user;
      if (!user) return (window.location.href = "/login");
      setUserId(user.id);

      await loadProfile(user.id);
      await loadMyPhoto(user.id);
    })();
  }, []);

  async function loadProfile(uid: string) {
    setMsg("");
    const { data, error } = await supabase
      .from("profiles")
      .select(
        "display_name, birthdate, bio, role, looking, show_city, city, height_cm, weight_kg, gender, pronouns, show_age"
      )
      .eq("id", uid)
      .maybeSingle();

    if (error) return setMsg(error.message);
    if (!data) return;

    setDisplayName(data.display_name ?? "");
    setBirthdate(data.birthdate ?? "");
    setBio(data.bio ?? "");
    setRole((data.role ?? "none") as Role);
    setLooking((data.looking ?? "open") as Looking);

    setShowCity(!!data.show_city);
    setCity(data.city ?? "");

    setHeightCm(data.height_cm ? String(data.height_cm) : "");
    setWeightKg(data.weight_kg ? String(data.weight_kg) : "");
    setGender((data.gender ?? "prefer_not_say") as Gender);
    setPronouns(data.pronouns ?? "");
    setShowAge(data.show_age ?? true);
  }

  async function loadMyPhoto(uid: string) {
    const { data } = await supabase
      .from("photos")
      .select("path")
      .eq("user_id", uid)
      .order("is_primary", { ascending: false })
      .order("created_at", { ascending: true })
      .limit(1);

    const path = data?.[0]?.path as string | undefined;
    if (!path) return setPhotoUrl(null);

    const { data: signed } = await supabase.storage
      .from("photos")
      .createSignedUrl(path, 60 * 10);

    setPhotoUrl(signed?.signedUrl ?? null);
  }

  async function upload(file: File) {
    if (!userId) return;
    setBusy(true);
    setMsg("");

    const ext = (file.name.split(".").pop() || "jpg").toLowerCase();
    const safeExt = ["jpg", "jpeg", "png", "webp"].includes(ext) ? ext : "jpg";
    const filename = `${crypto.randomUUID()}.${safeExt}`;
    const path = `${userId}/${filename}`;

    const { error: upErr } = await supabase.storage
      .from("photos")
      .upload(path, file, { upsert: false });

    if (upErr) {
      setBusy(false);
      return setMsg(upErr.message);
    }

    await supabase.from("photos").update({ is_primary: false }).eq("user_id", userId);

    const { error: dbErr } = await supabase.from("photos").insert({
      user_id: userId,
      path,
      is_primary: true,
    });

    setBusy(false);

    if (dbErr) return setMsg(dbErr.message);

    await loadMyPhoto(userId);
    setMsg("Kuva päivitetty.");
  }

  async function save() {
    if (!userId) return;
    setBusy(true);
    setMsg("");

    const name = displayName.trim();
    if (name.length < 2 || name.length > 24) {
      setBusy(false);
      return setMsg("Nimi pitää olla 2–24 merkkiä.");
    }

    if (!birthdate) {
      setBusy(false);
      return setMsg("Syntymäaika puuttuu.");
    }

    if (age !== null && age < 18) {
      setBusy(false);
      return setMsg("18+ only.");
    }

    const cleanBio = bio.slice(0, 280);

    const cleanCity = showCity ? city.trim() : "";
    if (showCity && cleanCity.length === 0) {
      setBusy(false);
      return setMsg("Kaupunki puuttuu (tai ota 'Näytä kaupunki' pois).");
    }

    const h = heightCm.trim() ? Number(heightCm) : null;
    const w = weightKg.trim() ? Number(weightKg) : null;

    if (h !== null && (!Number.isFinite(h) || h < 120 || h > 230)) {
      setBusy(false);
      return setMsg("Pituus pitää olla 120–230 cm (tai tyhjä).");
    }
    if (w !== null && (!Number.isFinite(w) || w < 35 || w > 250)) {
      setBusy(false);
      return setMsg("Paino pitää olla 35–250 kg (tai tyhjä).");
    }

    const pro = pronouns.trim();
    if (pro.length > 24) {
      setBusy(false);
      return setMsg("Pronominit max 24 merkkiä.");
    }

    const { error } = await supabase
      .from("profiles")
      .update({
        display_name: name,
        birthdate,
        show_age: showAge,
        bio: cleanBio,
        role,
        looking,
        show_city: showCity,
        city: showCity ? cleanCity : null,
        height_cm: h,
        weight_kg: w,
        gender,
        pronouns: pro.length ? pro : null,
      })
      .eq("id", userId);

    setBusy(false);

    if (error) setMsg(error.message);
    else setMsg("Tallennettu.");
    await loadProfile(userId);

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
        {/* PHOTO */}
        <div className="rounded-2xl border border-zinc-800 bg-zinc-950 overflow-hidden">
          <div className="h-80 bg-zinc-900 flex items-center justify-center">
            {photoUrl ? (
              <img src={photoUrl} alt="Profiilikuva" className="w-full h-full object-cover" />
            ) : (
              <p className="text-zinc-400">Ei profiilikuvaa</p>
            )}
          </div>
          <div className="p-6 space-y-3">
            <p className="text-zinc-300 font-semibold">Vaihda kuva</p>
            <input
              type="file"
              accept="image/*"
              disabled={busy}
              onChange={(e) => {
                const f = e.target.files?.[0];
                if (f) upload(f);
              }}
            />
          </div>
        </div>

        {/* EDIT */}
        <div className="rounded-2xl border border-zinc-800 bg-zinc-950 p-6 space-y-4">
          <p className="text-zinc-300 font-semibold">Muokkaa tietoja</p>

          <div className="space-y-2">
            <label className="text-zinc-400 text-sm">Nimi</label>
            <input
              className="w-full p-3 rounded-xl bg-zinc-900 border border-zinc-700"
              value={displayName}
              onChange={(e) => setDisplayName(e.target.value)}
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-2">
              <label className="text-zinc-400 text-sm">Syntymäaika</label>
              <input
                type="date"
                className="w-full p-3 rounded-xl bg-zinc-900 border border-zinc-700"
                value={birthdate}
                onChange={(e) => setBirthdate(e.target.value)}
              />
              <p className="text-zinc-500 text-xs">
                Ikä: {age === null ? "—" : `${age}`} {showAge ? "(näkyy)" : "(piilossa)"}
              </p>
            </div>

            <div className="space-y-2">
              <label className="text-zinc-400 text-sm">Näytä ikä</label>
              <select
                className="w-full p-3 rounded-xl bg-zinc-900 border border-zinc-700"
                value={showAge ? "yes" : "no"}
                onChange={(e) => setShowAge(e.target.value === "yes")}
              >
                <option value="yes">Kyllä</option>
                <option value="no">Ei</option>
              </select>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-2">
              <label className="text-zinc-400 text-sm">Rooli</label>
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
            </div>

            <div className="space-y-2">
              <label className="text-zinc-400 text-sm">Haen</label>
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
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-2">
              <label className="text-zinc-400 text-sm">Pituus (cm)</label>
              <input
                className="w-full p-3 rounded-xl bg-zinc-900 border border-zinc-700"
                inputMode="numeric"
                placeholder="esim. 180"
                value={heightCm}
                onChange={(e) => setHeightCm(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <label className="text-zinc-400 text-sm">Paino (kg)</label>
              <input
                className="w-full p-3 rounded-xl bg-zinc-900 border border-zinc-700"
                inputMode="numeric"
                placeholder="esim. 75"
                value={weightKg}
                onChange={(e) => setWeightKg(e.target.value)}
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-2">
              <label className="text-zinc-400 text-sm">Sukupuoli</label>
              <select
                className="w-full p-3 rounded-xl bg-zinc-900 border border-zinc-700"
                value={gender}
                onChange={(e) => setGender(e.target.value as Gender)}
              >
                <option value="prefer_not_say">en kerro</option>
                <option value="male">mies</option>
                <option value="female">nainen</option>
                <option value="nonbinary">non-binary</option>
                <option value="trans_man">trans mies</option>
                <option value="trans_woman">trans nainen</option>
                <option value="other">muu</option>
              </select>
            </div>

            <div className="space-y-2">
              <label className="text-zinc-400 text-sm">Pronominit</label>
              <input
                className="w-full p-3 rounded-xl bg-zinc-900 border border-zinc-700"
                placeholder="esim. he/him"
                value={pronouns}
                onChange={(e) => setPronouns(e.target.value)}
              />
            </div>
          </div>

          <div className="space-y-2">
            <label className="text-zinc-400 text-sm">Bio (max 280)</label>
            <textarea
              className="w-full p-3 rounded-xl bg-zinc-900 border border-zinc-700 min-h-[100px]"
              value={bio}
              onChange={(e) => setBio(e.target.value.slice(0, 280))}
              placeholder="Kirjoita jotain…"
            />
            <p className="text-zinc-500 text-xs">{bio.length}/280</p>
          </div>

          <div className="space-y-2">
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
                placeholder="Esim. Kotka"
                value={city}
                onChange={(e) => setCity(e.target.value)}
              />
            )}
          </div>

          <button
            onClick={save}
            disabled={busy}
            className="w-full p-3 rounded-xl bg-white text-black font-semibold disabled:opacity-60"
          >
            Tallenna
          </button>

          {msg && <p className="text-zinc-400 text-sm">{msg}</p>}
        </div>
      </section>
    </main>
  );
}
