# ŠVARUS DARBAS CRM - PILNAS PROJEKTO PLANAS

## DABARTINĖ BŪKLĖ (2026-03-27)

### Kas Veikia

- AI Asistentas su atmintimi
- Vidinė CRM sistema (11 puslapių)
- Duomenų bazė (Supabase)
- PWA galimybės
- Testai (7/7)

### Kas Trūksta (pilnam verslui)

---

## 1. KLIENTŲ PORTALAS (Optional - jei reikia)

**Kam reikalingas:** Jei klientai patys nori užsakyti paslaugas per internetą

| #   | Funkcija             | Aprašymas                    | Statusas |
| --- | -------------------- | ---------------------------- | -------- |
| 1.1 | Klientų registracija | Atskira prisijungimo sistema | ❌       |
| 1.2 | Klientų dashboardas  | Matyti savo užsakymus        | ❌       |
| 1.3 | Online užsakymas     | Patys susikurti užsakymą     | ❌       |
| 1.4 | Mokėjimai            | Stripe/kortelės              | ❌       |
| 1.5 | Pranešimai           | SMS/Email priminimai         | ❌       |

**Alternatyva:** Kol kas galima užsakymus priimti telefonu/ žinute - nėra kritiška

---

## 2. PAMATINĖS FUNKCIJOS (Būtina)

| #   | Funkcija          | Aprašymas                      | Prioritetas | Statusas |
| --- | ----------------- | ------------------------------ | ----------- | -------- |
| 2.1 | Auto-login        | Nereikia kaskart prisijungti   | 🔴 HIGH     | ❌       |
| 2.2 | Duomenų eksportas | Excel/PDF export               | 🔴 HIGH     | ❌       |
| 2.3 | Duomenų importas  | Importuoti klientus            | 🔴 HIGH     | ❌       |
| 2.4 | Backup            | Automatinis duomenų backup     | 🔴 HIGH     | ❌       |
| 2.5 | Search/Filter     | Geras klientų/užsakymų filtras | 🔴 HIGH     | ❌       |

---

## 3. AI PATOBULINIMAI

| #   | Funkcija              | Aprašymas            | Prioritetas | Statusas   |
| --- | --------------------- | -------------------- | ----------- | ---------- |
| 3.1 | Greitesnis atsakas    | Cache, optimizacija  | 🟡 MEDIUM   | ❌         |
| 3.2 | Voice input           | Kalbėti su asistentu | 🟡 MEDIUM   | ⚠️ Dalinai |
| 3.3 | AI summary            | Auto-santraukos      | 🟡 MEDIUM   | ❌         |
| 3.4 | Proaktyvūs priminimai | AI siūlo ką daryti   | 🟡 MEDIUM   | ❌         |

---

## 4. UI/UX PATOBULINIMAI

| #   | Funkcija           | Aprašymas                 | Prioritetas | Statusas |
| --- | ------------------ | ------------------------- | ----------- | -------- |
| 4.1 | Loading states     | Kraunasi animacijos       | 🟡 MEDIUM   | ❌       |
| 4.2 | Error messages     | Aiškios klaidos žinutės   | 🟡 MEDIUM   | ❌       |
| 4.3 | Mobile responsive  | Pilnas mobilus palaikymas | 🟡 MEDIUM   | ❌       |
| 4.4 | Dark/Light tema    | Tema switcher             | 🟢 LOW      | ❌       |
| 4.5 | Keyboard shortcuts | Greitukai                 | 🟢 LOW      | ❌       |

---

## 5. VERSLO FUNKCIJOS

| #   | Funkcija                | Aprašymas                | Prioritetas | Statusas   |
| --- | ----------------------- | ------------------------ | ----------- | ---------- |
| 5.1 | Darbuotojų valdymas     | Darbo grafikai, užduotys | 🟡 MEDIUM   | ⚠️ Dalinai |
| 5.2 | Maršrutų planavimas     | Optimalūs maršrutai      | 🟢 LOW      | ❌         |
| 5.3 | Sandėlio valdymas       | Inventoriaus sekimas     | 🟡 MEDIUM   | ⚠️ Dalinai |
| 5.4 | Sąskaitos faktūros      | PDF sąskaitos            | 🟡 MEDIUM   | ❌         |
| 5.5 | Automatiniai priminimai | Kas 30/60/90 dienų       | 🟢 LOW      | ❌         |

