-- Leisti CRM rašymą įmonės savininkui, kurio profiles.role dar nėra 'admin' / 'staff'
-- (kitaip POST į employees, orders, inventory ir kt. duoda 403 Forbidden).
--
-- Logika: admin/staff kaip anksčiau, ARBA prisijungęs naudotojas yra pats
-- effective_workspace_owner_id() (workspace savininkas pagal profiles.workspace_owner_id).

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
  )
  OR (
    (SELECT auth.uid()) IS NOT NULL
    AND (SELECT auth.uid()) = (SELECT public.effective_workspace_owner_id())
  );
$$;

REVOKE ALL ON FUNCTION public.is_staff_or_admin() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.is_staff_or_admin() TO authenticated;
