-- Švarus Darbas CRM — run in Supabase SQL Editor (or: supabase db push)
-- Creates tables (camelCase columns to match the Vite app), RLS, realtime, and public booking RPCs.

-- Extensions
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- --- Tables -----------------------------------------------------------------

CREATE TABLE IF NOT EXISTS public.settings (
  id text PRIMARY KEY DEFAULT gen_random_uuid()::text,
  uid text NOT NULL,
  "pricePerWindow" numeric NOT NULL DEFAULT 5,
  "pricePerFloor" numeric NOT NULL DEFAULT 2,
  "priceBalkonai" numeric NOT NULL DEFAULT 15,
  "priceVitrinos" numeric NOT NULL DEFAULT 20,
  "priceTerasa" numeric NOT NULL DEFAULT 25,
  "priceKiti" numeric NOT NULL DEFAULT 10,
  "smsTemplate" text NOT NULL DEFAULT '',
  "createdAt" timestamptz NOT NULL DEFAULT now(),
  "updatedAt" timestamptz
);

CREATE TABLE IF NOT EXISTS public.clients (
  id text PRIMARY KEY DEFAULT gen_random_uuid()::text,
  uid text NOT NULL,
  name text NOT NULL DEFAULT '',
  phone text NOT NULL DEFAULT '',
  email text,
  address text NOT NULL DEFAULT '',
  "buildingType" text NOT NULL DEFAULT 'butas',
  notes text,
  "lastCleaningDate" text,
  "createdAt" timestamptz NOT NULL DEFAULT now(),
  "updatedAt" timestamptz
);

CREATE TABLE IF NOT EXISTS public.orders (
  id text PRIMARY KEY DEFAULT gen_random_uuid()::text,
  uid text NOT NULL,
  "clientId" text NOT NULL DEFAULT '',
  "clientName" text NOT NULL DEFAULT '',
  address text NOT NULL DEFAULT '',
  lat double precision,
  lng double precision,
  date text NOT NULL,
  time text NOT NULL,
  "windowCount" integer NOT NULL DEFAULT 0,
  floor integer NOT NULL DEFAULT 0,
  "additionalServices" jsonb NOT NULL DEFAULT '{}'::jsonb,
  "totalPrice" numeric NOT NULL DEFAULT 0,
  status text NOT NULL DEFAULT 'suplanuota',
  "estimatedDuration" integer,
  "isRecurring" boolean DEFAULT false,
  "recurringInterval" integer,
  notes text,
  "photoBefore" text,
  "photoAfter" text,
  evaluation text,
  "employeeId" text,
  "createdAt" timestamptz NOT NULL DEFAULT now(),
  "updatedAt" timestamptz
);

CREATE TABLE IF NOT EXISTS public.expenses (
  id text PRIMARY KEY DEFAULT gen_random_uuid()::text,
  uid text NOT NULL,
  title text NOT NULL DEFAULT '',
  amount numeric NOT NULL DEFAULT 0,
  date text NOT NULL,
  category text NOT NULL DEFAULT 'kita',
  notes text,
  "createdAt" timestamptz NOT NULL DEFAULT now(),
  "updatedAt" timestamptz
);

CREATE TABLE IF NOT EXISTS public.employees (
  id text PRIMARY KEY DEFAULT gen_random_uuid()::text,
  uid text NOT NULL,
  name text NOT NULL DEFAULT '',
  phone text NOT NULL DEFAULT '',
  color text NOT NULL DEFAULT '#3b82f6',
  "isActive" boolean NOT NULL DEFAULT true,
  "createdAt" timestamptz NOT NULL DEFAULT now(),
  "updatedAt" timestamptz
);

CREATE TABLE IF NOT EXISTS public.inventory (
  id text PRIMARY KEY DEFAULT gen_random_uuid()::text,
  uid text NOT NULL,
  name text NOT NULL DEFAULT '',
  quantity numeric NOT NULL DEFAULT 0,
  unit text NOT NULL DEFAULT 'vnt',
  "minQuantity" numeric NOT NULL DEFAULT 0,
  category text NOT NULL DEFAULT 'kita',
  "lastRestocked" text,
  "createdAt" timestamptz NOT NULL DEFAULT now(),
  "updatedAt" timestamptz
);

CREATE TABLE IF NOT EXISTS public.memories (
  id text PRIMARY KEY DEFAULT gen_random_uuid()::text,
  uid text NOT NULL,
  content text NOT NULL DEFAULT '',
  category text NOT NULL DEFAULT 'kita',
  importance integer,
  "createdAt" timestamptz NOT NULL DEFAULT now(),
  "updatedAt" timestamptz
);

CREATE INDEX IF NOT EXISTS idx_settings_uid ON public.settings (uid);
CREATE INDEX IF NOT EXISTS idx_clients_uid ON public.clients (uid);
CREATE INDEX IF NOT EXISTS idx_clients_uid_phone ON public.clients (uid, phone);
CREATE INDEX IF NOT EXISTS idx_orders_uid ON public.orders (uid);
CREATE INDEX IF NOT EXISTS idx_expenses_uid ON public.expenses (uid);
CREATE INDEX IF NOT EXISTS idx_employees_uid ON public.employees (uid);
CREATE INDEX IF NOT EXISTS idx_inventory_uid ON public.inventory (uid);
CREATE INDEX IF NOT EXISTS idx_memories_uid ON public.memories (uid);

