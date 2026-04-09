# CRM žemėlapis (agentui) — „penki pirštai“

**Atnaujinta:** 2026-04-09. Trumpas orientyras: maršrutai, komponentai, duomenų savininkas, API.

## Paleistis

- **Frontend:** Vite `5173`, API proxy į `3001` (`vite.config.ts`).
- **Backend:** `node server.cjs` — default `PORT=3001` (`/health`, `/api/*`, Stripe webhook `/webhook`).
- **Debesis:** Supabase (Auth + Postgres + Realtime); `server.cjs` naudoja service role kur reikia.

## Autentifikacija ir rolės

- **Supabase Auth**; profilis `profiles` su `role`: `admin` | `staff` | `client` (ir pan.).
- **CRM (darbuotojai):** `App.tsx` rodo `Layout` + `renderContent`, jei `userProfile.role !== 'client'`.
- **Klientų portalas:** `showClientPortal` + kelias `/client/login|register|dashboard`; maršrutas sinchronizuojamas su `history`.
- **Workspace duomenų savininkas:** `crmDataOwnerId()` (`src/utils/crmDataScope.ts`) — `workspaceOwnerId` iš profilio, kitaip `authUid`; offline režime `authUid`.

## Apatinis meniu (`Layout.tsx` `id` → view)

| `id`        | Komponentas        | Esminė paskirtis |
|------------|---------------------|------------------|
| `dashboard` | `Dashboard`        | KPI, įžvalgos, greiti veiksmai, oras |
| `orders`    | `OrdersView`       | Užsakymai, filtrai, CSV, SMS, sąskaitos |
| `calendar`  | `CalendarView`     | Mėnesio tinklelis, dienos detalė, konfliktai |
| `clients`   | `ClientsView`      | Klientai, istorija, tel/adrs nuorodos |
| `expenses`  | `ExpensesView`     | Išlaidos |
| `payments`  | `PaymentsView`     | Sąskaitos / transakcijos (`fetchPaymentsWorkspaceData`) |
| `more`      | `MoreSectionsView` | Hub → Analitika, Logistika, Komanda, Inventorius |
| `settings`  | `SettingsView`     | Kainos, booking, server health, atmintis |

**„Daugiau“ vidiniai tab id:** `analytics`, `logistics`, `team`, `inventory` (tiesiogiai `setActiveTab`).

## Vieši / specialūs keliai (be apačios meniu)

- **`/booking/:ownerUid`** — `BookingPage`, vieša rezervacija (RPC `submit_public_booking`).
- **`/client/*`** — portalas; registracija gali būti išjungta nustatymuose / env.

## Realtime ir būsena

- **`App.tsx`:** `subscribeToData` — `clients`, `orders`, `expenses`, `employees`, `memories` (viena `memories` prenumerata; `ChatAssistant` gauna `memories` props).
- **Kanalas:** `crm_{table}_{dataOwnerId}` (`src/supabase/crud.ts`).

## Serverio API (`server.cjs`, santrauka)

- AI: `POST /api/ai/chat`
- El. paštas: `POST /api/send-invoice-email`, `POST /api/send-order-status-email`
- Klientas: `POST /api/client-update-phone`, `POST /api/client-service-request`, `GET /api/client-service-requests`
- Mokėjimai / sąskaitos: `POST /api/create-payment-intent`, `POST /api/generate-invoice`, `GET/PUT /api/invoices*`, `GET /api/payments`
- Cron: `POST /api/cron/process-reminders` (`CRON_SECRET`)
- Audit: `GET /api/notification-events`
- **Diag:** `GET /health`

## Supabase moduliai (barrel `src/supabase.ts`)

- `crud.ts` — CRUD + subscribe, `normalize.ts`, `ownerScope.ts`, `booking.ts`, `authSession.ts`, …

## Žinomos rizikos (žr. `known-issues.md`)

- **KI-005:** rekursija `workspace_memberships` — taikyti migraciją `20260409210000_workspace_memberships_rls_break_recursion.sql`; UI vis tiek naudoja `sanitizeSupabaseErrorForDisplay`.
