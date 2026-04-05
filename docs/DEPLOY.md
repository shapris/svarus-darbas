# Deploy ir paleidimas — nuo ko pradėti

Vienas įėjimo taškas: **kur skaityti**, ne dubliuoti tą patį trijuose failuose.

## 1. Vietinis kūrimas (jūsų kompiuteris)

- **Instrukcijos:** root [`README.md`](../README.md) → skyrius **Paleidimas** ir **Sąskaitos PDF**.
- **Aplinka:** [`../.env.example`](../.env.example); **matrica (B/N, Vite vs serveris):** [`env-matrix.md`](env-matrix.md).
- **Patikra:** `npm run check:env`, `npm run check:cloud` prieš cloud.

## 2. Pirmas deploy į debesį (Vercel + Render + Supabase)

- **Pilnas žingsnis po žingsnio (LT):** [`PALEIDIMAS_VERCEL_RENDER.md`](PALEIDIMAS_VERCEL_RENDER.md) — paskyros, kintamieji, eiliškumas, patikra prieš „1.0“.
- **Repo failai:** `vercel.json`, `render.yaml`, `npm start` → `server.cjs`.

## 3. Techninė santrauka ir triktis

- **Anglų k. referencas:** root [`DEPLOYMENT.md`](../DEPLOYMENT.md) — architektūra, būtini raktai (santrauka), `verify` / `check:cloud`, troubleshooting.
- **SQL kanonas:** `supabase/production_owner_id_schema.sql`, pasirinktinai `supabase/public_booking_rpcs.sql` (žr. SQL antraštes ir `DEPLOYMENT.md`).

## 4. Kokybė prieš release

**Gamybinis sąrašas (automatinė + rankinė):** [`PRODUCTION_CHECKLIST.md`](PRODUCTION_CHECKLIST.md).

**Vercel / Render env sutapimas ir known gaps:** [`VERCEL_RENDER_ENV_PARITY.md`](VERCEL_RENDER_ENV_PARITY.md).

```bash
npm run verify
npm run check:cloud
node --check server.cjs
```

CI: [`.github/workflows/ci.yml`](../.github/workflows/ci.yml) — po Prettier vykdoma `npm run verify`.

## 5. Kita dokumentacija (P4)

| Failas                                               | Turinys                                       |
| ---------------------------------------------------- | --------------------------------------------- |
| [`MIGRATIONS_POLICY.md`](MIGRATIONS_POLICY.md)       | Migracijos vs SQL Editor, breaking pakeitimai |
| [`RLS_SUMMARY.md`](RLS_SUMMARY.md)                   | Lentelės → RLS esmė                           |
| [`BACKUP_AND_OPS.md`](BACKUP_AND_OPS.md)             | Supabase backup / PITR nuorodos               |
| [`PERIODIC_MAINTENANCE.md`](PERIODIC_MAINTENANCE.md) | Mėnesio / ketvirčio procesas                  |
| [`STRIPE_TESTING.md`](STRIPE_TESTING.md)             | Stripe rankinė QA                             |
| [`CLIENT_PORTAL_MVP.md`](CLIENT_PORTAL_MVP.md)       | Portalo MVP apimtis                           |
| [`BUNDLE_ANALYSIS.md`](BUNDLE_ANALYSIS.md)           | `npm run build:analyze`                       |
| [`UX_EMPTY_STATES.md`](UX_EMPTY_STATES.md)           | Tuščių būsenų šablonas                        |
