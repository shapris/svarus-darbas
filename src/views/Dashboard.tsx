/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from 'react';
import { Order, Client, Expense, Memory } from '../types';
import { formatCurrency, formatDate } from '../utils';
import { CheckCircle2, Clock, Calendar as CalendarIcon, TrendingUp, TrendingDown, Plus, Users, FileText, Sparkles, Cloud, Sun, CloudRain, Thermometer, MapPin, PieChart, Package, Users2 } from 'lucide-react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell } from 'recharts';
import {
  getBusinessInsights,
  generateSpeech,
  getSpeechAudio,
  stopAllAudio,
  DASHBOARD_INSIGHT_LABELS,
  type DashboardInsight,
} from '../services/aiService';
import { Volume2, Mic, Quote, VolumeX } from 'lucide-react';

interface DashboardProps {
  orders: Order[];
  clients: Client[];
  expenses: Expense[];
  memories: Memory[];
  setActiveTab: (tab: string) => void;
}

interface WeatherData {
  temp: number;
  condition: string;
  isRainy: boolean;
}

type GeminiTtsVoice = 'Puck' | 'Charon' | 'Kore' | 'Fenrir' | 'Zephyr';

function resolveGeminiVoice(): GeminiTtsVoice {
  const v = localStorage.getItem('selected_voice') || 'Zephyr';
  const allowed: GeminiTtsVoice[] = ['Puck', 'Charon', 'Kore', 'Fenrir', 'Zephyr'];
  return (allowed.includes(v as GeminiTtsVoice) ? v : 'Zephyr') as GeminiTtsVoice;
}

