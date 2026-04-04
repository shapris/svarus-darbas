import { describe, expect, it } from 'vitest';
import {
  isPaymentsTableUnavailableError,
  normalizeInvoiceFromDb,
  normalizeTransactionFromDb,
} from '../src/supabase';

describe('payments data helpers', () => {
  it('normalizes invoice rows from snake_case data', () => {
    const invoice = normalizeInvoiceFromDb({
      id: 'inv_1',
      order_id: 'ord_1',
      client_id: 'client_1',
      amount: '45.50',
      status: 'paid',
      due_date: '2026-04-03T00:00:00.000Z',
      created_at: '2026-04-01T10:00:00.000Z',
      paid_at: '2026-04-02T10:00:00.000Z',
      stripe_payment_intent_id: 'pi_1',
    });

    expect(invoice).toEqual({
      id: 'inv_1',
      order_id: 'ord_1',
      client_id: 'client_1',
      amount: 45.5,
      status: 'paid',
      due_date: '2026-04-03T00:00:00.000Z',
      created_at: '2026-04-01T10:00:00.000Z',
      paid_at: '2026-04-02T10:00:00.000Z',
      stripe_payment_intent_id: 'pi_1',
      invoice_url: undefined,
    });
  });

  it('normalizes transaction rows and coerces default values', () => {
    const transaction = normalizeTransactionFromDb({
      id: 'txn_1',
      client_id: 'client_1',
      amount: '12.20',
      status: 'succeeded',
      type: 'refund',
      created_at: '2026-04-01T11:00:00.000Z',
    });

    expect(transaction.amount).toBe(12.2);
    expect(transaction.currency).toBe('eur');
    expect(transaction.type).toBe('refund');
    expect(transaction.client_id).toBe('client_1');
  });

  it('detects missing payments tables from PostgREST errors', () => {
    expect(
      isPaymentsTableUnavailableError(
        {
          code: 'PGRST205',
          message: "Could not find the table 'public.invoices' in the schema cache",
        },
        'invoices'
      )
    ).toBe(true);
    expect(
      isPaymentsTableUnavailableError(
        { code: '42501', message: 'permission denied' },
        'transactions'
      )
    ).toBe(false);
  });
});
