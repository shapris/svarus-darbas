import {
  getData as localGetData,
  addData as localAddData,
  updateData as localUpdateData,
  deleteData as localDeleteData,
  subscribeToData as localSubscribeToData,
} from '../localDb';
import type { DatabaseRecord } from './dbTypes';
import { supabase, needsBackendSetup, usesLocalStorageBackend } from './client';
import { insertWithColumnFallback, updateWithColumnFallback } from './columnFallback';
import { DEBUG_SUPABASE, logSupabaseDevError } from './logging';
import {
  coerceBuildingType,
  coerceOrderDateForDbWrite,
  getOrderStatusDbCandidates,
  normalizeClientFromDb,
  normalizeMemoryFromDb,
  normalizeOrderFromDb,
  normalizeSettingsFromDb,
  normalizeEmployeeIdForOrderDb,
  normalizeNullableId,
  shouldTryLegacyOrderUpdateAfterModernFailure,
  isStatusValueError,
  type PgLikeError,
} from './normalize';
import {
  fetchOwnerScopedRowsRaw,
  getEffectiveOwnerScopeColumn,
  ownerScopeColumn,
} from './ownerScope';
import { ordersSchemaState } from './ordersSchema';

export async function getData<T extends DatabaseRecord>(
  tableName: string,
  userId: string
): Promise<T[]> {
  if (usesLocalStorageBackend) {
    return localGetData(tableName, userId) as unknown as T[];
  }
  if (needsBackendSetup || !supabase) {
    return [];
  }

  if (DEBUG_SUPABASE) {
    console.log(`[DEBUG] getData: table=${tableName}, userId=${userId}`);
  }

  const rows = await fetchOwnerScopedRowsRaw(tableName, userId);

  if (DEBUG_SUPABASE) {
    console.log(
      `[DEBUG] getData success: ${tableName}, rows=${rows.length}, ownerColumn=${getEffectiveOwnerScopeColumn(tableName)}`
    );
  }
  if (tableName === 'memories') {
    return (rows as Record<string, unknown>[]).map((r) =>
      normalizeMemoryFromDb(r)
    ) as unknown as T[];
  }
  if (tableName === 'clients') {
    return (rows as Record<string, unknown>[]).map((r) =>
      normalizeClientFromDb(r)
    ) as unknown as T[];
  }
  if (tableName === 'orders') {
    return (rows as Record<string, unknown>[]).map((r) =>
      normalizeOrderFromDb(r)
    ) as unknown as T[];
  }
  if (tableName === 'settings') {
    return (rows as Record<string, unknown>[]).map((r) =>
      normalizeSettingsFromDb(r)
    ) as unknown as T[];
  }
  return rows as T[];
}

export async function getDataById<T extends DatabaseRecord>(
  tableName: string,
  id: string
): Promise<T | null> {
  if (usesLocalStorageBackend) {
    const data = localGetData(tableName, '').find((item) => item.id === id) as T | undefined;
    return data || null;
  }
  if (needsBackendSetup || !supabase) {
    return null;
  }
  const { data, error } = await supabase.from(tableName).select('*').eq('id', id).single();
  if (error) {
    if (error.code === 'PGRST116') return null;
    logSupabaseDevError(`getDataById(${tableName})`, error);
    throw error;
  }
  if (tableName === 'memories' && data) {
    return normalizeMemoryFromDb(data as Record<string, unknown>) as unknown as T;
  }
  if (tableName === 'clients' && data) {
    return normalizeClientFromDb(data as Record<string, unknown>) as unknown as T;
  }
  if (tableName === 'orders' && data) {
    return normalizeOrderFromDb(data as Record<string, unknown>) as unknown as T;
  }
  return data;
}

