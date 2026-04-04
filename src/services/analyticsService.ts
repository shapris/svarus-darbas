/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { Order, Client, Expense, AppSettings } from '../types';

export interface AnalyticsData {
  revenue: {
    today: number;
    thisWeek: number;
    thisMonth: number;
    lastMonth: number;
    growth: number;
  };
  orders: {
    today: number;
    thisWeek: number;
    thisMonth: number;
    lastMonth: number;
    growth: number;
    pending: number;
    completed: number;
  };
  clients: {
    total: number;
    newThisMonth: number;
    active: number;
    vip: number;
    atRisk: number;
  };
  performance: {
    avgOrderValue: number;
    completionRate: number;
    clientRetention: number;
    revenuePerClient: number;
  };
}

export interface TimeSeriesData {
  date: string;
  revenue: number;
  orders: number;
  clients: number;
}

export interface TopPerformer {
  id: string;
  name: string;
  value: number;
  type: 'client' | 'service' | 'area';
}

export class AnalyticsService {
  private static instance: AnalyticsService;

  static getInstance(): AnalyticsService {
    if (!AnalyticsService.instance) {
      AnalyticsService.instance = new AnalyticsService();
    }
    return AnalyticsService.instance;
  }

  // Get comprehensive analytics
  getAnalytics(
    orders: Order[],
    clients: Client[],
    expenses: Expense[],
    settings: AppSettings
  ): AnalyticsData {
    const now = new Date();
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const thisWeek = this.getWeekStart(now);
    const thisMonth = new Date(now.getFullYear(), now.getMonth(), 1);
    const lastMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1);
    const lastMonthEnd = new Date(now.getFullYear(), now.getMonth(), 0);

    // Filter completed orders
    const completedOrders = orders.filter((o) => o.status === 'atlikta');

    // Revenue calculations
    const revenue = {
      today: this.calculateRevenue(completedOrders.filter((o) => new Date(o.date) >= today)),
      thisWeek: this.calculateRevenue(completedOrders.filter((o) => new Date(o.date) >= thisWeek)),
      thisMonth: this.calculateRevenue(
        completedOrders.filter((o) => new Date(o.date) >= thisMonth)
      ),
      lastMonth: this.calculateRevenue(
        completedOrders.filter((o) => {
          const d = new Date(o.date);
          return d >= lastMonth && d <= lastMonthEnd;
        })
      ),
      growth: 0,
    };

    revenue.growth = this.calculateGrowth(revenue.thisMonth, revenue.lastMonth);

    // Order calculations
    const orderStats = {
      today: orders.filter((o) => new Date(o.date) >= today).length,
      thisWeek: orders.filter((o) => new Date(o.date) >= thisWeek).length,
      thisMonth: orders.filter((o) => new Date(o.date) >= thisMonth).length,
      lastMonth: orders.filter((o) => {
        const d = new Date(o.date);
        return d >= lastMonth && d <= lastMonthEnd;
      }).length,
      growth: 0,
      pending: orders.filter((o) => o.status === 'suplanuota' || o.status === 'vykdoma').length,
      completed: completedOrders.length,
    };

    orderStats.growth = this.calculateGrowth(orderStats.thisMonth, orderStats.lastMonth);

    // Client calculations
    const clientStats = {
      total: clients.length,
      newThisMonth: clients.filter((c) => {
        const firstOrder = completedOrders.find((o) => o.clientId === c.id);
        return firstOrder && new Date(firstOrder.date) >= thisMonth;
      }).length,
      active: this.getActiveClientsCount(clients, completedOrders, 90),
      vip: this.getVipClientsCount(clients, completedOrders, settings),
      atRisk: this.getAtRiskClientsCount(clients, completedOrders),
    };

    // Performance metrics
    const performance = {
      avgOrderValue:
        completedOrders.length > 0
          ? revenue.thisMonth / completedOrders.filter((o) => new Date(o.date) >= thisMonth).length
          : 0,
      completionRate: orders.length > 0 ? (completedOrders.length / orders.length) * 100 : 0,
      clientRetention: this.calculateRetentionRate(clients, completedOrders),
      revenuePerClient: clientStats.active > 0 ? revenue.thisMonth / clientStats.active : 0,
    };

