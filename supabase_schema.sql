-- Supabase Database Schema for Langių Valymas CRM
-- Run this in Supabase SQL Editor

-- 1. PROFILES TABLE
CREATE TABLE IF NOT EXISTS profiles (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    uid UUID REFERENCES auth.users(id) ON DELETE CASCADE,
    email TEXT NOT NULL,
    name TEXT,
    phone TEXT,
    role TEXT DEFAULT 'staff',
    client_id UUID,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own profile" ON profiles
    FOR SELECT USING (auth.uid() = uid);

CREATE POLICY "Users can update own profile" ON profiles
    FOR UPDATE USING (auth.uid() = uid);

CREATE POLICY "Users can insert own profile" ON profiles
    FOR INSERT WITH CHECK (auth.uid() = uid);

-- 2. CLIENTS TABLE
CREATE TABLE IF NOT EXISTS clients (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL,
    phone TEXT,
    address TEXT,
    building_type TEXT DEFAULT 'butas',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    owner_id UUID REFERENCES auth.users(id)
);

ALTER TABLE clients ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can CRUD own clients" ON clients
    FOR ALL USING (auth.uid() = owner_id);

-- 3. ORDERS TABLE
CREATE TABLE IF NOT EXISTS orders (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    client_id UUID REFERENCES clients(id),
    date TIMESTAMP WITH TIME ZONE,
    windows INTEGER DEFAULT 0,
    floors INTEGER DEFAULT 0,
    balkonai INTEGER DEFAULT 0,
    vitrinos INTEGER DEFAULT 0,
    terasa INTEGER DEFAULT 0,
    kiti TEXT,
    status TEXT DEFAULT 'pending',
    price DECIMAL(10,2),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    owner_id UUID REFERENCES auth.users(id)
);

ALTER TABLE orders ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can CRUD own orders" ON orders
    FOR ALL USING (auth.uid() = owner_id);

-- 4. EXPENSES TABLE
CREATE TABLE IF NOT EXISTS expenses (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    amount DECIMAL(10,2) NOT NULL,
    description TEXT,
    category TEXT,
    date TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    owner_id UUID REFERENCES auth.users(id)
);

ALTER TABLE expenses ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can CRUD own expenses" ON expenses
    FOR ALL USING (auth.uid() = owner_id);

-- 5. SETTINGS TABLE
CREATE TABLE IF NOT EXISTS settings (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    owner_id UUID REFERENCES auth.users(id),
    price_per_window DECIMAL(10,2) DEFAULT 5.00,
    price_per_floor DECIMAL(10,2) DEFAULT 2.00,
    price_balkonai DECIMAL(10,2) DEFAULT 8.00,
    price_vitrinos DECIMAL(10,2) DEFAULT 12.00,
    price_terasa DECIMAL(10,2) DEFAULT 15.00,
    price_kiti DECIMAL(10,2) DEFAULT 10.00,
    sms_template TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

ALTER TABLE settings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can CRUD own settings" ON settings
    FOR ALL USING (auth.uid() = owner_id);

-- 6. MEMORIES TABLE (for AI)
CREATE TABLE IF NOT EXISTS memories (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    content TEXT NOT NULL,
    type TEXT DEFAULT 'fact',
    priority INTEGER DEFAULT 5,
    owner_id UUID REFERENCES auth.users(id),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

ALTER TABLE memories ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can CRUD own memories" ON memories
    FOR ALL USING (auth.uid() = owner_id);

-- Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_clients_owner ON clients(owner_id);
CREATE INDEX IF NOT EXISTS idx_orders_owner ON orders(owner_id);
CREATE INDEX IF NOT EXISTS idx_orders_client ON orders(client_id);
CREATE INDEX IF NOT EXISTS idx_expenses_owner ON expenses(owner_id);
CREATE INDEX IF NOT EXISTS idx_settings_owner ON settings(owner_id);
CREATE INDEX IF NOT EXISTS idx_memories_owner ON memories(owner_id);
CREATE INDEX IF NOT EXISTS idx_profiles_uid ON profiles(uid);
