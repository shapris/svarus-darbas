import { describe, expect, it } from 'vitest';
import { shouldFallbackFromOwnerIdToUid } from '../src/supabase/ownerScope';

/**
 * Kontraktas: senoji DB (tik `uid`) vs naujoji (`owner_id`) — PostgREST klaidų formatai skiriasi.
 * Šie testai uždaro spragą, kai tik PGRST204 buvo laikomas vieninteliu signalu fallback į `uid`.
 */
describe('shouldFallbackFromOwnerIdToUid', () => {
  it('įjungia fallback kai trūksta owner_id (PGRST204)', () => {
    expect(
      shouldFallbackFromOwnerIdToUid({
        code: 'PGRST204',
        message: "Could not find the 'owner_id' column of 'orders' in the schema cache",
      })
    ).toBe(true);
  });

  it('įjungia fallback kai HTTP 400 body ne PGRST204, bet žinutė apie owner_id', () => {
    expect(
      shouldFallbackFromOwnerIdToUid({
        code: '400',
        message: 'column orders.owner_id does not exist',
      })
    ).toBe(true);
  });

  it('neįjungia fallback kai problema su created_at (tvarkyti order, ne stulpelis owner_id)', () => {
    expect(
      shouldFallbackFromOwnerIdToUid({
        code: 'PGRST204',
        message: "Could not find the 'created_at' column of 'orders' in the schema cache",
      })
    ).toBe(false);
  });

  it('neįjungia fallback tuščiai klaidai', () => {
    expect(shouldFallbackFromOwnerIdToUid(null)).toBe(false);
  });
});
