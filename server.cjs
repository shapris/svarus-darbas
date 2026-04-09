/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

const path = require('path');
const nodeCrypto = require('crypto');
const express = require('express');
const cors = require('cors');
const { jsPDF } = require('jspdf');
const { Resend } = require('resend');
const { createClient } = require('@supabase/supabase-js');
// Visada krauti .env iš projekto šaknies (šalia server.cjs), ne iš process.cwd()
require('dotenv').config({ path: path.join(__dirname, '.env') });
const stripeSecret = process.env.STRIPE_SECRET_KEY || '';
const stripe = require('stripe')(stripeSecret || 'sk_test_placeholder');

const app = express();
const PORT = process.env.PORT || 3001;
let invoices = [];
let paymentIntents = [];

function getOrCreateRequestId(req, res) {
  const incoming = String(req.headers['x-request-id'] || '').trim();
  const id =
    incoming ||
    (nodeCrypto.randomUUID
      ? nodeCrypto.randomUUID()
      : `req_${Date.now()}_${Math.random().toString(16).slice(2)}`);
  res.setHeader('x-request-id', id);
  return id;
}

function apiError(res, status, code, message, extra = {}) {
  const requestId = String(res.getHeader('x-request-id') || '').trim() || undefined;
  return res.status(status).json({
    ok: false,
    error: String(message || 'Serverio klaida'),
    code: String(code || 'error'),
    requestId,
    ...extra,
  });
}

const EXTERNAL_FETCH_TIMEOUT_MS = Math.max(
  1_000,
  Number(process.env.EXTERNAL_FETCH_TIMEOUT_MS || 12_000)
);

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function isIdempotentMethod(method) {
  const m = String(method || 'GET')
    .trim()
    .toUpperCase();
  return m === 'GET' || m === 'HEAD';
}

function shouldRetryStatus(status) {
  return status === 408 || status === 425 || status === 429 || (status >= 500 && status <= 504);
}

function shouldRetryError(error) {
  if (!error) return false;
  const name = String(error.name || '').toLowerCase();
  const msg = String(error.message || '').toLowerCase();
  if (name === 'aborterror') return true;
  return (
    msg.includes('fetch failed') ||
    msg.includes('network') ||
    msg.includes('econnreset') ||
    msg.includes('timed out')
  );
}

async function fetchWithTimeoutAndRetry(url, init = {}, opts = {}) {
  const method = String(init.method || 'GET').toUpperCase();
  const timeoutMs = Math.max(1_000, Number(opts.timeoutMs || EXTERNAL_FETCH_TIMEOUT_MS));
  const canRetryOnce = opts.retryOnceIdempotent !== false && isIdempotentMethod(method);
  const attempts = canRetryOnce ? 2 : 1;
  let lastErr;

  for (let attempt = 1; attempt <= attempts; attempt++) {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), timeoutMs);
    try {
      const response = await fetch(url, { ...init, signal: controller.signal });
      if (attempt < attempts && shouldRetryStatus(response.status)) {
        await sleep(200);
        continue;
      }
      return response;
    } catch (err) {
      lastErr = err;
      if (attempt < attempts && shouldRetryError(err)) {
        await sleep(200);
        continue;
      }
      throw err;
    } finally {
      clearTimeout(timeoutId);
    }
  }

  throw lastErr || new Error('External fetch failed');
}

/** Bazinis CORS sąrašas — visada suliejamas su FRONTEND_URL ir CORS_ORIGINS (kad vienas siauras env neužblokuotų Vercel). */
function getBaseCorsOrigins() {
  return [
    'http://127.0.0.1:3000',
    'http://localhost:3000',
    'http://127.0.0.1:5173',
    'http://localhost:5173',
    'http://127.0.0.1:4173',
    'http://localhost:4173',
    'https://svarus-darbas.vercel.app',
  ];
}

function buildCorsOrigin() {
  const raw = (process.env.CORS_ORIGINS || '').trim();
  if (raw === '*') return true;

  const merged = new Set(getBaseCorsOrigins());
  const fe = (process.env.FRONTEND_URL || '').trim().replace(/\/$/, '');
  if (fe) merged.add(fe);
  if (raw) {
    for (const o of raw
      .split(',')
      .map((s) => s.trim())
      .filter(Boolean)) {
      merged.add(o);
    }
  }
  return Array.from(merged);
}

const stripeIsPlaceholder =
  !stripeSecret || stripeSecret === 'sk_test_placeholder' || /placeholder/i.test(stripeSecret);
if (stripeIsPlaceholder && process.env.NODE_ENV === 'production') {
  console.warn(
    '[server] STRIPE_SECRET_KEY nenustatytas arba ne tikras raktas — Payment Intent API gali netikti.'
  );
}

// Middleware (didelis limitas PDF base64 inline siuntimui)
app.use(cors({ origin: buildCorsOrigin() }));
app.use((req, res, next) => {
  getOrCreateRequestId(req, res);
  next();
});

const SUPABASE_URL_RAW = (process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL || '')
  .trim()
  .replace(/\/$/, '');
const SUPABASE_ANON_KEY = (
  process.env.SUPABASE_ANON_KEY ||
  process.env.VITE_SUPABASE_ANON_KEY ||
  ''
).trim();
const SUPABASE_SERVICE_ROLE_KEY = (process.env.SUPABASE_SERVICE_ROLE_KEY || '').trim();
const paymentsDb =
  SUPABASE_URL_RAW && SUPABASE_SERVICE_ROLE_KEY
    ? createClient(SUPABASE_URL_RAW, SUPABASE_SERVICE_ROLE_KEY, {
        auth: { persistSession: false, autoRefreshToken: false },
      })
    : null;

function paymentsDbAvailable() {
  return !!paymentsDb;
}

function mapInvoiceRow(row) {
  return {
    id: String(row.id),
    order_id: String(row.order_id ?? ''),
    client_id: String(row.client_id ?? ''),
    amount: Number(row.amount ?? 0),
    status: String(row.status ?? 'pending'),
    due_date: row.due_date ? String(row.due_date) : '',
    created_at: row.created_at ? String(row.created_at) : new Date().toISOString(),
    paid_at: row.paid_at ? String(row.paid_at) : undefined,
    stripe_payment_intent_id: row.stripe_payment_intent_id
      ? String(row.stripe_payment_intent_id)
      : undefined,
    invoice_url: row.invoice_url ? String(row.invoice_url) : undefined,
  };
}

function mapPaymentIntentRow(row) {
  const metadata =
    row.metadata && typeof row.metadata === 'object' && !Array.isArray(row.metadata)
      ? Object.fromEntries(
          Object.entries(row.metadata).map(([key, value]) => [String(key), String(value ?? '')])
        )
      : undefined;
  return {
    id: String(row.stripe_payment_intent_id ?? row.id ?? ''),
    amount: Number(row.amount ?? 0),
    currency: String(row.currency ?? 'eur'),
    status: String(row.status ?? ''),
    metadata,
  };
}

const inMemoryNotificationEvents = [];
const cronSecretConfigured = !!String(process.env.CRON_SECRET || '').trim();
/** El. šablonų semantikos versija (kelkite kartu su COPY pakeitimais). Žr. docs/NOTIFICATION_TEMPLATES_VERSIONING.md */
const NOTIFICATION_TEMPLATE_VERSION = '2026-04-08';
let reminderQueueLastRun = null;

function markReminderQueueRun(source, ok, payload = {}) {
  reminderQueueLastRun = {
    at: new Date().toISOString(),
    source: String(source || 'unknown'),
    ok: !!ok,
    ...payload,
  };
}

function orderStatusLabel(status) {
  if (status === 'suplanuota') return 'Suplanuota';
  if (status === 'vykdoma') return 'Vykdoma';
  if (status === 'atlikta') return 'Atlikta';
  return String(status || 'Atnaujinta');
}

