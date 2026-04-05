# RLS santrauka (struktūra, be slaptų duomenų)

**Kanonas:** [`supabase/production_owner_id_schema.sql`](../supabase/production_owner_id_schema.sql) + migracija [`supabase/migrations/20260404140000_crm_core_rls.sql`](../supabase/migrations/20260404140000_crm_core_rls.sql).

| Lentelė / grupė                               | Politikos esmė                                                                    |
| --------------------------------------------- | --------------------------------------------------------------------------------- |
| `profiles`                                    | `authenticated`: SELECT/INSERT/UPDATE tik sau (`uid = auth.uid()`).               |
| `clients`, `orders`, `expenses`, …            | `authenticated`: FOR ALL su `owner_id = (select auth.uid())`.                     |
| `inventory`, `memories`, `settings`           | Tas pats `owner_id` savininkui.                                                   |
| `orders` / `clients` (role = `client`)        | Papildomos SELECT politikos: mato tik susietą `client_id` per profilio funkcijas. |
| `invoices`, `payment_intents`, `transactions` | Staff: pilnas valdymas savininkui; client: SELECT savo eilutėms (schema faile).   |

**Legacy:** `anon_policies.sql` žymėtas **@deprecated** — gamyboje nenaudoti atviro anon prieigos.

**Našumas:** kur įmanoma, naudoti `(select auth.uid())` politikoje vietoj tiesioginio `auth.uid()` kvietimo (žr. migracijos komentarus).
