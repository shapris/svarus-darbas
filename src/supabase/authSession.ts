/**
 * Autentifikacija, profilis, klientų portalas, ryšio testas.
 */

import { User } from '@supabase/supabase-js';
import {
  loginUser as localLogin,
  logoutUser as localLogout,
  getCurrentUser as localGetCurrent,
  getData as localGetData,
  addData as localAddData,
  registerUser as localRegisterUser,
} from '../localDb';
import type { AuthUser } from './dbTypes';
import { TABLES } from './constants';
import {
  supabase,
  usesLocalStorageBackend,
  needsBackendSetup,
  isSupabaseConfigured,
  isClientSelfRegistrationEnabled,
} from './client';
import { clearResolvedOwnerScopeCache } from './ownerScope';
import { logSupabaseDevError } from './logging';
import { normalizeOrderFromDb } from './normalize';
import { addData } from './crud';
import type { Client, Order, UserProfile, UserRole } from '../types';

type ProfileRow = {
  id: string;
  uid: string;
  email: string | null;
  name?: string | null;
  phone?: string | null;
  role: UserProfile['role'];
  client_id?: string | null;
  created_at?: string | null;
};

function mapProfileRowToUserProfile(data: ProfileRow): UserProfile {
  return {
    id: data.id,
    uid: data.uid,
    email: data.email ?? '',
    role: data.role,
    name: data.name ?? undefined,
    phone: data.phone ?? undefined,
    clientId: data.client_id ?? undefined,
    createdAt: data.created_at ?? new Date().toISOString(),
  };
}

function userProfileUpdatesToSnake(updates: Partial<UserProfile>): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  if (updates.email !== undefined) out.email = updates.email;
  if (updates.name !== undefined) out.name = updates.name;
  if (updates.phone !== undefined) out.phone = updates.phone;
  if (updates.role !== undefined) out.role = updates.role;
  if (updates.clientId !== undefined) out.client_id = updates.clientId;
  return out;
}

function mapSupabaseUser(user: User | null): AuthUser | null {
  if (!user) return null;
  return {
    uid: user.id,
    email: user.email || '',
    displayName: user.user_metadata?.display_name || user.email?.split('@')[0] || null,
    photoURL: user.user_metadata?.avatar_url || null,
  };
}

let authListeners: ((user: AuthUser | null) => void)[] = [];

export async function signUp(email: string, password: string, displayName?: string) {
  if (usesLocalStorageBackend) {
    try {
      const user = localRegisterUser(email, password, displayName || email.split('@')[0]);
      authListeners.forEach((cb) => cb(user));
      return {
        user: {
          id: user.uid,
          email: user.email,
          user_metadata: {
            display_name: user.displayName,
            avatar_url: user.photoURL,
          },
        } as unknown as User,
        session: null,
      };
    } catch (err: unknown) {
      const m = err instanceof Error ? err.message : 'Nepavyko sukurti paskyros';
      throw new Error('Registracijos klaida: ' + m);
    }
  }
  if (needsBackendSetup || !supabase) {
    throw new Error(
      'Registracija negalima: nesukonfigūruota debesies duomenų bazė. Nustatykite VITE_SUPABASE_URL ir VITE_SUPABASE_ANON_KEY (arba kūrimui be debesies: VITE_ALLOW_OFFLINE_CRM=true).'
    );
  }
  const { data, error } = await supabase.auth.signUp({
    email,
    password,
    options: {
      data: {
        display_name: displayName || email.split('@')[0],
      },
    },
  });
  if (error) {
    if (error.message.includes('already registered')) {
      throw new Error('Vartotojas su tokiu el. paštu jau egzistuoja');
    }
    if (error.message.includes('Password')) {
      throw new Error('Slaptažodis per silpnas. Naudokite bent 6 simbolius.');
    }
    throw new Error('Registracijos klaida: ' + error.message);
  }
  return { user: data.user, session: data.session };
}