function parseOrderDateTime(orderDate, orderTime) {
  const d = String(orderDate || '').trim();
  const t = String(orderTime || '').trim() || '10:00';
  if (!d) return null;
  const isoLike = d.includes('T') ? d : `${d}T${t.length === 5 ? `${t}:00` : t}`;
  const parsed = new Date(isoLike);
  if (Number.isNaN(parsed.valueOf())) return null;
  return parsed;
}

function formatReminderScheduledFor(date) {
  const rounded = new Date(date);
  rounded.setSeconds(0, 0);
  return rounded.toISOString();
}

async function insertNotificationEvent(row) {
  if (paymentsDbAvailable()) {
    const { data, error } = await paymentsDb
      .from('notification_events')
      .insert(row)
      .select()
      .single();
    if (!error) return data;
    if (error.code !== '23505') {
      throw error;
    }
    return null;
  }
  inMemoryNotificationEvents.push({ ...row, id: `local_${Date.now()}_${Math.random()}` });
  return row;
}

async function updateNotificationEventById(id, patch) {
  if (!id) return;
  if (paymentsDbAvailable()) {
    const { error } = await paymentsDb.from('notification_events').update(patch).eq('id', id);
    if (error) throw error;
    return;
  }
  const idx = inMemoryNotificationEvents.findIndex((e) => String(e.id) === String(id));
  if (idx >= 0) inMemoryNotificationEvents[idx] = { ...inMemoryNotificationEvents[idx], ...patch };
}

async function hasNotificationEvent(orderId, type, recipient, scheduledForIso) {
  if (paymentsDbAvailable()) {
    const { data, error } = await paymentsDb
      .from('notification_events')
      .select('id')
      .eq('order_id', String(orderId))
      .eq('type', String(type))
      .eq('channel', 'email')
      .eq('recipient', String(recipient))
      .eq('scheduled_for', scheduledForIso)
      .limit(1)
      .maybeSingle();
    if (error && error.code !== 'PGRST116') throw error;
    return !!data;
  }
  return inMemoryNotificationEvents.some(
    (e) =>
      String(e.order_id) === String(orderId) &&
      String(e.type) === String(type) &&
      String(e.channel) === 'email' &&
      String(e.recipient) === String(recipient) &&
      String(e.scheduled_for) === scheduledForIso
  );
}

async function selectSingleByEq(table, column, value) {
  if (!paymentsDb) return { data: null, error: { message: 'Payments DB not configured' } };
  return await paymentsDb.from(table).select('*').eq(column, value).maybeSingle();
}

async function listByEq(table, column, value) {
  if (!paymentsDb) return { data: [], error: { message: 'Payments DB not configured' } };
  let query = paymentsDb.from(table).select('*').order('created_at', { ascending: false });
  if (column && value != null && String(value).trim() !== '') {
    query = query.eq(column, value);
  }
  return await query;
}

async function upsertPaymentIntentRow(row) {
  if (!paymentsDb) return null;
  const { data, error } = await paymentsDb
    .from('payment_intents')
    .upsert(row, { onConflict: 'stripe_payment_intent_id' })
    .select()
    .single();
  if (error) throw error;
  return data;
}

async function createInvoiceRow(row) {
  if (!paymentsDb) return null;
  const { data, error } = await paymentsDb.from('invoices').insert(row).select().single();
  if (error) throw error;
  return data;
}

async function updateInvoiceRow(id, payload) {
  if (!paymentsDb) return null;
  const { data, error } = await paymentsDb
    .from('invoices')
    .update(payload)
    .eq('id', id)
    .select()
    .single();
  if (error) throw error;
  return data;
}

async function recordTransactionRow(row) {
  if (!paymentsDb) return null;
  if (row.payment_intent_id) {
    const existing = await paymentsDb
      .from('transactions')
      .select('*')
      .eq('payment_intent_id', row.payment_intent_id)
      .eq('type', row.type)
      .maybeSingle();
    if (!existing.error && existing.data) {
      return existing.data;
    }
  }
  const { data, error } = await paymentsDb.from('transactions').insert(row).select().single();
  if (error) throw error;
  return data;
}

async function maybeLoadInvoiceById(id) {
  if (paymentsDbAvailable()) {
    const { data, error } = await selectSingleByEq('invoices', 'id', id);
    if (!error && data) return mapInvoiceRow(data);
    if (error && error.code !== 'PGRST116') {
      throw error;
    }
  }
  return invoices.find((inv) => inv.id === id) || null;
}

async function maybeLoadPaymentIntentByStripeId(stripeId) {
  if (!paymentsDbAvailable()) return null;
  const { data, error } = await selectSingleByEq(
    'payment_intents',
    'stripe_payment_intent_id',
    stripeId
  );
  if (error && error.code !== 'PGRST116') throw error;
  return data || null;
}

async function verifySupabaseUserJwt(authHeader) {
  const m = typeof authHeader === 'string' ? /^Bearer\s+(.+)$/i.exec(authHeader) : null;
  const token = m && m[1];
  if (!token || !SUPABASE_URL_RAW || !SUPABASE_ANON_KEY) {
    return {
      ok: false,
      status: 401,
      message: 'Nėra prieigos rakto arba serveris neprijungtas prie Supabase.',
    };
  }
  try {
    const r = await fetchWithTimeoutAndRetry(`${SUPABASE_URL_RAW}/auth/v1/user`, {
      headers: { Authorization: `Bearer ${token}`, apikey: SUPABASE_ANON_KEY },
    });
    if (!r.ok) {
      return { ok: false, status: 401, message: 'Sesija nebegalioja — prisijunkite iš naujo.' };
    }
    const user = await r.json();
    return { ok: true, user };
  } catch (e) {
    console.warn('[send-invoice-email] Supabase auth check failed:', e);
    return { ok: false, status: 502, message: 'Nepavyko patikrinti prisijungimo.' };
  }
}

function buildSupabaseHeaders(authHeader) {
  return {
    Authorization: authHeader,
    apikey: SUPABASE_ANON_KEY,
    Accept: 'application/json',
  };
}

function buildSupabaseRestUrl(table, filters = {}, select = 'id') {
  const params = [`select=${encodeURIComponent(select)}`];
  for (const [key, value] of Object.entries(filters)) {
    if (value == null) continue;
    const normalized = String(value).trim();
    if (!normalized) continue;
    params.push(`${encodeURIComponent(key)}=eq.${encodeURIComponent(normalized)}`);
  }
  return `${SUPABASE_URL_RAW}/rest/v1/${table}?${params.join('&')}`;
}

async function fetchSupabaseRows(table, filters, select, authHeader) {
  if (!SUPABASE_URL_RAW || !SUPABASE_ANON_KEY) {
    return { ok: false, status: 503, message: 'Serveris neprijungtas prie Supabase.' };
  }
  try {
    const response = await fetchWithTimeoutAndRetry(buildSupabaseRestUrl(table, filters, select), {
      headers: buildSupabaseHeaders(authHeader),
    });
    if (!response.ok) {
      const isAuthError = response.status === 401 || response.status === 403;
      return {
        ok: false,
        status: isAuthError ? 403 : 502,
        message: `Nepavyko nuskaityti ${table}.`,
      };
    }
    const rows = await response.json().catch(() => []);
    return { ok: true, rows: Array.isArray(rows) ? rows : [] };
  } catch {
    return { ok: false, status: 502, message: `Nepavyko pasiekti ${table}.` };
  }
}

function normalizeId(value) {
  return value == null ? '' : String(value).trim();
}

async function getRequestContext(req, res) {
  const auth = await verifySupabaseUserJwt(req.headers.authorization);
  if (!auth.ok) {
    apiError(res, auth.status || 401, 'auth_failed', auth.message);
    return null;
  }
  const profileLookup = await fetchSupabaseRows(
    'profiles',
    { uid: auth.user.id },
    'id,uid,role,client_id',
    req.headers.authorization
  );
  const profile = profileLookup.ok && profileLookup.rows.length > 0 ? profileLookup.rows[0] : null;
  return { user: auth.user, profile };
}