export async function addData<T extends Record<string, unknown>>(
  tableName: string,
  userId: string,
  item: Omit<T, 'id' | 'uid' | 'created_at'>
): Promise<T> {
  if (usesLocalStorageBackend) {
    return localAddData(tableName, userId, item as never) as unknown as T;
  }
  if (needsBackendSetup || !supabase) {
    throw new Error(
      'Duomenų bazė neprijungta. Nustatykite VITE_SUPABASE_URL ir VITE_SUPABASE_ANON_KEY (arba kūrimui: VITE_ALLOW_OFFLINE_CRM=true).'
    );
  }

  if (tableName === 'memories') {
    const m = item as Record<string, unknown>;
    const content = m.content;
    if (content === undefined || content === null || String(content).trim() === '') {
      throw new Error('Memory content is required');
    }
    const insertData: Record<string, unknown> = {
      content: String(content),
      type: String(m.type ?? m.category ?? 'kita'),
      priority:
        typeof m.importance === 'number' && !Number.isNaN(m.importance)
          ? m.importance
          : typeof m.priority === 'number' && !Number.isNaN(m.priority)
            ? m.priority
            : 5,
      owner_id: userId,
      created_at: String(m.createdAt ?? m.created_at ?? new Date().toISOString()),
    };
    if (DEBUG_SUPABASE) {
      console.log(`[DEBUG] addData: table=memories`);
      console.log(`[DEBUG] insertData keys:`, Object.keys(insertData));
    }
    const { data, error } = await supabase.from('memories').insert(insertData).select().single();
    if (error) {
      logSupabaseDevError('addData(memories)', error);
      throw error;
    }
    if (DEBUG_SUPABASE) {
      console.log(`[DEBUG] addData success: memories`);
    }
    return normalizeMemoryFromDb(data as Record<string, unknown>) as unknown as T;
  }

  if (tableName === 'clients') {
    const c = item as Record<string, unknown>;
    let address = String(c.address ?? '');
    const notes = String(c.notes ?? '').trim();
    if (notes) {
      address = address ? `${address} · ${notes}` : notes;
    }
    const insertData: Record<string, unknown> = {
      name: String(c.name ?? 'Naujas klientas').trim() || 'Naujas klientas',
      phone: String(c.phone ?? ''),
      address,
      building_type: coerceBuildingType(c.buildingType ?? c.building_type),
      owner_id: userId,
      created_at: String(c.createdAt ?? c.created_at ?? new Date().toISOString()),
    };
    const em = c.email != null ? String(c.email).trim() : '';
    insertData.email = em === '' ? null : em;
    const la = c.lat ?? c.latitude;
    const ln = c.lng ?? c.longitude;
    if (typeof la === 'number' && !Number.isNaN(la)) insertData.lat = la;
    if (typeof ln === 'number' && !Number.isNaN(ln)) insertData.lng = ln;
    if (DEBUG_SUPABASE) {
      console.log(`[DEBUG] addData: table=clients`, Object.keys(insertData));
    }
    const { data, error } = await insertWithColumnFallback('clients', insertData);
    if (error) {
      logSupabaseDevError(
        `addData(clients): ${(error as { message?: string; code?: string }).message || (error as { code?: string }).code}`,
        error
      );
      throw error;
    }
    if (DEBUG_SUPABASE) {
      console.log(`[DEBUG] addData success: clients`);
    }
    return normalizeClientFromDb(data as Record<string, unknown>) as unknown as T;
  }

  if (tableName === 'orders') {
    const o = item as Record<string, unknown>;
    const services = (o.additionalServices ?? {}) as Record<string, unknown>;
    const todayIso = new Date().toISOString().split('T')[0];
    const modernInsert: Record<string, unknown> = {
      client_id: normalizeNullableId(o.clientId ?? o.client_id),
      client_name: o.clientName ?? o.client_name ?? '',
      employee_id: normalizeEmployeeIdForOrderDb(o.employeeId ?? o.employee_id),
      address: o.address ?? '',
      lat: o.lat ?? null,
      lng: o.lng ?? null,
      date: coerceOrderDateForDbWrite(o.date ?? todayIso) ?? `${todayIso}T00:00:00.000Z`,
      time: o.time ?? '10:00',
      window_count: Number(o.windowCount ?? o.window_count ?? 0),
      floor: Number(o.floor ?? 1),
      additional_services: services,
      total_price: Number(o.totalPrice ?? o.total_price ?? o.price ?? 0),
      status: o.status ?? 'suplanuota',
      estimated_duration: o.estimatedDuration ?? o.estimated_duration ?? 60,
      is_recurring: o.isRecurring ?? o.is_recurring ?? false,
      recurring_interval: o.recurringInterval ?? o.recurring_interval ?? null,
      notes: o.notes ?? '',
      owner_id: userId,
      created_at: String(o.createdAt ?? o.created_at ?? new Date().toISOString()),
    };
    const legacyInsert: Record<string, unknown> = {
      client_id: normalizeNullableId(o.clientId ?? o.client_id),
      date: coerceOrderDateForDbWrite(o.date ?? todayIso) ?? `${todayIso}T00:00:00.000Z`,
      time: o.time ?? '10:00',
      windows: Number(o.windowCount ?? o.window_count ?? 0),
      floors: Number(o.floor ?? 1),
      balkonai: services.balkonai ? 1 : 0,
      vitrinos: services.vitrinos ? 1 : 0,
      terasa: services.terasa ? 1 : 0,
      kiti: services.kiti ? 'taip' : '',
      status: o.status ?? 'pending',
      price: Number(o.totalPrice ?? o.total_price ?? o.price ?? 0),
      owner_id: userId,
      created_at: String(o.createdAt ?? o.created_at ?? new Date().toISOString()),
    };

    let data: unknown = null;
    let error: PgLikeError = null;
    if (ordersSchemaState.mode !== 'legacy') {
      ({ data, error } = await supabase.from('orders').insert(modernInsert).select().single());
      if (!error) {
        ordersSchemaState.mode = 'modern';
      }
    }
    if (ordersSchemaState.mode === 'legacy' || (error && error.code === 'PGRST204')) {
      ({ data, error } = await insertWithColumnFallback('orders', legacyInsert));
      if (!error) {
        ordersSchemaState.mode = 'legacy';
      }
    }
    if (error) {
      logSupabaseDevError(`addData(orders): ${error.message || error.code}`, error);
      throw error;
    }
    return normalizeOrderFromDb(data as Record<string, unknown>) as unknown as T;
  }
  if (tableName === 'expenses') {
    const e = item as Record<string, unknown>;
    const insertData: Record<string, unknown> = {
      title: String(e.title ?? 'nesutarta'),
      amount: Number(e.amount ?? 0),
      date: String(e.date ?? new Date().toISOString().split('T')[0]),
      category: String(e.category ?? 'kita'),
      notes: e.notes != null ? String(e.notes) : '',
      owner_id: userId,
    };
    const { data, error } = await insertWithColumnFallback('expenses', insertData);
    if (error) {
      logSupabaseDevError(`addData(expenses): ${error.message || error.code}`, error);
      throw error;
    }
    return data as T;
  }

  const snakeItem: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(item)) {
    if (key === 'uid' || key === 'owner_id') {
      if (DEBUG_SUPABASE) {
        console.log(`[DEBUG] Skipping key: ${key}`);
      }
      continue;
    }
    snakeItem[key.replace(/([A-Z])/g, '_$1').toLowerCase()] = value;
  }
  const idColumn = ownerScopeColumn(tableName);
  const insertData = { ...snakeItem, [idColumn]: userId };

  if (DEBUG_SUPABASE) {
    console.log(`[DEBUG] addData: table=${tableName}, column=${idColumn}`);
    console.log(`[DEBUG] insertData keys:`, Object.keys(insertData));
  }

  const { data, error } = await supabase.from(tableName).insert(insertData).select().single();
  if (error) {
    logSupabaseDevError(
      `addData(${tableName}): ${(error as { message?: string; code?: string }).message || (error as { code?: string }).code}`,
      error
    );
    throw error;
  }
  if (DEBUG_SUPABASE) {
    console.log(`[DEBUG] addData success: ${tableName}`);
  }
  return data as T;
}

