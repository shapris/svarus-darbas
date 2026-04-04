-- Vieša rezervacija: įjungta/išjungta (CRM nustatymai → DB; RPC grąžina lauką ir tikrina submit).
--
-- Susiję failai:
-- • Track A (owner_id + snake_case): po šios migracijos viešai rezervacijai dar reikia
--   supabase/public_booking_rpcs.sql (SQL Editor) — žr. to failo antraštę ir „Cloud checklist“.
-- • Track B (uid + legacy migracija 20250322120000): RPC jau gali būti toje migracijoje —
--   public_booking_rpcs.sql NEVYKDYKITE (perrašysite funkcijas kita konvencija).

ALTER TABLE public.settings ADD COLUMN IF NOT EXISTS public_booking_enabled boolean NOT NULL DEFAULT true;
