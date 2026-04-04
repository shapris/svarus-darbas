-- Paleisti PRIEŠ 20260404140000_crm_core_rls.sql jei inventory dar turi `uid` (text).
-- Idempotent: naujame projekte be `uid` stulpelio užklausos praleidžiamos.

ALTER TABLE public.inventory ADD COLUMN IF NOT EXISTS owner_id uuid REFERENCES auth.users(id) ON DELETE CASCADE;

DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'inventory'
      AND column_name = 'uid'
  ) THEN
    UPDATE public.inventory SET owner_id = uid::uuid WHERE owner_id IS NULL AND uid IS NOT NULL;
    ALTER TABLE public.inventory DROP COLUMN uid;
  END IF;
END $$;

ALTER TABLE public.inventory ALTER COLUMN owner_id SET NOT NULL;

DROP POLICY IF EXISTS inventory_owner_all ON public.inventory;
CREATE POLICY inventory_owner_all ON public.inventory FOR ALL TO authenticated
  USING (owner_id = (SELECT auth.uid()))
  WITH CHECK (owner_id = (SELECT auth.uid()));

CREATE INDEX IF NOT EXISTS idx_inventory_owner_id ON public.inventory(owner_id);
