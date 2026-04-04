/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { loadStripe, Stripe } from '@stripe/stripe-js';
import { Order } from '../types';
import { usesLocalStorageBackend, supabase } from '../supabase';

// Stripe configuration
const STRIPE_PUBLISHABLE_KEY = import.meta.env.VITE_STRIPE_PUBLISHABLE_KEY;

let stripePromise: Promise<Stripe | null>;

async function getRequiredAuthHeaders(includeJson = true): Promise<Record<string, string>> {
  const headers: Record<string, string> = includeJson ? { 'Content-Type': 'application/json' } : {};
  if (usesLocalStorageBackend || !supabase) {
    return headers;
  }
  const {
    data: { session },
  } = await supabase.auth.getSession();
  const token = session?.access_token?.trim();
  if (!token) {
    throw new Error('Sesija baigėsi. Prisijunkite iš naujo.');
  }
  headers.Authorization = `Bearer ${token}`;
  return headers;
}

async function parseApiResponse<T>(response: Response, fallbackMessage: string): Promise<T> {
  const data = (await response.json().catch(() => ({}))) as { error?: string };
  if (!response.ok) {
    throw new Error(
      typeof data.error === 'string' && data.error.trim() ? data.error : fallbackMessage
    );
  }
  return data as T;
}

export const getStripe = () => {
  const publishableKey = (STRIPE_PUBLISHABLE_KEY || '').trim();
  if (!publishableKey) {
    return Promise.resolve(null);
  }
  if (!stripePromise) {
    stripePromise = loadStripe(publishableKey);
  }
  return stripePromise;
};

// Payment interface
export interface PaymentIntent {
  id: string;
  amount: number;
  currency: string;
  status: string;
  client_secret?: string;
  metadata?: Record<string, string>;
}

export interface PaymentMethod {
  id: string;
  type: string;
  card?: {
    brand: string;
    last4: string;
    exp_month: number;
    exp_year: number;
  };
}

export interface Invoice {
  id: string;
  order_id: string;
  client_id: string;
  amount: number;
  status: 'pending' | 'paid' | 'cancelled' | 'refunded';
  due_date: string;
  created_at: string;
  paid_at?: string;
  stripe_payment_intent_id?: string;
  invoice_url?: string;
}

// Client-side payment functions
export async function createPaymentIntent(order: Order): Promise<PaymentIntent> {
  const headers = await getRequiredAuthHeaders();
  const response = await fetch('/api/create-payment-intent', {
    method: 'POST',
    headers,
    body: JSON.stringify({
      order_id: order.id,
      client_id: order.clientId,
      amount: order.totalPrice * 100, // Convert to cents
      currency: 'eur',
      metadata: {
        order_id: order.id,
        client_id: order.clientId,
        client_name: order.clientName,
        service_type: 'window_cleaning',
      },
    }),
  });
  return await parseApiResponse<PaymentIntent>(response, 'Nepavyko sukurti mokėjimo');
}

export async function confirmPayment(clientSecret: string): Promise<PaymentIntent> {
  const stripe = await getStripe();
  if (!stripe) {
    throw new Error('Stripe nepasiekiamas');
  }

  const result = await stripe.confirmPayment({
    clientSecret,
    confirmParams: {
      return_url: `${window.location.origin}/payment/success`,
      payment_method_data: {
        billing_details: {
          name: 'Klientas',
          email: 'client@example.com',
        },
      },
    },
  });

  if (result.error) {
    throw new Error(result.error.message || 'Mokėjimas patvirtinti nepavyko');
  }

  const paymentIntent = (result as { paymentIntent?: PaymentIntent }).paymentIntent;
  if (!paymentIntent) {
    throw new Error('Mokėjimo intent nerastas');
  }

  return paymentIntent;
}

// Invoice functions
export async function generateInvoice(order: Order): Promise<Invoice> {
  const headers = await getRequiredAuthHeaders();
  const response = await fetch('/api/generate-invoice', {
    method: 'POST',
    headers,
    body: JSON.stringify({
      order_id: order.id,
      client_id: order.clientId,
      amount: order.totalPrice,
      due_date: new Date(Date.now() + 14 * 24 * 60 * 60 * 1000).toISOString(), // 14 days from now
    }),
  });
  return await parseApiResponse<Invoice>(response, 'Nepavyko sugeneruoti sąskaitos');
}

export async function getInvoices(clientId?: string): Promise<Invoice[]> {
  const url = clientId ? `/api/invoices?client_id=${clientId}` : '/api/invoices';
  const headers = await getRequiredAuthHeaders(false);
  const response = await fetch(url, { headers });
  return await parseApiResponse<Invoice[]>(response, 'Nepavyko gauti sąskaitų');
}

export async function updateInvoiceStatus(
  invoiceId: string,
  status: Invoice['status']
): Promise<Invoice> {
  const headers = await getRequiredAuthHeaders();
  const response = await fetch(`/api/invoices/${invoiceId}`, {
    method: 'PUT',
    headers,
    body: JSON.stringify({ status }),
  });
  return await parseApiResponse<Invoice>(response, 'Nepavyko atnaujinti sąskaitos būsenos');
}

