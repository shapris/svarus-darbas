# Švarus Darbas CRM - Projekto Gairės

## 📋 Esama Būklė

| Dalis              | Statusas  | Pastabos                                   |
| ------------------ | --------- | ------------------------------------------ |
| AI Asistentas      | ✅ Veikia | Hybrid Classifier, Memory, Planning Engine |
| Vidinė CRM sistema | ✅ Veikia | 11 puslapių, duomenų bazė                  |
| PWA                | ✅ Veikia | Galima diegti                              |
| Testai             | ✅ Veikia | 7/7 testai                                 |

## 🎯 Reikalingi Pagerinimai

### 1️⃣ Klientų Portalas (HIGH PRIORITY)

**Problema:** Klientai negali prisijungti, matyti savo duomenų

**Sprendimas:**

```
1.1. Sukurti atskirą Klientų registraciją
1.2. Klientų prisijungimo sistema
1.3. Klientų matymo langas (mano užsakymai, istorija)
1.4. Užsakymo būsenos stebėjimas (real-time)
1.5. Atskirta "staff" vs "client" rolės
```

**Technologijos:** Supabase Auth

---

### 2️⃣ Mokėjimų Sistema (HIGH PRIORITY)

**Problema:** Nėra online apmokėjimo

**Sprendimas:**

```
2.1. Stripe/Lietuvos bankų integravimas
2.2. Automatinis sąskaitų faktūrų generatorius
2.3. Mokėjimo priminimai
2.4. Kvitų PDF generavimas
2.5. Mokėjimų istorija
```

---

### 3️⃣ Pranešimų Sistema (MEDIUM PRIORITY)

**Problema:** Klientai negauna priminimų

**Sprendimas:**

```
3.1. Email pranešimai (nodemailer/SendGrid)
3.2. SMS priminimai (Twilio/bet kas LT)
3.3. Push notifications (PWA)
3.4. Automatiniai priminimai (diena prieš, valandą prieš)
3.5. Statuso keitimo pranešimai
```

---

### 4️⃣ Patikimesnis Dizainas (MEDIUM PRIORITY)

**Problema:** Neišbaigta, neprofesionalu

**Sprendimas:**

```
4.1. Modernizuoti spalvų paletę
4.2. Animacijos ir perėjimai
4.3. Loading states visur
4.4. Error states aiškios žinutės
4.5. Responsive pilnai (mobilus)
4.6. Light/Dark tema
```

---

### 5️⃣ Offline Palaikymas (MEDIUM PRIORITY)

**Problema:** Jei nėra interneto - sistema neveikia

**Sprendimas:**

```
5.1. Service Worker pagerinimas
5.2. Local-first duomenų sinchronizacija
5.3. Offline rodymas (rodo paskutinius duomenis)
5.4. Queue sistema veiksmams
5.5. Auto-sync kai grįžta online
```

---

### 6️⃣ Greitesnis AI (LOW PRIORITY)

**Problema:** AI atsako lėtai (2-10s)

**Sprendimas:**

```
6.1. Caching dažnų užklausų
6.2. Debounce input
6.3. Progressive loading (rodyti "rašo...")
6.4. Local embedding ateičiai
```

---

## 📅 Vykdymo Tvarka

```
FAZĖ 1 (1-2 sav.)      FAZĖ 2 (2-3 sav.)      FAZĖ 3 (2-3 sav.)
─────────────────      ─────────────────      ─────────────────
┌─────────────┐        ┌─────────────┐        ┌─────────────┐
│ Klientų    │        │ Mokėjimų   │        │ Pranešimų  │
│ portalas   │   →    │ sistema     │   →    │ sistema     │
└─────────────┘        └─────────────┘        └─────────────┘

FAZĖ 4 (1-2 sav.)      FAZĖ 5 (1 sav.)
─────────────────      ─────────────────
┌─────────────┐        ┌─────────────┐
│ Dizainas    │        │ Greitis &   │
│ ir UI       │        │ Offline     │
└─────────────┘        └─────────────┘
```

---

## 🔧 Techniniai Reikalavimai

### Klientų Portalas

- Nauja rolė: `client` (atributas duomenų bazėje)
- Apsaugoti maršrutai: `/client/*`
- API: GET/POST /client/orders, GET /client/profile
- UI: NavBar dinamiškai pagal rolę

### Mokėjimai

- Stripe API key
- Webhook endpoints
- Saugumo: stripe signature verification
- DB lentelės: payments, invoices

### Pranešimai

- SendGrid/Twilio API
- Email templates
- Cron job'ai (užduotys)
- Notification preferences (DB)

### Offline

- IndexedDB papildomai
- Background sync API
- Optimistic updates

---

## 📊 Ištekliai

| Dalis        | Kas reikalinga  | Kaina        |
| ------------ | --------------- | ------------ |
| Serveris     | Vercel/Netlify  | 0-20€/mėn    |
| Duomenų bazė | Jau turim       | 0€           |
| Email/SMS    | SendGrid/Twilio | 0-50€/mėn    |
| Mokėjimai    | Stripe          | 1.4% + 0.25€ |
| Domain       | .lt             | ~15€/m       |

---

## ✅ Pirmi Žingsniai (Po 2 savaičių)

1. [ ] Klientų rolės sistemoje
2. [ ] Klientų registracija/login
3. [ ] Paprastas klientų dashboardas
4. [ ] Testuoti su 2-3 bandomais klientais

---

## 🏁 Tikslas

Po visų fazių sistema turės:

- **Klientai** - prisijungti, matyti užsakymus, mokėti, gauti priminimus
- **Darbuotojai** - matyti visus klientus, valdyti užsakymus, gauti priminimus
- **Vadovas** - analitika, ataskaitos, pajamas

**Verslo vertė:** Klientai gali patys užsakyti ir mokėti - mažiau darbo darbuotojams, greitesnis aptarnavimas.

---

_Atnaujinta: 2026-03-27_
