import { supabase } from './client';
import type { PgLikeError } from './normalize';

const tableMissingColumnsCache = new Map<string, Set<string>>();

/** Stulpeliai, kurių „išmetimas“ iš UPDATE vis dar laikomas „tuščiu“ atnaujinimu. */
const UPDATE_META_KEYS = new Set(['updated_at']);

function countNonMetaUpdateKeys(payload: Record<string, unknown>): number {
  return Object.keys(payload).filter((k) => !UPDATE_META_KEYS.has(k)).length;
}

export function precacheRemoveMissingColumns(tableName: string, payload: Record<string, unknown>) {
  const set = tableMissingColumnsCache.get(tableName);
  if (!set) return;
  for (const col of set) {
    if (tableName === 'clients' && col === 'email') continue;
    delete payload[col];
  }
}

export function recordMissingColumn(tableName: string, col: string) {
  let set = tableMissingColumnsCache.get(tableName);
  if (!set) {
    set = new Set();
    tableMissingColumnsCache.set(tableName, set);
  }
  set.add(col);
}

export function extractMissingColumnFromPgError(error: PgLikeError): string | null {
  const msg = String(error?.message ?? '');
  let match = msg.match(/Could not find the '([^']+)' column/i);
  if (match?.[1]) return match[1];
  match = msg.match(/column "([^"]+)" does not exist/i);
  if (match?.[1]) return match[1];
  return null;
}

export async function insertWithColumnFallback(
  tableName: string,
  initialPayload: Record<string, unknown>
): Promise<{ data: unknown; error: PgLikeError }> {
  const payload: Record<string, unknown> = { ...initialPayload };
  precacheRemoveMissingColumns(tableName, payload);
  let attempts = 0;
  while (attempts < 12) {
    attempts += 1;
    const { data, error } = await supabase!.from(tableName).insert(payload).select().single();
    if (!error) return { data, error: null };
    const missing = extractMissingColumnFromPgError(error);
    if (error.code !== 'PGRST204' || !missing || !(missing in payload)) {
      return { data: null, error };
    }
    if (!(tableName === 'clients' && missing === 'email')) {
      recordMissingColumn(tableName, missing);
    }
    delete payload[missing];
  }
  return { data: null, error: { code: 'PGRST204', message: 'Too many missing-column retries' } };
}

export async function updateWithColumnFallback(
  tableName: string,
  id: string,
  initialPayload: Record<string, unknown>
): Promise<PgLikeError> {
  const payload: Record<string, unknown> = { ...initialPayload };
  const initialDataKeys = countNonMetaUpdateKeys(initialPayload);
  precacheRemoveMissingColumns(tableName, payload);
  if (countNonMetaUpdateKeys(payload) === 0 && initialDataKeys > 0) {
    return {
      code: 'PGRST204',
      message:
        'Could not find a column from the update payload in the schema cache (all data columns were skipped).',
    };
  }
  let attempts = 0;
  while (attempts < 12) {
    attempts += 1;
    const { error } = await supabase!.from(tableName).update(payload).eq('id', id);
    if (!error) return null;
    const missing = extractMissingColumnFromPgError(error);
    if (error.code !== 'PGRST204' || !missing || !(missing in payload)) {
      return error;
    }
    if (!(tableName === 'clients' && missing === 'email')) {
      recordMissingColumn(tableName, missing);
    }
    delete payload[missing];
    if (countNonMetaUpdateKeys(payload) === 0 && initialDataKeys > 0) {
      return {
        code: 'PGRST204',
        message:
          'Could not find a column from the update payload in the schema cache (all data columns were skipped).',
      };
    }
  }
  return { code: 'PGRST204', message: 'Too many missing-column retries' };
}