// Payment history
export async function getPaymentHistory(clientId?: string): Promise<PaymentIntent[]> {
  const url = clientId ? `/api/payments?client_id=${clientId}` : '/api/payments';
  const headers = await getRequiredAuthHeaders(false);
  const response = await fetch(url, { headers });
  return await parseApiResponse<PaymentIntent[]>(response, 'Nepavyko gauti mokėjimų istorijos');
}

export async function getInvoicePdfBlob(invoiceId: string): Promise<Blob> {
  const headers = await getRequiredAuthHeaders(false);
  const response = await fetch(`/api/invoices/${invoiceId}/pdf`, { headers });
  if (!response.ok) {
    const data = (await response.json().catch(() => ({}))) as { error?: string };
    throw new Error(
      typeof data.error === 'string' && data.error.trim()
        ? data.error
        : 'Nepavyko atsisiųsti sąskaitos'
    );
  }
  return await response.blob();
}

// Utility functions
export function formatAmount(amount: number): string {
  return new Intl.NumberFormat('lt-LT', {
    style: 'currency',
    currency: 'EUR',
  }).format(amount / 100); // Convert from cents
}

export function formatAmountFromEur(amount: number): string {
  return new Intl.NumberFormat('lt-LT', {
    style: 'currency',
    currency: 'EUR',
  }).format(amount);
}

export function getPaymentStatusText(status: string): string {
  switch (status) {
    case 'succeeded':
      return 'Apmokėta';
    case 'pending':
      return 'Laukiama';
    case 'processing':
      return 'Apdorojama';
    case 'canceled':
      return 'Atšaukta';
    case 'requires_payment_method':
      return 'Reikalingas mokėjimo būdas';
    case 'requires_confirmation':
      return 'Reikalingas patvirtinimas';
    case 'requires_action':
      return 'Reikalingas veiksmas';
    default:
      return status;
  }
}

export function getInvoiceStatusText(status: Invoice['status']): string {
  switch (status) {
    case 'pending':
      return 'Laukiama apmokėjimo';
    case 'paid':
      return 'Apmokėta';
    case 'cancelled':
      return 'Atšaukta';
    case 'refunded':
      return 'Grąžinta';
    default:
      return status;
  }
}

export function getInvoiceStatusColor(status: Invoice['status']): string {
  switch (status) {
    case 'pending':
      return 'bg-yellow-100 text-yellow-800';
    case 'paid':
      return 'bg-green-100 text-green-800';
    case 'cancelled':
      return 'bg-red-100 text-red-800';
    case 'refunded':
      return 'bg-gray-100 text-gray-800';
    default:
      return 'bg-gray-100 text-gray-800';
  }
}

// Client-side payment form
export interface PaymentFormData {
  cardNumber: string;
  expiryDate: string;
  cvc: string;
  name: string;
  email: string;
}

export function validatePaymentForm(data: PaymentFormData): {
  isValid: boolean;
  errors: Record<string, string>;
} {
  const errors: Record<string, string> = {};

  // Card number validation
  const cardNumber = data.cardNumber.replace(/\s/g, '');
  if (!cardNumber || cardNumber.length < 13 || cardNumber.length > 19) {
    errors.cardNumber = 'Neteisingas kortelės numeris';
  } else if (!/^\d+$/.test(cardNumber)) {
    errors.cardNumber = 'Kortelės numeris turi susidėti tik iš skaičių';
  }

  // Expiry date validation
  if (!data.expiryDate || !data.expiryDate.match(/^(0[1-9]|1[0-2])\/\d{2}$/)) {
    errors.expiryDate = 'Neteisingas formatas (MM/YY)';
  } else {
    const [month, year] = data.expiryDate.split('/');
    const expiry = new Date(2000 + parseInt(year), parseInt(month) - 1);
    const now = new Date();
    if (expiry < now) {
      errors.expiryDate = 'Kortelės galiojimo laikas baigėsi';
    }
  }

  // CVC validation
  if (!data.cvc || !/^\d{3,4}$/.test(data.cvc)) {
    errors.cvc = 'Neteisingas CVC kodas';
  }

  // Name validation
  if (!data.name || data.name.trim().length < 2) {
    errors.name = 'Vardas privalomas';
  }

  // Email validation
  if (!data.email || !data.email.match(/^[^\s@]+@[^\s@]+\.[^\s@]+$/)) {
    errors.email = 'Neteisingas el. pašto formatas';
  }

  return {
    isValid: Object.keys(errors).length === 0,
    errors,
  };
}

export default {
  getStripe,
  createPaymentIntent,
  confirmPayment,
  generateInvoice,
  getInvoices,
  updateInvoiceStatus,
  getPaymentHistory,
  getInvoicePdfBlob,
  formatAmount,
  formatAmountFromEur,
  getPaymentStatusText,
  getInvoiceStatusText,
  getInvoiceStatusColor,
  validatePaymentForm,
};