---

## 6. ADMINISTRAVIMAS

| #   | Funkcija           | Aprašymas                      | Prioritetas | Statusas |
| --- | ------------------ | ------------------------------ | ----------- | -------- |
| 6.1 | Vartotojų rolės    | Admin/Staff/Viewer             | 🔴 HIGH     | ❌       |
| 6.2 | Audit log          | Kas ką keitė                   | 🔴 HIGH     | ❌       |
| 6.3 | Settings per staff | Individualūs nustatymai        | 🟢 LOW      | ❌       |
| 6.4 | Multi-business     | Keli verslai vienoje sistemoje | 🟢 LOW      | ❌       |

---

## 7. TECHNINĖS DALYS

| #   | Funkcija        | Aprašymas             | Prioritetas | Statusas   |
| --- | --------------- | --------------------- | ----------- | ---------- |
| 7.1 | Offline režimas | Dirbti be interneto   | 🟡 MEDIUM   | ❌         |
| 7.2 | PWA pilnas      | Push notifications    | 🟡 MEDIUM   | ❌         |
| 7.3 | Pagalba/Help    | Naudojimo instrukcija | 🟢 LOW      | ❌         |
| 7.4 | Analytics       | Detali analitika      | 🟡 MEDIUM   | ⚠️ Dalinai |

---

## ĮGYVENDINIMO TVARKA

### GREITASIS VARIANTAS (1-2 sav.)

Būtinos funkcijos verslo pradžiai:

| #   | Funkcija                | Statusas    |
| --- | ----------------------- | ----------- |
| 1   | Auto-login (2.1)        | ✅ Padaryta |
| 2   | Search/Filter (2.5)     | ✅ Jau buvo |
| 3   | Loading states (4.1)    | ✅ Jau buvo |
| 4   | Error messages (4.2)    | ✅ Padaryta |
| 5   | Mobile responsive (4.3) | ✅ Jau buvo |

### VIDUTINIS VARIANTAS (1 mėnuo)

Pilnas funkcionalumas:

```
1. Viskas iš greitojo varianto
2. Duomenų export (2.2)
3. Darbuotojų valdymas (5.1)
4. Vartotojų rolės (6.1)
5. PDF sąskaitos (5.4)
6. AI greitėjimas (3.1)
```

### PILNAS VARIANTAS (2-3 mėnesiai)

Pilna verslo sistema:

```
1. Viskas iš vidutinio varianto
2. Klientų portalas (1.x) - Optional
3. Mokėjimai (1.4)
4. Offline režimas (7.1)
5. Dark/Light tema (4.4)
6. Maršrutų planavimas (5.2)
```

---

## KAS BŪTINA DABAR (minimaliam veikimui)

| #   | Funkcija              | Kodėl                     |
| --- | --------------------- | ------------------------- |
| 1   | **Auto-login**        | Nereikia kas kart jungtis |
| 2   | **Mobile responsive** | Dirbs telefonu            |
| 3   | **AI veikia**         | Jau veikia ✅             |
| 4   | **Duomenų bazė**      | Jau veikia ✅             |
| 5   | **Testai**            | Jau veikia ✅             |

---

## IŠVADA

**ŠIUO METU SISTEMA TINKA:**

- ✓ Vidinei naudojimui
- ✓ AI asistentui
- ✓ Analitikai
- ✓ Užsakymų valdymui (telefonu)

**REIKIA PRIDĖTI:**

- ✗ Auto-login
- ✗ Geresnis mobile
- ✗ Aiškios klaidos
- ✗ Export/Import

**Optional (jei reikia klientų portalas):**

- ✗ Visi punktai iš skyriaus 1

---

**REKOMENDUOJAMAS Kitas ŽINGSNIS:**
Pridėti Auto-login + Mobile responsive (2-3 valandas darbo)

Ką renkatės?
