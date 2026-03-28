-- Sukurti lenteles duomenų bazei
-- Vykdykite šias komandas Supabase SQL redaktoriuje

-- Clients lentelė
CREATE TABLE IF NOT EXISTS clients (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    uid TEXT NOT NULL,
    name TEXT,
    phone TEXT,
    address TEXT,
    building_type TEXT,
    notes TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Orders lentelė
CREATE TABLE IF NOT EXISTS orders (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    uid TEXT NOT NULL,
    client_id TEXT,
    client_name TEXT,
    employee_id TEXT,
    address TEXT,
    lat REAL,
    lng REAL,
    date TEXT,
    time TEXT,
    window_count INTEGER,
    floor INTEGER,
    additional_services JSONB,
    total_price REAL,
    status TEXT,
    estimated_duration INTEGER,
    is_recurring BOOLEAN,
    recurring_interval INTEGER,
    notes TEXT,
    photo_before TEXT,
    photo_after TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Expenses lentelė
CREATE TABLE IF NOT EXISTS expenses (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    uid TEXT NOT NULL,
    title TEXT,
    amount REAL,
    date TEXT,
    category TEXT,
    notes TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Employees lentelė
CREATE TABLE IF NOT EXISTS employees (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    uid TEXT NOT NULL,
    name TEXT,
    phone TEXT,
    color TEXT,
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Settings lentelė
CREATE TABLE IF NOT EXISTS settings (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    uid TEXT NOT NULL UNIQUE,
    price_per_window REAL DEFAULT 2,
    price_per_floor REAL DEFAULT 1,
    price_balkonai REAL DEFAULT 10,
    price_vitrinos REAL DEFAULT 15,
    price_terasa REAL DEFAULT 20,
    price_kiti REAL DEFAULT 5,
    sms_template TEXT,
    business_name TEXT,
    business_phone TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Inventory lentelė
CREATE TABLE IF NOT EXISTS inventory (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    uid TEXT NOT NULL,
    name TEXT,
    quantity INTEGER DEFAULT 0,
    min_quantity INTEGER DEFAULT 5,
    unit TEXT,
    category TEXT,
    last_restocked TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Memories lentelė (AI asistento atmintis)
CREATE TABLE IF NOT EXISTS memories (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    uid TEXT NOT NULL,
    content TEXT NOT NULL,
    category TEXT DEFAULT 'kita',
    importance INTEGER DEFAULT 5,
    event_date TEXT,
    is_active BOOLEAN DEFAULT true,
    context TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Sukurti indeksus greitesniam filtravimui
CREATE INDEX IF NOT EXISTS idx_clients_uid ON clients(uid);
CREATE INDEX IF NOT EXISTS idx_orders_uid ON orders(uid);
CREATE INDEX IF NOT EXISTS idx_expenses_uid ON expenses(uid);
CREATE INDEX IF NOT EXISTS idx_employees_uid ON employees(uid);
CREATE INDEX IF NOT EXISTS idx_settings_uid ON settings(uid);
CREATE INDEX IF NOT EXISTS idx_inventory_uid ON inventory(uid);
CREATE INDEX IF NOT EXISTS idx_memories_uid ON memories(uid);

-- Įjungti RLS (Row Level Security)
ALTER TABLE clients ENABLE ROW LEVEL SECURITY;
ALTER TABLE orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE expenses ENABLE ROW LEVEL SECURITY;
ALTER TABLE employees ENABLE ROW LEVEL SECURITY;
ALTER TABLE settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE inventory ENABLE ROW LEVEL SECURITY;
ALTER TABLE memories ENABLE ROW LEVEL SECURITY;

-- Leisti skaityti/palaikyti visus duomenis
CREATE POLICY "Allow all for clients" ON clients FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all for orders" ON orders FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all for expenses" ON expenses FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all for employees" ON employees FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all for settings" ON settings FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all for inventory" ON inventory FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all for memories" ON memories FOR ALL USING (true) WITH CHECK (true);