-- --- Row level security -----------------------------------------------------

ALTER TABLE public.settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.clients ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.expenses ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.employees ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.inventory ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.memories ENABLE ROW LEVEL SECURITY;

-- Authenticated users: full CRUD on own rows (uid = auth user id as text)
DO $$
DECLARE
  t text;
BEGIN
  FOR t IN SELECT unnest(ARRAY['settings','clients','orders','expenses','employees','inventory','memories'])
  LOOP
    EXECUTE format('DROP POLICY IF EXISTS crm_%I_rw ON public.%I', t, t);
    EXECUTE format(
      'CREATE POLICY crm_%I_rw ON public.%I FOR ALL TO authenticated USING (uid = (auth.uid())::text) WITH CHECK (uid = (auth.uid())::text)',
      t, t
    );
  END LOOP;
END $$;

-- --- Public booking (anonymous visitors): pricing + submit via RPC only -----
-- Jei vėliau perėjote prie owner_id + snake_case (kaip dabartiniame CRM kode), vietoj šitų
-- funkcijų naudokite supabase/public_booking_rpcs.sql (perrašo šias RPC tinkama schema).

CREATE OR REPLACE FUNCTION public.get_booking_settings(p_owner_uid text)
RETURNS jsonb
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT jsonb_build_object(
    'pricePerWindow', s."pricePerWindow",
    'pricePerFloor', s."pricePerFloor",
    'priceBalkonai', s."priceBalkonai",
    'priceVitrinos', s."priceVitrinos",
    'priceTerasa', s."priceTerasa",
    'priceKiti', s."priceKiti"
  )
  FROM public.settings s
  WHERE s.uid = p_owner_uid
  LIMIT 1;
$$;

CREATE OR REPLACE FUNCTION public.submit_public_booking(
  p_owner_uid text,
  p_client jsonb,
  p_order jsonb
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_cid text;
  v_phone text := trim(coalesce(p_client->>'phone', ''));
BEGIN
  IF NOT EXISTS (SELECT 1 FROM public.settings WHERE uid = p_owner_uid LIMIT 1) THEN
    RAISE EXCEPTION 'invalid_booking_owner';
  END IF;
  IF length(v_phone) < 5 THEN
    RAISE EXCEPTION 'invalid_phone';
  END IF;

  SELECT c.id INTO v_cid
  FROM public.clients c
  WHERE c.uid = p_owner_uid AND c.phone = v_phone
  LIMIT 1;

  IF v_cid IS NULL THEN
    v_cid := gen_random_uuid()::text;
    INSERT INTO public.clients (id, uid, name, phone, address, "buildingType", "createdAt")
    VALUES (
      v_cid,
      p_owner_uid,
      coalesce(p_client->>'name', ''),
      v_phone,
      coalesce(p_client->>'address', ''),
      coalesce(nullif(p_client->>'buildingType', ''), 'butas'),
      coalesce((p_client->>'createdAt')::timestamptz, now())
    );
  END IF;

  INSERT INTO public.orders (
    id, uid, "clientId", "clientName", address, lat, lng, date, time,
    "windowCount", floor, "additionalServices", "totalPrice", status, notes, "createdAt"
  ) VALUES (
    gen_random_uuid()::text,
    p_owner_uid,
    v_cid,
    coalesce(p_order->>'clientName', ''),
    coalesce(p_order->>'address', ''),
    CASE WHEN jsonb_typeof(coalesce(p_order->'lat', 'null'::jsonb)) = 'number'
      THEN (p_order->>'lat')::double precision END,
    CASE WHEN jsonb_typeof(coalesce(p_order->'lng', 'null'::jsonb)) = 'number'
      THEN (p_order->>'lng')::double precision END,
    coalesce(p_order->>'date', ''),
    coalesce(p_order->>'time', ''),
    coalesce((p_order->>'windowCount')::integer, 0),
    coalesce((p_order->>'floor')::integer, 0),
    coalesce(p_order->'additionalServices', '{}'::jsonb),
    coalesce((p_order->>'totalPrice')::numeric, 0),
    coalesce(nullif(p_order->>'status', ''), 'suplanuota'),
    nullif(p_order->>'notes', ''),
    coalesce((p_order->>'createdAt')::timestamptz, now())
  );

  RETURN jsonb_build_object('ok', true, 'clientId', v_cid);
END;
$$;

REVOKE ALL ON FUNCTION public.get_booking_settings(text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_booking_settings(text) TO anon, authenticated;

REVOKE ALL ON FUNCTION public.submit_public_booking(text, jsonb, jsonb) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.submit_public_booking(text, jsonb, jsonb) TO anon, authenticated;

-- --- Realtime ---------------------------------------------------------------
-- Supabase Dashboard → Database → Publications → supabase_realtime:
-- add public tables: clients, orders, expenses, employees, settings, inventory, memories
-- (Or run once per table: ALTER PUBLICATION supabase_realtime ADD TABLE public.clients;)
