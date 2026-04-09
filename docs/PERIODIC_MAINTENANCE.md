# Periodinė priežiūra (procesas)

## Kas mėnesį

- `npm outdated` — minor/patch atnaujinimai, tada **`npm run verify`**.
- Peržiūrėti `npm audit` (repo siekis: 0 high).

## `verify` grandinė (trumpai)

- Pilnas vartai: lint → build → unit → keli Playwright → **`npm run free-ports`** → `test:offline-crm`.
- **`free-ports`** (`scripts/free-dev-ports.mjs`, priklausomybė `kill-port`) atlaisvina 4173 / 3001 / 5173 prieš paskutinį E2E, kad Windows’e rečiau strigtų keli Playwright `webServer` paleidimai iš eilės.
- Jei lokaliai vis tiek stringa: **`npm run verify:local`** (pradžioje `dev:kill` tik PowerShell / 3001+5173+4173).
- Papildomas E2E (neįeina į `verify`): **`npm run test:journey`** — pilnas offline CRM maršrutas per skiltis + kliento portalas (`tests/user-journey.spec.ts`).

## Kas ketvirtį

- Major versijų planas: React, Vite, `@supabase/supabase-js`, Playwright — atskiras PR su changelog skaitymu.

## Po incidento

- Trumpas įrašas į [`.always-on/session-log.md`](../.always-on/session-log.md).
- Jei reikia prevencijos — vienas naujas punktas [`.always-on/work-queue.md`](../.always-on/work-queue.md).

## Scout

- `npm run scout:improvements` — atnaujina [`.always-on/improvement-backlog.md`](../.always-on/improvement-backlog.md).
