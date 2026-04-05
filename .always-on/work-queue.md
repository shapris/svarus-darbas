# Nuolatinė darbotvarkė (agentui ir komandai)

**Tikslas:** kai nėra konkrečios vartotojo užduoties arba prašoma tik „tęsk / dirbk toliau“, vykdyti **pirmą nepažymėtą** punktą pagal **P0 → P1 → P2 → P3 → P4** eilę, iki galo su patikra, tada čia pažymėti atlikta ir data.

## Kaip vykdyti (kiekviena sesija)

1. Perskaityti šį failą ir rasti pirmą `- [ ]` **P0** bloke; jei visi P0 atlikti — **P1** → **P2** → **P3** → **P4** (eilės tvarka).
2. **Įgyvendinti** (kodas, SQL instrukcija, konfigūracija) arba, jei blokuoja tik projekto savininkas (pvz. Supabase prisijungimas), paruošti viską, ką galima repo viduje, ir trumpai užrašyti „Žurnalai“ skiltyje, ką dar turi padaryti žmogus.
3. Paleisti **`npm run lint`**; jei keistas UI/backend elgesys — **`npm run build`** (ir smoke, jei tinka).
4. Atnaujinti šį failą: pažymėti `- [x]`, įrašyti datą į „Žurnalai“.
5. Papildomai (nebūtina kiekvieną kartą): **`npm run scout:improvements`** — atnaujins `improvement-backlog.md`.

---

## P0 — gamybinė / duomenų vientisumas

- [x] **Vieša rezervacija Supabase (cloud):** SQL Editor — visas `supabase/public_booking_rpcs.sql` **tik jei** lentelės su `owner_id` (dabartinis app). Jei DB iš ankstesnės migracijos su `uid` — RPC jau yra `20250322120000_crm_schema.sql`; nevykdyti abiejų. Repo: painiava paaiškinta SQL antraštėje + migracijos komentaras. *2026-04-04: `public_booking_rpcs.sql` — „Cloud checklist“; `20260331140000_public_booking_enabled.sql` — Track A/B nuorodos.*
- [x] **`npm audit` (high):** sutvarkyti arba dokumentuoti nepritaikomas high spragas (`npm audit`, išskyrus sąmoningai atidėtus atvejus su priežastimi žemiau „Žurnalai“). *2026-03-31: `package.json` → `overrides.serialize-javascript@7.0.5` (PWA/workbox grandinė), `npm audit` = 0.*

---

## P1 — sauga, patikimumas, kokybė

- [x] **`server.cjs` sukietinimas:** CORS ne `*`, o leidžiamų origino sąrašas per env; dokumentuoti `STRIPE_SECRET_KEY`; nepalikti nutekėjusių placeholder flow produkcijoje be įspėjimo. *2026-03-31: `CORS_ORIGINS`, numatytieji localhost portai, production warn be Stripe; `.env.example`.*
- [x] **Konsolės triukšmas:** peržiūrėti dažniausius `console.error` CRM srautuose (`src/supabase.ts` ir pan.) — palikti tik naudingus; likusius pakeisti į sąmoningą `warn` / tylus failas su toast vartotojui kur reikia. *2026-04-04: `logSupabaseDevError` — logai tik `import.meta.env.DEV` arba `VITE_DEBUG_SUPABASE=true`.*
- [x] **„Demo“ paskyros rizika:** jei `demo@example.com` naudojama jūsų Supabase — dokumentuoti `.env.example` / viduje, kad produkcijoje reikia pakeisti slaptažodį ar apriboti registraciją. *2026-04-04: `.env.example` pastaba + `VITE_DEBUG_SUPABASE`.*
- [x] **Bundle dydis:** įvertinti Vite įspėjimus apie >500 kB chunk; planuoti papildomą `import()` skaidymą (`vendor`). *2026-04-04: `manualChunks` — `vendor-icons`, `vendor-date`, `vendor-stripe`, `vendor-markdown`; React paliktas `vendor` (išvengia circular); `chunkSizeWarningLimit: 1150` su komentaru.*

