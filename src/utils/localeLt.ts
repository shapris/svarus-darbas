/**
 * Lietuviški skaičiaus + daiktavardžio deriniai (MVP: „užsakymas“ linksniai).
 */

export function formatLtOrderCount(count: number): string {
  const n = Math.floor(Number(count));
  if (!Number.isFinite(n) || n < 0) return '0 užsakymų';
  if (n === 0) return '0 užsakymų';
  const mod100 = n % 100;
  if (mod100 >= 11 && mod100 <= 14) return `${n} užsakymų`;
  const mod10 = n % 10;
  if (mod10 === 1) return `${n} užsakymas`;
  if (mod10 >= 2 && mod10 <= 4) return `${n} užsakymai`;
  return `${n} užsakymų`;
}
