<div align="center">
<img width="1200" height="475" alt="GHBanner" src="https://github.com/user-attachments/assets/0aa67016-6eaf-458a-adb2-6e31a0763ed6" />
</div>

# Švarus Darbas CRM

Progresyvus langų valymo verslo valdymo CRM su AI asistentu.

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
- Firebase / Supabase
- Google Gemini / OpenRouter AI

## Paleidimas

```bash
# 1. Instaluoti priklausomybes
npm install

# 2. Sukonfigūruoti .env failą (žr. .env.example)
# Pridėkite API raktą:
# VITE_OPENROUTER_API_KEY=jūsų-raktas

# 3. Paleisti dev serverį
npm run dev
```

## Aplinkos Kintamieji (.env)

```
VITE_USE_FIREBASE=false
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
npm run dev      # Paleisti dev serverį (port 3000)
npm run build    # Buildinti produkcijai
npm run preview  # Peržiūrėti buildą
npm run lint     # TypeScript tikrinimas
```

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
├── firebase.ts
└── types.ts
```

## Licenzija

MIT

---

*2026 Švarus Darbas CRM*