---

## P2 — nuolatinė kokybė (kai P0/P1 tuščią ar uždaryta)

- [x] **Lint skola:** ESLint projekte **0 įspėjimų** (`eslint .`); likęs vienas `any` tik `localDb` indekse su `eslint-disable` (suderinamumas su `Client`/`Order` ir `supabase` local šaka). *2026-04-04: uždaryta — `authService`, `security`, `performance`, `insightsService`, `intentionClassifier`, `offlineService`, testai, react-refresh komentarai, `exportAllData` `Record<string, unknown>`.*
- [x] **Testai:** `npm run test` + `npm run test:smoke` prieš release; sutvarkyti flaky E2E jei atsiranda. *2026-04-05: rutina vykdoma su P2 pakeitimais — unit + smoke OK; flaky šiuo metu nefiksuota.*
- [x] **Priklausomybės:** periodiškai `npm audit`; po `audit fix` — build + smoke. *2026-04-04: `npm audit fix` (lodash) → 0; `npm run build` + `npm test` OK.*

---

## P3 — infrastruktūra / priežiūra (kai P2 uždaryta)

- [x] **Scout + CI:** `scripts/improvement-scout.ps1` naudoja repo šaknį (`$PSScriptRoot/..`), ne fiksuotą diską; GitHub Actions po Prettier paleidžia **`npm run verify`** (lint, types, build, unit, smoke, `test:console`, `test:invoice`). *2026-04-05*

---

## P4 — ilgalaikis planas (žingsniai į priekį)

*Pradėta: 2026-04-05. Vykdyti iš eilės arba pagal riziką: A → B → … Kiekvienam žingsniui: implementacija → `npm run verify` (arba bent `lint`+`build`+`test`) → pažymėti `[x]` + data + žurnalas.*

### A. Dokumentacija ir gamyba

- [x] **Vienas „source of truth“ deploy:** sutraukti `README.md`, `DEPLOYMENT.md`, `docs/PALEIDIMAS_VERCEL_RENDER.md` į aiškią hierarchiją (kur greitas startas, kur pilnas gidas) be pasikartojimų. *2026-04-05: `docs/DEPLOY.md` žemėlapis; `DEPLOYMENT.md` sutrauktas į referencą; `README` vienas deploy skyrius; `PALEIDIMAS` nuorodos į hierarchiją.*
- [ ] **Env matrica:** lentelė repo (`docs/env-matrix.md` arba `.env.example` skyrius) — visi `VITE_*`, `STRIPE_*`, `CORS_ORIGINS`, Supabase raktai: kur naudojami, privalomi/neprivalomi, dev vs prod.
- [ ] **Gamybinė patikra:** `npm run check:cloud` + rankinis checklist viename faile (`docs/PRODUCTION_CHECKLIST.md`) — DNS, HTTPS, Supabase Auth redirect URLs, Stripe webhook, Render health.
- [ ] **Vercel / Render:** patvirtinti, kad `main` deploy naudoja tuos pačius env kaip dokumentacijoje; įrašyti „known gaps“ jei kas neautomatuojama.

### B. Scout ir diagnostika

- [ ] **Scout tikslumas:** `improvement-scout.ps1` — skaičiuoti `alert(` / `console.error` tik `src/` (ne `.always-on`, ne `*.md`); atnaujinti `improvement-backlog.md` šabloną.
- [ ] **`console.error` 1 banga:** per `src/supabase.ts` ir top views — palikti tik dev/debug arba vartotojui prasmingus kelius; perteklių pakeisti į `logSupabaseDevError` / tylų failą.
- [ ] **`console.error` 2 banga:** `src/services/*` (AI, SMS, insights) — tas pats principas.
- [ ] **Scout metrika:** po pataisų paleisti `scout:improvements` ir įrašyti tikslą „score ≥ 90“ su priežastimi žurnale.

