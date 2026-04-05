import { supabase, usesLocalStorageBackend, needsBackendSetup } from './client';
import { TABLES } from './constants';
import {
  normalizeInvoiceFromDb,
  normalizeTransactionFromDb,
  isPaymentsTableUnavailableError,
  type FetchPaymentsWorkspaceResult,
} from './normalize';
import type { Invoice } from '../types';

export type { FetchPaymentsWorkspaceResult };

export async function fetchPaymentsWorkspaceData(
  _userId: string
): Promise<FetchPaymentsWorkspaceResult> {
  if (usesLocalStorageBackend || needsBackendSetup || !supabase) {
    return { invoices: [], transactions: [], tablesMissing: false };
  }

  const invRes = await supabase
    .from(TABLES.INVOICES)
    .select('*')
    .order('created_at', { ascending: false });
  if (invRes.error) {
    if (isPaymentsTableUnavailableError(invRes.error, 'invoices')) {
      return {
        invoices: [],
        transactions: [],
        tablesMissing: true,
        queryError: invRes.error.message,
      };
    }
    return {
      invoices: [],
      transactions: [],
      tablesMissing: false,
      queryError: invRes.error.message,
    };
  }

  const invoices = (invRes.data || []).map((r) =>
    normalizeInvoiceFromDb(r as Record<string, unknown>)
  );

  const txnRes = await supabase
    .from(TABLES.TRANSACTIONS)
    .select('*')
    .order('created_at', { ascending: false });
  if (txnRes.error) {
    if (isPaymentsTableUnavailableError(txnRes.error, 'transactions')) {
      return {
        invoices,
        transactions: [],
        tablesMissing: false,
        queryError: txnRes.error.message,
      };
    }
    return { invoices, transactions: [], tablesMissing: false, queryError: txnRes.error.message };
  }

  const transactions = (txnRes.data || []).map((r) =>
    normalizeTransactionFromDb(r as Record<string, unknown>)
  );
  return { invoices, transactions, tablesMissing: false };
}

export async function updateInvoiceStatusInSupabase(
  invoiceId: string,
  status: Invoice['status']
): Promise<Invoice> {
  if (usesLocalStorageBackend || needsBackendSetup || !supabase) {
    throw new Error('Sąskaitų atnaujinimas galimas tik su prijungta Supabase duomenų baze.');
  }
  const payload: Record<string, unknown> = { status };
  if (status === 'paid') {
    payload.paid_at = new Date().toISOString();
  } else {
    payload.paid_at = null;
  }

  const { data, error } = await supabase
    .from(TABLES.INVOICES)
    .update(payload)
    .eq('id', invoiceId)
    .select()
    .single();

  if (error) throw error;
  return normalizeInvoiceFromDb(data as Record<string, unknown>);
}