export async function updateData<T extends Record<string, unknown>>(
  tableName: string,
  id: string,
  updates: Partial<T>
): Promise<void> {
  if (usesLocalStorageBackend) {
    localUpdateData(tableName, id, updates as never);
    return;
  }
  if (needsBackendSetup || !supabase) {
    throw new Error(
      'Duomenų bazė neprijungta. Nustatykite VITE_SUPABASE_URL ir VITE_SUPABASE_ANON_KEY (arba kūrimui: VITE_ALLOW_OFFLINE_CRM=true).'
    );
  }
  if (tableName === 'expenses') {
    const u = updates as Record<string, unknown>;
    const snake: Record<string, unknown> = {};
    if (u.title !== undefined) snake.title = u.title;
    if (u.amount !== undefined) snake.amount = u.amount;
    if (u.date !== undefined) snake.date = u.date;
    if (u.category !== undefined) snake.category = u.category;
    if (u.notes !== undefined) snake.notes = u.notes;
    if (Object.keys(snake).length === 0) return;
    const error = await updateWithColumnFallback('expenses', id, snake);
    if (error) {
      logSupabaseDevError('updateData(expenses)', error);
      throw error;
    }
    return;
  }
  if (tableName === 'memories') {
    const u = updates as Record<string, unknown>;
    const snakeUpdates: Record<string, unknown> = {};
    if (u.content !== undefined) snakeUpdates.content = u.content;
    if (u.category !== undefined) snakeUpdates.type = u.category;
    if (u.type !== undefined) snakeUpdates.type = u.type;
    if (u.importance !== undefined) snakeUpdates.priority = u.importance;
    if (u.priority !== undefined) snakeUpdates.priority = u.priority;
    if (Object.keys(snakeUpdates).length === 0) {
      return;
    }
    const { error } = await supabase.from('memories').update(snakeUpdates).eq('id', id);
    if (error) {
      logSupabaseDevError('updateData(memories)', error);
      throw error;
    }
    return;
  }
  if (tableName === 'clients') {
    const u = updates as Record<string, unknown>;
    const snake: Record<string, unknown> = {};
    if (u.name !== undefined) snake.name = u.name;
    if (u.phone !== undefined) snake.phone = u.phone;
    if (u.email !== undefined) snake.email = u.email === '' ? null : u.email;
    if (u.address !== undefined) snake.address = u.address;
    if (u.buildingType !== undefined) snake.building_type = coerceBuildingType(u.buildingType);
    if (u.building_type !== undefined) snake.building_type = coerceBuildingType(u.building_type);
    if (u.lastCleaningDate !== undefined) snake.last_cleaning_date = u.lastCleaningDate;
    if (u.last_cleaning_date !== undefined) snake.last_cleaning_date = u.last_cleaning_date;
    if (u.lat !== undefined) snake.lat = u.lat;
    if (u.lng !== undefined) snake.lng = u.lng;
    if (Object.keys(snake).length === 0) {
      return;
    }
    const error = await updateWithColumnFallback('clients', id, snake);
    if (error) {
      logSupabaseDevError('updateData(clients)', error);
      throw error;
    }
    return;
  }
  if (tableName === 'orders') {
    const u = updates as Record<string, unknown>;
    const services = (u.additionalServices ?? {}) as Record<string, unknown>;
    const modernBase: Record<string, unknown> = {};
    if (u.clientId !== undefined) modernBase.client_id = normalizeNullableId(u.clientId);
    if (u.clientName !== undefined) modernBase.client_name = u.clientName;
    if (u.employeeId !== undefined)
      modernBase.employee_id = normalizeEmployeeIdForOrderDb(u.employeeId);
    if (u.address !== undefined) modernBase.address = u.address;
    if (u.lat !== undefined) modernBase.lat = u.lat;
    if (u.lng !== undefined) modernBase.lng = u.lng;
    if (u.date !== undefined) {
      const d = coerceOrderDateForDbWrite(u.date);
      if (d !== undefined && d !== null && d !== '') modernBase.date = d;
    }
    if (u.time !== undefined) modernBase.time = u.time;
    if (u.windowCount !== undefined) modernBase.window_count = u.windowCount;
    if (u.floor !== undefined) modernBase.floor = u.floor;
    if (u.additionalServices !== undefined) modernBase.additional_services = services;
    if (u.totalPrice !== undefined) modernBase.total_price = u.totalPrice;
    if (u.estimatedDuration !== undefined) modernBase.estimated_duration = u.estimatedDuration;
    if (u.isRecurring !== undefined) modernBase.is_recurring = u.isRecurring;
    if (u.recurringInterval !== undefined) modernBase.recurring_interval = u.recurringInterval;
    if (u.notes !== undefined) modernBase.notes = u.notes;
    if (u.photoBefore !== undefined) modernBase.photo_before = u.photoBefore;
    if (u.photoAfter !== undefined) modernBase.photo_after = u.photoAfter;
    modernBase.updated_at = new Date().toISOString();
    const statusCandidates =
      u.status !== undefined ? getOrderStatusDbCandidates(u.status) : ['__no_status_change__'];

    let error: PgLikeError = null;
    if (ordersSchemaState.mode !== 'legacy') {
      for (const candidate of statusCandidates) {
        const modernPayload = { ...modernBase };
        if (candidate !== '__no_status_change__') modernPayload.status = candidate;
        error = await updateWithColumnFallback('orders', id, modernPayload);
        if (!error) {
          ordersSchemaState.mode = 'modern';
          break;
        }
        if (candidate !== '__no_status_change__' && !isStatusValueError(error)) {
          break;
        }
      }
    }
    if (
      ordersSchemaState.mode === 'legacy' ||
      (error && shouldTryLegacyOrderUpdateAfterModernFailure(error))
    ) {
      const legacyBase: Record<string, unknown> = {};
      if (u.clientId !== undefined) legacyBase.client_id = normalizeNullableId(u.clientId);
      if (u.date !== undefined) {
        const d = coerceOrderDateForDbWrite(u.date);
        if (d !== undefined && d !== null && d !== '') legacyBase.date = d;
      }
      if (u.time !== undefined) legacyBase.time = u.time;
      if (u.employeeId !== undefined) {
        legacyBase.employeeId = normalizeNullableId(u.employeeId);
      }
      if (u.windowCount !== undefined) legacyBase.windows = u.windowCount;
      if (u.floor !== undefined) legacyBase.floors = u.floor;
      if (u.additionalServices !== undefined) {
        legacyBase.balkonai = services.balkonai ? 1 : 0;
        legacyBase.vitrinos = services.vitrinos ? 1 : 0;
        legacyBase.terasa = services.terasa ? 1 : 0;
        legacyBase.kiti = services.kiti ? 'taip' : '';
      }
      if (u.totalPrice !== undefined) legacyBase.price = u.totalPrice;
      if (u.notes !== undefined) legacyBase.notes = u.notes;
      legacyBase.updated_at = new Date().toISOString();
      for (const candidate of statusCandidates) {
        const legacyPayload = { ...legacyBase };
        if (candidate !== '__no_status_change__') legacyPayload.status = candidate;
        error = await updateWithColumnFallback('orders', id, legacyPayload);
        if (!error) {
          ordersSchemaState.mode = 'legacy';
          break;
        }
      }
    }
    if (error) {
      logSupabaseDevError('updateData(orders)', error);
      throw error;
    }
    return;
  }
  const snakeUpdates: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(updates)) {
    snakeUpdates[key.replace(/([A-Z])/g, '_$1').toLowerCase()] = value;
  }
  const { error } = await supabase
    .from(tableName)
    .update({ ...snakeUpdates, updated_at: new Date().toISOString() })
    .eq('id', id);
  if (error) {
    logSupabaseDevError(`updateData(${tableName})`, error);
    throw error;
  }
}

