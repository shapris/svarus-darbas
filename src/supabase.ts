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
import {
    DEFAULT_SETTINGS,
    type AppSettings,
    type UserProfile,
    type UserRole,
    type Client,
    type Order,
    type Memory,
    type Invoice,
    type Transaction,
} from './types';

const forceDemoMode = import.meta.env.VITE_DEMO_MODE === 'true';

/** Google Firebase + Firestore (no SQL, console-based setup). */
export const usesFirebase =
    !forceDemoMode &&
    import.meta.env.VITE_USE_FIREBASE === 'true' &&
    !!import.meta.env.VITE_FIREBASE_API_KEY &&
    !!import.meta.env.VITE_FIREBASE_PROJECT_ID;

// Supabase credentials – only from .env / hosting env (never commit real keys in source).
const supabaseUrl = (import.meta.env.VITE_SUPABASE_URL as string | undefined)?.trim() || '';
const supabaseAnonKey = (import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined)?.trim() || '';
const isValidSupabaseUrl = supabaseUrl.includes('.supabase.co') && !supabaseUrl.includes('your-project');
const isSupabaseConfigured =
    !usesFirebase &&
    !forceDemoMode &&
    !!(supabaseUrl && supabaseAnonKey && isValidSupabaseUrl);

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
            // Do not set global Accept/Content-Type — PostgREST needs per-request Accept
            // (e.g. application/vnd.pgrst.object+json for .single()), or you get 406.
        })))
    : null;

export const isRemoteBackend = usesFirebase || !!supabase;

export const isDemoMode = forceDemoMode || (!usesFirebase && !isSupabaseConfigured);