async function ensureAccessibleOrder(orderId, authHeader) {
  const normalized = normalizeId(orderId);
  if (!normalized) {
    return { ok: false, status: 400, message: 'Trūksta užsakymo id (order_id).' };
  }
  // Naudojame tik realiai reikalingus ir schemoje stabiliai esančius stulpelius.
  // Ankstesnis select su `clientId`/`uid` galėjo grąžinti 400 kai tokių kolonų nėra.
  const result = await fetchSupabaseRows(
    'orders',
    { id: normalized },
    'id,client_id,owner_id',
    authHeader
  );
  if (!result.ok) return result;
  if (result.rows.length === 0) {
    return { ok: false, status: 404, message: 'Užsakymas nerastas arba prieiga uždrausta.' };
  }
  return { ok: true, row: result.rows[0] };
}

async function ensureAccessibleClient(clientId, authHeader, profile) {
  const normalized = normalizeId(clientId);
  if (!normalized) {
    return { ok: false, status: 400, message: 'Trūksta kliento id (client_id).' };
  }
  const ownClientId = normalizeId(profile?.client_id);
  if (ownClientId && ownClientId === normalized) {
    return { ok: true, row: { id: normalized, email: null } };
  }
  const result = await fetchSupabaseRows('clients', { id: normalized }, 'id,email', authHeader);
  if (!result.ok) return result;
  if (result.rows.length === 0) {
    return { ok: false, status: 404, message: 'Klientas nerastas arba prieiga uždrausta.' };
  }
  return { ok: true, row: result.rows[0] };
}

async function canAccessInvoice(invoice, authHeader, profile) {
  const invoiceClientId = normalizeId(invoice?.client_id);
  const ownClientId = normalizeId(profile?.client_id);
  if (invoiceClientId && ownClientId && invoiceClientId === ownClientId) {
    return true;
  }
  const invoiceOrderId = normalizeId(invoice?.order_id);
  if (invoiceOrderId) {
    const orderAccess = await ensureAccessibleOrder(invoiceOrderId, authHeader);
    if (orderAccess.ok) return true;
  }
  if (invoiceClientId) {
    const clientAccess = await ensureAccessibleClient(invoiceClientId, authHeader, profile);
    if (clientAccess.ok) return true;
  }
  return false;
}

async function canAccessPayment(payment, authHeader, profile) {
  const meta = payment?.metadata && typeof payment.metadata === 'object' ? payment.metadata : {};
  const metaClientId = normalizeId(meta.client_id);
  const ownClientId = normalizeId(profile?.client_id);
  if (metaClientId && ownClientId && metaClientId === ownClientId) {
    return true;
  }
  const orderId = normalizeId(payment?.order_id || meta.order_id);
  if (orderId) {
    const orderAccess = await ensureAccessibleOrder(orderId, authHeader);
    if (orderAccess.ok) return true;
  }
  if (metaClientId) {
    const clientAccess = await ensureAccessibleClient(metaClientId, authHeader, profile);
    if (clientAccess.ok) return true;
  }
  return false;
}

async function sendTransactionalEmail({ to, subject, text }) {
  const resendKey = (process.env.RESEND_API_KEY || '').trim();
  if (!resendKey) {
    throw new Error('El. pašto siuntimas nesukonfigūruotas (RESEND_API_KEY).');
  }
  const appendFooter =
    String(process.env.NOTIFICATION_TEMPLATE_FOOTER || 'true').trim() !== 'false';
  const raw = String(text);
  const body = appendFooter
    ? `${raw.slice(0, 11_900)}\n\n---\nTemplate: ${NOTIFICATION_TEMPLATE_VERSION}`.slice(0, 12000)
    : raw.slice(0, 12000);
  const resend = new Resend(resendKey);
  const { data, error } = await resend.emails.send({
    from: buildResendFromHeader(),
    to: String(to).trim(),
    subject: String(subject).slice(0, 200),
    text: body,
  });
  if (error) throw new Error(String(error.message || 'Resend klaida'));
  return data?.id || null;
}

async function getNotificationEventStats7d() {
  if (!paymentsDbAvailable()) return null;
  const since = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();
  const { data, error } = await paymentsDb
    .from('notification_events')
    .select('status')
    .gte('created_at', since);
  if (error) throw error;
  const counts = {
    sent: 0,
    failed: 0,
    pending: 0,
    logged: 0,
    other: 0,
    total: 0,
  };
  for (const row of data || []) {
    counts.total += 1;
    const s = String(row.status || '');
    if (s === 'sent') counts.sent += 1;
    else if (s === 'failed') counts.failed += 1;
    else if (s === 'pending') counts.pending += 1;
    else if (s === 'logged') counts.logged += 1;
    else counts.other += 1;
  }
  return counts;
}

async function processReminderQueue({ dryRun = false } = {}) {
  if (!paymentsDbAvailable()) {
    return {
      processed: 0,
      sent: 0,
      skipped: 0,
      failed: 0,
      dryRun,
      reason: 'paymentsDb unavailable',
    };
  }

  const now = new Date();
  const horizonStart = new Date(now.getTime() - 6 * 60 * 60 * 1000);
  const horizonEnd = new Date(now.getTime() + 24 * 60 * 60 * 1000);

  const { data: ordersRows, error: ordersError } = await paymentsDb
    .from('orders')
    .select('id,client_id,date,time,status,owner_id,address,client_name')
    .in('status', ['suplanuota', 'vykdoma']);

  if (ordersError) throw ordersError;

  let processed = 0;
  let sent = 0;
  let skipped = 0;
  let failed = 0;

  for (const order of ordersRows || []) {
    const orderAt = parseOrderDateTime(order.date, order.time);
    if (!orderAt) {
      skipped++;
      continue;
    }
    if (orderAt < horizonStart || orderAt > horizonEnd) continue;

    const reminderCandidates = [
      { type: 'reminder_24h', at: new Date(orderAt.getTime() - 24 * 60 * 60 * 1000) },
      { type: 'reminder_1h', at: new Date(orderAt.getTime() - 60 * 60 * 1000) },
    ];

    const clientId = normalizeId(order.client_id ?? order.clientId);
    if (!clientId) {
      skipped++;
      continue;
    }

    const clientLookup = await paymentsDb
      .from('clients')
      .select('id,name,email')
      .eq('id', clientId)
      .maybeSingle();
    if (clientLookup.error || !clientLookup.data) {
      skipped++;
      continue;
    }
    const email = String(clientLookup.data.email || '').trim();
    if (!looksLikeEmail(email)) {
      skipped++;
      continue;
    }

    for (const reminder of reminderCandidates) {
      if (reminder.at > now) continue;
      if (reminder.at < horizonStart) continue;
      const scheduledForIso = formatReminderScheduledFor(reminder.at);
      const already = await hasNotificationEvent(order.id, reminder.type, email, scheduledForIso);
      if (already) {
        skipped++;
        continue;
      }

      processed++;
      const eventRow = {
        order_id: String(order.id),
        client_id: clientId,
        owner_id: normalizeId(order.owner_id),
        type: reminder.type,
        channel: 'email',
        recipient: email,
        scheduled_for: scheduledForIso,
        status: dryRun ? 'dry_run' : 'pending',
      };
      let createdEvent = null;
      try {
        createdEvent = await insertNotificationEvent(eventRow);
      } catch {
        failed++;
        continue;
      }

      if (dryRun) {
        skipped++;
        continue;
      }

      const whenLabel = reminder.type === 'reminder_24h' ? 'po 24 valandų' : 'po 1 valandos';
      const dateLabel = String(order.date || '').slice(0, 10);
      const timeLabel = String(order.time || '');
      const addressLabel = String(order.address || '').trim();
      const clientName = String(clientLookup.data.name || order.client_name || 'kliente').trim();

      const subject = `Priminimas: užsakymas ${whenLabel}`;
      const text = [
        `Sveiki, ${clientName}!`,
        '',
        `Primename apie suplanuotą vizitą ${whenLabel}.`,
        dateLabel ? `Data: ${dateLabel}${timeLabel ? ` ${timeLabel}` : ''}` : '',
        addressLabel ? `Adresas: ${addressLabel}` : '',
        '',
        'Jei reikia pakeisti laiką, atsakykite į šį laišką.',
        '',
        'Pagarbiai,',
        'Švarus darbas',
      ]
        .filter(Boolean)
        .join('\n');

      try {
        await sendTransactionalEmail({ to: email, subject, text });
        sent++;
        await updateNotificationEventById(createdEvent?.id, {
          status: 'sent',
          sent_at: new Date().toISOString(),
        });
      } catch (sendError) {
        failed++;
        await updateNotificationEventById(createdEvent?.id, {
          status: 'failed',
          error: sendError instanceof Error ? sendError.message : 'Siuntimo klaida',
        });
      }
    }
  }

  return { processed, sent, skipped, failed, dryRun };
}

