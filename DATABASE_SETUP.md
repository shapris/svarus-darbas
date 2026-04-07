# Supabase Database Setup for Svarus Darbas CRM

Šiame repo yra dvi istorines Supabase schemos kryptys. Prieš vykdydami SQL, pasirinkite vieną aiškų kelią ir nemaišykite jų tame pačiame projekte.

## Paprasčiausias būdas (komandų eilutės nereikia)

**Svarbu:** į SQL Editor **nekopijuokite** šio `DATABASE_SETUP.md` failo (tai dokumentacija, ne SQL — klaida `syntax error at or near "#"`). Kopijuokite tik **`.sql` failą** žemiau nurodytu keliu.

1. [Supabase Dashboard](https://supabase.com/dashboard) → jūsų projektas → **SQL Editor** → **New query**.
2. Atverkite repo faile **`supabase/migrations/20260404200000_workspace_owner_team_access.sql`** (ne `.md`!), nukopijuokite **visą** jo turinį į editorių (**nuo pirmos eilutės** — pradžioje yra `ALTER TABLE` ir stulpelis `workspace_owner_id`; vien tik `CREATE FUNCTION` iš pokalbio nepakanka).
3. **Run**.

`npm run db:apply-sql` ir `SUPABASE_DATABASE_URL` — tik jei norite tą patį daryti iš terminalo su `psql`; kasdieniam naudojimui užtenka SQL Editor.

## Schema track pasirinkimas

### Track A — dabartinis app runtime

Tai rekomenduojamas kelias dabartiniam `main`, nes jis atitinka `src/supabase.ts` užklausas ir viešos rezervacijos SQL:

- tenant stulpelis: `owner_id`
- dauguma laukų: `snake_case`
- vieša rezervacija: `supabase/public_booking_rpcs.sql`
- `profiles`: naudokite `client-portal-schema.sql`

Naudokite šį kelią, jei jūsų lentelėse matote `owner_id`, `client_id`, `price_per_window`, `client_name` ir pan.

### Track B — ankstesnė migracija

Tai sena, bet repo vis dar esanti schema iš `supabase/migrations/20250322120000_crm_schema.sql`:

- tenant stulpelis: `uid`
- dauguma laukų: kabantys `camelCase`, pvz. `"clientId"`, `"pricePerWindow"`
- viešos rezervacijos RPC jau aprašyti pačioje migracijoje
- `supabase/public_booking_rpcs.sql` ant šios schemos vykdyti nereikia

Naudokite šį kelią tik jei jūsų DB jau sukurta iš šios migracijos ir nenorite jos konvertuoti.

## Migracija iš terminalo (psql, ne SQL Editor)

Jei turite **Postgres slaptažodį** (Dashboard → Database → Database password) ir į `.env` įrašote pilną URI:

```env
SUPABASE_DATABASE_URL=postgresql://postgres:JUSU_SLAPT@db.<project-ref>.supabase.co:5432/postgres
```

(tik **lokaliai**; `.env` jau gitignore’intas.)

Tada su įdiegtu **`psql`** terminale:

```bash
npm run db:apply-sql -- supabase/migrations/20260404200000_workspace_owner_team_access.sql
```

Jei `psql` nerandamas — įdiekite [PostgreSQL CLI](https://www.postgresql.org/download/windows/) arba naudokite SQL Editor.

## Greitas patikrinimas SQL Editor

```sql
SELECT column_name
FROM information_schema.columns
WHERE table_schema = 'public'
  AND table_name = 'settings'
  AND column_name IN ('owner_id', 'uid')
ORDER BY column_name;
```

- Jei gaunate `owner_id` -> esate Track A.
- Jei gaunate `uid` -> esate Track B.

## Rekomenduojamas setup dabar

1. `profiles`: paleiskite `client-portal-schema.sql`
2. Jei jūsų CRM lentelės yra su `owner_id`, paleiskite `supabase/public_booking_rpcs.sql`
3. Jei naudojate mokėjimus per Supabase lenteles, papildomai peržiūrėkite `payments-schema.sql`
4. Paleiskite `npm run check:cloud` ir perskaitykite `Supabase schema track` sekciją
5. **RLS (Track A):** migracijų eilė `supabase/migrations/`:
   - `20260404135000_inventory_owner_id.sql` — jei `inventory` dar turi seną `uid` (text), pirmiausia suvienodina į `owner_id`
   - `20260404140000_crm_core_rls.sql` — CRM lentelių RLS + kliento portalo skaitymas
   - `20260404180000_rls_auth_uid_initplan.sql` — workspace / quotes / mokėjimų RLS našumas (`(select auth.uid())`)
   - `20260404200000_workspace_owner_team_access.sql` — **komanda:** `profiles.workspace_owner_id` + RLS pagal `effective_workspace_owner_id()` (admin/staff dalijasi vienu CRM). Po šito darbuotojo profilis prijungiamas prie admino, pvz.:
     ```sql
     UPDATE public.profiles
     SET workspace_owner_id = '<ADMINO_AUTH_UUID>'::uuid
     WHERE uid = '<DARBUOTOJO_UID_TEKSTU>';
     ```
   - `20260407160000_profiles_uid_unique.sql` — užtikrina `public.profiles(uid)` unikalumą po saugaus dublikatų valymo; po šios migracijos patikimai veikia `ON CONFLICT (uid)`.
6. **Auth (Dashboard):** įjunkite _Leaked password protection_ (Have I Been Pwned), kad sumažintumėte silpnų slaptažodžių riziką.

## Svarbios pastabos

- Nevartokite kartu `supabase/public_booking_rpcs.sql` ir `supabase/migrations/20250322120000_crm_schema.sql` viešos rezervacijos dalies tam pačiam projektui.
- `src/supabase.ts` šiuo metu labiausiai orientuotas į `owner_id + snake_case` kelią.
- Jei jūsų DB dar sena (`uid + camelCase`), prieš didesnius pakeitimus geriau planuoti atskirą migraciją, o ne maišyti abi konvencijas ranka.
- **Nenaudokite** `anon_policies.sql` gamyboje — jis atveria duomenis anon rolei; tai palikta tik kaip istorinis įspėjimas faile.

## Environment Variables

Create `.env` file:

```
# Supabase Configuration
VITE_SUPABASE_URL=https://your-project.supabase.co
VITE_SUPABASE_ANON_KEY=your-anon-key

# OpenRouter AI Configuration
VITE_OPENROUTER_API_KEY=sk-or-v1-your-key-here

# App Configuration
VITE_APP_NAME="Langių Valymas CRM"
VITE_APP_VERSION=1.0.0
```

## Setup Instructions

1. Create Supabase project at https://supabase.com
2. Decide which schema track your project uses
3. Run only the matching SQL in Supabase SQL Editor
4. Enable Email auth in Authentication settings
5. Copy project URL and anon key to .env file
6. Get OpenRouter API key from https://openrouter.ai
7. Add key to .env file
8. Build and deploy

## Deployment

```bash
# Install dependencies
npm install

# Build for production
npm run build

# Deploy to Netlify
npx netlify deploy --prod --dir=dist
```
