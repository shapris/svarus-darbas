-- =============================================================================
-- Viešos rezervacijos RPC (anon gali kviesti be prisijungimo)
-- Problema: 404 ant /rest/v1/rpc/get_booking_settings arba submit_public_booking
-- Sprendimas: Supabase → SQL Editor → įklijuokite ir paleiskite VISĄ šį skriptą.
--
-- SVARBU — dvi schemos repo:
-- • Jei DB sukurta iš supabase/migrations/20250322120000_crm_schema.sql (stulpelis uid,
--   kabantys camelCase vardai) — toje migracijoje JAU yra get_booking_settings / submit_public_booking.
--   Šio failo nevykdykite ant tokios DB (perrašysite funkcijas kita konvencija).
-- • Jei lentelės kaip šiuolaikiniame app (owner_id + snake_case: price_per_window, client_name, …)
--   — naudokite ŠĮ failą; tai atitinka src/supabase.ts užklausas su owner_id.
--
-- Diagnostika (SQL Editor), jei submit grąžina 400:
--   SELECT id, owner_id FROM public.settings;  -- owner_id = UUID iš /booking/... nuorodos
--   SELECT column_name, data_type FROM information_schema.columns
--     WHERE table_schema='public' AND table_name='orders' ORDER BY ordinal_position;
-- =============================================================================

-- Jūsų DB gali būti „sensesnė“ (pvz. be client_name). Pridedame trūkstamus
-- stulpelius, kad RPC INSERT veiktų kartu su dabartiniu CRM (src/supabase addData orders).
ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS client_name text DEFAULT '';
ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS address text DEFAULT '';
ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS lat double precision;
ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS lng double precision;
ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS "time" text DEFAULT '10:00';
ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS window_count integer DEFAULT 0;
ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS floor integer DEFAULT 0;
ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS additional_services jsonb DEFAULT '{}'::jsonb;
ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS total_price numeric DEFAULT 0;
ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS notes text;

-- data: tipas dažnai timestamptz — jei stulpelio nėra, kuriam tokį; RPC įrašą castina.
ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS date timestamptz;

-- clients: senesnėse DB gali trūkti building_type (žr. SIMPLE_SETUP.sql).
ALTER TABLE public.clients ADD COLUMN IF NOT EXISTS building_type text DEFAULT 'butas';
-- el. paštas CRM / sąskaitoms (trūksta senesnėse DB — be stulpelio CRM jo neišsaugos)
ALTER TABLE public.clients ADD COLUMN IF NOT EXISTS email text;

-- settings: get_booking_settings skaito visus kainų laukus + sms_template.
ALTER TABLE public.settings ADD COLUMN IF NOT EXISTS price_per_floor numeric DEFAULT 2;
ALTER TABLE public.settings ADD COLUMN IF NOT EXISTS price_balkonai numeric DEFAULT 8;
ALTER TABLE public.settings ADD COLUMN IF NOT EXISTS price_vitrinos numeric DEFAULT 12;
ALTER TABLE public.settings ADD COLUMN IF NOT EXISTS price_terasa numeric DEFAULT 15;
ALTER TABLE public.settings ADD COLUMN IF NOT EXISTS price_kiti numeric DEFAULT 10;
ALTER TABLE public.settings ADD COLUMN IF NOT EXISTS sms_template text DEFAULT '';
ALTER TABLE public.settings ADD COLUMN IF NOT EXISTS public_booking_enabled boolean NOT NULL DEFAULT true;

CREATE OR REPLACE FUNCTION public.get_booking_settings(p_owner_uid text)
RETURNS jsonb
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT jsonb_build_object(
    'pricePerWindow', COALESCE(s.price_per_window, 5),
    'pricePerFloor', COALESCE(s.price_per_floor, 2),
    'priceBalkonai', COALESCE(s.price_balkonai, 8),
    'priceVitrinos', COALESCE(s.price_vitrinos, 12),
    'priceTerasa', COALESCE(s.price_terasa, 15),
    'priceKiti', COALESCE(s.price_kiti, 10),
    'smsTemplate', COALESCE(s.sms_template, ''),
    'publicBookingEnabled', COALESCE(s.public_booking_enabled, true)
  )
  FROM public.settings s
  WHERE s.owner_id IS NOT NULL
    AND (s.owner_id::text = trim(p_owner_uid)
         OR s.owner_id = NULLIF(trim(p_owner_uid), '')::uuid)
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
  v_owner uuid;
  v_cid text;
  v_phone text := trim(coalesce(p_client->>'phone', ''));
  v_services jsonb := coalesce(p_order->'additionalServices', '{}'::jsonb);
  v_owner_txt text := trim(p_owner_uid);
