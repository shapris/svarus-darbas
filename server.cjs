/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

const path = require('path');
const express = require('express');
const stripeSecret = process.env.STRIPE_SECRET_KEY || '';
const stripe = require('stripe')(stripeSecret || 'sk_test_placeholder');
const cors = require('cors');
const { jsPDF } = require('jspdf');
const { Resend } = require('resend');
// Visada krauti .env iš projekto šaknies (šalia server.cjs), ne iš process.cwd()
require('dotenv').config({ path: path.join(__dirname, '.env') });

const app = express();
const PORT = process.env.PORT || 3001;

function buildCorsOrigin() {
  const raw = (process.env.CORS_ORIGINS || '').trim();
  if (raw === '*') return true;
  if (raw) {
    const list = raw.split(',').map((s) => s.trim()).filter(Boolean);
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
    '[server] STRIPE_SECRET_KEY nenustatytas arba ne tikras raktas — Payment Intent API gali netikti.',
  );
}

// Middleware (didelis limitas PDF base64 inline siuntimui)
app.use(cors({ origin: buildCorsOrigin() }));
app.use(express.json({ limit: '12mb' }));

const SUPABASE_URL_RAW = (process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL || '').trim().replace(/\/$/, '');
const SUPABASE_ANON_KEY = (process.env.SUPABASE_ANON_KEY || process.env.VITE_SUPABASE_ANON_KEY || '').trim();

async function verifySupabaseUserJwt(authHeader) {
  const m = typeof authHeader === 'string' ? /^Bearer\s+(.+)$/i.exec(authHeader) : null;
  const token = m && m[1];
  if (!token || !SUPABASE_URL_RAW || !SUPABASE_ANON_KEY) {
    return { ok: false, status: 401, message: 'Nėra prieigos rakto arba serveris neprijungtas prie Supabase.' };
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
  if (!orderId || typeof orderId !== 'string' || !orderId.trim()) {
    return { ok: false, status: 400, message: 'Trūksta užsakymo id (orderId). Atnaujinkite CRM.' };
  }
  if (!SUPABASE_URL_RAW || !SUPABASE_ANON_KEY) {
    return { ok: false, status: 503, message: 'Serveris neprijungtas prie Supabase.' };
  }
  const headers = {
    Authorization: authHeader,
    apikey: SUPABASE_ANON_KEY,
    Accept: 'application/json',
  };
  const oid = encodeURIComponent(orderId.trim());
  const r1 = await fetch(`${SUPABASE_URL_RAW}/rest/v1/orders?id=eq.${oid}&select=client_id`, { headers });
  if (!r1.ok) {
    return { ok: false, status: 502, message: 'Nepavyko nuskaityti užsakymo.' };
  }
  const orders = await r1.json().catch(() => []);
  if (!Array.isArray(orders) || orders.length === 0) {
    if (process.env.NODE_ENV !== 'production') {
      console.warn('[send-invoice-email] orders REST: 0 rows (RLS arba neteisingas order id?)', orderId?.slice?.(0, 8));
    }
    return { ok: false, status: 404, message: 'Užsakymas nerastas arba prieiga uždrausta.' };
  }
  const row0 = orders[0];
  const cidRaw = row0.client_id ?? row0.clientId;
  if (cidRaw == null || String(cidRaw).trim() === '') {
    return { ok: false, status: 400, message: 'Užsakymas neturi kliento.' };
  }
  const cid = encodeURIComponent(String(cidRaw).trim());
  const r2 = await fetch(`${SUPABASE_URL_RAW}/rest/v1/clients?id=eq.${cid}&select=email`, { headers });
  if (!r2.ok) {
    return { ok: false, status: 502, message: 'Nepavyko nuskaityti kliento.' };
  }
  const clients = await r2.json().catch(() => []);
  if (!Array.isArray(clients) || clients.length === 0) {
    return { ok: false, status: 404, message: 'Klientas nerastas.' };
  }
  const dbEmail = normEmail(clients[0].email);
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
  const displayName = (
    (process.env.RESEND_FROM_NAME ?? 'Švarus Darbas').trim() || 'Švarus Darbas'
  )
    .replace(/[\r\n<>]/g, '')
    .slice(0, 100);
  return `${displayName} <${raw}>`;
}

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
        ? filename.trim().replace(/[^\w.\u00C0-\u024f-]+/g, '_').slice(0, 180)
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
      typeof text === 'string' && text.trim()
        ? text.trim().slice(0, 8000)
        : defaultInvoiceBody;

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
      return res.status(502).json({ error: String(msg) });
    }

    console.log('[send-invoice-email] Resend accepted', sent?.id || '(no id)');
    return res.json({ ok: true, id: sent?.id });
  } catch (error) {
    console.error('[send-invoice-email]', error);
    return res.status(500).json({ error: error.message || 'Serverio klaida' });
  }
});