function looksLikeEmail(s) {
  return typeof s === 'string' && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(s.trim());
}

function normEmail(s) {
  return String(s || '')
    .trim()
    .toLowerCase();
}

/**
 * Gavėjo el. paštas turi sutapti su užsakymo kliento kortele (apsauga nuo SMTP per API).
 */
async function verifyInvoiceRecipientMatchesOrder(orderId, to, authHeader) {
  const orderAccess = await ensureAccessibleOrder(orderId, authHeader);
  if (!orderAccess.ok) {
    if (process.env.NODE_ENV !== 'production' && orderAccess.status === 404) {
      console.warn(
        '[send-invoice-email] orders REST: 0 rows (RLS arba neteisingas order id?)',
        orderId?.slice?.(0, 8)
      );
    }
    return orderAccess;
  }
  const row0 = orderAccess.row;
  const cidRaw = row0.client_id ?? row0.clientId;
  if (cidRaw == null || String(cidRaw).trim() === '') {
    return { ok: false, status: 400, message: 'Užsakymas neturi kliento.' };
  }
  const clientAccess = await fetchSupabaseRows(
    'clients',
    { id: String(cidRaw).trim() },
    'id,email',
    authHeader
  );
  if (!clientAccess.ok) {
    return clientAccess;
  }
  if (clientAccess.rows.length === 0) {
    return { ok: false, status: 404, message: 'Klientas nerastas.' };
  }
  const dbEmail = normEmail(clientAccess.rows[0].email);
  const want = normEmail(to);
  if (!want) {
    return { ok: false, status: 400, message: 'Neteisingas gavėjo el. paštas.' };
  }
  if (!dbEmail) {
    return { ok: false, status: 400, message: 'Kliento kortelėje nėra el. pašto.' };
  }
  if (dbEmail !== want) {
    return {
      ok: false,
      status: 403,
      message:
        'Gavėjo el. paštas turi būti tas pats kaip kliento kortelėje CRM (įrašykite ir išsaugokite el. paštą skiltyje „Klientai“).',
    };
  }
  return { ok: true };
}

/** Resend „from“: rodomas vardas dėžutėje (pvz. „Švarus Darbas“), ne tik onboarding@… */
function buildResendFromHeader() {
  const raw = (process.env.RESEND_FROM_EMAIL || 'onboarding@resend.dev').trim();
  if (raw.includes('<') && raw.includes('>')) {
    return raw.slice(0, 320);
  }
  const displayName = ((process.env.RESEND_FROM_NAME ?? 'Švarus Darbas').trim() || 'Švarus Darbas')
    .replace(/[\r\n<>]/g, '')
    .slice(0, 100);
  return `${displayName} <${raw}>`;
}

app.post('/webhook', express.raw({ type: 'application/json' }), (req, res) => {
  const sig = req.headers['stripe-signature'];
  let event;

  try {
    event = stripe.webhooks.constructEvent(req.body, sig, process.env.STRIPE_WEBHOOK_SECRET);
  } catch (err) {
    console.log(`Webhook signature verification failed.`, err.message);
    return res.sendStatus(400);
  }

  switch (event.type) {
    case 'payment_intent.succeeded': {
      const paymentIntent = event.data.object;
      console.log('PaymentIntent was successful!');

      Promise.resolve()
        .then(async () => {
          const orderId = paymentIntent.metadata.order_id;
          const clientId = normalizeId(paymentIntent.metadata.client_id);
          let invoice = null;

          if (paymentsDbAvailable()) {
            const paymentIntentRow = await upsertPaymentIntentRow({
              stripe_payment_intent_id: paymentIntent.id,
              order_id: orderId,
              client_id: clientId,
              amount: paymentIntent.amount,
              currency: paymentIntent.currency,
              status: paymentIntent.status,
              metadata: paymentIntent.metadata || {},
              updated_at: new Date().toISOString(),
            });

            const invoiceRes = await paymentsDb
              .from('invoices')
              .select('*')
              .eq('order_id', orderId)
              .order('created_at', { ascending: false })
              .limit(1)
              .maybeSingle();
            if (invoiceRes.error && invoiceRes.error.code !== 'PGRST116') {
              throw invoiceRes.error;
            }
            if (invoiceRes.data) {
              invoice = await updateInvoiceRow(invoiceRes.data.id, {
                status: 'paid',
                paid_at: new Date().toISOString(),
                stripe_payment_intent_id: paymentIntent.id,
              });
              await recordTransactionRow({
                invoice_id: invoice.id,
                payment_intent_id: paymentIntentRow?.id ?? null,
                client_id: clientId,
                amount: Number(invoice.amount ?? 0),
                currency: paymentIntent.currency,
                status: 'succeeded',
                type: 'payment',
                stripe_charge_id: paymentIntent.latest_charge ?? paymentIntent.id,
                processed_at: new Date().toISOString(),
              });
            }
          } else {
            const invoiceIndex = invoices.findIndex((inv) => inv.order_id === orderId);
            if (invoiceIndex !== -1) {
              invoices[invoiceIndex] = {
                ...invoices[invoiceIndex],
                status: 'paid',
                paid_at: new Date().toISOString(),
                stripe_payment_intent_id: paymentIntent.id,
              };
            }
            paymentIntents = paymentIntents.map((pi) =>
              pi.id === paymentIntent.id
                ? { ...pi, status: paymentIntent.status, updated_at: new Date().toISOString() }
                : pi
            );
          }
        })
        .catch((error) => {
          console.error('[webhook] Failed to persist payment status:', error);
        });
      break;
    }
    case 'payment_intent.payment_failed':
      console.log('PaymentIntent failed.');
      break;
    default:
      console.log(`Unhandled event type ${event.type}`);
  }

  res.send();
});

app.use(express.json({ limit: '12mb' }));

/**
 * AI proxy (OpenCode Go/Zen) — bendras raktas visiems vartotojams.
 * Raktas laikomas TIK serveryje: OPENCODE_API_KEY (be VITE_).
 *
 * Frontend (Vercel) kviečia šį endpoint per Render base URL (VITE_INVOICE_API_BASE_URL) arba per dev proxy.
 */
