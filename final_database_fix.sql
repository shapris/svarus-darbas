-- Complete database fix
-- Run this in Supabase SQL Editor

-- FIX 1: Add missing columns to expenses table
ALTER TABLE expenses ADD COLUMN IF NOT EXISTS owner_id UUID;
ALTER TABLE expenses ADD COLUMN IF NOT EXISTS created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW();

-- FIX 2: Add employees table (completely missing)
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

CREATE POLICY IF NOT EXISTS "employees_select" ON employees FOR SELECT USING (auth.uid() = owner_id);
CREATE POLICY IF NOT EXISTS "employees_insert" ON employees FOR INSERT WITH CHECK (auth.uid() = owner_id);
CREATE POLICY IF NOT EXISTS "employees_update" ON employees FOR UPDATE USING (auth.uid() = owner_id);
CREATE POLICY IF NOT EXISTS "employees_delete" ON employees FOR DELETE USING (auth.uid() = owner_id);

-- FIX 3: Add missing indexes
CREATE INDEX IF NOT EXISTS idx_employees_owner ON employees(owner_id);
CREATE INDEX IF NOT EXISTS idx_expenses_owner ON expenses(owner_id);

-- FIX 4: Ensure all tables have created_at column
ALTER TABLE clients ADD COLUMN IF NOT EXISTS created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW();
ALTER TABLE orders ADD COLUMN IF NOT EXISTS created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW();
ALTER TABLE settings ADD COLUMN IF NOT EXISTS created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW();
ALTER TABLE memories ADD COLUMN IF NOT EXISTS created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW();
