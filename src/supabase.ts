/**
 * Supabase Client Configuration
 * Free cloud database solution with localStorage fallback
 */

import { createClient, SupabaseClient, User } from '@supabase/supabase-js';
import {
    loginUser as localLogin,
    logoutUser as localLogout,
    getCurrentUser as localGetCurrent,
    getData as localGetData,
    addData as localAddData,
    updateData as localUpdateData,
    deleteData as localDeleteData,
    subscribeToData as localSubscribeToData,
    registerUser as localRegisterUser
} from './localDb';
import * as FirebaseBackend from './firebaseBridge';
import { DEFAULT_SETTINGS, type AppSettings } from './types';

const forceDemoMode = import.meta.env.VITE_DEMO_MODE === 'true';

/** Google Firebase + Firestore (no SQL, console-based setup). */
export const usesFirebase =
    !forceDemoMode &&
    import.meta.env.VITE_USE_FIREBASE === 'true' &&
    !!import.meta.env.VITE_FIREBASE_API_KEY &&
    !!import.meta.env.VITE_FIREBASE_PROJECT_ID;

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || '';
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY || '';
const isValidSupabaseUrl = supabaseUrl.includes('.supabase.co') && !supabaseUrl.includes('your-project');
const isSupabaseConfigured =
    !usesFirebase &&
    !forceDemoMode &&
    !!(supabaseUrl && supabaseAnonKey && isValidSupabaseUrl);

export const supabase: SupabaseClient | null = isSupabaseConfigured
    ? createClient(supabaseUrl, supabaseAnonKey, {
        auth: {
            autoRefreshToken: true,
            persistSession: true,
            detectSessionInUrl: true,
        },
    })
    : null;

export const isRemoteBackend = usesFirebase || !!supabase;

export const isDemoMode = forceDemoMode || (!usesFirebase && !isSupabaseConfigured);

if (import.meta.env.DEV) {
    console.log('[Data] Config:', {
        usesFirebase,
        supabaseUrl: supabaseUrl ? 'set' : 'missing',
        supabaseKey: supabaseAnonKey ? 'set' : 'missing',
        isValidSupabaseUrl,
        isSupabaseConfigured,
        isDemoMode,
        forceDemoMode,
    });
}

// Database table names
export const TABLES = {
    CLIENTS: 'clients',
    ORDERS: 'orders',
    EXPENSES: 'expenses',
    EMPLOYEES: 'employees',
    SETTINGS: 'settings',
    INVENTORY: 'inventory',
    PROFILES: 'profiles',
} as const;

// Type definitions for database records
export interface DatabaseRecord {
    id?: string;
    uid?: string;
    created_at?: string;
    updated_at?: string;
    [key: string]: any;
}

// Auth helpers
export interface AuthUser {
    uid: string;
    email: string;
    displayName: string | null;
    photoURL: string | null;
}

// Convert Supabase user to app user format
function mapSupabaseUser(user: User | null): AuthUser | null {
    if (!user) return null;
    return {
        uid: user.id,
        email: user.email || '',
        displayName: user.user_metadata?.display_name || user.email?.split('@')[0] || null,
        photoURL: user.user_metadata?.avatar_url || null,
    };
}

// Auth listeners for demo mode
let authListeners: ((user: AuthUser | null) => void)[] = [];