export async function signIn(email: string, password: string) {
  if (usesLocalStorageBackend) {
    try {
      const user = localLogin(email, password);
      return {
        user: {
          id: user.uid,
          email: user.email,
          user_metadata: {
            display_name: user.displayName,
            avatar_url: user.photoURL,
          },
        } as unknown as User,
        session: null,
      };
    } catch (err: unknown) {
      const m = err instanceof Error ? err.message : 'Neteisingas el. paštas arba slaptažodis.';
      throw new Error(m);
    }
  }
  if (needsBackendSetup || !supabase) {
    throw new Error(
      'Prisijungimas negalimas: nesukonfigūruota debesies duomenų bazė. Nustatykite VITE_SUPABASE_URL ir VITE_SUPABASE_ANON_KEY (arba kūrimui be debesies: VITE_ALLOW_OFFLINE_CRM=true).'
    );
  }
  const { data, error } = await supabase.auth.signInWithPassword({
    email,
    password,
  });
  if (error) {
    if (error.message.includes('Invalid login credentials')) {
      throw new Error('Neteisingas el. paštas arba slaptažodis');
    }
    if (error.message.includes('User not found')) {
      throw new Error('Vartotojas su tokiu el. paštu nerastas');
    }
    throw new Error('Prisijungimo klaida: ' + error.message);
  }
  return { user: data.user, session: data.session };
}

export async function requestPasswordResetEmail(email: string): Promise<void> {
  const trimmed = email.trim();
  if (!trimmed) {
    throw new Error('Įveskite el. paštą.');
  }
  const redirectTo = `${window.location.origin}/reset-password`;
  if (usesLocalStorageBackend) {
    throw new Error('Slaptažodžio atstatymas nepasiekiamas vietiniame kūrimo režime be debesies.');
  }
  if (needsBackendSetup || !supabase) {
    throw new Error('Slaptažodžio atstatymas negalimas: Supabase nesukonfigūruotas.');
  }
  const { error } = await supabase.auth.resetPasswordForEmail(trimmed, { redirectTo });
  if (error) throw error;
}

export async function signInWithGoogle() {
  if (!supabase) {
    throw new Error('Google prisijungimas galimas tik su debesies paskyra (Supabase).');
  }
  const { data, error } = await supabase.auth.signInWithOAuth({
    provider: 'google',
    options: {
      redirectTo: window.location.origin,
    },
  });
  if (error) throw error;
  return data;
}

export async function signOut() {
  clearResolvedOwnerScopeCache();
  if (usesLocalStorageBackend) {
    localLogout();
    authListeners.forEach((cb) => cb(null));
    return;
  }
  if (needsBackendSetup || !supabase) {
    localLogout();
    authListeners.forEach((cb) => cb(null));
    return;
  }
  const { error } = await supabase.auth.signOut();
  if (error) throw error;
}

export async function getCurrentUser(): Promise<AuthUser | null> {
  if (usesLocalStorageBackend) {
    return localGetCurrent();
  }
  if (needsBackendSetup || !supabase) {
    return null;
  }
  try {
    const {
      data: { user },
    } = await supabase.auth.getUser();
    return mapSupabaseUser(user);
  } catch (err) {
    console.warn('Failed to get current user from Supabase:', err);
    return null;
  }
}

export function onAuthStateChange(callback: (user: AuthUser | null) => void) {
  authListeners.push(callback);

  if (usesLocalStorageBackend) {
    const currentUser = localGetCurrent();
    if (currentUser) {
      callback(currentUser);
    }
    return () => {
      authListeners = authListeners.filter((cb) => cb !== callback);
    };
  }
  if (needsBackendSetup || !supabase) {
    callback(null);
    return () => {
      authListeners = authListeners.filter((cb) => cb !== callback);
    };
  }

  return supabase.auth.onAuthStateChange(async (_event, session) => {
    if (!session?.user) {
      clearResolvedOwnerScopeCache();
    }
    if (session?.user) {
      callback(mapSupabaseUser(session.user));
    } else {
      callback(null);
    }
  });
}

export async function testConnection() {
  if (usesLocalStorageBackend) {
    return true;
  }
  if (needsBackendSetup || !supabase) {
    return false;
  }
  try {
    const { error } = await supabase.from('clients').select('id').limit(1);

    if (error && error.code !== 'PGRST116') {
      return isSupabaseConfigured;
    }
    return true;
  } catch (err) {
    logSupabaseDevError('testConnection', err);
    return false;
  }
}

export async function getUserProfile(uid: string): Promise<UserProfile | null> {
  if (usesLocalStorageBackend) {
    const storedProfile = localStorage.getItem(`profile_${uid}`);
    return storedProfile ? JSON.parse(storedProfile) : null;
  }
  if (needsBackendSetup || !supabase) {
    return null;
  }

  try {
    const { data, error } = await supabase
      .from('profiles')
      .select('id,uid,email,name,phone,role,client_id,created_at')
      .eq('uid', uid)
      .maybeSingle();

    if (error) {
      return null;
    }
    if (!data) {
      return null;
    }
    return mapProfileRowToUserProfile(data as ProfileRow);
  } catch {
    return null;
  }
}

