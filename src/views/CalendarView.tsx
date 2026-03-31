/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useMemo, useState } from 'react';
import { Order, Employee, Client, OrderStatus } from '../types';
import { formatCurrency } from '../utils';
import { Calendar as CalendarIcon, MapPin, ChevronLeft, ChevronRight, Clock, Users, Save, Trash2, X } from 'lucide-react';
import { updateData, deleteData, TABLES } from '../supabase';
import { useToast } from '../hooks/useToast';
import { 
  format, 
  addMonths, 
  subMonths, 
  startOfMonth, 
  endOfMonth, 
  startOfWeek, 
  endOfWeek, 
  isSameMonth, 
  isSameDay, 
  addDays,
  parseISO
} from 'date-fns';
import { lt } from 'date-fns/locale';

interface CalendarViewProps {
  orders: Order[];
  employees: Employee[];
  clients: Client[];
  onOpenClient?: (clientId: string) => void;
}

type PlannedOrder = {
  order: Order;
  startMin: number;
  endMin: number;
  durationMin: number;
};

const WORK_DAY_START = 8 * 60; // 08:00
const WORK_DAY_END = 18 * 60; // 18:00
const DEFAULT_SLOT_DURATION = 90;
const EMPLOYEE_COLOR_CLASS: Record<string, string> = {
  '#3b82f6': 'bg-blue-500',
  '#10b981': 'bg-emerald-500',
  '#f59e0b': 'bg-amber-500',
  '#ef4444': 'bg-red-500',
  '#8b5cf6': 'bg-violet-500',
  '#06b6d4': 'bg-cyan-500',
  '#84cc16': 'bg-lime-500',
  '#f97316': 'bg-orange-500',
};

function toMinutes(time: string): number {
  const [h, m] = (time || '00:00').split(':').map((x) => parseInt(x, 10) || 0);
  return h * 60 + m;
}

function toHHMM(totalMin: number): string {
  const h = Math.floor(totalMin / 60);
  const m = totalMin % 60;
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
}

