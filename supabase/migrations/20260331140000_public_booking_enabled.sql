-- Vieša rezervacija: įjungta/išjungta (CRM nustatymai → DB; RPC grąžina lauką ir tikrina submit).
ALTER TABLE public.settings ADD COLUMN IF NOT EXISTS public_booking_enabled boolean NOT NULL DEFAULT true;
