-- Komandinė prieiga: CRM eilutės (owner_id) priklauso „įmonės“ savininkui (auth.users id),
-- o admin/staff mato tą patį workspace pagal profiles.workspace_owner_id.
-- Klientų portalo saviregistracija: clients eilutė su owner_id = auth.uid() lieka per clients_client_own_*.
-- Pakartotinis paleidimas: saugu (DROP POLICY IF EXISTS + CREATE OR REPLACE funkcija).
--
-- SVARBU: SQL Editor paleiskite VISĄ šį failą nuo pirmos iki paskutinės eilutės.
-- Jei paleisite tik CREATE FUNCTION effective_workspace_owner_id — klaida „column workspace_owner_id does not exist“,
-- nes pirmiausia turi įvykti ALTER TABLE (eilutės ~20–21), kuris prideda stulpelį.

DROP POLICY IF EXISTS clients_staff_org_all ON public.clients;
DROP POLICY IF EXISTS clients_client_own_all ON public.clients;

DO $$
DECLARE
  t text;
BEGIN
  FOR t IN
    SELECT unnest(ARRAY['orders','expenses','employees','inventory','memories','settings'])
  LOOP
    EXECUTE format('DROP POLICY IF EXISTS %I ON public.%I', t || '_staff_org_all', t);
  END LOOP;
END $$;

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS workspace_owner_id uuid REFERENCES auth.users(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_profiles_workspace_owner_id ON public.profiles(workspace_owner_id);

-- Esami profiliai: workspace = pats naudotojas
-- uid gali būti text arba uuid schemoje — regex tik ant text (operatorius ~).
UPDATE public.profiles p
SET workspace_owner_id = p.uid::text::uuid
WHERE p.workspace_owner_id IS NULL
  AND p.uid::text ~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$';

CREATE OR REPLACE FUNCTION public.effective_workspace_owner_id()
RETURNS uuid
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT COALESCE(
    (
      SELECT w.workspace_owner_id
      FROM public.profiles w
      WHERE w.uid::text = (SELECT auth.uid())::text
      LIMIT 1
    ),
    (SELECT auth.uid())
  );
$$;

REVOKE ALL ON FUNCTION public.effective_workspace_owner_id() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.effective_workspace_owner_id() TO authenticated;

-- Nuimti seną vieną politiką ant kiekvienos lentelės
DO $$
DECLARE
  t text;
BEGIN
  FOR t IN
    SELECT unnest(ARRAY['clients','orders','expenses','employees','inventory','memories','settings'])
  LOOP
    EXECUTE format('DROP POLICY IF EXISTS %I ON public.%I', t || '_owner_all', t);
  END LOOP;
END $$;

-- Klientai: admin/staff — org workspace; portal client — savo eilutės kaip savininkas
CREATE POLICY clients_staff_org_all ON public.clients
  FOR ALL TO authenticated
  USING (
    (SELECT public.is_staff_or_admin())
    AND owner_id = (SELECT public.effective_workspace_owner_id())
  )
  WITH CHECK (
    (SELECT public.is_staff_or_admin())
    AND owner_id = (SELECT public.effective_workspace_owner_id())
  );

CREATE POLICY clients_client_own_all ON public.clients
  FOR ALL TO authenticated
  USING (
    (SELECT public.current_user_role()) = 'client'
    AND owner_id = (SELECT auth.uid())
  )
  WITH CHECK (
    (SELECT public.current_user_role()) = 'client'
    AND owner_id = (SELECT auth.uid())
  );

-- Kitos owner_id lentelės: tik admin/staff, org scope
DO $$
DECLARE
  t text;
BEGIN
  FOR t IN
    SELECT unnest(ARRAY['orders','expenses','employees','inventory','memories','settings'])
  LOOP
    EXECUTE format(
      $f$
      CREATE POLICY %I ON public.%I FOR ALL TO authenticated
      USING (
        (SELECT public.is_staff_or_admin())
        AND owner_id = (SELECT public.effective_workspace_owner_id())
      )
      WITH CHECK (
        (SELECT public.is_staff_or_admin())
        AND owner_id = (SELECT public.effective_workspace_owner_id())
      )
      $f$,
      t || '_staff_org_all',
      t
    );
  END LOOP;
END $$;
