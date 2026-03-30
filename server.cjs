/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

const express = require('express');
const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY || 'sk_test_placeholder');
const cors = require('cors');
const { jsPDF } = require('jspdf');
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 3001;

// Middleware
app.use(cors());
app.use(express.json());

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

// Health check
app.get('/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

app.listen(PORT, () => {
  console.log(`Payment server running on port ${PORT}`);
  console.log(`Health check: http://localhost:${PORT}/health`);
});