// Sign up with email and password
export async function signUp(email: string, password: string, displayName?: string) {
    if (usesFirebase) {
        return FirebaseBackend.signUp(email, password, displayName);
    }
    if (isDemoMode || !supabase) {
        // Demo mode: use localDb
        try {
            const user = localRegisterUser(email, password, displayName || email.split('@')[0]);
            authListeners.forEach(cb => cb(user));
            return {
                user: {
                    id: user.uid,
                    email: user.email,
                    user_metadata: {
                        display_name: user.displayName,
                        avatar_url: user.photoURL
                    }
                } as unknown as User,
                session: null
            };
        } catch (err: any) {
            throw new Error('Registracijos klaida: ' + (err.message || 'Nepavyko sukurti paskyros'));
        }
    }
    try {
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
            // Provide more specific error messages
            if (error.message.includes('already registered')) {
                throw new Error('Vartotojas su tokiu el. paštu jau egzistuoja');
            }
            if (error.message.includes('Password')) {
                throw new Error('Slaptažodis per silpnas. Naudokite bent 6 simbolius.');
            }
            throw new Error('Registracijos klaida: ' + error.message);
        }
        return { user: data.user, session: data.session };
    } catch (err: any) {
        // If Supabase fails, try fallback to demo mode
        console.warn('Supabase signup failed, trying demo mode:', err);
        try {
            const user = localRegisterUser(email, password, displayName || email.split('@')[0]);
            authListeners.forEach(cb => cb(user));
            return {
                user: {
                    id: user.uid,
                    email: user.email,
                    user_metadata: {
                        display_name: user.displayName,
                        avatar_url: user.photoURL
                    }
                } as unknown as User,
                session: null,
                isDemoFallback: true
            };
        } catch (localErr) {
            throw err;
        }
    }
}

// Sign in with email and password
export async function signIn(email: string, password: string) {
    if (import.meta.env.DEV) {
        console.log('[Auth] signIn called, isDemoMode:', isDemoMode, 'usesFirebase:', usesFirebase, 'has supabase:', !!supabase);
    }

    if (usesFirebase) {
        return FirebaseBackend.signIn(email, password);
    }

    if (isDemoMode || !supabase) {
        // Demo mode: use localDb
        if (import.meta.env.DEV) console.log('[Auth] Using local demo mode');
        try {
            const user = localLogin(email, password);
            return {
                user: {
                    id: user.uid,
                    email: user.email,
                    user_metadata: {
                        display_name: user.displayName,
                        avatar_url: user.photoURL
                    }
                } as unknown as User,
                session: null
            };
        } catch (err: any) {
            throw new Error('Demo režimas: ' + (err.message || 'Neteisingas el. paštas arba slaptažodis'));
        }
    }
    console.log('[Auth] Using Supabase auth');
    try {
        const { data, error } = await supabase.auth.signInWithPassword({
            email,
            password,
        });
        if (error) {
            // Provide more specific error messages
            if (error.message.includes('Invalid login credentials')) {
                throw new Error('Neteisingas el. paštas arba slaptažodis');
            }
            if (error.message.includes('User not found')) {
                throw new Error('Vartotojas su tokiu el. paštu nerastas');
            }
            throw new Error('Prisijungimo klaida: ' + error.message);
        }
        return { user: data.user, session: data.session };
    } catch (err: any) {
        // If Supabase fails, try fallback to demo mode
        console.warn('Supabase login failed, trying demo mode:', err);
        try {
            const user = localLogin(email, password);
            return {
                user: {
                    id: user.uid,
                    email: user.email,
                    user_metadata: {
                        display_name: user.displayName,
                        avatar_url: user.photoURL
                    }
                } as unknown as User,
                session: null,
                isDemoFallback: true
            };
        } catch (localErr) {
            throw err;
        }
    }
}

