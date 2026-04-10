export function isLikelyNetworkError(error: unknown): boolean {
  const msg = error instanceof Error ? error.message : String(error || '');
  const text = msg.toLowerCase();
  return (
    text.includes('failed to fetch') ||
    text.includes('network') ||
    text.includes('fetch') ||
    text.includes('timeout') ||
    text.includes('timed out') ||
    text.includes('503') ||
    text.includes('502') ||
    text.includes('504') ||
    text.includes('cors')
  );
}

function extractRawErrorMessage(error: unknown): string {
  if (error instanceof Error && error.message.trim()) return error.message.trim();
  if (error && typeof error === 'object' && 'message' in error) {
    const m = (error as { message: unknown }).message;
    if (typeof m === 'string' && m.trim()) return m.trim();
  }
  return '';
}

export function formatNetworkErrorForUser(error: unknown, fallback: string): string {
  if (isLikelyNetworkError(error)) {
    return `${fallback} Patikrinkite interneto ryšį ir bandykite dar kartą.`;
  }
  const raw = extractRawErrorMessage(error);
  if (!raw) return fallback;
  const safe = sanitizeSupabaseErrorForDisplay(raw);
  const tail = safe?.trim() ? safe.trim() : raw;
  return `${fallback} ${tail}`.trim();
}

/**
 * Neatvaizduoti neapdoroto PostgREST / RLS teksto galutiniam vartotojui (Mokėjimai ir pan.).
 */
export function sanitizeSupabaseErrorForDisplay(message: string): string {
  const t = String(message || '').trim();
  if (!t) return '';
  const low = t.toLowerCase();
  if (low.includes('infinite recursion') && low.includes('policy')) {
    return 'Prieigos klaida: saugumo taisyklių konfliktas duomenų bazėje (RLS). Kreipkitės į administratorių — dažniausiai reikia pataisyti workspace_memberships arba susijusias politikas Supabase.';
  }
  if (low.includes('jwt expired') || low.includes('invalid jwt')) {
    return 'Sesija pasibaigė. Prisijunkite iš naujo.';
  }
  if (/relation\s+["']?[\w.]+["']?\s+does not exist/i.test(t)) {
    return 'Trūksta reikiamos lentelės. Įkelkite migracijas arba SQL schemą.';
  }
  if (t.length > 220 && /policy|postgres|postgrest|rls|42501/i.test(low)) {
    return 'Serverio klaida kraunant duomenis. Jei kartojasi, patikrinkite Supabase RLS politikas ir lentelių teises.';
  }
  return t;
}
