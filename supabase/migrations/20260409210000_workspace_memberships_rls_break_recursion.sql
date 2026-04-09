-- workspace_memberships RLS: pašalinti begalinę rekursiją.
-- Problema: politikos naudojo EXISTS (SELECT ... workspace_memberships viewer ...),
-- todėl kiekvienas SELECT iš workspace_memberships vėl tikrino RLS ant tos pačios lentelės.
-- Sprendimas: narystės tikrinimas SECURITY DEFINER funkcijoje (vykdoma be RLS lentelės skaitymui).
--
-- pastaba: dalis aplinkų `workspace_id` laiko kaip text, dalis — uuid; naudojame **text**
-- parametrą ir lyginame su m.workspace_id::text, kad veiktų abiem atvejam.

DROP FUNCTION IF EXISTS public.workspace_membership_meets(uuid, text[]);

CREATE OR REPLACE FUNCTION public.workspace_membership_meets(
  p_workspace_id text,
  p_roles text[]
)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.workspace_memberships m
    WHERE m.workspace_id::text = trim(p_workspace_id)
      AND m.user_id = (SELECT auth.uid())::text
      AND m.status = 'active'
      AND m.role = ANY (p_roles)
  );
$$;

REVOKE ALL ON FUNCTION public.workspace_membership_meets(text, text[]) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.workspace_membership_meets(text, text[]) TO authenticated;
GRANT EXECUTE ON FUNCTION public.workspace_membership_meets(text, text[]) TO service_role;

COMMENT ON FUNCTION public.workspace_membership_meets(text, text[]) IS
  'RLS helper: ar dabartinis naudotojas turi aktyvą narystę workspace su viena iš p_roles (be rekursijos).';

-- SELECT: savo eilutė ARBA owner/admin/manager mato visą komandą toje darbo erdvėje
DROP POLICY IF EXISTS membership_workspace_select ON public.workspace_memberships;
CREATE POLICY membership_workspace_select ON public.workspace_memberships FOR SELECT TO authenticated
  USING (
    user_id = (SELECT auth.uid())::text
    OR public.workspace_membership_meets(
      workspace_memberships.workspace_id::text,
      ARRAY['owner', 'admin', 'manager']::text[]
    )
  );

-- INSERT: owner/admin gali kviesti narius; arba naudotojas kuria sau įrašą
DROP POLICY IF EXISTS membership_owner_admin_insert ON public.workspace_memberships;
CREATE POLICY membership_owner_admin_insert ON public.workspace_memberships FOR INSERT TO authenticated
  WITH CHECK (
    public.workspace_membership_meets(
      workspace_memberships.workspace_id::text,
      ARRAY['owner', 'admin']::text[]
    )
    OR user_id = (SELECT auth.uid())::text
  );

-- UPDATE: tik owner/admin
DROP POLICY IF EXISTS membership_owner_admin_update ON public.workspace_memberships;
CREATE POLICY membership_owner_admin_update ON public.workspace_memberships FOR UPDATE TO authenticated
  USING (
    public.workspace_membership_meets(
      workspace_memberships.workspace_id::text,
      ARRAY['owner', 'admin']::text[]
    )
  )
  WITH CHECK (
    public.workspace_membership_meets(
      workspace_memberships.workspace_id::text,
      ARRAY['owner', 'admin']::text[]
    )
  );
