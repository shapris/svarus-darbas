# Paleidimas ir pardavimas — kiti žingsniai

Vienas dokumentas paleidimui ir pardavimui — susietas su [PRODUCTION_CHECKLIST.md](PRODUCTION_CHECKLIST.md) ir [DEPLOY.md](DEPLOY.md).

---

## 1. Režimas (pasirinkimą įrašo produkto savininkas)

**Pažymėkite vieną** ir įrašykite datą — nuo to priklauso, kiek reikia sutarčių ir onboardingo.

| Režimas                      | Aprašymas                                   | Tipinis kitas žingsnis                                                                 |
| ---------------------------- | ------------------------------------------- | -------------------------------------------------------------------------------------- |
| **A — Tik savo verslas**     | CRM naudojate savo langų valymo įmonei      | Uždaryti [PRODUCTION_CHECKLIST.md](PRODUCTION_CHECKLIST.md) ir naudoti gamyboje        |
| **B — Vienas pilotas**       | Vienas mokantis klientas, ribotas rizikas   | Sutarti apimtis žodžiu + šablono 3 skyrius; vienas Supabase projektas arba atskiras    |
| **C — SaaS / keli klientai** | Produktas keliems nepriklausomiems verslams | Pilnas 3 skyrius + teisinė peržiūra LT; dažnai atskiras Supabase / instancija klientui |

**Mūsų pasirinkimas (užpildykite):** `A / B / C` — data: `____-__-__`

---

## 2. Gamybinė patikra (repo + hostingas)

### 2.1 Automatinė (terminale, iš projekto šaknies)

Paleiskite ir užfiksuokite rezultatą žemiau (atnaujinkite po kiekvieno release bandymo):

```bash
npm run verify
npm run check:cloud
node --check server.cjs
```

Greitas CRM (tik `VITE_*` šiame repo `.env`): `npm run check:cloud:frontend` — išėjimas **0**, jei Vercel build turėtų pakakti Supabase. Pilnas debesis su API: visada ir **`check:cloud`** (arba API `.env` su `SUPABASE_SERVICE_ROLE_KEY`).

**Paskutinio paleidimo žurnalas**

| Komanda                   | Data (UTC arba vietinė) | Išėjimo kodas | Pastaba                                                                                                                                                                                                                                   |
| ------------------------- | ----------------------- | ------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `npm run verify`          | 2026-04-06              | 0             | lint, types, build, unit, Playwright — OK                                                                                                                                                                                                 |
| `npm run check:cloud`     | 2026-04-06              | 2             | **BLOCKED (lokalus .env):** trūksta `SUPABASE_SERVICE_ROLE_KEY` API hoste; WARN: žemėlapiai, Stripe publishable, invoice API URL, `onboarding@resend.dev`. **Gamybinis v1.0:** pakartokite su Vercel/Render env — tikslas išėjimas **0**. |
| `node --check server.cjs` | 2026-04-06              | 0             | Sintaksė OK                                                                                                                                                                                                                               |

> Agentų sesijoje šis blokas gali būti užpildytas automatiškai; savininkas vis tiek turi praeiti **2.2 rankinę** checklist hostinge. Kol `check:cloud` ≠ 0 dėl privalomų laukų, gamybiniai mokėjimų įrašai gali būti **neišliekantys** (žr. skripto išvestį „Payments persistence“).

### 2.2 Rankinė (Supabase, Vercel, Render, Stripe, Resend)

Nukopijuokite ir žymėkite pagal [PRODUCTION_CHECKLIST.md §2–3](PRODUCTION_CHECKLIST.md) (DNS, HTTPS, Auth URL, webhook, health, CORS, Resend domenas, schema).

### 2.3 Prieš viešą žymą **v1.0.0** (savininkas)

Repo paruošimas žemiau; **git tag** dėti tik kai žemiau uždaryta **gamybinėje** aplinkoje (ne tik lokaliai).

- [ ] `npm run check:cloud` su **produkcijos** kintamaisiais (kopijuoti į šakninį `.env` arba paleisti CI su tomis pačiomis reikšmėmis) — išėjimas **0**
- [ ] [PRODUCTION_CHECKLIST.md §2](PRODUCTION_CHECKLIST.md) — DNS, HTTPS, Supabase Auth / Redirect URLs, Stripe webhook, Render `/health`, CORS, Resend ne bandomasis siuntėjas
- [ ] [PRODUCTION_CHECKLIST.md §3](PRODUCTION_CHECKLIST.md) — prisijungimas, užsakymai/klientai, bandomoji sąskaita ar mokėjimas (jei naudojate)

---

## 3. Komercinis paketas (pardavimui kitiems — šablonas)

Užpildykite prieš siūlymą klientui; teisinius punktus peržiūri juristas (repo čia tik struktūra).

### 3.1 Kas įeina į produktą

- Funkcijos (CRM moduliai): ****************\_****************
- Klientų portalas: taip / ne — apimtis: ************\_************
- Mokėjimai (Stripe): taip / ne — kas valdo rakto webhook: **\_\_\_**

### 3.2 Kaina ir terminas

- Modelis (vienkartinė / mėnesinis / metinis): ********\_\_\_********
- Suma ir valiuta: **********************\_**********************
- Pilotas (trukmė, kaina): ******************\_\_******************

### 3.3 Palaikymas

- Atsakymo laikas (pvz. darbo dienomis 24 h): ********\_\_\_********
- Kas neįeina (ribos): ********************\_\_********************

### 3.4 Sutarties juodraščio punktai (ne teisinis tekstas)

- Licencija / naudojimas / IP
- Duomenų valdymas (GDPR, Sub-procesoriai: Supabase, hostingas)
- Nutraukimas ir duomenų eksportas
- Atsakomybės ribos

---

## 4. Kai stabdyti tobulinimą be klientų

Jei §2.1 praeina ir §2.2 kritiniai punktai uždaryti, o 1–2 savaitės realaus naudojimo neparodo blokatorių — **verta pilotuoti**, o ne tik taisyti kodą be grįžtamojo ryšio.
