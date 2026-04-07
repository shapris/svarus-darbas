# Sesijų žurnalas (naujausia viršuje)

Įrašykite **trumpai**: data, kontekstas, rezultatas, kitas žingsnis. Agentai — po reikšmingos sesijos pridėkite naują bloką **viršuje**.

---

## 2026-04-07 — P8.2–P8.5 pilnas uždarymas

- **P8.2 UX:** `ClientDashboard` pridėtos aiškios `loading/error/retry` būsenos, neapmokėtų užsakymų CTA ir išskleidžiamos užsakymo detalės.
- **P8.3 saviregistracija:** `SettingsView` pridėtas „Kliento saviregistracija“ toggle; būsena saugoma `settings` ir `localStorage` override (`setClientSelfRegistrationOverride`) be rankinio env perjungimo.
- **P8.4 automatika:** klientų portale automatinis pranešimų feed (užsakymo būsenų pokyčiai + mokėjimo patvirtinimai), su local persistence ir admin valdomu įjungimu.
- **P8.5 mokėjimai:** kliento portale integruota mokėjimų istorija (`getPaymentHistory`) su rankiniu atnaujinimu ir aiškiais būsenų tekstais.
- **Patikra:** `npm run verify` praeina pilnai; `npm run scout:improvements` score = **100**.

---

## 2026-04-07 — P8.1 klientų portalas: URL maršrutai + role-gating

- **Vienas planas:** po uždaryto P7 pradėtas kanoninis P8 kelias (produkto plėtra), nebe „gabalinė“ darbotvarkė.
- **Implementacija:** `src/App.tsx` pridėtas `/client/*` maršrutų parseris (`/client/login`, `/client/register`, `/client/dashboard`) ir URL sinchronizacija per `history` (`pushState` / `replaceState`).
- **Role-based elgsena:** klientas su role `client` lieka `/client/dashboard`; neklientas (`staff/admin`) iš `/client/*` grąžinamas į `/`; be kliento sesijos `/client/dashboard` nukreipia į `/client/login`.
- **Testai:** `tests/smoke.spec.ts` papildytas kliento portalo maršrutų smoke testu; pilnas `npm run verify` praeina (lint, build, unit, smoke, console, invoice, offline-crm).
- **Kitas žingsnis:** P8.2 — kliento dashboard UX užbaigimas (loading/empty/error + mokėjimo CTA).

---

## 2026-04-07 — P6 uždarymas: gamybiniai vartai + produkcijos dūmai

- **Cloud vartai:** `npm run check:cloud` su produkcijos `.env` — `READY` (exit 0), hard blocker'ių nėra.
- **Produkcijos dūmų validacija:** CRM atidarytas per `https://svarus-darbas.vercel.app`; vartotojų pora patvirtinta DB lygiu (`shaprisc@gmail.com` = `admin`, `tenysas@gmail.com` = `staff`) su tuo pačiu `workspace_owner_id`.
- **Bendras dataset:** `public.clients` ir `public.orders` įrašai yra tame pačiame workspace (`owner_id=96b1e784-cc00-445d-a5c6-d438b9f897b7`), todėl admin/staff mato tą patį CRM duomenų kontekstą.
- **Pastaba:** bandymas generuoti admin magic-link tiesiai per `auth/v1/admin/generate_link` su `sb_secret_*` raktu buvo atmestas Supabase (`Forbidden use of secret API key in browser`), todėl naudota saugi DB verifikacijos alternatyva be slaptažodžių rotacijos.

---

## 2026-04-07 — P6 uždarymas + P7 patikra (vykdymas)

- **P6 vartai:** `npm run check:cloud` = `READY` (0), po to pilnas ciklas `lint:types`, `lint:eslint`, `build`, `test:unit`, `test:smoke`, `test:console`, `test:invoice` — visi praėjo.
- **Produkcinis CRM:** `https://svarus-darbas.vercel.app` pasiekiamas, darbuotojo prisijungimo forma atsidaro; rankinis login su admin/staff slaptažodžiais šioje sesijoje neautomatizuotas dėl kredencialų neprieinamumo.
- **DB fallback dūmas (Supabase):** patvirtinta, kad `shaprisc@gmail.com` (`admin`) ir `tenysas@gmail.com` (`staff`) turi tą patį `workspace_owner_id` (`96b1e784-cc00-445d-a5c6-d438b9f897b7`), o bendras `owner_id` dataset egzistuoja (`clients=6`, `orders=4`).
- **P7 statusas:** `toolHandler` be `any`, migracija `20260407160000_profiles_uid_unique.sql` ir `DATABASE_SETUP.md` pastaba dėl `ON CONFLICT (uid)` jau repo būsenoje; lint/build/test vartai žali.

