-- Apply schema fixes to memories table for Švarus Darbas CRM
-- Run this in Supabase SQL Editor

-- Add missing is_active column with default true
ALTER TABLE public.memories 
ADD COLUMN IF NOT EXISTS is_active BOOLEAN DEFAULT true;

-- Update category default to match app expectations ('fact' instead of 'kita')
ALTER TABLE public.memories 
ALTER COLUMN category SET DEFAULT 'fact';

-- Update importance default to match app expectations (3 instead of NULL)
ALTER TABLE public.memories 
ALTER COLUMN importance SET DEFAULT 3;

-- Verify the changes
SELECT column_name, data_type, column_default, is_nullable
FROM information_schema.columns 
WHERE table_name = 'memories' AND table_schema = 'public'
ORDER BY ordinal_position;