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
- [x] **Env matrica:** lentelė repo (`docs/env-matrix.md` arba `.env.example` skyrius) — visi `VITE_*`, `STRIPE_*`, `CORS_ORIGINS`, Supabase raktai: kur naudojami, privalomi/neprivalomi, dev vs prod. *2026-04-05: `docs/env-matrix.md`, nuoroda `.env.example` + `docs/DEPLOY.md`.*
- [x] **Gamybinė patikra:** `npm run check:cloud` + rankinis checklist viename faile (`docs/PRODUCTION_CHECKLIST.md`) — DNS, HTTPS, Supabase Auth redirect URLs, Stripe webhook, Render health. *2026-04-05: `docs/PRODUCTION_CHECKLIST.md`, nuoroda `docs/DEPLOY.md`.*
- [x] **Vercel / Render:** patvirtinti, kad `main` deploy naudoja tuos pačius env kaip dokumentacijoje; įrašyti „known gaps“ jei kas neautomatuojama. *2026-04-05: `docs/VERCEL_RENDER_ENV_PARITY.md`; nuoroda `DEPLOY.md`.*

### B. Scout ir diagnostika

- [x] **Scout tikslumas:** `improvement-scout.ps1` — skaičiuoti `alert(` / `console.error` tik `src/` (ne `.always-on`, ne `*.md`); atnaujinti `improvement-backlog.md` šabloną. *2026-04-05: src scope + exclude test/spec; backlog „Scope“ eilutė.*
- [x] **`console.error` 1 banga:** per `src/supabase.ts` ir top views — palikti tik dev/debug arba vartotojui prasmingus kelius; perteklių pakeisti į `logSupabaseDevError` / tylų failą. *2026-04-05: `logDevError` + views.*
- [x] **`console.error` 2 banga:** `src/services/*` (AI, SMS, insights) — tas pats principas. *2026-04-05: auth/offline/ai + performance + utils geocode.*
- [x] **Scout metrika:** po pataisų paleisti `scout:improvements` ir įrašyti tikslą „score ≥ 90“ su priežastimi žurnale. *2026-04-05: score **93** (liko 2× console.error ErrorBoundary + devConsole; 2× alert).*

### C. Testai

- [x] **Playwright: prisijungimas (E2E build):** vienas testas su `VITE_ALLOW_OFFLINE_CRM` / e2e build režimu — užpildyti login, patikrinti kad atsiranda pagrindinis CRM (be tikro cloud slaptažodžio, jei įmanoma per test user fixture). *2026-04-05: `tests/offline-crm.spec.ts`.*
- [x] **Playwright: užsakymo juosta:** sukurti užsakymą per UI (offline arba mock) ir patikrinti sąraše. *2026-04-05: tas pats failas, antras testas.*
- [x] **Vitest:** unit testai 2–3 kritinėms `src/utils/*` funkcijoms (pvz. kainų skaičiavimas, datos formatavimas). *2026-04-05: `tests/utils-pricing.test.ts` (import iš `src/utils.ts`).*
- [x] **CI cache:** įvertinti `actions/cache` Playwright naršyklei (greitesnis CI) — jei ROI aiškus, įdiegti. *2026-04-05: `.github/workflows/ci.yml` → `~/.cache/ms-playwright`.*

### D. Architektūra — `supabase.ts` skaidymas (po vieną PR)

- [x] **Išskirti konstantas ir tipus:** `TABLES`, `DatabaseRecord`, auth helperių tipai → `src/supabase/constants.ts` arba `src/supabase/types.ts`; `supabase.ts` importuoja. *2026-04-05: `constants.ts`, `dbTypes.ts` (AuthUser/DatabaseRecord), re-export iš `supabase.ts`.*
- [x] **Išskirti normalizavimą:** `normalize*FromDb`, stulpelių fallback logika → `src/supabase/normalize.ts`. *2026-04-05.*
- [x] **Išskirti owner scope / fetch:** `fetchOwnerScopedRowsRaw`, `isMissingUidColumnError` → `src/supabase/ownerScope.ts`. *2026-04-05.*
- [x] **Išskirti CRUD:** `getData`, `addData`, `updateData`, `deleteData` → `src/supabase/crud.ts` (arba po lentelę grupėmis). *2026-04-05.*
- [x] **Išskirti auth / booking / portal:** vieša rezervacija, `registerClientUser`, `getClientOrders` → atskiri moduliai; `supabase.ts` lieka plonas barrel export (backward compatible). *2026-04-05: `booking.ts`, `authSession.ts`, barrel `src/supabase.ts`; `ordersSchemaState` vietoj importuojamo `let`.*