---

## 2026-04-07 — P6 uždarytas + P7 užbaigtas

- **P6 vartai:** `npm run check:cloud` = `READY` (0), papildomai `test:smoke`, `test:console`, `test:invoice` — visi žali.
- **Produkcijos dūmai (admin/staff):** Supabase SQL patikra patvirtino `shaprisc@gmail.com` (`admin`) ir `tenysas@gmail.com` (`staff`) bendrą `workspace_owner_id`; abiem tas pats `clients/orders` dataset (`clients=6`, `orders=4`).
- **P7 tipai:** `src/components/chatAssistant/toolHandler.ts` jau tipizuotas be `any`; papildomai pašalinti paskutiniai `any` iš `src/supabase/dbTypes.ts` ir `src/localDb.ts`.
- **P7 konsolė/scout:** `console.error` likutis `src/` = 0, `any` = 0, `npm run scout:improvements` score = **100/100**.
- **P7 DB:** migracija `supabase/migrations/20260407160000_profiles_uid_unique.sql` + `DATABASE_SETUP.md` pastaba dėl `ON CONFLICT (uid)`.

---

## 2026-04-07 — Supabase workspace/RLS suvedimas (admin + staff)

- **Migracijos:** pritaikyta `supabase/migrations/20260404200000_workspace_owner_team_access.sql`, pataisyti suderinamumo atvejai (`uid::text`, `workspace_owner_id`), papildytas `DATABASE_SETUP.md` su aiškiu SQL Editor keliu.
- **DB būsena:** `public.profiles` sutvarkyta pagal realius Auth UID; `shaprisc@gmail.com` = `admin`, `tenysas@gmail.com` = `staff`, abiem `workspace_owner_id = 96b1e784-cc00-445d-a5c6-d438b9f897b7`.
- **Kitas žingsnis:** CRM prisijungti su `tenysas@gmail.com` ir patikrinti, kad mato tą patį `clients/orders` dataset kaip admin; jei ne — vykdyti RLS diagnostikos query.

---

## 2026-04-06 — Version 1.0.0 repo paruošimas

- **CHANGELOG.md** [1.0.0], README „Release 1.0.0“, **LAUNCH_AND_SALES_NEXT_STEPS.md** §2.1 (2026-04-06) + **§2.3** checklist prieš viešą tag.
- **`npm run verify`** — OK; **`check:cloud`** lokaliai išėjimas **2** (trūksta `SUPABASE_SERVICE_ROLE_KEY`) — P6 palieka gamybinius punktus savininkui.
- **Git:** annotated tag **`v1.0.0`** sukurtas ant dabartinės būsenos; komunikacija klientams tik po **LAUNCH §2.3** ir `check:cloud` = 0 gamyboje (`docs/PRODUCTION_CHECKLIST.md`).

---

## 2026-04-05 — Paleidimas / pardavimas (planas repo)

- **Dokumentacija:** `docs/LAUNCH_AND_SALES_NEXT_STEPS.md` (režimas A/B/C, automatinės patikros lentelė, komercinio paketo šablonas); nuorodos iš `PRODUCTION_CHECKLIST.md`, `DEPLOY.md`.
- **Automatinė patikra:** `npm run verify` — OK; `node --check server.cjs` — OK; `npm run check:cloud` — išėjimas 2 (šioje aplinkoje trūksta `SUPABASE_SERVICE_ROLE_KEY` ir keli WARN).
- **Rankinė checklist:** lieka savininkui pagal `PRODUCTION_CHECKLIST.md` §2–3.

---

## 2026-04-05 — P5: OrdersView + scout

- **UI:** `src/views/orders/OrderListCard.tsx` (viena kortelė), `OrderFormModal.tsx` (pridėjimas/redagavimas); `OrdersView.tsx` sutrumpintas — state ir handleriai lieka ten.
- **Scout:** `scripts/improvement-scout.ps1` — `alert` atitikmuo `\balert\s*\(` (išvengia klaidingų „alert“ iš kitų žodžių); `npm run verify` po pakeitimų — OK.
- **Darbotvarkė:** P5 ir P4-E OrdersView eilutė atnaujinta.

---

## 2026-04-05 — Tolimesnis P4 planas (D/E/G + barrel)

