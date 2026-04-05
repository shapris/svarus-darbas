/**
 * Bendri kalendoriaus skaičiavimai ir konstantos.
 */

import { format } from 'date-fns';
import type { Order } from '../../types';

export type PlannedOrder = {
  order: Order;
  startMin: number;
  endMin: number;
  durationMin: number;
};

export const WORK_DAY_START = 8 * 60;
export const WORK_DAY_END = 18 * 60;
export const DEFAULT_SLOT_DURATION = 90;

export const EMPLOYEE_COLOR_CLASS: Record<string, string> = {
  '#3b82f6': 'bg-blue-500',
  '#10b981': 'bg-emerald-500',
  '#f59e0b': 'bg-amber-500',
  '#ef4444': 'bg-red-500',
  '#8b5cf6': 'bg-violet-500',
  '#06b6d4': 'bg-cyan-500',
  '#84cc16': 'bg-lime-500',
  '#f97316': 'bg-orange-500',
};

export function toMinutes(time: string): number {
  const [h, m] = (time || '00:00').split(':').map((x) => parseInt(x, 10) || 0);
  return h * 60 + m;
}

export function toHHMM(totalMin: number): string {
  const h = Math.floor(totalMin / 60);
  const m = totalMin % 60;
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
}

export function normalizeOrderDateKey(raw: string): string {
  const value = String(raw || '').trim();
  if (!value) return '';
  const isoMatch = value.match(/^(\d{4}-\d{2}-\d{2})/);
  if (isoMatch) return isoMatch[1];
  const localMatch = value.match(/^(\d{1,2})[./-](\d{1,2})[./-](\d{4})$/);
  if (localMatch) {
    const dd = localMatch[1].padStart(2, '0');
    const mm = localMatch[2].padStart(2, '0');
    const yyyy = localMatch[3];
    return `${yyyy}-${mm}-${dd}`;
  }
  const d = new Date(value);
  if (!Number.isNaN(d.getTime())) {
    return format(d, 'yyyy-MM-dd');
  }
  return '';
}

export function estimateOrderDuration(order: Order): number {
  const base = 45;
  const windowPart = Math.min(120, Math.max(0, (order.windowCount || 0) * 4));
  const floorPart = Math.max(0, ((order.floor || 1) - 1) * 8);
  const extraServicesCount = Object.values(order.additionalServices || {}).filter(Boolean).length;
  const extraPart = extraServicesCount * 15;
  return Math.max(45, Math.min(210, base + windowPart + floorPart + extraPart));
}
