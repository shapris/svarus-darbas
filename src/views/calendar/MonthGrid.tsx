import React from 'react';
import type { Order, Employee } from '../../types';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import {
  format,
  startOfMonth,
  endOfMonth,
  startOfWeek,
  endOfWeek,
  isSameMonth,
  isSameDay,
  addDays,
} from 'date-fns';
import { lt } from 'date-fns/locale';
import { EMPLOYEE_COLOR_CLASS, normalizeOrderDateKey } from './calendarUtils';

export interface MonthGridProps {
  currentMonth: Date;
  onPrevMonth: () => void;
  onNextMonth: () => void;
  selectedDate: Date;
  onSelectDay: (day: Date) => void;
  orders: Order[];
  employees: Employee[];
  draggedOrderId: string | null;
  dragOverDate: string | null;
  onDragEnterDate: (dateKey: string) => void;
  onDragOver: (e: React.DragEvent) => void;
  onDropOnDate: (dateKey: string) => void;
}

export function MonthGrid({
  currentMonth,
  onPrevMonth,
  onNextMonth,
  selectedDate,
  onSelectDay,
  orders,
  employees,
  draggedOrderId,
  dragOverDate,
  onDragEnterDate,
  onDragOver,
  onDropOnDate,
}: MonthGridProps) {
  const monthStart = startOfMonth(currentMonth);
  const monthEnd = endOfMonth(monthStart);
  const gridStart = startOfWeek(monthStart, { weekStartsOn: 1 });
  const gridEnd = endOfWeek(monthEnd, { weekStartsOn: 1 });
  const dateFormat = 'yyyy-MM-dd';

  const rows: React.ReactNode[] = [];
  let days: React.ReactNode[] = [];
  let day = gridStart;

  while (day <= gridEnd) {
    for (let i = 0; i < 7; i++) {
      const formattedDate = format(day, dateFormat);
      const cloneDay = day;
      const dayOrders = orders.filter((o) => normalizeOrderDateKey(o.date) === formattedDate);

      days.push(
        <div
          key={day.toString()}
          onClick={() => onSelectDay(cloneDay)}
          onDragEnter={() => {
            if (draggedOrderId) onDragEnterDate(formattedDate);
          }}
          onDragOver={onDragOver}
          onDrop={() => {
            onDropOnDate(formattedDate);
          }}
          className={`min-h-[80px] p-1 border border-slate-50 transition-all cursor-pointer relative ${
            !isSameMonth(day, monthStart)
              ? 'bg-slate-50/50 text-slate-300'
              : isSameDay(day, selectedDate)
                ? 'bg-blue-50 border-blue-200 text-blue-700'
                : 'bg-white text-slate-700 hover:bg-slate-50'
          } ${isSameDay(day, new Date()) ? 'font-black' : 'font-medium'} ${
            dragOverDate === formattedDate ? 'ring-2 ring-blue-300 bg-blue-50/70' : ''
          }`}
        >
          <span
            className={`text-xs p-1.5 flex items-center justify-center w-6 h-6 rounded-full ${isSameDay(day, new Date()) ? 'bg-blue-600 text-white' : ''}`}
          >
            {format(day, 'd')}
          </span>

          <div className="mt-1 flex flex-col gap-1 px-1">
            {dayOrders.slice(0, 2).map((order) => {
              const employee = employees.find((e) => e.id === order.employeeId);
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

  const weekdayRowStart = startOfWeek(currentMonth, { weekStartsOn: 1 });
  const weekdayCells = [];
  for (let i = 0; i < 7; i++) {
    weekdayCells.push(
      <div
        key={i}
        className="text-center font-bold text-[10px] text-slate-400 uppercase tracking-widest py-2"
      >
        {format(addDays(weekdayRowStart, i), 'EEEEEE', { locale: lt })}
      </div>
    );
  }

  return (
    <div>
      <div className="flex justify-between items-center mb-6 bg-white p-4 rounded-3xl shadow-sm border border-slate-100">
        <button
          type="button"
          onClick={onPrevMonth}
          title="Ankstesnis mėnuo"
          className="p-2 hover:bg-slate-50 rounded-full transition-colors"
        >
          <ChevronLeft size={20} className="text-slate-600" />
        </button>
        <h2 className="text-lg font-black text-slate-900 capitalize tracking-wide">
          {format(currentMonth, 'MMMM yyyy', { locale: lt })}
        </h2>
        <button
          type="button"
          onClick={onNextMonth}
          title="Kitas mėnuo"
          className="p-2 hover:bg-slate-50 rounded-full transition-colors"
        >
          <ChevronRight size={20} className="text-slate-600" />
        </button>
      </div>

      <div className="grid grid-cols-7 mb-2">{weekdayCells}</div>

      <div className="bg-white rounded-3xl shadow-sm border border-slate-100 overflow-hidden">
        {rows}
      </div>
    </div>
  );
}
