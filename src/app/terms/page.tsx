export default function TermsPage() {
  return (
    <main className="min-h-screen bg-black text-white">
      <div className="max-w-xl mx-auto px-6 py-10">
        <h1 className="text-2xl font-bold">Käyttöehdot (Terms)</h1>
        <p className="text-zinc-400 mt-2">
          GETNITE on vain 18+ käyttäjille. Palvelu on tarkoitettu deittiin ja
          aikuisten väliseen kohtaamiseen.
        </p>

        <div className="mt-8 space-y-4 text-sm text-zinc-200">
          <p><b>1) Ikäraja:</b> Vain 18+. Alaikäiset poistetaan.</p>
          <p><b>2) Suostumus:</b> Ei painostamista, ei ahdistelua.</p>
          <p><b>3) Laiton sisältö:</b> Kielletty. Tilisi voidaan poistaa.</p>
          <p><b>4) Moderointi:</b> Voimme piilottaa/poistaa tilejä sääntörikkomuksista.</p>
          <p><b>5) Turvallisuus:</b> Älä jaa henkilötietoja pakolla, toimi fiksusti.</p>
          <p className="text-zinc-400">
            Näitä ehtoja voidaan päivittää. Jatkamalla käyttöä hyväksyt ehdot.
          </p>
        </div>

        <a className="inline-block mt-10 px-4 py-3 rounded-xl bg-zinc-900 border border-zinc-700" href="/onboarding">
          Takaisin
        </a>
      </div>
    </main>
  );
}
