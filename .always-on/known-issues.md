# Žinomos problemos / rizikos (kanoninis registras)

Tikslas: turėti vieną vietą, kur aiškiai matosi **kas žinoma**, **kaip atkartoti**, **koks workaround**, ir **koks testas/diagnostika saugo nuo regresijos**.

## Šablonas

```md
## <ID> — <Trumpas pavadinimas>

- Būsena: open | mitigated | fixed | wontfix
- Poveikis: P0 | P1 | P2 | P3
- Simptomai:
- Priežastis:
- Atkūrimas:
- Sprendimas / mitigacija:
- Saugiklis (testas/diagnostika):
- Pastabos:
```

---

## KI-001 — PostgREST 400 dėl neteisingo `select=` (orders schema)

- Būsena: mitigated
- Poveikis: P0 (gali sukelti serverio grandinines klaidas, iki 502 hostinge)
- Simptomai:
  - Supabase REST grąžina `400` ant `.../rest/v1/orders?...&select=...`
  - Hostingas (pvz., Render) kartais mato `502` srautuose, kur serveris kviečia Supabase su neteisingu `select`.
- Priežastis:
  - `select=` užklausoje nurodyti stulpeliai, kurių schemoje nėra (camelCase vs `snake_case`, pvz. `clientId` vietoje `client_id`).
- Atkūrimas:
  - Pabandyk užklausti `orders` per REST su neegzistuojančiu stulpeliu `select` dalyje.
- Sprendimas / mitigacija:
  - Serverio pusėje naudoti tik realius stulpelius (`id,client_id,owner_id,...`) ir vengti spėliojimo.
- Saugiklis (testas/diagnostika):
  - Repo „atmintis“: `.always-on/session-log.md` pamoka apie `select`.
  - (Papildomai) `/health` diagnostika padeda identifikuoti backend pasiekiamumą.
- Pastabos:
  - Jei DB schema realiai skiriasi (legacy), reikia aiškiai įvardinti track ir atskirti logiką.

---

## KI-002 — E2E preview be `server.cjs`: Vite proxy triukšmas į :3001

- Būsena: mitigated
- Poveikis: P3 (triukšmas testų output, klaidina)
- Simptomai:
  - Playwright testuose matosi `[vite] http proxy error: /health` ir `ECONNREFUSED 127.0.0.1:3001`, nors testas praeina.
- Priežastis:
  - Preview serveris bando proxy’inti `/health` į :3001, kai `server.cjs` sąmoningai nepaleistas.
- Sprendimas / mitigacija:
  - Įjungtas tylus loggeris per `VITE_SILENT_EXPECTED_PROXY_ERRORS=true` E2E metu.
- Saugiklis (testas/diagnostika):
  - `npm run test:invoice` praeina be klaidinančio proxy log’o.

---

## KI-003 — ESLint 10 upgrade blokuoja peer dependency (react-hooks)

- Būsena: open
- Poveikis: P3 (nefunkcinis; techninė skola / tooling)
- Simptomai:
  - `npm i -D eslint@^10 ...` meta `ERESOLVE unable to resolve dependency tree`.
- Priežastis:
  - `eslint-plugin-react-hooks@7.x` peer range nepalaiko `eslint@10` (reikalauja `^9` ar žemiau).
- Sprendimas / mitigacija:
  - Laikyti `eslint@9` kol `eslint-plugin-react-hooks` (ar alternatyva) oficialiai palaikys `eslint@10`.
  - Neapeidinėti su `--force/--legacy-peer-deps` be aiškaus motyvo (rizika įsivaryti nestabilų lint).
- Saugiklis (testas/diagnostika):
  - `npm run lint:eslint` turi būti žalias esamame toolchain.

---

## KI-004 — Vite 8 upgrade stringa su `@vitejs/plugin-react` peer rezoliucija

- Būsena: open
- Poveikis: P3 (tooling skola; funkcionalumas nelūžęs)
- Simptomai:
  - `npm i -D vite@^8 @vitejs/plugin-react@^6` grąžina `ERESOLVE could not resolve`.
- Priežastis:
  - npm dependency tree rezoliucija konfliktuoja tarp esamo `@vitejs/plugin-react@5` ir siekiamo `6` pereinamojoje būsenoje.
- Sprendimas / mitigacija:
  - Laikyti `vite@6` + `@vitejs/plugin-react@5` kol suplanuotas atskiras controlled upgrade langas.
  - `@vitejs/plugin-react` laikyti `devDependencies` (ne `dependencies`) — sutvarkyta.
- Saugiklis (testas/diagnostika):
  - `npm run verify` žalias po dependency korekcijų.

---

## KI-005 — `workspace_memberships` RLS: infinite recursion

- Būsena: mitigated (repo migracija; taikyti Supabase SQL Editor arba CLI)
- Poveikis: P1 (Mokėjimų / sąskaitų skiltis gali neįsikrauti; baisus neapdorotas Postgres tekstas vartotojui)
- Simptomai:
  - Klaida panaši į: `infinite recursion detected in policy for relation "workspace_memberships"`.
  - `PaymentsView` / `fetchPaymentsWorkspaceData` negali užbaigti užklausų.
- Priežastis:
  - RLS politika ant `workspace_memberships` (ar susijusių lentelių) rekursyviai tikrina tą pačią lentelę be išėjimo / be helper funkcijos su `SECURITY DEFINER`.
- Atkūrimas:
  - Prisijungus CRM atidaryti **Mokėjimai** su paskyra, kuri eina per workspace RLS (ne service role).
- Sprendimas / mitigacija:
  - **DB:** migracija `20260409210000_workspace_memberships_rls_break_recursion.sql` — `workspace_membership_meets()` + politikos be įterptinio `EXISTS` į tą pačią lentelę.
  - **UI:** `sanitizeSupabaseErrorForDisplay` (`src/utils/networkErrors.ts`) — neberodyti neapdoroto Postgres teksto.
- Saugiklis (testas/diagnostika):
  - Rankinis: Mokėjimai po RLS fix / regresija: `npm run test:smoke` ir lint.