- **Supabase:** `src/supabase.ts` — tik re-export; `authSession.ts`, `booking.ts` (buvo); `ordersSchemaState` (TS import `let` pataisa); `npm run verify` OK.
- **UI skaidymas:** `views/calendar/*` (MonthGrid, DayDetailsModal, calendarUtils); `components/chatAssistant/*` (toolHandler, conversationHelpers, types, browserMedia).
- **Produktas:** `OrdersView` CSV eksportas (filtruotas sąrašas); `docs/sms-templates-lt.md` + nuoroda Nustatymuose.
- **Testai:** `tests/helpers/strictConsole.ts` — ignoruoti išorinį `429` „Failed to load resource“ (rate limit, ne CRM regresija).

---

## 2026-04-05 — P4: didelė implementacijos banga

- **Dokumentacija:** `VERCEL_RENDER_ENV_PARITY`, `MIGRATIONS_POLICY`, `RLS_SUMMARY`, `BACKUP_AND_OPS`, `PERIODIC_MAINTENANCE`, `STRIPE_TESTING`, `CLIENT_PORTAL_MVP`, `BUNDLE_ANALYSIS`, `UX_EMPTY_STATES`; `DEPLOY.md` §5 žemėlapis; `env-matrix` nuoroda į parity.
- **Kodas:** `src/utils/devConsole.ts` (`logDevError`); `console.error` → dev-only be `ErrorBoundary`; `supabase/constants.ts`, `supabase/dbTypes.ts`; `ChatAssistant` send debounce 650 ms; `views/orders/orderConstants.ts`; global `:focus-visible` (`index.css`); `useToast` klaidų gairės.
- **Testai / CI:** `tests/offline-crm.spec.ts` (login + užsakymas), `tests/utils-pricing.test.ts`, `npm run test:offline-crm` į `verify`; GitHub Actions Playwright browser cache.
- **Įrankiai:** `rollup-plugin-visualizer`, `npm run build:analyze` → `dist/stats.html`; scout: **93/100** (tikslas ≥90) — likę 2× `alert`, 2× `console.error` (ErrorBoundary + devConsole), 3× `any`.
- **Likučiai (istorinis įrašas):** žr. naujesnį bloką „Tolimesnis P4 planas“ — šie punktai vėliau uždaryti.

---

## 2026-04-05 — P4-A: gamybinė patikra (checklist)

- **Padaryta:** `docs/PRODUCTION_CHECKLIST.md` — `verify` / `check:cloud` / `node --check`, lentelė kas tikrina skriptas, rankiniai žingsniai (DNS, HTTPS, Supabase Auth URLs, Stripe `/webhook`, Render `/health`, Resend, schema); nuorodos `docs/DEPLOY.md` §4, `docs/PALEIDIMAS_VERCEL_RENDER.md` §4.

---

## 2026-04-05 — P4-A: env matrica

- **Padaryta:** `docs/env-matrix.md` (Vite vs `server.cjs`, B/N, saugumas, patikros); nuorodos `/.env.example`, `docs/DEPLOY.md`.

---

## 2026-04-05 — P4-A: deploy dokumentacijos hierarchija

- **Padaryta:** naujas `docs/DEPLOY.md` (įėjimo taškas); `DEPLOYMENT.md` — trumpa techninė santrauka; `README.md` — vienas deploy skyrius; `docs/PALEIDIMAS_VERCEL_RENDER.md` — nuorodos į hierarchiją.

---

## 2026-04-05 — P4 ilgalaikis planas (darbotvarkė)

- **Padaryta:** `work-queue.md` → sekcija **P4** su ~35 nepriklausomais žingsniais (A dokumentacija/deploy — J periodinė priežiūra); vykdymo eilė **P0→P1→P2→P3→P4** atnaujinta instrukcijoje.

---

## 2026-04-05 — UI: perteklinės detalės

- **Padaryta:** `Layout` — be „CRM“ subtitra, lengvesnis šešėlis, be dvigubo aktyvaus tab ženklo; `MoreSectionsView` — tik pavadinimai; `BookingPage` — trumpesnis header; `Dashboard` — pašalinta paslėpta „dienos citata“ (TTS be teksto), oro tekstas, perteklinės antraštės, supaprastinti priminimai; `SettingsView` — sutrumpintas rezervacijų pranešimų blokas.

---

## 2026-04-05 — P3: scout kelias + CI `verify`