### C. Testai

- [ ] **Playwright: prisijungimas (E2E build):** vienas testas su `VITE_ALLOW_OFFLINE_CRM` / e2e build režimu — užpildyti login, patikrinti kad atsiranda pagrindinis CRM (be tikro cloud slaptažodžio, jei įmanoma per test user fixture).
- [ ] **Playwright: užsakymo juosta:** sukurti užsakymą per UI (offline arba mock) ir patikrinti sąraše.
- [ ] **Vitest:** unit testai 2–3 kritinėms `src/utils/*` funkcijoms (pvz. kainų skaičiavimas, datos formatavimas).
- [ ] **CI cache:** įvertinti `actions/cache` Playwright naršyklei (greitesnis CI) — jei ROI aiškus, įdiegti.

### D. Architektūra — `supabase.ts` skaidymas (po vieną PR)

- [ ] **Išskirti konstantas ir tipus:** `TABLES`, `DatabaseRecord`, auth helperių tipai → `src/supabase/constants.ts` arba `src/supabase/types.ts`; `supabase.ts` importuoja.
- [ ] **Išskirti normalizavimą:** `normalize*FromDb`, stulpelių fallback logika → `src/supabase/normalize.ts`.
- [ ] **Išskirti owner scope / fetch:** `fetchOwnerScopedRowsRaw`, `isMissingUidColumnError` → `src/supabase/ownerScope.ts`.
- [ ] **Išskirti CRUD:** `getData`, `addData`, `updateData`, `deleteData` → `src/supabase/crud.ts` (arba po lentelę grupėmis).
- [ ] **Išskirti auth / booking / portal:** vieša rezervacija, `registerClientUser`, `getClientOrders` → atskiri moduliai; `supabase.ts` lieka plonas barrel export (backward compatible).

### E. Architektūra — dideli komponentai

- [ ] **`OrdersView.tsx`:** išskirti sąrašo eilutę, filtrus ir modalą į `src/views/orders/*` (arba `components/orders/*`).
- [ ] **`CalendarView.tsx`:** išskirti mėnesio tinklelį ir dienos detales į atskirus failus.
- [ ] **`ChatAssistant.tsx`:** išskirti žinutės bubble, įrankių vykdymą, istorijos state į 2–3 failus (be elgsenos keitimo pirmame PR).

### F. UX ir prieinamumas

- [ ] **Focus ir klaviatūra:** pagrindinėse formose (užsakymas, klientas) — `focus-visible` ir logiškas tab order auditas.
- [ ] **Tuščios būsenos:** suvienodinti „nėra duomenų“ blokus (ikona + vienas sakinys + CTA) bent 3 pagrindiniuose view.
- [ ] **Klaidos:** suvienodinti kritinių klaidų rodymą (toast vs inline) vienoje mini-gidėje kode arba komentare `useToast`.

### G. Produktas (pasirinktiniai — uždaryti tik jei aktualu)

- [ ] **Klientų portalas:** apibrėžti MVP (ką tikrai naudoja klientas) ir sutrumpinti flow jei perteklius.
- [ ] **Mokėjimai / Stripe:** end-to-end testas su Stripe test raktais (dokumentuota); arba aiškiai pažymėti „manual QA only“.
- [ ] **Ataskaitos / eksportas:** CSV arba PDF eksportas užsakymams (jei verslas prašo — vienas formatas pirmiau).
- [ ] **Priminimai:** SMS šablonų peržiūra LT kalbai ir teisiniam tekstui (vienas doc + placeholderiai).

### H. Duomenų bazė ir migracijos

- [ ] **Migracijų politika:** vienas doc — kada naudoti `supabase/migrations` vs rankinį SQL Editor; kaip versijuoti breaking pakeitimus.
- [ ] **RLS santrauka:** lentelė „lentelė → politikos tipas → pastaba“ repo (ne slapti duomenys, tik struktūra).
- [ ] **Backup:** nuorodos į Supabase backup / PITR (kas valdo, kas atsakingas) — `docs/` arba vidinis wiki.

