# Sprendimai (ADR-lite)

Trumpi, kanoniniai sprendimų įrašai apie tai, **kodėl** sistemoje pasirinkta viena ar kita kryptis.

## Format as template

```md
## YYYY-MM-DD — <Trumpas pavadinimas>

- Statusas: priimta | pakeista | atšaukta
- Kontekstas: 1–3 sakiniai (problema, tikslas, ribos)
- Sprendimas: 1–3 punktai (ką darome)
- Alternatyvos: 1–2 punktai (ką svarstėme ir kodėl ne)
- Pasekmės: 1–3 punktai (ką tai reiškia ateityje)
- Patikra: kokie testai/komandos patvirtina
```

---

## 2026-04-08 — „Incident → testas“ kaip taisyklė

- Statusas: priimta
- Kontekstas: pasikartojančios problemos linkusios grįžti tyliai, jei lieka tik žinutėse ar galvoje.
- Sprendimas:
  - Kiekvienas realus incidentas turi palikti bent vieną automatizuotą „saugiklį“: testą, `check:*` skriptą arba `/health` diagnostiką.
  - „Saugiklis“ turi būti pigus (greitas) ir stabilus (be flaky).
- Alternatyvos:
  - Tik dokumentuoti incidentą be testo — atmetama, nes regresijos grįžta nepastebimai.
- Pasekmės:
  - Daugėja testų/diagnostikos, bet mažėja gamybinių regresijų.
- Patikra: `npm run verify`

---

## 2026-04-08 — „Projekto atmintis“ repo viduje

- Statusas: priimta
- Kontekstas: agento/komandos darbas turi būti tęstinis tarp sesijų ir nepriklausyti nuo vieno pokalbio konteksto.
- Sprendimas:
  - Laikyti kanoninę atmintį `.always-on/`:
    - `session-log.md` (chronologija),
    - `work-queue.md` (vykdymo eilė),
    - `decisions.md` (sprendimai),
    - `known-issues.md` (žinomos problemos),
    - `runbooks/` (operaciniai veiksmai).
- Alternatyvos:
  - Laikyti tik „chat history“ — atmetama, nes yra konteksto apkarpymas ir neperkeliamumas.
- Pasekmės:
  - Kiekviena pamoka tampa pernaudojama ir patikrinama.
- Patikra: `npm run verify` (kai yra kodo pakeitimų)

---

## 2026-04-08 — Nekeisti į ESLint 10, kol `react-hooks` plugin nepalaiko

- Statusas: priimta
- Kontekstas: norint kelti `eslint@10` gaunamas `ERESOLVE` dėl `eslint-plugin-react-hooks` peer range.
- Sprendimas:
  - Laikyti `eslint@9` ekosistemą iki upstream suderinamumo.
  - Nenaudoti `--force`/`--legacy-peer-deps` lint toolchain upgrade’ui.
- Alternatyvos:
  - Force install — atmetama (gali atnešti nestabilų/nesuderinamą lint).
- Pasekmės:
  - Major upgrade nukeliamas; periodiškai peržiūrėti `npm outdated` ir atnaujinti, kai bus suderinama.
- Patikra: `npm run lint:eslint`

---

## 2026-04-08 — `@vitejs/plugin-react` laikyti tik devDependencies

- Statusas: priimta
- Kontekstas: Vite pluginas reikalingas build/test įrankinei, bet ne runtime serveriui.
- Sprendimas:
  - `@vitejs/plugin-react` laikomas `devDependencies`, pašalintas iš `dependencies`.
- Alternatyvos:
  - Laikyti `dependencies` — atmetama (nereikalingas runtime paviršius ir painesnis dependency medis).
- Pasekmės:
  - Švaresnis production dependency rinkinys ir aiškesnis Vite upgrade kelias.
- Patikra: `npm run verify`

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
