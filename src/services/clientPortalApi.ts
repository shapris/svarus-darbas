import { supabase, usesLocalStorageBackend } from '../supabase';

function getApiBaseUrl(): string {
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

export async function updateClientPortalPhone(phone: string): Promise<void> {
  const base = getApiBaseUrl();
  const res = await fetch(`${base}/api/client-update-phone`, {
    method: 'POST',
    headers: await getAuthHeaders(),
    body: JSON.stringify({ phone }),
  });
  if (!res.ok) {
    const data = (await res.json().catch(() => ({}))) as { error?: string };
    throw new Error(data.error || 'Nepavyko atnaujinti telefono.');
  }
}

export type ClientPortalRequestCategory = 'reschedule' | 'cancel' | 'other';

export interface ClientPortalRequestHistoryItem {
  id: string;
  createdAt: string;
  category: ClientPortalRequestCategory;
  message: string;
  orderId?: string;
  status?: string;
}

export async function submitClientPortalRequest(input: {
  message: string;
  category: ClientPortalRequestCategory;
  order_id?: string;
}): Promise<void> {
  const base = getApiBaseUrl();
  const res = await fetch(`${base}/api/client-service-request`, {
    method: 'POST',
    headers: await getAuthHeaders(),
    body: JSON.stringify({
      message: input.message,
      category: input.category,
      order_id: input.order_id || undefined,
    }),
  });
  if (!res.ok) {
    const data = (await res.json().catch(() => ({}))) as { error?: string };
    throw new Error(data.error || 'Nepavyko išsiųsti prašymo.');
  }
}

export async function getClientPortalRequestHistory(): Promise<ClientPortalRequestHistoryItem[]> {
  const base = getApiBaseUrl();
  const res = await fetch(`${base}/api/client-service-requests`, {
    method: 'GET',
    headers: await getAuthHeaders(),
  });
  if (!res.ok) {
    const data = (await res.json().catch(() => ({}))) as { error?: string };
    throw new Error(data.error || 'Nepavyko gauti prašymų istorijos.');
  }
  const rows = (await res.json().catch(() => [])) as Array<{
    id?: string;
    created_at?: string;
    category?: string;
    message?: string;
    order_id?: string | null;
    status?: string;
  }>;

  const parseCategory = (value: string | undefined): ClientPortalRequestCategory => {
    if (value === 'reschedule' || value === 'cancel' || value === 'other') return value;
    return 'other';
  };

  return rows
    .map(
      (row): ClientPortalRequestHistoryItem => ({
        id: String(row.id || ''),
        createdAt: String(row.created_at || ''),
        category: parseCategory(row.category),
        message: String(row.message || ''),
        orderId: row.order_id ? String(row.order_id) : undefined,
        status: row.status ? String(row.status) : undefined,
      })
    )
    .filter((row) => row.id.length > 0 && row.message.length > 0);
}
