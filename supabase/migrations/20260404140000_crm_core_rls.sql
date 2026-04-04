-- CRM branduolio RLS: owner_id izoliacija + kliento portalo skaitymas.
-- Šalina Supabase linter ERROR: RLS išjungtas viešose CRM lentelėse.
-- Pagalba: production_owner_id_schema.sql (funkcijų semantika), našumui — (select auth.uid()).

-- -----------------------------------------------------------------------------
-- Pagalbinės funkcijos (SECURITY DEFINER; politikos jų neklauso RLS ant profiles)
-- -----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.current_user_role()
RETURNS text
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT p.role
  FROM public.profiles p
  WHERE p.uid = (SELECT auth.uid())
  LIMIT 1;
$$;

CREATE OR REPLACE FUNCTION public.current_client_id()
RETURNS text
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT p.client_id::text
  FROM public.profiles p
  WHERE p.uid = (SELECT auth.uid())
  LIMIT 1;
$$;

CREATE OR REPLACE FUNCTION public.is_staff_or_admin()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT COALESCE(
    (SELECT public.current_user_role()) IN ('admin', 'staff'),
    false
  );
$$;

REVOKE ALL ON FUNCTION public.current_user_role() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.current_client_id() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.is_staff_or_admin() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.current_user_role() TO authenticated;
GRANT EXECUTE ON FUNCTION public.current_client_id() TO authenticated;
GRANT EXECUTE ON FUNCTION public.is_staff_or_admin() TO authenticated;

-- -----------------------------------------------------------------------------
-- Įjungti RLS
-- -----------------------------------------------------------------------------
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.clients ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.expenses ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.employees ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.inventory ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.memories ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.settings ENABLE ROW LEVEL SECURITY;

-- -----------------------------------------------------------------------------
-- profiles: tik savo eilutė
-- -----------------------------------------------------------------------------
DROP POLICY IF EXISTS profiles_select_own ON public.profiles;
DROP POLICY IF EXISTS profiles_insert_own ON public.profiles;
DROP POLICY IF EXISTS profiles_update_own ON public.profiles;

CREATE POLICY profiles_select_own ON public.profiles
  FOR SELECT TO authenticated
  USING (uid = (SELECT auth.uid()));

CREATE POLICY profiles_insert_own ON public.profiles
  FOR INSERT TO authenticated
  WITH CHECK (uid = (SELECT auth.uid()));

CREATE POLICY profiles_update_own ON public.profiles
  FOR UPDATE TO authenticated
  USING (uid = (SELECT auth.uid()))
  WITH CHECK (uid = (SELECT auth.uid()));

-- -----------------------------------------------------------------------------
-- inventory: nuimti atvirą politika (jei buvo)
-- -----------------------------------------------------------------------------
DROP POLICY IF EXISTS "Allow all inventory" ON public.inventory;

-- -----------------------------------------------------------------------------
-- owner_id lentelės: viskas tik savininkui (įskaitant inventory po 20260404160000)
-- -----------------------------------------------------------------------------
DO $$
DECLARE
  t text;
BEGIN
  FOR t IN
    SELECT unnest(ARRAY['clients','orders','expenses','employees','inventory','memories','settings'])
  LOOP
    EXECUTE format('DROP POLICY IF EXISTS %I ON public.%I', t || '_owner_all', t);
    EXECUTE format(
      'CREATE POLICY %I ON public.%I FOR ALL TO authenticated USING (owner_id = (SELECT auth.uid())) WITH CHECK (owner_id = (SELECT auth.uid()))',
      t || '_owner_all',
      t
    );
  END LOOP;
END $$;

-- -----------------------------------------------------------------------------
-- Klientas (role = client): mato savo clients / orders eilutes pagal profilį
-- -----------------------------------------------------------------------------
DROP POLICY IF EXISTS clients_client_select ON public.clients;
DROP POLICY IF EXISTS orders_client_select ON public.orders;

CREATE POLICY clients_client_select ON public.clients
  FOR SELECT TO authenticated
  USING (
    (SELECT public.current_user_role()) = 'client'
    AND id::text = (SELECT public.current_client_id())
  );

CREATE POLICY orders_client_select ON public.orders
  FOR SELECT TO authenticated
  USING (
    (SELECT public.current_user_role()) = 'client'
    AND client_id IS NOT NULL
    AND client_id::text = (SELECT public.current_client_id())
  );

-- -----------------------------------------------------------------------------
-- Našumas: FK indeksai ant transactions (linter INFO)
-- -----------------------------------------------------------------------------
CREATE INDEX IF NOT EXISTS idx_transactions_invoice_id ON public.transactions(invoice_id);
CREATE INDEX IF NOT EXISTS idx_transactions_payment_intent_id ON public.transactions(payment_intent_id);
