import { describe, expect, it } from 'vitest';
import { calculateOrderPrice, formatCurrency, formatDate, formatDuration } from '../src/utils';
import { DEFAULT_SETTINGS } from '../src/types';

describe('utils: kainos ir formatavimas', () => {
  it('calculateOrderPrice: langai × įkainis', () => {
    expect(
      calculateOrderPrice(
        10,
        1,
        { balkonai: false, vitrinos: false, terasa: false, kiti: false },
        DEFAULT_SETTINGS
      )
    ).toBe(10 * DEFAULT_SETTINGS.pricePerWindow);
  });

  it('calculateOrderPrice: aukštas ir papildomos paslaugos', () => {
    const s = DEFAULT_SETTINGS;
    const base = 5 * s.pricePerWindow;
    const withFloor = base + (3 - 1) * s.pricePerFloor;
    const all = calculateOrderPrice(
      5,
      3,
      { balkonai: true, vitrinos: true, terasa: true, kiti: true },
      s
    );
    expect(all).toBe(withFloor + s.priceBalkonai + s.priceVitrinos + s.priceTerasa + s.priceKiti);
  });

  it('formatCurrency naudoja EUR', () => {
    expect(formatCurrency(12.5)).toMatch(/12/);
    expect(formatCurrency(12.5)).toMatch(/€/);
  });

  it('formatDate grąžina LT datos fragmentą', () => {
    const out = formatDate('2026-04-05T12:00:00.000Z');
    expect(out.length).toBeGreaterThan(4);
    expect(out).toMatch(/2026/);
  });

  it('formatDuration', () => {
    expect(formatDuration(0)).toBe('');
    expect(formatDuration(90)).toMatch(/val/);
    expect(formatDuration(150)).toMatch(/2/);
  });
});
