import { INVOICE_API_STORAGE_KEY } from '../types';

/**
 * Žinomas Vercel → Render poras (kai VITE_INVOICE_API_BASE_URL pamirštas build'e).
 * Tik konkretūs host'ai — ne visi *.vercel.app.
 */
const PRODUCTION_HOST_TO_API: Record<string, string> = {
  'svarus-darbas.vercel.app': 'https://svarus-darbas-api.onrender.com',
};

/**
 * Sąskaitų API, kliento portalo ir AI proxy (`/api/ai/chat`) bazinis URL.
 * Tvarka: `VITE_INVOICE_API_BASE_URL` → localStorage (Nustatymai) → žinomas prod host → tuščia.
 */
export function getInvoiceApiBaseUrl(): string {
  const envUrl = (import.meta.env.VITE_INVOICE_API_BASE_URL as string | undefined)
    ?.trim()
    .replace(/\/$/, '');
  if (envUrl) return envUrl;

  try {
    const ls =
      typeof localStorage !== 'undefined'
        ? localStorage.getItem(INVOICE_API_STORAGE_KEY)?.trim()
        : '';
    if (ls) return ls.replace(/\/$/, '');
  } catch {
    /* private mode */
  }

  if (typeof window !== 'undefined') {
    const mapped = PRODUCTION_HOST_TO_API[window.location.hostname];
    if (mapped) return mapped;
  }

  if (import.meta.env.DEV) return '';
  return '';
}
