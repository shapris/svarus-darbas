-- FIX PROFILES TABLE ONLY
-- Paleiskite tai jei profiles lentelė turi 406/400 klaidas

-- Ištrinti seną profiles lentelę
DROP TABLE IF EXISTS profiles CASCADE;

-- Sukurti naują profiles lentelę su aiškiais stulpeliais
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

-- Sukurti index uid stulpeliui (padeda paieškai)
CREATE INDEX idx_profiles_uid ON profiles(uid);

-- Išjungti RLS
ALTER TABLE profiles DISABLE ROW LEVEL SECURITY;

-- Patikrinti ar lentelė sukurta
SELECT column_name, data_type 
FROM information_schema.columns 
WHERE table_name = 'profiles';
