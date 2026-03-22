/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useMemo } from 'react';
import { Order, Expense, Client, AppSettings } from '../types';
import { formatCurrency } from '../utils';
import { PieChart, Pie, Cell, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend, LineChart, Line } from 'recharts';
import { TrendingUp, PieChart as PieChartIcon, Users, Euro, Award } from 'lucide-react';
import { motion } from 'motion/react';

interface AnalyticsViewProps {
  orders: Order[];
  expenses: Expense[];
  clients: Client[];
  settings: AppSettings;
}

const COLORS = ['#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#ec4899'];

export default function AnalyticsView({ orders, expenses, clients, settings }: AnalyticsViewProps) {
  const completedOrders = orders.filter(o => o.status === 'atlikta');

  // 1. Revenue & Expenses over the last 12 months
  const monthlyData = useMemo(() => {
    const data = [];
    for (let i = 11; i >= 0; i--) {
      const d = new Date();
      d.setMonth(d.getMonth() - i);
      const month = d.getMonth();
      const year = d.getFullYear();
      const label = d.toLocaleString('lt-LT', { month: 'short' });

      const mOrders = completedOrders.filter(o => {
        const od = new Date(o.date);
        return od.getMonth() === month && od.getFullYear() === year;
      });
      const mExpenses = expenses.filter(e => {
        const ed = new Date(e.date);
        return ed.getMonth() === month && ed.getFullYear() === year;
      });

      const revenue = mOrders.reduce((sum, o) => sum + o.totalPrice, 0);
      const cost = mExpenses.reduce((sum, e) => sum + e.amount, 0);

      data.push({
        name: label.charAt(0).toUpperCase() + label.slice(1),
        Pajamos: revenue,
        Išlaidos: cost,
        Pelnas: revenue - cost,
      });
    }
    return data;
  }, [completedOrders, expenses]);

  // 2. Expenses by Category
  const expensesByCategory = useMemo(() => {
    const categories: Record<string, number> = {};
    expenses.forEach(e => {
      categories[e.category] = (categories[e.category] || 0) + e.amount;
    });
    return Object.entries(categories)
      .map(([name, value]) => ({ name: name.charAt(0).toUpperCase() + name.slice(1), value }))
      .sort((a, b) => b.value - a.value);
  }, [expenses]);

  // 3. Revenue by Service Type (Estimated)
  const revenueByService = useMemo(() => {
    let baseWindows = 0;
    let floors = 0;
    let balconies = 0;
    let vitrinos = 0;
    let terasa = 0;
    let kiti = 0;

    completedOrders.forEach(o => {
      baseWindows += o.windowCount * settings.pricePerWindow;
      if (o.floor > 1) floors += (o.floor - 1) * settings.pricePerFloor;
      if (o.additionalServices.balkonai) balconies += settings.priceBalkonai;
      if (o.additionalServices.vitrinos) vitrinos += settings.priceVitrinos;
      if (o.additionalServices.terasa) terasa += settings.priceTerasa;
      if (o.additionalServices.kiti) kiti += settings.priceKiti;
    });

    const data = [
      { name: 'Langai', value: baseWindows },
      { name: 'Aukšto mokestis', value: floors },
      { name: 'Balkonai', value: balconies },
      { name: 'Vitrinos', value: vitrinos },
      { name: 'Terasos', value: terasa },
      { name: 'Kiti', value: kiti },
    ].filter(d => d.value > 0).sort((a, b) => b.value - a.value);

    return data;
  }, [completedOrders, settings]);

  // 4. Top Clients
  const topClients = useMemo(() => {
    const clientRevenue: Record<string, { name: string, revenue: number, orders: number }> = {};
    completedOrders.forEach(o => {
      if (!clientRevenue[o.clientId]) {
        clientRevenue[o.clientId] = { name: o.clientName, revenue: 0, orders: 0 };
      }
      clientRevenue[o.clientId].revenue += o.totalPrice;
      clientRevenue[o.clientId].orders += 1;
    });
    return Object.values(clientRevenue)
      .sort((a, b) => b.revenue - a.revenue)
      .slice(0, 5);
  }, [completedOrders]);

  const totalRevenue = completedOrders.reduce((sum, o) => sum + o.totalPrice, 0);
  const totalExpenses = expenses.reduce((sum, e) => sum + e.amount, 0);
  const totalProfit = totalRevenue - totalExpenses;

  return (
    <div className="space-y-6 pb-10">
      <div className="flex justify-between items-center">
        <h2 className="text-xl font-bold text-slate-900">Analitika</h2>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="bg-white p-6 rounded-[2.5rem] border border-slate-100 shadow-sm flex items-center gap-4">
          <div className="w-12 h-12 bg-blue-50 rounded-2xl flex items-center justify-center text-blue-600">
            <Euro size={24} />
          </div>
          <div>
            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Visos Pajamos</p>
            <p className="text-2xl font-black text-slate-900">{formatCurrency(totalRevenue)}</p>
          </div>
        </div>
        <div className="bg-white p-6 rounded-[2.5rem] border border-slate-100 shadow-sm flex items-center gap-4">
          <div className="w-12 h-12 bg-emerald-50 rounded-2xl flex items-center justify-center text-emerald-600">
            <TrendingUp size={24} />
          </div>
          <div>
            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Visas Pelnas</p>
            <p className="text-2xl font-black text-slate-900">{formatCurrency(totalProfit)}</p>
          </div>
        </div>
        <div className="bg-white p-6 rounded-[2.5rem] border border-slate-100 shadow-sm flex items-center gap-4">
          <div className="w-12 h-12 bg-indigo-50 rounded-2xl flex items-center justify-center text-indigo-600">
            <Users size={24} />
          </div>
          <div>
            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Atlikti Užsakymai</p>
            <p className="text-2xl font-black text-slate-900">{completedOrders.length}</p>
          </div>
        </div>
      </div>

      {/* Main Chart: 12 Months Trend */}
      <section className="bg-white p-6 rounded-[2.5rem] border border-slate-100 shadow-sm">
        <h3 className="text-lg font-bold text-slate-900 mb-6 flex items-center gap-2">
          <TrendingUp size={20} className="text-blue-600" />
          Metinė finansų dinamika
        </h3>
        <div className="h-80">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={monthlyData} margin={{ top: 5, right: 20, left: -20, bottom: 5 }}>
              <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
              <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fontSize: 10, fill: '#94a3b8', fontWeight: 600 }} dy={10} />
              <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 10, fill: '#94a3b8', fontWeight: 600 }} tickFormatter={(value) => `€${value}`} />
              <Tooltip 
                contentStyle={{ borderRadius: '16px', border: 'none', boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1)', fontSize: '12px', fontWeight: 'bold' }}
                formatter={(value: number) => [`€${value}`, undefined]}
              />
              <Legend iconType="circle" wrapperStyle={{ fontSize: '12px', fontWeight: 'bold', paddingTop: '20px' }} />
              <Line type="monotone" dataKey="Pajamos" stroke="#2563eb" strokeWidth={3} dot={{ r: 4, strokeWidth: 2 }} activeDot={{ r: 6 }} />
              <Line type="monotone" dataKey="Pelnas" stroke="#10b981" strokeWidth={3} dot={{ r: 4, strokeWidth: 2 }} activeDot={{ r: 6 }} />
              <Line type="monotone" dataKey="Išlaidos" stroke="#ef4444" strokeWidth={3} dot={{ r: 4, strokeWidth: 2 }} activeDot={{ r: 6 }} />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </section>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Expenses by Category */}
        <section className="bg-white p-6 rounded-[2.5rem] border border-slate-100 shadow-sm">
          <h3 className="text-lg font-bold text-slate-900 mb-6 flex items-center gap-2">
            <PieChartIcon size={20} className="text-red-500" />
            Išlaidų pasiskirstymas
          </h3>
          <div className="h-64">
            {expensesByCategory.length > 0 ? (
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={expensesByCategory}
                    cx="50%"
                    cy="50%"
                    innerRadius={60}
                    outerRadius={80}
                    paddingAngle={5}
                    dataKey="value"
                  >
                    {expensesByCategory.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip 
                    formatter={(value: number) => [`€${value}`, undefined]}
                    contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }}
                  />
                  <Legend iconType="circle" wrapperStyle={{ fontSize: '11px', fontWeight: 'bold' }} />
                </PieChart>
              </ResponsiveContainer>
            ) : (
              <div className="h-full flex items-center justify-center text-slate-400 text-sm italic">Nėra duomenų</div>
            )}
          </div>
        </section>

        {/* Revenue by Service */}
        <section className="bg-white p-6 rounded-[2.5rem] border border-slate-100 shadow-sm">
          <h3 className="text-lg font-bold text-slate-900 mb-6 flex items-center gap-2">
            <PieChartIcon size={20} className="text-blue-500" />
            Pajamos pagal paslaugas
          </h3>
          <div className="h-64">
            {revenueByService.length > 0 ? (
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={revenueByService}
                    cx="50%"
                    cy="50%"
                    innerRadius={60}
                    outerRadius={80}
                    paddingAngle={5}
                    dataKey="value"
                  >
                    {revenueByService.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip 
                    formatter={(value: number) => [`€${value}`, undefined]}
                    contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }}
                  />
                  <Legend iconType="circle" wrapperStyle={{ fontSize: '11px', fontWeight: 'bold' }} />
                </PieChart>
              </ResponsiveContainer>
            ) : (
              <div className="h-full flex items-center justify-center text-slate-400 text-sm italic">Nėra duomenų</div>
            )}
          </div>
        </section>
      </div>

      {/* Top Clients */}
      <section className="bg-white p-6 rounded-[2.5rem] border border-slate-100 shadow-sm">
        <h3 className="text-lg font-bold text-slate-900 mb-6 flex items-center gap-2">
          <Award size={20} className="text-amber-500" />
          Geriausi klientai (TOP 5)
        </h3>
        <div className="space-y-3">
          {topClients.length > 0 ? (
            topClients.map((client, index) => (
              <div key={index} className="flex items-center justify-between p-4 bg-slate-50 rounded-2xl border border-slate-100">
                <div className="flex items-center gap-4">
                  <div className="w-8 h-8 rounded-full bg-amber-100 text-amber-600 flex items-center justify-center font-black text-xs">
                    #{index + 1}
                  </div>
                  <div>
                    <p className="font-bold text-slate-900">{client.name}</p>
                    <p className="text-[10px] text-slate-500 font-bold uppercase tracking-wider">{client.orders} užsakymai</p>
                  </div>
                </div>
                <div className="text-right">
                  <p className="font-black text-emerald-600">{formatCurrency(client.revenue)}</p>
                </div>
              </div>
            ))
          ) : (
            <div className="text-center text-slate-400 text-sm italic py-4">Nėra duomenų</div>
          )}
        </div>
      </section>
    </div>
  );
}
