-- Supabase Database Schema for Langiu Valymas CRM
-- Run this ENTIRE file at once in Supabase SQL Editor

-- ==========================================
-- STEP 1: Drop existing tables (BE CAREFUL IN PRODUCTION)
-- ==========================================
DROP TABLE IF EXISTS memories;
DROP TABLE IF EXISTS settings;
DROP TABLE IF EXISTS expenses;
DROP TABLE IF EXISTS orders;
DROP TABLE IF EXISTS clients;
DROP TABLE IF EXISTS profiles;

-- ==========================================
-- STEP 2: Create all tables
-- ==========================================

-- PROFILES TABLE
CREATE TABLE profiles (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    uid UUID NOT NULL,
    email TEXT NOT NULL,
    name TEXT,
    phone TEXT,
    role TEXT DEFAULT 'staff',
    client_id UUID,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- CLIENTS TABLE  
CREATE TABLE clients (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL,
    phone TEXT,
    address TEXT,
    building_type TEXT DEFAULT 'butas',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    owner_id UUID NOT NULL
);

-- ORDERS TABLE
CREATE TABLE orders (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    client_id UUID,
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
    owner_id UUID NOT NULL
);

-- EXPENSES TABLE
CREATE TABLE expenses (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    amount DECIMAL(10,2) NOT NULL,
    description TEXT,
    category TEXT,
    date TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    owner_id UUID NOT NULL
);

-- SETTINGS TABLE
CREATE TABLE settings (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    owner_id UUID NOT NULL,
    price_per_window DECIMAL(10,2) DEFAULT 5.00,
    price_per_floor DECIMAL(10,2) DEFAULT 2.00,
    price_balkonai DECIMAL(10,2) DEFAULT 8.00,
    price_vitrinos DECIMAL(10,2) DEFAULT 12.00,
    price_terasa DECIMAL(10,2) DEFAULT 15.00,
    price_kiti DECIMAL(10,2) DEFAULT 10.00,
    sms_template TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- MEMORIES TABLE
CREATE TABLE memories (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    content TEXT NOT NULL,
    type TEXT DEFAULT 'fact',
    priority INTEGER DEFAULT 5,
    owner_id UUID NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- ==========================================
-- STEP 3: Enable Row Level Security
-- ==========================================
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE clients ENABLE ROW LEVEL SECURITY;
ALTER TABLE orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE expenses ENABLE ROW LEVEL SECURITY;
ALTER TABLE settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE memories ENABLE ROW LEVEL SECURITY;

-- ==========================================
-- STEP 4: Create RLS Policies
-- ==========================================

-- Profiles policies
CREATE POLICY "profiles_select" ON profiles FOR SELECT USING (auth.uid() = uid);
CREATE POLICY "profiles_insert" ON profiles FOR INSERT WITH CHECK (auth.uid() = uid);
CREATE POLICY "profiles_update" ON profiles FOR UPDATE USING (auth.uid() = uid);
CREATE POLICY "profiles_delete" ON profiles FOR DELETE USING (auth.uid() = uid);

-- Clients policies  
CREATE POLICY "clients_select" ON clients FOR SELECT USING (auth.uid() = owner_id);
CREATE POLICY "clients_insert" ON clients FOR INSERT WITH CHECK (auth.uid() = owner_id);
CREATE POLICY "clients_update" ON clients FOR UPDATE USING (auth.uid() = owner_id);
CREATE POLICY "clients_delete" ON clients FOR DELETE USING (auth.uid() = owner_id);

-- Orders policies
CREATE POLICY "orders_select" ON orders FOR SELECT USING (auth.uid() = owner_id);
CREATE POLICY "orders_insert" ON orders FOR INSERT WITH CHECK (auth.uid() = owner_id);
CREATE POLICY "orders_update" ON orders FOR UPDATE USING (auth.uid() = owner_id);
CREATE POLICY "orders_delete" ON orders FOR DELETE USING (auth.uid() = owner_id);

-- Expenses policies
CREATE POLICY "expenses_select" ON expenses FOR SELECT USING (auth.uid() = owner_id);
CREATE POLICY "expenses_insert" ON expenses FOR INSERT WITH CHECK (auth.uid() = owner_id);
CREATE POLICY "expenses_update" ON expenses FOR UPDATE USING (auth.uid() = owner_id);
CREATE POLICY "expenses_delete" ON expenses FOR DELETE USING (auth.uid() = owner_id);

-- Settings policies
CREATE POLICY "settings_select" ON settings FOR SELECT USING (auth.uid() = owner_id);
CREATE POLICY "settings_insert" ON settings FOR INSERT WITH CHECK (auth.uid() = owner_id);
CREATE POLICY "settings_update" ON settings FOR UPDATE USING (auth.uid() = owner_id);
CREATE POLICY "settings_delete" ON settings FOR DELETE USING (auth.uid() = owner_id);

-- Memories policies
CREATE POLICY "memories_select" ON memories FOR SELECT USING (auth.uid() = owner_id);
CREATE POLICY "memories_insert" ON memories FOR INSERT WITH CHECK (auth.uid() = owner_id);
CREATE POLICY "memories_update" ON memories FOR UPDATE USING (auth.uid() = owner_id);
CREATE POLICY "memories_delete" ON memories FOR DELETE USING (auth.uid() = owner_id);

-- ==========================================
-- STEP 5: Create indexes
-- ==========================================
CREATE INDEX idx_clients_owner ON clients(owner_id);
CREATE INDEX idx_orders_owner ON orders(owner_id);
CREATE INDEX idx_orders_client ON orders(client_id);
CREATE INDEX idx_expenses_owner ON expenses(owner_id);
CREATE INDEX idx_settings_owner ON settings(owner_id);
CREATE INDEX idx_memories_owner ON memories(owner_id);
CREATE INDEX idx_profiles_uid ON profiles(uid);

-- ==========================================
-- DONE! Tables are ready to use.
-- ==========================================
