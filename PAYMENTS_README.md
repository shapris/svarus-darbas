# Mokėjimų Sistema - Vartotojo Gidas

## 🎯 Kas tai?

Pilna mokėjimų sistema integruota su **Stripe**, leidžianti:

- **Online mokėjimus** su kreditinėmis kortelėmis
- **Automatinį sąskaitų generavimą** PDF formatu
- **Mokėjimų priminimus** ir būsenų sekimą
- **Transakcijų istoriją** ir ataskaitas

## 🚀 Instaliacija ir Konfigūracija

### 1. Stripe Nustatymai

1. **Sukurkite Stripe paskyrą**: https://dashboard.stripe.com/register
2. **Gauk API raktus**: Developers → API keys
3. **Nustatykite webhook**: Developers → Webhooks → add endpoint `https://jūsų-domain.com/webhook`

### 2. Aplinkos Kintamieji

`.env` faile pridėkite:

```bash
# Stripe (test režimas)
VITE_STRIPE_PUBLISHABLE_KEY=pk_test_your_stripe_publishable_key
STRIPE_SECRET_KEY=sk_test_your_stripe_secret_key
STRIPE_WEBHOOK_SECRET=whsec_your_webhook_secret

# Serverio portas
PORT=3001
```

### 3. Duomenų Bazė

Importuokite mokėjimų schema:

```sql
-- Supabase: SQL Editor -> įklijuokite payments-schema.sql
-- Supabase: lentelės pagal schema (žr. SQL failus repo)
```

### 4. Serverio Paleidimas

```bash
# Tik backend serveris
npm run server

# Frontend + backend (rekomenduojama)
npm run dev:full
```

## 💳 Mokėjimų Eiga

### Kliento Požiūris

1. **Klientas prisijungia** į portalą
2. **Pasirenka "Mokėjimai"** tabą
3. **Mato sąrašą** neapmokėtų užsakymų
4. **Spaudžia "Apmokėti"** prie norimo užsakymo
5. **Įveda kortelės duomenis** ir patvirtina mokėjimą
6. **Automatiškai sukuriamas** PDF sąskaita

### Darbuotojo Požiūris

1. **Įeina į "Mokėjimai"** sekciją CRM
2. **Mato statistiką**: bendros pajamos, laukiančių mokėjimų
3. **Valdo sąskaitas**: keičia būsenas, atšaukia
4. **Peržiūri transakcijas**: mokėjimai, grąžinimai
5. **Generuoja ataskaitas** PDF formatu

## 📊 Funkcijos

### 🔄 Stripe Integracija

**Payment Intents**:

- Sukuriamas payment intent kiekvienam mokėjimui
- Client-side patvirtinimas su Stripe.js
- Webhook integracija real-time būsenų atnaujinimui

**Saugumas**:

- PCI DSS atitiktis (Stripe tvarko saugumą)
- Tokenizacija kortelės duomenų
- 3D Secure palaikymas

### 📄 Sąskaitų Generatorius

**Automatinis generavimas**:

- Sukuriamas kiekvienam užsakymui
- PDF formatu su profesionaliu dizainu
- Unikalūs sąskaitų numeriai

**PDF Sąskaitos turinys**:

- Įmonės informacija
- Kliento duomenys
- Užsakymo detalės
- Suma ir mokėjimo terminas
- PVM informacija

### 💳 Mokėjimų Būsenos

**Pending** - Laukiama apmokėjimo:

- Klientas gali atšaukti
- Darbuotojas gali keisti sumą

**Paid** - Apmokėta:

- Automatiškai atnaujinama užsakymo būsena
- Sukuriamas transakcijos įrašas

**Cancelled** - Atšaukta:

- Galima keisti į pending
- Išsaugoma atšaukimo priežastis

**Refunded** - Grąžinta:

- Dalinė ar pilna grąžinimo galimybė
- Automatiškai atnaujinamos sąskaitos

### 📈 Statistika ir Ataskaitos

**Real-time statistika**:

- Bendros pajamos (per laikotarpį)
- Laukiančių mokėjimų suma
- Apmokėtų ir neapmokėtų sąskaitų skaičius
- Vidutinis mokėjimo dydis

**Ataskaitos**:

- Dienos/mėnesio/metinės ataskaitos
- Klientų mokėjimų istorija
- Pajamų prognozės

## 🔧 API Endpoint'ai

### Client-side (Frontend)