export async function createDefaultProfile(
  uid: string,
  email?: string,
  role: UserRole = 'staff'
): Promise<UserProfile> {
  const profile: UserProfile = {
    id: crypto.randomUUID(),
    uid,
    email: email || '',
    role,
    createdAt: new Date().toISOString(),
  };

  if (usesLocalStorageBackend) {
    localStorage.setItem(`profile_${uid}`, JSON.stringify(profile));
    return profile;
  }
  if (needsBackendSetup || !supabase) {
    throw new Error(
      'Profilio sukurti negalima: nesukonfigūruota debesies duomenų bazė. Nustatykite VITE_SUPABASE_URL ir VITE_SUPABASE_ANON_KEY.'
    );
  }

  const { data, error } = await supabase
    .from('profiles')
    .insert({
      id: profile.id,
      uid: profile.uid,
      email: profile.email || '',
      role: profile.role,
      name: profile.name ?? null,
      phone: profile.phone ?? null,
      client_id: profile.clientId ?? null,
      created_at: profile.createdAt,
    })
    .select('id,uid,email,name,phone,role,client_id,created_at')
    .single();

  if (error) throw error;
  return mapProfileRowToUserProfile(data as ProfileRow);
}

export async function updateUserProfile(
  uid: string,
  updates: Partial<UserProfile>
): Promise<UserProfile | null> {
  if (usesLocalStorageBackend) {
    const profile = await getUserProfile(uid);
    if (profile) {
      const updated = { ...profile, ...updates };
      localStorage.setItem(`profile_${uid}`, JSON.stringify(updated));
      return updated;
    }
    return null;
  }
  if (needsBackendSetup || !supabase) {
    return null;
  }

  try {
    const snake = userProfileUpdatesToSnake(updates);
    if (Object.keys(snake).length === 0) {
      return getUserProfile(uid);
    }
    const { data, error } = await supabase
      .from('profiles')
      .update(snake)
      .eq('uid', uid)
      .select('id,uid,email,name,phone,role,client_id,created_at')
      .single();

    if (error) throw error;
    return mapProfileRowToUserProfile(data as ProfileRow);
  } catch {
    return null;
  }
}

export async function getClientOrders(clientId: string): Promise<Order[]> {
  if (usesLocalStorageBackend) {
    return (localGetData('orders', '') as Order[]).filter((order) => order.clientId === clientId);
  }
  if (needsBackendSetup || !supabase) {
    return [];
  }

  try {
    let { data, error } = await supabase
      .from('orders')
      .select('*')
      .eq('client_id', clientId)
      .order('date', { ascending: false });

    if (error && error.code === 'PGRST204') {
      ({ data, error } = await supabase
        .from('orders')
        .select('*')
        .eq('clientId', clientId)
        .order('date', { ascending: false }));
    }

    if (error) throw error;
    return (data as Record<string, unknown>[]).map((row) => normalizeOrderFromDb(row));
  } catch (err) {
    logSupabaseDevError('getClientOrders', err);
    return [];
  }
}

export async function registerClientUser(
  email: string,
  password: string,
  clientData: { name: string; phone: string; address: string }
) {
  if (!isClientSelfRegistrationEnabled()) {
    throw new Error(
      'Kliento saviregistracija išjungta. Įjunkite VITE_CLIENT_SELF_REGISTRATION=true (hostinge) arba naudokite rezervacijos nuorodą / administratoriaus kvietimą.'
    );
  }
  const authResult = await signUp(email, password, clientData.name);
  if (!authResult.user) {
    throw new Error('Nepavyko sukurti vartotojo');
  }

  const uid = authResult.user.id;

  const client: Client = {
    id: crypto.randomUUID(),
    name: clientData.name,
    phone: clientData.phone,
    address: clientData.address,
    buildingType: 'nesutarta',
    createdAt: new Date().toISOString(),
  };

  if (supabase) {
    await addData(
      TABLES.CLIENTS,
      uid,
      client as unknown as Omit<Record<string, unknown>, 'id' | 'uid' | 'created_at'>
    );
  } else {
    localAddData('clients', uid, client);
  }

  await createDefaultProfile(uid, email, 'client');

  await updateUserProfile(uid, {
    clientId: client.id,
    name: clientData.name,
    phone: clientData.phone,
  });

  return { user: authResult.user, client };
}
