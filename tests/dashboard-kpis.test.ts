import { describe, expect, it } from 'vitest';
import { computeDashboardKpis } from '../src/utils/dashboardKpis';
import type { Order } from '../src/types';

function makeOrder(partial: Partial<Order>): Order {
  return {
    id: '1',
    clientId: 'c1',
    clientName: 'Test',
    date: '2026-04-10',
    time: '10:00',
    address: 'A',
    windowCount: 1,
    floor: 1,
    totalPrice: 100,
    status: 'suplanuota',
    isPaid: false,
    notes: '',
    additionalServices: {
      balkonai: false,
      vitrinos: false,
      terasa: false,
      kiti: false,
    },
    employeeId: undefined,
    createdAt: '2026-04-01T00:00:00.000Z',
    ...partial,
  };
}

describe('computeDashboardKpis', () => {
  it('skaičiuoja apmokėjimo discipliną ir neapmokėtus atliktus', () => {
    const now = new Date('2026-04-15T12:00:00');
    const orders: Order[] = [
      makeOrder({ id: '1', status: 'atlikta', isPaid: true, totalPrice: 200 }),
      makeOrder({ id: '2', status: 'atlikta', isPaid: false, totalPrice: 100 }),
      makeOrder({ id: '3', status: 'suplanuota', totalPrice: 50 }),
    ];
    const k = computeDashboardKpis(orders, now);
    expect(k.completedOrdersCount).toBe(2);
    expect(k.unpaidCompletedCount).toBe(1);
    expect(k.paidShareAmongCompletedPercent).toBe(50);
    expect(k.avgCompletedOrderValue).toBe(150);
    expect(k.plannedOrdersCount).toBe(1);
  });

  it('įtraukia tik einamojo mėnesio atliktus į pajamas', () => {
    const now = new Date('2026-04-15T12:00:00');
    const orders: Order[] = [
      makeOrder({ id: '1', status: 'atlikta', isPaid: true, totalPrice: 80, date: '2026-04-01' }),
      makeOrder({ id: '2', status: 'atlikta', isPaid: true, totalPrice: 40, date: '2026-03-01' }),
    ];
    const k = computeDashboardKpis(orders, now);
    expect(k.revenueCompletedThisMonth).toBe(80);
  });
});
