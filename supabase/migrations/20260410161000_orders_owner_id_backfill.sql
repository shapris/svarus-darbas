-- orders: owner_id stulpelis + sutapdinimas su uid (senoji uid + camelCase schema),
-- kad sutaptų su RLS (owner_id / effective_workspace_owner_id) ir su getData filtru.
-- Jei migracijos 20260404140000 / 20260404200000 jau pritaikytos, bet stulpelis nebuvo
-- pridėtas — PostgREST gali grąžinti 400 skaitant orders.

ALTER TABLE public.orders
  ADD COLUMN IF NOT EXISTS owner_id uuid;

DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'orders'
      AND column_name = 'uid'
  ) THEN
    UPDATE public.orders o
    SET owner_id = o.uid::text::uuid
    WHERE o.owner_id IS NULL
      AND o.uid IS NOT NULL
      AND o.uid::text ~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$';
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_orders_owner_id ON public.orders (owner_id);
