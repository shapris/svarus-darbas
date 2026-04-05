import React from 'react';
import type { Order, Employee, Client, OrderStatus } from '../../types';
import { formatCurrency } from '../../utils';
import { Save, X } from 'lucide-react';
import { format } from 'date-fns';
import { lt } from 'date-fns/locale';

export interface DayDetailsModalProps {
  open: boolean;
  onClose: () => void;
  selectedDate: Date;
  filteredSelectedOrders: Order[];
  clientsById: Map<string, Client>;
  employees: Employee[];
  editingOrderId: string | null;
  editForm: {
    date: string;
    time: string;
    status: OrderStatus;
    employeeId: string;
    notes: string;
  };
  setEditForm: React.Dispatch<
    React.SetStateAction<{
      date: string;
      time: string;
      status: OrderStatus;
      employeeId: string;
      notes: string;
    }>
  >;
  beginEdit: (order: Order) => void;
  saveEdit: (order: Order) => void;
  removeOrder: (orderId: string) => void;
  updateOrderStatus: (order: Order, status: OrderStatus) => void;
  getPrimaryStatusAction: (
    status: OrderStatus
  ) => { next: OrderStatus | null; label: string; className: string };
  isSaving: boolean;
  isDeleting: string | null;
  draggedOrderId: string | null;
  setDraggedOrderId: (id: string | null) => void;
  setDragOverDate: (d: string | null) => void;
  handleDropSwap: (targetOrder: Order) => void;
  onCancelEdit: () => void;
  onOpenClient?: (clientId: string) => void;
}

export function DayDetailsModal({
  open,
  onClose,
  selectedDate,
  filteredSelectedOrders,
  clientsById,
  employees,
  editingOrderId,
  editForm,
  setEditForm,
  beginEdit,
  saveEdit,
  removeOrder,
  updateOrderStatus,
  getPrimaryStatusAction,
  isSaving,
  isDeleting,
  draggedOrderId,
  setDraggedOrderId,
  setDragOverDate,
  handleDropSwap,
  onCancelEdit,
  onOpenClient,
}: DayDetailsModalProps) {
  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 bg-black/40 p-4 flex items-center justify-center">
      <div className="w-full max-w-4xl max-h-[90vh] overflow-y-auto bg-white rounded-3xl border border-slate-100 shadow-xl p-5">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-black text-slate-900">
            Dienos detalės: {format(selectedDate, 'yyyy-MM-dd (EEEE)', { locale: lt })}
          </h3>
          <button
            type="button"
            onClick={onClose}
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
              const employee = employees.find((e) => e.id === order.employeeId);
              const client = clientsById.get(order.clientId);
              const displayClientName =
                (order.clientName || client?.name || '').trim() || 'Klientas nenurodytas';
              const displayAddress =
                (order.address || client?.address || '').trim() || 'Adresas nenurodytas';
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
                      <span
                        className={`px-2 py-1 rounded-lg font-semibold ${
                          order.status === 'atlikta'
                            ? 'bg-emerald-50 text-emerald-700'
                            : order.status === 'vykdoma'
                              ? 'bg-blue-50 text-blue-700'
                              : 'bg-amber-50 text-amber-700'
                        }`}
                      >
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
                      <button
                        type="button"
                        onClick={() => beginEdit(order)}
                        className="px-3 py-1.5 rounded-lg bg-slate-100 text-slate-700 font-semibold hover:bg-slate-200"
                      >
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
                        onClose();
                      }}
                      className="px-2 py-1 rounded-lg bg-indigo-50 text-indigo-700 font-semibold"
                    >
                      Kliento kortelė
                    </button>
                    <button
                      type="button"
                      onClick={() => removeOrder(order.id)}
                      className="px-2 py-1 rounded-lg bg-rose-50 text-rose-700 font-semibold"
                    >
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
                          onChange={(e) =>
                            setEditForm((p) => ({
                              ...p,
                              status: e.target.value as OrderStatus,
                            }))
                          }
                          title="Užsakymo statusas"
                          className="bg-white border border-slate-200 rounded-xl p-2 text-xs"
                        >
                          <option value="suplanuota">suplanuota</option>
                          <option value="vykdoma">vykdoma</option>
                          <option value="atlikta">atlikta</option>
                        </select>
                        <select
                          value={editForm.employeeId}
                          onChange={(e) =>
                            setEditForm((p) => ({ ...p, employeeId: e.target.value }))
                          }
                          title="Priskirtas darbuotojas"
                          className="bg-white border border-slate-200 rounded-xl p-2 text-xs"
                        >
                          <option value="">Be darbuotojo</option>
                          {employees.map((emp) => (
                            <option key={`modal-emp-${emp.id}`} value={emp.id}>
                              {emp.name}
                            </option>
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
                          onClick={onCancelEdit}
                          className="px-3 py-1.5 rounded-xl text-xs font-bold bg-white border border-slate-200 text-slate-700"
                        >
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
  );
}
