export default function PrivacyPage() {
  return (
    <main className="min-h-screen bg-black text-white">
      <div className="max-w-xl mx-auto px-6 py-10">
        <h1 className="text-2xl font-bold">Tietosuoja (Privacy)</h1>
        <p className="text-zinc-400 mt-2">
          Kerromme mitä kerätään, miksi, ja miten poistat tiedot.
        </p>

        <div className="mt-8 space-y-4 text-sm text-zinc-200">
          <p><b>Mitä kerätään:</b> sähköposti (kirjautuminen), profiilitiedot, kuvat, viestit, raportit.</p>
          <p><b>Sijainti:</b> jos annat sijainnin, käytetään etäisyyden laskemiseen. Emme näytä tarkkaa osoitetta.</p>
          <p><b>Säilytys:</b> tieto säilyy kunnes poistat tilin tai se poistetaan moderoinnissa.</p>
          <p><b>Poisto:</b> voit poistaa profiilin ja datan asetuksista/profiilista.</p>
          <p><b>Yhteys:</b> lisää tänne support-email kun julkaiset oikeasti.</p>
        </div>

        <a className="inline-block mt-10 px-4 py-3 rounded-xl bg-zinc-900 border border-zinc-700" href="/onboarding">
          Takaisin
        </a>
      </div>
    </main>
  );
}
