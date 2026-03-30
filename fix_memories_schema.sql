-- Fix memories table schema for Švarus Darbas CRM
-- Add missing columns and update defaults as needed

ALTER TABLE public.memories 
ADD COLUMN IF NOT EXISTS is_active BOOLEAN DEFAULT true;

-- Update category default to match app expectations
ALTER TABLE public.memories 
ALTER COLUMN category SET DEFAULT 'fact';

-- Update importance default to match app expectations  
ALTER TABLE public.memories 
ALTER COLUMN importance SET DEFAULT 3;
