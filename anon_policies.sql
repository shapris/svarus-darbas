-- @deprecated Nenaudokite — atveria visą CRM anon. Naudokite migraciją:
--   supabase/migrations/20260404140000_crm_core_rls.sql
--
-- TEMPORARY FIX (legacy): Allow anonymous access for development
-- WARNING: Remove this in production!

-- Allow anon access to all tables (TEMPORARY - FOR DEVELOPMENT ONLY)
ALTER TABLE clients DISABLE ROW LEVEL SECURITY;
ALTER TABLE orders DISABLE ROW LEVEL SECURITY;
ALTER TABLE expenses DISABLE ROW LEVEL SECURITY;
ALTER TABLE settings DISABLE ROW LEVEL SECURITY;
ALTER TABLE memories DISABLE ROW LEVEL SECURITY;
ALTER TABLE employees DISABLE ROW LEVEL SECURITY;
ALTER TABLE profiles DISABLE ROW LEVEL SECURITY;

-- Re-enable RLS with anon-friendly policies
ALTER TABLE clients ENABLE ROW LEVEL SECURITY;
ALTER TABLE orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE expenses ENABLE ROW LEVEL SECURITY;
ALTER TABLE settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE memories ENABLE ROW LEVEL SECURITY;
ALTER TABLE employees ENABLE ROW LEVEL SECURITY;
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;

-- Create policies that allow anon access
CREATE POLICY "allow_anon_clients" ON clients FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "allow_anon_orders" ON orders FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "allow_anon_expenses" ON expenses FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "allow_anon_settings" ON settings FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "allow_anon_memories" ON memories FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "allow_anon_employees" ON employees FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "allow_anon_profiles" ON profiles FOR ALL USING (true) WITH CHECK (true);
