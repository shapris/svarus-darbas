# Sprendimų žurnalas (ADR light)

Įrašykite tik **stambius** ar **ilgai galiojančius** sprendimus. Formatas: data, kontekstas, sprendimas, pasekmės.

---

## 2026-04-05 — Strategija: agentas priima numatytuosius sprendimus

- **Kontekstas:** savininkas neprivalo būti ekspertas deploy / Stripe / Resend / proceso srityse.
- **Sprendimas:** agentas **numatytai** renkasi saugiausią „gerąją praktiką“ šiam repo (Vercel + Render + Supabase, PWA vietoj APK kol nepaprašyta, kanoninė `owner_id` schema, `npm run verify` prieš release) ir **įgyvendina** be bereikalingų „ką renkatės?“ kilpų. **Kreipiasi į žmogų tik** kai be jo neįmanoma: mokėjimas portale, sutartys, domenų savininkystė, slaptų įvedimas į hostingą, teisiniai ribojimai.
- **Pasekmės:** mažiau sprendimų naštą savininkui; aiškus techninis krypties standartas.

## 2026-04-06 — Be bereikalingo „žiūrėk į ekraną“

- **Kontekstas:** savininkas nenori būti kviečiamas prie monitoriaus be reikalo.
- **Sprendimas:** agentas **pirmiausia** patikrina `npm run verify`, CI, Playwright smoke / konsolės testus ir logus; **nekviesti** žmogaus rankiniu smoke / „pažiūrėk naršyklėje“, jei tai galima automatiškai. Prie ekrano kreiptis tik kai **būtina** žmogaus veiksmui (prisijungimas prie portalo, vienkartinis vizualinis patvirtinimas po aiškaus prašymo).
- **Pasekmės:** mažiau triukšmo; patikra pagrįsta įrankiais, ne lūkesčiu „stovėk šalia“.
- **Pastaba:** „nereikia prie ekrano“ **nereiškia**, kad nereikia atsidaryti Cursor pokalbio — atsakymas čia vis tiek reikalauja tavo žingsnio (tai produkto riba). Reiškia: agentas **neklausinėja** „pažiūrėk į naršyklę / Vercel / konsolę ranka“, kai gali pats paleisti testus ir build.

## 2026-03-31 — Supabase raktai ir konfigūracija

- **Sprendimas:** neplėšti Supabase URL / anon rakto į šaltinio kodą; naudoti tik `VITE_*` / env.
- **Pasekmės:** deploy ir lokalu vienoda praktika; raktai lieka hostinge.

## 2026-03-31 — Rollup / AI servisų ciklai

- **Sprendimas:** vengti re-export ciklų `aiService`, kad nekiltų Rollup chunk priklausomybės problemos.
- **Pasekmės:** stabilesnis build.

## 2026-04-02 — Ilgalaikė atmintis repo viduje

- **Sprendimas:** planai, sesijų santraukos ir datos saugomi `.always-on/` failuose versijuojant su Git, o ne tik Cursor pokalbio istorijoje.
- **Pasekmės:** naujos sesijos ir komanda gali tęsti tą patį kontekstą be rankinio perkėlimo.

---

<!-- Šablonas:

## YYYY-MM-DD — pavadinimas

- **Kontekstas:**
- **Sprendimas:**
- **Pasekmės / alternatyvos atmestos:**

-->