BEGIN
  BEGIN
    v_owner := v_owner_txt::uuid;
  EXCEPTION WHEN invalid_text_representation THEN
    RAISE EXCEPTION 'invalid_booking_owner';
  END;

  IF NOT EXISTS (SELECT 1 FROM public.settings s WHERE s.owner_id = v_owner LIMIT 1) THEN
    RAISE EXCEPTION 'invalid_booking_owner';
  END IF;

  IF NOT COALESCE(
    (SELECT s.public_booking_enabled FROM public.settings s WHERE s.owner_id = v_owner LIMIT 1),
    true
  ) THEN
    RAISE EXCEPTION 'public_booking_disabled';
  END IF;

  IF length(v_phone) < 5 THEN
    RAISE EXCEPTION 'invalid_phone';
  END IF;

  SELECT c.id::text INTO v_cid
  FROM public.clients c
  WHERE c.owner_id = v_owner
    AND trim(coalesce(c.phone, '')) = v_phone
  LIMIT 1;

  IF v_cid IS NULL THEN
    INSERT INTO public.clients (
      name,
      phone,
      email,
      address,
      building_type,
      owner_id,
      created_at
    ) VALUES (
      coalesce(p_client->>'name', ''),
      v_phone,
      nullif(trim(coalesce(p_client->>'email', '')), ''),
      coalesce(p_client->>'address', ''),
      coalesce(nullif(trim(p_client->>'buildingType'), ''), 'butas'),
      v_owner,
      coalesce((p_client->>'createdAt')::timestamptz, now())
    )
    RETURNING id::text INTO v_cid;
  END IF;

  -- „Mažiausias“ INSERT (be employee_id / estimated_*), kad mažiau konfliktų su skirtingomis migracijomis
  INSERT INTO public.orders (
    owner_id,
    client_id,
    client_name,
    address,
    lat,
    lng,
    date,
    "time",
    window_count,
    floor,
    additional_services,
    total_price,
    status,
    notes,
    created_at
  ) VALUES (
    v_owner,
    v_cid::uuid,
    coalesce(p_order->>'clientName', p_client->>'name', ''),
    coalesce(p_order->>'address', ''),
    CASE
      WHEN p_order ? 'lat' AND jsonb_typeof(p_order->'lat') = 'number' THEN (p_order->>'lat')::double precision
      WHEN p_order->>'lat' IS NOT NULL AND p_order->>'lat' != 'null' AND trim(p_order->>'lat') != ''
        THEN (p_order->>'lat')::double precision
      ELSE NULL
    END,
    CASE
      WHEN p_order ? 'lng' AND jsonb_typeof(p_order->'lng') = 'number' THEN (p_order->>'lng')::double precision
      WHEN p_order->>'lng' IS NOT NULL AND p_order->>'lng' != 'null' AND trim(p_order->>'lng') != ''
        THEN (p_order->>'lng')::double precision
      ELSE NULL
    END,
    -- orders.date DB laukas dažnai timestamptz (ne text); tekstą kombinuojam su laiku.
    (
      trim(coalesce(p_order->>'date', to_char(now(), 'YYYY-MM-DD')))
      || ' '
      || trim(coalesce(nullif(p_order->>'time', ''), '10:00'))
    )::timestamptz,
    coalesce(nullif(p_order->>'time', ''), '10:00'),
    coalesce((p_order->>'windowCount')::integer, 0),
    coalesce((p_order->>'floor')::integer, 1),
    v_services,
    coalesce((p_order->>'totalPrice')::numeric, 0),
    coalesce(nullif(trim(p_order->>'status'), ''), 'suplanuota'),
    nullif(trim(p_order->>'notes'), ''),
    coalesce((p_order->>'createdAt')::timestamptz, now())
  );

  RETURN jsonb_build_object('ok', true, 'clientId', v_cid);
END;
$$;

REVOKE ALL ON FUNCTION public.get_booking_settings(text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_booking_settings(text) TO anon, authenticated;

REVOKE ALL ON FUNCTION public.submit_public_booking(text, jsonb, jsonb) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.submit_public_booking(text, jsonb, jsonb) TO anon, authenticated;