export async function deleteData(tableName: string, id: string): Promise<void> {
  if (usesLocalStorageBackend) {
    localDeleteData(tableName, id);
    return;
  }
  if (needsBackendSetup || !supabase) {
    throw new Error(
      'Duomenų bazė neprijungta. Nustatykite VITE_SUPABASE_URL ir VITE_SUPABASE_ANON_KEY (arba kūrimui: VITE_ALLOW_OFFLINE_CRM=true).'
    );
  }
  const { error } = await supabase.from(tableName).delete().eq('id', id);
  if (error) {
    logSupabaseDevError(`deleteData(${tableName})`, error);
    throw error;
  }
}

export function subscribeToData<T extends DatabaseRecord>(
  tableName: string,
  userId: string,
  callback: (data: T[]) => void
): () => void {
  if (usesLocalStorageBackend) {
    return localSubscribeToData(tableName, userId, (rows) => callback(rows as unknown as T[]));
  }
  if (needsBackendSetup || !supabase) {
    callback([] as T[]);
    return () => {};
  }

  const client = supabase;
  let channel: ReturnType<typeof client.channel> | null = null;
  let cancelled = false;

  const removeChannel = () => {
    if (channel) {
      void client.removeChannel(channel);
      channel = null;
    }
  };

  getData<T>(tableName, userId)
    .then((rows) => {
      if (cancelled) return;
      callback(rows);
      if (cancelled) return;
      const idColumn = getEffectiveOwnerScopeColumn(tableName);
      const channelName = `crm_${tableName}_${userId}`.replace(/[^a-zA-Z0-9_-]/g, '_');
      channel = client
        .channel(channelName)
        .on(
          'postgres_changes',
          { event: '*', schema: 'public', table: tableName, filter: `${idColumn}=eq.${userId}` },
          (_payload) => {
            getData<T>(tableName, userId)
              .then(callback)
              .catch((e) => logSupabaseDevError(`subscribeToData realtime(${tableName})`, e));
          }
        )
        .subscribe((_status) => {});
    })
    .catch((e) => logSupabaseDevError(`subscribeToData initial(${tableName})`, e));

  return () => {
    cancelled = true;
    removeChannel();
  };
}