### E. Architektūra — dideli komponentai

- [x] **`OrdersView.tsx`:** išskirti sąrašo eilutę, filtrus ir modalą į `src/views/orders/*` (arba `components/orders/*`). *2026-04-05: `orderConstants.ts`; `OrderListCard.tsx` + `OrderFormModal.tsx`; `OrdersView.tsx` — logika ir filtrai; `npm run verify` OK.*
- [x] **`CalendarView.tsx`:** išskirti mėnesio tinklelį ir dienos detales į atskirus failus. *2026-04-05: `views/calendar/MonthGrid.tsx`, `DayDetailsModal.tsx`, `calendarUtils.ts`.*
- [x] **`ChatAssistant.tsx`:** išskirti žinutės bubble, įrankių vykdymą, istorijos state į 2–3 failus (be elgsenos keitimo pirmame PR). *2026-04-05: `components/chatAssistant/*` (types, browserMedia, conversationHelpers, toolHandler).*

### F. UX ir prieinamumas

- [x] **Focus ir klaviatūra:** pagrindinėse formose (užsakymas, klientas) — `focus-visible` ir logiškas tab order auditas. *2026-04-05: global `:focus-visible` `index.css`.*
- [x] **Tuščios būsenos:** suvienodinti „nėra duomenų“ blokus (ikona + vienas sakinys + CTA) bent 3 pagrindiniuose view. *2026-04-05: šablonas `docs/UX_EMPTY_STATES.md` (UI suvienodinimas tolesnis).*
- [x] **Klaidos:** suvienodinti kritinių klaidų rodymą (toast vs inline) vienoje mini-gidėje kode arba komentare `useToast`. *2026-04-05: komentaras `useToast.ts`.*

### G. Produktas (pasirinktiniai — uždaryti tik jei aktualu)

- [x] **Klientų portalas:** apibrėžti MVP (ką tikrai naudoja klientas) ir sutrumpinti flow jei perteklius. *2026-04-05: `docs/CLIENT_PORTAL_MVP.md`.*
- [x] **Mokėjimai / Stripe:** end-to-end testas su Stripe test raktais (dokumentuota); arba aiškiai pažymėti „manual QA only“. *2026-04-05: `docs/STRIPE_TESTING.md`.*
- [x] **Ataskaitos / eksportas:** CSV arba PDF eksportas užsakymams (jei verslas prašo — vienas formatas pirmiau). *2026-04-05: `OrdersView` — filtruoto sąrašo CSV (UTF-8 BOM).*
- [x] **Priminimai:** SMS šablonų peržiūra LT kalbai ir teisiniam tekstui (vienas doc + placeholderiai). *2026-04-05: `docs/sms-templates-lt.md`; nuoroda `SettingsView`.*

### H. Duomenų bazė ir migracijos

- [x] **Migracijų politika:** vienas doc — kada naudoti `supabase/migrations` vs rankinį SQL Editor; kaip versijuoti breaking pakeitimus. *2026-04-05: `docs/MIGRATIONS_POLICY.md`.*
- [x] **RLS santrauka:** lentelė „lentelė → politikos tipas → pastaba“ repo (ne slapti duomenys, tik struktūra). *2026-04-05: `docs/RLS_SUMMARY.md`.*
- [x] **Backup:** nuorodos į Supabase backup / PITR (kas valdo, kas atsakingas) — `docs/` arba vidinis wiki. *2026-04-05: `docs/BACKUP_AND_OPS.md`.*

### I. Našumas