export default function Dashboard({ orders, clients, expenses, memories, setActiveTab }: DashboardProps) {
  const [insights, setInsights] = useState<DashboardInsight[]>([]);
  const [isLoadingInsights, setIsLoadingInsights] = useState(false);
  const [isSpeaking, setIsSpeaking] = useState<number | null>(null);
  const [cachedAudios, setCachedAudios] = useState<Record<string, HTMLAudioElement>>({});
  const [weather, setWeather] = useState<WeatherData | null>(null);
  const [dailyQuote, setDailyQuote] = useState<string>('');

  useEffect(() => {
    const fetchWeather = async () => {
      try {
        // Klaipėda coordinates
        const res = await fetch('https://api.open-meteo.com/v1/forecast?latitude=55.7068&longitude=21.1443&current_weather=true');
        const data = await res.json();
        const code = data.current_weather.weathercode;
        setWeather({
          temp: Math.round(data.current_weather.temperature),
          condition: code > 50 ? 'Lietus' : code > 0 ? 'Debesuota' : 'Giedra',
          isRainy: code > 50
        });
      } catch (e) {
        console.error('Weather fetch failed', e);
      }
    };
    fetchWeather();
  }, []);

  useEffect(() => {
    const fetchInsights = async () => {
      const voice = resolveGeminiVoice();
      const cacheKey = `insights-v2-${orders.length}-${clients.length}-${memories.length}-${expenses.length}`;
      const cached = localStorage.getItem(cacheKey);
      if (cached) {
        try {
          const parsed = JSON.parse(cached) as unknown;
          if (
            Array.isArray(parsed) &&
            parsed.length === 3 &&
            parsed.every(
              (x) =>
                x &&
                typeof x === 'object' &&
                'id' in x &&
                'text' in x &&
                typeof (x as DashboardInsight).text === 'string',
            )
          ) {
            const blocks = parsed as DashboardInsight[];
            setInsights(blocks);
            blocks.forEach(async (insight, index) => {
              try {
                const audio = await getSpeechAudio(insight.text, voice);
                if (audio) {
                  setCachedAudios((prev) => ({ ...prev, [`insight-${index}`]: audio }));
                }
              } catch (e) {
                console.warn('Pre-fetch failed for cached insight', index);
              }
            });
            return;
          }
        } catch {
          /* ignore bad cache */
        }
      }

      setIsLoadingInsights(true);
      try {
        const res = await getBusinessInsights(orders, clients, memories, expenses);
        setInsights(res);
        localStorage.setItem(cacheKey, JSON.stringify(res));

        res.forEach(async (insight, index) => {
          try {
            const audio = await getSpeechAudio(insight.text, voice);
            if (audio) {
              setCachedAudios((prev) => ({ ...prev, [`insight-${index}`]: audio }));
            }
          } catch (e) {
            console.warn('Pre-fetch failed for new insight', index);
          }
        });
      } catch (error) {
        console.error('Failed to fetch insights:', error);
      } finally {
        setIsLoadingInsights(false);
      }
    };
    fetchInsights();
  }, [orders.length, clients.length, memories.length, expenses.length]);

  useEffect(() => {
    const quotes = [
      "Sėkmė yra ne galutinis taškas, o drąsa tęsti.",
      "Geriausias būdas nuspėti ateitį yra ją sukurti patiems.",
      "Kiekvienas švarus langas yra nauja galimybė pamatyti pasaulį geriau.",
      "Verslas auga ten, kur yra dėmesys detalėms ir klientui.",
      "Niekada nepasiduokite, nes būtent tada, kai sunkiausia, įvyksta proveržis."
    ];
    const quote = quotes[Math.floor(Math.random() * quotes.length)];
    setDailyQuote(quote);

    // Pre-fetch quote audio
    const prefetchQuote = async () => {
      const audio = await getSpeechAudio(quote, 'Zephyr');
      if (audio) {
        setCachedAudios(prev => ({ ...prev, 'daily-quote': audio }));
      }
    };
    prefetchQuote();
  }, []);

  const today = new Date().toISOString().split('T')[0];
  const todayOrders = orders.filter(o => o.date === today);
  const pendingOrders = orders.filter(o => o.status === 'suplanuota');
  const completedOrders = orders.filter(o => o.status === 'atlikta');

  const totalRevenue = completedOrders.reduce((sum, o) => sum + o.totalPrice, 0);
  const totalExpenses = expenses.reduce((sum, e) => sum + e.amount, 0);
  const profit = totalRevenue - totalExpenses;

  // Re-engagement: Clients who haven't booked in 3+ months
  const threeMonthsAgo = new Date();
  threeMonthsAgo.setMonth(threeMonthsAgo.getMonth() - 3);

  const reEngagementClients = clients.filter(client => {
    const clientOrders = orders.filter(o => o.clientId === client.id);
    if (clientOrders.length === 0) return false;
    const lastOrderDate = new Date(Math.max(...clientOrders.map(o => new Date(o.date).getTime())));
    return lastOrderDate < threeMonthsAgo;
  }).slice(0, 3);

  // Prepare chart data (last 6 months)
  const last6Months = Array.from({ length: 6 }, (_, i) => {
    const d = new Date();
    d.setMonth(d.getMonth() - i);
    return {
      month: d.getMonth(),
      year: d.getFullYear(),
      label: d.toLocaleString('lt-LT', { month: 'short' })
    };
  }).reverse();

  const chartData = last6Months.map(({ month, year, label }) => {
    const monthOrders = orders.filter(o => {
      const d = new Date(o.date);
      return d.getMonth() === month && d.getFullYear() === year && o.status === 'atlikta';
    });
    const monthExpenses = expenses.filter(e => {
      const d = new Date(e.date);
      return d.getMonth() === month && d.getFullYear() === year;
    });

    const revenue = monthOrders.reduce((sum, o) => sum + o.totalPrice, 0);
    const cost = monthExpenses.reduce((sum, e) => sum + e.amount, 0);
    const taxes = monthExpenses.filter(e => e.category === 'mokesčiai').reduce((sum, e) => sum + e.amount, 0);

    return {
      name: label.charAt(0).toUpperCase() + label.slice(1),
      Pajamos: revenue,
      Išlaidos: cost - taxes,
      Mokesčiai: taxes,
      Pelnas: revenue - cost
    };
  });

  const stats = [
    { label: 'Šiandien', value: todayOrders.length, icon: CalendarIcon, color: 'text-blue-600', bg: 'bg-blue-50' },
    { label: 'Laukia', value: pendingOrders.length, icon: Clock, color: 'text-amber-600', bg: 'bg-amber-50' },
    { label: 'Pelnas', value: formatCurrency(profit), icon: TrendingUp, color: 'text-emerald-600', bg: 'bg-emerald-50' },
    { label: 'Išlaidos', value: formatCurrency(totalExpenses), icon: TrendingDown, color: 'text-red-600', bg: 'bg-red-50' },
  ];

  const handleOpenMap = () => {
    if (todayOrders.length === 0) return;
    const addresses = todayOrders.map(o => encodeURIComponent(o.address)).join('/');
    window.open(`https://www.google.com/maps/dir/${addresses}`, '_blank');
  };

  const nextOrder = todayOrders
    .filter(o => o.status !== 'atlikta')
    .sort((a, b) => a.time.localeCompare(b.time))[0];

  const handleSpeak = async (text: string, index: number) => {
    if (isSpeaking === index) {
      stopAllAudio();
      setIsSpeaking(null);
      return;
    }

    const cacheKey = `insight-${index}`;
    if (cachedAudios[cacheKey]) {
      stopAllAudio();
      setIsSpeaking(index);
      const audio = cachedAudios[cacheKey];
      audio.onended = () => setIsSpeaking(null);
      await audio.play();
      return;
    }

    setIsSpeaking(index);
    try {
      await generateSpeech(text, resolveGeminiVoice());
    } finally {
      setIsSpeaking(null);
    }
  };

  const handleVoiceQuote = async () => {
    if (isSpeaking === -1) {
      stopAllAudio();
      setIsSpeaking(null);
      return;
    }

    if (cachedAudios['daily-quote']) {
      stopAllAudio();
      setIsSpeaking(-1);
      const audio = cachedAudios['daily-quote'];
      audio.onended = () => setIsSpeaking(null);
      await audio.play();
      return;
    }

    setIsSpeaking(-1); // Special index for global quote
    try {
      await generateSpeech(dailyQuote, 'Zephyr');
    } finally {
      setIsSpeaking(null);
    }
  };

  return (
    <div className="space-y-8 pb-10">
      <div className="flex flex-col md:flex-row gap-4">
        {nextOrder && (
          <section className="flex-1 bg-blue-600 p-6 rounded-[2.5rem] shadow-2xl shadow-blue-200 text-white relative overflow-hidden group">
            <div className="absolute -right-10 -top-10 w-40 h-40 bg-white/10 rounded-full blur-3xl group-hover:scale-150 transition-transform duration-700" />
            <div className="relative z-10">
              <div className="flex items-center gap-2 mb-4">
                <span className="px-3 py-1 bg-white/20 rounded-full text-[10px] font-black uppercase tracking-widest backdrop-blur-md">Artimiausias darbas</span>
                <span className="text-xs font-bold opacity-80">{nextOrder.time}</span>
              </div>
              <h2 className="text-2xl font-black mb-1 leading-tight">{nextOrder.clientName}</h2>
              <p className="text-sm opacity-80 mb-6 font-medium">{nextOrder.address}</p>
              <button
                onClick={() => setActiveTab('orders')}
                className="w-full bg-white text-blue-600 py-4 rounded-2xl font-black text-sm shadow-xl shadow-blue-900/20 active:scale-95 transition-all flex items-center justify-center gap-2"
              >
                Pradėti darbą
                <TrendingUp size={16} />
              </button>
            </div>
          </section>
        )}

        {weather && (
          <section className={`md:w-64 p-6 rounded-[2.5rem] shadow-sm border ${weather.isRainy ? 'bg-slate-900 text-white border-slate-800' : 'bg-white text-slate-900 border-slate-100'}`}>
            <div className="flex justify-between items-start mb-6">
              <div className={`${weather.isRainy ? 'bg-blue-500/20' : 'bg-amber-50'} p-3 rounded-2xl`}>
                {weather.isRainy ? <CloudRain size={24} className="text-blue-400" /> : <Sun size={24} className="text-amber-500" />}
              </div>
              <div className="text-right">
                <p className="text-2xl font-black">{weather.temp}°C</p>
                <p className="text-[10px] font-bold uppercase tracking-widest opacity-60">{weather.condition}</p>
              </div>
            </div>
            <div className="space-y-2">
              <p className="text-xs font-bold">Prognozė šiandienai</p>
              <p className="text-[10px] opacity-60 leading-relaxed">
                {weather.isRainy
                  ? 'Lietinga diena. Rekomenduojama perkelti lauko darbus į vidų arba kitą dieną.'
                  : 'Puikios sąlygos langų valymui. Geras matomumas ir greitas džiūvimas.'}
              </p>
            </div>
          </section>
        )}
      </div>

      {memories.filter(m => (m.importance || 3) >= 4 && m.isActive !== false).length > 0 && (
        <section className="bg-amber-50 border-2 border-amber-200 p-5 rounded-3xl">
          <div className="flex items-center gap-2 mb-4">
            <span className="text-amber-600">🔔</span>
            <h2 className="text-lg font-bold text-amber-900">Svarbūs priminimai</h2>
            <span className="ml-auto text-[10px] font-bold text-amber-600 bg-amber-200 px-2 py-1 rounded-full">
              {memories.filter(m => (m.importance || 3) >= 4 && m.isActive !== false).length}
            </span>
          </div>
          <div className="space-y-3">
            {memories.filter(m => (m.importance || 3) >= 4 && m.isActive !== false).slice(0, 3).map((mem) => (
              <div key={mem.id} className="bg-white p-4 rounded-2xl border border-amber-100 shadow-sm">
                <div className="flex items-start gap-3">
                  <div className="text-amber-500 mt-1">⭐⭐⭐⭐⭐</div>
                  <div className="flex-1">
                    <p className="text-sm font-medium text-slate-900">{mem.content}</p>
                    <p className="text-[10px] text-amber-600 mt-1">
                      {mem.category === 'verslas' ? '💼 Verslas' : mem.category === 'klientas' ? '👤 Klientas' : mem.category === 'procesas' ? '⚙️ Procesas' : '📋 Kita'}: {mem.createdAt?.split('T')[0] || 'N/A'}
                    </p>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </section>
      )}

      <section>
        <div className="flex justify-between items-center mb-4">
          <h2 className="text-lg font-bold text-slate-900">Apžvalga</h2>
          <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Paskutinės 30 d.</span>
        </div>
        <div className="grid grid-cols-2 gap-4">
          {stats.map((stat, i) => (
            <div key={i} className="bg-white p-4 rounded-3xl border border-slate-100 shadow-sm hover:shadow-md transition-shadow">
              <div className={`${stat.bg} w-10 h-10 rounded-2xl flex items-center justify-center mb-3`}>
                <stat.icon size={20} className={stat.color} />
              </div>
              <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">{stat.label}</p>
              <p className="text-xl font-black text-slate-900 mt-1">{stat.value}</p>
            </div>
          ))}
        </div>
      </section>

      {reEngagementClients.length > 0 && (
        <section>
          <div className="flex items-center gap-2 mb-4">
            <Users size={20} className="text-indigo-500" />
            <h2 className="text-lg font-bold text-slate-900">Priminti apie save</h2>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {reEngagementClients.map(client => (
              <div key={client.id} className="bg-white p-4 rounded-3xl border border-slate-100 shadow-sm flex flex-col justify-between">
                <div>
                  <h3 className="font-bold text-slate-900 text-sm truncate">{client.name}</h3>
                  <p className="text-[10px] text-slate-400 font-medium mb-3">Nevalyta seniau nei 3 mėn.</p>
                </div>
                <button
                  onClick={() => window.open(`tel:${client.phone}`)}
                  className="w-full py-2 bg-indigo-50 text-indigo-600 rounded-xl text-[10px] font-black uppercase tracking-widest hover:bg-indigo-100 transition-colors"
                >
                  Skambinti
                </button>
              </div>
            ))}
          </div>
        </section>
      )}

      <section>
        <h2 className="text-lg font-bold text-slate-900 mb-4">Greiti veiksmai</h2>
        <div className="grid grid-cols-3 gap-4 max-w-2xl mx-auto">
          <button
            onClick={() => setActiveTab('orders')}
            className="flex flex-col items-center justify-center p-6 bg-blue-600 text-white rounded-3xl shadow-lg shadow-blue-200 active:scale-95 transition-all"
          >
            <Plus size={32} className="mb-3" />
            <span className="text-xs font-bold uppercase tracking-wider">Užsakymas</span>
          </button>
          <button
            onClick={() => setActiveTab('clients')}
            className="flex flex-col items-center justify-center p-6 bg-white text-slate-900 border border-slate-100 rounded-3xl shadow-sm active:scale-95 transition-all"
          >
            <Users size={32} className="mb-3 text-blue-600" />
            <span className="text-xs font-bold uppercase tracking-wider">Klientas</span>
          </button>
          <button
            onClick={() => setActiveTab('logistics')}
            className="flex flex-col items-center justify-center p-6 bg-white text-slate-900 border border-slate-100 rounded-3xl shadow-sm active:scale-95 transition-all"
          >
            <MapPin size={32} className="mb-3 text-blue-600" />
            <span className="text-xs font-bold uppercase tracking-wider">Logistika</span>
          </button>
          <button
            onClick={() => setActiveTab('inventory')}
            className="flex flex-col items-center justify-center p-6 bg-white text-slate-900 border border-slate-100 rounded-3xl shadow-sm active:scale-95 transition-all"
          >
            <Package size={32} className="mb-3 text-blue-600" />
            <span className="text-xs font-bold uppercase tracking-wider">Inventorius</span>
          </button>
          <button
            onClick={() => setActiveTab('team')}
            className="flex flex-col items-center justify-center p-6 bg-white text-slate-900 border border-slate-100 rounded-3xl shadow-sm active:scale-95 transition-all"
          >
            <Users2 size={32} className="mb-3 text-blue-600" />
            <span className="text-xs font-bold uppercase tracking-wider">Komanda</span>
          </button>
          <button
            onClick={() => setActiveTab('analytics')}
            className="flex flex-col items-center justify-center p-6 bg-indigo-50 text-indigo-700 border border-indigo-100 rounded-3xl shadow-sm active:scale-95 transition-all"
          >
            <PieChart size={32} className="mb-3 text-indigo-600" />
            <span className="text-xs font-bold uppercase tracking-wider">Analitika</span>
          </button>
        </div>
      </section>

      <section>
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <Sparkles size={20} className="text-amber-500" />
            <div>
              <h2 className="text-lg font-bold text-slate-900">AI įžvalgos</h2>
              <p className="text-[11px] text-slate-500 font-medium mt-0.5">
                Trys blokai: atmintis ir komanda · rinka bei įranga · klientai ir operacijos. Kiekvieną galite perklausyti atskirai.
              </p>
            </div>
          </div>
          <button
            onClick={handleVoiceQuote}
            className="flex items-center gap-2 px-3 py-1.5 bg-amber-100 text-amber-700 rounded-full text-[10px] font-bold uppercase tracking-wider hover:bg-amber-200 transition-colors"
          >
            {isSpeaking === -1 ? <VolumeX size={12} className="animate-pulse" /> : <Quote size={12} />}
            Dienos citata
          </button>
        </div>
        <div className="bg-gradient-to-br from-amber-50 to-orange-50 p-6 rounded-3xl border border-amber-100/50 shadow-sm space-y-4">
          {isLoadingInsights ? (
            <div className="flex items-center gap-3 text-amber-600 animate-pulse">
              <Sparkles size={16} className="animate-spin" />
              <span className="text-xs font-bold uppercase tracking-wider">Analizuojama...</span>
            </div>
          ) : (
            insights.map((insight, i) => (
              <div
                key={insight.id}
                className="flex flex-col sm:flex-row sm:items-start gap-3 p-4 rounded-2xl bg-white/65 border border-amber-100/80 shadow-sm"
              >
                <div className="flex-1 min-w-0 space-y-2">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full bg-amber-200/80 text-amber-900">
                      {DASHBOARD_INSIGHT_LABELS[insight.id].badge}
                    </span>
                    <h3 className="text-sm font-bold text-amber-950 leading-snug">{insight.title}</h3>
                  </div>
                  <p className="text-sm text-amber-900/85 font-medium leading-relaxed">{insight.text}</p>
                </div>
                <button
                  type="button"
                  onClick={() => handleSpeak(insight.text, i)}
                  className="shrink-0 self-end sm:self-start p-2.5 bg-white hover:bg-amber-50 text-amber-700 rounded-xl border border-amber-100 shadow-sm transition-all"
                  title={isSpeaking === i ? 'Sustabdyti perklausą' : 'Perklausyti šią įžvalgą'}
                >
                  {isSpeaking === i ? <VolumeX size={16} className="animate-pulse" /> : <Volume2 size={16} />}
                </button>
              </div>
            ))
          )}
        </div>
      </section>

      <section>
        <div className="flex justify-between items-center mb-4">
          <h2 className="text-lg font-bold text-slate-900">Finansų dinamika</h2>
          <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Paskutiniai 6 mėn.</span>
        </div>
        <div className="bg-white p-6 rounded-3xl border border-slate-100 shadow-sm h-72">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={chartData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
              <XAxis
                dataKey="name"
                axisLine={false}
                tickLine={false}
                tick={{ fontSize: 10, fill: '#94a3b8', fontWeight: 600 }}
                dy={10}
              />
              <YAxis
                axisLine={false}
                tickLine={false}
                tick={{ fontSize: 10, fill: '#94a3b8', fontWeight: 600 }}
                tickFormatter={(value) => `€${value}`}
              />
              <Tooltip
                cursor={{ fill: '#f8fafc' }}
                contentStyle={{ borderRadius: '16px', border: 'none', boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1)', fontSize: '12px', fontWeight: 'bold' }}
                formatter={(value: number) => [`€${value}`, undefined]}
              />
              <Bar dataKey="Pajamos" fill="#2563eb" radius={[4, 4, 0, 0]} barSize={12} />
              <Bar dataKey="Išlaidos" fill="#ef4444" radius={[4, 4, 0, 0]} barSize={12} stackId="expenses" />
              <Bar dataKey="Mokesčiai" fill="#f97316" radius={[4, 4, 0, 0]} barSize={12} stackId="expenses" />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </section>

      <section>
        <div className="flex justify-between items-center mb-4">
          <h2 className="text-lg font-bold text-slate-900">Šiandienos darbai</h2>
          <div className="flex gap-2">
            {todayOrders.length > 0 && (
              <button
                onClick={handleOpenMap}
                className="flex items-center gap-1 text-[10px] font-bold text-blue-600 bg-blue-50 px-3 py-1.5 rounded-full uppercase tracking-tighter hover:bg-blue-100 transition-colors"
              >
                <MapPin size={12} />
                Žemėlapis
              </button>
            )}
            <span className="text-[10px] font-bold text-blue-600 bg-blue-50 px-3 py-1.5 rounded-full uppercase tracking-tighter">
              {todayOrders.length} darbai
            </span>
          </div>
        </div>

        {todayOrders.length > 0 ? (
          <div className="space-y-3">
            {todayOrders.map((order) => (
              <div key={order.id} className="bg-white p-4 rounded-3xl border border-slate-100 shadow-sm flex items-center gap-4 hover:border-blue-100 transition-colors cursor-pointer" onClick={() => setActiveTab('orders')}>
                <div className="w-12 h-12 bg-slate-50 rounded-2xl flex flex-col items-center justify-center text-slate-600 border border-slate-100">
                  <span className="text-xs font-black leading-none">{order.time.split(':')[0]}</span>
                  <span className="text-[10px] font-bold opacity-60">{order.time.split(':')[1]}</span>
                </div>
                <div className="flex-1 min-w-0">
                  <h3 className="font-bold text-slate-900 truncate">{order.clientName}</h3>
                  <p className="text-[10px] text-slate-400 truncate font-medium">{order.address}</p>
                </div>
                <div className="text-right">
                  <p className="font-black text-slate-900">{formatCurrency(order.totalPrice)}</p>
                  <span className={`text-[10px] font-black uppercase tracking-tighter ${order.status === 'atlikta' ? 'text-emerald-600' : 'text-blue-600'
                    }`}>
                    {order.status}
                  </span>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="bg-white p-10 rounded-3xl border border-dashed border-slate-200 text-center">
            <CalendarIcon size={32} className="text-slate-200 mx-auto mb-3" />
            <p className="text-slate-400 text-sm font-medium italic">Šiandien darbų nėra</p>
          </div>
        )}
      </section>
    </div>
  );
}