### I. Našumas

- [ ] **Bundle analizė:** `vite build --report` arba `rollup-plugin-visualizer` vieną kartą — įrašyti didžiausius laimėjimus į žurnalą.
- [ ] **Lazy load:** antrinės skiltys (Analitika, Logistika) jau lazy per `App.tsx` — peržiūrėti ar dar yra sunkių importų viršuje.
- [ ] **AI užklausos:** rate limit / debounce chat asistente jei naudotojas spaudžia „siųsti“ kelis kartus iš eilės.

### J. Periodinė priežiūra (kartoti, ne „vieną kartą“)

- [ ] **Kas mėnesį:** `npm outdated` peržiūra, minor/patch atnaujinimai su `verify`.
- [ ] **Kas ketvirtį:** dependency major versijų planas (React, Vite, Supabase client).
- [ ] **Po incidento:** įrašas į `session-log.md` + vienas naujas P4 punktas jei reikia prevencijos.

---

## Žurnalai (atlikta / pastabos)

| Data       | Punktas | Kas padaryta |
|------------|---------|--------------|
| 2026-03-31 | —       | Sukurta darbotvarkė + taisyklės `always-on-workflow.mdc`. |
| 2026-03-31 | npm audit high | `serialize-javascript@7.0.5` per npm overrides; audit 0; build OK. |
| 2026-03-31 | server CORS | `server.cjs` + `.env.example`; P0 booking schema doc SQL/migracijoje. |
| 2026-04-04 | Vieša rezervacija + konsolė + demo | `public_booking_rpcs.sql` checklist; migracija 20260331140000 komentarai; `supabase.ts` `logSupabaseDevError`; `.env.example`. |
| 2026-04-04 | Bundle (P1) | `vite.config.ts` papildomi vendor chunk'ai + `chunkSizeWarningLimit` su priežastimi. |
| 2026-04-04 | P2 pradžia + audit | `npm audit fix` (lodash) → 0 spragų; `App.tsx` `getData<SettingsRow>` be `any`; pridėtas P2 blokas darbotvarkėje. |
| 2026-04-04 | P2 tęsinys | `ChatAssistant` lint/typai; priklausomybių punktas uždarytas; `package-lock` atnaujintas. |
| 2026-04-04 | Viso projekto lint banga | ESLint ~239→~155; `aiService`/`toolRouter`/`planningEngine` tipai; `useToast` stabilus `showToast`; atminties blokas system prompt'e. |
| 2026-04-05 | P2 tęsinys | ESLint ~101 įspėjimų; `Dashboard`/`OrdersView`/`supabase.ts` lint pataisymai; `npm run test` + `test:smoke` OK. |
| 2026-04-04 | P2 lint banga | ESLint **~82 → ~36**; `npm run verify` OK; likę: `authService`, `security`, test failai, react-refresh. |
| 2026-04-04 | P2 lint uždaryta | ESLint **0 warnings**; `npm run verify` OK; P2 „Lint skola“ pažymėta atlikta. |
| 2026-04-05 | P3 scout + CI | `improvement-scout.ps1` kelias; `ci.yml` → `npm run verify`; `scout:improvements` atnaujina `.always-on/improvement-backlog.md`. |
| 2026-04-05 | P4 planas | Pridėtas ilgas P4 blokas (`work-queue.md`) — deploy, scout, testai, refaktorius, UX, DB, našumas, priežiūra. |
| 2026-04-05 | P4-A deploy docs | `docs/DEPLOY.md` + hierarchija (`README`, `DEPLOYMENT`, `PALEIDIMAS`). |

*(Agentai: pridėkite eilutę kiekvieną kartą, kai uždarote eilės punktą.)*