// Database table names
export const TABLES = {
    CLIENTS: 'clients',
    ORDERS: 'orders',
    EXPENSES: 'expenses',
    EMPLOYEES: 'employees',
    SETTINGS: 'settings',
    INVENTORY: 'inventory',
    PROFILES: 'profiles',
    INVOICES: 'invoices',
    TRANSACTIONS: 'transactions',
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

/** Opt-in only: set VITE_DEBUG_SUPABASE=true to log fetch/query details. */
const DEBUG_SUPABASE = import.meta.env.VITE_DEBUG_SUPABASE === 'true';

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

const MEMORY_CATEGORIES = new Set<string>(['klientas', 'verslas', 'procesas', 'kita']);

function coerceMemoryCategory(v: unknown): Memory['category'] {
    const s = typeof v === 'string' ? v : 'kita';
    return MEMORY_CATEGORIES.has(s) ? (s as Memory['category']) : 'kita';
}

/** DB uses `type` / `priority` / `owner_id`; app uses category / importance / uid. */
function normalizeMemoryFromDb(row: Record<string, unknown>): Memory {
    const typeOrCat = row.category ?? row.type ?? 'kita';
    const imp = row.importance ?? row.priority;
    return {
        id: String(row.id ?? ''),
        content: String(row.content ?? ''),
        category: coerceMemoryCategory(typeOrCat),
        importance: typeof imp === 'number' && !Number.isNaN(imp) ? imp : 3,
        createdAt: String(row.created_at ?? row.createdAt ?? new Date().toISOString()),
        uid: String(row.owner_id ?? row.uid ?? ''),
        eventDate: row.event_date
            ? String(row.event_date)
            : row.eventDate
              ? String(row.eventDate)
              : undefined,
        isActive: row.is_active === undefined && row.isActive === undefined ? true : row.is_active !== false && row.isActive !== false,
    };
}

const BUILDING_TYPES = new Set<string>(['butas', 'namas', 'ofisas', 'nesutarta']);

function coerceBuildingType(v: unknown): Client['buildingType'] {
    const s = typeof v === 'string' ? v.toLowerCase().trim() : '';
    if (BUILDING_TYPES.has(s)) return s as Client['buildingType'];
    return 'nesutarta';
}

/** SQL `clients`: name, phone, email, address, building_type, owner_id, created_at (no `notes` in default schema). */
function normalizeClientFromDb(row: Record<string, unknown>): Client {
    const latRaw = typeof row.lat === 'string' ? parseFloat(row.lat) : row.lat;
    const lngRaw = typeof row.lng === 'string' ? parseFloat(row.lng) : row.lng;
    const emailRaw = row.email ?? row.Email ?? row.e_mail;
    return {
        id: String(row.id ?? ''),
        name: String(row.name ?? ''),
        phone: String(row.phone ?? ''),
        email:
            emailRaw != null && String(emailRaw).trim() !== ''
                ? String(emailRaw).trim()
                : undefined,
        address: String(row.address ?? ''),
        buildingType: coerceBuildingType(row.building_type ?? row.buildingType),
        notes: row.notes != null ? String(row.notes) : undefined,
        lastCleaningDate:
            row.last_cleaning_date != null
                ? String(row.last_cleaning_date)
                : row.lastCleaningDate != null
                  ? String(row.lastCleaningDate)
                  : undefined,
        createdAt: String(row.created_at ?? row.createdAt ?? new Date().toISOString()),
        lat: (() => {
            const n = typeof latRaw === 'string' ? parseFloat(latRaw) : typeof latRaw === 'number' ? latRaw : NaN;
            return Number.isFinite(n) ? n : undefined;
        })(),
        lng: (() => {
            const n = typeof lngRaw === 'string' ? parseFloat(lngRaw) : typeof lngRaw === 'number' ? lngRaw : NaN;
            return Number.isFinite(n) ? n : undefined;
        })(),
    };
}

function mapOrderStatusFromDb(v: unknown): Order['status'] {
    const s = String(v ?? '').toLowerCase();
    if (s === 'vykdoma' || s === 'in_progress') return 'vykdoma';
    if (s === 'atlikta' || s === 'completed' || s === 'done') return 'atlikta';
    return 'suplanuota';
}

function getOrderStatusDbCandidates(v: unknown): string[] {
    const raw = String(v ?? '').trim();
    if (!raw) return [];
    const lower = raw.toLowerCase();
    const altLt =
        lower === 'pending' ? 'suplanuota' :
        lower === 'in_progress' ? 'vykdoma' :
        lower === 'completed' || lower === 'done' ? 'atlikta' :
        raw;
    const altEn =
        lower === 'suplanuota' ? 'pending' :
        lower === 'vykdoma' ? 'in_progress' :
        lower === 'atlikta' ? 'completed' :
        raw;
    const altEn2 =
        lower === 'suplanuota' ? 'planned' :
        lower === 'vykdoma' ? 'inprogress' :
        lower === 'atlikta' ? 'done' :
        raw;
    return Array.from(new Set([raw, altEn, altLt, altEn2]));
}

function normalizeNullableId(v: unknown): string | null {
    if (v === null || v === undefined) return null;
    const s = String(v).trim();
    return s ? s : null;
}

/** `orders.date` dažnai `timestamptz`; vieną datą (YYYY-MM-DD) rašykime kaip ISO su laiku. */
function coerceOrderDateForDbWrite(v: unknown): unknown {
    if (v === null || v === undefined) return v;
    const s = String(v).trim();
    if (!s) return v;
    if (/^\d{4}-\d{2}-\d{2}$/.test(s)) {
        return `${s}T00:00:00.000Z`;
    }
    return v;
}

function shouldTryLegacyOrderUpdateAfterModernFailure(error: PgLikeError): boolean {
    if (!error) return false;
    if (error.code === 'PGRST204') return true;
    const msg = String(error.message ?? '').toLowerCase();
    const details = String((error as { details?: string }).details ?? '').toLowerCase();
    const hint = String((error as { hint?: string }).hint ?? '').toLowerCase();
    const t = `${msg} ${details} ${hint}`;
    if (t.includes('42804')) return true;
    if (t.includes('22p02')) return true;
    if (t.includes('invalid input syntax')) return true;
    if (t.includes('could not find') && t.includes('column')) return true;
    if ((t.includes('does not exist') || t.includes('undefined column')) && (t.includes('column') || t.includes('field'))) {
        return true;
    }
    if (/is of type .* but expression/.test(t)) return true;
    return false;
}

function isStatusValueError(error: PgLikeError): boolean {
    const msg = String(error?.message ?? '').toLowerCase();
    const code = String(error?.code ?? '');
    return (
        msg.includes('invalid input value for enum') ||
        msg.includes('violates check constraint') ||
        code === '22P02' ||
        code === '23514'
    );
}

function normalizeOrderDateFromDb(v: unknown): string {
    const raw = String(v ?? '').trim();
    if (!raw) return '';
    const iso = raw.match(/^(\d{4}-\d{2}-\d{2})/);
    if (iso) return iso[1];
    const lt = raw.match(/^(\d{1,2})[./-](\d{1,2})[./-](\d{4})$/);
    if (lt) {
        const dd = lt[1].padStart(2, '0');
        const mm = lt[2].padStart(2, '0');
        const yyyy = lt[3];
        return `${yyyy}-${mm}-${dd}`;
    }
    const parsed = new Date(raw);
    if (!Number.isNaN(parsed.getTime())) return parsed.toISOString().split('T')[0];
    return raw;
}

function normalizeOrderFromDb(row: Record<string, unknown>): Order {
    const legacyServices = {
        balkonai: Number(row.balkonai ?? 0) > 0,
        vitrinos: Number(row.vitrinos ?? 0) > 0,
        terasa: Number(row.terasa ?? 0) > 0,
        kiti: String(row.kiti ?? '').trim().length > 0,
    };
    const services =
        (row.additional_services as Order['additionalServices']) ||
        (row.additionalServices as Order['additionalServices']) ||
        legacyServices;

    return {
        id: String(row.id ?? ''),
        clientId: String(row.client_id ?? row.clientId ?? ''),
        clientName: String(row.client_name ?? row.clientName ?? ''),
        employeeId: row.employee_id != null ? String(row.employee_id) : row.employeeId != null ? String(row.employeeId) : undefined,
        address: String(row.address ?? ''),
        lat: row.lat != null ? Number(row.lat) : undefined,
        lng: row.lng != null ? Number(row.lng) : undefined,
        date: normalizeOrderDateFromDb(row.date),
        time: String(row.time ?? '10:00'),
        windowCount: Number(row.window_count ?? row.windowCount ?? row.windows ?? 0),
        floor: Number(row.floor ?? row.floors ?? 1),
        additionalServices: {
            balkonai: !!services?.balkonai,
            vitrinos: !!services?.vitrinos,
            terasa: !!services?.terasa,
            kiti: !!services?.kiti,
        },
        totalPrice: Number(row.total_price ?? row.totalPrice ?? row.price ?? 0),
        status: mapOrderStatusFromDb(row.status),
        estimatedDuration: row.estimated_duration != null ? Number(row.estimated_duration) : row.estimatedDuration != null ? Number(row.estimatedDuration) : undefined,
        isRecurring: row.is_recurring != null ? Boolean(row.is_recurring) : row.isRecurring != null ? Boolean(row.isRecurring) : undefined,
        recurringInterval: row.recurring_interval != null ? Number(row.recurring_interval) : row.recurringInterval != null ? Number(row.recurringInterval) : undefined,
        notes: row.notes != null ? String(row.notes) : undefined,
        photoBefore: row.photo_before != null ? String(row.photo_before) : row.photoBefore != null ? String(row.photoBefore) : undefined,
        photoAfter: row.photo_after != null ? String(row.photo_after) : row.photoAfter != null ? String(row.photoAfter) : undefined,
        evaluation: row.evaluation as Order['evaluation'],
        isPaid: row.is_paid != null ? Boolean(row.is_paid) : row.isPaid != null ? Boolean(row.isPaid) : undefined,
        serviceType: row.service_type != null ? String(row.service_type) : row.serviceType != null ? String(row.serviceType) : undefined,
        createdAt: String(row.created_at ?? row.createdAt ?? new Date().toISOString()),
    };
}

const INVOICE_STATUSES = new Set<string>(['pending', 'paid', 'cancelled', 'refunded']);

function coerceInvoiceStatus(v: unknown): Invoice['status'] {
    const s = typeof v === 'string' ? v.toLowerCase().trim() : '';
    if (INVOICE_STATUSES.has(s)) return s as Invoice['status'];
    return 'pending';
}

const TRANSACTION_TYPES = new Set<string>(['payment', 'refund', 'partial_refund']);

function coerceTransactionType(v: unknown): Transaction['type'] {
    const s = typeof v === 'string' ? v.toLowerCase().trim() : '';
    if (TRANSACTION_TYPES.has(s)) return s as Transaction['type'];
    return 'payment';
}

/** Normalizuoja `invoices` eilutę į [Invoice](types.ts). */
export function normalizeInvoiceFromDb(row: Record<string, unknown>): Invoice {
    return {
        id: String(row.id ?? ''),
        order_id: String(row.order_id ?? ''),
        client_id: String(row.client_id ?? ''),
        amount: Number(row.amount ?? 0),
        status: coerceInvoiceStatus(row.status),
        due_date: row.due_date != null ? String(row.due_date) : '',
        created_at: row.created_at != null ? String(row.created_at) : new Date().toISOString(),
        paid_at: row.paid_at != null ? String(row.paid_at) : undefined,
        stripe_payment_intent_id:
            row.stripe_payment_intent_id != null ? String(row.stripe_payment_intent_id) : undefined,
        invoice_url: row.invoice_url != null ? String(row.invoice_url) : undefined,
    };
}

/** Normalizuoja `transactions` eilutę į [Transaction](types.ts). */
export function normalizeTransactionFromDb(row: Record<string, unknown>): Transaction {
    return {
        id: String(row.id ?? ''),
        invoice_id: row.invoice_id != null ? String(row.invoice_id) : undefined,
        payment_intent_id: row.payment_intent_id != null ? String(row.payment_intent_id) : undefined,
        client_id: String(row.client_id ?? ''),
        amount: Number(row.amount ?? 0),
        currency: String(row.currency ?? 'eur'),
        status: String(row.status ?? ''),
        type: coerceTransactionType(row.type),
        stripe_charge_id: row.stripe_charge_id != null ? String(row.stripe_charge_id) : undefined,
        failure_reason: row.failure_reason != null ? String(row.failure_reason) : undefined,
        created_at: row.created_at != null ? String(row.created_at) : new Date().toISOString(),
        processed_at: row.processed_at != null ? String(row.processed_at) : undefined,
    };
}

export function isPaymentsTableUnavailableError(
    error: unknown,
    table: 'invoices' | 'transactions'
): boolean {
    const e = error as { code?: string; message?: string };
    const code = String(e?.code ?? '');
    const msg = String(e?.message ?? '').toLowerCase();
    const needle = table;
    if ((code === 'PGRST205' || code === '42P01') && (msg.includes(needle) || msg.includes(`public.${needle}`)))
        return true;
    if (msg.includes('schema cache') && msg.includes(needle)) return true;
    if (msg.includes(needle) && (msg.includes('does not exist') || msg.includes('could not find'))) return true;
    return false;
}

/** @deprecated Naudokite isPaymentsTableUnavailableError(err, 'invoices') */
export function isInvoicesTableUnavailableError(error: unknown): boolean {
    return isPaymentsTableUnavailableError(error, 'invoices');
}

export interface FetchPaymentsWorkspaceResult {
    invoices: Invoice[];
    transactions: Transaction[];
    /** `invoices` lentelė neegzistuoja arba nepasiekiama schema cache. */
    tablesMissing: boolean;
    queryError?: string;
}

/**
 * Darbuotojo CRM: sąskaitos ir transakcijos iš Supabase (RLS pagal staff/admin).
 * Demo / Firebase / be Supabase — tušti masyvai.
 */
export async function fetchPaymentsWorkspaceData(_userId: string): Promise<FetchPaymentsWorkspaceResult> {
    if (usesFirebase || isDemoMode || !supabase) {
        return { invoices: [], transactions: [], tablesMissing: false };
    }

    const invRes = await supabase.from(TABLES.INVOICES).select('*').order('created_at', { ascending: false });
    if (invRes.error) {
        if (isPaymentsTableUnavailableError(invRes.error, 'invoices')) {
            return { invoices: [], transactions: [], tablesMissing: true, queryError: invRes.error.message };
        }
        return { invoices: [], transactions: [], tablesMissing: false, queryError: invRes.error.message };
    }

    const invoices = (invRes.data || []).map((r) => normalizeInvoiceFromDb(r as Record<string, unknown>));

    const txnRes = await supabase.from(TABLES.TRANSACTIONS).select('*').order('created_at', { ascending: false });
    if (txnRes.error) {
        if (isPaymentsTableUnavailableError(txnRes.error, 'transactions')) {
            return {
                invoices,
                transactions: [],
                tablesMissing: false,
                queryError: txnRes.error.message,
            };
        }
        return { invoices, transactions: [], tablesMissing: false, queryError: txnRes.error.message };
    }

    const transactions = (txnRes.data || []).map((r) => normalizeTransactionFromDb(r as Record<string, unknown>));
    return { invoices, transactions, tablesMissing: false };
}

export async function updateInvoiceStatusInSupabase(invoiceId: string, status: Invoice['status']): Promise<Invoice> {
    if (usesFirebase || isDemoMode || !supabase) {
        throw new Error('Sąskaitų atnaujinimas galimas tik su prijungta Supabase duomenų baze.');
    }
    const payload: Record<string, unknown> = { status };
    if (status === 'paid') {
        payload.paid_at = new Date().toISOString();
    } else {
        payload.paid_at = null;
    }

    const { data, error } = await supabase
        .from(TABLES.INVOICES)
        .update(payload)
        .eq('id', invoiceId)
        .select()
        .single();

    if (error) throw error;
    return normalizeInvoiceFromDb(data as Record<string, unknown>);
}

type PgLikeError = { code?: string; message?: string } | null;
const tableMissingColumnsCache = new Map<string, Set<string>>();

function precacheRemoveMissingColumns(tableName: string, payload: Record<string, unknown>) {
    const set = tableMissingColumnsCache.get(tableName);
    if (!set) return;
    for (const col of set) {
        // `email` stulpelis dažnai pridedamas vėliau per SQL; nenaikinti iš anksto,
        // kad po ALTER TABLE nereikėtų perkrauti visos programos.
        if (tableName === 'clients' && col === 'email') continue;
        delete payload[col];
    }
}

function recordMissingColumn(tableName: string, col: string) {
    let set = tableMissingColumnsCache.get(tableName);
    if (!set) {
        set = new Set();
        tableMissingColumnsCache.set(tableName, set);
    }
    set.add(col);
}

function extractMissingColumnFromPgError(error: PgLikeError): string | null {
    const msg = String(error?.message ?? '');
    const match = msg.match(/Could not find the '([^']+)' column/i);
    return match?.[1] ?? null;
}

