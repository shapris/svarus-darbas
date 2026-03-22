/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from 'react';
import { Order, Employee } from '../types';
import { formatCurrency } from '../utils';
import { Calendar as CalendarIcon, MapPin, ChevronLeft, ChevronRight, Clock, Users } from 'lucide-react';
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
}

export default function CalendarView({ orders, employees }: CalendarViewProps) {
  const [currentMonth, setCurrentMonth] = useState(new Date());
  const [selectedDate, setSelectedDate] = useState(new Date());

  const nextMonth = () => setCurrentMonth(addMonths(currentMonth, 1));
  const prevMonth = () => setCurrentMonth(subMonths(currentMonth, 1));
  const onDateClick = (day: Date) => setSelectedDate(day);

  const renderHeader = () => {
    return (
      <div className="flex justify-between items-center mb-6 bg-white p-4 rounded-3xl shadow-sm border border-slate-100">
        <button onClick={prevMonth} className="p-2 hover:bg-slate-50 rounded-full transition-colors">
          <ChevronLeft size={20} className="text-slate-600" />
        </button>
        <h2 className="text-lg font-black text-slate-900 capitalize tracking-wide">
          {format(currentMonth, 'MMMM yyyy', { locale: lt })}
        </h2>
        <button onClick={nextMonth} className="p-2 hover:bg-slate-50 rounded-full transition-colors">
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
        const dayOrders = orders.filter(o => o.date === formattedDate);
        
        days.push(
          <div
            key={day.toString()}
            onClick={() => onDateClick(cloneDay)}
            className={`min-h-[80px] p-1 border border-slate-50 transition-all cursor-pointer relative ${
              !isSameMonth(day, monthStart)
                ? "bg-slate-50/50 text-slate-300"
                : isSameDay(day, selectedDate)
                ? "bg-blue-50 border-blue-200 text-blue-700"
                : "bg-white text-slate-700 hover:bg-slate-50"
            } ${isSameDay(day, new Date()) ? "font-black" : "font-medium"}`}
          >
            <span className={`text-xs p-1.5 flex items-center justify-center w-6 h-6 rounded-full ${isSameDay(day, new Date()) ? 'bg-blue-600 text-white' : ''}`}>
              {format(day, 'd')}
            </span>
            
            <div className="mt-1 flex flex-col gap-1 px-1">
              {dayOrders.slice(0, 2).map(order => {
                const employee = employees.find(e => e.id === order.employeeId);
                const employeeColor = employee?.color || '#94a3b8'; // default slate-400
                
                return (
                  <div 
                    key={order.id} 
                    className="text-[8px] truncate px-1.5 py-0.5 rounded-sm font-bold flex items-center gap-1 text-white"
                    style={{ backgroundColor: employeeColor }}
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
  const selectedOrders = orders
    .filter(o => o.date === selectedDateString)
    .sort((a, b) => a.time.localeCompare(b.time));

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
        <h3 className="text-lg font-bold text-slate-900 mb-4 flex items-center gap-2">
          Darbai: <span className="text-blue-600">{format(selectedDate, 'MMMM d d.', { locale: lt })}</span>
        </h3>
        
        {selectedOrders.length > 0 ? (
          <div className="space-y-3">
            {selectedOrders.map((order) => {
              const employee = employees.find(e => e.id === order.employeeId);
              
              return (
                <div key={order.id} className="bg-white p-4 rounded-3xl border border-slate-100 shadow-sm flex items-center gap-4 hover:border-blue-200 transition-colors">
                  <div className="w-14 h-14 bg-slate-50 rounded-2xl flex flex-col items-center justify-center text-slate-600 border border-slate-100 shrink-0">
                    <span className="text-sm font-black leading-none">{order.time.split(':')[0]}</span>
                    <span className="text-[10px] font-bold opacity-60">{order.time.split(':')[1]}</span>
                  </div>
                  <div className="flex-1 min-w-0">
                    <h4 className="font-bold text-slate-900 text-base truncate">{order.clientName}</h4>
                    <div className="flex items-center gap-1 text-xs text-slate-500 mt-1">
                      <MapPin size={12} className="shrink-0" />
                      <span className="truncate">{order.address}</span>
                    </div>
                    {employee && (
                      <div className="flex items-center gap-1 text-xs font-bold text-slate-600 mt-1">
                        <Users size={12} style={{ color: employee.color }} />
                        <span>{employee.name}</span>
                      </div>
                    )}
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
    </div>
  );
}
