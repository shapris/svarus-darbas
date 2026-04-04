# Sesijų žurnalas (naujausia viršuje)

Įrašykite **trumpai**: data, kontekstas, rezultatas, kitas žingsnis. Agentai — po reikšmingos sesijos pridėkite naują bloką **viršuje**.

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