async function insertWithColumnFallback(
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

async function updateWithColumnFallback(
    tableName: string,
    id: string,
    initialPayload: Record<string, unknown>
): Promise<PgLikeError> {
    const payload: Record<string, unknown> = { ...initialPayload };
    precacheRemoveMissingColumns(tableName, payload);
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
    }
    return { code: 'PGRST204', message: 'Too many missing-column retries' };
}

export async function checkOrdersSchemaHealth(userId: string): Promise<{
    ok: boolean;
    mode: 'modern' | 'legacy' | 'unknown';
    message: string;
}> {
    if (isDemoMode || !supabase) {
        return {
            ok: true,
            mode: 'unknown',
            message: 'Demo režimas: SQL schema netikrinama.',
        };
    }

    const probeModern = {
        owner_id: userId,
        client_name: 'schema_probe',
        date: new Date().toISOString().split('T')[0],
        time: '10:00',
        window_count: 1,
        floor: 1,
        additional_services: { balkonai: false, vitrinos: false, terasa: false, kiti: false },
        total_price: 0,
        status: 'suplanuota',
        created_at: new Date().toISOString(),
    };
    const modern = await supabase.from('orders').insert(probeModern).select('id').single();
    if (!modern.error) {
        const createdId = (modern.data as { id?: string } | null)?.id;
        if (createdId) await supabase.from('orders').delete().eq('id', createdId);
        ordersSchemaMode = 'modern';
        return { ok: true, mode: 'modern', message: 'Orders schema: modern (window_count/floor/additional_services).' };
    }

    const probeLegacy = {
        owner_id: userId,
        date: new Date().toISOString().split('T')[0],
        time: '10:00',
        windows: 1,
        floors: 1,
        balkonai: 0,
        vitrinos: 0,
        terasa: 0,
        kiti: '',
        status: 'pending',
        price: 0,
        created_at: new Date().toISOString(),
    };
    const legacy = await supabase.from('orders').insert(probeLegacy).select('id').single();
    if (!legacy.error) {
        const createdId = (legacy.data as { id?: string } | null)?.id;
        if (createdId) await supabase.from('orders').delete().eq('id', createdId);
        ordersSchemaMode = 'legacy';
        return { ok: true, mode: 'legacy', message: 'Orders schema: legacy (windows/floors/balkonai/vitrinos/terasa).' };
    }

    return {
        ok: false,
        mode: 'unknown',
        message: `Orders schema check failed. Modern: ${modern.error.message || modern.error.code}. Legacy: ${legacy.error.message || legacy.error.code}.`,
    };
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
let ordersSchemaMode: 'unknown' | 'modern' | 'legacy' = 'unknown';

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
    if (usesFirebase) {
        return FirebaseBackend.signIn(email, password);
    }

    if (isDemoMode || !supabase) {
        // Demo mode: use localDb
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

/** Request password reset email (Supabase or Firebase). Not available in pure local demo. */
export async function requestPasswordResetEmail(email: string): Promise<void> {
    const trimmed = email.trim();
    if (!trimmed) {
        throw new Error('Įveskite el. paštą.');
    }
    const redirectTo = `${window.location.origin}/reset-password`;
    if (usesFirebase) {
        await FirebaseBackend.sendFirebasePasswordReset(trimmed);
        return;
    }
    if (isDemoMode || !supabase) {
        throw new Error('Slaptažodžio atstatymas šiuo metu nepasiekiamas vietiniame režime.');
    }
    const { error } = await supabase.auth.resetPasswordForEmail(trimmed, { redirectTo });
    if (error) throw error;
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
    // Use 'uid' for profiles table, 'owner_id' for other tables
    const idColumn = tableName === 'profiles' ? 'uid' : 'owner_id';
    
    if (DEBUG_SUPABASE) {
        console.log(`[DEBUG] getData: table=${tableName}, column=${idColumn}, userId=${userId}`);
    }
    
    // Dynamic table/columns — chain types differ per step; use a loose builder.
    let query: any = supabase.from(tableName);
    if (tableName === 'profiles') {
        query = query.select('id,uid,email,name,phone,role,client_id,created_at');
    } else {
        query = query.select('*');
    }
    if (tableName === 'profiles') {
        query = query.match({ [idColumn]: userId });
    } else {
        query = query.eq(idColumn, userId);
    }
    if (tableName !== 'profiles') {
        query = query.order('created_at', { ascending: false });
    }
    
    const { data, error } = await query;
    if (error) {
        console.error(`[DEBUG] Error fetching ${tableName}:`, error);
        throw error;
    }
    if (DEBUG_SUPABASE) {
        console.log(`[DEBUG] getData success: ${tableName}, rows=${data?.length || 0}`);
    }
    const rows = data || [];
    if (tableName === 'memories') {
        return (rows as Record<string, unknown>[]).map((r) => normalizeMemoryFromDb(r)) as unknown as T[];
    }
    if (tableName === 'clients') {
        return (rows as Record<string, unknown>[]).map((r) => normalizeClientFromDb(r)) as unknown as T[];
    }
    if (tableName === 'orders') {
        return (rows as Record<string, unknown>[]).map((r) => normalizeOrderFromDb(r)) as unknown as T[];
    }
    return rows as T[];
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
    if (usesFirebase) {
        return FirebaseBackend.addData<T>(tableName, userId, item);
    }
    if (isDemoMode || !supabase) {
        return localAddData<any>(tableName, userId, item);
    }

    // Legacy Supabase `memories` table: content, type, priority, owner_id, created_at (not category/importance)
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
        const { data, error } = await supabase
            .from('memories')
            .insert(insertData)
            .select()
            .single();
        if (error) {
            console.error(`[DEBUG] Error adding to memories:`, error);
            throw error;
        }
        if (DEBUG_SUPABASE) {
            console.log(`[DEBUG] addData success: memories`);
        }
        return normalizeMemoryFromDb(data as Record<string, unknown>) as unknown as T;
    }

    // Default Supabase `clients`: no `notes` column — merge notes into address; only known columns.
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
            console.error(
                `Error adding to clients:`,
                (error as { message?: string; code?: string }).message || (error as { code?: string }).code,
                error
            );
            throw error;
        }
        if (DEBUG_SUPABASE) {
            console.log(`[DEBUG] addData success: clients`);
        }
        return normalizeClientFromDb(data as Record<string, unknown>) as unknown as T;
    }

    // Support both new and legacy Supabase `orders` schemas.
    if (tableName === 'orders') {
        const o = item as Record<string, unknown>;
        const services = (o.additionalServices ?? {}) as Record<string, unknown>;
        const modernInsert: Record<string, unknown> = {
            client_id: normalizeNullableId(o.clientId ?? o.client_id),
            client_name: o.clientName ?? o.client_name ?? '',
            employee_id: normalizeNullableId(o.employeeId ?? o.employee_id),
            address: o.address ?? '',
            lat: o.lat ?? null,
            lng: o.lng ?? null,
            date: coerceOrderDateForDbWrite(o.date ?? new Date().toISOString().split('T')[0]),
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
            date: coerceOrderDateForDbWrite(o.date ?? new Date().toISOString().split('T')[0]),
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
        if (ordersSchemaMode !== 'legacy') {
            ({ data, error } = await supabase.from('orders').insert(modernInsert).select().single());
            if (!error) {
                ordersSchemaMode = 'modern';
            }
        }
        if (ordersSchemaMode === 'legacy' || (error && error.code === 'PGRST204')) {
            ({ data, error } = await insertWithColumnFallback('orders', legacyInsert));
            if (!error) {
                ordersSchemaMode = 'legacy';
            }
        }
        if (error) {
            console.error(`Error adding to orders:`, error.message || error.code, error);
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
            console.error(`Error adding to expenses:`, error.message || error.code, error);
            throw error;
        }
        return data as T;
    }

    // Convert camelCase to snake_case for Supabase
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
    const idColumn = tableName === 'profiles' ? 'uid' : 'owner_id';
    const insertData = { ...snakeItem, [idColumn]: userId };

    if (DEBUG_SUPABASE) {
        console.log(`[DEBUG] addData: table=${tableName}, column=${idColumn}`);
        console.log(`[DEBUG] insertData keys:`, Object.keys(insertData));
    }

    const { data, error } = await supabase
        .from(tableName)
        .insert(insertData)
        .select()
        .single();
    if (error) {
        console.error(
            `Error adding to ${tableName}:`,
            (error as { message?: string; code?: string }).message || (error as { code?: string }).code,
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
    if (usesFirebase) {
        await FirebaseBackend.updateData<T>(tableName, id, updates);
        return;
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
            console.error(`Error updating expenses:`, error);
            throw error;
        }
        return;
    }
    if (isDemoMode || !supabase) {
        localUpdateData<any>(tableName, id, updates);
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
            console.error(`Error updating memories:`, error);
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
            console.error(`Error updating clients:`, error);
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
        if (u.employeeId !== undefined) modernBase.employee_id = normalizeNullableId(u.employeeId);
        if (u.address !== undefined) modernBase.address = u.address;
        if (u.lat !== undefined) modernBase.lat = u.lat;
        if (u.lng !== undefined) modernBase.lng = u.lng;
        if (u.date !== undefined) modernBase.date = coerceOrderDateForDbWrite(u.date);
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
        const statusCandidates = u.status !== undefined ? getOrderStatusDbCandidates(u.status) : ['__no_status_change__'];

        let error: PgLikeError = null;
        if (ordersSchemaMode !== 'legacy') {
            for (const candidate of statusCandidates) {
                const modernPayload = { ...modernBase };
                if (candidate !== '__no_status_change__') modernPayload.status = candidate;
                error = await updateWithColumnFallback('orders', id, modernPayload);
                if (!error) {
                    ordersSchemaMode = 'modern';
                    break;
                }
                if (candidate !== '__no_status_change__' && !isStatusValueError(error)) {
                    break;
                }
            }
        }
        if (ordersSchemaMode === 'legacy' || (error && shouldTryLegacyOrderUpdateAfterModernFailure(error))) {
            const legacyBase: Record<string, unknown> = {};
            if (u.clientId !== undefined) legacyBase.client_id = normalizeNullableId(u.clientId);
            if (u.date !== undefined) legacyBase.date = coerceOrderDateForDbWrite(u.date);
            if (u.time !== undefined) legacyBase.time = u.time;
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
                    ordersSchemaMode = 'legacy';
                    break;
                }
            }
        }
        if (error) {
            console.error(`Error updating orders:`, error);
            throw error;
        }
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

    // Use 'uid' for profiles table, 'owner_id' for other tables
    const idColumn = tableName === 'profiles' ? 'uid' : 'owner_id';
    
    const channelName = `crm_${tableName}_${userId}`.replace(/[^a-zA-Z0-9_-]/g, '_');
    const channel = supabase
        .channel(channelName)
        .on(
            'postgres_changes',
            { event: '*', schema: 'public', table: tableName, filter: `${idColumn}=eq.${userId}` },
            (payload) => {
                getData<T>(tableName, userId).then(callback).catch(console.error);
            }
        )
        .subscribe((status) => {
        });

    return () => {
        void supabase.removeChannel(channel);
    };
}

