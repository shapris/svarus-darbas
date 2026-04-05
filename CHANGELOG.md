# Changelog

Naujausia versija visada **viršuje**. Semantinį versijavimą atitinka [`package.json`](package.json).

## [1.0.0] - 2026-04-06

Pirmasis stabilios linijos žymėjimas. `package.json` jau buvo `1.0.0`; šis įrašas fiksuoja **kas laikoma 1.0 apimtimi** ir **gamybinį reikalavimą** prieš viešą `v1.0.0` tag.

### Kas įeina

- CRM: klientai, užsakymai (sąrašas, modalas, CSV eksportas pagal filtrus), kalendorius, analitika, inventorius, komanda, išlaidos, nustatymai
- AI asistentas (Gemini / OpenRouter), PWA, offline / demo srautas (`VITE_ALLOW_OFFLINE_CRM`)
- Sąskaitų PDF ir el. paštas per `server.cjs` + Resend (kai API hostas ir env sukonfigūruoti)
- Klientų portalas: MVP apimtis — [docs/CLIENT_PORTAL_MVP.md](docs/CLIENT_PORTAL_MVP.md)
- Kokybės vartai: `npm run verify` (lint, types, build, Vitest, Playwright smoke / console / invoice / offline-crm)

### Gamybiniai reikalavimai prieš „išleidome 1.0“ pirkėjui

- Ant API hosto (pvz. Render) turi būti **`SUPABASE_SERVICE_ROLE_KEY`** — kitaip mokėjimų / sąskaitų istorija gali būti **tik laikina** (žr. `npm run check:cloud`).
- Paleisti `npm run check:cloud` su **gamybiniais** env — tikslas išėjimas **0**; uždaryti [docs/PRODUCTION_CHECKLIST.md](docs/PRODUCTION_CHECKLIST.md) §2–3.

### Žinomos ribos

- Portalas, Stripe ir žemėlapiai priklauso nuo įjungtų `VITE_*` ir serverio env — matrica: [docs/env-matrix.md](docs/env-matrix.md).