app.post('/api/ai/chat', async (req, res) => {
  try {
    const apiKey = String(process.env.OPENCODE_API_KEY || '').trim();
    if (!apiKey) {
      return apiError(
        res,
        503,
        'ai_not_configured',
        'AI nesukonfigūruotas serveryje. Nustatykite OPENCODE_API_KEY (Render env) ir redeploy.'
      );
    }

    const variantEnv = String(process.env.OPENCODE_VARIANT || '')
      .trim()
      .toLowerCase();
    const modelEnv = String(process.env.OPENCODE_MODEL || '').trim();
    const body = req.body || {};

    const variant =
      String(body.variant || '')
        .trim()
        .toLowerCase() === 'zen' || variantEnv === 'zen'
        ? 'zen'
        : 'go';
    const endpoint =
      variant === 'zen'
        ? 'https://opencode.ai/zen/v1/chat/completions'
        : 'https://opencode.ai/zen/go/v1/chat/completions';

    const model = String(body.model || '').trim() || modelEnv || 'glm-5';
    const messages = Array.isArray(body.messages) ? body.messages : [];
    const tools = Array.isArray(body.tools) ? body.tools : undefined;

    if (!messages.length) {
      return apiError(res, 400, 'bad_request', 'Trūksta messages masyvo.');
    }

    const controller = new AbortController();
    const timeoutMs = Number(body.timeoutMs) > 0 ? Number(body.timeoutMs) : 60_000;
    const timeoutId = setTimeout(() => controller.abort(), Math.min(timeoutMs, 120_000));

    try {
      async function callUpstream(withTools) {
        const payload = {
          model,
          messages,
          tools: withTools ? tools : undefined,
          tool_choice: withTools && tools ? 'auto' : undefined,
          max_tokens: 1024,
        };
        const r = await fetch(endpoint, {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${apiKey}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(payload),
          signal: controller.signal,
        });
        const text = await r.text();
        return { ok: r.ok, status: r.status, statusText: r.statusText, text };
      }

      // 1) Pirmas bandymas su tools (jei jie pateikti) — pilna asistento funkcija.
      let upstream = await callUpstream(true);
      // 2) Fallback: kai kai kurie OpenCode modeliai/string provideriai lūžta su tools,
      // kartojame be tools, kad vartotojas bent gautų pokalbio atsakymą.
      if (!upstream.ok && tools && upstream.status >= 500) {
        upstream = await callUpstream(false);
      }

      if (!upstream.ok) {
        return apiError(
          res,
          502,
          'ai_upstream_error',
          `OpenCode klaida: ${upstream.text || upstream.statusText}`,
          {
            upstreamStatus: upstream.status,
            variant,
          }
        );
      }
      try {
        return res.status(200).json(JSON.parse(upstream.text));
      } catch {
        return res.status(200).send(upstream.text);
      }
    } finally {
      clearTimeout(timeoutId);
    }
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    return apiError(res, 500, 'ai_proxy_error', msg);
  }
});

/**
 * Automatinis sąskaitos PDF siuntimas į kliento el. paštą (Resend).
 * Reikalauja: RESEND_API_KEY, RESEND_FROM_EMAIL (arba pilnas „Vardas <paštas>“); vartotojas prisijungęs per Supabase.
 */
app.post('/api/send-invoice-email', async (req, res) => {
  try {
    const resendKey = (process.env.RESEND_API_KEY || '').trim();
    const fromHeader = buildResendFromHeader();
    if (!resendKey) {
      return apiError(
        res,
        503,
        'email_not_configured',
        'El. pašto siuntimas nesukonfigūruotas. Nustatykite RESEND_API_KEY ir paleiskite server.cjs (žr. .env.example).'
      );
    }

    const auth = await verifySupabaseUserJwt(req.headers.authorization);
    if (!auth.ok) {
      return apiError(res, auth.status || 401, 'auth_failed', auth.message);
    }

    const { to, subject, text, pdfBase64, filename, orderId } = req.body || {};

    const match = await verifyInvoiceRecipientMatchesOrder(orderId, to, req.headers.authorization);
    if (!match.ok) {
      return apiError(res, match.status || 400, 'recipient_mismatch', match.message);
    }

    if (!looksLikeEmail(to)) {
      return apiError(
        res,
        400,
        'validation_failed',
        'Nenurodytas arba neteisingas gavėjo el. paštas.'
      );
    }
    if (typeof pdfBase64 !== 'string' || pdfBase64.length < 100) {
      return apiError(res, 400, 'validation_failed', 'Trūksta PDF duomenų.');
    }
    const rawB64 = pdfBase64.includes(',') ? pdfBase64.split(',').pop() : pdfBase64;
    if (!rawB64 || rawB64.length < 100) {
      return apiError(res, 400, 'validation_failed', 'Netinkamas PDF (base64).');
    }

    const safeName =
      typeof filename === 'string' && filename.trim()
        ? filename
            .trim()
            .replace(/[^\w.\u00C0-\u024f-]+/g, '_')
            .slice(0, 180)
        : 'saskaita.pdf';
    if (!safeName.toLowerCase().endsWith('.pdf')) {
      return apiError(res, 400, 'validation_failed', 'Failo vardas turi baigtis .pdf');
    }

    const subj =
      typeof subject === 'string' && subject.trim()
        ? subject.trim().slice(0, 200)
        : `Sąskaita · ${safeName.replace(/\.pdf$/i, '')}`;
    const defaultInvoiceBody =
      'Sveiki,\n\nPridedame sąskaitą PDF formatu už suteiktas paslaugas.\n\nKlausimus galite užduoti atsakydami į šį laišką.\n\n' +
      'Pagarbiai,\nŠvarus darbas\n\n' +
      '—\n' +
      'Profesionalios valymo paslaugos Klaipėdoje ir Vakarų Lietuvoje\n' +
      'info@svarusdarbas.lt · +370 6774 1151 · https://svarusdarbas.lt';
    const bodyText =
      typeof text === 'string' && text.trim() ? text.trim().slice(0, 8000) : defaultInvoiceBody;

    // API raktas: .env → RESEND_API_KEY (įrašykite savo raktą vietoj pavyzdžio re_xxxxxxxxx)
    const resend = new Resend(resendKey);
    const { data: sent, error: sendErr } = await resend.emails.send({
      from: fromHeader,
      to: to.trim(),
      subject: subj,
      text: bodyText,
      attachments: [{ filename: safeName, content: Buffer.from(rawB64, 'base64') }],
    });

    if (sendErr) {
      console.error('[send-invoice-email] Resend error:', sendErr);
      const msg = sendErr.message || 'Resend klaida';
      // 422 = siuntimo taisyklė / domenas (ne „proxy down“ kaip 502)
      return apiError(res, 422, 'resend_rejected', String(msg));
    }

    console.log('[send-invoice-email] Resend accepted', sent?.id || '(no id)');
    return res.json({ ok: true, id: sent?.id });
  } catch (error) {
    console.error('[send-invoice-email]', error);
    return apiError(res, 500, 'server_error', error?.message || 'Serverio klaida');
  }
});

/**
 * Užsakymo būsenos pranešimas klientui el. paštu.
 * Saugumas: gavėjo el. paštas privalo sutapti su kliento kortele užsakyme.
 */
app.post('/api/send-order-status-email', async (req, res) => {
  try {
    const resendKey = (process.env.RESEND_API_KEY || '').trim();
    const fromHeader = buildResendFromHeader();
    if (!resendKey) {
      return apiError(
        res,
        503,
        'email_not_configured',
        'El. pašto siuntimas nesukonfigūruotas (trūksta RESEND_API_KEY).'
      );
    }

    const auth = await verifySupabaseUserJwt(req.headers.authorization);
    if (!auth.ok) {
      return apiError(res, auth.status || 401, 'auth_failed', auth.message);
    }

    const { orderId, to, status, clientName, address, date, time } = req.body || {};
    if (!orderId || !to || !status) {
      return apiError(
        res,
        400,
        'validation_failed',
        'Trūksta privalomų laukų (orderId, to, status).'
      );
    }
    if (!looksLikeEmail(to)) {
      return apiError(res, 400, 'validation_failed', 'Neteisingas gavėjo el. paštas.');
    }

    const match = await verifyInvoiceRecipientMatchesOrder(orderId, to, req.headers.authorization);
    if (!match.ok) {
      return apiError(res, match.status || 400, 'recipient_mismatch', match.message);
    }

    const statusLt = orderStatusLabel(status);
    const safeClientName = String(clientName || 'kliente').trim() || 'kliente';
    const safeAddress = String(address || '').trim();
    const safeDate = String(date || '').trim();
    const safeTime = String(time || '').trim();

    const subject = `Užsakymo būsena atnaujinta: ${statusLt}`;
    const lines = [
      `Sveiki, ${safeClientName}!`,
      '',
      `Jūsų užsakymo būsena atnaujinta: ${statusLt}.`,
      safeDate ? `Data: ${safeDate}${safeTime ? ` ${safeTime}` : ''}` : '',
      safeAddress ? `Adresas: ${safeAddress}` : '',
      '',
      'Jei turite klausimų, atsakykite į šį laišką.',
      '',
      'Pagarbiai,',
      'Švarus darbas',
    ].filter(Boolean);

    const resend = new Resend(resendKey);
    const { data: sent, error: sendErr } = await resend.emails.send({
      from: fromHeader,
      to: String(to).trim(),
      subject,
      text: lines.join('\n'),
    });
    if (sendErr) {
      return apiError(res, 422, 'resend_rejected', String(sendErr.message || 'Resend klaida'));
    }
    return res.json({ ok: true, id: sent?.id });
  } catch (error) {
    return apiError(res, 500, 'server_error', error?.message || 'Serverio klaida');
  }
});

