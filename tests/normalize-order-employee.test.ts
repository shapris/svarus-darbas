import { describe, expect, it } from 'vitest';
import { normalizeEmployeeIdForOrderDb } from '../src/supabase/normalize';

describe('normalizeEmployeeIdForOrderDb', () => {
  it('priima standartinį UUID (įskaitant „nil“ ir ne tik RFC v4)', () => {
    expect(normalizeEmployeeIdForOrderDb('550e8400-e29b-41d4-a716-446655440000')).toBe(
      '550e8400-e29b-41d4-a716-446655440000'
    );
    expect(normalizeEmployeeIdForOrderDb('00000000-0000-0000-0000-000000000000')).toBe(
      '00000000-0000-0000-0000-000000000000'
    );
  });

  it('tuščiam ar netinkamam identifikatoriui grąžina null', () => {
    expect(normalizeEmployeeIdForOrderDb('')).toBeNull();
    expect(normalizeEmployeeIdForOrderDb('ne-uuid')).toBeNull();
  });
});