function isBookingRpcMissing(error: { message?: string; code?: string; status?: number } | null): boolean {
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
    if (error) {
        if (isBookingRpcMissing(error)) {
            throw new Error(
                'booking_rpc_missing: Supabase SQL Editor įkelkite supabase/public_booking_rpcs.sql (funkcijos get_booking_settings ir submit_public_booking).'
            );
        }
        const d = error as { message?: string; details?: string; hint?: string; code?: string };
        if (import.meta.env.DEV) {
            console.warn('[Booking] submit_public_booking:', d.message, d.details || '', d.hint || '', d.code || '');
        }
        const text = [d.message, d.details, d.hint].filter(Boolean).join(' · ') || 'submit_public_booking failed';
        throw new Error(text);
    }
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
        // Use Supabase client to test connection
        const { data, error } = await supabase.from('clients').select('id').limit(1);
        
        // If table doesn't exist (PGRST116), that's OK - the API is reachable
        if (error && error.code !== 'PGRST116') {
            return isSupabaseConfigured;
        }
        return true;
    } catch (err) {
        console.error('Supabase connection failed:', err);
        return false;
    }
}

// Role-based functions

// Get user profile with role
export async function getUserProfile(uid: string): Promise<UserProfile | null> {
    if (usesFirebase) {
        return FirebaseBackend.getUserProfile(uid);
    }
    if (isDemoMode || !supabase) {
        // Demo mode: check local storage for user role
        const storedProfile = localStorage.getItem(`profile_${uid}`);
        return storedProfile ? JSON.parse(storedProfile) : null;
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

// Create default user profile
export async function createDefaultProfile(uid: string, email?: string, role: UserRole = 'staff'): Promise<UserProfile> {
    const profile: UserProfile = {
        id: crypto.randomUUID(),
        uid,
        email: email || '',
        role,
        createdAt: new Date().toISOString()
    };
    
    if (usesFirebase) {
        return FirebaseBackend.createProfile(profile);
    }
    if (isDemoMode || !supabase) {
        localStorage.setItem(`profile_${uid}`, JSON.stringify(profile));
        return profile;
    }
    
    try {
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
    } catch (err) {
        // Fallback to local storage
        localStorage.setItem(`profile_${uid}`, JSON.stringify(profile));
        return profile;
    }
}

// Update user profile
export async function updateUserProfile(uid: string, updates: Partial<UserProfile>): Promise<UserProfile | null> {
    if (usesFirebase) {
        return FirebaseBackend.updateUserProfile(uid, updates);
    }
    if (isDemoMode || !supabase) {
        const profile = await getUserProfile(uid);
        if (profile) {
            const updated = { ...profile, ...updates };
            localStorage.setItem(`profile_${uid}`, JSON.stringify(updated));
            return updated;
        }
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
    } catch (err) {
        return null;
    }
}

// Get client orders for client portal
export async function getClientOrders(clientId: string): Promise<Order[]> {
    if (usesFirebase) {
        return FirebaseBackend.getClientOrders(clientId);
    }
    if (isDemoMode || !supabase) {
        return localGetData<any>('orders', '').filter(order => order.clientId === clientId) as Order[];
    }
    
    try {
        const { data, error } = await supabase
            .from('orders')
            .select('*')
            .eq('clientId', clientId)
            .order('date', { ascending: false });
            
        if (error) throw error;
        return data as Order[];
    } catch (err) {
        console.error('Error getting client orders:', err);
        return [];
    }
}

// Register client user
export async function registerClientUser(email: string, password: string, clientData: { name: string; phone: string; address: string }) {
    // First create auth user
    const authResult = await signUp(email, password, clientData.name);
    if (!authResult.user) {
        throw new Error('Nepavyko sukurti vartotojo');
    }
    
    const uid = authResult.user.id;
    
    // Create client record
    const client: Client = {
        id: crypto.randomUUID(),
        name: clientData.name,
        phone: clientData.phone,
        address: clientData.address,
        buildingType: 'nesutarta',
        createdAt: new Date().toISOString()
    };
    
    if (usesFirebase) {
        await FirebaseBackend.addData('clients', uid, client as unknown as Record<string, unknown>);
    } else if (!isDemoMode && supabase) {
        const { error } = await supabase.from('clients').insert(client);
        if (error) throw error;
    } else {
        localAddData('clients', uid, client);
    }
    
    // Create user profile with client role
    await createDefaultProfile(uid, email, 'client');
    
    // Link profile to client
    await updateUserProfile(uid, { clientId: client.id, name: clientData.name, phone: clientData.phone });
    
    return { user: authResult.user, client };
}

// Export auth
export const auth = supabase?.auth;
export default supabase;
