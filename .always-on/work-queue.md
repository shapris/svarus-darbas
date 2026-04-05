# Nuolatinė darbotvarkė (agentui ir komandai)

**Tikslas:** kai nėra konkrečios vartotojo užduoties arba prašoma tik „tęsk / dirbk toliau“, vykdyti **pirmą nepažymėtą** punktą pagal **P0 → P1** eilę, iki galo su patikra, tada čia pažymėti atlikta ir data.

## Kaip vykdyti (kiekviena sesija)

1. Perskaityti šį failą ir rasti pirmą `- [ ]` **P0** bloke; jei visi P0 atlikti — **P1**; jei ir P1 tuščią / uždaryta — **P2**.
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

*(Agentai: pridėkite eilutę kiekvieną kartą, kai uždarote eilės punktą.)*
