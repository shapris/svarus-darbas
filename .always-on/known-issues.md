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
  - `eslint-plugin-react-hooks@7.0.1` (npm `peerDependencies`) vis dar leidžia tik `eslint` iki **`^9.0.0`** (`^3`–`^9`), be `^10`.
- Sprendimas / mitigacija:
  - Laikyti `eslint@9` kol `eslint-plugin-react-hooks` (ar alternatyva) oficialiai palaikys `eslint@10`.
  - Neapeidinėti su `--force/--legacy-peer-deps` be aiškaus motyvo (rizika įsivaryti nestabilų lint).
- Saugiklis (testas/diagnostika):
  - `npm run lint:eslint` turi būti žalias esamame toolchain.
- Pastabos:
  - *2026-04-10:* pakartotinai patvirtinta per `npm view eslint-plugin-react-hooks peerDependencies` — `eslint@10` vis dar neįtrauktas.
  - *2026-04-10:* projekte įdiegtas **`eslint-plugin-react-hooks@7.0.1`** (su `eslint@9`); nauja taisyklė `react-hooks/refs` — `useToast` ref sinchronizuojamas per `useEffect`.

---

## KI-004 — Vite 8 upgrade stringa su `@vitejs/plugin-react` peer rezoliucija

- Būsena: open
- Poveikis: P3 (tooling skola; funkcionalumas nelūžęs)
- Simptomai:
  - `npm i -D vite@^8 @vitejs/plugin-react@^6` grąžina `ERESOLVE could not resolve`.
- Priežastis:
  - **`vite-plugin-pwa@1.2.0`** (`peerDependencies.vite`) leidžia tik **`^3–^7`**, ne `^8` — net ir su `@vitejs/plugin-react@6` + `vite@8` vienu prisėdimu npm vis dar nutraukia rezoliuciją.
  - **`@tailwindcss/vite` + `tailwindcss` repo `^4.2.2`** — Tailwind peer jau leidžia `vite@^8`; kietasis blokas liko tik **PWA** pluginas.
- Sprendimas / mitigacija:
  - Laikyti `vite@6` + `@vitejs/plugin-react@5` kol **`vite-plugin-pwa`** (ar pakaitalas) oficialiai palaikys `vite@^8`, arba suplanuotas atskiras PWA perkėlimo etapas.
  - `@vitejs/plugin-react` laikyti `devDependencies` (ne `dependencies`) — sutvarkyta.
- Saugiklis (testas/diagnostika):
  - `npm run verify` žalias po dependency korekcijų.
- Pastabos:
  - *2026-04-10:* bandyta `npm install -D vite@8.0.8 @vitejs/plugin-react@6.0.1` — `ERESOLVE`; root cause patvirtinta per `npm view vite-plugin-pwa@1.2.0 peerDependencies`.

---

## KI-005 — `workspace_memberships` RLS: infinite recursion

- Būsena: fixed (2026-04-09: migracija pritaikyta production DB; funkcija `workspace_membership_meets(text, text[])` — `workspace_id` stulpelis `text`)
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
  - Rankinis: Mokėjimai po RLS fix; regresija: `npm run verify` (arba bent `test:smoke` + lint).
  - DB: politikos ir funkcijos parašas gali būti patikrintas (`pg_proc` / `pg_policies`).
