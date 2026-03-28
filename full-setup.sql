-- PILNAS SQL SUKŪRIMAS VISOMS LENTELĖMS IR TEISĖMS
-- Vykdykite viską iš karto

-- 1. Ištrinam senas lenteles jei egzistuoja
DROP TABLE IF EXISTS clients CASCADE;
DROP TABLE IF EXISTS orders CASCADE;
DROP TABLE IF EXISTS expenses CASCADE;
DROP TABLE IF EXISTS employees CASCADE;
DROP TABLE IF EXISTS settings CASCADE;
DROP TABLE IF EXISTS inventory CASCADE;
DROP TABLE IF EXISTS memories CASCADE;

-- 2. Sukuriame naujas lenteles
CREATE TABLE clients (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    uid TEXT NOT NULL,
    name TEXT,
    phone TEXT,
    address TEXT,
    building_type TEXT,
    notes TEXT,
    last_cleaning_date TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE TABLE orders (
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
    status TEXT DEFAULT 'suplanuota',
    is_paid BOOLEAN DEFAULT false,
    estimated_duration INTEGER,
    is_recurring BOOLEAN DEFAULT false,
    recurring_interval INTEGER,
    notes TEXT,
    photo_before TEXT,
    photo_after TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE TABLE expenses (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    uid TEXT NOT NULL,
    title TEXT,
    amount REAL,
    date TEXT,
    category TEXT,
    notes TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE TABLE employees (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    uid TEXT NOT NULL,
    name TEXT,
    phone TEXT,
    color TEXT DEFAULT '#3B82F6',
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE TABLE settings (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    uid TEXT NOT NULL UNIQUE,
    price_per_window REAL DEFAULT 5,
    price_per_floor REAL DEFAULT 2,
    price_balkonai REAL DEFAULT 15,
    price_vitrinos REAL DEFAULT 20,
    price_terasa REAL DEFAULT 25,
    price_kiti REAL DEFAULT 10,
    sms_template TEXT DEFAULT 'Sveiki {vardas}, primename apie langų valymą {data} {laikas}. Kaina: {kaina}. Iki pasimatymo!',
    business_name TEXT,
    business_phone TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE TABLE inventory (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    uid TEXT NOT NULL,
    name TEXT,
    quantity INTEGER DEFAULT 0,
    unit TEXT,
    min_quantity INTEGER DEFAULT 5,
    category TEXT,
    last_restocked TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE TABLE memories (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    uid TEXT NOT NULL,
    content TEXT NOT NULL,
    category TEXT DEFAULT 'kita',
    importance INTEGER DEFAULT 5,
    event_date TEXT,
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 3. Sukuriame indeksus
CREATE INDEX IF NOT EXISTS idx_clients_uid ON clients(uid);
CREATE INDEX IF NOT EXISTS idx_orders_uid ON orders(uid);
CREATE INDEX IF NOT EXISTS idx_expenses_uid ON expenses(uid);
CREATE INDEX IF NOT EXISTS idx_employees_uid ON employees(uid);
CREATE INDEX IF NOT EXISTS idx_settings_uid ON settings(uid);
CREATE INDEX IF NOT EXISTS idx_inventory_uid ON inventory(uid);
CREATE INDEX IF NOT EXISTS idx_memories_uid ON memories(uid);

-- 4. Įjungti RLS ir sukurti políticas
ALTER TABLE clients ENABLE ROW LEVEL SECURITY;
ALTER TABLE orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE expenses ENABLE ROW LEVEL SECURITY;
ALTER TABLE employees ENABLE ROW LEVEL SECURITY;
ALTER TABLE settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE inventory ENABLE ROW LEVEL SECURITY;
ALTER TABLE memories ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow all clients" ON clients FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all orders" ON orders FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all expenses" ON expenses FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all employees" ON employees FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all settings" ON settings FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all inventory" ON inventory FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all memories" ON memories FOR ALL USING (true) WITH CHECK (true);

-- 5. Pranešti PostgREST kad atnaujintų schemą
NOTIFY pgrst, 'reload schema';

-- 6. Patikrinti ar viskas sukurta
SELECT 'clients' as table_name, count(*) as rows FROM clients
UNION ALL SELECT 'orders', count(*) FROM orders
UNION ALL SELECT 'expenses', count(*) FROM expenses
UNION ALL SELECT 'employees', count(*) FROM employees
UNION ALL SELECT 'settings', count(*) FROM settings
UNION ALL SELECT 'inventory', count(*) FROM inventory
UNION ALL SELECT 'memories', count(*) FROM memories;
