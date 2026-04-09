import { supabase, usesLocalStorageBackend } from '../supabase';
import { getInvoiceApiBaseUrl } from '../utils/invoiceApiBase';
import type { OrderStatus } from '../types';

type SendOrderStatusEmailInput = {
  orderId: string;
  to: string;
  status: OrderStatus;
  clientName: string;
  address: string;
  date: string;
  time: string;
};

async function getAuthHeaders(): Promise<Record<string, string>> {
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
  };
  if (usesLocalStorageBackend || !supabase) return headers;

  const {
    data: { session },
  } = await supabase.auth.getSession();
  const token = session?.access_token?.trim();
  if (!token) throw new Error('Sesija baigėsi. Prisijunkite iš naujo.');
  headers.Authorization = `Bearer ${token}`;
  return headers;
}

export async function sendOrderStatusEmail(input: SendOrderStatusEmailInput): Promise<void> {
  const base = getInvoiceApiBaseUrl();
  const endpoint = `${base}/api/send-order-status-email`;
  const headers = await getAuthHeaders();

  const response = await fetch(endpoint, {
    method: 'POST',
    headers,
    body: JSON.stringify(input),
  });
  if (!response.ok) {
    const data = (await response.json().catch(() => ({}))) as { error?: string };
    throw new Error(data.error || 'Nepavyko išsiųsti statuso pranešimo.');
  }
}
