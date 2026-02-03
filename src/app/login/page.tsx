"use client";

<div style={{padding: 12, background: "yellow", color: "black", fontWeight: 700}}>
  BUILD TEST: 2026-02-03 12:45
</div>


import { useState } from "react";
import { supabase } from "@/lib/supabaseClient";

export default function LoginPage() {
  const [email, setEmail] = useState("");
  const [sent, setSent] = useState(false);
  const [password, setPassword] = useState("");


 async function signIn() {
  const redirectTo = `${window.location.origin}/auth/callback`;

  const { error } = await supabase.auth.signInWithOtp({
    email,
    options: { emailRedirectTo: redirectTo },
  });

  if (error) alert(error.message);
  else setSent(true);
}

async function signUpPassword() {
  const { error } = await supabase.auth.signUp({
    email,
    password,
  });

  if (error) alert(error.message);
  else window.location.href = "/onboarding";
}

async function signInPassword() {
  const { error } = await supabase.auth.signInWithPassword({
    email,
    password,
  });

  if (error) alert(error.message);
  else window.location.href = "/browse";
}



  return (
    <main className="min-h-screen flex items-center justify-center bg-black text-white">
      <div className="w-full max-w-sm space-y-4 p-6">
        <h1 className="text-3xl font-bold text-center">NITE</h1>
        <p className="text-center text-zinc-400">18+ only</p>

        <input
          className="w-full p-3 rounded-xl bg-zinc-900 border border-zinc-700"
          placeholder="sähköposti"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
        />

        <input
  className="w-full p-3 rounded-xl bg-zinc-900 border border-zinc-700"
  placeholder="salasana"
  type="password"
  value={password}
  onChange={(e) => setPassword(e.target.value)}
/>


        <button
          onClick={signIn}
          className="w-full p-3 rounded-xl bg-white text-black font-semibold"
        >
          Kirjaudu
        </button>

        <button
  onClick={signUpPassword}
  className="w-full p-3 rounded-xl bg-white text-black font-semibold"
>
  Rekisteröidy (salasana)
</button>

<button
  onClick={signInPassword}
  className="w-full p-3 rounded-xl bg-zinc-900 border border-zinc-700 font-semibold"
>
  Kirjaudu (salasana)
</button>


        {sent && (
          <p className="text-center text-emerald-400">
            Linkki lähetetty. Checkaa sähköposti.
          </p>
        )}
      </div>
    </main>
  );
}