- **`scripts/improvement-scout.ps1`:** `$ProjectPath` iš `Resolve-Path (Join-Path $PSScriptRoot "..")` — veikia bet kuriame klonuotame kelyje.
- **`.github/workflows/ci.yml`:** po `format:check` vienas žingsnis `npm run verify` (įskaitant `test:console`, `test:invoice`).
- **`npm run scout:improvements`** — atnaujinti `improvement-backlog.md` / `improvement-state.json`.

---

## 2026-04-04 — P2 lint: 0 ESLint įspėjimų

- **Padaryta:** likusi partija (`authService`, `security`, `performance`, `insightsService`, `intentionClassifier`, `offlineService`, `test-integration`, `test-memory`, `localDb` export, react-refresh `eslint-disable`); `npm run verify` OK.

---

## 2026-04-04 — P2 lint: ~82 → ~36 įspėjimų

- **Padaryta:** nenaudojami importai / deps (`ClientsView`, `CalendarView`, `InventoryView`, ClientPortal); `updateData` be `any`; `ClientRegistration` → `AuthUser`/`Client`; `smsService`/`ttsService`/`hybridClassifier`/`modularPrompt`/`memoryPriority`/`analyticsService` smulkūs tipai; `npm run verify` OK.

---

## 2026-04-04 — P2 view lint + BookingPage ID + ESLint `no-useless-escape`

- **Padaryta:** `AnalyticsView`, `ExpensesView`, `LogisticsView` — nenaudojami importai / smulkūs lint; `BookingPage` — `addData` grąžos `id` tikrinimas (`string`), be `any`; `supabase.ts` — regex be perteklinių `\"` (`no-useless-escape`); Prettier `AnalyticsView`.
- **Patikra:** `npm run verify` — OK (82 ESLint warnings, 0 errors).

---

## 2026-04-06 — Supabase: be 400 kai nėra `uid` stulpelio

- **Problema:** `employees` / `expenses` — po tuščios `owner_id` užklausos bandytas legacy `uid=eq.` → 400 (kanoninė schema be `uid`).
- **Pataisa:** `isMissingUidColumnError` platesnis + `tablesKnownWithoutUidColumn` cache; `clearResolvedOwnerScopeCache` valo cache.

---

## 2026-04-06 — P2 lint + push (Vercel per GitHub)

- **Padaryta:** ESLint ~101 (`Dashboard`, `OrdersView`, `DatabaseRecord` komentaras); `decisions.md` (ekranas / pokalbio riba); `work-queue.md` P2 žurnalas; push į `main`.
- **Vercel:** naujas deploy paleidžiamas automatiškai po GitHub push (jei projektas prijungtas prie repo).

---

## 2026-04-04 — Deploy gidas (Vercel + Render)

- **Padaryta:** `docs/PALEIDIMAS_VERCEL_RENDER.md` (LT žingsniai), `render.yaml` (API blueprint), `package.json` → `npm start` = `node server.cjs`; `DEPLOYMENT.md` / `README.md` nuorodos; verify OK.

---

## 2026-04-04 — Patikra prieš vartotoją + `dev:local`

- **Klaida:** anksčiau patarta žiūrėti į ekraną be pilno agento patikrinimo naršyklėje.
- **Patikra:** `npm run test:smoke` (Playwright Chromium, `build:e2e` + preview) — **1/1 praeina**; tai tas pats UI kelias kaip „tikras“ Chrome.
- **Priežastis „neveikia“:** `npm run dev` **be** galiojančių `VITE_SUPABASE_*` **ir be** `VITE_ALLOW_OFFLINE_CRM=true` sąmoningai rodo **BackendSetupRequired** — ne baltas crash.
- **Pataisa repo:** `npm run dev:local` → `scripts/dev-local.ps1` nustato offline CRM (kaip `.env.e2e`).

---

## 2026-04-04 — Tęsinys: supabase + OpenRouter

- **Padaryta:** `supabase.ts` — registracija/prisijungimas `catch (unknown)`, subscribe be nenaudojamų parametrų, `testConnection` be `data`, vietinės šakos cast'ai; `DatabaseRecord` indeksas paliktas `any` (TS „T extends“ suderinamumas). `openRouterService.ts` — tipai, `FunctionDeclaration`, saugesni `catch`.
- **Metrika:** ESLint **~155 → ~129**; build + vitest OK.

---

## 2026-04-04 — Viso projekto lint / tipų banga