// Sign in with Google
export async function signInWithGoogle() {
    if (usesFirebase) {
        return FirebaseBackend.signInWithGoogle();
    }
    if (!supabase) {
        throw new Error('Google prisijungimas galimas tik su debesies paskyra (Firebase arba Supabase).');
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

// Sign out
export async function signOut() {
    if (usesFirebase) {
        await FirebaseBackend.signOut();
        return;
    }
    if (isDemoMode || !supabase) {
        localLogout();
        authListeners.forEach(cb => cb(null));
        return;
    }
    const { error } = await supabase.auth.signOut();
    if (error) throw error;
}

// Get current user
export async function getCurrentUser(): Promise<AuthUser | null> {
    if (usesFirebase) {
        return FirebaseBackend.getCurrentUser();
    }
    if (isDemoMode || !supabase) {
        return localGetCurrent();
    }
    try {
        const { data: { user } } = await supabase.auth.getUser();
        return mapSupabaseUser(user);
    } catch (err) {
        console.warn('Failed to get current user from Supabase, falling back to local:', err);
        return localGetCurrent();
    }
}

// Listen to auth changes
export function onAuthStateChange(callback: (user: AuthUser | null) => void) {
    if (usesFirebase) {
        return FirebaseBackend.onAuthStateChange(callback);
    }

    authListeners.push(callback);

    if (isDemoMode || !supabase) {
        // Check for existing demo session
        const currentUser = localGetCurrent();
        if (currentUser) {
            callback(currentUser);
        }
        return () => {
            authListeners = authListeners.filter(cb => cb !== callback);
        };
    }

    return supabase.auth.onAuthStateChange(async (event, session) => {
        if (session?.user) {
            callback(mapSupabaseUser(session.user));
        } else {
            callback(null);
        }
    });
}

// Database operations - with demo mode fallback
export async function getData<T extends DatabaseRecord>(
    tableName: string,
    userId: string
): Promise<T[]> {
    if (usesFirebase) {
        return FirebaseBackend.getData<T>(tableName, userId);
    }
    if (isDemoMode || !supabase) {
        return localGetData<any>(tableName, userId);
    }
    const { data, error } = await supabase
        .from(tableName)
        .select('*')
        .eq('uid', userId)
        .order('created_at', { ascending: false });
    if (error) {
        console.error(`Error fetching ${tableName}:`, error);
        throw error;
    }
    return data || [];
}

export async function getDataById<T extends DatabaseRecord>(
    tableName: string,
    id: string
): Promise<T | null> {
    if (usesFirebase) {
        return FirebaseBackend.getDataById<T>(tableName, id);
    }
    if (isDemoMode || !supabase) {
        const data = localGetData<any>(tableName, '').find(item => item.id === id);
        return data || null;
    }
    const { data, error } = await supabase
        .from(tableName)
        .select('*')
        .eq('id', id)
        .single();
    if (error) {
        if (error.code === 'PGRST116') return null;
        console.error(`Error fetching ${tableName} by id:`, error);
        throw error;
    }
    return data;
}

export async function addData<T extends Record<string, unknown>>(
    tableName: string,
    userId: string,
    item: Omit<T, 'id' | 'uid' | 'created_at'>
): Promise<T> {
    if (usesFirebase) {
        return FirebaseBackend.addData<T>(tableName, userId, item);
    }
    if (isDemoMode || !supabase) {
        return localAddData<any>(tableName, userId, item);
    }
    // Convert camelCase to snake_case for Supabase
    const snakeItem: Record<string, unknown> = {};
    for (const [key, value] of Object.entries(item)) {
        snakeItem[key.replace(/([A-Z])/g, '_$1').toLowerCase()] = value;
    }
    const { data, error } = await supabase
        .from(tableName)
        .insert({ ...snakeItem, uid: userId })
        .select()
        .single();
    if (error) {
        console.error(`Error adding to ${tableName}:`, error);
        throw error;
    }
    return data;
}

export async function updateData<T extends Record<string, unknown>>(
    tableName: string,
    id: string,
    updates: Partial<T>
): Promise<void> {
    if (usesFirebase) {
        await FirebaseBackend.updateData<T>(tableName, id, updates);
        return;
    }
    if (isDemoMode || !supabase) {
        localUpdateData<any>(tableName, id, updates);
        return;
    }
    // Convert camelCase to snake_case for Supabase
    const snakeUpdates: Record<string, unknown> = {};
    for (const [key, value] of Object.entries(updates)) {
        snakeUpdates[key.replace(/([A-Z])/g, '_$1').toLowerCase()] = value;
    }
    const { error } = await supabase
        .from(tableName)
        .update({ ...snakeUpdates, updated_at: new Date().toISOString() })
        .eq('id', id);
    if (error) {
        console.error(`Error updating ${tableName}:`, error);
        throw error;
    }
}

export async function deleteData(tableName: string, id: string): Promise<void> {
    if (usesFirebase) {
        await FirebaseBackend.deleteData(tableName, id);
        return;
    }
    if (isDemoMode || !supabase) {
        localDeleteData(tableName, id);
        return;
    }
    const { error } = await supabase.from(tableName).delete().eq('id', id);
    if (error) {
        console.error(`Error deleting from ${tableName}:`, error);
        throw error;
    }
}

// Real-time subscription
export function subscribeToData<T extends DatabaseRecord>(
    tableName: string,
    userId: string,
    callback: (data: T[]) => void
): () => void {
    if (usesFirebase) {
        return FirebaseBackend.subscribeToData<T>(tableName, userId, callback);
    }
    if (isDemoMode || !supabase) {
        return localSubscribeToData<any>(tableName, userId, callback);
    }

    // Initial fetch
    getData<T>(tableName, userId).then(callback).catch(console.error);

    const channelName = `crm_${tableName}_${userId}`.replace(/[^a-zA-Z0-9_-]/g, '_');
    const channel = supabase
        .channel(channelName)
        .on(
            'postgres_changes',
            { event: '*', schema: 'public', table: tableName, filter: `uid=eq.${userId}` },
            (payload) => {
                console.log(`[Realtime] ${tableName} changed:`, payload);
                getData<T>(tableName, userId).then(callback).catch(console.error);
            }
        )
        .subscribe((status) => {
            console.log(`[Realtime] Channel ${channelName} status:`, status);
        });

    return () => {
        void supabase.removeChannel(channel);
    };
}

/** Public booking page: pricing (works for anonymous visitors when RPC + RLS are deployed). */
export async function fetchPublicBookingSettings(ownerUid: string): Promise<AppSettings> {
    if (usesFirebase) {
        return FirebaseBackend.fetchPublicBookingSettings(ownerUid);
    }
    if (isDemoMode || !supabase) {
        const rows = localGetData<any>(TABLES.SETTINGS, ownerUid);
        const row = rows[0];
        return row ? { ...DEFAULT_SETTINGS, ...row } : { ...DEFAULT_SETTINGS };
    }
    const { data, error } = await supabase.rpc('get_booking_settings', { p_owner_uid: ownerUid });
    if (error) {
        if (import.meta.env.DEV) console.warn('[Booking] get_booking_settings:', error.message);
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
            smsTemplate: typeof raw.smsTemplate === 'string' ? raw.smsTemplate : DEFAULT_SETTINGS.smsTemplate,
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
    if (usesFirebase) {
        await FirebaseBackend.submitPublicBooking(ownerUid, clientPayload, orderPayload);
        return;
    }
    if (isDemoMode || !supabase) {
        throw new Error('submitPublicBooking requires cloud backend');
    }
    const { error } = await supabase.rpc('submit_public_booking', {
        p_owner_uid: ownerUid,
        p_client: clientPayload,
        p_order: orderPayload,
    });
    if (error) throw error;
}

// Test connection
export async function testConnection() {
    if (usesFirebase) {
        return FirebaseBackend.testConnection();
    }
    if (isDemoMode || !supabase) {
        return true;
    }
    try {
        // First check if we can reach the Supabase API at all
        const response = await fetch(`${supabaseUrl}/rest/v1/`, {
            method: 'GET',
            headers: {
                'apikey': supabaseAnonKey,
                'Authorization': `Bearer ${supabaseAnonKey}`,
            },
        });

        if (!response.ok) {
            console.error('Supabase connection error:', response.status, response.statusText);
            return false;
        }

        // Then check if the clients table exists
        const { data, error } = await supabase.from('clients').select('id').limit(1);
        if (error && error.code !== 'PGRST116') {
            console.error('Supabase table error:', error);
            // Table might not exist - still return true if we can reach the API
            return response.ok;
        }
        return true;
    } catch (err) {
        console.error('Supabase connection failed:', err);
        return false;
    }
}

// Export auth
export const auth = supabase?.auth;
export default supabase;