    return {
      revenue,
      orders: orderStats,
      clients: clientStats,
      performance,
    };
  }

  // Get time series data for charts
  getTimeSeriesData(orders: Order[], clients: Client[], days: number = 30): TimeSeriesData[] {
    const data: TimeSeriesData[] = [];
    const now = new Date();

    for (let i = days - 1; i >= 0; i--) {
      const date = new Date(now.getFullYear(), now.getMonth(), now.getDate() - i);
      const dateStr = date.toISOString().split('T')[0];

      const dayOrders = orders.filter((o) => o.date === dateStr);
      const dayRevenue = this.calculateRevenue(dayOrders.filter((o) => o.status === 'atlikta'));
      const dayClients = new Set(dayOrders.map((o) => o.clientId)).size;

      data.push({
        date: date.toLocaleDateString('lt-LT', { month: 'short', day: 'numeric' }),
        revenue: dayRevenue,
        orders: dayOrders.length,
        clients: dayClients,
      });
    }

    return data;
  }

  // Get top performers
  getTopPerformers(
    orders: Order[],
    clients: Client[]
  ): {
    topClients: TopPerformer[];
    topServices: TopPerformer[];
    topAreas: TopPerformer[];
  } {
    const completedOrders = orders.filter((o) => o.status === 'atlikta');

    // Top clients by revenue
    const clientRevenue = new Map<string, number>();
    completedOrders.forEach((order) => {
      const current = clientRevenue.get(order.clientId) || 0;
      clientRevenue.set(order.clientId, current + order.totalPrice);
    });

    const topClients = Array.from(clientRevenue.entries())
      .map(([id, revenue]) => {
        const client = clients.find((c) => c.id === id);
        return {
          id,
          name: client?.name || 'Nežinomas',
          value: revenue,
          type: 'client' as const,
        };
      })
      .sort((a, b) => b.value - a.value)
      .slice(0, 5);

    // Top services by frequency
    const serviceCount = new Map<string, number>();
    completedOrders.forEach((order) => {
      const label = order.serviceType?.trim() || 'Langų valymas';
      const current = serviceCount.get(label) || 0;
      serviceCount.set(label, current + 1);
    });

    const topServices = Array.from(serviceCount.entries())
      .map(([service, count]) => ({
        id: service,
        name: service,
        value: count,
        type: 'service' as const,
      }))
      .sort((a, b) => b.value - a.value)
      .slice(0, 5);

    // Top areas by revenue
    const areaRevenue = new Map<string, number>();
    completedOrders.forEach((order) => {
      const area = order.address.split(',')[0].trim();
      const current = areaRevenue.get(area) || 0;
      areaRevenue.set(area, current + order.totalPrice);
    });

    const topAreas = Array.from(areaRevenue.entries())
      .map(([area, revenue]) => ({
        id: area,
        name: area,
        value: revenue,
        type: 'area' as const,
      }))
      .sort((a, b) => b.value - a.value)
      .slice(0, 5);

    return {
      topClients,
      topServices,
      topAreas,
    };
  }

  // Get forecast data
  getForecast(
    orders: Order[],
    settings: AppSettings
  ): {
    nextWeekRevenue: number;
    nextMonthRevenue: number;
    confidence: number;
  } {
    const completedOrders = orders.filter((o) => o.status === 'atlikta');
    const recentOrders = completedOrders.filter((o) => {
      const daysSince = (Date.now() - new Date(o.date).getTime()) / (1000 * 60 * 60 * 24);
      return daysSince <= 30;
    });

    if (recentOrders.length < 5) {
      return {
        nextWeekRevenue: 0,
        nextMonthRevenue: 0,
        confidence: 0,
      };
    }

    // Simple linear regression based on recent trends
    const avgWeeklyRevenue = recentOrders.reduce((sum, o) => sum + o.totalPrice, 0) / 4.3; // 30 days ≈ 4.3 weeks
    const avgMonthlyRevenue = avgWeeklyRevenue * 4.3;

    // Calculate trend
    const weeklyData = this.groupByWeek(recentOrders);
    const trend = this.calculateTrend(weeklyData);

    const nextWeekRevenue = Math.max(0, avgWeeklyRevenue * (1 + trend));
    const nextMonthRevenue = Math.max(0, avgMonthlyRevenue * (1 + trend));

    // Confidence based on data consistency
    const variance = this.calculateVariance(weeklyData.map((w) => w.revenue));
    const confidence = Math.max(0, Math.min(100, 100 - (variance / avgWeeklyRevenue) * 100));

    return {
      nextWeekRevenue,
      nextMonthRevenue,
      confidence,
    };
  }

  // Helper methods
  private calculateRevenue(orders: Order[]): number {
    return orders.reduce((sum, o) => sum + o.totalPrice, 0);
  }

  private calculateGrowth(current: number, previous: number): number {
    if (previous === 0) return current > 0 ? 100 : 0;
    return ((current - previous) / previous) * 100;
  }

  private getWeekStart(date: Date): Date {
    const d = new Date(date);
    const day = d.getDay();
    const diff = d.getDate() - day + (day === 0 ? -6 : 1); // Adjust for Sunday
    return new Date(d.setDate(diff));
  }

  private getActiveClientsCount(clients: Client[], orders: Order[], days: number): number {
    const cutoff = new Date(Date.now() - days * 24 * 60 * 60 * 1000);
    const recentClientIds = new Set(
      orders.filter((o) => new Date(o.date) >= cutoff).map((o) => o.clientId)
    );
    return recentClientIds.size;
  }

  private getVipClientsCount(clients: Client[], orders: Order[], settings: AppSettings): number {
    const completedOrders = orders.filter((o) => o.status === 'atlikta');
    return clients.filter((client) => {
      const clientOrders = completedOrders.filter((o) => o.clientId === client.id);
      const totalSpent = clientOrders.reduce((sum, o) => sum + o.totalPrice, 0);
      return totalSpent > settings.pricePerWindow * 50; // VIP threshold: 50 windows worth
    }).length;
  }

  private getAtRiskClientsCount(clients: Client[], orders: Order[]): number {
    const completedOrders = orders.filter((o) => o.status === 'atlikta');
    return clients.filter((client) => {
      const clientOrders = completedOrders.filter((o) => o.clientId === client.id);
      if (clientOrders.length < 2) return false;

      const lastOrder = clientOrders.sort(
        (a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()
      )[0];
      const daysSince = (Date.now() - new Date(lastOrder.date).getTime()) / (1000 * 60 * 60 * 24);

      return daysSince > 60 && daysSince <= 90;
    }).length;
  }

  private calculateRetentionRate(clients: Client[], orders: Order[]): number {
    const completedOrders = orders.filter((o) => o.status === 'atlikta');
    const clientsWithOrders = new Set(completedOrders.map((o) => o.clientId));

    if (clientsWithOrders.size < 2) return 100;

    // Simple retention: clients with more than 1 order
    const returningClients = new Set<string>();
    const orderCounts = new Map<string, number>();

    completedOrders.forEach((order) => {
      const count = orderCounts.get(order.clientId) || 0;
      orderCounts.set(order.clientId, count + 1);

      if (count >= 1) {
        returningClients.add(order.clientId);
      }
    });

    return (returningClients.size / clientsWithOrders.size) * 100;
  }

  private groupByWeek(orders: Order[]): { week: string; revenue: number }[] {
    const weeks = new Map<string, number>();

    orders.forEach((order) => {
      const date = new Date(order.date);
      const weekStart = this.getWeekStart(date);
      const weekKey = weekStart.toISOString().split('T')[0];

      const current = weeks.get(weekKey) || 0;
      weeks.set(weekKey, current + order.totalPrice);
    });

    return Array.from(weeks.entries()).map(([week, revenue]) => ({ week, revenue }));
  }

  private calculateTrend(weeklyData: { week: string; revenue: number }[]): number {
    if (weeklyData.length < 2) return 0;

    const sorted = weeklyData.sort((a, b) => a.week.localeCompare(b.week));
    const first = sorted[0].revenue;
    const last = sorted[sorted.length - 1].revenue;

    return ((last - first) / first) * 0.1; // Scale down to avoid extreme predictions
  }

  private calculateVariance(values: number[]): number {
    if (values.length === 0) return 0;

    const mean = values.reduce((sum, v) => sum + v, 0) / values.length;
    const squaredDiffs = values.map((v) => Math.pow(v - mean, 2));
    return squaredDiffs.reduce((sum, v) => sum + v, 0) / values.length;
  }
}

export const analyticsService = AnalyticsService.getInstance();
