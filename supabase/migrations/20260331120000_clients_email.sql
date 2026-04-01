-- Kliento el. paštas (sąskaitų siuntimui / CRM)
ALTER TABLE public.clients ADD COLUMN IF NOT EXISTS email text;