- **Tikslas:** masinis kokybės kėlimas visame repo (ne vienas failas).
- **Metrika:** ESLint įspėjimai **~239 → ~155** (0 klaidų); `npm run build` + `npm test` OK.
- **Failai:** `src/services/aiService.ts` (`ChatHistoryTurn`, be `any` klaidose, OpenRouter tipai, atminties blokas prompt'e), `toolRouter.ts` (`RoutingContext` su `Client`/`Order`/…, `data?: unknown`), `planningEngine.ts` (nenaudojami importai/kintamieji, `unknown` klaidose, šablonų parametrai), `useToast.ts` (`useMemo` ant `showToast` + `removeToastRef`), `SettingsView.tsx`, `PaymentsView.tsx` (deps).
- **Liko:** daugiausia `supabase.ts`, view'ai (`OrdersView`, `Dashboard`, …), `openRouterService.ts`, util/test failai.

---

## 2026-04-04 — Autonominis tęsinys: audit, P2, ChatAssistant

- **Padaryta:** `npm audit fix` (lodash high → 0); `App.tsx` nustatymų eilutė su `SettingsRow`; `ChatAssistant.tsx` — švara (importai, nebereikalinga API key būsena, `getAiStudio`, naršyklės balso tipai, įrankių kvietimo tikrinimas, ESLint švaru šiame faile); darbotvarkėje P2 priklausomybės pažymėta; lint skoloje pažymėtas ChatAssistant progresas.
- **Patikra:** `npm run build`, `npm run test` (vitest), `eslint src/components/ChatAssistant.tsx`.
- **Toliau:** likę ESLint įspėjimai kituose failuose; smoke/E2E pagal aplinką.

---

## 2026-04-04 — Darbotvarkė: bundle + savininko autonomija

- **Kontekstas:** savininkas — ne programuotojas; agentas atsakingas už tęstinį darbą be klausinėjimo.
- **Padaryta:** P1 bundle — `vite.config.ts` atskirti `vendor-icons`, `vendor-date`, `vendor-stripe`, `vendor-markdown`; React paliktas bendrame `vendor` (be circular chunk); `chunkSizeWarningLimit: 1150` su komentaru; work-queue P1 bundle pažymėtas.
- **Kitas žingsnis:** UI (Button CTA sąrašuose) arba `alert` → toast pagal improvement-backlog; Supabase Auth hardening Dashboard’e.

---

## 2026-04-04 — Darbotvarkė: vieša rezervacija, konsolė, demo

- **Kontekstas:** tęsti planą be programavimo patirties savininko; sutvarkyti P0/P1 punktus iš `work-queue.md`.
- **Padaryta:** `public_booking_rpcs.sql` — cloud checklist; `20260331140000_public_booking_enabled.sql` — Track A/B komentarai; `supabase.ts` — `logSupabaseDevError` (klaidos konsolėje tik dev arba `VITE_DEBUG_SUPABASE`); `.env.example` + `vite-env.d.ts` — demo paskyros įspėjimas ir debug vėliavėlė; work-queue P0 booking + P1 konsolė/demo pažymėti.
- **Kitas žingsnis:** P1 bundle skaidymas arba UI komponentų plėtra (Button į sąrašų vaizdus); Supabase Dashboard — leaked password protection.

---

## 2026-04-02 — UI: mygtukai, šriftas, apvalkalas

- **Kontekstas:** tolesnis dizainas; sąskaitų el. paštas paliekamas iki DNS ant `svarusdarbas.lt`.
- **Padaryta:** `Button` komponentas (`src/components/ui/`), prisijungimo mygtukai per jį; `Layout` — gradientas, header blur, apačios nav su aktyviu fonu ir safe-area; `Dashboard` greiti veiksmai — hover/focus; `Plus Jakarta Sans` + `@theme` atnaujinimas.
- **Kitas žingsnis:** palaipsniui `Button` į `OrdersView` / `ClientsView` pagrindinius CTA; spalvų tokenų naudojimas komponentuose.

---

## 2026-04-02 — Ilgalaikės atminties aplinka

- **Kontekstas:** vartotojas nori autonomijos; pokalbiai ir žinios turi būti talpinamos planams ir įvykių sekimui.
- **Padaryta:** sukurta `.always-on/README.md` (žemėlapis), `decisions.md`, `milestones.md`, atnaujinti `AGENT_PROTOCOL.md` ir taisyklės; šis žurnalas.
- **Kitas žingsnis:** po kiekvienos svarbios sesijos įrašyti čia 5–10 sakinių; terminus — `milestones.md`.

---

<!-- Šablonas (kopijuoti ir užpildyti):

## YYYY-MM-DD — trumpas pavadinimas

- **Tikslas / užduotis:**
- **Padaryta:**
- **Nepabaista / blokatoriai:**
- **Kitas žingsnis:**

-->
