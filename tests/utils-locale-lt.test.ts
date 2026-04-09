import { describe, expect, it } from 'vitest';
import { formatLtOrderCount } from '../src/utils/localeLt';

describe('formatLtOrderCount', () => {
  it('grąžina teisingus linksnius', () => {
    expect(formatLtOrderCount(0)).toBe('0 užsakymų');
    expect(formatLtOrderCount(1)).toBe('1 užsakymas');
    expect(formatLtOrderCount(2)).toBe('2 užsakymai');
    expect(formatLtOrderCount(5)).toBe('5 užsakymų');
    expect(formatLtOrderCount(10)).toBe('10 užsakymų');
    expect(formatLtOrderCount(11)).toBe('11 užsakymų');
    expect(formatLtOrderCount(12)).toBe('12 užsakymų');
    expect(formatLtOrderCount(21)).toBe('21 užsakymas');
    expect(formatLtOrderCount(22)).toBe('22 užsakymai');
    expect(formatLtOrderCount(25)).toBe('25 užsakymų');
  });
});
