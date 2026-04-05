# Gamybinė patikra (prieš „1.0“)

Vienas sąrašas: **automatinė** patikra terminale + **rankinė** patikra hostinge (DNS, HTTPS, Auth, Stripe, Render).

**Kontekstas:** [`DEPLOY.md`](DEPLOY.md) → žingsniai ir hierarchija; kintamieji — [`env-matrix.md`](env-matrix.md); pirmas deploy LT — [`PALEIDIMAS_VERCEL_RENDER.md`](PALEIDIMAS_VERCEL_RENDER.md). Režimas ir pardavimo šablonas — [`LAUNCH_AND_SALES_NEXT_STEPS.md`](LAUNCH_AND_SALES_NEXT_STEPS.md).

---

## 1. Automatinė patikra (repo)

Paleiskite iš projekto šaknies:

```bash
npm run verify
npm run check:cloud
node --check server.cjs
```

**Tik Vercel statinis CRM** (be API `.env` šiame kompiuteryje): `npm run check:cloud:frontend` — nevertina `server.cjs` / service role. Prieš pilną 1.0 vis tiek paleiskite `check:cloud` su API aplinka arba įrašykite trūkstamus laukus į šakninį `.env`.

### Ką daro `npm run check:cloud`

Skriptas: [`scripts/cloud-readiness-check.mjs`](../scripts/cloud-readiness-check.mjs). Jis žiūri **šaknies `.env`** ir (jei nustatyta) proceso aplinkos kintamuosius.

| Sekcija                | Esmė                                                                                                                                            |
| ---------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------- |
| Frontend               | Privaloma: `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`. Kiti `VITE_*` — WARN jei tušti.                                                       |
| Backend (`server.cjs`) | `RESEND_*`, `SUPABASE_URL` / `SUPABASE_ANON_KEY` (arba `VITE_*` analogai), **`SUPABASE_SERVICE_ROLE_KEY`**, `FRONTEND_URL` arba `CORS_ORIGINS`. |
| Saugumas               | Perspėjimai: `onboarding@resend.dev`, `VITE_STRIPE_SECRET_KEY` kliente.                                                                         |
| Schema / mokėjimai     | INFO: kanoninis SQL kelias, service role būtinybė DB-backed mokėjimams.                                                                         |

- Išėjimas **0** — „READY“ (kietų trūkumų nėra).
- Išėjimas **2** — trūksta bent vieno privalomo lauko (žr. `MISS` eilutes).

**Pastaba:** lokaliame kompiuteryje `.env` gali skirtis nuo Vercel/Render — prieš release arba **sinchronizuokite `.env` su gamybiniais pavadinimais** ir paleiskite `check:cloud`, arba eikite per žemiau esančią rankinę lentelę hostinge.

---

## 2. Rankinė patikra (DNS, HTTPS, Supabase, Stripe, Render)

### DNS ir domenas

- [ ] Jei naudojate **custom domain** (Vercel / Render) — DNS įrašai propagavę pagal hostingo vedlį.
- [ ] Vienas aiškus **kanoninis** CRM URL (vengti dviejų skirtingų domenų be redirect).

### HTTPS

- [ ] Naršyklėje rodo saugų ryšį (`https://`), nėra mixed content (frontend kviečia API per `https://`).

### Supabase — Authentication URL

- [ ] **Authentication → URL Configuration:** `Site URL` = jūsų CRM frontendo bazinis URL (pvz. `https://....vercel.app` arba custom).
- [ ] **Redirect URLs** įtraukia visus leistinus callback URL (magic link, slaptažodžio atkūrimas, OAuth) — [Supabase redirect URLs](https://supabase.com/docs/guides/auth/redirect-urls).
- [ ] El. pašto šablonai / invite nuorodos (jei keisti) neveda į `localhost` produkcijoje.

### Stripe webhook (API hoste, pvz. Render)

- [ ] Stripe Dashboard → Developers → Webhooks: endpoint **`https://<jūsų-api-host>/webhook`** (POST, **raw** JSON body — kaip sukonfigūruota `server.cjs`).
- [ ] Užsiprenumeruoti bent **`payment_intent.succeeded`** (ir pageidautina **`payment_intent.payment_failed`** — apdorojama serveryje).
- [ ] Render (ar kitas API hostas): `STRIPE_WEBHOOK_SECRET` sutampa su Stripe **Signing secret**.
- [ ] `STRIPE_SECRET_KEY` tik serveryje — **ne** `VITE_*` Vercel (`check:cloud` perspės, jei klaidingai įdėta).

### Render — health ir deploy

- [ ] `GET https://<api-host>/health` grąžina JSON su `status` ir `invoiceEmail` (blueprint: [`render.yaml`](../render.yaml) → `healthCheckPath: /health`).
- [ ] Paskutinis deploy **Live**, loguose nėra nuolatinio crash/restart ciklo.

### Kryžminė env patikra

- [ ] Vercel: `VITE_INVOICE_API_BASE_URL` = Render API bazinis URL **be** kelio pabaigos `/`.
- [ ] Render: `FRONTEND_URL` arba `CORS_ORIGINS` tiksliai sutampa su CRM URL (įskaitant `https://`).

### Resend (sąskaitos el. paštas)

- [ ] `RESEND_FROM_EMAIL` gamyboje — patvirtintas domenas / gamybinis siuntėjas (ne `onboarding@resend.dev`).

### Duomenų bazės schema

- [ ] SQL kanonas: [`supabase/production_owner_id_schema.sql`](../supabase/production_owner_id_schema.sql); vieša rezervacija — [`supabase/public_booking_rpcs.sql`](../supabase/public_booking_rpcs.sql) jei naudojate tą funkciją.
- [ ] Greita SQL patikra (Supabase SQL Editor) — kaip išveda `check:cloud` sekcijoje „Supabase schema track“.

---

## 3. Funkcinė dūmų patikra (po deploy)

- [ ] Prisijungimas į CRM su tikra paskyra.
- [ ] Užsakymai / klientai kraunasi iš Supabase.
- [ ] Viena bandomoji sąskaitos siuntimo ar mokėjimo operacija (jei naudojate Resend / Stripe).

Po šito etapo tinka žyma release / komunikacija komandai. Žr. taip pat [LAUNCH_AND_SALES_NEXT_STEPS.md](LAUNCH_AND_SALES_NEXT_STEPS.md) §2.3 ir root [CHANGELOG.md](../CHANGELOG.md) prieš viešą **v1.0.0** komunikaciją.