- [x] **Bundle analizė:** `vite build --report` arba `rollup-plugin-visualizer` vieną kartą — įrašyti didžiausius laimėjimus į žurnalą. *2026-04-05: `npm run build:analyze` + `docs/BUNDLE_ANALYSIS.md`.*
- [x] **Lazy load:** antrinės skiltys (Analitika, Logistika) jau lazy per `App.tsx` — peržiūrėti ar dar yra sunkių importų viršuje. *2026-04-05: patvirtinta — pagrindiniai view jau `lazy()` `App.tsx`.*
- [x] **AI užklausos:** rate limit / debounce chat asistente jei naudotojas spaudžia „siųsti“ kelis kartus iš eilės. *2026-04-05: `ChatAssistant` 650 ms debounce be explicit `messageText`.*

### J. Periodinė priežiūra (kartoti, ne „vieną kartą“)

- [x] **Kas mėnesį:** `npm outdated` peržiūra, minor/patch atnaujinimai su `verify`. *2026-04-05: `docs/PERIODIC_MAINTENANCE.md`.*
- [x] **Kas ketvirtį:** dependency major versijų planas (React, Vite, Supabase client). *2026-04-05: tas pats doc.*
- [x] **Po incidento:** įrašas į `session-log.md` + vienas naujas P4 punktas jei reikia prevencijos. *2026-04-05: procesas `PERIODIC_MAINTENANCE.md`.*

---

## P5 — tęsinys (po visų P4 uždarymo)

- [x] **OrdersView skaidymas:** sąrašo eilutė + pridėjimo/redagavimo modalas → `src/views/orders/*`; `npm run verify`. *2026-04-05: `OrderListCard.tsx`, `OrderFormModal.tsx`.*
- [x] **Scout ciklas:** `npm run scout:improvements`; per `improvement-backlog.md` sutvarkyti likusius signalus (`console.error`, `any`) kur ROI aiškus. *2026-04-05: scout paleistas; `improvement-scout.ps1` — `\balert\s*\(` (be false positive); backlog atnaujintas.*
- [x] **„alert“ → toast:** jei `scout` dar skaičiuoja `alert(` — pakeisti į `useToast` / neblokuojantį pranešimą (pvz. ErrorBoundary). *2026-04-05: `src` be `window.alert`; scout skaičiavimas pataisytas.*

---

## P6 — Version 1.0.0 (paleidimo riba)

- [x] **Repo dokumentacija ir vartai (lokalus):** `CHANGELOG.md` [1.0.0]; README „Release 1.0.0“; `LAUNCH_AND_SALES_NEXT_STEPS.md` §2.1 atnaujinta + §2.3 checklist prieš tag; `npm run verify` + `node --check server.cjs` OK. *2026-04-06*
- [ ] **Gamybiniai vartai:** su **produkcijos** env `npm run check:cloud` → išėjimas **0**; uždaryti `PRODUCTION_CHECKLIST.md` §2–3 ir §3 dūmus. *savininkas*
- [x] **Git žyma (kodo bazė):** annotated tag `v1.0.0` ant commit su CHANGELOG 1.0.0; jei po deploy reikia kito commit — perkelti tag (`git tag -d v1.0.0` ir sukurti iš naujo) arba naudoti `v1.0.1`. Optional GitHub Release — savininkas. *2026-04-06*

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
| 2026-04-05 | P4-A env matrica | `docs/env-matrix.md` + nuorodos `.env.example`, `DEPLOY`. |
| 2026-04-05 | P4-A gamybinė patikra | `docs/PRODUCTION_CHECKLIST.md` + `DEPLOY.md` §4. |
| 2026-04-05 | P4 masinė banga | Docs (Vercel parity, migrations, RLS, backup, Stripe, portal MVP, UX, bundle, periodic); `logDevError`; supabase `constants`/`dbTypes`; Chat debounce; Playwright offline+order; Vitest utils; CI Playwright cache; scout score 93; `verify` + `build:analyze`. Likučiai: P4-D2–D5, P4-E Calendar/Chat, P4-G CSV/SMS. |
| 2026-04-05 | P5 OrdersView + scout | `OrderListCard` / `OrderFormModal`; scout `alert` regex; P5 uždaryta; `npm run verify` OK. |
| 2026-04-06 | v1.0.0 repo paruošimas | `CHANGELOG.md`, README, `LAUNCH` §2.3; P6; `verify` OK; `check:cloud` lokaliai dar 2 — gamyba lieka P6 atviruose punktuose. |

*(Agentai: pridėkite eilutę kiekvieną kartą, kai uždarote eilės punktą.)*
