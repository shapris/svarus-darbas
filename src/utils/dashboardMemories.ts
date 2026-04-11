import type { Memory } from '../types';

/** Vietinė kalendorinė data YYYY-MM-DD (ne UTC vidurnaktis). */
export function todayIsoLocal(): string {
  const d = new Date();
  const y = d.getFullYear();
  const mo = String(d.getMonth() + 1).padStart(2, '0');
  const da = String(d.getDate()).padStart(2, '0');
  return `${y}-${mo}-${da}`;
}

/** Iš ISO ar teksto ištraukia YYYY-MM-DD pradžią. */
export function extractIsoDatePrefix(v: string | undefined): string | null {
  if (!v?.trim()) return null;
  const m = v.trim().match(/^(\d{4}-\d{2}-\d{2})/);
  return m ? m[1] : null;
}

/** Kalendorinių dienų skirtumas (nuo `fromIso` iki `toIso`). */
function daysBetweenIsoDates(fromIso: string, toIso: string): number {
  const [fy, fm, fd] = fromIso.split('-').map(Number);
  const [ty, tm, td] = toIso.split('-').map(Number);
  const d0 = Date.UTC(fy, fm - 1, fd);
  const d1 = Date.UTC(ty, tm - 1, td);
  return Math.round((d1 - d0) / 86_400_000);
}

/**
 * Ar rodyti atmintį skiltyje „Svarbūs priminimai“.
 *
 * - Su `eventDate`: rodoma tik kol įvykio data >= šiandien (įskaitant šiandien).
 * - Be `eventDate`: po 14 dienų nuo įrašymo neberodoma automatiškai (pasenę „rytoj“ be datos).
 */
export function isMemoryShownAsImportantOnDashboard(mem: Memory, todayIso: string): boolean {
  if ((mem.importance || 3) < 4 || mem.isActive === false) return false;

  const eventD = extractIsoDatePrefix(mem.eventDate);
  if (eventD) {
    return eventD >= todayIso;
  }

  const created = extractIsoDatePrefix(mem.createdAt);
  if (created) {
    const age = daysBetweenIsoDates(created, todayIso);
    if (age >= 14) return false;
  }

  return true;
}
