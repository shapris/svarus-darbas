# Nuolatinė darbotvarkė (agentui ir komandai)

**Tikslas:** kai nėra konkrečios vartotojo užduoties arba prašoma tik „tęsk / dirbk toliau“, vykdyti **pirmą nepažymėtą** punktą pagal **P0 → P1** eilę, iki galo su patikra, tada čia pažymėti atlikta ir data.

## Kaip vykdyti (kiekviena sesija)

1. Perskaityti šį failą ir rasti pirmą `- [ ]` **P0** bloke; jei visi P0 atlikti — imti **P1**.
2. **Įgyvendinti** (kodas, SQL instrukcija, konfigūracija) arba, jei blokuoja tik projekto savininkas (pvz. Supabase prisijungimas), paruošti viską, ką galima repo viduje, ir trumpai užrašyti „Žurnalai“ skiltyje, ką dar turi padaryti žmogus.
3. Paleisti **`npm run lint`**; jei keistas UI/backend elgesys — **`npm run build`** (ir smoke, jei tinka).
4. Atnaujinti šį failą: pažymėti `- [x]`, įrašyti datą į „Žurnalai“.
5. Papildomai (nebūtina kiekvieną kartą): **`npm run scout:improvements`** — atnaujins `improvement-backlog.md`.

---

## P0 — gamybinė / duomenų vientisumas

- [ ] **Vieša rezervacija Supabase (cloud):** SQL Editor — visas `supabase/public_booking_rpcs.sql` **tik jei** lentelės su `owner_id` (dabartinis app). Jei DB iš ankstesnės migracijos su `uid` — RPC jau yra `20250322120000_crm_schema.sql`; nevykdyti abiejų. Repo: painiava paaiškinta SQL antraštėje + migracijos komentaras (2026-03-31).
- [x] **`npm audit` (high):** sutvarkyti arba dokumentuoti nepritaikomas high spragas (`npm audit`, išskyrus sąmoningai atidėtus atvejus su priežastimi žemiau „Žurnalai“). *2026-03-31: `package.json` → `overrides.serialize-javascript@7.0.5` (PWA/workbox grandinė), `npm audit` = 0.*

---

## P1 — sauga, patikimumas, kokybė

- [x] **`server.cjs` sukietinimas:** CORS ne `*`, o leidžiamų origino sąrašas per env; dokumentuoti `STRIPE_SECRET_KEY`; nepalikti nutekėjusių placeholder flow produkcijoje be įspėjimo. *2026-03-31: `CORS_ORIGINS`, numatytieji localhost portai, production warn be Stripe; `.env.example`.*
- [ ] **Konsolės triukšmas:** peržiūrėti dažniausius `console.error` CRM srautuose (`src/supabase.ts` ir pan.) — palikti tik naudingus; likusius pakeisti į sąmoningą `warn` / tylus failas su toast vartotojui kur reikia.
- [ ] **„Demo“ paskyros rizika:** jei `demo@example.com` naudojama jūsų Supabase — dokumentuoti `.env.example` / viduje, kad produkcijoje reikia pakeisti slaptažodį ar apriboti registraciją.
- [ ] **Bundle dydis:** įvertinti Vite įspėjimus apie >500 kB chunk; planuoti papildomą `import()` skaidymą (`vendor`).

---

## Žurnalai (atlikta / pastabos)

| Data       | Punktas | Kas padaryta |
|------------|---------|--------------|
| 2026-03-31 | —       | Sukurta darbotvarkė + taisyklės `always-on-workflow.mdc`. |
| 2026-03-31 | npm audit high | `serialize-javascript@7.0.5` per npm overrides; audit 0; build OK. |
| 2026-03-31 | server CORS | `server.cjs` + `.env.example`; P0 booking schema doc SQL/migracijoje. |

*(Agentai: pridėkite eilutę kiekvieną kartą, kai uždarote eilės punktą.)*
