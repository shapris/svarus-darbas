# Švarus Darbas CRM Deployment

**Pirmas kartas be idėjos, kur hostinti?** Žr. lietuvišką žingsnis po žingsnio gidą: [`docs/PALEIDIMAS_VERCEL_RENDER.md`](docs/PALEIDIMAS_VERCEL_RENDER.md).

## Recommended Architecture

Naudokite vieną rekomenduojamą produkcinį kelią:

1. Frontend: Vercel (`dist` iš `npm run build`)
2. API: atskiras Node hostas `server.cjs` (`Render`, `Railway`, VPS ar pan.)
3. DB/Auth: Supabase
4. Schema: `supabase/production_owner_id_schema.sql`
5. Public booking RPC: `supabase/public_booking_rpcs.sql`

Legacy `uid + quoted camelCase` schema kelias paliktas tik suderinamumui. Jo nemaišykite su kanoniniu `owner_id + snake_case` setup.

## Step By Step

### 1. Supabase

1. Sukurkite naują Supabase projektą.
2. SQL Editor paleiskite `supabase/production_owner_id_schema.sql`.
3. Jei reikia viešos rezervacijos, papildomai paleiskite `supabase/public_booking_rpcs.sql`.
4. Įjunkite `Email` providerį per `Authentication -> Providers`.

### 2. Frontend Hosting

Vercel aplinkoje nustatykite bent:

- `VITE_SUPABASE_URL`
- `VITE_SUPABASE_ANON_KEY`
- `VITE_OPENROUTER_API_KEY` arba `VITE_GEMINI_API_KEY` jei naudojate AI
- `VITE_STRIPE_PUBLISHABLE_KEY` jei naudojate Stripe

Jei norite nurodyti atskirą sąskaitų API hostą frontendui, naudokite `VITE_INVOICE_API_BASE_URL` arba įveskite jį CRM nustatymuose.

### 3. API Hosting (`server.cjs`)

API hoste nustatykite:

- `SUPABASE_URL` arba `VITE_SUPABASE_URL`
- `SUPABASE_ANON_KEY` arba `VITE_SUPABASE_ANON_KEY`
- `SUPABASE_SERVICE_ROLE_KEY`
- `RESEND_API_KEY`
- `RESEND_FROM_EMAIL`
- `RESEND_FROM_NAME`
- `STRIPE_SECRET_KEY`
- `STRIPE_WEBHOOK_SECRET`
- `FRONTEND_URL` arba `CORS_ORIGINS`

Svarbu:

- `SUPABASE_SERVICE_ROLE_KEY` dabar reikalingas tam, kad `invoices`, `payment_intents` ir `transactions` būtų saugomi DB kaip ilgalaikis tiesos šaltinis.
- Be jo `server.cjs` pereina į laikiną in-memory fallback, kuris netinka produkcijai.

### 4. Verification

Prieš release paleiskite:

```bash
npm run verify
npm run check:cloud
node --check server.cjs
```

(`verify` = lint, build, unit, smoke, konsolės ir `/health` Playwright testai.)

## Production Notes

- Frontend deploy'uokite iš to paties repo; CI workflow `.github/workflows/ci.yml` jau paleidžia lint, build, Vitest ir Playwright smoke.
- `vite.config.ts` chunk'ai jau atskirti į `vendor`, `vendor-pdf`, `vendor-ai`, `vendor-maps`, `vendor-motion`, tačiau pagrindinis `vendor` chunk vis dar didelis. Sekite build perspėjimus prieš didesnius release.
- Kliento portalo saviregistracija debesies režime šiuo metu išjungta; vieša rezervacija veikia per booking nuorodą, o portalo paskyras reikia aktyvuoti kontroliuojamai.

## Troubleshooting

### `check:cloud` rodo `SUPABASE_SERVICE_ROLE_KEY`

Tai ne klaidingas perspėjimas. Finansų API po šio refaktoriaus remiasi DB-backed įrašais, todėl serveriui reikia service-role rakto.

### Playwright smoke nepraeina lokaliai

1. Paleiskite `npm run build`.
2. Įsitikinkite, kad `npx playwright install chromium` jau paleistas bent kartą.
3. Vykdykite `npm run test:smoke`.

### Stripe / invoice history dingsta po restart

Tai reiškia, kad API hoste trūksta `SUPABASE_SERVICE_ROLE_KEY` arba mokėjimų lentelės neįdiegtos pagal kanoninę schemą.