function authorizeCron(req) {
  const configured = (process.env.CRON_SECRET || '').trim();
  if (!configured) {
    return { ok: false, status: 503, message: 'CRON_SECRET nesukonfigūruotas.' };
  }
  const headerSecret =
    (req.headers['x-cron-secret'] && String(req.headers['x-cron-secret']).trim()) || '';
  const authHeader = String(req.headers.authorization || '');
  const bearer = authHeader.toLowerCase().startsWith('bearer ') ? authHeader.slice(7).trim() : '';
  if (headerSecret !== configured && bearer !== configured) {
    return { ok: false, status: 401, message: 'Neteisingas cron raktas.' };
  }
  return { ok: true };
}

async function runReminderQueueWithTracking(source, { dryRun = false } = {}) {
  try {
    const result = await processReminderQueue({ dryRun });
    markReminderQueueRun(source, true, result);
    return result;
  } catch (error) {
    markReminderQueueRun(source, false, {
      dryRun,
      error: error instanceof Error ? error.message : 'Reminder queue error',
    });
    throw error;
  }
}

app.post('/api/cron/process-reminders', async (req, res) => {
  const auth = authorizeCron(req);
  if (!auth.ok) {
    return apiError(res, auth.status || 401, 'cron_unauthorized', auth.message);
  }
  try {
    const dryRun = req.query.dryRun === '1' || req.query.dryRun === 'true';
    const result = await runReminderQueueWithTracking('cron', { dryRun });
    return res.json({ ok: true, ...result });
  } catch (error) {
    return apiError(res, 500, 'server_error', error?.message || 'Nepavyko apdoroti priminimų.');
  }
});

app.get('/api/notification-events', async (req, res) => {
  const context = await getRequestContext(req, res);
  if (!context) return;
  if (!paymentsDbAvailable()) {
    return res.json(inMemoryNotificationEvents.slice(-200).reverse());
  }

  let query = paymentsDb
    .from('notification_events')
    .select('*')
    .order('created_at', { ascending: false })
    .limit(200);

  const profileRole = String(context.profile?.role || '');
  const profileClientId = normalizeId(context.profile?.client_id);
  if (profileRole === 'client' && profileClientId) {
    query = query.eq('client_id', profileClientId);
  }

  const { data, error } = await query;
  if (error) {
    return res.status(500).json({ error: error.message || 'Nepavyko gauti pranešimų audito.' });
  }
  return res.json(data || []);
});

app.post('/api/client-update-phone', async (req, res) => {
  const context = await getRequestContext(req, res);
  if (!context) return;
  const role = String(context.profile?.role || '');
  if (role !== 'client') {
    return res.status(403).json({ error: 'Prieinama tik klientų portalo paskyroms.' });
  }
  const clientId = normalizeId(context.profile?.client_id);
  if (!clientId) {
    return res.status(400).json({ error: 'Profilis nesusietas su kliento kortele.' });
  }
  const phone = String(req.body?.phone ?? '')
    .trim()
    .replace(/\s+/g, ' ');
  if (phone.length < 5 || phone.length > 40) {
    return res.status(400).json({ error: 'Įveskite teisingą telefono numerį.' });
  }
  if (!paymentsDbAvailable()) {
    return res.status(503).json({ error: 'Duomenų bazė nepasiekiama.' });
  }
  const { error } = await paymentsDb.from('clients').update({ phone }).eq('id', clientId);
  if (error) {
    return res.status(500).json({ error: error.message || 'Nepavyko atnaujinti telefono.' });
  }
  return res.json({ ok: true });
});

app.post('/api/client-service-request', async (req, res) => {
  const context = await getRequestContext(req, res);
  if (!context) return;
  const role = String(context.profile?.role || '');
  if (role !== 'client') {
    return res.status(403).json({ error: 'Prieinama tik klientų portalo paskyroms.' });
  }
  const clientId = normalizeId(context.profile?.client_id);
  if (!clientId) {
    return res.status(400).json({ error: 'Profilis nesusietas su kliento kortele.' });
  }
  const category =
    String(req.body?.category || 'other')
      .trim()
      .slice(0, 32)
      .replace(/[^a-zA-Z0-9_]/g, '_') || 'other';
  const message = String(req.body?.message || '')
    .trim()
    .slice(0, 4000);
  if (!message) {
    return res.status(400).json({ error: 'Įveskite prašymo tekstą.' });
  }
  const orderId = normalizeId(req.body?.order_id);
  if (orderId) {
    const orderAccess = await ensureAccessibleOrder(orderId, req.headers.authorization);
    if (!orderAccess.ok) {
      return res.status(orderAccess.status || 400).json({ error: orderAccess.message });
    }
    const oc = normalizeId(orderAccess.row.client_id ?? orderAccess.row.clientId);
    if (oc !== clientId) {
      return res.status(403).json({ error: 'Užsakymas nepriklauso šiai paskyrai.' });
    }
  }

  let ownerId = '';
  if (paymentsDbAvailable()) {
    const { data: crow, error: cErr } = await paymentsDb
      .from('clients')
      .select('owner_id')
      .eq('id', clientId)
      .maybeSingle();
    if (cErr) {
      return res.status(500).json({ error: cErr.message || 'Nepavyko nuskaityti kliento.' });
    }
    if (!crow) {
      return res.status(404).json({ error: 'Kliento kortelė nerasta.' });
    }
    ownerId = normalizeId(crow.owner_id);
  }

  const scheduledFor = new Date().toISOString();
  const typeTag = `client_portal_${category}`;
  const eventRow = {
    order_id: orderId || null,
    client_id: clientId,
    owner_id: ownerId || null,
    type: typeTag,
    channel: 'portal',
    recipient: String(context.user?.email || '').slice(0, 320),
    scheduled_for: scheduledFor,
    status: 'logged',
    sent_at: null,
    error: null,
    payload: {
      message,
      category,
      source: 'client_portal',
      created_by_uid: String(context.user?.id || ''),
    },
  };

  try {
    await insertNotificationEvent(eventRow);
  } catch {
    return res.status(500).json({ error: 'Nepavyko įrašyti prašymo.' });
  }

  const adminEmail = (process.env.ADMIN_NOTIFY_EMAIL || '').trim();
  if (adminEmail && looksLikeEmail(adminEmail)) {
    try {
      await sendTransactionalEmail({
        to: adminEmail,
        subject: `Portalo prašymas (${category})`,
        text: [
          `Klientas: ${context.user?.email || ''}`,
          `client_id: ${clientId}`,
          orderId ? `order_id: ${orderId}` : '',
          '',
          message,
        ]
          .filter(Boolean)
          .join('\n'),
      });
    } catch {
      /* laiškas nepavyko — auditas vis tiek įrašytas */
    }
  }

  return res.json({ ok: true });
});

