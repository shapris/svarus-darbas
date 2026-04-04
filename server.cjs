/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

const path = require('path');
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

function buildCorsOrigin() {
  const raw = (process.env.CORS_ORIGINS || '').trim();
  if (raw === '*') return true;
  if (raw) {
    const list = raw
      .split(',')
      .map((s) => s.trim())
      .filter(Boolean);
    if (list.length) return list;
  }
  const defaults = [
    'http://127.0.0.1:3000',
    'http://localhost:3000',
    'http://127.0.0.1:5173',
    'http://localhost:5173',
    'http://127.0.0.1:4173',
    'http://localhost:4173',
    'https://svarus-darbas.vercel.app',
  ];
  const fe = (process.env.FRONTEND_URL || '').trim().replace(/\/$/, '');
  if (fe && !defaults.includes(fe)) defaults.push(fe);
  return defaults;
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
    const r = await fetch(`${SUPABASE_URL_RAW}/auth/v1/user`, {
      headers: { Authorization: `Bearer ${token}`, apikey: SUPABASE_ANON_KEY },
    });
    if (!r.ok) {
      return { ok: false, status: 401, message: 'Sesija nebegalioja — prisijunkite iš naujo.' };
    }
    const user = await r.json();
    return { ok: true, user };
  } catch (e) {
    console.error('[send-invoice-email] Supabase auth check failed:', e);
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
    const response = await fetch(buildSupabaseRestUrl(table, filters, select), {
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
    res.status(auth.status || 401).json({ error: auth.message });
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
  const result = await fetchSupabaseRows(
    'orders',
    { id: normalized },
    'id,client_id,clientId,uid,owner_id',
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
 * Automatinis sąskaitos PDF siuntimas į kliento el. paštą (Resend).
 * Reikalauja: RESEND_API_KEY, RESEND_FROM_EMAIL (arba pilnas „Vardas <paštas>“); vartotojas prisijungęs per Supabase.
 */
app.post('/api/send-invoice-email', async (req, res) => {
  try {
    const resendKey = (process.env.RESEND_API_KEY || '').trim();
    const fromHeader = buildResendFromHeader();
    if (!resendKey) {
      return res.status(503).json({
        error:
          'El. pašto siuntimas nesukonfigūruotas. Nustatykite RESEND_API_KEY ir paleiskite server.cjs (žr. .env.example).',
      });
    }

    const auth = await verifySupabaseUserJwt(req.headers.authorization);
    if (!auth.ok) {
      return res.status(auth.status || 401).json({ error: auth.message });
    }

    const { to, subject, text, pdfBase64, filename, orderId } = req.body || {};

    const match = await verifyInvoiceRecipientMatchesOrder(orderId, to, req.headers.authorization);
    if (!match.ok) {
      return res.status(match.status || 400).json({ error: match.message });
    }

    if (!looksLikeEmail(to)) {
      return res.status(400).json({ error: 'Nenurodytas arba neteisingas gavėjo el. paštas.' });
    }
    if (typeof pdfBase64 !== 'string' || pdfBase64.length < 100) {
      return res.status(400).json({ error: 'Trūksta PDF duomenų.' });
    }
    const rawB64 = pdfBase64.includes(',') ? pdfBase64.split(',').pop() : pdfBase64;
    if (!rawB64 || rawB64.length < 100) {
      return res.status(400).json({ error: 'Netinkamas PDF (base64).' });
    }

    const safeName =
      typeof filename === 'string' && filename.trim()
        ? filename
            .trim()
            .replace(/[^\w.\u00C0-\u024f-]+/g, '_')
            .slice(0, 180)
        : 'saskaita.pdf';
    if (!safeName.toLowerCase().endsWith('.pdf')) {
      return res.status(400).json({ error: 'Failo vardas turi baigtis .pdf' });
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
      return res.status(422).json({ error: String(msg), code: 'resend_rejected' });
    }

    console.log('[send-invoice-email] Resend accepted', sent?.id || '(no id)');
    return res.json({ ok: true, id: sent?.id });
  } catch (error) {
    console.error('[send-invoice-email]', error);
    return res.status(500).json({ error: error.message || 'Serverio klaida' });
  }
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
app.get('/health', (req, res) => {
  res.json({
    status: 'ok',
    timestamp: new Date().toISOString(),
    invoiceEmail: !!(process.env.RESEND_API_KEY || '').trim(),
    paymentsDb: paymentsDbAvailable(),
  });
});

app.listen(PORT, () => {
  console.log(`Payment server running on port ${PORT}`);
  console.log(`Health check: http://localhost:${PORT}/health`);
});
