-- Fix missing columns in Supabase database schema
-- Run this in Supabase SQL Editor to fix all schema issues

-- Step 1: Add owner_id columns to all tables (if they don't exist)
ALTER TABLE clients ADD COLUMN IF NOT EXISTS owner_id UUID;
ALTER TABLE orders ADD COLUMN IF NOT EXISTS owner_id UUID;
ALTER TABLE expenses ADD COLUMN IF NOT EXISTS owner_id UUID;
ALTER TABLE settings ADD COLUMN IF NOT EXISTS owner_id UUID;
ALTER TABLE memories ADD COLUMN IF NOT EXISTS owner_id UUID;

-- Step 2: Add missing columns to CLIENTS table
ALTER TABLE clients ADD COLUMN IF NOT EXISTS notes TEXT;
ALTER TABLE clients ADD COLUMN IF NOT EXISTS last_cleaning_date TIMESTAMP WITH TIME ZONE;

-- Step 3: Add missing columns to MEMORIES table (for AI features)
ALTER TABLE memories ADD COLUMN IF NOT EXISTS category TEXT DEFAULT 'kita';
ALTER TABLE memories ADD COLUMN IF NOT EXISTS importance INTEGER DEFAULT 3;
ALTER TABLE memories ADD COLUMN IF NOT EXISTS is_active BOOLEAN DEFAULT true;
ALTER TABLE memories ADD COLUMN IF NOT EXISTS event_date TIMESTAMP WITH TIME ZONE;

-- Step 4: Create employees table if it doesn't exist
CREATE TABLE IF NOT EXISTS employees (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL,
    phone TEXT,
    color TEXT DEFAULT '#3B82F6',
    is_active BOOLEAN DEFAULT true,
    owner_id UUID,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Step 5: Create inventory table if it doesn't exist
CREATE TABLE IF NOT EXISTS inventory (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL,
    quantity INTEGER DEFAULT 0,
    unit TEXT DEFAULT 'vnt',
    min_quantity INTEGER DEFAULT 5,
    category TEXT DEFAULT 'kita',
    owner_id UUID,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Step 6: Enable RLS on all tables
ALTER TABLE clients ENABLE ROW LEVEL SECURITY;
ALTER TABLE orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE expenses ENABLE ROW LEVEL SECURITY;
ALTER TABLE settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE memories ENABLE ROW LEVEL SECURITY;
ALTER TABLE employees ENABLE ROW LEVEL SECURITY;
ALTER TABLE inventory ENABLE ROW LEVEL SECURITY;

-- Step 7: Drop existing policies and recreate them
DROP POLICY IF EXISTS "Users can CRUD own clients" ON clients;
CREATE POLICY "Users can CRUD own clients" ON clients
    FOR ALL USING (auth.uid() = owner_id);

DROP POLICY IF EXISTS "Users can CRUD own orders" ON orders;
CREATE POLICY "Users can CRUD own orders" ON orders
    FOR ALL USING (auth.uid() = owner_id);

DROP POLICY IF EXISTS "Users can CRUD own expenses" ON expenses;
CREATE POLICY "Users can CRUD own expenses" ON expenses
    FOR ALL USING (auth.uid() = owner_id);

DROP POLICY IF EXISTS "Users can CRUD own settings" ON settings;
CREATE POLICY "Users can CRUD own settings" ON settings
    FOR ALL USING (auth.uid() = owner_id);

DROP POLICY IF EXISTS "Users can CRUD own memories" ON memories;
CREATE POLICY "Users can CRUD own memories" ON memories
    FOR ALL USING (auth.uid() = owner_id);

DROP POLICY IF EXISTS "Users can CRUD own employees" ON employees;
CREATE POLICY "Users can CRUD own employees" ON employees
    FOR ALL USING (auth.uid() = owner_id);

DROP POLICY IF EXISTS "Users can CRUD own inventory" ON inventory;
CREATE POLICY "Users can CRUD own inventory" ON inventory
    FOR ALL USING (auth.uid() = owner_id);

-- Step 8: Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_clients_owner ON clients(owner_id);
CREATE INDEX IF NOT EXISTS idx_orders_owner ON orders(owner_id);
CREATE INDEX IF NOT EXISTS idx_expenses_owner ON expenses(owner_id);
CREATE INDEX IF NOT EXISTS idx_settings_owner ON settings(owner_id);
CREATE INDEX IF NOT EXISTS idx_memories_owner ON memories(owner_id);
CREATE INDEX IF NOT EXISTS idx_employees_owner ON employees(owner_id);
CREATE INDEX IF NOT EXISTS idx_inventory_owner ON inventory(owner_id);
CREATE INDEX IF NOT EXISTS idx_inventory_category ON inventory(category);

-- Step 9: Verify the schema
SELECT 'Schema fix completed successfully!' as status;