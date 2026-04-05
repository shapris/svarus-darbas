# Švarus Darbas CRM — deployment (techninė santrauka)

**Navigacija:** visų deploy šaltinių hierarchija — [`docs/DEPLOY.md`](docs/DEPLOY.md).  
**Pirmas kartas LT (žingsnis po žingsnio):** [`docs/PALEIDIMAS_VERCEL_RENDER.md`](docs/PALEIDIMAS_VERCEL_RENDER.md).

## Architecture

1. **Frontend:** Vercel arba bet kuris static host (`npm run build` → `dist`).
2. **API:** atskiras Node procesas — root `server.cjs` (`npm start`; žr. `render.yaml`).
3. **DB / Auth:** Supabase.
4. **Schema:** `supabase/production_owner_id_schema.sql`; viešai rezervacijai — `supabase/public_booking_rpcs.sql`.

Legacy `uid + quoted camelCase` schema palikta suderinamumui; su kanoniniu `owner_id + snake_case` **nemaišykite** tame pačiame projekte.

## Environment variables (santrauka)

Pilnos lentelės ir eiliškumas: **tik** [`docs/PALEIDIMAS_VERCEL_RENDER.md`](docs/PALEIDIMAS_VERCEL_RENDER.md) (Vercel + Render skyriai).

| Kur                    | Esminiai                                                                                                                                                                   |
| ---------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Frontend**           | `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`; AI / Stripe / `VITE_INVOICE_API_BASE_URL` pagal funkcijas                                                                   |
| **API (`server.cjs`)** | `SUPABASE_*` arba `VITE_SUPABASE_*`, **`SUPABASE_SERVICE_ROLE_KEY`** (būtina invoices/mokėjimams DB), `RESEND_*`, `FRONTEND_URL` arba `CORS_ORIGINS`, Stripe jei naudojate |

**Svarbu:** be `SUPABASE_SERVICE_ROLE_KEY` serveris gali naudoti in-memory fallback — **netinka produkcijai** (žr. troubleshooting).

## Verification

```bash
npm run verify
npm run check:cloud
node --check server.cjs
```

## Production notes

- CI: `.github/workflows/ci.yml` — `format:check` + `npm run verify`.
- `vite.config.ts` vendor chunk’ai — pagrindinis `vendor` vis dar didelis; sekite build išvestį prieš didelius release.
- Klientų portalo saviregistracija debesyje kontroliuojama env; vieša rezervacija — per `/booking/...`.

## Troubleshooting

### `check:cloud` ir `SUPABASE_SERVICE_ROLE_KEY`

Tai tikėtina: finansų API remiasi DB-backed įrašais — service role būtinas.

### Playwright smoke lokaliai

`npm run build`, `npx playwright install chromium`, tada `npm run test:smoke`.

### Stripe / invoice istorija dingsta po restart

Trūksta `SUPABASE_SERVICE_ROLE_KEY` arba mokėjimų lentelių pagal kanoninę schemą.

### CORS

`CORS_ORIGINS` / `FRONTEND_URL` turi sutapti su tikru frontend URL (`https://...`).
