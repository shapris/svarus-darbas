# Vercel + Render: env sutapimas su dokumentacija

**Tikslas:** `main` deploy (Vercel frontend + Render API) naudoja **tuos pačius kintamųjų pavadinimus ir semantiką** kaip [`env-matrix.md`](env-matrix.md) ir [`.env.example`](../.env.example). Repo **neįrodo** hostingo dashboard reikšmių — tik sinchronizuoja kontraktą.

## Kanonas (kopijuokite į hostingą)

| Vieta           | Šaltinis dokumentacijoje                                        |
| --------------- | --------------------------------------------------------------- |
| Vercel (build)  | [`PALEIDIMAS_VERCEL_RENDER.md`](PALEIDIMAS_VERCEL_RENDER.md) §2 |
| Render (API)    | Tas pats failas §3                                              |
| Pilna matrica   | [`env-matrix.md`](env-matrix.md)                                |
| Rankinė patikra | [`PRODUCTION_CHECKLIST.md`](PRODUCTION_CHECKLIST.md)            |

## Repo failai (nuorodos į deploy elgseną)

| Failas        | Ką fiksuoja                                                      |
| ------------- | ---------------------------------------------------------------- |
| `vercel.json` | `npm ci` + `npm run build`, išvestis `dist`, SPA maršrutai       |
| `render.yaml` | `npm ci`, `npm start` → `server.cjs`, `healthCheckPath: /health` |

## Known gaps (neautomatuojama repo)

1. **Dashboard ↔ git:** Vercel ir Render env keičiami tik per UI / CLI — nėra „vieno mygtuko“ sinchronizacijos su GitHub (išskyrus rankinį kopijavimą arba savo scriptą).
2. **`npm run check:cloud` lokaliai** žiūri **šaknies `.env`**, ne Vercel/Render API — gamybinė patikra hostinge lieka rankinė arba per savo secretų pipeline.
3. **Preview vs Production:** Vercel Preview šakoms dažnai reikia **atskirų** `VITE_*` (ypač `VITE_INVOICE_API_BASE_URL`), jei API URL skiriasi nuo production.
4. **Stripe webhook URL** priklauso nuo Render hostname — po pirmo deploy arba domeno keitimo webhook Stripe dashborde reikia **atnaujinti rankiniu būdu**.
5. **Supabase Auth redirect URLs** turi būti atnaujinti kiekvienam naujam frontend domenui (žr. gamybinį checklistą).

Jei įdiegtas **Vercel / Render integruotas** secretų eksportas, įrašykite tai vidinėje wiki — čia lieka „known gap“ tik tol, kol nėra repo instrukcijos.
