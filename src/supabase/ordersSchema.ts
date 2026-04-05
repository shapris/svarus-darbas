import { supabase, usesLocalStorageBackend, needsBackendSetup } from './client';

/** Bendras mutuojamas režimas (importuoti `let` iš kito modulio negalima priskirti). */
export const ordersSchemaState = {
  mode: 'unknown' as 'unknown' | 'modern' | 'legacy',
};

export async function checkOrdersSchemaHealth(userId: string): Promise<{
  ok: boolean;
  mode: 'modern' | 'legacy' | 'unknown';
  message: string;
}> {
  if (usesLocalStorageBackend) {
    return {
      ok: true,
      mode: 'unknown',
      message: 'Vietinis kūrimo režimas: SQL schema netikrinama.',
    };
  }
  if (needsBackendSetup || !supabase) {
    return {
      ok: false,
      mode: 'unknown',
      message:
        'Supabase nesukonfigūruotas. Nustatykite VITE_SUPABASE_URL ir VITE_SUPABASE_ANON_KEY.',
    };
  }

  const probeModern = {
    owner_id: userId,
    client_name: 'schema_probe',
    date: new Date().toISOString().split('T')[0],
    time: '10:00',
    window_count: 1,
    floor: 1,
    additional_services: { balkonai: false, vitrinos: false, terasa: false, kiti: false },
    total_price: 0,
    status: 'suplanuota',
    created_at: new Date().toISOString(),
  };
  const modern = await supabase.from('orders').insert(probeModern).select('id').single();
  if (!modern.error) {
    const createdId = (modern.data as { id?: string } | null)?.id;
    if (createdId) await supabase.from('orders').delete().eq('id', createdId);
    ordersSchemaState.mode = 'modern';
    return {
      ok: true,
      mode: 'modern',
      message: 'Orders schema: modern (window_count/floor/additional_services).',
    };
  }

  const probeLegacy = {
    owner_id: userId,
    date: new Date().toISOString().split('T')[0],
    time: '10:00',
    windows: 1,
    floors: 1,
    balkonai: 0,
    vitrinos: 0,
    terasa: 0,
    kiti: '',
    status: 'pending',
    price: 0,
    created_at: new Date().toISOString(),
  };
  const legacy = await supabase.from('orders').insert(probeLegacy).select('id').single();
  if (!legacy.error) {
    const createdId = (legacy.data as { id?: string } | null)?.id;
    if (createdId) await supabase.from('orders').delete().eq('id', createdId);
    ordersSchemaState.mode = 'legacy';
    return {
      ok: true,
      mode: 'legacy',
      message: 'Orders schema: legacy (windows/floors/balkonai/vitrinos/terasa).',
    };
  }

  return {
    ok: false,
    mode: 'unknown',
    message: `Orders schema check failed. Modern: ${modern.error.message || modern.error.code}. Legacy: ${legacy.error.message || legacy.error.code}.`,
  };
}
