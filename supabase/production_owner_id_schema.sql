-- =============================================================================
-- Švarus Darbas CRM — canonical production schema (owner_id + snake_case)
-- -----------------------------------------------------------------------------
-- This is the primary SQL source of truth for the current app runtime:
--   - src/supabase.ts
--   - server.cjs
--   - payments workspace / client portal flows
--
-- Use this for fresh Supabase projects that follow the modern app contract.
-- Public booking RPC is kept in a separate file:
--   supabase/public_booking_rpcs.sql
--
-- Do NOT mix this file with the legacy uid + quoted camelCase track from:
--   supabase/migrations/20250322120000_crm_schema.sql
-- =============================================================================

CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- -----------------------------------------------------------------------------
-- Tables
-- -----------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS public.profiles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  uid text NOT NULL UNIQUE,
  email text NOT NULL,
  name text,
  phone text,
  role text NOT NULL DEFAULT 'staff' CHECK (role IN ('admin', 'staff', 'client')),
  client_id text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.clients (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name text NOT NULL DEFAULT '',
  phone text NOT NULL DEFAULT '',
  email text,
  address text NOT NULL DEFAULT '',
  building_type text NOT NULL DEFAULT 'butas',
  lat double precision,
  lng double precision,
  notes text,
  last_cleaning_date text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.orders (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  client_id uuid REFERENCES public.clients(id) ON DELETE SET NULL,
  client_name text NOT NULL DEFAULT '',
  employee_id uuid,
  address text NOT NULL DEFAULT '',
  lat double precision,
  lng double precision,
  date timestamptz NOT NULL DEFAULT now(),
  time text NOT NULL DEFAULT '10:00',
  window_count integer NOT NULL DEFAULT 0,
  floor integer NOT NULL DEFAULT 1,
  additional_services jsonb NOT NULL DEFAULT '{}'::jsonb,
  total_price numeric NOT NULL DEFAULT 0,
  status text NOT NULL DEFAULT 'suplanuota',
  estimated_duration integer,
  is_recurring boolean NOT NULL DEFAULT false,
  recurring_interval integer,
  notes text,
  photo_before text,
  photo_after text,
  evaluation text,
  is_paid boolean NOT NULL DEFAULT false,
  service_type text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.expenses (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  title text NOT NULL DEFAULT '',
  amount numeric NOT NULL DEFAULT 0,
  date text NOT NULL DEFAULT '',
  category text NOT NULL DEFAULT 'kita',
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.employees (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name text NOT NULL DEFAULT '',
  phone text NOT NULL DEFAULT '',
  color text NOT NULL DEFAULT '#3b82f6',
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.inventory (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name text NOT NULL DEFAULT '',
  quantity numeric NOT NULL DEFAULT 0,
  unit text NOT NULL DEFAULT 'vnt',
  min_quantity numeric NOT NULL DEFAULT 0,
  category text NOT NULL DEFAULT 'kita',
  last_restocked text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.memories (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  content text NOT NULL DEFAULT '',
  type text NOT NULL DEFAULT 'kita',
  priority integer NOT NULL DEFAULT 5,
  event_date text,
  is_active boolean NOT NULL DEFAULT true,
  context text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.settings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id uuid NOT NULL UNIQUE REFERENCES auth.users(id) ON DELETE CASCADE,
  price_per_window numeric NOT NULL DEFAULT 5,
  price_per_floor numeric NOT NULL DEFAULT 2,
  price_balkonai numeric NOT NULL DEFAULT 15,
  price_vitrinos numeric NOT NULL DEFAULT 20,
  price_terasa numeric NOT NULL DEFAULT 25,
  price_kiti numeric NOT NULL DEFAULT 10,
  sms_template text NOT NULL DEFAULT '',
  public_booking_enabled boolean NOT NULL DEFAULT true,
  invoice_api_base_url text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.invoices (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id text NOT NULL,
  client_id text NOT NULL,
  amount numeric NOT NULL DEFAULT 0,
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'paid', 'cancelled', 'refunded')),
  due_date timestamptz NOT NULL,
  created_by_uid text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  paid_at timestamptz,
  stripe_payment_intent_id text,
  invoice_url text,
  pdf_data bytea,
  notes text
);

CREATE TABLE IF NOT EXISTS public.payment_intents (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  stripe_payment_intent_id text NOT NULL UNIQUE,
  order_id text NOT NULL,
  client_id text NOT NULL,
  amount integer NOT NULL,
  currency text NOT NULL DEFAULT 'eur',
  status text NOT NULL,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_by_uid text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.transactions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  invoice_id uuid REFERENCES public.invoices(id) ON DELETE CASCADE,
  payment_intent_id uuid REFERENCES public.payment_intents(id) ON DELETE SET NULL,
  client_id text NOT NULL,
  amount numeric NOT NULL DEFAULT 0,
  currency text NOT NULL DEFAULT 'eur',
  status text NOT NULL,
  type text NOT NULL CHECK (type IN ('payment', 'refund', 'partial_refund')),
  stripe_charge_id text,
  failure_reason text,
  created_at timestamptz NOT NULL DEFAULT now(),
  processed_at timestamptz
);

-- -----------------------------------------------------------------------------
-- Indexes
-- -----------------------------------------------------------------------------

CREATE INDEX IF NOT EXISTS idx_profiles_uid ON public.profiles(uid);
CREATE INDEX IF NOT EXISTS idx_profiles_role ON public.profiles(role);
CREATE INDEX IF NOT EXISTS idx_profiles_client_id ON public.profiles(client_id);

CREATE INDEX IF NOT EXISTS idx_clients_owner_id ON public.clients(owner_id);
CREATE INDEX IF NOT EXISTS idx_clients_owner_phone ON public.clients(owner_id, phone);
CREATE INDEX IF NOT EXISTS idx_orders_owner_id ON public.orders(owner_id);
CREATE INDEX IF NOT EXISTS idx_orders_client_id ON public.orders(client_id);
CREATE INDEX IF NOT EXISTS idx_expenses_owner_id ON public.expenses(owner_id);
CREATE INDEX IF NOT EXISTS idx_employees_owner_id ON public.employees(owner_id);
CREATE INDEX IF NOT EXISTS idx_inventory_owner_id ON public.inventory(owner_id);
CREATE INDEX IF NOT EXISTS idx_memories_owner_id ON public.memories(owner_id);
CREATE INDEX IF NOT EXISTS idx_settings_owner_id ON public.settings(owner_id);

CREATE INDEX IF NOT EXISTS idx_invoices_client_id ON public.invoices(client_id);
CREATE INDEX IF NOT EXISTS idx_invoices_order_id ON public.invoices(order_id);
CREATE INDEX IF NOT EXISTS idx_invoices_status ON public.invoices(status);

CREATE INDEX IF NOT EXISTS idx_payment_intents_client_id ON public.payment_intents(client_id);
CREATE INDEX IF NOT EXISTS idx_payment_intents_order_id ON public.payment_intents(order_id);
CREATE INDEX IF NOT EXISTS idx_payment_intents_status ON public.payment_intents(status);

CREATE INDEX IF NOT EXISTS idx_transactions_client_id ON public.transactions(client_id);
CREATE INDEX IF NOT EXISTS idx_transactions_invoice_id ON public.transactions(invoice_id);
CREATE INDEX IF NOT EXISTS idx_transactions_created_at ON public.transactions(created_at);
CREATE UNIQUE INDEX IF NOT EXISTS idx_transactions_payment_once
  ON public.transactions(payment_intent_id, type)
  WHERE payment_intent_id IS NOT NULL;

-- -----------------------------------------------------------------------------
-- Utility functions
-- -----------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.current_user_role()
RETURNS text
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT p.role
  FROM public.profiles p
  WHERE p.uid = auth.uid()::text
  LIMIT 1;
$$;

CREATE OR REPLACE FUNCTION public.current_client_id()
RETURNS text
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT p.client_id
  FROM public.profiles p
  WHERE p.uid = auth.uid()::text
  LIMIT 1;
$$;

CREATE OR REPLACE FUNCTION public.is_staff_or_admin()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT COALESCE(public.current_user_role() IN ('admin', 'staff'), false);
$$;

DROP TRIGGER IF EXISTS trg_profiles_updated_at ON public.profiles;
CREATE TRIGGER trg_profiles_updated_at BEFORE UPDATE ON public.profiles
FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

DROP TRIGGER IF EXISTS trg_clients_updated_at ON public.clients;
CREATE TRIGGER trg_clients_updated_at BEFORE UPDATE ON public.clients
FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

DROP TRIGGER IF EXISTS trg_orders_updated_at ON public.orders;
CREATE TRIGGER trg_orders_updated_at BEFORE UPDATE ON public.orders
FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

DROP TRIGGER IF EXISTS trg_expenses_updated_at ON public.expenses;
CREATE TRIGGER trg_expenses_updated_at BEFORE UPDATE ON public.expenses
FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

DROP TRIGGER IF EXISTS trg_employees_updated_at ON public.employees;
CREATE TRIGGER trg_employees_updated_at BEFORE UPDATE ON public.employees
FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

DROP TRIGGER IF EXISTS trg_inventory_updated_at ON public.inventory;
CREATE TRIGGER trg_inventory_updated_at BEFORE UPDATE ON public.inventory
FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

DROP TRIGGER IF EXISTS trg_memories_updated_at ON public.memories;
CREATE TRIGGER trg_memories_updated_at BEFORE UPDATE ON public.memories
FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

DROP TRIGGER IF EXISTS trg_settings_updated_at ON public.settings;
CREATE TRIGGER trg_settings_updated_at BEFORE UPDATE ON public.settings
FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

DROP TRIGGER IF EXISTS trg_invoices_updated_at ON public.invoices;
CREATE TRIGGER trg_invoices_updated_at BEFORE UPDATE ON public.invoices
FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

DROP TRIGGER IF EXISTS trg_payment_intents_updated_at ON public.payment_intents;
CREATE TRIGGER trg_payment_intents_updated_at BEFORE UPDATE ON public.payment_intents
FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- -----------------------------------------------------------------------------
-- Row Level Security
-- -----------------------------------------------------------------------------

ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.clients ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.expenses ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.employees ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.inventory ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.memories ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.invoices ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.payment_intents ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.transactions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS profiles_select_own ON public.profiles;
DROP POLICY IF EXISTS profiles_insert_own ON public.profiles;
DROP POLICY IF EXISTS profiles_update_own ON public.profiles;

CREATE POLICY profiles_select_own ON public.profiles
  FOR SELECT TO authenticated
  USING (uid = auth.uid()::text);

CREATE POLICY profiles_insert_own ON public.profiles
  FOR INSERT TO authenticated
  WITH CHECK (uid = auth.uid()::text);

CREATE POLICY profiles_update_own ON public.profiles
  FOR UPDATE TO authenticated
  USING (uid = auth.uid()::text)
  WITH CHECK (uid = auth.uid()::text);

DO $$
DECLARE
  t text;
BEGIN
  FOR t IN
    SELECT unnest(ARRAY['clients','orders','expenses','employees','inventory','memories','settings'])
  LOOP
    EXECUTE format('DROP POLICY IF EXISTS %I_owner_all ON public.%I', t, t);
    EXECUTE format(
      'CREATE POLICY %I_owner_all ON public.%I FOR ALL TO authenticated USING (owner_id = auth.uid()) WITH CHECK (owner_id = auth.uid())',
      t, t
    );
  END LOOP;
END $$;

DROP POLICY IF EXISTS clients_client_select ON public.clients;
DROP POLICY IF EXISTS orders_client_select ON public.orders;

CREATE POLICY clients_client_select ON public.clients
  FOR SELECT TO authenticated
  USING (
    public.current_user_role() = 'client'
    AND id::text = public.current_client_id()
  );

CREATE POLICY orders_client_select ON public.orders
  FOR SELECT TO authenticated
  USING (
    public.current_user_role() = 'client'
    AND client_id::text = public.current_client_id()
  );

DROP POLICY IF EXISTS invoices_staff_all ON public.invoices;
DROP POLICY IF EXISTS invoices_client_select ON public.invoices;
DROP POLICY IF EXISTS payment_intents_staff_all ON public.payment_intents;
DROP POLICY IF EXISTS payment_intents_client_select ON public.payment_intents;
DROP POLICY IF EXISTS transactions_staff_all ON public.transactions;
DROP POLICY IF EXISTS transactions_client_select ON public.transactions;

CREATE POLICY invoices_staff_all ON public.invoices
  FOR ALL TO authenticated
  USING (public.is_staff_or_admin())
  WITH CHECK (public.is_staff_or_admin());

CREATE POLICY invoices_client_select ON public.invoices
  FOR SELECT TO authenticated
  USING (
    public.current_user_role() = 'client'
    AND client_id = public.current_client_id()
  );

CREATE POLICY payment_intents_staff_all ON public.payment_intents
  FOR ALL TO authenticated
  USING (public.is_staff_or_admin())
  WITH CHECK (public.is_staff_or_admin());

CREATE POLICY payment_intents_client_select ON public.payment_intents
  FOR SELECT TO authenticated
  USING (
    public.current_user_role() = 'client'
    AND client_id = public.current_client_id()
  );

CREATE POLICY transactions_staff_all ON public.transactions
  FOR ALL TO authenticated
  USING (public.is_staff_or_admin())
  WITH CHECK (public.is_staff_or_admin());

CREATE POLICY transactions_client_select ON public.transactions
  FOR SELECT TO authenticated
  USING (
    public.current_user_role() = 'client'
    AND client_id = public.current_client_id()
  );

-- -----------------------------------------------------------------------------
-- Notes
-- -----------------------------------------------------------------------------
-- 1) After this file, run supabase/public_booking_rpcs.sql for public booking RPC.
-- 2) If you deploy server-side financial flows, set SUPABASE_SERVICE_ROLE_KEY on server.cjs host.