function normalizeOrderDateKey(raw: string): string {
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

function estimateOrderDuration(order: Order): number {
  const base = 45;
  const windowPart = Math.min(120, Math.max(0, (order.windowCount || 0) * 4));
  const floorPart = Math.max(0, ((order.floor || 1) - 1) * 8);
  const extraServicesCount = Object.values(order.additionalServices || {}).filter(Boolean).length;
  const extraPart = extraServicesCount * 15;
  return Math.max(45, Math.min(210, base + windowPart + floorPart + extraPart));
}

export default function CalendarView({ orders, employees, clients, onOpenClient }: CalendarViewProps) {
  const [currentMonth, setCurrentMonth] = useState(new Date());
  const [selectedDate, setSelectedDate] = useState(new Date());
  const [isDayDetailsOpen, setIsDayDetailsOpen] = useState(false);
  const [editingOrderId, setEditingOrderId] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [isDeleting, setIsDeleting] = useState<string | null>(null);
  const [draggedOrderId, setDraggedOrderId] = useState<string | null>(null);
  const [dragOverDate, setDragOverDate] = useState<string | null>(null);
  const [employeeFilter, setEmployeeFilter] = useState<string>('all');
  const [statusFilter, setStatusFilter] = useState<OrderStatus | 'all'>('all');
  const [areaFilter, setAreaFilter] = useState<string>('');
  const [editForm, setEditForm] = useState<{ date: string; time: string; status: OrderStatus; employeeId: string; notes: string }>({
    date: '',
    time: '10:00',
    status: 'suplanuota',
    employeeId: '',
    notes: '',
  });
  const { showToast } = useToast();
  const allowedStatuses: OrderStatus[] = ['suplanuota', 'vykdoma', 'atlikta'];

  const nextMonth = () => setCurrentMonth(addMonths(currentMonth, 1));
  const prevMonth = () => setCurrentMonth(subMonths(currentMonth, 1));
  const onDateClick = (day: Date) => {
    setSelectedDate(day);
    setIsDayDetailsOpen(true);
  };

  const renderHeader = () => {
    return (
      <div className="flex justify-between items-center mb-6 bg-white p-4 rounded-3xl shadow-sm border border-slate-100">
        <button onClick={prevMonth} title="Ankstesnis mėnuo" className="p-2 hover:bg-slate-50 rounded-full transition-colors">
          <ChevronLeft size={20} className="text-slate-600" />
        </button>
        <h2 className="text-lg font-black text-slate-900 capitalize tracking-wide">
          {format(currentMonth, 'MMMM yyyy', { locale: lt })}
        </h2>
        <button onClick={nextMonth} title="Kitas mėnuo" className="p-2 hover:bg-slate-50 rounded-full transition-colors">
          <ChevronRight size={20} className="text-slate-600" />
        </button>
      </div>
    );
  };

  const renderDays = () => {
    const days = [];
    const startDate = startOfWeek(currentMonth, { weekStartsOn: 1 }); // Monday start

    for (let i = 0; i < 7; i++) {
      days.push(
        <div key={i} className="text-center font-bold text-[10px] text-slate-400 uppercase tracking-widest py-2">
          {format(addDays(startDate, i), 'EEEEEE', { locale: lt })}
        </div>
      );
    }
    return <div className="grid grid-cols-7 mb-2">{days}</div>;
  };

  const renderCells = () => {
    const monthStart = startOfMonth(currentMonth);
    const monthEnd = endOfMonth(monthStart);
    const startDate = startOfWeek(monthStart, { weekStartsOn: 1 });
    const endDate = endOfWeek(monthEnd, { weekStartsOn: 1 });

    const dateFormat = "yyyy-MM-dd";
    const rows = [];
    let days = [];
    let day = startDate;
    let formattedDate = "";

    while (day <= endDate) {
      for (let i = 0; i < 7; i++) {
        formattedDate = format(day, dateFormat);
        const cloneDay = day;
        
        // Find orders for this day
        const dayOrders = orders.filter(o => normalizeOrderDateKey(o.date) === formattedDate);
        
        days.push(
          <div
            key={day.toString()}
            onClick={() => onDateClick(cloneDay)}
            onDragEnter={() => {
              if (draggedOrderId) setDragOverDate(formattedDate);
            }}
            onDragOver={(e) => e.preventDefault()}
            onDrop={() => {
              handleDropToDate(formattedDate);
              setDragOverDate(null);
            }}
            className={`min-h-[80px] p-1 border border-slate-50 transition-all cursor-pointer relative ${
              !isSameMonth(day, monthStart)
                ? "bg-slate-50/50 text-slate-300"
                : isSameDay(day, selectedDate)
                ? "bg-blue-50 border-blue-200 text-blue-700"
                : "bg-white text-slate-700 hover:bg-slate-50"
            } ${isSameDay(day, new Date()) ? "font-black" : "font-medium"} ${
              dragOverDate === formattedDate ? "ring-2 ring-blue-300 bg-blue-50/70" : ""
            }`}
          >
            <span className={`text-xs p-1.5 flex items-center justify-center w-6 h-6 rounded-full ${isSameDay(day, new Date()) ? 'bg-blue-600 text-white' : ''}`}>
              {format(day, 'd')}
            </span>
            
            <div className="mt-1 flex flex-col gap-1 px-1">
              {dayOrders.slice(0, 2).map(order => {
                const employee = employees.find(e => e.id === order.employeeId);
                const employeeColor = (employee?.color || '').toLowerCase();
                const colorClass = EMPLOYEE_COLOR_CLASS[employeeColor] || 'bg-slate-400';
                
                return (
                  <div 
                    key={order.id} 
                    className={`text-[8px] truncate px-1.5 py-0.5 rounded-sm font-bold flex items-center gap-1 text-white ${colorClass}`}
                  >
                    <span>{order.time}</span>
                    <span>{order.clientName}</span>
                  </div>
                );
              })}
              {dayOrders.length > 2 && (
                <div className="text-[8px] text-slate-400 font-bold text-center">
                  +{dayOrders.length - 2} daugiau
                </div>
              )}
            </div>
          </div>
        );
        day = addDays(day, 1);
      }
      rows.push(
        <div className="grid grid-cols-7" key={day.toString()}>
          {days}
        </div>
      );
      days = [];
    }
    return <div className="bg-white rounded-3xl shadow-sm border border-slate-100 overflow-hidden">{rows}</div>;
  };

  const selectedDateString = format(selectedDate, 'yyyy-MM-dd');
  const clientsById = useMemo(() => new Map(clients.map((c) => [c.id, c])), [clients]);
  const selectedOrders = orders
    .filter(o => normalizeOrderDateKey(o.date) === selectedDateString)
    .sort((a, b) => a.time.localeCompare(b.time));
  const filteredSelectedOrders = selectedOrders.filter((order) => {
    if (employeeFilter !== 'all' && (order.employeeId || '') !== employeeFilter) return false;
    if (statusFilter !== 'all' && order.status !== statusFilter) return false;
    if (areaFilter.trim()) {
      const q = areaFilter.trim().toLowerCase();
      if (!(order.address || '').toLowerCase().includes(q)) return false;
    }
    return true;
  });
  const plannedOrders: PlannedOrder[] = filteredSelectedOrders.map((order) => {
    const startMin = toMinutes(order.time);
    const durationMin = estimateOrderDuration(order);
    return {
      order,
      startMin,
      durationMin,
      endMin: startMin + durationMin,
    };
  });

  const conflicts = plannedOrders.slice(1).filter((curr, idx) => {
    const prev = plannedOrders[idx];
    return curr.startMin < prev.endMin;
  });

  const usedMinutes = plannedOrders.reduce((sum, p) => sum + p.durationMin, 0);
  const capacityMinutes = WORK_DAY_END - WORK_DAY_START;
  const loadPercent = Math.min(100, Math.round((usedMinutes / capacityMinutes) * 100));

  const suggestedSlots: string[] = [];
  for (let start = WORK_DAY_START; start <= WORK_DAY_END - DEFAULT_SLOT_DURATION; start += 30) {
    const end = start + DEFAULT_SLOT_DURATION;
    const overlaps = plannedOrders.some((p) => start < p.endMin && p.startMin < end);
    if (!overlaps) suggestedSlots.push(toHHMM(start));
    if (suggestedSlots.length >= 5) break;
  }

  const beginEdit = (order: Order) => {
    setEditingOrderId(order.id);
    setEditForm({
      date: order.date,
      time: order.time,
      status: order.status,
      employeeId: order.employeeId || '',
      notes: order.notes || '',
    });
  };

  const saveEdit = async (order: Order) => {
    setIsSaving(true);
    try {
      await updateData(TABLES.ORDERS, order.id, {
        date: editForm.date,
        time: editForm.time,
        status: editForm.status,
        employeeId: editForm.employeeId,
        notes: editForm.notes,
      } as any);
      setEditingOrderId(null);
      showToast.success('Užsakymas atnaujintas kalendoriuje');
    } catch (e) {
      console.error('Calendar update failed', e);
      showToast.error('Nepavyko atnaujinti užsakymo');
    } finally {
      setIsSaving(false);
    }
  };

  const removeOrder = async (orderId: string) => {
    if (!window.confirm('Ar tikrai norite ištrinti šį užsakymą?')) return;
    setIsDeleting(orderId);
    try {
      await deleteData(TABLES.ORDERS, orderId);
      showToast.success('Užsakymas ištrintas');
      if (editingOrderId === orderId) setEditingOrderId(null);
    } catch (e) {
      console.error('Calendar delete failed', e);
      showToast.error('Nepavyko ištrinti užsakymo');
    } finally {
      setIsDeleting(null);
    }
  };

  const updateOrderStatus = async (order: Order, status: OrderStatus) => {
    if (!allowedStatuses.includes(status)) {
      showToast.error('Nepalaikomas statusas');
      return;
    }
    try {
      await updateData(TABLES.ORDERS, order.id, { status } as any);
      showToast.success(`Statusas pakeistas į "${status}"`);
    } catch (e) {
      console.error('Calendar status update failed', e);
      showToast.error('Nepavyko pakeisti statuso');
    }
  };

  const getPrimaryStatusAction = (status: OrderStatus): { next: OrderStatus | null; label: string; className: string } => {
    if (status === 'suplanuota') {
      return { next: 'vykdoma', label: 'Pradėti darbą', className: 'bg-blue-600 text-white hover:bg-blue-700' };
    }
    if (status === 'vykdoma') {
      return { next: 'atlikta', label: 'Pažymėti atlikta', className: 'bg-emerald-600 text-white hover:bg-emerald-700' };
    }
    return { next: null, label: 'Darbas užbaigtas', className: 'bg-slate-100 text-slate-500 cursor-default' };
  };

  const handleDropSwap = async (targetOrder: Order) => {
    if (!draggedOrderId || draggedOrderId === targetOrder.id) return;
    const sourceOrder = selectedOrders.find((o) => o.id === draggedOrderId);
    if (!sourceOrder) return;
    setIsSaving(true);
    try {
      await updateData(TABLES.ORDERS, sourceOrder.id, { time: targetOrder.time } as any);
      await updateData(TABLES.ORDERS, targetOrder.id, { time: sourceOrder.time } as any);
      showToast.success('Užsakymų laikai sukeisti');
    } catch (e) {
      console.error('Calendar drag/drop swap failed', e);
      showToast.error('Nepavyko sukeisti užsakymų laikų');
    } finally {
      setIsSaving(false);
      setDraggedOrderId(null);
      setDragOverDate(null);
    }
  };

  const handleDropToDate = async (targetDate: string) => {
    if (!draggedOrderId) return;
    const sourceOrder = orders.find((o) => o.id === draggedOrderId);
    if (!sourceOrder || sourceOrder.date === targetDate) return;
    setIsSaving(true);
    try {
      await updateData(TABLES.ORDERS, sourceOrder.id, { date: targetDate } as any);
      showToast.success(`Užsakymas perkeltas į ${targetDate}`);
    } catch (e) {
      console.error('Calendar drag/drop date move failed', e);
      showToast.error('Nepavyko perkelti užsakymo į pasirinktą datą');
    } finally {
      setIsSaving(false);
      setDraggedOrderId(null);
      setDragOverDate(null);
    }
  };

  return (
    <div className="space-y-6 pb-10">
      <div className="flex items-center gap-3 mb-2">
        <div className="w-10 h-10 bg-blue-600 rounded-2xl flex items-center justify-center text-white shadow-lg shadow-blue-200">
          <CalendarIcon size={20} />
        </div>
        <h2 className="text-2xl font-black text-slate-900 tracking-tight">Kalendorius</h2>
      </div>

      <div>
        {renderHeader()}
        {renderDays()}
        {renderCells()}
      </div>

      <div className="mt-8">
        <div className="bg-white p-4 rounded-3xl border border-slate-100 shadow-sm mb-4">
          <div className="flex flex-wrap items-center gap-2 mb-3">
            <span className="text-[10px] font-black uppercase tracking-widest text-slate-500">Išmanus planavimas</span>
            <span className={`text-[10px] font-black uppercase tracking-widest px-2 py-1 rounded-lg ${
              loadPercent >= 85 ? 'bg-rose-50 text-rose-600' : loadPercent >= 60 ? 'bg-amber-50 text-amber-600' : 'bg-emerald-50 text-emerald-600'
            }`}>
              Dienos apkrova {loadPercent}%
            </span>
            <span className="text-[10px] font-black uppercase tracking-widest px-2 py-1 rounded-lg bg-blue-50 text-blue-600">
              Užsakymai {selectedOrders.length}
            </span>
            <span className="text-[10px] font-black uppercase tracking-widest px-2 py-1 rounded-lg bg-slate-100 text-slate-700">
              Filtruota {filteredSelectedOrders.length}
            </span>
          </div>

          {conflicts.length > 0 ? (
            <p className="text-xs text-rose-600 font-semibold">
              Aptikti laiko konfliktai ({conflicts.length}). Peržiūrėkite užsakymų laikus ir perkelkite dalį darbų į kitą valandą.
            </p>
          ) : (
            <p className="text-xs text-emerald-600 font-semibold">
              Laiko konfliktų nerasta. Dienos planas nuoseklus.
            </p>
          )}

          <p className="text-xs text-slate-500 mt-2">
            Siūlomi laisvi laikai naujam užsakymui (apie {DEFAULT_SLOT_DURATION} min):
            {' '}
            {suggestedSlots.length ? suggestedSlots.join(', ') : 'laisvų langų nebeliko'}
          </p>
          {draggedOrderId && (
            <p className="text-xs text-blue-700 font-semibold mt-2">
              Tempimo režimas aktyvus: nutempkite užsakymą ant kitos dienos langelio arba ant kito užsakymo laiko.
            </p>
          )}
        </div>

        <h3 className="text-lg font-bold text-slate-900 mb-4 flex items-center gap-2">
          Darbai: <span className="text-blue-600">{format(selectedDate, 'MMMM d d.', { locale: lt })}</span>
        </h3>
        
        <div className="bg-white p-4 rounded-3xl border border-slate-100 shadow-sm mb-4">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-2">
            <select
              value={employeeFilter}
              onChange={(e) => setEmployeeFilter(e.target.value)}
              title="Filtras pagal darbuotoją"
              className="bg-slate-50 border border-slate-200 rounded-xl p-2 text-xs"
            >
              <option value="all">Visi darbuotojai</option>
              {employees.map((emp) => (
                <option key={emp.id} value={emp.id}>{emp.name}</option>
              ))}
            </select>
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value as OrderStatus | 'all')}
              title="Filtras pagal statusą"
              className="bg-slate-50 border border-slate-200 rounded-xl p-2 text-xs"
            >
              <option value="all">Visi statusai</option>
              <option value="suplanuota">suplanuota</option>
              <option value="vykdoma">vykdoma</option>
              <option value="atlikta">atlikta</option>
            </select>
            <input
              type="text"
              value={areaFilter}
              onChange={(e) => setAreaFilter(e.target.value)}
              title="Filtras pagal adresą arba rajoną"
              placeholder="Filtras pagal adresą / rajoną"
              className="bg-slate-50 border border-slate-200 rounded-xl p-2 text-xs"
            />
          </div>
        </div>

        {filteredSelectedOrders.length > 0 ? (
          <div className="space-y-3">
            {filteredSelectedOrders.map((order) => {
              const employee = employees.find(e => e.id === order.employeeId);
              const client = clientsById.get(order.clientId);
              const displayClientName = (order.clientName || client?.name || '').trim() || 'Klientas nenurodytas';
              const displayAddress = (order.address || client?.address || '').trim() || 'Adresas nenurodytas';
              const displayPhone = (client?.phone || '').trim() || 'nesutarta';
              const isEditing = editingOrderId === order.id;
              
              return (
                <div key={order.id} className="bg-white p-4 rounded-3xl border border-slate-100 shadow-sm hover:border-blue-200 transition-colors">
                  <div className="flex items-center gap-4">
                    <div
                      draggable
                      onDragStart={() => setDraggedOrderId(order.id)}
                      onDragEnd={() => {
                        setDraggedOrderId(null);
                        setDragOverDate(null);
                      }}
                      onDragOver={(e) => e.preventDefault()}
                      onDrop={() => handleDropSwap(order)}
                      className={`w-14 h-14 rounded-2xl flex flex-col items-center justify-center text-slate-600 border shrink-0 cursor-grab active:cursor-grabbing ${
                        draggedOrderId === order.id
                          ? 'bg-blue-100 border-blue-300'
                          : 'bg-slate-50 border-slate-100'
                      }`}
                      title="Tempkite ant kito darbo, kad sukeistumėte laikus"
                    >
                      <span className="text-sm font-black leading-none">{order.time.split(':')[0]}</span>
                      <span className="text-[10px] font-bold opacity-60">{order.time.split(':')[1]}</span>
                    </div>
                    <div className="flex-1 min-w-0">
                      <h4 className="font-bold text-slate-900 text-base truncate">{displayClientName}</h4>
                      <div className="flex items-center gap-1 text-xs text-slate-500 mt-1">
                        <MapPin size={12} className="shrink-0" />
                        <span className="truncate">{displayAddress}</span>
                      </div>
                      <div className="flex items-center gap-3 mt-1">
                        {employee && (
                          <div className="flex items-center gap-1 text-xs font-bold text-slate-600">
                            <Users size={12} style={{ color: employee.color }} />
                            <span>{employee.name}</span>
                          </div>
                        )}
                        <span className="text-xs text-slate-500">
                          Tel.: {displayPhone}
                        </span>
                      </div>
                    </div>
                    <div className="text-right shrink-0">
                      <p className="font-black text-slate-900 text-lg">{formatCurrency(order.totalPrice)}</p>
                      <span className={`text-[10px] font-black uppercase tracking-widest px-2 py-1 rounded-lg mt-1 inline-block ${
                        order.status === 'atlikta' ? 'bg-emerald-50 text-emerald-600' :
                        order.status === 'vykdoma' ? 'bg-blue-50 text-blue-600' : 'bg-amber-50 text-amber-600'
                      }`}>
                        {order.status}
                      </span>
                    </div>
                  </div>

                  <div className="mt-3 flex flex-wrap gap-2">
                    <button
                      type="button"
                      onClick={() => beginEdit(order)}
                      className="px-3 py-1.5 rounded-xl text-xs font-bold bg-slate-100 text-slate-700 hover:bg-slate-200"
                    >
                      Redaguoti
                    </button>
                    <button
                      type="button"
                      onClick={() => removeOrder(order.id)}
                      disabled={isDeleting === order.id}
                      className="px-3 py-1.5 rounded-xl text-xs font-bold bg-rose-50 text-rose-700 hover:bg-rose-100 disabled:opacity-60 inline-flex items-center gap-1"
                    >
                      <Trash2 size={12} />
                      {isDeleting === order.id ? 'Trinama...' : 'Ištrinti'}
                    </button>
                  </div>

                  {isEditing && (
                    <div className="mt-3 p-3 rounded-2xl border border-blue-100 bg-blue-50/40">
                      <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
                        <input
                          type="date"
                          value={editForm.date}
                          onChange={(e) => setEditForm((p) => ({ ...p, date: e.target.value }))}
                          title="Užsakymo data"
                          className="bg-white border border-slate-200 rounded-xl p-2 text-xs"
                        />
                        <input
                          type="time"
                          value={editForm.time}
                          onChange={(e) => setEditForm((p) => ({ ...p, time: e.target.value }))}
                          title="Užsakymo laikas"
                          className="bg-white border border-slate-200 rounded-xl p-2 text-xs"
                        />
                        <select
                          value={editForm.status}
                          onChange={(e) => setEditForm((p) => ({ ...p, status: e.target.value as OrderStatus }))}
                          title="Užsakymo statusas"
                          className="bg-white border border-slate-200 rounded-xl p-2 text-xs"
                        >
                          <option value="suplanuota">suplanuota</option>
                          <option value="vykdoma">vykdoma</option>
                          <option value="atlikta">atlikta</option>
                          <option value="atšaukta">atšaukta</option>
                        </select>
                        <select
                          value={editForm.employeeId}
                          onChange={(e) => setEditForm((p) => ({ ...p, employeeId: e.target.value }))}
                          title="Priskirtas darbuotojas"
                          className="bg-white border border-slate-200 rounded-xl p-2 text-xs"
                        >
                          <option value="">Be darbuotojo</option>
                          {employees.map((emp) => (
                            <option key={emp.id} value={emp.id}>{emp.name}</option>
                          ))}
                        </select>
                      </div>
                      <textarea
                        rows={2}
                        value={editForm.notes}
                        onChange={(e) => setEditForm((p) => ({ ...p, notes: e.target.value }))}
                        className="w-full mt-2 bg-white border border-slate-200 rounded-xl p-2 text-xs"
                        placeholder="Pastabos"
                      />
                      <div className="flex gap-2 mt-2">
                        <button
                          type="button"
                          disabled={isSaving}
                          onClick={() => saveEdit(order)}
                          className="px-3 py-1.5 rounded-xl text-xs font-bold bg-blue-600 text-white hover:bg-blue-700 disabled:opacity-60 inline-flex items-center gap-1"
                        >
                          <Save size={12} />
                          {isSaving ? 'Saugoma...' : 'Išsaugoti'}
                        </button>
                        <button
                          type="button"
                          onClick={() => setEditingOrderId(null)}
                          className="px-3 py-1.5 rounded-xl text-xs font-bold bg-white border border-slate-200 text-slate-700"
                        >
                          Atšaukti
                        </button>
                      </div>
                    </div>
                  )}
                  <div className="mt-2 text-[11px] text-slate-500">
                    Kliento valdymui spauskite klientų skiltį, užsakymo redagavimui galite naudoti kalendorių arba užsakymų sąrašą.
                  </div>
                </div>
              );
            })}
          </div>
        ) : (
          <div className="bg-white p-10 rounded-3xl border border-dashed border-slate-200 text-center">
            <Clock size={32} className="text-slate-200 mx-auto mb-3" />
            <p className="text-slate-400 text-sm font-medium italic">Šią dieną suplanuotų darbų nėra</p>
          </div>
        )}
      </div>

      {isDayDetailsOpen && (
        <div className="fixed inset-0 z-50 bg-black/40 p-4 flex items-center justify-center">
          <div className="w-full max-w-4xl max-h-[90vh] overflow-y-auto bg-white rounded-3xl border border-slate-100 shadow-xl p-5">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-black text-slate-900">
                Dienos detalės: {format(selectedDate, 'yyyy-MM-dd (EEEE)', { locale: lt })}
              </h3>
              <button
                type="button"
                onClick={() => setIsDayDetailsOpen(false)}
                title="Uždaryti dienos detales"
                className="p-2 rounded-xl hover:bg-slate-100 text-slate-500"
              >
                <X size={18} />
              </button>
            </div>

        {filteredSelectedOrders.length === 0 ? (
              <div className="bg-slate-50 rounded-2xl p-6 text-center text-slate-500 text-sm">
                Pagal pasirinktus filtrus užsakymų nėra.
              </div>
            ) : (
              <div className="space-y-3">
                {filteredSelectedOrders.map((order) => {
                  const employee = employees.find(e => e.id === order.employeeId);
                  const client = clientsById.get(order.clientId);
                  const displayClientName = (order.clientName || client?.name || '').trim() || 'Klientas nenurodytas';
                  const displayAddress = (order.address || client?.address || '').trim() || 'Adresas nenurodytas';
                  const displayPhone = (client?.phone || '').trim() || 'nesutarta';
                  const isEditing = editingOrderId === order.id;

                  return (
                    <div key={`modal-${order.id}`} className="border border-slate-100 rounded-2xl p-4">
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <div>
                          <p className="font-bold text-slate-900">{displayClientName}</p>
                          <p className="text-xs text-slate-500">{displayAddress}</p>
                          <p className="text-xs text-slate-500">Tel.: {displayPhone}</p>
                        </div>
                        <div className="text-right">
                          <p
                            draggable
                            onDragStart={() => setDraggedOrderId(order.id)}
                            onDragEnd={() => {
                              setDraggedOrderId(null);
                              setDragOverDate(null);
                            }}
                            onDragOver={(e) => e.preventDefault()}
                            onDrop={() => handleDropSwap(order)}
                            className={`font-black ${draggedOrderId === order.id ? 'text-blue-600' : 'text-slate-900'} cursor-grab active:cursor-grabbing`}
                            title="Tempkite ant kito laiko, kad sukeistumėte"
                          >
                            {order.time}
                          </p>
                          <p className="text-xs text-slate-500">{formatCurrency(order.totalPrice)}</p>
                        </div>
                      </div>

                      <div className="mt-3 grid grid-cols-1 md:grid-cols-[1fr_auto] gap-2">
                        <div className="flex items-center gap-2 text-xs">
                          <span className={`px-2 py-1 rounded-lg font-semibold ${
                            order.status === 'atlikta'
                              ? 'bg-emerald-50 text-emerald-700'
                              : order.status === 'vykdoma'
                                ? 'bg-blue-50 text-blue-700'
                                : 'bg-amber-50 text-amber-700'
                          }`}>
                            Statusas: {order.status}
                          </span>
                          <span className="px-2 py-1 rounded-lg bg-slate-100 text-slate-700">
                            Darbuotojas: {employee?.name || 'nepriskirtas'}
                          </span>
                        </div>
                        <div className="flex flex-wrap items-center gap-2 text-xs">
                          {(() => {
                            const action = getPrimaryStatusAction(order.status);
                            return (
                              <button
                                type="button"
                                disabled={!action.next}
                                onClick={() => action.next && updateOrderStatus(order, action.next)}
                                className={`px-3 py-1.5 rounded-lg font-semibold transition-colors ${action.className}`}
                              >
                                {action.label}
                              </button>
                            );
                          })()}
                          <button type="button" onClick={() => beginEdit(order)} className="px-3 py-1.5 rounded-lg bg-slate-100 text-slate-700 font-semibold hover:bg-slate-200">
                            Redaguoti
                          </button>
                        </div>
                      </div>

                      <div className="mt-2 flex flex-wrap items-center gap-2 text-xs">
                        <button
                          type="button"
                          onClick={() => {
                            localStorage.setItem('selected_client_id', order.clientId);
                            onOpenClient?.(order.clientId);
                            setIsDayDetailsOpen(false);
                          }}
                          className="px-2 py-1 rounded-lg bg-indigo-50 text-indigo-700 font-semibold"
                        >
                          Kliento kortelė
                        </button>
                        <button type="button" onClick={() => removeOrder(order.id)} className="px-2 py-1 rounded-lg bg-rose-50 text-rose-700 font-semibold">
                          {isDeleting === order.id ? 'Trinama...' : 'Ištrinti'}
                        </button>
                      </div>

                      {isEditing && (
                        <div className="mt-3 p-3 rounded-2xl border border-blue-100 bg-blue-50/40">
                          <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
                            <input type="date" value={editForm.date} onChange={(e) => setEditForm((p) => ({ ...p, date: e.target.value }))} title="Užsakymo data" className="bg-white border border-slate-200 rounded-xl p-2 text-xs" />
                            <input type="time" value={editForm.time} onChange={(e) => setEditForm((p) => ({ ...p, time: e.target.value }))} title="Užsakymo laikas" className="bg-white border border-slate-200 rounded-xl p-2 text-xs" />
                            <select value={editForm.status} onChange={(e) => setEditForm((p) => ({ ...p, status: e.target.value as OrderStatus }))} title="Užsakymo statusas" className="bg-white border border-slate-200 rounded-xl p-2 text-xs">
                              <option value="suplanuota">suplanuota</option>
                              <option value="vykdoma">vykdoma</option>
                              <option value="atlikta">atlikta</option>
                            </select>
                            <select value={editForm.employeeId} onChange={(e) => setEditForm((p) => ({ ...p, employeeId: e.target.value }))} title="Priskirtas darbuotojas" className="bg-white border border-slate-200 rounded-xl p-2 text-xs">
                              <option value="">Be darbuotojo</option>
                              {employees.map((emp) => <option key={`modal-emp-${emp.id}`} value={emp.id}>{emp.name}</option>)}
                            </select>
                          </div>
                          <textarea rows={2} value={editForm.notes} onChange={(e) => setEditForm((p) => ({ ...p, notes: e.target.value }))} className="w-full mt-2 bg-white border border-slate-200 rounded-xl p-2 text-xs" placeholder="Pastabos" />
                          <div className="flex gap-2 mt-2">
                            <button type="button" disabled={isSaving} onClick={() => saveEdit(order)} className="px-3 py-1.5 rounded-xl text-xs font-bold bg-blue-600 text-white hover:bg-blue-700 disabled:opacity-60 inline-flex items-center gap-1">
                              <Save size={12} />
                              {isSaving ? 'Saugoma...' : 'Išsaugoti'}
                            </button>
                            <button type="button" onClick={() => setEditingOrderId(null)} className="px-3 py-1.5 rounded-xl text-xs font-bold bg-white border border-slate-200 text-slate-700">
                              Atšaukti
                            </button>
                          </div>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
