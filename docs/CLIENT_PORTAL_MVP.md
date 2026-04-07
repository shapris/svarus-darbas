# Klientų portalas — MVP apimtis

**MVP (minimalus naudingas rinkinys):**

1. Prisijungimas el. paštu / slaptažodžiu (arba invite).
2. Užsakymų sąrašas ir būsena (skaitymui).
3. Registracija / atkūrimas — tik jei įjungta `VITE_CLIENT_SELF_REGISTRATION` ir Supabase Auth sutvarkytas (redirect URL).

**Savitarna (po MVP):**

- Telefono numerio atnaujinimas portale (`POST /api/client-update-phone`, įrašas į `clients.phone`).
- Skirtukas **Savitarna:** prašymai (laiko keitimas, atšaukimas, kita) — auditas `notification_events` (`channel: portal`), pasirinktinai el. laiškas administratoriui (`ADMIN_NOTIFY_EMAIL`).

**Ne MVP (tolimesnė plėtra):** tiesioginis užsakymo redagavimas be administratoriaus; viskas, kas reikalauja verslo taisyklių ir papildomų RLS politikos — laikyti už aiškaus poreikio. Techniniai entry: [`src/views/ClientPortal/`](../src/views/ClientPortal/), [`docs/DEPLOY.md`](DEPLOY.md).
