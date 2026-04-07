/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import type { Order } from '../types';

export type DashboardKpiSnapshot = {
  /** pvz. „2026 m. balandis“ */
  periodLabel: string;
  completedOrdersCount: number;
  plannedOrdersCount: number;
  inProgressOrdersCount: number;
  /** Atlikti, bet pažymėti neapmokėti */
  unpaidCompletedCount: number;
  /** Vidutinė atlikto užsakymo vertė (EUR, 2 skaitmenys) */
  avgCompletedOrderValue: number;
  /** Užbaigimo dalis tarp „aktyvių“ užsakymų (suplanuota+vykdoma+atlikta), % */
  completionRatePercent: number;
  /** Atliktų užsakymų pajamos einamąjį kalendorinį mėnesį */
  revenueCompletedThisMonth: number;
  /** Atliktų užsakymų dalis su isPaid — „apmokėjimo disciplina“, % */
  paidShareAmongCompletedPercent: number;
};

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

/**
 * Verslo KPI santrauka iš užsakymų (be serverio — CRM dashboard).
 * Matavimo ciklas: perskaičiuojama kiekviename Dashboard render'yje / kai keičiasi `orders`.
 */
export function computeDashboardKpis(orders: Order[], now = new Date()): DashboardKpiSnapshot {
  const completed = orders.filter((o) => o.status === 'atlikta');
  const planned = orders.filter((o) => o.status === 'suplanuota');
  const inProgress = orders.filter((o) => o.status === 'vykdoma');

  const activeDenom = completed.length + planned.length + inProgress.length;
  const completionRatePercent =
    activeDenom > 0 ? Math.round((completed.length / activeDenom) * 100) : 0;

  const monthStart = startOfCurrentMonth(now);
  const completedThisMonth = completed.filter((o) => {
    const d = new Date(o.date);
    return !Number.isNaN(d.valueOf()) && d >= monthStart && d <= now;
  });
  const revenueCompletedThisMonth = round2(
    completedThisMonth.reduce((s, o) => s + (Number(o.totalPrice) || 0), 0)
  );

  const unpaidCompleted = completed.filter((o) => !o.isPaid);
  const paidCompleted = completed.filter((o) => o.isPaid);
  const paidShareAmongCompletedPercent = completed.length
    ? Math.round((paidCompleted.length / completed.length) * 100)
    : 100;

  const avgSum = completed.reduce((s, o) => s + (Number(o.totalPrice) || 0), 0);
  const avgCompletedOrderValue = completed.length ? round2(avgSum / completed.length) : 0;

  return {
    periodLabel: now.toLocaleDateString('lt-LT', { month: 'long', year: 'numeric' }),
    completedOrdersCount: completed.length,
    plannedOrdersCount: planned.length,
    inProgressOrdersCount: inProgress.length,
    unpaidCompletedCount: unpaidCompleted.length,
    avgCompletedOrderValue,
    completionRatePercent,
    revenueCompletedThisMonth,
    paidShareAmongCompletedPercent,
  };
}

function startOfCurrentMonth(now: Date): Date {
  return new Date(now.getFullYear(), now.getMonth(), 1);
}
