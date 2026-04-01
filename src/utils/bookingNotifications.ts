/**
 * Tekstas toast / sistemos pranešimui — naujas užsakymas iš CRM ar viešos rezervacijos.
 */

import type { Order } from '../types';

function formatPrice(n: number | undefined): string {
    if (n == null || Number.isNaN(n)) return '';
    return `${n} €`;
}

export function formatNewOrderAlert(order: Order): string {
    const name = order.clientName?.trim() || 'Klientas';
    const when = [order.date, order.time].filter(Boolean).join(' ');
    const price = formatPrice(order.totalPrice);
    const parts = [name, when, price].filter(Boolean);
    return parts.join(' · ');
}

export function showNewOrderBrowserNotification(order: Order, body: string): void {
    if (typeof Notification === 'undefined') return;
    if (Notification.permission !== 'granted') return;
    try {
        new Notification('Nauja rezervacija', {
            body,
            tag: `order-${order.id}`,
        });
    } catch {
        /* naršyklės be Notification API arba blokata */
    }
}