// In-memory storage (in production, use a proper database)
let invoices = [];
let paymentIntents = [];

// Create payment intent
app.post('/api/create-payment-intent', async (req, res) => {
  try {
    const { order_id, amount, currency = 'eur', metadata = {} } = req.body;

    const paymentIntent = await stripe.paymentIntents.create({
      amount,
      currency,
      metadata: {
        order_id,
        ...metadata
      },
      automatic_payment_methods: {
        enabled: true,
      },
    });

    paymentIntents.push({
      id: paymentIntent.id,
      order_id,
      amount,
      currency,
      status: paymentIntent.status,
      created_at: new Date().toISOString()
    });

    res.json({
      id: paymentIntent.id,
      amount: paymentIntent.amount,
      currency: paymentIntent.currency,
      status: paymentIntent.status,
      client_secret: paymentIntent.client_secret,
      metadata: paymentIntent.metadata
    });
  } catch (error) {
    console.error('Payment intent creation failed:', error);
    res.status(500).json({ error: error.message });
  }
});

// Generate invoice
app.post('/api/generate-invoice', async (req, res) => {
  try {
    const { order_id, client_id, amount, due_date } = req.body;

    const invoice = {
      id: `inv_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      order_id,
      client_id,
      amount,
      status: 'pending',
      due_date,
      created_at: new Date().toISOString(),
      invoice_url: null
    };

    invoices.push(invoice);

    res.json(invoice);
  } catch (error) {
    console.error('Invoice generation failed:', error);
    res.status(500).json({ error: error.message });
  }
});

// Get invoices
app.get('/api/invoices', (req, res) => {
  const { client_id } = req.query;
  
  let filteredInvoices = invoices;
  if (client_id) {
    filteredInvoices = invoices.filter(inv => inv.client_id === client_id);
  }

  res.json(filteredInvoices);
});

// Get invoice by ID
app.get('/api/invoices/:id', (req, res) => {
  const invoice = invoices.find(inv => inv.id === req.params.id);
  
  if (!invoice) {
    return res.status(404).json({ error: 'Invoice not found' });
  }

  res.json(invoice);
});

// Update invoice status
app.put('/api/invoices/:id', (req, res) => {
  const { status } = req.body;
  const invoiceIndex = invoices.findIndex(inv => inv.id === req.params.id);
  
  if (invoiceIndex === -1) {
    return res.status(404).json({ error: 'Invoice not found' });
  }

  invoices[invoiceIndex] = {
    ...invoices[invoiceIndex],
    status,
    ...(status === 'paid' && { paid_at: new Date().toISOString() })
  };

  res.json(invoices[invoiceIndex]);
});

// Generate PDF invoice
app.get('/api/invoices/:id/pdf', async (req, res) => {
  try {
    const invoice = invoices.find(inv => inv.id === req.params.id);
    
    if (!invoice) {
      return res.status(404).json({ error: 'Invoice not found' });
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
    doc.text(`Mokėjimo terminas: ${new Date(invoice.due_date).toLocaleDateString('lt-LT')}`, 20, 60);
    
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
app.get('/api/payments', (req, res) => {
  const { client_id } = req.query;
  
  let filteredPayments = paymentIntents;
  if (client_id) {
    // In production, you'd join with orders to filter by client_id
    filteredPayments = paymentIntents.filter(pi => pi.metadata?.client_id === client_id);
  }

  res.json(filteredPayments);
});

// Stripe webhook
app.post('/webhook', express.raw({ type: 'application/json' }), (req, res) => {
  const sig = req.headers['stripe-signature'];
  let event;

  try {
    event = stripe.webhooks.constructEvent(req.body, sig, process.env.STRIPE_WEBHOOK_SECRET);
  } catch (err) {
    console.log(`Webhook signature verification failed.`, err.message);
    return res.sendStatus(400);
  }

  // Handle the event
  switch (event.type) {
    case 'payment_intent.succeeded':
      const paymentIntent = event.data.object;
      console.log('PaymentIntent was successful!');
      
      // Update invoice status if payment is successful
      const orderId = paymentIntent.metadata.order_id;
      const invoiceIndex = invoices.findIndex(inv => inv.order_id === orderId);
      
      if (invoiceIndex !== -1) {
        invoices[invoiceIndex] = {
          ...invoices[invoiceIndex],
          status: 'paid',
          paid_at: new Date().toISOString(),
          stripe_payment_intent_id: paymentIntent.id
        };
      }
      
      break;
    case 'payment_intent.payment_failed':
      console.log('PaymentIntent failed.');
      break;
    default:
      console.log(`Unhandled event type ${event.type}`);
  }

  // Return a 200 response to acknowledge receipt of the event
  res.send();
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
  });
});

app.listen(PORT, () => {
  console.log(`Payment server running on port ${PORT}`);
  console.log(`Health check: http://localhost:${PORT}/health`);
});
