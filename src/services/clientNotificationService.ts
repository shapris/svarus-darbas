import { supabase, usesLocalStorageBackend } from '../supabase';
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

function getNotificationApiBaseUrl(): string {
  const envUrl = (import.meta.env.VITE_INVOICE_API_BASE_URL as string | undefined)
    ?.trim()
    .replace(/\/$/, '');
  if (envUrl) return envUrl;
  if (import.meta.env.DEV) return '';
  return '';
}

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
  const base = getNotificationApiBaseUrl();
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
