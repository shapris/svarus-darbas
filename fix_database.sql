-- Quick fix: Add missing tables and columns
-- Run this in Supabase SQL Editor

-- 1. Add employees table (missing!)
CREATE TABLE IF NOT EXISTS employees (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL,
    email TEXT,
    phone TEXT,
    role TEXT DEFAULT 'staff',
    status TEXT DEFAULT 'active',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    owner_id UUID NOT NULL
);

ALTER TABLE employees ENABLE ROW LEVEL SECURITY;

CREATE POLICY "employees_select" ON employees FOR SELECT USING (auth.uid() = owner_id);
CREATE POLICY "employees_insert" ON employees FOR INSERT WITH CHECK (auth.uid() = owner_id);
CREATE POLICY "employees_update" ON employees FOR UPDATE USING (auth.uid() = owner_id);
CREATE POLICY "employees_delete" ON employees FOR DELETE USING (auth.uid() = owner_id);

-- 2. Fix expenses table - add missing columns
ALTER TABLE expenses ADD COLUMN IF NOT EXISTS created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW();

-- 3. Add missing indexes
CREATE INDEX IF NOT EXISTS idx_employees_owner ON employees(owner_id);
