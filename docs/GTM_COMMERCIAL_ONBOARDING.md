# Go-to-market: komercinis pasiūlymas + kliento onboardingas

Vienas kanoninis šaltinis pardavimui ir įvedimui. Detalėms žr. [CHANGELOG.md](../CHANGELOG.md) [1.0.0], [CLIENT_PORTAL_MVP.md](CLIENT_PORTAL_MVP.md), [PRODUCTION_CHECKLIST.md](PRODUCTION_CHECKLIST.md).

---

## 1. Kas įeina į produktą (užpildyta pagal dabartinę 1.0 apimtį)

### 1.1 CRM (darbuotojams)

- Klientų kortelės ir istorija, užsakymai (sąrašas, forma, filtrai, CSV eksportas pagal filtrus)
- Kalendorius, analitika, inventorius, komanda, išlaidos, nustatymai
- **Verslo KPI skydelis:** pagrindiniai rodikliai skaičiuojami iš užsakymų („Skydelis“ / Dashboard)
- AI asistentas (Gemini / OpenRouter), PWA, offline / demo režimas (`VITE_ALLOW_OFFLINE_CRM`)

### 1.2 Klientų portalas

- Prisijungimas, maršrutai `/client/login`, `/client/register`, `/client/dashboard`
- Užsakymų ir mokėjimų matomumas, savitarna (kontaktinio telefono atnaujinimas, prašymai administracijai)
- Admin valdoma saviregistracija ir kliento pranešimų įjungimas (nustatymai)

### 1.3 Mokėjimai ir sąskaitos

- Stripe integracija (kai sukonfigūruota), sąskaitų PDF ir siuntimas per Resend (`server.cjs`)
- Mokėjimų istorija portale

### 1.4 Pranešimai ir atsekamumas

- El. paštu: užsakymo būsenos keitimas, priminimų eilė (cron / worker)
- Auditas: `notification_events` (kas išsiųsta, būsena, klaida)
- Diagnostika: `/health` (įskaitant priminimų ir šablonų versijos laukus, kai API pasiekiamas)

### 1.5 Sauga ir duomenys

- Supabase Auth, RLS, workspace modelis (`effective_workspace_owner_id`)
- Aplinkos matrica: [env-matrix.md](env-matrix.md)

---

## 2. Onboarding seka (naujam klientui / pilotui)

1. **Režimas:** pasirinkite A / B / C pagal [LAUNCH_AND_SALES_NEXT_STEPS.md §1](LAUNCH_AND_SALES_NEXT_STEPS.md).
2. **Hostingas:** Vercel (CRM) + Render arba VPS (API); užpildyti env pagal [env-matrix.md](env-matrix.md) ir [VERCEL_RENDER_ENV_PARITY.md](VERCEL_RENDER_ENV_PARITY.md).
3. **Supabase:** Auth redirect URL, SQL migracijos / schema, RLS patikra — [DATABASE_SETUP.md](../DATABASE_SETUP.md), [RLS_SUMMARY.md](RLS_SUMMARY.md).
4. **Stripe + Resend (jei naudojate):** raktai tik serveryje; Resend domenas gamyboje — ne `onboarding@resend.dev`.
5. **Priminimai:** nustatyti `CRON_SECRET` ir išorinį cron (pvz. Render) į `POST /api/cron/process-reminders` arba `ENABLE_REMINDER_WORKER=true` — [env-matrix.md](env-matrix.md).
6. **Vartai prieš „gyvai“:** `npm run verify`, `npm run check:cloud`, `node --check server.cjs`; rankinė checklist [PRODUCTION_CHECKLIST.md](PRODUCTION_CHECKLIST.md).
7. **Mokymai (30–60 min):** prisijungimas, naujas klientas + užsakymas, kalendorius, portalas (testinis kliento vaidmuo), viena bandomoji sąskaita / mokėjimas (jei įjungta).

---

## 3. Komercinio pasiūlymo šablonas (kopijuoti į pasiūlymą)

- **Produktas:** „Švarus darbas“ CRM + klientų portalas + (pasirinktinai) mokėjimai ir automatizuoti pranešimai — apimtis kaip §1.
- **Pristatymas:** debesų diegimas pagal repo dokumentaciją; duomenų izoliacija per Supabase RLS.
- **Kaina ir terminas:** [įrašykite pagal sutartį].
- **Palaikymas:** atsakymo laikas ir ribūs — [įrašykite]; incidentams žr. [RUNBOOK_INCIDENTS.md](RUNBOOK_INCIDENTS.md).
- **Rizikos nuoroda:** be tinkamo `SUPABASE_SERVICE_ROLE_KEY` API hoste mokėjimų / sąskaitų istorija gali būti neįrašoma į DB — žr. [CHANGELOG.md](../CHANGELOG.md).

---

## 4. Release rutina (kas savaitę)

- Maži PR, pilnas `npm run verify` prieš `main`.
- Po deploy: `check:cloud` su gamybiniais env; `/health` patikra API hoste.
- Klientui: trumpas changelog (kas pasikeitė elgsenoje ar UI).
