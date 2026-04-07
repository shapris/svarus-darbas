# Incidentų runbook (Supabase · Stripe · pranešimai)

Trumpi veiksmai stabilumui. Detalėms: [PRODUCTION_CHECKLIST.md](PRODUCTION_CHECKLIST.md), [env-matrix.md](env-matrix.md), [docs/DEPLOY.md](DEPLOY.md).

---

## 0. Prieš pradedant

- Patikrinkite API: `GET https://<jūsų-api>/health` — `status`, `invoiceEmail`, `paymentsDb`, `reminders`.
- CRM: ar atsidaro be klaidų; naršyklės konsolė švari (`npm run test:console` CI).
- Repo: `npm run verify`, `npm run check:cloud` iš aplinkos su **gamybiniais** env.

---

## 1. Supabase

### 1.1 „Neprisijungia“ / 401 / sesija

- Supabase Dashboard → **Authentication** → URL konfigūracija (redirect, site URL).
- Ar `VITE_SUPABASE_URL` / `VITE_SUPABASE_ANON_KEY` sutampa su projektu.
- Ar API naudoja tuos pačius URL/anon raktus kaip CRM (`server.cjs` fallback į `VITE_*`).

### 1.2 „Nematau duomenų“ / tušti sąrašai

- Patikrinkite naudotojo rolę ir `workspace_owner_id` ([workspace migracija](../supabase/migrations/20260404200000_workspace_owner_team_access.sql)).
- SQL: ar `orders.owner_id` / `clients.owner_id` atitinka tikėtiną workspace savininką.
- RLS: [RLS_SUMMARY.md](RLS_SUMMARY.md) — ar politikos pritaikytos (ypač po naujų lentelių).

### 1.3 Migracija nepavyko

- SQL Editor — klaidos pranešimas; paleisti migraciją **iš eilės** nuo priklausomybių.
- Dokumentacija: [MIGRATIONS_POLICY.md](MIGRATIONS_POLICY.md), [DATABASE_SETUP.md](../DATABASE_SETUP.md).

### 1.4 Service role

- Jei mokėjimų / invoice įrašai „dingsta“ po restart: trūksta **`SUPABASE_SERVICE_ROLE_KEY`** API hoste — žr. [CHANGELOG.md](../CHANGELOG.md) ir `check:cloud` išvestį „Payments persistence“.

---

## 2. Stripe

### 2.1 Mokėjimas nepavyksta / 503

- API logai: ar `STRIPE_SECRET_KEY` tikras (ne placeholder) gamyboje.
- Stripe Dashboard → Logs.

### 2.2 Webhook neateina

- Stripe → Webhooks → endpoint URL ir `STRIPE_WEBHOOK_SECRET` ant API hosto.
- Įsitikinkite, kad URL pasiekiamas iš interneto (HTTPS).

---

## 3. Resend / el. paštas

### 3.1 Laiškai neateina

- `RESEND_API_KEY`, `RESEND_FROM_EMAIL` ant **serverio** (ne Vercel `VITE_*`).
- Resend Logs: atmetimo priežastis (domenas, test limit).
- Gamyboje: patvirtintas siuntėjo domenas — ne tik `onboarding@resend.dev`.

### 3.2 Statuso laiškas po CRM veiksmo

- CRM kviečia `POST /api/send-order-status-email` — tik su galiojančiu JWT; gavėjas turi sutapti su kliento kortele.

---

## 4. Priminimų eilė ir cron

### 4.1 Priminimai nesiunčiami

- Ar API pasiekia DB su service role (`paymentsDb` true `/health`).
- Ar sukonfigūruotas `CRON_SECRET` ir išorinis scheduler kreipiasi į `POST /api/cron/process-reminders` su antraštė `x-cron-secret` arba `Authorization: Bearer`.
- Arba įjungtas `ENABLE_REMINDER_WORKER=true` (alternatyva be išorinio cron).
- `/health` → `reminders.lastRun`: paskutinio paleidimo statistika / klaida.

### 4.2 Dedupe / dublikatai

- Lentelė `notification_events` ir unique indeksas `(order_id, type, channel, recipient, scheduled_for)` — pakartotinis siuntimas toje pačioje „lizdo“ kombinacijoje neįterpiamas.

---

## 5. Eskalacija

- Jei incidentas lieka po §1–4: fiksuokite laiką, user id, `order_id`, užklausos kelią; atnaujinkite [session-log](../.always-on/session-log.md) ir pridėkite prevencijos punktą [work-queue](../.always-on/work-queue.md) jei reikia.
