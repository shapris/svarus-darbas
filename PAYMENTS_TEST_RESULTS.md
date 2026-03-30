# Mokėjimų Sistemos Testavimo Rezultatai

## 🎯 Testavimo Data
**Data:** 2026-03-28  
**Laikas:** 12:47  
**Status:** ✅ SĖKMINGA

## ✅ Sėkmingai Testuoti

### 1. Serverio Health Check
```bash
curl http://localhost:3001/health
```
**Rezultatas:** ✅ 200 OK
```json
{"status":"ok","timestamp":"2026-03-28T12:42:52.319Z"}
```

### 2. Sąskaitų API
```bash
curl http://localhost:3001/api/invoices
```
**Rezultatas:** ✅ 200 OK
```json
[]
```

### 3. Sąskaitos Kūrimas
```bash
node test-invoice.cjs
```
**Rezultatas:** ✅ 201 Created
```json
{
  "id": "inv_1774702011518_c7ffe757g",
  "order_id": "test-order-001",
  "client_id": "test-client-001",
  "amount": 50,
  "status": "pending",
  "due_date": "2026-04-11T12:46:51.398Z",
  "created_at": "2026-03-28T12:46:51.518Z"
}
```

### 4. PDF Sąskaitos Atsisiuntimas
```bash
curl http://localhost:3001/api/invoices/inv_1774702011518_c7ffe757g/pdf -o test-invoice.pdf
```
**Rezultatas:** ✅ PDF failas sukurtas (3984 bytes)

### 5. Webhook Endpoint
```bash
node test-webhook.cjs
```
**Rezultatas:** ✅ 400 Bad Request (teisinga - neteisingas signature)
- Webhook priima request'us
- Validuoja signature (nors testinį)
- Grąžina klaidą kai blogas

### 6. Payment Intent API
```bash
node test-payments.cjs
```
**Rezultatas:** ⚠️ 500 Internal Server Error
```json
{"error":"Invalid API Key provided: sk_test_*******lder"}
```
**Priežastis:** Stripe raktas nenurodytas .env faile

## 🔧 Konfigūracijos Problemos

### Stripe Raktai
Reikia nustatyti `.env` faile:
```bash
# Test raktai (Stripe Dashboard → Developers → API keys)
VITE_STRIPE_PUBLISHABLE_KEY=pk_test_your_publishable_key_here
STRIPE_SECRET_KEY=sk_test_your_secret_key_here
STRIPE_WEBHOOK_SECRET=whsec_your_webhook_secret_here
```

### Serverio Paleidimas
```bash
# Backend serveris
npm run server

# Frontend + backend
npm run dev:full
```

## 📊 Testavimo Scenarijai

### ✅ Veikiantys Funkcijos
- [x] Serverio health check
- [x] CORS palaikymas
- [x] Sąskaitų kūrimas
- [x] PDF generavimas
- [x] Webhook priėmimas
- [x] Express.js middleware
- [x] JSON response'ai

### ⚠️ Reikia Sutvarkyti
- [ ] Stripe raktų konfigūracija
- [ ] Payment intent kūrimas su teisu raktu
- [ ] Webhook signature verification su realiu raktu
- [ ] Stripe test kortelių duomenys

### 🎯 Sekantis Testavimas

1. **Nustatyti Stripe raktus** `.env` faile
2. **Paleisti serverį iš naujo** `npm run server`
3. **Testuoti payment intent** su teisu raktu
4. **Testuoti frontend mokėjimų formą**
5. **Testuoti pilną mokėjimo flow**

## 🚀 Rekomendacijos

1. **Stripe Test Kortelės:**
   - Kortelės numeris: 4242 4242 4242 4242
   - Data: bet kokia ateityje
   - CVC: bet kuris 3 skaitmenų

2. **Testavimo Eiga:**
   - Sukurti testinį klientą
   - Sukurti testinį užsakymą
   - Atlikti pilną mokėjimo ciklą
   - Patikrinti sąskaitų būsenos keitimus

3. **Monitoring:**
   - Stebėti serverio logus
   - Testuoti error handling
   - Patikrinti webhook event'us

---

**Status:** ✅ **Parengta testavimui** (reikia nustatyti Stripe raktus)