app.get('/api/client-service-requests', async (req, res) => {
  const context = await getRequestContext(req, res);
  if (!context) return;
  const role = String(context.profile?.role || '');
  if (role !== 'client') {
    return res.status(403).json({ error: 'Prieinama tik klientų portalo paskyroms.' });
  }
  const clientId = normalizeId(context.profile?.client_id);
  if (!clientId) {
    return res.status(400).json({ error: 'Profilis nesusietas su kliento kortele.' });
  }
  if (!paymentsDbAvailable()) {
    return res.json([]);
  }

  const { data, error } = await paymentsDb
    .from('notification_events')
    .select('id,order_id,type,status,created_at,payload')
    .eq('client_id', clientId)
    .eq('channel', 'portal')
    .like('type', 'client_portal_%')
    .order('created_at', { ascending: false })
    .limit(50);
  if (error) {
    return res.status(500).json({ error: error.message || 'Nepavyko gauti prašymų.' });
  }

  const rows = (data || []).map((row) => {
    const payload = row.payload && typeof row.payload === 'object' ? row.payload : {};
    const categoryFromType = String(row.type || '').replace(/^client_portal_/, '') || 'other';
    const category = String(payload.category || categoryFromType || 'other')
      .toLowerCase()
      .replace(/[^a-z0-9_]/g, '');
    return {
      id: String(row.id || ''),
      order_id: normalizeId(row.order_id) || null,
      category,
      message: String(payload.message || '').slice(0, 4000),
      status: String(row.status || 'logged'),
      created_at: row.created_at ? String(row.created_at) : new Date().toISOString(),
    };
  });

  return res.json(rows);
});

// Create payment intent
app.post('/api/create-payment-intent', async (req, res) => {
  try {
    const context = await getRequestContext(req, res);
    if (!context) return;
    if (stripeIsPlaceholder) {
      return res.status(503).json({ error: 'Mokėjimai nesukonfigūruoti serveryje.' });
    }

    const { order_id, client_id, amount, currency = 'eur', metadata = {} } = req.body || {};
    const orderAccess = await ensureAccessibleOrder(order_id, req.headers.authorization);
    if (!orderAccess.ok) {
      return res.status(orderAccess.status || 400).json({ error: orderAccess.message });
    }
    const orderClientId = normalizeId(orderAccess.row.client_id ?? orderAccess.row.clientId);
    const requestedClientId = normalizeId(client_id || metadata?.client_id);
    if (requestedClientId && orderClientId && requestedClientId !== orderClientId) {
      return res.status(400).json({ error: 'Užsakymas nepriklauso nurodytam klientui.' });
    }
    const safeAmount = Math.round(Number(amount));
    if (!Number.isFinite(safeAmount) || safeAmount <= 0) {
      return res.status(400).json({ error: 'Neteisinga mokėjimo suma.' });
    }
    const safeCurrency =
      typeof currency === 'string' && currency.trim() ? currency.trim().toLowerCase() : 'eur';
    const safeMetadata = {};
    for (const [key, value] of Object.entries(metadata || {})) {
      if (value == null) continue;
      const safeKey = String(key).trim();
      if (!safeKey) continue;
      safeMetadata[safeKey] = String(value).slice(0, 500);
    }

    const paymentIntent = await stripe.paymentIntents.create({
      amount: safeAmount,
      currency: safeCurrency,
      metadata: {
        order_id,
        client_id: orderClientId || requestedClientId || '',
        requester_uid: context.user.id,
        ...safeMetadata,
      },
      automatic_payment_methods: {
        enabled: true,
      },
    });

    const paymentRow = {
      stripe_payment_intent_id: paymentIntent.id,
      order_id,
      amount: paymentIntent.amount,
      currency: paymentIntent.currency,
      client_id: orderClientId || requestedClientId || '',
      created_by_uid: context.user.id,
      status: paymentIntent.status,
      metadata: paymentIntent.metadata,
      updated_at: new Date().toISOString(),
    };

    if (paymentsDbAvailable()) {
      await upsertPaymentIntentRow(paymentRow);
    } else {
      paymentIntents.push({
        id: paymentIntent.id,
        ...paymentRow,
        created_at: new Date().toISOString(),
      });
    }

    res.json({
      id: paymentIntent.id,
      amount: paymentIntent.amount,
      currency: paymentIntent.currency,
      status: paymentIntent.status,
      client_secret: paymentIntent.client_secret,
      metadata: paymentIntent.metadata,
    });
  } catch (error) {
    console.error('Payment intent creation failed:', error);
    res.status(500).json({ error: error.message });
  }
});

