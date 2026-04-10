# RLS santrauka (struktūra, be slaptų duomenų)

**Kanonas:** [`supabase/production_owner_id_schema.sql`](../supabase/production_owner_id_schema.sql) + migracijos [`20260404140000_crm_core_rls.sql`](../supabase/migrations/20260404140000_crm_core_rls.sql), [`20260404200000_workspace_owner_team_access.sql`](../supabase/migrations/20260404200000_workspace_owner_team_access.sql), [`20260407220000_notification_events_rls.sql`](../supabase/migrations/20260407220000_notification_events_rls.sql), [`20260409210000_workspace_memberships_rls_break_recursion.sql`](../supabase/migrations/20260409210000_workspace_memberships_rls_break_recursion.sql), [`20260410160000_employees_owner_id_backfill_and_rls.sql`](../supabase/migrations/20260410160000_employees_owner_id_backfill_and_rls.sql).

| Lentelė / grupė                               | Politikos esmė                                                                                                                                                 |
| --------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `profiles`                                    | `authenticated`: SELECT/INSERT/UPDATE tik sau (`uid = auth.uid()`).                                                                                            |
| `clients`, `orders`, `expenses`, …            | `authenticated`: FOR ALL su `owner_id = (select auth.uid())`.                                                                                                  |
| `inventory`, `memories`, `settings`           | Tas pats `owner_id` savininkui.                                                                                                                                |
| `orders` / `clients` (role = `client`)        | Papildomos SELECT politikos: mato tik susietą `client_id` per profilio funkcijas.                                                                              |
| `invoices`, `payment_intents`, `transactions` | Staff: pilnas valdymas savininkui; client: SELECT savo eilutėms (schema faile).                                                                                |
| `notification_events`                         | Tik **SELECT**: staff/admin — `owner_id` = `effective_workspace_owner_id`; client — `client_id` = profilio `client_id`. Įrašai tik per serverį (service role). |
| `workspace_memberships`                       | SELECT/INSERT/UPDATE per `workspace_membership_meets(workspace_id, roles[])` (SECURITY DEFINER), be rekursijos į tą pačią lentelę politikoje.                  |

**Legacy:** `anon_policies.sql` žymėtas **@deprecated** — gamyboje nenaudoti atviro anon prieigos.

**Našumas:** kur įmanoma, naudoti `(select auth.uid())` politikoje vietoj tiesioginio `auth.uid()` kvietimo (žr. migracijos komentarus).
