/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from 'react';
import { Order, Client, AppSettings, OrderStatus, Employee } from '../types';
import { addData, updateData, deleteData, TABLES } from '../supabase';
import { calculateOrderPrice, formatCurrency, formatDate, formatDuration, geocodeAddress, generateInvoicePDF } from '../utils';

interface LocalUser {
  uid: string;
}
import { Plus, Search, Calendar, Clock, MapPin, User as UserIcon, CheckCircle2, MoreVertical, X, FileText, Camera, MessageSquare, Star, Users, Download, Image as ImageIcon, Loader2 } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';

interface LocalUser {
  uid: string;
}

interface OrdersViewProps {
  orders: Order[];
  clients: Client[];
  settings: AppSettings;
  user: LocalUser;
  employees: Employee[];
}

export default function OrdersView({ orders, clients, settings, user, employees }: OrdersViewProps) {
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<OrderStatus | 'all'>('all');
  const [isAdding, setIsAdding] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [isUploading, setIsUploading] = useState<string | null>(null);
  const [editingOrder, setEditingOrder] = useState<Order | null>(null);
  const [formData, setFormData] = useState({
    clientId: '',
    employeeId: '',
    date: new Date().toISOString().split('T')[0],
    time: '10:00',
    windowCount: 10,
    floor: 1,
    additionalServices: {
      balkonai: false,
      vitrinos: false,
      terasa: false,
      kiti: false,
    },
    notes: '',
    estimatedDuration: 60,
    isRecurring: false,
    recurringInterval: 3,
  });

  const filteredOrders = orders.filter(o =>
    (statusFilter === 'all' || o.status === statusFilter) &&
    ((o.clientName || "").toLowerCase().includes(search.toLowerCase()) ||
      (o.address || "").toLowerCase().includes(search.toLowerCase()))
  ).sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());

  const totalPrice = calculateOrderPrice(
    formData.windowCount,
    formData.floor,
    formData.additionalServices,
    settings
  );

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const client = clients.find(c => c.id === formData.clientId);
    if (!client) return;

    setIsSaving(true);
    try {
      const coords = await geocodeAddress(client.address);

      const orderData = {
        ...formData,
        clientName: client.name,
        address: client.address,
        lat: coords?.lat || null,
        lng: coords?.lng || null,
        totalPrice,
        status: 'suplanuota' as OrderStatus,
        uid: user.uid,
        createdAt: new Date().toISOString(),
      };

      if (editingOrder) {
        await updateData(TABLES.ORDERS, editingOrder.id, orderData as any);
      } else {
        await addData(TABLES.ORDERS, user.uid, orderData as any);
      }
      setIsAdding(false);
      setEditingOrder(null);
    } catch (error) {
      console.error('Error saving order:', error);
    } finally {
      setIsSaving(false);
    }
  };

  const handleStatusUpdate = async (order: Order, status: OrderStatus) => {
    try {
      await updateData(TABLES.ORDERS, order.id, { status } as any);

      // Handle recurring orders
      if (status === 'atlikta' && order.isRecurring && order.recurringInterval) {
        const nextDate = new Date(order.date);
        nextDate.setMonth(nextDate.getMonth() + order.recurringInterval);

        const newOrderData = {
          clientId: order.clientId,
          clientName: order.clientName,
          employeeId: order.employeeId || '',
          address: order.address,
          date: nextDate.toISOString().split('T')[0],
          time: order.time,
          windowCount: order.windowCount,
          floor: order.floor,
          additionalServices: order.additionalServices,
          totalPrice: order.totalPrice,
          status: 'suplanuota' as OrderStatus,
          estimatedDuration: order.estimatedDuration || 60,
          isRecurring: true,
          recurringInterval: order.recurringInterval,
          notes: order.notes || '',
          uid: user.uid,
          createdAt: new Date().toISOString(),
        };

        await addData(TABLES.ORDERS, user.uid, newOrderData as any);
        alert(`Užsakymas baigtas. Sukurtas naujas periodinis užsakymas: ${newOrderData.date}`);
      }
    } catch (error) {
      console.error('Error updating status:', error);
    }
  };

  const handlePhotoUpload = async (order: Order, type: 'before' | 'after', file: File) => {
    setIsUploading(`${order.id}-${type}`);
    alert('Nuotraukų įkėlimas nėra galimas naudojant vietinę duomenų saugyklą.');
    setIsUploading(null);
  };

  const handleGenerateInvoice = (order: Order) => {
    const client = clients.find(c => c.id === order.clientId);
    if (client) {
      generateInvoicePDF(order, client);
    }
  };

  const handleDelete = async (id: string) => {
    if (!window.confirm('Ar tikrai norite ištrinti šį užsakymą?')) return;
    try {
      deleteData(TABLES.ORDERS, id);
    } catch (error) {
      console.error('Error deleting order:', error);
    }
  };

  const startEdit = (order: Order) => {
    setEditingOrder(order);
    setFormData({
      clientId: order.clientId,
      employeeId: order.employeeId || '',
      date: order.date,
      time: order.time,
      windowCount: order.windowCount,
      floor: order.floor,
      additionalServices: { ...order.additionalServices },
      notes: order.notes || '',
      estimatedDuration: order.estimatedDuration || 60,
      isRecurring: order.isRecurring || false,
      recurringInterval: order.recurringInterval || 3,
    });
    setIsAdding(true);
  };

  const sendSMS = (order: Order) => {
    const client = clients.find(c => c.id === order.clientId);
    if (!client || !client.phone) {
      alert('Klientas neturi telefono numerio.');
      return;
    }

    let text = settings.smsTemplate || "Sveiki {vardas}, primename apie langų valymą {data} {laikas}. Kaina: {kaina}. Iki pasimatymo!";
    text = text.replace('{vardas}', order.clientName)
      .replace('{data}', formatDate(order.date))
      .replace('{laikas}', order.time)
      .replace('{kaina}', formatCurrency(order.totalPrice));

    window.open(`sms:${client.phone}?body=${encodeURIComponent(text)}`);
  };

  const requestFeedback = (order: Order) => {
    const client = clients.find(c => c.id === order.clientId);
    if (!client || !client.phone) {
      alert('Klientas neturi telefono numerio.');
      return;
    }

    const text = `Sveiki, ${order.clientName}! Dėkojame, kad naudojatės mūsų paslaugomis. Būtume labai dėkingi, jei paliktumėte atsiliepimą: https://g.page/r/your-google-review-link/review`;
    window.open(`sms:${client.phone}?body=${encodeURIComponent(text)}`);
  };

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h2 className="text-xl font-bold text-slate-900">Užsakymai</h2>
        <button
          onClick={() => setIsAdding(true)}
          className="bg-blue-600 text-white p-3 rounded-2xl shadow-lg shadow-blue-200 hover:bg-blue-700 transition-colors"
        >
          <Plus size={20} />
        </button>
      </div>

      <div className="flex flex-col md:flex-row gap-4">
        <div className="relative flex-1">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
          <input
            type="text"
            placeholder="Ieškoti užsakymo..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full bg-white border border-slate-100 rounded-2xl py-4 pl-12 pr-4 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20 shadow-sm"
          />
        </div>
        <div className="flex gap-2 overflow-x-auto pb-2 md:pb-0 no-scrollbar">
          {(['all', 'suplanuota', 'vykdoma', 'atlikta'] as const).map((status) => (
            <button
              key={status}
              onClick={() => setStatusFilter(status)}
              className={`px-4 py-2 rounded-xl text-xs font-bold whitespace-nowrap transition-all ${statusFilter === status
                ? 'bg-blue-600 text-white shadow-lg shadow-blue-200'
                : 'bg-white text-slate-600 border border-slate-100 hover:bg-slate-50'
                }`}
            >
              {status === 'all' ? 'Visi' : status.charAt(0).toUpperCase() + status.slice(1)}
            </button>
          ))}
        </div>
      </div>

      <div className="space-y-4">
        {filteredOrders.map((order) => (
          <motion.div
            layout
            key={order.id}
            className="bg-white rounded-3xl border border-slate-100 shadow-sm overflow-hidden"
          >
            <div className="p-4 border-b border-slate-50 flex justify-between items-center bg-slate-50/50">
              <div className="flex items-center gap-2">
                <Calendar size={14} className="text-blue-600" />
                <span className="text-xs font-bold text-slate-700">{formatDate(order.date)}</span>
                <Clock size={14} className="text-blue-600 ml-2" />
                <span className="text-xs font-bold text-slate-700">{order.time}</span>
                {order.estimatedDuration && (
                  <>
                    <span className="text-slate-300 mx-2">•</span>
                    <span className="text-xs font-bold text-slate-500">~{formatDuration(order.estimatedDuration)}</span>
                  </>
                )}
                {order.employeeId && (
                  <>
                    <span className="text-slate-300 mx-2">•</span>
                    <div className="flex items-center gap-1 text-xs font-bold text-slate-600">
                      <Users size={12} className="text-blue-500" />
                      {employees.find(e => e.id === order.employeeId)?.name || 'Nežinomas'}
                    </div>
                  </>
                )}
                {order.isRecurring && (
                  <>
                    <span className="text-slate-300 mx-2">•</span>
                    <div className="flex items-center gap-1 text-[10px] font-bold text-blue-600 bg-blue-50 px-2 py-0.5 rounded-full uppercase">
                      Kas {order.recurringInterval} mėn.
                    </div>
                  </>
                )}
              </div>
              <div className="flex items-center gap-2">
                <div className={`px-2 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider ${order.status === 'atlikta' ? 'bg-emerald-50 text-emerald-600' :
                  order.status === 'vykdoma' ? 'bg-blue-50 text-blue-600' : 'bg-amber-50 text-amber-600'
                  }`}>
                  {order.status}
                </div>
                <div className="relative group">
                  <button className="p-1 text-slate-400 hover:text-slate-600">
                    <MoreVertical size={16} />
                  </button>
                  <div className="absolute right-0 top-full mt-1 bg-white border border-slate-100 rounded-xl shadow-xl z-10 hidden group-hover:block min-w-[120px] overflow-hidden">
                    <button
                      onClick={() => startEdit(order)}
                      className="w-full text-left px-4 py-2 text-xs font-bold text-slate-700 hover:bg-slate-50"
                    >
                      Redaguoti
                    </button>
                    <button
                      onClick={() => handleDelete(order.id)}
                      className="w-full text-left px-4 py-2 text-xs font-bold text-red-600 hover:bg-red-50"
                    >
                      Ištrinti
                    </button>
                  </div>
                </div>
              </div>
            </div>

            <div className="p-4">
              <div className="flex justify-between items-start mb-4">
                <div>
                  <h3 className="font-bold text-slate-900 text-lg">{order.clientName}</h3>
                  <div className="flex items-center gap-1 text-xs text-slate-500 mt-1">
                    <MapPin size={12} />
                    <span>{order.address}</span>
                  </div>
                </div>
                <div className="text-right">
                  <p className="text-xl font-black text-slate-900">{formatCurrency(order.totalPrice)}</p>
                  <p className="text-[10px] text-slate-400 font-bold uppercase">{order.windowCount} langai</p>
                </div>
              </div>

              <div className="flex gap-2 mt-4">
                {order.status !== 'atlikta' && (
                  <button
                    onClick={() => handleStatusUpdate(order, order.status === 'suplanuota' ? 'vykdoma' : 'atlikta')}
                    className="flex-1 bg-blue-600 text-white py-3 rounded-xl text-xs font-bold flex items-center justify-center gap-2"
                  >
                    <CheckCircle2 size={16} />
                    {order.status === 'suplanuota' ? 'Pradėti' : 'Baigti'}
                  </button>
                )}
                {order.status === 'atlikta' && (
                  <>
                    <button
                      onClick={() => handleGenerateInvoice(order)}
                      className="flex-1 bg-slate-900 text-white py-3 rounded-xl text-xs font-bold flex items-center justify-center gap-2"
                    >
                      <Download size={16} />
                      Sąskaita
                    </button>
                    <button
                      onClick={() => requestFeedback(order)}
                      className="bg-amber-50 text-amber-500 p-3 rounded-xl hover:bg-amber-100 transition-colors"
                      title="Prašyti atsiliepimo"
                    >
                      <Star size={16} />
                    </button>
                  </>
                )}
                <button onClick={() => sendSMS(order)} className="bg-slate-50 text-slate-400 p-3 rounded-xl hover:bg-slate-100 hover:text-blue-600 transition-colors">
                  <MessageSquare size={16} />
                </button>
              </div>

              {/* Nuotraukų dokumentacija */}
              <div className="mt-6 pt-6 border-t border-slate-50">
                <div className="flex items-center gap-2 mb-4">
                  <Camera size={16} className="text-slate-400" />
                  <h4 className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Nuotraukų dokumentacija</h4>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  {/* Prieš */}
                  <div className="space-y-2">
                    <p className="text-[10px] font-bold text-slate-500 uppercase">Prieš</p>
                    {order.photoBefore ? (
                      <div className="relative group aspect-video rounded-2xl overflow-hidden border border-slate-100">
                        <img src={order.photoBefore} alt="Prieš" className="w-full h-full object-cover" />
                        <label className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center cursor-pointer">
                          <input
                            type="file"
                            className="hidden"
                            accept="image/*"
                            onChange={(e) => e.target.files?.[0] && handlePhotoUpload(order, 'before', e.target.files[0])}
                          />
                          <ImageIcon className="text-white" size={24} />
                        </label>
                      </div>
                    ) : (
                      <label className="aspect-video rounded-2xl border-2 border-dashed border-slate-100 flex flex-col items-center justify-center gap-2 cursor-pointer hover:bg-slate-50 transition-colors">
                        <input
                          type="file"
                          className="hidden"
                          accept="image/*"
                          onChange={(e) => e.target.files?.[0] && handlePhotoUpload(order, 'before', e.target.files[0])}
                        />
                        {isUploading === `${order.id}-before` ? (
                          <Loader2 className="text-blue-500 animate-spin" size={24} />
                        ) : (
                          <>
                            <Plus className="text-slate-300" size={24} />
                            <span className="text-[10px] font-bold text-slate-400 uppercase">Įkelti</span>
                          </>
                        )}
                      </label>
                    )}
                  </div>

                  {/* Po */}
                  <div className="space-y-2">
                    <p className="text-[10px] font-bold text-slate-500 uppercase">Po</p>
                    {order.photoAfter ? (
                      <div className="relative group aspect-video rounded-2xl overflow-hidden border border-slate-100">
                        <img src={order.photoAfter} alt="Po" className="w-full h-full object-cover" />
                        <label className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center cursor-pointer">
                          <input
                            type="file"
                            className="hidden"
                            accept="image/*"
                            onChange={(e) => e.target.files?.[0] && handlePhotoUpload(order, 'after', e.target.files[0])}
                          />
                          <ImageIcon className="text-white" size={24} />
                        </label>
                      </div>
                    ) : (
                      <label className="aspect-video rounded-2xl border-2 border-dashed border-slate-100 flex flex-col items-center justify-center gap-2 cursor-pointer hover:bg-slate-50 transition-colors">
                        <input
                          type="file"
                          className="hidden"
                          accept="image/*"
                          onChange={(e) => e.target.files?.[0] && handlePhotoUpload(order, 'after', e.target.files[0])}
                        />
                        {isUploading === `${order.id}-after` ? (
                          <Loader2 className="text-blue-500 animate-spin" size={24} />
                        ) : (
                          <>
                            <Plus className="text-slate-300" size={24} />
                            <span className="text-[10px] font-bold text-slate-400 uppercase">Įkelti</span>
                          </>
                        )}
                      </label>
                    )}
                  </div>
                </div>
              </div>
            </div>
          </motion.div>
        ))}
      </div>

      <AnimatePresence>
        {isAdding && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-50 flex items-end sm:items-center justify-center p-4"
          >
            <motion.div
              initial={{ y: 100 }}
              animate={{ y: 0 }}
              exit={{ y: 100 }}
              className="bg-white w-full max-w-md rounded-t-3xl sm:rounded-3xl p-6 shadow-2xl max-h-[90vh] overflow-y-auto"
            >
              <div className="flex justify-between items-center mb-6">
                <h3 className="text-xl font-bold text-slate-900">Naujas užsakymas</h3>
                <button onClick={() => setIsAdding(false)} className="p-2 text-slate-400 hover:text-slate-600">
                  <X size={24} />
                </button>
              </div>

              <form onSubmit={handleSubmit} className="space-y-4">
                <div>
                  <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1">Klientas</label>
                  <select
                    required
                    value={formData.clientId}
                    onChange={(e) => setFormData({ ...formData, clientId: e.target.value })}
                    className="w-full bg-slate-50 border border-slate-100 rounded-xl p-3 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20"
                  >
                    <option value="">Pasirinkite klientą</option>
                    {clients.map(c => (
                      <option key={c.id} value={c.id}>{c.name} - {c.address}</option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1">Priskirtas darbuotojas</label>
                  <select
                    value={formData.employeeId}
                    onChange={(e) => setFormData({ ...formData, employeeId: e.target.value })}
                    className="w-full bg-slate-50 border border-slate-100 rounded-xl p-3 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20"
                  >
                    <option value="">Nepriskirtas</option>
                    {employees.filter(e => e.isActive).map(emp => (
                      <option key={emp.id} value={emp.id}>{emp.name}</option>
                    ))}
                  </select>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1">Data</label>
                    <input
                      required
                      type="date"
                      value={formData.date}
                      onChange={(e) => setFormData({ ...formData, date: e.target.value })}
                      className="w-full bg-slate-50 border border-slate-100 rounded-xl p-3 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1">Laikas</label>
                    <input
                      required
                      type="time"
                      value={formData.time}
                      onChange={(e) => setFormData({ ...formData, time: e.target.value })}
                      className="w-full bg-slate-50 border border-slate-100 rounded-xl p-3 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1">Langų skaičius</label>
                    <input
                      required
                      type="number"
                      value={formData.windowCount}
                      onChange={(e) => setFormData({ ...formData, windowCount: parseInt(e.target.value) })}
                      className="w-full bg-slate-50 border border-slate-100 rounded-xl p-3 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1">Aukštas</label>
                    <input
                      required
                      type="number"
                      value={formData.floor}
                      onChange={(e) => setFormData({ ...formData, floor: parseInt(e.target.value) })}
                      className="w-full bg-slate-50 border border-slate-100 rounded-xl p-3 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">Trukmė</label>
                  <div className="grid grid-cols-3 gap-2">
                    <div className="space-y-1">
                      <input
                        type="number"
                        min="0"
                        value={Math.floor(formData.estimatedDuration / (24 * 60))}
                        onChange={(e) => {
                          const d = parseInt(e.target.value) || 0;
                          const h = Math.floor((formData.estimatedDuration % (24 * 60)) / 60);
                          const m = formData.estimatedDuration % 60;
                          setFormData({ ...formData, estimatedDuration: d * 24 * 60 + h * 60 + m });
                        }}
                        className="w-full bg-slate-50 border border-slate-100 rounded-xl p-3 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20"
                      />
                      <span className="text-[10px] text-slate-400 font-bold uppercase block text-center">d.</span>
                    </div>
                    <div className="space-y-1">
                      <input
                        type="number"
                        min="0"
                        max="23"
                        value={Math.floor((formData.estimatedDuration % (24 * 60)) / 60)}
                        onChange={(e) => {
                          const d = Math.floor(formData.estimatedDuration / (24 * 60));
                          const h = parseInt(e.target.value) || 0;
                          const m = formData.estimatedDuration % 60;
                          setFormData({ ...formData, estimatedDuration: d * 24 * 60 + h * 60 + m });
                        }}
                        className="w-full bg-slate-50 border border-slate-100 rounded-xl p-3 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20"
                      />
                      <span className="text-[10px] text-slate-400 font-bold uppercase block text-center">val.</span>
                    </div>
                    <div className="space-y-1">
                      <input
                        type="number"
                        min="0"
                        max="59"
                        value={formData.estimatedDuration % 60}
                        onChange={(e) => {
                          const d = Math.floor(formData.estimatedDuration / (24 * 60));
                          const h = Math.floor((formData.estimatedDuration % (24 * 60)) / 60);
                          const m = parseInt(e.target.value) || 0;
                          setFormData({ ...formData, estimatedDuration: d * 24 * 60 + h * 60 + m });
                        }}
                        className="w-full bg-slate-50 border border-slate-100 rounded-xl p-3 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20"
                      />
                      <span className="text-[10px] text-slate-400 font-bold uppercase block text-center">min.</span>
                    </div>
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1">Papildomos paslaugos</label>
                  <div className="grid grid-cols-2 gap-2">
                    {Object.entries(formData.additionalServices).map(([key, val]) => (
                      <button
                        key={key}
                        type="button"
                        onClick={() => setFormData({
                          ...formData,
                          additionalServices: { ...formData.additionalServices, [key]: !val }
                        })}
                        className={`py-2 rounded-xl text-xs font-bold capitalize border transition-all ${val ? 'bg-blue-50 text-blue-600 border-blue-200' : 'bg-white text-slate-400 border-slate-100'
                          }`}
                      >
                        {key}
                      </button>
                    ))}
                  </div>
                </div>

                <div className="bg-slate-50 p-4 rounded-2xl border border-slate-100 space-y-3">
                  <div className="flex items-center justify-between">
                    <label className="text-sm font-bold text-slate-700">Periodinis užsakymas</label>
                    <button
                      type="button"
                      onClick={() => setFormData({ ...formData, isRecurring: !formData.isRecurring })}
                      className={`w-12 h-6 rounded-full transition-colors relative ${formData.isRecurring ? 'bg-blue-500' : 'bg-slate-300'
                        }`}
                    >
                      <div className={`w-4 h-4 rounded-full bg-white absolute top-1 transition-transform ${formData.isRecurring ? 'left-7' : 'left-1'
                        }`} />
                    </button>
                  </div>

                  {formData.isRecurring && (
                    <div className="pt-2 border-t border-slate-200">
                      <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1">Intervalas (mėnesiais)</label>
                      <input
                        type="number"
                        min="1"
                        max="12"
                        value={formData.recurringInterval}
                        onChange={(e) => setFormData({ ...formData, recurringInterval: parseInt(e.target.value) || 3 })}
                        className="w-full bg-white border border-slate-200 rounded-xl p-3 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20"
                      />
                    </div>
                  )}
                </div>

                <div className="bg-blue-50 p-4 rounded-2xl border border-blue-100 flex justify-between items-center">
                  <span className="text-sm font-bold text-blue-900">Preliminari kaina:</span>
                  <span className="text-xl font-black text-blue-600">{formatCurrency(totalPrice)}</span>
                </div>

                <button
                  type="submit"
                  disabled={isSaving}
                  className="w-full bg-blue-600 text-white py-4 rounded-2xl font-bold shadow-lg shadow-blue-200 hover:bg-blue-700 transition-colors mt-4 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center"
                >
                  {isSaving ? (
                    <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white"></div>
                  ) : (
                    editingOrder ? 'Išsaugoti pakeitimus' : 'Sukurti užsakymą'
                  )}
                </button>
              </form>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
