import { TABLES } from './constants';
import { extractMissingColumnFromPgError } from './columnFallback';
import { supabase } from './client';
import { logSupabaseDevError } from './logging';

let resolvedOwnerScopeColumn: Record<string, 'owner_id' | 'uid'> = {};

export function clearResolvedOwnerScopeCache() {
  resolvedOwnerScopeColumn = {};
}

/** Po sėkmingo įrašymo su žinomu stulpeliu (pvz. employees legacy `uid`). */
export function setResolvedOwnerScopeForTable(tableName: string, column: 'owner_id' | 'uid'): void {
  resolvedOwnerScopeColumn[tableName] = column;
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

  /**
   * Senose lentelėse (pvz. employees) gali būti `createdAt`, ne `created_at`.
   * PostgREST kartais grąžina 400 be PGRST204 — vis tiek bandoma createdAt ir be order.
   */
  const selectOrdered = async (column: 'owner_id' | 'uid') => {
    const base = () => supabase.from(tableName).select('*').eq(column, userId);
    let res = await base().order('created_at', { ascending: false });
    if (!res.error) return res;
    const miss0 = extractMissingColumnFromPgError(res.error);
    if (res.error?.code === 'PGRST204' && miss0 === 'owner_id') return res;

    res = await base().order('createdAt', { ascending: false });
    if (!res.error) return res;
    const miss1 = extractMissingColumnFromPgError(res.error);
    if (res.error?.code === 'PGRST204' && miss1 === 'owner_id') return res;

    return await base();
  };

  const { data: d1, error: e1 } = await selectOrdered('owner_id');

  if (e1) {
    const missing = extractMissingColumnFromPgError(e1);
    if (e1.code === 'PGRST204' && missing === 'owner_id') {
      const { data: d2, error: e2 } = await selectOrdered('uid');
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
