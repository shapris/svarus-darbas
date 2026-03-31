-- =============================================================================
-- Viešos rezervacijos RPC (anon gali kviesti be prisijungimo)
-- Problema: 404 ant /rest/v1/rpc/get_booking_settings arba submit_public_booking
-- Sprendimas: Supabase → SQL Editor → įklijuokite ir paleiskite VISĄ šį skriptą.
--
-- Tikėtina schema (kaip CRM kode): settings.owner_id, clients.owner_id, orders.owner_id
-- (UUID), kainų stulpeliai price_per_window, … orders: client_id, client_name, date (text),
-- time, window_count, floor, additional_services (jsonb), total_price, …
-- =============================================================================

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
    'smsTemplate', COALESCE(s.sms_template, '')
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
  v_cid uuid;
  v_phone text := trim(coalesce(p_client->>'phone', ''));
  v_services jsonb := coalesce(p_order->'additionalServices', '{}'::jsonb);
BEGIN
  BEGIN
    v_owner := trim(p_owner_uid)::uuid;
  EXCEPTION WHEN invalid_text_representation THEN
    RAISE EXCEPTION 'invalid_booking_owner';
  END;

  IF NOT EXISTS (SELECT 1 FROM public.settings s WHERE s.owner_id = v_owner LIMIT 1) THEN
    RAISE EXCEPTION 'invalid_booking_owner';
  END IF;

  IF length(v_phone) < 5 THEN
    RAISE EXCEPTION 'invalid_phone';
  END IF;

  SELECT c.id INTO v_cid
  FROM public.clients c
  WHERE c.owner_id = v_owner
    AND trim(coalesce(c.phone, '')) = v_phone
  LIMIT 1;

  IF v_cid IS NULL THEN
    INSERT INTO public.clients (
      name,
      phone,
      address,
      building_type,
      owner_id,
      created_at
    ) VALUES (
      coalesce(p_client->>'name', ''),
      v_phone,
      coalesce(p_client->>'address', ''),
      coalesce(nullif(trim(p_client->>'buildingType'), ''), 'butas'),
      v_owner,
      coalesce((p_client->>'createdAt')::timestamptz, now())
    )
    RETURNING id INTO v_cid;
  END IF;

  INSERT INTO public.orders (
    owner_id,
    client_id,
    client_name,
    address,
    lat,
    lng,
    date,
    time,
    window_count,
    floor,
    additional_services,
    total_price,
    status,
    notes,
    created_at
  ) VALUES (
    v_owner,
    v_cid,
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
    coalesce(p_order->>'date', to_char(now(), 'YYYY-MM-DD')),
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
