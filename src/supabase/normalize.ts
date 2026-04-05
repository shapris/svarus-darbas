import {
  DEFAULT_SETTINGS,
  type AppSettings,
  type Client,
  type Invoice,
  type Memory,
  type Order,
  type Transaction,
} from '../types';

const MEMORY_CATEGORIES = new Set<string>(['klientas', 'verslas', 'procesas', 'kita']);

function coerceMemoryCategory(v: unknown): Memory['category'] {
  const s = typeof v === 'string' ? v : 'kita';
  return MEMORY_CATEGORIES.has(s) ? (s as Memory['category']) : 'kita';
}

/** DB uses `type` / `priority` / `owner_id`; app uses category / importance / uid. */
export function normalizeMemoryFromDb(row: Record<string, unknown>): Memory {
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
    isActive:
      row.is_active === undefined && row.isActive === undefined
        ? true
        : row.is_active !== false && row.isActive !== false,
  };
}

const BUILDING_TYPES = new Set<string>(['butas', 'namas', 'ofisas', 'nesutarta']);

export function coerceBuildingType(v: unknown): Client['buildingType'] {
  const s = typeof v === 'string' ? v.toLowerCase().trim() : '';
  if (BUILDING_TYPES.has(s)) return s as Client['buildingType'];
  return 'nesutarta';
}

/** SQL `clients`: name, phone, email, address, building_type, owner_id, created_at (no `notes` in default schema). */
export function normalizeClientFromDb(row: Record<string, unknown>): Client {
  const latRaw = typeof row.lat === 'string' ? parseFloat(row.lat) : row.lat;
  const lngRaw = typeof row.lng === 'string' ? parseFloat(row.lng) : row.lng;
  const emailRaw = row.email ?? row.Email ?? row.e_mail;
  return {
    id: String(row.id ?? ''),
    name: String(row.name ?? ''),
    phone: String(row.phone ?? ''),
    email: emailRaw != null && String(emailRaw).trim() !== '' ? String(emailRaw).trim() : undefined,
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
      const n =
        typeof latRaw === 'string' ? parseFloat(latRaw) : typeof latRaw === 'number' ? latRaw : NaN;
      return Number.isFinite(n) ? n : undefined;
    })(),
    lng: (() => {
      const n =
        typeof lngRaw === 'string' ? parseFloat(lngRaw) : typeof lngRaw === 'number' ? lngRaw : NaN;
      return Number.isFinite(n) ? n : undefined;
    })(),
  };
}

export function boolSettingFromDb(v: unknown, defaultTrue: boolean): boolean {
  if (v === null || v === undefined) return defaultTrue;
  if (typeof v === 'boolean') return v;
  if (typeof v === 'number') return v !== 0;
  if (typeof v === 'string') {
    const s = v.trim().toLowerCase();
    if (s === 'false' || s === '0') return false;
    if (s === 'true' || s === '1') return true;
  }
  return defaultTrue;
}

/** `settings`: snake_case arba senesni camelCase laukai. */
export function normalizeSettingsFromDb(row: Record<string, unknown>): AppSettings {
  const num = (v: unknown, fallback: number) => {
    if (typeof v === 'number' && !Number.isNaN(v)) return v;
    const p = parseFloat(String(v ?? ''));
    return Number.isFinite(p) ? p : fallback;
  };
  return {
    ...DEFAULT_SETTINGS,
    id: String(row.id ?? ''),
    pricePerWindow: num(
      row.price_per_window ?? row.pricePerWindow,
      DEFAULT_SETTINGS.pricePerWindow
    ),
    pricePerFloor: num(row.price_per_floor ?? row.pricePerFloor, DEFAULT_SETTINGS.pricePerFloor),
    priceBalkonai: num(row.price_balkonai ?? row.priceBalkonai, DEFAULT_SETTINGS.priceBalkonai),
    priceVitrinos: num(row.price_vitrinos ?? row.priceVitrinos, DEFAULT_SETTINGS.priceVitrinos),
    priceTerasa: num(row.price_terasa ?? row.priceTerasa, DEFAULT_SETTINGS.priceTerasa),
    priceKiti: num(row.price_kiti ?? row.priceKiti, DEFAULT_SETTINGS.priceKiti),
    smsTemplate:
      typeof (row.sms_template ?? row.smsTemplate) === 'string'
        ? String(row.sms_template ?? row.smsTemplate)
        : DEFAULT_SETTINGS.smsTemplate,
    publicBookingEnabled: boolSettingFromDb(
      row.public_booking_enabled ?? row.publicBookingEnabled,
      DEFAULT_SETTINGS.publicBookingEnabled
    ),
    invoiceApiBaseUrl:
      typeof (row.invoice_api_base_url ?? row.invoiceApiBaseUrl) === 'string'
        ? String(row.invoice_api_base_url ?? row.invoiceApiBaseUrl).trim()
        : DEFAULT_SETTINGS.invoiceApiBaseUrl,
  };
}