```javascript
// Sukurti mokėjimo intent
POST /api/create-payment-intent
{
  "order_id": "order_123",
  "amount": 5000, // centais
  "currency": "eur",
  "metadata": {
    "client_name": "Jonas Jonaitis"
  }
}

// Patvirtinti mokėjimą
// (vykdoma Stripe.js kliento pusėje)

// Gauti sąskaitas
GET /api/invoices?client_id=client_123

// Atsisiųsti PDF
GET /api/invoices/:id/pdf
```

### Server-side (Backend)

```javascript
// Stripe webhook
POST / webhook;
// Event types:
// - payment_intent.succeeded
// - payment_intent.payment_failed
// - invoice.payment_succeeded
// - charge.dispute.created
```

## 🛡️ Saugumas

### PCI DSS Atitiktis

- **Stripe tvarko visą kortelės duomenų srautą**
- Kortelės numeriai niekada nėra saugomi jūsų serveriuose
- Naudojami Stripe token'ai

### Webhook Saugumas

- **Signature verification**: patikrinama webhook žinutės autentiškumas
- **Replay attack protection**: unikalūs event ID
- **IP whitelist**: galima apriboti webhook iškvietimus

### Duomenų Saugumas

- **Row Level Security**: klientai mato tik savo duomenis
- **API rate limiting**: apsauga nuo brute force atakų
- **Input validation**: visi duomenys validuojami

## 📱 Mobilusis Naudojimasis

Mokėjimų sistema pilnai veikia mobiliuose įrenginiuose:

- **Responsive dizainas**
- **Touch-friendly** mokėjimo forma
- **Apple Pay / Google Pay** (būsimas)
- **Biometrinis patvirtinimas** (per Stripe)

## 🔧 Debugging

### Testavimas

**Stripe test kortelės**:

```
Kortelės numeris: 4242424242424242
Data: bet kokia ateityje
CVC: bet kuris 3 skaitmenų
```

**Testavimo scenarijai**:

1. **Sėkmingas mokėjimas**
2. **Nepakanka lėšų**
3. **CVC klaida**
4. **Kortelės atmetimas**
5. **Network timeout**

### Logging

```javascript
// Mokėjimų logai
console.log('Payment created:', paymentIntent);
console.log('Payment confirmed:', paymentResult);
console.log('Invoice generated:', invoiceData);

// Webhook logai
console.log('Webhook received:', event.type);
console.log('Payment succeeded:', paymentIntent);
```

## 🚨 Problemų Sprendimas

### Dažnos Klaidos

**"No such payment intent"**:

- Patikrinkite ar payment intent teisingai sukurtas
- Įsitikinkite kad client_secret teisingai perduodamas

**"Webhook signature verification failed"**:

- Patikrinkite STRIPE_WEBHOOK_SECRET
- Įsitikinkite kad webhook endpoint'as viešai prieinamas

**"Rate limit exceeded"**:

- Sumažinkite API iškvietimų dažnumą
- Naudokite caching

### Performance Optimizavimas

**Frontend**:

- Lazy loading mokėjimų komponentų
- Payment intent caching
- Optimizuotas PDF generavimas

**Backend**:

- Database indexing
- Connection pooling
- Async webhook procesavimas

## 📈 Būsimi Pagerinimai

### Phase 3 (Pranešimai)

- **Email priminimai**: automatiniai pranešimai apie artėjančius mokėjimus
- **SMS priminimai**: SMS pranešimai apie vėlavimus
- **Push notifications**: real-time pranešimai klientams

### Phase 4 (Advanced)

- **Subscription plans**: pasikartojančių mokėjimų planai
- **Multi-currency**: keletas valiutų palaikymas
- **International payments**: tarptautinių mokėjimų galimybė

---

**Sukurta:** 2026-03-28  
**Versija:** 1.0.0  
**Statusas:** ✅ Veikianti (test režimas)

## 📞 Techninis Palaikymas

Jei kyla klausimų ar problemų:

1. **Patikrinkite konsolės logus**
2. **Validuokite Stripe konfigūraciją**
3. **Testuokite su test kortelėmis**
4. **Kreipkitės į techninį palaikymą**

---

**⚠️ Svarbu:** Prieš naudojant gamyboje, įsitikinkite kad:

- Pakeitėte test raktus į live raktus
- Konfigūravote teisingus webhook endpoint'us
- Nustatėte proper SSL sertifikatą
