import { describe, expect, it } from 'vitest';
import {
  formatNetworkErrorForUser,
  sanitizeSupabaseErrorForDisplay,
} from '../src/utils/networkErrors';

describe('sanitizeSupabaseErrorForDisplay', () => {
  it('vertina RLS įrašymą', () => {
    expect(
      sanitizeSupabaseErrorForDisplay(
        'new row violates row-level security policy for table "orders"'
      )
    ).toContain('Nėra teisės');
  });

  it('vertina schema cache / tuščio insert payload', () => {
    expect(
      sanitizeSupabaseErrorForDisplay(
        'Could not find a column from the insert payload in the schema cache (all data columns were skipped).'
      )
    ).toContain('nesutampa');
  });

  it('vertina svetimus techninius pranešimus', () => {
    const s = sanitizeSupabaseErrorForDisplay(
      'insert or update on table "orders" violates foreign key constraint "orders_client_id_fkey"'
    );
    expect(s).toContain('Susietas įrašas');
  });
});

describe('formatNetworkErrorForUser', () => {
  it('grąžina tik lietuvišką pilną žinutę, kai ji jau savarankiška', () => {
    const msg = formatNetworkErrorForUser(
      new Error('new row violates row-level security policy'),
      'Klaida išsaugant užsakymą'
    );
    expect(msg).toContain('Nėra teisės');
    expect(msg).not.toMatch(/^Klaida išsaugant užsakymą — Nėra teisės/);
  });

  it('jungia fallback su sanituota detale, kai reikia', () => {
    const msg = formatNetworkErrorForUser(new Error('Something obscure from API xyz'), 'Nepavyko');
    expect(msg.startsWith('Nepavyko')).toBe(true);
  });
});