// Generate invoice
app.post('/api/generate-invoice', async (req, res) => {
  try {
    const context = await getRequestContext(req, res);
    if (!context) return;

    const { order_id, client_id, amount, due_date } = req.body || {};
    const orderAccess = await ensureAccessibleOrder(order_id, req.headers.authorization);
    if (!orderAccess.ok) {
      return res.status(orderAccess.status || 400).json({ error: orderAccess.message });
    }
    const orderClientId = normalizeId(orderAccess.row.client_id ?? orderAccess.row.clientId);
    const requestedClientId = normalizeId(client_id);
    if (requestedClientId && orderClientId && requestedClientId !== orderClientId) {
      return res.status(400).json({ error: 'Užsakymas nepriklauso nurodytam klientui.' });
    }
    const safeAmount = Number(amount);
    if (!Number.isFinite(safeAmount) || safeAmount <= 0) {
      return res.status(400).json({ error: 'Neteisinga sąskaitos suma.' });
    }
    const safeDueDate = new Date(String(due_date || ''));
    if (Number.isNaN(safeDueDate.valueOf())) {
      return res.status(400).json({ error: 'Neteisingas sąskaitos terminas.' });
    }

    const invoiceRow = {
      order_id,
      client_id: orderClientId || requestedClientId || '',
      amount: safeAmount,
      status: 'pending',
      due_date: safeDueDate.toISOString(),
      created_by_uid: context.user.id,
      invoice_url: null,
    };

    let invoice;
    if (paymentsDbAvailable()) {
      invoice = mapInvoiceRow(await createInvoiceRow(invoiceRow));
    } else {
      invoice = {
        id: `inv_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
        ...invoiceRow,
        created_at: new Date().toISOString(),
      };
      invoices.push(invoice);
    }

    res.json(invoice);
  } catch (error) {
    console.error('Invoice generation failed:', error);
    res.status(500).json({ error: error.message });
  }
});

// Get invoices
app.get('/api/invoices', async (req, res) => {
  const context = await getRequestContext(req, res);
  if (!context) return;

  const requestedClientId = normalizeId(req.query.client_id);
  if (requestedClientId) {
    const clientAccess = await ensureAccessibleClient(
      requestedClientId,
      req.headers.authorization,
      context.profile
    );
    if (!clientAccess.ok) {
      return res.status(clientAccess.status || 400).json({ error: clientAccess.message });
    }
  }

  let candidateInvoices = [];
  if (paymentsDbAvailable()) {
    const { data, error } = await listByEq(
      'invoices',
      requestedClientId ? 'client_id' : null,
      requestedClientId
    );
    if (error) {
      return res.status(500).json({ error: error.message || 'Nepavyko gauti sąskaitų.' });
    }
    candidateInvoices = (data || []).map(mapInvoiceRow);
  } else {
    candidateInvoices = requestedClientId
      ? invoices.filter((inv) => normalizeId(inv.client_id) === requestedClientId)
      : invoices;
  }
  const visibleInvoices = await Promise.all(
    candidateInvoices.map(async (invoice) => ({
      invoice,
      allowed: await canAccessInvoice(invoice, req.headers.authorization, context.profile),
    }))
  );

  res.json(visibleInvoices.filter(({ allowed }) => allowed).map(({ invoice }) => invoice));
});

// Get invoice by ID
app.get('/api/invoices/:id', async (req, res) => {
  const context = await getRequestContext(req, res);
  if (!context) return;
  const invoice = await maybeLoadInvoiceById(req.params.id);

  if (!invoice) {
    return res.status(404).json({ error: 'Invoice not found' });
  }

  if (!(await canAccessInvoice(invoice, req.headers.authorization, context.profile))) {
    return res.status(403).json({ error: 'Prieiga prie sąskaitos uždrausta.' });
  }

  res.json(invoice);
});

// Update invoice status
app.put('/api/invoices/:id', async (req, res) => {
  const context = await getRequestContext(req, res);
  if (!context) return;
  if (context.profile?.role === 'client') {
    return res.status(403).json({ error: 'Klientas negali keisti sąskaitos būsenos.' });
  }
  const { status } = req.body;
  const currentInvoice = await maybeLoadInvoiceById(req.params.id);

  if (!currentInvoice) {
    return res.status(404).json({ error: 'Invoice not found' });
  }
  if (!['pending', 'paid', 'cancelled', 'refunded'].includes(String(status))) {
    return res.status(400).json({ error: 'Neteisinga sąskaitos būsena.' });
  }
  if (!(await canAccessInvoice(currentInvoice, req.headers.authorization, context.profile))) {
    return res.status(403).json({ error: 'Prieiga prie sąskaitos uždrausta.' });
  }

  const nextPayload = {
    status,
    paid_at: status === 'paid' ? new Date().toISOString() : null,
  };
  let updatedInvoice;
  if (paymentsDbAvailable()) {
    const rawUpdatedInvoice = await updateInvoiceRow(req.params.id, nextPayload);
    updatedInvoice = mapInvoiceRow(rawUpdatedInvoice);
    if (status === 'paid') {
      let paymentIntentRow = null;
      if (rawUpdatedInvoice.stripe_payment_intent_id) {
        paymentIntentRow = await maybeLoadPaymentIntentByStripeId(
          rawUpdatedInvoice.stripe_payment_intent_id
        );
      }
      await recordTransactionRow({
        invoice_id: rawUpdatedInvoice.id,
        payment_intent_id: paymentIntentRow?.id ?? null,
        client_id: rawUpdatedInvoice.client_id,
        amount: Number(rawUpdatedInvoice.amount ?? 0),
        currency: paymentIntentRow?.currency ?? 'eur',
        status: paymentIntentRow?.status ?? 'manual_paid',
        type: 'payment',
        stripe_charge_id: rawUpdatedInvoice.stripe_payment_intent_id ?? null,
        processed_at: new Date().toISOString(),
      });
    }
  } else {
    const invoiceIndex = invoices.findIndex((inv) => inv.id === req.params.id);
    invoices[invoiceIndex] = {
      ...invoices[invoiceIndex],
      status,
      ...(status === 'paid' && { paid_at: new Date().toISOString() }),
    };
    if (status !== 'paid') delete invoices[invoiceIndex].paid_at;
    updatedInvoice = invoices[invoiceIndex];
  }

  res.json(updatedInvoice);
});

// Generate PDF invoice
app.get('/api/invoices/:id/pdf', async (req, res) => {
  try {
    const context = await getRequestContext(req, res);
    if (!context) return;
    const invoice = await maybeLoadInvoiceById(req.params.id);

    if (!invoice) {
      return res.status(404).json({ error: 'Invoice not found' });
    }
    if (!(await canAccessInvoice(invoice, req.headers.authorization, context.profile))) {
      return res.status(403).json({ error: 'Prieiga prie sąskaitos uždrausta.' });
    }

    // Create PDF
    const doc = new jsPDF();

    // Header
    doc.setFontSize(20);
    doc.text('Sąskaita-Faktūra', 105, 20, { align: 'center' });

    // Invoice details
    doc.setFontSize(12);
    doc.text(`Sąskaitos Nr: ${invoice.id}`, 20, 40);
    doc.text(`Data: ${new Date(invoice.created_at).toLocaleDateString('lt-LT')}`, 20, 50);
    doc.text(
      `Mokėjimo terminas: ${new Date(invoice.due_date).toLocaleDateString('lt-LT')}`,
      20,
      60
    );

    // Amount
    doc.setFontSize(14);
    doc.text(`Suma: €${invoice.amount.toFixed(2)}`, 20, 80);
    doc.text(`Būsena: ${invoice.status}`, 20, 90);

    // Footer
    doc.setFontSize(10);
    doc.text('Švarus Darbas - Langų valymo paslaugos', 105, 280, { align: 'center' });

    const pdfBuffer = Buffer.from(doc.output('arraybuffer'));

    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="saskaita-${invoice.id}.pdf"`);
    res.send(pdfBuffer);
  } catch (error) {
    console.error('PDF generation failed:', error);
    res.status(500).json({ error: error.message });
  }
});

// Get payments
app.get('/api/payments', async (req, res) => {
  const context = await getRequestContext(req, res);
  if (!context) return;

  const requestedClientId = normalizeId(req.query.client_id);
  if (requestedClientId) {
    const clientAccess = await ensureAccessibleClient(
      requestedClientId,
      req.headers.authorization,
      context.profile
    );
    if (!clientAccess.ok) {
      return res.status(clientAccess.status || 400).json({ error: clientAccess.message });
    }
  }

  let candidatePayments = [];
  if (paymentsDbAvailable()) {
    const { data, error } = await listByEq(
      'payment_intents',
      requestedClientId ? 'client_id' : null,
      requestedClientId
    );
    if (error) {
      return res.status(500).json({ error: error.message || 'Nepavyko gauti mokėjimų.' });
    }
    candidatePayments = (data || []).map(mapPaymentIntentRow);
  } else {
    candidatePayments = requestedClientId
      ? paymentIntents.filter(
          (pi) => normalizeId(pi.client_id || pi.metadata?.client_id) === requestedClientId
        )
      : paymentIntents;
  }
  const visiblePayments = await Promise.all(
    candidatePayments.map(async (payment) => ({
      payment,
      allowed: await canAccessPayment(payment, req.headers.authorization, context.profile),
    }))
  );

  res.json(visiblePayments.filter(({ allowed }) => allowed).map(({ payment }) => payment));
});

// Naršyklės automatinis /favicon.ico — API neturi statinių; 204 išvengia 404 konsolėje.
app.get('/favicon.ico', (_req, res) => {
  res.status(204).end();
});

// Health check
app.get('/health', async (req, res) => {
  const notificationMetrics = { templateVersion: NOTIFICATION_TEMPLATE_VERSION, last7Days: null };
  if (paymentsDbAvailable()) {
    try {
      notificationMetrics.last7Days = await getNotificationEventStats7d();
    } catch (e) {
      notificationMetrics.statsError = e instanceof Error ? e.message : 'stats failed';
    }
  }

  const resendKeyConfigured = !!String(process.env.RESEND_API_KEY || '').trim();
  const resendFromConfigured = !!String(process.env.RESEND_FROM_EMAIL || '').trim();
  const supabaseConfigured = !!SUPABASE_URL_RAW && !!SUPABASE_ANON_KEY;
  const supabaseServiceRoleConfigured = !!SUPABASE_URL_RAW && !!SUPABASE_SERVICE_ROLE_KEY;

  res.json({
    status: 'ok',
    timestamp: new Date().toISOString(),
    invoiceEmail: resendKeyConfigured,
    paymentsDb: paymentsDbAvailable(),
    dependencies: {
      stripeConfigured: !stripeIsPlaceholder,
      resendKeyConfigured,
      resendFromConfigured,
      supabaseConfigured,
      supabaseServiceRoleConfigured,
    },
    reminders: {
      cronSecretConfigured,
      workerEnabled: reminderWorkerEnabled,
      workerIntervalMs: reminderWorkerIntervalMs,
      lastRun: reminderQueueLastRun,
      notificationMetrics,
    },
  });
});

const reminderWorkerEnabled = String(process.env.ENABLE_REMINDER_WORKER || '').trim() === 'true';
const reminderWorkerIntervalMs = Math.max(
  60_000,
  Number(process.env.REMINDER_WORKER_INTERVAL_MS || 300_000) || 300_000
);
if (reminderWorkerEnabled) {
  setInterval(() => {
    runReminderQueueWithTracking('worker').catch((e) => {
      console.warn('[reminder-worker] failed:', e);
    });
  }, reminderWorkerIntervalMs);
}

app.listen(PORT, () => {
  console.log(`Payment server running on port ${PORT}`);
  console.log(`Health check: http://localhost:${PORT}/health`);
  if (reminderWorkerEnabled) {
    console.log(`[reminder-worker] enabled interval=${reminderWorkerIntervalMs}ms`);
  }
});
