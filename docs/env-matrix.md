# Aplinkos kintamųjų matrica

**Šaltinis:** repo naudojimas (`src/`, `server.cjs`, `vite.config.ts`, skriptai).  
**Pildymas:** lokaliai `.env` (šalia `package.json`); Vercel — tik `VITE_*` ir kiti vieši; Render/API — serverio kintamieji (**be** `VITE_` Stripe secret ir pan.).

Legenda: **B** = būtina tam kontekste · **N** = neprivaloma · **T** = tik kūrimui / testams.

## Frontend (Vite — patenka į naršyklės build)

| Kintamasis                      | B / N                 | Kur naudojama                                        |
| ------------------------------- | --------------------- | ---------------------------------------------------- |
| `VITE_SUPABASE_URL`             | B debesyje            | `supabase.ts`, backend setup                         |
| `VITE_SUPABASE_ANON_KEY`        | B debesyje            | `supabase.ts`                                        |
| `VITE_ALLOW_OFFLINE_CRM`        | N                     | Vietinis CRM be Supabase (`supabase.ts`)             |
| `VITE_DEMO_MODE`                | N                     | Alias offline režimui (`supabase.ts`)                |
| `VITE_CLIENT_SELF_REGISTRATION` | N                     | Klientų portalo registracija debesyje                |
| `VITE_DEBUG_SUPABASE`           | T                     | Papildomi Supabase logai konsolėje                   |
| `VITE_GEMINI_API_KEY`           | N                     | AI, TTS, įžvalgos (`App.tsx`, `geminiEnv`, insights) |
| `VITE_OPENROUTER_API_KEY`       | N                     | AI chat (`App.tsx` → localStorage seed)              |
| `VITE_GOOGLE_MAPS_API_KEY`      | N                     | Adreso autocomplete (`ClientAddressAutocomplete`)    |
| `VITE_STRIPE_PUBLISHABLE_KEY`   | N                     | Mokėjimai naršyklėje (`paymentService`)              |
| `VITE_INVOICE_API_BASE_URL`     | N prod su atskiru API | Sąskaitų serverio bazinis URL (`utils.ts`)           |

## Backend (`server.cjs` — Node, Render / VPS)

| Kintamasis                     | B / N                    | Kur naudojama                                                                                                  |
| ------------------------------ | ------------------------ | -------------------------------------------------------------------------------------------------------------- |
| `PORT`                         | N (default 3001)         | HTTP portas                                                                                                    |
| `NODE_ENV`                     | N                        | `production` įspėjimai (Stripe placeholder)                                                                    |
| `SUPABASE_URL`                 | B\*                      | JWT / DB (`server.cjs`)                                                                                        |
| `SUPABASE_ANON_KEY`            | B\*                      | JWT tikrinimas                                                                                                 |
| `SUPABASE_SERVICE_ROLE_KEY`    | B gamyboje               | Invoices / mokėjimai DB (ne in-memory)                                                                         |
| `RESEND_API_KEY`               | B el. paštui             | Sąskaitų siuntimas, `/health.invoiceEmail`                                                                     |
| `RESEND_FROM_EMAIL`            | B el. paštui             | Siuntėjas                                                                                                      |
| `RESEND_FROM_NAME`             | N                        | Rodomas vardas                                                                                                 |
| `FRONTEND_URL`                 | B\*\*                    | CORS (alternatyva žemiau)                                                                                      |
| `CORS_ORIGINS`                 | B\*\*                    | Leidžiami origin'ai (kableliais)                                                                               |
| `STRIPE_SECRET_KEY`            | N Stripe                 | Mokėjimų API                                                                                                   |
| `STRIPE_WEBHOOK_SECRET`        | N Stripe webhook         | `constructEvent`                                                                                               |
| `CRON_SECRET`                  | N (B jei naudojate cron) | `POST /api/cron/process-reminders` — `x-cron-secret` arba `Authorization: Bearer`; be jo endpoint grąžina 503. |
| `ENABLE_REMINDER_WORKER`       | N                        | `true` — fone kelias `processReminderQueue` (serveryje)                                                        |
| `REMINDER_WORKER_INTERVAL_MS`  | N (default serveryje)    | Priminimų workerio intervalas ms (`server.cjs`)                                                                |
| `ADMIN_NOTIFY_EMAIL`           | N                        | Portalo savitarnos prašymai — kopija administratoriui per Resend (jei `RESEND_API_KEY`).                       |
| `NOTIFICATION_TEMPLATE_FOOTER` | N (default `true`)       | `false` — nepridedama techninė `Template: …` eilutė transakciniuose laiškuose.                                 |

\*Galima naudoti `VITE_SUPABASE_URL` / `VITE_SUPABASE_ANON_KEY` kaip fallback tą patį reikšmę API hoste (žr. `server.cjs`).  
\*\* Bent vienas iš `FRONTEND_URL` arba `CORS_ORIGINS` (`check:cloud`).

## Tik kūrimas / įrankiai (ne produkcijos logika)

| Kintamasis          | Kur                                      |
| ------------------- | ---------------------------------------- |
| `DISABLE_HMR`       | `vite.config.ts` (HMR išjungimas)        |
| `VITE_OPEN_BROWSER` | `vite.config.ts` (neatidaryti naršyklės) |
| `CI`                | `vite.config.ts` (preview/open)          |

## Dokumentuota `.env.example`, bet app minimaliai / nenaudojama

| Kintamasis   | Pastaba                        |
| ------------ | ------------------------------ |
| `SENDGRID_*` | Placeholder būsimam naudojimui |
| `TWILIO_*`   | Placeholder SMS                |

## Saugumas

- **`STRIPE_SECRET_KEY`, `SUPABASE_SERVICE_ROLE_KEY`, `RESEND_API_KEY`** — tik serverio aplinkoje, **niekada** Vercel `VITE_*`.
- Jei `check:cloud` perspėja apie `VITE_STRIPE_SECRET_KEY` — pašalinti; secret neturi būti kliente.

## Hostingo sutapimas

- Vercel + Render env kontraktas ir **known gaps:** [`VERCEL_RENDER_ENV_PARITY.md`](VERCEL_RENDER_ENV_PARITY.md).

## Playwright debesies smoke (`npm run test:cloud`)

- Šablonas: **`.env.cloud-e2e.example`** → nukopijuokite į **`.env.cloud-e2e.local`** (nepridedamas į git) su tikrais `VITE_SUPABASE_URL` ir `VITE_SUPABASE_ANON_KEY`.
- Build naudoja režimą `cloud-e2e` (`VITE_ALLOW_OFFLINE_CRM=false`), kad naršyklėje būtų tikras Supabase klientas.
- **GitHub Actions:** repository **Variables** — `CLOUD_E2E_ENABLED` = `true`; **Secrets** — `CLOUD_VITE_SUPABASE_URL`, `CLOUD_VITE_SUPABASE_ANON_KEY` (tinka testiniam Supabase projektui).

## Patikros

```bash
npm run check:env    # .env VITE Supabase arba offline
npm run check:cloud  # pilnesnis cloud checklist (žr. scripts/cloud-readiness-check.mjs)
```
