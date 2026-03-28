# Klientų Portalas - Vartotojo Gidas

## 🎯 Kas tai?

Klientų portalas leidžia jūsų klientams:
- **Registruotis** ir prisijungti prie savo paskyros
- **Matyti savo užsakymus** ir jų būsenas
- **Peržiūrėti istoriją** ir statistiką
- **Redaguoti savo profilį**

## 🚀 Kaip pradėti?

### 1. Duomenų Bazės Nustatymai

Importuokite SQL schema:
```sql
-- Supabase: Eikite į SQL Editor -> įklijuokite client-portal-schema.sql
-- Firebase: Sukurkite profiles collection su tokia pačia struktūra
```

### 2. Aplinkos Kintamieji

`.env` faile įsitikinkite kad turite:
```bash
VITE_SUPABASE_URL=jūsų-supabase-url
VITE_SUPABASE_ANON_KEY=jūsų-supabase-anon-key
# ARBA
VITE_USE_FIREBASE=true
VITE_FIREBASE_API_KEY=jūsų-firebase-key
VITE_FIREBASE_PROJECT_ID=jūsų-project-id
```

### 3. Paleidimas

```bash
npm run dev
```

## 📱 Kaip naudotis?

### Klientams

1. **Atidarykite** aplikaciją naršyklėje
2. **Pasirinkite** "Kliento Prisijungimas" (žalias mygtukas)
3. **Registruokitės** su el. paštu ir slaptažodžiu
4. **Pildykite** savo duomenis (vardas, telefonas, adresas)
5. **Prisijunkite** ir matykite savo dashboard

### Darbuotojams

1. **Atidarykite** aplikaciją
2. **Pasirinkite** "Darbuotojo Prisijungimas" (mėlynas mygtukas)
3. **Prisijunkite** su savo paskyra
4. **Valdykite** visą CRM sistemą

## 🔐 Vartotojų Rolės

### Client (Klientas)
- Gali matyti tik savo užsakymus
- Gali redaguoti savo profilį
- Neturi prieigos prie CRM funkcijų

### Staff (Darbuotojas)
- Turi pilną prieigą prie CRM
- Gali valdyti visus klientus ir užsakymus
- Gali naudoti AI asistentą

### Admin (Administratorius)
- Turi visas Staff teises
- Papildomos administratoriaus funkcijos

## 📊 Klientų Dashboard Funkcijos

### Mano Užsakymai
- **Užsakymų sąrašas** su būsenomis
- **Statusai**: Suplanuota, Vykdoma, Atlikta
- **Filtravimas** pagal datas
- **Kainų peržiūra**

### Statistika
- **Viso užsakymų** skaičius
- **Suplanuotų** užsakymų skaičius
- **Atliktų** užsakymų skaičius
- **Išlaidų** suma

### Mano Profilis
- **Asmeninė informacija** (vardas, el. paštas, telefonas)
- **Registracijos data**
- **Paskyros tipas**

## 🛠️ Techninė Informacija

### API Endpoints

#### Klientų Portalas
```
GET /api/client/orders     - Gauti kliento užsakymus
GET /api/client/profile    - Gauti kliento profilį
PUT /api/client/profile    - Atnaujinti profilį
POST /api/client/register - Registruoti naują klientą
```

#### Autentifikacija
```
POST /auth/login          - Prisijungimas
POST /auth/register       - Registracija
POST /auth/logout         - Atsijungimas
```

### Duomenų Bazės Struktūra

#### Profiles lentelė
```sql
id          UUID (Primary Key)
uid         VARCHAR (Auth user ID)
email       VARCHAR
role        ENUM ('admin', 'staff', 'client')
name        VARCHAR
phone       VARCHAR
client_id   VARCHAR (FK į clients lentelę)
created_at  TIMESTAMP
updated_at  TIMESTAMP
```

#### Orders lentelė (papildyta)
```sql
client_id   VARCHAR (FK į profiles lentelę)
-- ... kiti laukai
```

## 🔧 Debugging

### Dažnos Problem

**Klientas nemato savo užsakymų**
- Patikrinkite ar `client_id` teisingai nustatytas profiles lentelėje
- Patikrinkite ar orders lentelėje teisingas `client_id`

**Neleidžia prisijungti**
- Patikrinkite ar vartotojas turi `role = 'client'`
- Patikrinkite ar el. paštas ir slaptažodis teisingi

**Rolė nustatymas neveikia**
- Patikrinkite ar `getUserProfile()` funkcija veikia
- Patikrinkite ar profiles lentelė egzistuoja

### Testavimas

Testinia duomenys:
```javascript
// Klientas
Email: client@example.com
Password: client123

// Darbuotojas
Email: staff@example.com  
Password: staff123
```

## 📱 Mobilusis Naudojimasis

Klientų portalas yra **PWA** (Progressive Web App):
- **Instaliuokite** iš naršyklės
- **Naudokite** kaip mobilę aplikaciją
- **Offline** režimas (ateityje)

## 🚀 Būsimi Pagerinimai

### Phase 2 (Mokėjimai)
- Online mokėjimai (Stripe)
- Sąskaitų generavimas
- Mokėjimų istorija

### Phase 3 (Pranešimai)
- Email priminimai
- SMS pranešimai
- Push notifications

### Phase 4 (Offline)
- Offline palaikymas
- Sinchronizacija
- Local cache

---

**Sukurta:** 2026-03-28  
**Versija:** 1.0.0  
**Statusas:** ✅ Veikianti
