<div align="center">
<img width="1200" height="475" alt="GHBanner" src="https://github.com/user-attachments/assets/0aa67016-6eaf-458a-adb2-6e31a0763ed6" />
</div>

# Švarus Darbas CRM

Progresyvus langų valymo verslo valdymo CRM su AI asistentu.

## ⚠️ AGENT BOOTSTRAP (MANDATORY)

Before performing any action:

1. Load and follow `AGENT_PROTOCOL.md`
2. Follow `.cursor/rules.md` (HARD RULES)
3. Apply `.cursor/rules/*.mdc` (WORKFLOW RULES)

Execution is not allowed without loading these rules.

## Funkcijos

### AI Asistentas

- **Hybrid Classifier** - 45+ intencijų atpažinimas (greitas + tikslus)
- **Memory Priority** - konteksto supratimas ir atminties prioritizavimas
- **Planning Engine** - daug žingsnių automatizavimas
- **Auto-Memory** - svarbių pokalbių automatinis išsaugojimas

### CRM Funkcijos

- 📋 **Klientų valdymas** - klientų duomenų bazė
- 📦 **Užsakymų valdymas** - langų valymo užsakymai
- 💰 **Išlaidos** - verslo išlaidų sekimas
- 📊 **Analitika** - pajamų/ išlaidų ataskaitos
- 📅 **Kalendorius** - darbų planavimas
- 📦 **Inventorius** - valymo priemonių sandėlis
- 👥 **Komanda** - darbuotojų valdymas

### Techninės Funkcijos

- PWA (Progressive Web App)
- Real-time duomenų sinchronizacija
- Offline palaikymas
- AI balso komandos

## Tech Stack

- React 19 + TypeScript
- Vite
- Tailwind CSS 4
- Supabase
- Google Gemini / OpenRouter AI

## Paleidimas

```bash
# 1. Instaluoti priklausomybes
npm install

# 2. Aplinka: nukopijuokite .env.example → .env ir įrašykite VITE_SUPABASE_* iš Supabase (Settings → API)
copy .env.example .env
npm run check:env

# Jei naudojate Supabase debesyje:
# - paleiskite supabase/production_owner_id_schema.sql
# - tada supabase/public_booking_rpcs.sql (viešai rezervacijai)

# 3. Tik CRM naršyklėje (dažniausiai užtenka)
npm run dev

# 4. CRM + sąskaitų API lokaliai (server.cjs :3001)
npm run dev:full
```

### Sąskaitos PDF ir automatinis el. paštas (auksinis kelias)

1. **Pilnas vietinis rinkinys:** `npm run dev:full` (Vite :5173 + `server.cjs` :3001). Tik `npm run dev` — PDF bus, bet **automatinis siuntimas per Resend** neveiks, kol API neprieinamas.
2. **`.env` šalia `server.cjs`:** `RESEND_API_KEY`, `RESEND_FROM_EMAIL`, taip pat `VITE_SUPABASE_*` / `SUPABASE_*` pagal `.env.example` (JWT tikrinimui siunčiant).
3. **Diagnozė:** naršyklėje atverkite `http://127.0.0.1:5173/health` (dev) — `invoiceEmail: true`, jei Resend raktas įrašytas serveryje.
4. Po sąskaitos generavimo CRM **toast** papildomai paaiškina, jei API neišjungtas, bet trūksta Resend arba neveikia :3001 (be poreikio žiūrėti į konsolę).
5. **Automatinis testas:** `npm run test:invoice` (kartu su `npm run verify`).

Jei matote ekraną **„Reikalinga duomenų bazė“**: po `.env` pakeitimo būtina **sustabdyti** `npm run dev` (**Ctrl+C**) ir paleisti iš naujo. Patikra: `npm run check:env`.

## Aplinkos Kintamieji (.env)

```
VITE_DEMO_MODE=false
VITE_SUPABASE_URL=jūsų-supabase-url
VITE_SUPABASE_ANON_KEY=jūsų-raktas
VITE_GEMINI_API_KEY=gemini-raktas
VITE_OPENROUTER_API_KEY=openrouter-raktas
```

## AI Sistema

### Intencijų Klasifikatorius

Naudoja hibridinį metodą:

1. **Greitasis režimas** - keyword atpažinimas (1-5ms)
2. **GPT fallback** - neaiškiems atvejams (200-500ms)
3. **Caching** - pasikartojančioms užklausoms

### Atminties Sistema

- Svarbūs pokalbiai automatiškai išsaugomi
- Prioritetas pagal: svarbą, datą, raktažodžius
- Kategorijos: klientas, verslas, procesas, kita

### Planavimo Variklis

- Mėnesio apžvalga
- Klientų aptarnavimas
- Nemokėjimų priminimai
- Sezoninis pasiruošimas

## Komandos

```bash
npm run dev      # Paleisti dev serverį (port 5173; API server.cjs — 3001)
npm run dev:full # Paleisti frontend + API kartu
npm run build    # Buildinti produkcijai
npm run preview  # Peržiūrėti buildą
npm run lint     # TypeScript tikrinimas
npm test         # Vitest vienetiniai / integraciniai testai
npm run test:smoke # Playwright smoke testas prieš preview
npm run test:console # Konsolė be netikėtų klaidų (pagrindinis meniu)
npm run test:invoice # /health JSON (sąskaitų API kelias)
npm run verify       # lint + build + test + smoke + console + invoice
npm run check:cloud # Patikrina ar netrūksta cloud/env nustatymų
```

## Pirmas deploy (Vercel + Render)

Žingsnis po žingsnio (ką dėti į hostingą, kokie kintamieji): **[docs/PALEIDIMAS_VERCEL_RENDER.md](docs/PALEIDIMAS_VERCEL_RENDER.md)**.  
API hostui Render naudoja repo failą **`render.yaml`**; starto komanda: **`npm start`**.

## Greitas cloud checklist

Prieš paleidžiant visiems naudotojams (be jūsų kompiuterio):

1. Frontend hostinge (pvz. Vercel) suveskite `VITE_*` reikšmes.
2. `server.cjs` paleiskite atskirame hostinge (Render/Railway/VPS).
3. API hostinge suveskite: `RESEND_API_KEY`, `RESEND_FROM_EMAIL`, `SUPABASE_URL`, `SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`, `FRONTEND_URL` (arba `CORS_ORIGINS`).
4. Paleiskite `npm run check:cloud` lokaliai — parodys trūkstamus punktus.
5. Jei naudojate Supabase, produkcijoje rekomenduotas vienintelis kelias:
   `supabase/production_owner_id_schema.sql` -> `supabase/public_booking_rpcs.sql`.
6. Legacy `uid + quoted camelCase` SQL kelias paliktas tik suderinamumui; nemaišykite jo su kanonine schema tam pačiam projektui.

## Struktūra

```
src/
├── components/     # Bendri komponentai
│   ├── ChatAssistant.tsx
│   └── Layout.tsx
├── services/       # AI servisai
│   ├── aiService.ts
│   ├── hybridClassifier.ts
│   ├── memoryPriority.ts
│   ├── modularPrompt.ts
│   └── planningEngine.ts
├── views/          # Puslapiai
│   ├── Dashboard.tsx
│   ├── ClientsView.tsx
│   ├── OrdersView.tsx
│   ├── ExpensesView.tsx
│   └── ...
├── App.tsx
├── supabase.ts     # Duomenų bazė
└── types.ts
```

## Licenzija

MIT

---

_2026 Švarus Darbas CRM_
