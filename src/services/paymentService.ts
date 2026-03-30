/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { loadStripe, Stripe } from '@stripe/stripe-js';
import { Order } from '../types';

// Stripe configuration
const STRIPE_PUBLISHABLE_KEY = import.meta.env.VITE_STRIPE_PUBLISHABLE_KEY;
const STRIPE_SECRET_KEY = import.meta.env.VITE_STRIPE_SECRET_KEY;

let stripePromise: Promise<Stripe | null>;

export const getStripe = () => {
  if (!stripePromise) {
    stripePromise = loadStripe(STRIPE_PUBLISHABLE_KEY || '');
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
  try {
    const response = await fetch('/api/create-payment-intent', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        order_id: order.id,
        amount: order.totalPrice * 100, // Convert to cents
        currency: 'eur',
        metadata: {
          order_id: order.id,
          client_name: order.clientName,
          service_type: 'window_cleaning'
        }
      }),
    });

    if (!response.ok) {
      throw new Error('Nepavyko sukurti mokėjimo');
    }

    return await response.json();
  } catch (error) {
    console.error('Payment intent creation failed:', error);
    throw error;
  }
}

export async function confirmPayment(clientSecret: string): Promise<PaymentIntent> {
  try {
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

    // Type assertion since we've checked for error
    const paymentIntent = (result as any).paymentIntent;
    if (!paymentIntent) {
      throw new Error('Mokėjimo intent nerastas');
    }

    return paymentIntent as PaymentIntent;
  } catch (error) {
    console.error('Payment confirmation failed:', error);
    throw error;
  }
}

// Invoice functions
export async function generateInvoice(order: Order): Promise<Invoice> {
  try {
    const response = await fetch('/api/generate-invoice', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        order_id: order.id,
        client_id: order.clientId,
        amount: order.totalPrice,
        due_date: new Date(Date.now() + 14 * 24 * 60 * 60 * 1000).toISOString(), // 14 days from now
      }),
    });

    if (!response.ok) {
      throw new Error('Nepavyko sugeneruoti sąskaitos');
    }

    return await response.json();
  } catch (error) {
    console.error('Invoice generation failed:', error);
    throw error;
  }
}

export async function getInvoices(clientId?: string): Promise<Invoice[]> {
  try {
    const url = clientId ? `/api/invoices?client_id=${clientId}` : '/api/invoices';
    const response = await fetch(url);

    if (!response.ok) {
      throw new Error('Nepavyko gauti sąskaitų');
    }

    return await response.json();
  } catch (error) {
    console.error('Failed to get invoices:', error);
    throw error;
  }
}

export async function updateInvoiceStatus(invoiceId: string, status: Invoice['status']): Promise<Invoice> {
  try {
    const response = await fetch(`/api/invoices/${invoiceId}`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ status }),
    });

    if (!response.ok) {
      throw new Error('Nepavyko atnaujinti sąskaitos būsenos');
    }

    return await response.json();
  } catch (error) {
    console.error('Invoice status update failed:', error);
    throw error;
  }
}

// Payment history
export async function getPaymentHistory(clientId?: string): Promise<PaymentIntent[]> {
  try {
    const url = clientId ? `/api/payments?client_id=${clientId}` : '/api/payments';
    const response = await fetch(url);

    if (!response.ok) {
      throw new Error('Nepavyko gauti mokėjimų istorijos');
    }

    return await response.json();
  } catch (error) {
    console.error('Payment history fetch failed:', error);
    throw error;
  }
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

export function validatePaymentForm(data: PaymentFormData): { isValid: boolean; errors: Record<string, string> } {
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
    errors
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
  formatAmount,
  formatAmountFromEur,
  getPaymentStatusText,
  getInvoiceStatusText,
  getInvoiceStatusColor,
  validatePaymentForm,
};
