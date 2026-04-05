# Pirmas paleidimas: Vercel (puslapis) + Render (API)

**Visų deploy dokumentų žemėlapis:** [`DEPLOY.md`](DEPLOY.md).  
Šiame faile — **pilnas LT žingsnis po žingsnio** pirmam debesies paleidimui. Techninė santrauka (EN) ir triktis: root [`DEPLOYMENT.md`](../DEPLOYMENT.md).

---

## Ką jau paruošta projekte

- `vercel.json` — statinis build (`dist`), SPA maršrutai.
- `render.yaml` — Render API serviso šablonas (`npm ci` → `npm start` → `/health`).
- `package.json` → skriptas **`npm start`** = `node server.cjs` (Render / Railway supranta).

---

## Tavo pusė (be kodo)

1. **Paskyros:** [Vercel](https://vercel.com), [Render](https://render.com), [Supabase](https://supabase.com) (DB jau gali būti).
2. **GitHub:** repo su kodu prijungtas prie Vercel ir (pasirinktai) Render.
3. **Raktų kopijavimas:** iš Supabase (Settings → API), Resend, Stripe (jei naudosi) — **niekam neatsiųsk pilnų raktų pokalbyje**; įkelti tik į hostingo „Environment Variables“.

---

## 1. Supabase (jei dar ne „gamyba“)

1. SQL Editor: `supabase/production_owner_id_schema.sql`.
2. Jei reikia viešos rezervacijos: `supabase/public_booking_rpcs.sql`.
3. Authentication → įjungti **Email** prisijungimą.

---

## 2. Vercel — frontend (CRM naršyklėje)

1. **New Project** → importuok šį GitHub repo.
2. **Framework:** Vite (dažnai atpažįsta automatiškai). Build: `npm run build`, output: `dist`.
3. **Environment Variables** (Production):

   | Kintamasis                                        | Kur paimti                                                                                    |
   | ------------------------------------------------- | --------------------------------------------------------------------------------------------- |
   | `VITE_SUPABASE_URL`                               | Supabase → Project Settings → API                                                             |
   | `VITE_SUPABASE_ANON_KEY`                          | Ten pat → anon public                                                                         |
   | `VITE_GEMINI_API_KEY` / `VITE_OPENROUTER_API_KEY` | Jei naudoji AI                                                                                |
   | `VITE_STRIPE_PUBLISHABLE_KEY`                     | Jei naudoji Stripe checkout iš naršyklės                                                      |
   | `VITE_INVOICE_API_BASE_URL`                       | **Po 3 žingsnio** — pilnas Render API URL, pvz. `https://xxx.onrender.com` (be `/` pabaigoje) |

4. **Deploy.** Užsirašyk galutinį adresą, pvz. `https://tavo-crm.vercel.app`.

---

## 3. Render — API (`server.cjs`)

1. **New** → **Web Service** → tas pats repo (arba **Blueprint** iš `render.yaml`).
2. **Root directory:** repo šaknis (kur `server.cjs` ir `package.json`).
3. **Build command:** `npm ci`
4. **Start command:** `npm start`
5. **Health check path:** `/health`
6. **Node:** 20.x (Environment arba `NODE_VERSION`).

7. **Environment** (bent minimalus sąskaitų + auth keliui):

   | Kintamasis                                   | Paskirtis                                                            |
   | -------------------------------------------- | -------------------------------------------------------------------- |
   | `SUPABASE_URL`                               | Tas pats URL kaip `VITE_SUPABASE_URL`                                |
   | `SUPABASE_ANON_KEY`                          | Anon raktas (JWT tikrinimui)                                         |
   | `SUPABASE_SERVICE_ROLE_KEY`                  | **Būtina** ilgalaikiams invoices / mokėjimams DB (žr. DEPLOYMENT.md) |
   | `RESEND_API_KEY`                             | Automatinis sąskaitos el. paštas                                     |
   | `RESEND_FROM_EMAIL`                          | Siuntėjas (Resend / patvirtintas domenas)                            |
   | `FRONTEND_URL`                               | Tavo Vercel URL, pvz. `https://tavo-crm.vercel.app`                  |
   | arba `CORS_ORIGINS`                          | Tas pats URL (galima keli per kablelį)                               |
   | `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET` | Jei Stripe                                                           |

8. **Deploy.** Nukopijuok viešą API adresą į Vercel kaip `VITE_INVOICE_API_BASE_URL` ir padaryk **Redeploy** frontendui.

---

## 4. Patikra prieš „1.0 gyvai“

- [ ] Vercel atsidaro, prisijungi su tikra paskyra.
- [ ] Užsakymai / klientai kraunasi (Supabase).
- [ ] `https://TAVO-API.onrender.com/health` naršyklėje rodo JSON (`status`, `invoiceEmail`).
- [ ] Viena sąskaitos / el. pašto bandomoji operacija (jei naudoji Resend).

Repo terminale (prieš taginant release):

```bash
npm run verify
npm run check:cloud
```

---

## Jei kažkas neveikia

- **CORS klaidos** — `CORS_ORIGINS` arba `FRONTEND_URL` turi tiksliai sutapti su Vercel adresu (įskaitant `https://`).
- **Sąskaitos neišsiunčia** — Render logai + ar `RESEND_*` ir ar `invoiceEmail: true` iš `/health`.
- **Stripe duomenys dingsta po restart** — trūksta `SUPABASE_SERVICE_ROLE_KEY` arba mokėjimų lentelių schemoje.

Daugiau: root [`DEPLOYMENT.md`](../DEPLOYMENT.md) (triktis, architektūra) ir [`DEPLOY.md`](DEPLOY.md).
