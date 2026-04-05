/**
 * Supabase klientas ir backend vėliavos (be CRUD logikos — išvengia ciklinių importų).
 */

import { createClient, SupabaseClient } from '@supabase/supabase-js';

function stripBom(s: string): string {
  return s.replace(/^\uFEFF/, '');
}

function envTrim(v: unknown): string {
  if (v == null) return '';
  return stripBom(String(v).trim());
}

const allowOfflineCrm =
  envTrim(import.meta.env.VITE_ALLOW_OFFLINE_CRM).toLowerCase() === 'true' ||
  envTrim(import.meta.env.VITE_DEMO_MODE).toLowerCase() === 'true';

const supabaseUrl = envTrim(import.meta.env.VITE_SUPABASE_URL);
const supabaseAnonKey = envTrim(import.meta.env.VITE_SUPABASE_ANON_KEY);

function isLikelyValidSupabaseUrl(url: string): boolean {
  if (!url) return false;
  const lower = url.toLowerCase();
  if (
    lower.includes('your-project') ||
    lower.includes('placeholder') ||
    lower.includes('changeme') ||
    lower.includes('example.supabase')
  ) {
    return false;
  }
  try {
    const parsed = new URL(url);
    if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') return false;
    return parsed.hostname.length > 1;
  } catch {
    return false;
  }
}

function isLikelyValidAnonKey(key: string): boolean {
  if (key.length < 32) return false;
  if (/^your[-_]?anon|^paste|^replace/i.test(key)) return false;
  return true;
}

export const isSupabaseConfigured =
  !allowOfflineCrm &&
  !!(
    supabaseUrl &&
    supabaseAnonKey &&
    isLikelyValidSupabaseUrl(supabaseUrl) &&
    isLikelyValidAnonKey(supabaseAnonKey)
  );

type GlobalWithSupabase = typeof globalThis & { __svarusSupabase?: SupabaseClient | null };
const globalScope = globalThis as GlobalWithSupabase;

export const supabase: SupabaseClient | null = isSupabaseConfigured
  ? (globalScope.__svarusSupabase ??
    (globalScope.__svarusSupabase = createClient(supabaseUrl, supabaseAnonKey, {
      auth: {
        autoRefreshToken: true,
        persistSession: true,
        detectSessionInUrl: true,
      },
    })))
  : null;

export const isRemoteBackend = !!supabase;

export const usesLocalStorageBackend = allowOfflineCrm && !isSupabaseConfigured;

/** @deprecated Naudokite `usesLocalStorageBackend`. */
export const isDemoMode = usesLocalStorageBackend;

export const needsBackendSetup = !supabase && !usesLocalStorageBackend;

export function isClientSelfRegistrationEnabled(): boolean {
  return (
    usesLocalStorageBackend ||
    envTrim(import.meta.env.VITE_CLIENT_SELF_REGISTRATION).toLowerCase() === 'true'
  );
}
