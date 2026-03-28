-- Švarus Darbas CRM - Klientų Portalas Schema
-- Sukurta: 2026-03-28

-- Profiles lentelė (jei neegzistuoja)
CREATE TABLE IF NOT EXISTS profiles (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    uid VARCHAR(255) UNIQUE NOT NULL,
    email VARCHAR(255) NOT NULL,
    role VARCHAR(20) NOT NULL DEFAULT 'staff' CHECK (role IN ('admin', 'staff', 'client')),
    name VARCHAR(255),
    phone VARCHAR(50),
    client_id VARCHAR(255),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Client Portal Access lentelė (papildoma funkcionalumui)
CREATE TABLE IF NOT EXISTS client_portal_access (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    client_id VARCHAR(255) NOT NULL,
    email VARCHAR(255) UNIQUE NOT NULL,
    password_hash VARCHAR(255) NOT NULL,
    last_login TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_profiles_uid ON profiles(uid);
CREATE INDEX IF NOT EXISTS idx_profiles_role ON profiles(role);
CREATE INDEX IF NOT EXISTS idx_profiles_client_id ON profiles(client_id);
CREATE INDEX IF NOT EXISTS idx_client_portal_access_email ON client_portal_access(email);
CREATE INDEX IF NOT EXISTS idx_client_portal_access_client_id ON client_portal_access(client_id);

-- RLS (Row Level Security) - tik klientai gali matyti savo duomenis
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;

-- Policy for profiles
CREATE POLICY "Users can view own profile" ON profiles
    FOR SELECT USING (auth.uid()::text = uid);

CREATE POLICY "Users can update own profile" ON profiles
    FOR UPDATE USING (auth.uid()::text = uid);

CREATE POLICY "Users can insert own profile" ON profiles
    FOR INSERT WITH CHECK (auth.uid()::text = uid);

-- Policy for staff to view all profiles
CREATE POLICY "Staff can view all profiles" ON profiles
    FOR SELECT USING (
        EXISTS (
            SELECT 1 FROM profiles 
            WHERE uid = auth.uid()::text 
            AND role IN ('admin', 'staff')
        )
    );

-- Triggers for updated_at
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

CREATE TRIGGER update_profiles_updated_at 
    BEFORE UPDATE ON profiles 
    FOR EACH ROW 
    EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_client_portal_access_updated_at 
    BEFORE UPDATE ON client_portal_access 
    FOR EACH ROW 
    EXECUTE FUNCTION update_updated_at_column();

-- Sample data (testavimui)
INSERT INTO profiles (uid, email, role, name, phone) VALUES
('demo-client-123', 'client@example.com', 'client', 'Test Klientas', '+37060000000'),
('demo-staff-123', 'staff@example.com', 'staff', 'Test Darbuotojas', '+37060000001')
ON CONFLICT (uid) DO NOTHING;

-- Orders lentelės papildymas (jei reikia)
-- ALTER TABLE orders ADD COLUMN IF NOT EXISTS client_id VARCHAR(255);
-- CREATE INDEX IF NOT EXISTS idx_orders_client_id ON orders(client_id);
