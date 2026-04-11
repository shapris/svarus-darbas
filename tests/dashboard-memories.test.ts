import { describe, expect, it } from 'vitest';
import { isMemoryShownAsImportantOnDashboard } from '../src/utils/dashboardMemories';
import type { Memory } from '../src/types';

const mem = (o: Partial<Memory>): Memory =>
  ({
    id: '1',
    content: 'x',
    category: 'procesas',
    createdAt: '2026-03-29T10:00:00.000Z',
    uid: 'u',
    importance: 4,
    isActive: true,
    ...o,
  }) as Memory;

describe('isMemoryShownAsImportantOnDashboard', () => {
  it('slepiama, kai įvykio data jau praeityje', () => {
    expect(
      isMemoryShownAsImportantOnDashboard(
        mem({ eventDate: '2026-03-28', importance: 4 }),
        '2026-04-11'
      )
    ).toBe(false);
  });

  it('rodoma, kai įvykio data šiandien ar vėliau', () => {
    expect(
      isMemoryShownAsImportantOnDashboard(mem({ eventDate: '2026-04-11' }), '2026-04-11')
    ).toBe(true);
    expect(
      isMemoryShownAsImportantOnDashboard(mem({ eventDate: '2026-04-15' }), '2026-04-11')
    ).toBe(true);
  });

  it('be įvykio datos: po 14 d. nuo įrašymo neberodoma', () => {
    expect(
      isMemoryShownAsImportantOnDashboard(
        mem({ createdAt: '2026-03-29T10:00:00.000Z' }),
        '2026-04-12'
      )
    ).toBe(false);
  });

  it('be įvykio datos: iki 13 d. dar rodoma', () => {
    expect(
      isMemoryShownAsImportantOnDashboard(
        mem({ createdAt: '2026-03-29T10:00:00.000Z' }),
        '2026-04-11'
      )
    ).toBe(true);
  });
});
