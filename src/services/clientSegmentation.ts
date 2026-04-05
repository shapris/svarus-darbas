/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { Client, Order, AppSettings } from '../types';

export type ClientSegment = 'vip' | 'regular' | 'new' | 'inactive' | 'at_risk';

export interface ClientSegmentationData {
  segment: ClientSegment;
  score: number;
  reasons: string[];
  nextAction?: string;
  discount?: number;
}

export interface SegmentStats {
  segment: ClientSegment;
  count: number;
  percentage: number;
  avgOrderValue: number;
  totalRevenue: number;
  lastOrderDate?: Date;
}

export class ClientSegmentationService {
  private static instance: ClientSegmentationService;

  static getInstance(): ClientSegmentationService {
    if (!ClientSegmentationService.instance) {
      ClientSegmentationService.instance = new ClientSegmentationService();
    }
    return ClientSegmentationService.instance;
  }

  // Analyze client and determine segment
  analyzeClient(client: Client, orders: Order[], settings: AppSettings): ClientSegment {
    const clientOrders = orders.filter((o) => o.clientId === client.id && o.status === 'atlikta');
    const totalOrders = clientOrders.length;
    const totalSpent = clientOrders.reduce((sum, o) => sum + o.totalPrice, 0);
    const lastOrder = clientOrders.sort(
      (a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()
    )[0];
    const daysSinceLastOrder = lastOrder
      ? Math.floor((Date.now() - new Date(lastOrder.date).getTime()) / (1000 * 60 * 60 * 24))
      : Infinity;

    const monthlyOrders = this.calculateMonthlyOrderFrequency(clientOrders);
    const hasRecentOrders = daysSinceLastOrder <= 30;
    const isHighValue = totalSpent > settings.pricePerWindow * 100; // More than 100 windows worth
    const isFrequent = monthlyOrders >= 2;
    const isInactive = daysSinceLastOrder > 90;
    const isAtRisk = daysSinceLastOrder > 60 && daysSinceLastOrder <= 90;

    // VIP: High value + frequent + recent
    if (isHighValue && isFrequent && hasRecentOrders) {
      return 'vip';
    }

    // Regular: Consistent orders but not VIP level
    if (totalOrders >= 5 && hasRecentOrders && monthlyOrders >= 1) {
      return 'regular';
    }

    // New: First time or very few orders
    if (totalOrders <= 2 && daysSinceLastOrder <= 60) {
      return 'new';
    }

    // At risk: Used to order but hasn't in 60-90 days
    if (isAtRisk) {
      return 'at_risk';
    }

    // Inactive: No orders in 90+ days
    if (isInactive) {
      return 'inactive';
    }

    // Default to regular for edge cases
    return 'regular';
  }

  // Get detailed segmentation with reasons
  getClientSegmentationDetails(
    client: Client,
    orders: Order[],
    settings: AppSettings
  ): ClientSegmentationData {
    const segment = this.analyzeClient(client, orders, settings);
    const clientOrders = orders.filter((o) => o.clientId === client.id && o.status === 'atlikta');

    const totalOrders = clientOrders.length;
    const totalSpent = clientOrders.reduce((sum, o) => sum + o.totalPrice, 0);
    const lastOrder = clientOrders.sort(
      (a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()
    )[0];
    const daysSinceLastOrder = lastOrder
      ? Math.floor((Date.now() - new Date(lastOrder.date).getTime()) / (1000 * 60 * 60 * 24))
      : Infinity;

    const reasons: string[] = [];
    let discount = 0;
    let nextAction = '';

    switch (segment) {
      case 'vip':
        reasons.push(`Išleido ${this.formatCurrency(totalSpent)}`);
        reasons.push(`${totalOrders} užsakymai`);
        if (daysSinceLastOrder <= 14) reasons.push('Aktyvus paskutinėmis 2 savaitėmis');
        discount = 15;
        nextAction = 'Siųsti VIP pasiūlymus';
        break;

      case 'regular':
        reasons.push(`${totalOrders} užsakymai`);
        if (daysSinceLastOrder <= 30) reasons.push('Paskutinis užsakymas per mėnį');
        discount = 10;
        nextAction = 'Siųsti naujienlaiškį su nuolaida';
        break;

      case 'new':
        reasons.push('Naujas klientas');
        if (totalOrders === 1) reasons.push('Pirmas užsakymas');
        discount = 5;
        nextAction = 'Siųsti sveikinamąjį SMS';
        break;

      case 'at_risk':
        reasons.push(`Nebuvo užsakę ${daysSinceLastOrder} dienų`);
        reasons.push('Buvęs reguliarius klientas');
        discount = 20;
        nextAction = 'Siųsti "grąžinam" pasiūlymą';
        break;

      case 'inactive':
        reasons.push(`Nebuvo užsakę ${daysSinceLastOrder} dienų`);
        discount = 25;
        nextAction = 'Siųsti "ilgai nematėme" žinutę';
        break;
    }

    return {
      segment,
      score: totalOrders * 10 + totalSpent / 100,
      reasons,
      nextAction,
      discount,
    };
  }

  // Get all segments statistics
  getSegmentStats(clients: Client[], orders: Order[], settings: AppSettings): SegmentStats[] {
    const segments: Record<ClientSegment, SegmentStats> = {
      vip: { segment: 'vip', count: 0, percentage: 0, avgOrderValue: 0, totalRevenue: 0 },
      regular: { segment: 'regular', count: 0, percentage: 0, avgOrderValue: 0, totalRevenue: 0 },
      new: { segment: 'new', count: 0, percentage: 0, avgOrderValue: 0, totalRevenue: 0 },
      inactive: { segment: 'inactive', count: 0, percentage: 0, avgOrderValue: 0, totalRevenue: 0 },
      at_risk: { segment: 'at_risk', count: 0, percentage: 0, avgOrderValue: 0, totalRevenue: 0 },
    };

    const lastOrderDates: Record<ClientSegment, Date | undefined> = {
      vip: undefined,
      regular: undefined,
      new: undefined,
      inactive: undefined,
      at_risk: undefined,
    };

    clients.forEach((client) => {
      const segment = this.analyzeClient(client, orders, settings);
      const clientOrders = orders.filter((o) => o.clientId === client.id && o.status === 'atlikta');
      const totalSpent = clientOrders.reduce((sum, o) => sum + o.totalPrice, 0);

      segments[segment].count++;
      segments[segment].totalRevenue += totalSpent;

      // Track last order date for segment
      const lastOrder = clientOrders.sort(
        (a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()
      )[0];
      if (
        lastOrder &&
        (!lastOrderDates[segment] ||
          new Date(lastOrder.date) > (lastOrderDates[segment] || new Date(0)))
      ) {
        lastOrderDates[segment] = new Date(lastOrder.date);
      }
    });

    // Calculate percentages and averages
    const totalClients = clients.length;
    (Object.keys(segments) as ClientSegment[]).forEach((segmentKey) => {
      const segment = segments[segmentKey];
      segment.percentage = totalClients > 0 ? (segment.count / totalClients) * 100 : 0;
      segment.avgOrderValue = segment.count > 0 ? segment.totalRevenue / segment.count : 0;
      segment.lastOrderDate = lastOrderDates[segmentKey];
    });

    return Object.values(segments).sort((a, b) => b.count - a.count);
  }

  // Get clients by segment
  getClientsBySegment(
    segment: ClientSegment,
    clients: Client[],
    orders: Order[],
    settings: AppSettings
  ): Client[] {
    return clients.filter((client) => this.analyzeClient(client, orders, settings) === segment);
  }

  // Calculate monthly order frequency
  private calculateMonthlyOrderFrequency(orders: Order[]): number {
    if (orders.length === 0) return 0;

    const now = new Date();
    const threeMonthsAgo = new Date(now.getFullYear(), now.getMonth() - 3, now.getDate());
    const recentOrders = orders.filter((o) => new Date(o.date) >= threeMonthsAgo);

    return recentOrders.length / 3; // Average per month over last 3 months
  }

  // Get recommended actions for each segment
  getSegmentActions(segment: ClientSegment): string[] {
    switch (segment) {
      case 'vip':
        return [
          'Siųsti asmeninius pasiūlymus',
          'Teikti prioriteto aptarnavimą',
          'Kviesti į VIP programą',
          'Siųsti naujienas pirmiausia',
        ];

      case 'regular':
        return [
          'Siųsti naujienlaiškius su nuolaidomis',
          'Pasiūlyti papildomų paslaugų',
          'Priminimus apie reguliarų valymą',
          'Teikti lojalumo programą',
        ];

      case 'new':
        return [
          'Siųsti sveikinamąjį SMS',
          'Teikti naujoko nuolaidą',
          'Pristatyti papildomas paslaugas',
          'Prašyti atsiliepimų',
        ];

      case 'at_risk':
        return [
          'Siųsti "grąžinam" pasiūlymą',
          'Teikti didelę nuolaidą',
          'Skambinti asmeniškai',
          'Klausti apie pasitenkinimą',
        ];

      case 'inactive':
        return [
          'Siųsti "ilgai nematėme" žinutę',
          'Teikti "come back" pasiūlymą',
          'Naudoti specialius kodus',
          'Bandyti atgauti kontaktą',
        ];

      default:
        return [];
    }
  }

  // Get segment color for UI
  getSegmentColor(segment: ClientSegment): string {
    switch (segment) {
      case 'vip':
        return 'text-purple-600 bg-purple-50 border-purple-200';
      case 'regular':
        return 'text-blue-600 bg-blue-50 border-blue-200';
      case 'new':
        return 'text-green-600 bg-green-50 border-green-200';
      case 'at_risk':
        return 'text-amber-600 bg-amber-50 border-amber-200';
      case 'inactive':
        return 'text-red-600 bg-red-50 border-red-200';
      default:
        return 'text-slate-600 bg-slate-50 border-slate-200';
    }
  }

  // Get segment icon
  getSegmentIcon(segment: ClientSegment): string {
    switch (segment) {
      case 'vip':
        return '⭐';
      case 'regular':
        return '👤';
      case 'new':
        return '🆕';
      case 'at_risk':
        return '⚠️';
      case 'inactive':
        return '📵';
      default:
        return '❓';
    }
  }

  private formatCurrency(amount: number): string {
    return new Intl.NumberFormat('lt-LT', {
      style: 'currency',
      currency: 'EUR',
    }).format(amount);
  }
}

export const clientSegmentation = ClientSegmentationService.getInstance();
