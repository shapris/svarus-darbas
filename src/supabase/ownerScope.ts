import { TABLES } from './constants';
import { extractMissingColumnFromPgError } from './columnFallback';
import { supabase } from './client';
import { logSupabaseDevError } from './logging';

let resolvedOwnerScopeColumn: Record<string, 'owner_id' | 'uid'> = {};

export function clearResolvedOwnerScopeCache() {
  resolvedOwnerScopeColumn = {};
}

/** RLS / filtravimui: kur saugomas savininkas (`profiles` → uid uuid). */
export function ownerScopeColumn(tableName: string): 'uid' | 'owner_id' {
  if (tableName === TABLES.PROFILES || tableName === 'profiles') return 'uid';
  return 'owner_id';
}

/** Realtime filtras turi sutapti su tuo stulpeliu, pagal kurį getData iš tikrųjų skaito. */
export function getEffectiveOwnerScopeColumn(tableName: string): 'owner_id' | 'uid' {
  if (tableName === TABLES.PROFILES || tableName === 'profiles') return 'uid';
  return resolvedOwnerScopeColumn[tableName] ?? 'owner_id';
}

export async function fetchOwnerScopedRowsRaw(
  tableName: string,
  userId: string
): Promise<Record<string, unknown>[]> {
  if (!supabase) return [];

  if (tableName === 'profiles') {
    const { data, error } = await supabase
      .from('profiles')
      .select('id,uid,email,name,phone,role,client_id,created_at')
      .match({ uid: userId });
    if (error) {
      logSupabaseDevError(`getData(${tableName})`, error);
      throw error;
    }
    return (data || []) as Record<string, unknown>[];
  }

  const run = (column: 'owner_id' | 'uid') =>
    supabase
      .from(tableName)
      .select('*')
      .eq(column, userId)
      .order('created_at', { ascending: false });

  const { data: d1, error: e1 } = await run('owner_id');

  if (e1) {
    const missing = extractMissingColumnFromPgError(e1);
    if (e1.code === 'PGRST204' && missing === 'owner_id') {
      const { data: d2, error: e2 } = await run('uid');
      if (e2) {
        logSupabaseDevError(`getData(${tableName})`, e2);
        throw e2;
      }
      resolvedOwnerScopeColumn[tableName] = 'uid';
      return (d2 || []) as Record<string, unknown>[];
    }
    logSupabaseDevError(`getData(${tableName})`, e1);
    throw e1;
  }

  const rows1 = (d1 || []) as Record<string, unknown>[];
  resolvedOwnerScopeColumn[tableName] = 'owner_id';
  return rows1;
}
