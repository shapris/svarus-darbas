import { describe, expect, it } from 'vitest';
import {
  extractMissingColumnFromPgError,
  isMissingColumnInPostgrestRequest,
} from '../src/supabase/columnFallback';

describe('extractMissingColumnFromPgError', () => {
  it('ištraukia stulpelį iš column schema.table.col does not exist', () => {
    expect(
      extractMissingColumnFromPgError({
        code: '42703',
        message: 'column orders.owner_id does not exist',
      })
    ).toBe('owner_id');
  });
});

describe('isMissingColumnInPostgrestRequest', () => {
  it('atpažįsta client_id trūkumą ne tik PGRST204', () => {
    expect(
      isMissingColumnInPostgrestRequest(
        {
          code: '400',
          message: "Could not find the 'client_id' column of 'orders' in the schema cache",
        },
        'client_id'
      )
    ).toBe(true);
  });

  it('neima klaidingai kito stulpelio', () => {
    expect(
      isMissingColumnInPostgrestRequest(
        {
          code: 'PGRST204',
          message: "Could not find the 'created_at' column of 'orders' in the schema cache",
        },
        'client_id'
      )
    ).toBe(false);
  });
});
