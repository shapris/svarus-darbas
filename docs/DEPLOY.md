# Deploy ir paleidimas — nuo ko pradėti

Vienas įėjimo taškas: **kur skaityti**, ne dubliuoti tą patį trijuose failuose.

## 1. Vietinis kūrimas (jūsų kompiuteris)

- **Instrukcijos:** root [`README.md`](../README.md) → skyrius **Paleidimas** ir **Sąskaitos PDF**.
- **Aplinka:** [`../.env.example`](../.env.example) → `npm run check:env`, `npm run check:cloud` prieš cloud.

## 2. Pirmas deploy į debesį (Vercel + Render + Supabase)

- **Pilnas žingsnis po žingsnio (LT):** [`PALEIDIMAS_VERCEL_RENDER.md`](PALEIDIMAS_VERCEL_RENDER.md) — paskyros, kintamieji, eiliškumas, patikra prieš „1.0“.
- **Repo failai:** `vercel.json`, `render.yaml`, `npm start` → `server.cjs`.

## 3. Techninė santrauka ir triktis

- **Anglų k. referencas:** root [`DEPLOYMENT.md`](../DEPLOYMENT.md) — architektūra, būtini raktai (santrauka), `verify` / `check:cloud`, troubleshooting.
- **SQL kanonas:** `supabase/production_owner_id_schema.sql`, pasirinktinai `supabase/public_booking_rpcs.sql` (žr. SQL antraštes ir `DEPLOYMENT.md`).

## 4. Kokybė prieš release

```bash
npm run verify
npm run check:cloud
node --check server.cjs
```

CI: [`.github/workflows/ci.yml`](../.github/workflows/ci.yml) — po Prettier vykdoma `npm run verify`.