function mapOrderStatusFromDb(v: unknown): Order['status'] {
  const s = String(v ?? '').toLowerCase();
  if (s === 'vykdoma' || s === 'in_progress') return 'vykdoma';
  if (s === 'atlikta' || s === 'completed' || s === 'done') return 'atlikta';
  return 'suplanuota';
}

export function getOrderStatusDbCandidates(v: unknown): string[] {
  const raw = String(v ?? '').trim();
  if (!raw) return [];
  const lower = raw.toLowerCase();
  const altLt =
    lower === 'pending'
      ? 'suplanuota'
      : lower === 'in_progress'
        ? 'vykdoma'
        : lower === 'completed' || lower === 'done'
          ? 'atlikta'
          : raw;
  const altEn =
    lower === 'suplanuota'
      ? 'pending'
      : lower === 'vykdoma'
        ? 'in_progress'
        : lower === 'atlikta'
          ? 'completed'
          : raw;
  const altEn2 =
    lower === 'suplanuota'
      ? 'planned'
      : lower === 'vykdoma'
        ? 'inprogress'
        : lower === 'atlikta'
          ? 'done'
          : raw;
  return Array.from(new Set([raw, altEn, altLt, altEn2]));
}

export function normalizeNullableId(v: unknown): string | null {
  if (v === null || v === undefined) return null;
  const s = String(v).trim();
  return s ? s : null;
}

const ORDER_EMPLOYEE_UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export function normalizeEmployeeIdForOrderDb(v: unknown): string | null {
  const n = normalizeNullableId(v);
  if (!n) return null;
  if (ORDER_EMPLOYEE_UUID_RE.test(n)) return n;
  return null;
}

/** `orders.date` dažnai `timestamptz`; vieną datą (YYYY-MM-DD) rašykime kaip ISO su laiku. */
export function coerceOrderDateForDbWrite(v: unknown): unknown {
  if (v === null || v === undefined) return v;
  const s = String(v).trim();
  if (!s) return undefined;
  if (/^\d{4}-\d{2}-\d{2}$/.test(s)) {
    return `${s}T00:00:00.000Z`;
  }
  return v;
}

export type PgLikeError = { code?: string; message?: string } | null;

export function shouldTryLegacyOrderUpdateAfterModernFailure(error: PgLikeError): boolean {
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
  if (
    (t.includes('does not exist') || t.includes('undefined column')) &&
    (t.includes('column') || t.includes('field'))
  ) {
    return true;
  }
  if (/is of type .* but expression/.test(t)) return true;
  return false;
}

export function isStatusValueError(error: PgLikeError): boolean {
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

export function normalizeOrderFromDb(row: Record<string, unknown>): Order {
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
    employeeId:
      row.employee_id != null
        ? String(row.employee_id)
        : row.employeeId != null
          ? String(row.employeeId)
          : undefined,
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
    estimatedDuration:
      row.estimated_duration != null
        ? Number(row.estimated_duration)
        : row.estimatedDuration != null
          ? Number(row.estimatedDuration)
          : undefined,
    isRecurring:
      row.is_recurring != null
        ? Boolean(row.is_recurring)
        : row.isRecurring != null
          ? Boolean(row.isRecurring)
          : undefined,
    recurringInterval:
      row.recurring_interval != null
        ? Number(row.recurring_interval)
        : row.recurringInterval != null
          ? Number(row.recurringInterval)
          : undefined,
    notes: row.notes != null ? String(row.notes) : undefined,
    photoBefore:
      row.photo_before != null
        ? String(row.photo_before)
        : row.photoBefore != null
          ? String(row.photoBefore)
          : undefined,
    photoAfter:
      row.photo_after != null
        ? String(row.photo_after)
        : row.photoAfter != null
          ? String(row.photoAfter)
          : undefined,
    evaluation: row.evaluation as Order['evaluation'],
    isPaid:
      row.is_paid != null
        ? Boolean(row.is_paid)
        : row.isPaid != null
          ? Boolean(row.isPaid)
          : undefined,
    serviceType:
      row.service_type != null
        ? String(row.service_type)
        : row.serviceType != null
          ? String(row.serviceType)
          : undefined,
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
  if (
    (code === 'PGRST205' || code === '42P01') &&
    (msg.includes(needle) || msg.includes(`public.${needle}`))
  )
    return true;
  if (msg.includes('schema cache') && msg.includes(needle)) return true;
  if (msg.includes(needle) && (msg.includes('does not exist') || msg.includes('could not find')))
    return true;
  return false;
}

/** @deprecated Naudokite isPaymentsTableUnavailableError(err, 'invoices') */
export function isInvoicesTableUnavailableError(error: unknown): boolean {
  return isPaymentsTableUnavailableError(error, 'invoices');
}

export interface FetchPaymentsWorkspaceResult {
  invoices: Invoice[];
  transactions: Transaction[];
  tablesMissing: boolean;
  queryError?: string;
}
