"use client";

import { useEffect } from "react";
import { supabase } from "@/lib/supabaseClient";

export default function AuthCallback() {
  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      if (data.session) {
        window.location.href = "/onboarding";
      } else {
        window.location.href = "/login";
      }
    });
  }, []);

  return (
    <main className="min-h-screen flex items-center justify-center bg-black text-white">
      <p>Kirjaudutaan sisään…</p>
    </main>
  );
}
