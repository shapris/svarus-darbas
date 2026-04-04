import { describe, expect, it } from 'vitest';
import { AUTH_FALLBACK, formatAuthErrorForUser } from '../src/utils/authMessages';

describe('formatAuthErrorForUser', () => {
  it('maps common Supabase login errors to Lithuanian copy', () => {
    expect(
      formatAuthErrorForUser({ message: 'Invalid login credentials' }, AUTH_FALLBACK.login)
    ).toBe('Neteisingas el. paštas arba slaptažodis.');
  });

  it('keeps short Lithuanian error messages intact', () => {
    expect(
      formatAuthErrorForUser(
        { message: 'Sesija baigėsi. Prisijunkite iš naujo.' },
        AUTH_FALLBACK.login
      )
    ).toBe('Sesija baigėsi. Prisijunkite iš naujo.');
  });

  it('falls back when error text is unknown', () => {
    expect(
      formatAuthErrorForUser({ message: 'unexpected upstream issue' }, AUTH_FALLBACK.register)
    ).toBe(AUTH_FALLBACK.register);
  });
});
