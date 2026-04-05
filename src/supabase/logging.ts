import { logDevError } from '../utils/devConsole';

export const DEBUG_SUPABASE = import.meta.env.VITE_DEBUG_SUPABASE === 'true';

export function logSupabaseDevError(context: string, err: unknown): void {
  if (import.meta.env.DEV || DEBUG_SUPABASE) {
    logDevError(`[Supabase] ${context}`, err);
  }
}

/** Trumpa žinutė toast / UI (PostgREST: message, details, hint). */
export function formatSupabaseUserError(err: unknown): string {
  if (err == null) return '';
  if (typeof err === 'string') return err.length > 160 ? `${err.slice(0, 157)}…` : err;
  if (err instanceof Error && err.message) {
    return err.message.length > 160 ? `${err.message.slice(0, 157)}…` : err.message;
  }
  if (typeof err !== 'object') return '';
  const e = err as { message?: unknown; details?: unknown; hint?: unknown };
  const msg = typeof e.message === 'string' ? e.message : '';
  const det = typeof e.details === 'string' && e.details !== msg ? e.details : '';
  const hint = typeof e.hint === 'string' ? e.hint : '';
  const parts = [msg, det, hint].filter(Boolean);
  const s = parts.join(' — ').trim();
  return s.length > 160 ? `${s.slice(0, 157)}…` : s;
}
