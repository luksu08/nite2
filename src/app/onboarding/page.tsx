"use client";

import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/lib/supabaseClient";

type ProfileRow = {
  id: string;
  display_name: string;
  birthdate: string; // yyyy-mm-dd
  bio: string;
  show_city: boolean;
  city: string | null;
  role: string;
  looking: string;

  height_cm: number | null;
  weight_kg: number | null;
  gender: string | null;
  pronouns: string | null;

  adult_confirmed: boolean;
  accepted_terms_at: string | null;
  accepted_privacy_at: string | null;
};

export default function OnboardingPage() {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const [me, setMe] = useState<string | null>(null);

  const [displayName, setDisplayName] = useState("");
  const [birthdate, setBirthdate] = useState(""); // yyyy-mm-dd
  const [bio, setBio] = useState("");

  const [showCity, setShowCity] = useState(false);
  const [city, setCity] = useState("");

  const [role, setRole] = useState("none");
  const [looking, setLooking] = useState("open");

  const [heightCm, setHeightCm] = useState<string>("");
  const [weightKg, setWeightKg] = useState<string>("");
  const [gender, setGender] = useState("en kerro");
  const [pronouns, setPronouns] = useState("");

  const [adultConfirmed, setAdultConfirmed] = useState(false);
  const [acceptTerms, setAcceptTerms] = useState(false);
  const [acceptPrivacy, setAcceptPrivacy] = useState(false);

  const [photosCount, setPhotosCount] = useState(0);

  const canSave = useMemo(() => {
    if (!displayName || displayName.trim().length < 2) return false;
    if (!birthdate) return false;
    if (!adultConfirmed) return false;
    if (!acceptTerms || !acceptPrivacy) return false;
    if (photosCount < 1) return false;
    return true;
  }, [displayName, birthdate, adultConfirmed, acceptTerms, acceptPrivacy, photosCount]);

  useEffect(() => {
    (async () => {
      const user = (await supabase.auth.getUser()).data.user;
      if (!user) {
        window.location.href = "/login";
        return;
      }
      setMe(user.id);

      // fetch profile (don’t expose birthdate anywhere else)
      const { data: prof } = await supabase
        .from("profiles")
        .select(
          "id, display_name, birthdate, bio, show_city, city, role, looking, height_cm, weight_kg, gender, pronouns, adult_confirmed, accepted_terms_at, accepted_privacy_at"
        )
        .eq("id", user.id)
        .maybeSingle();

      if (prof) {
        const p = prof as ProfileRow;
        setDisplayName(p.display_name ?? "");
        setBirthdate(p.birthdate ?? "");
        setBio(p.bio ?? "");
        setShowCity(!!p.show_city);
        setCity(p.city ?? "");
        setRole(p.role ?? "none");
        setLooking(p.looking ?? "open");

        setHeightCm(p.height_cm ? String(p.height_cm) : "");
        setWeightKg(p.weight_kg ? String(p.weight_kg) : "");
        setGender(p.gender ?? "en kerro");
        setPronouns(p.pronouns ?? "");

        setAdultConfirmed(!!p.adult_confirmed);
        setAcceptTerms(!!p.accepted_terms_at);
        setAcceptPrivacy(!!p.accepted_privacy_at);
      }

      await refreshPhotosCount(user.id);
      setLoading(false);
    })();
  }, []);

  async function refreshPhotosCount(userId: string) {
    const { data } = await supabase
      .from("photos")
      .select("id", { count: "exact", head: true })
      .eq("user_id", userId);

    // supabase-js returns count on some versions; safe fallback:
    const { count } = await supabase
      .from("photos")
      .select("*", { count: "exact", head: true })
      .eq("user_id", userId);

    setPhotosCount(count ?? 0);
  }

  async function onUploadPhoto(file: File) {
    const user = (await supabase.auth.getUser()).data.user;
    if (!user) return;

    // Basic validation
    if (!file.type.startsWith("image/")) return alert("Vain kuvatiedosto");
    if (file.size > 10 * 1024 * 1024) return alert("Max 10MB ennen pakkausta");

    // Client-side compress to WebP + max 1080px
    const { blob, width, height } = await compressToWebp(file, 1080, 0.82);

    if (blob.size > 1.5 * 1024 * 1024) {
      // still too big => push quality down a bit
      const again = await compressToWebp(file, 1080, 0.72);
      return await uploadBlob(user.id, again.blob);
    }

    return await uploadBlob(user.id, blob);

    async function uploadBlob(uid: string, b: Blob) {
      const ext = "webp";
      const path = `${uid}/${crypto.randomUUID()}.${ext}`;

      const { error: upErr } = await supabase.storage
        .from("photos")
        .upload(path, b, { contentType: "image/webp", upsert: false });

      if (upErr) return alert(upErr.message);

      // Insert photo row
      const { error: dbErr } = await supabase.from("photos").insert({
        user_id: uid,
        path,
        is_primary: photosCount === 0, // first becomes primary
        sort_order: photosCount,
      });

      if (dbErr) return alert(dbErr.message);

      await refreshPhotosCount(uid);
    }
  }

  async function save() {
    if (!me) return;
    if (!canSave) return alert("Täytä pakolliset: nimi, syntymäaika, 18+, ehdot, tietosuoja, vähintään 1 kuva.");

    setSaving(true);

    const height = heightCm ? Number(heightCm) : null;
    const weight = weightKg ? Number(weightKg) : null;

    const updates: any = {
      display_name: displayName.trim(),
      birthdate,
      bio: bio.slice(0, 280),
      show_city: showCity,
      city: showCity ? (city.trim().slice(0, 40) || null) : null,
      role,
      looking,

      height_cm: height,
      weight_kg: weight,
      gender: gender === "en kerro" ? null : gender,
      pronouns: pronouns.trim() || null,

      adult_confirmed: adultConfirmed,
      accepted_terms_at: acceptTerms ? new Date().toISOString() : null,
      accepted_privacy_at: acceptPrivacy ? new Date().toISOString() : null,

      last_active_at: new Date().toISOString(),
      is_active: true,
      is_frozen: false,
    };

    const { error } = await supabase.from("profiles").update(updates).eq("id", me);

    setSaving(false);

    if (error) return alert(error.message);

    // after save, go browse
    window.location.href = "/browse";
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
      <div className="max-w-xl mx-auto px-6 py-10">
        <h1 className="text-2xl font-bold">Onboarding</h1>
        <p className="text-zinc-400 mt-2">Täytä perustiedot. Et pääse eteenpäin ilman vähintään yhtä kuvaa.</p>

        <div className="mt-8 space-y-4">
          <div>
            <label className="text-sm text-zinc-300">Nimi (näkyy)</label>
            <input
              className="mt-1 w-full px-4 py-3 rounded-xl bg-zinc-900 border border-zinc-700 outline-none"
              value={displayName}
              onChange={(e) => setDisplayName(e.target.value)}
              placeholder="Esim. Aleksi"
            />
          </div>

          <div>
            <label className="text-sm text-zinc-300">Syntymäaika (EI näy julkisesti, vain ikä)</label>
            <input
              type="date"
              className="mt-1 w-full px-4 py-3 rounded-xl bg-zinc-900 border border-zinc-700 outline-none"
              value={birthdate}
              onChange={(e) => setBirthdate(e.target.value)}
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-sm text-zinc-300">Rooli</label>
              <select
                className="mt-1 w-full px-4 py-3 rounded-xl bg-zinc-900 border border-zinc-700"
                value={role}
                onChange={(e) => setRole(e.target.value)}
              >
                <option value="none">ei kerro</option>
                <option value="top">top</option>
                <option value="bottom">bottom</option>
                <option value="vers">vers</option>
                <option value="side">side</option>
              </select>
            </div>

            <div>
              <label className="text-sm text-zinc-300">Haen</label>
              <select
                className="mt-1 w-full px-4 py-3 rounded-xl bg-zinc-900 border border-zinc-700"
                value={looking}
                onChange={(e) => setLooking(e.target.value)}
              >
                <option value="open">avoin</option>
                <option value="hookup">hookup</option>
                <option value="fwb">fwb</option>
                <option value="date">date</option>
                <option value="chat">chat</option>
              </select>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-sm text-zinc-300">Pituus (cm)</label>
              <input
                className="mt-1 w-full px-4 py-3 rounded-xl bg-zinc-900 border border-zinc-700 outline-none"
                value={heightCm}
                onChange={(e) => setHeightCm(e.target.value.replace(/[^\d]/g, ""))}
                placeholder="esim. 180"
              />
            </div>
            <div>
              <label className="text-sm text-zinc-300">Paino (kg)</label>
              <input
                className="mt-1 w-full px-4 py-3 rounded-xl bg-zinc-900 border border-zinc-700 outline-none"
                value={weightKg}
                onChange={(e) => setWeightKg(e.target.value.replace(/[^\d]/g, ""))}
                placeholder="esim. 75"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-sm text-zinc-300">Sukupuoli</label>
              <select
                className="mt-1 w-full px-4 py-3 rounded-xl bg-zinc-900 border border-zinc-700"
                value={gender}
                onChange={(e) => setGender(e.target.value)}
              >
                <option>en kerro</option>
                <option>mies</option>
                <option>nainen</option>
                <option>trans</option>
                <option>nonbinary</option>
                <option>muu</option>
              </select>
            </div>
            <div>
              <label className="text-sm text-zinc-300">Pronominit</label>
              <input
                className="mt-1 w-full px-4 py-3 rounded-xl bg-zinc-900 border border-zinc-700 outline-none"
                value={pronouns}
                onChange={(e) => setPronouns(e.target.value)}
                placeholder="esim. he/him"
              />
            </div>
          </div>

          <div>
            <label className="text-sm text-zinc-300">Bio (max 280)</label>
            <textarea
              className="mt-1 w-full px-4 py-3 rounded-xl bg-zinc-900 border border-zinc-700 outline-none min-h-[110px]"
              value={bio}
              onChange={(e) => setBio(e.target.value)}
              maxLength={280}
              placeholder="Kirjoita jotain…"
            />
            <div className="text-xs text-zinc-500 mt-1">{bio.length}/280</div>
          </div>

          <div className="flex items-center gap-2">
            <input type="checkbox" checked={showCity} onChange={(e) => setShowCity(e.target.checked)} />
            <span className="text-sm">Näytä kaupunki</span>
          </div>

          {showCity && (
            <input
              className="w-full px-4 py-3 rounded-xl bg-zinc-900 border border-zinc-700 outline-none"
              value={city}
              onChange={(e) => setCity(e.target.value)}
              placeholder="Esim. Helsinki"
            />
          )}

          {/* PHOTO UPLOAD */}
          <div className="rounded-2xl border border-zinc-800 bg-zinc-950 p-4">
            <p className="font-semibold">Kuvat</p>
            <p className="text-sm text-zinc-400 mt-1">
              Vähintään 1 kuva pakollinen. Max 6. Ei alastomuutta profiilikuvissa (paidattomuus ok).
            </p>

            <div className="mt-3 flex items-center justify-between">
              <div className="text-sm text-zinc-300">Kuvia: {photosCount}/6</div>
              <label className="px-4 py-2 rounded-xl bg-white text-black font-semibold cursor-pointer">
                Lisää kuva
                <input
                  type="file"
                  accept="image/*"
                  className="hidden"
                  onChange={(e) => {
                    const f = e.target.files?.[0];
                    if (f) onUploadPhoto(f);
                    e.currentTarget.value = "";
                  }}
                />
              </label>
            </div>
          </div>

          {/* CHECKBOXES */}
          <div className="space-y-2">
            <label className="flex items-center gap-2 text-sm">
              <input type="checkbox" checked={adultConfirmed} onChange={(e) => setAdultConfirmed(e.target.checked)} />
              Olen 18+
            </label>

            <label className="flex items-center gap-2 text-sm">
              <input type="checkbox" checked={acceptTerms} onChange={(e) => setAcceptTerms(e.target.checked)} />
              Hyväksyn <a className="underline" href="/terms" target="_blank">käyttöehdot</a>
            </label>

            <label className="flex items-center gap-2 text-sm">
              <input type="checkbox" checked={acceptPrivacy} onChange={(e) => setAcceptPrivacy(e.target.checked)} />
              Hyväksyn <a className="underline" href="/privacy" target="_blank">tietosuojan</a>
            </label>
          </div>

          <button
            className={`w-full p-4 rounded-xl font-semibold ${canSave ? "bg-white text-black" : "bg-zinc-800 text-zinc-400"}`}
            onClick={save}
            disabled={!canSave || saving}
          >
            {saving ? "Tallennetaan…" : "Tallenna"}
          </button>

          {!canSave && (
            <p className="text-sm text-zinc-500">
              Pakolliset: nimi, syntymäaika, 18+, ehdot, tietosuoja, vähintään 1 kuva.
            </p>
          )}
        </div>
      </div>
    </main>
  );
}

// --- image helper (A3) ---
async function compressToWebp(file: File, maxSide: number, quality: number) {
  const img = await fileToImage(file);

  const { w, h } = fitInside(img.width, img.height, maxSide);

  const canvas = document.createElement("canvas");
  canvas.width = w;
  canvas.height = h;

  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Canvas not supported");

  ctx.drawImage(img, 0, 0, w, h);

  const blob: Blob = await new Promise((resolve, reject) => {
    canvas.toBlob(
      (b) => (b ? resolve(b) : reject(new Error("toBlob failed"))),
      "image/webp",
      quality
    );
  });

  return { blob, width: w, height: h };
}

function fitInside(width: number, height: number, maxSide: number) {
  const scale = Math.min(1, maxSide / Math.max(width, height));
  return { w: Math.round(width * scale), h: Math.round(height * scale) };
}

function fileToImage(file: File): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => {
      URL.revokeObjectURL(url);
      resolve(img);
    };
    img.onerror = reject;
    img.src = url;
  });
}
