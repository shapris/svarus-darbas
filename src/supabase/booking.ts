import {
  getData as localGetData,
} from '../localDb';
import { DEFAULT_SETTINGS, type AppSettings } from '../types';
import { TABLES } from './constants';
import { supabase, usesLocalStorageBackend, needsBackendSetup } from './client';
import { boolSettingFromDb } from './normalize';

function isBookingRpcMissing(
  error: { message?: string; code?: string; status?: number } | null
): boolean {
  if (!error) return false;
  const code = String(error.code ?? '');
  const msg = String(error.message ?? '').toLowerCase();
  if (error.status === 404 || msg.includes('404')) return true;
  if (code === 'PGRST202' || code === '42883') return true;
  if (msg.includes('could not find') && msg.includes('function')) return true;
  if (msg.includes('does not exist') && msg.includes('function')) return true;
  return false;
}

/** Public booking page: pricing (works for anonymous visitors when RPC + RLS are deployed). */
export async function fetchPublicBookingSettings(ownerUid: string): Promise<AppSettings> {
  if (usesLocalStorageBackend) {
    const rows = localGetData(TABLES.SETTINGS, ownerUid);
    const row = rows[0];
    return row ? { ...DEFAULT_SETTINGS, ...row } : { ...DEFAULT_SETTINGS };
  }
  if (needsBackendSetup || !supabase) {
    return { ...DEFAULT_SETTINGS };
  }
  const { data, error } = await supabase.rpc('get_booking_settings', { p_owner_uid: ownerUid });
  if (error) {
    if (isBookingRpcMissing(error)) {
      console.warn(
        '[Booking] Trūksta DB funkcijos get_booking_settings. Supabase → SQL Editor: vykdykite supabase/public_booking_rpcs.sql'
      );
    } else if (import.meta.env.DEV) {
      console.warn('[Booking] get_booking_settings:', error.message);
    }
    return { ...DEFAULT_SETTINGS };
  }
  if (data && typeof data === 'object' && !Array.isArray(data)) {
    const raw = data as Record<string, unknown>;
    const num = (v: unknown, fallback: number) => {
      if (typeof v === 'number' && !Number.isNaN(v)) return v;
      const p = parseFloat(String(v ?? ''));
      return Number.isFinite(p) ? p : fallback;
    };
    return {
      ...DEFAULT_SETTINGS,
      pricePerWindow: num(raw.pricePerWindow, DEFAULT_SETTINGS.pricePerWindow),
      pricePerFloor: num(raw.pricePerFloor, DEFAULT_SETTINGS.pricePerFloor),
      priceBalkonai: num(raw.priceBalkonai, DEFAULT_SETTINGS.priceBalkonai),
      priceVitrinos: num(raw.priceVitrinos, DEFAULT_SETTINGS.priceVitrinos),
      priceTerasa: num(raw.priceTerasa, DEFAULT_SETTINGS.priceTerasa),
      priceKiti: num(raw.priceKiti, DEFAULT_SETTINGS.priceKiti),
      smsTemplate:
        typeof raw.smsTemplate === 'string' ? raw.smsTemplate : DEFAULT_SETTINGS.smsTemplate,
      publicBookingEnabled: boolSettingFromDb(
        raw.publicBookingEnabled,
        DEFAULT_SETTINGS.publicBookingEnabled
      ),
    };
  }
  return { ...DEFAULT_SETTINGS };
}

/** Public booking submit (SECURITY DEFINER RPC). */
export async function submitPublicBooking(
  ownerUid: string,
  clientPayload: Record<string, unknown>,
  orderPayload: Record<string, unknown>
): Promise<void> {
  if (usesLocalStorageBackend || needsBackendSetup || !supabase) {
    throw new Error(
      'Vieša rezervacija veikia tik su prijungta Supabase (RPC submit_public_booking). Vietiniame CRM be debesies naudokite tiesioginį užsakymo kūrimą.'
    );
  }
  const { error } = await supabase.rpc('submit_public_booking', {
    p_owner_uid: ownerUid,
    p_client: clientPayload,
    p_order: orderPayload,
  });
  if (error) {
    if (isBookingRpcMissing(error)) {
      throw new Error(
        'booking_rpc_missing: Supabase SQL Editor įkelkite supabase/public_booking_rpcs.sql (funkcijos get_booking_settings ir submit_public_booking).'
      );
    }
    const d = error as { message?: string; details?: string; hint?: string; code?: string };
    if (import.meta.env.DEV) {
      console.warn(
        '[Booking] submit_public_booking:',
        d.message,
        d.details || '',
        d.hint || '',
        d.code || ''
      );
    }
    const text =
      [d.message, d.details, d.hint].filter(Boolean).join(' · ') || 'submit_public_booking failed';
    throw new Error(text);
  }
}
