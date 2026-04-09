-- employees: owner_id stulpelis + sutapdinimas su uid (senoji schema), tada RLS WITH CHECK
-- nebelieka 403, kai įraše buvo tik uid, o politikos tikrino owner_id.
--
-- Paleiskite visą failą Supabase SQL Editor (PRODUCTION).

-- 1) Stulpelis owner_id (be NOT NULL pirmame žingsnyje — saugiau esantiems įrašams)
ALTER TABLE public.employees
  ADD COLUMN IF NOT EXISTS owner_id uuid;

-- 2) Užpildyti iš uid (tekstinio uuid), jei stulpelis uid dar yra
DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'employees'
      AND column_name = 'uid'
  ) THEN
    UPDATE public.employees e
    SET owner_id = e.uid::text::uuid
    WHERE e.owner_id IS NULL
      AND e.uid IS NOT NULL
      AND e.uid::text ~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$';
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_employees_owner_id ON public.employees (owner_id);

-- 3) Nuimti pasenusias politikas (vardai iš skirtingų migracijų)
DROP POLICY IF EXISTS crm_employees_rw ON public.employees;
DROP POLICY IF EXISTS employees_owner_all ON public.employees;
DROP POLICY IF EXISTS employees_staff_org_all ON public.employees;

-- 4) Viena aiški politika: eilutė priklauso effective workspace savininkui;
--    rašyti gali staff/admin ARBA pats tas savininkas (auth.uid = effective_workspace_owner_id).
CREATE POLICY employees_workspace_org_all ON public.employees
  FOR ALL TO authenticated
  USING (
    owner_id = (SELECT public.effective_workspace_owner_id())
    AND (
      (SELECT public.is_staff_or_admin())
      OR (SELECT auth.uid()) = (SELECT public.effective_workspace_owner_id())
    )
  )
  WITH CHECK (
    owner_id = (SELECT public.effective_workspace_owner_id())
    AND (
      (SELECT public.is_staff_or_admin())
      OR (SELECT auth.uid()) = (SELECT public.effective_workspace_owner_id())
    )
  );
