/**
 * Vieno užsakymo kortelė sąraše (OrdersView).
 */

import React from 'react';
import { motion } from 'motion/react';
import {
  Calendar,
  Clock,
  MapPin,
  CheckCircle2,
  MoreVertical,
  Plus,
  Camera,
  MessageSquare,
  Star,
  Users,
  Download,
  Mail,
  Image as ImageIcon,
  Loader2,
} from 'lucide-react';
import type { Order, Client, Employee, OrderStatus } from '../../types';
import { formatCurrency, formatDate, formatDuration, looksLikeValidEmail } from '../../utils';
import { ORDER_STATUS_LABEL_LT } from './orderConstants';

export interface OrderListCardProps {
  order: Order;
  employees: Employee[];
  isRestrictedStaff: boolean;
  selectedOrderIds: string[];
  actionsMenuOrderId: string | null;
  assigningOrderId: string | null;
  statusUpdatingOrderId: string | null;
  isDeleting: string | null;
  isUploading: string | null;
  invoiceActionOrderId: string | null;
  invoiceEmailSentOrderId: string | null;
  resolveOrderClientName: (o: Order) => string;
  orderDisplayAddress: (o: Order) => string;
  resolveClientForOrder: (o: Order) => Client | undefined;
  onToggleSelect: (orderId: string) => void;
  onOpenActionsMenu: (orderId: string | null) => void;
  onStartEdit: (order: Order) => void;
  onDelete: (id: string) => void;
  onQuickAssign: (order: Order, employeeId: string) => void;
  onStatusUpdate: (order: Order, status: OrderStatus) => void;
  onRequestFeedback: (order: Order) => void;
  onSendSms: (order: Order) => void;
  onGenerateInvoice: (order: Order) => void;
  onSendInvoiceByEmail: (order: Order) => void;
  onPhotoUpload: (order: Order, type: 'before' | 'after', file: File) => void;
}

export function OrderListCard({
  order,
  employees,
  isRestrictedStaff,
  selectedOrderIds,
  actionsMenuOrderId,
  assigningOrderId,
  statusUpdatingOrderId,
  isDeleting,
  isUploading,
  invoiceActionOrderId,
  invoiceEmailSentOrderId,
  resolveOrderClientName,
  orderDisplayAddress,
  resolveClientForOrder,
  onToggleSelect,
  onOpenActionsMenu,
  onStartEdit,
  onDelete,
  onQuickAssign,
  onStatusUpdate,
  onRequestFeedback,
  onSendSms,
  onGenerateInvoice,
  onSendInvoiceByEmail,
  onPhotoUpload,
}: OrderListCardProps) {
  return (
    <motion.div
      layout
      className="bg-white rounded-3xl border border-slate-100 shadow-sm overflow-hidden"
    >
      <div className="p-4 border-b border-slate-50 flex justify-between items-center bg-slate-50/50">
        <div className="flex items-center gap-2">
          <input
            type="checkbox"
            checked={selectedOrderIds.includes(order.id)}
            onChange={() => onToggleSelect(order.id)}
            className="w-4 h-4 rounded border-slate-300 text-blue-600 focus:ring-blue-500"
            aria-label={`Pažymėti užsakymą ${resolveOrderClientName(order) || 'užsakymą'}`}
          />
          <Calendar size={14} className="text-blue-600" />
          <span className="text-xs font-bold text-slate-700">{formatDate(order.date)}</span>
          <Clock size={14} className="text-blue-600 ml-2" />
          <span className="text-xs font-bold text-slate-700">{order.time}</span>
          {order.estimatedDuration && (
            <>
              <span className="text-slate-300 mx-2">•</span>
              <span className="text-xs font-bold text-slate-500">
                ~{formatDuration(order.estimatedDuration)}
              </span>
            </>
          )}
          {order.employeeId && (
            <>
              <span className="text-slate-300 mx-2">•</span>
              <div className="flex items-center gap-1 text-xs font-bold text-slate-600">
                <Users size={12} className="text-blue-500" />
                {employees.find((e) => e.id === order.employeeId)?.name || 'Nežinomas'}
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
          <div
            className={`px-2 py-1 rounded-full text-[10px] font-bold tracking-wider ${
              order.status === 'atlikta'
                ? 'bg-emerald-50 text-emerald-600'
                : order.status === 'vykdoma'
                  ? 'bg-blue-50 text-blue-600'
                  : 'bg-amber-50 text-amber-600'
            }`}
          >
            {ORDER_STATUS_LABEL_LT[order.status]}
          </div>
          <div className="relative">
            <button
              type="button"
              title="Užsakymo veiksmai"
              aria-label={`Užsakymo veiksmai: ${resolveOrderClientName(order) || 'užsakymas'}`}
              onClick={(e) => {
                e.stopPropagation();
                onOpenActionsMenu(actionsMenuOrderId === order.id ? null : order.id);
              }}
              className="p-2 text-slate-400 hover:text-slate-600 rounded-lg hover:bg-slate-100 min-w-[40px] min-h-[40px] flex items-center justify-center"
            >
              <MoreVertical size={18} aria-hidden />
            </button>
            {actionsMenuOrderId === order.id && (
              <div
                role="menu"
                className="absolute right-0 top-full mt-1 bg-white border border-slate-100 rounded-xl shadow-xl z-20 min-w-[160px] overflow-hidden"
                onClick={(e) => e.stopPropagation()}
              >
                <button
                  type="button"
                  role="menuitem"
                  onClick={() => {
                    onStartEdit(order);
                    onOpenActionsMenu(null);
                  }}
                  className="w-full text-left px-4 py-3 text-xs font-bold text-slate-700 hover:bg-slate-50"
                >
                  Redaguoti užsakymą
                </button>
                {!isRestrictedStaff && (
                  <button
                    type="button"
                    role="menuitem"
                    disabled={isDeleting === order.id}
                    onClick={() => {
                      onDelete(order.id);
                      onOpenActionsMenu(null);
                    }}
                    className="w-full text-left px-4 py-3 text-xs font-bold text-red-600 hover:bg-red-50 disabled:opacity-50 disabled:pointer-events-none"
                  >
                    {isDeleting === order.id ? 'Trinama…' : 'Ištrinti'}
                  </button>
                )}
              </div>
            )}
          </div>
        </div>
      </div>

      <div className="p-4">
        <div className="flex justify-between items-start mb-4">
          <div>
            <h3 className="font-bold text-slate-900 text-lg">
              {resolveOrderClientName(order) || 'Klientas nenurodytas'}
            </h3>
            <div className="flex items-start gap-1 text-xs text-slate-500 mt-1 min-w-0">
              <MapPin size={12} className="shrink-0 mt-0.5" aria-hidden />
              <span className="break-words">
                {orderDisplayAddress(order) || (
                  <span className="text-amber-700 font-medium">
                    Adresas neįvestas — atidarykite ⋮ → Redaguoti
                  </span>
                )}
              </span>
            </div>
          </div>
          <div className="text-right">
            <p className="text-xl font-black text-slate-900">
              {isRestrictedStaff ? '—' : formatCurrency(order.totalPrice)}
            </p>
            <p className="text-[10px] text-slate-400 font-bold uppercase">{order.windowCount} langai</p>
          </div>
        </div>

        <div className="mt-4 flex flex-col gap-2">
          <div className="flex gap-2 items-stretch min-w-0">
            <div className="min-w-0 flex-1">
              <select
                value={order.employeeId || ''}
                onChange={(e) => onQuickAssign(order, e.target.value)}
                disabled={assigningOrderId === order.id}
                title="Greitas darbuotojo priskyrimas"
                aria-label={`Greitas darbuotojo priskyrimas užsakymui ${resolveOrderClientName(order) || '—'}`}
                className="w-full bg-slate-50 border border-slate-100 rounded-xl py-2.5 px-2 text-xs font-semibold text-slate-700 focus:outline-none focus:ring-2 focus:ring-blue-500/20 disabled:opacity-60 min-h-[44px]"
              >
                <option value="">Nepriskirtas</option>
                {employees
                  .filter((e) => e.isActive)
                  .map((emp) => (
                    <option key={emp.id} value={emp.id}>
                      {emp.name}
                    </option>
                  ))}
              </select>
            </div>
            {order.status !== 'atlikta' && (
              <button
                type="button"
                disabled={statusUpdatingOrderId === order.id}
                onClick={() =>
                  onStatusUpdate(order, order.status === 'suplanuota' ? 'vykdoma' : 'atlikta')
                }
                title={
                  order.status === 'suplanuota'
                    ? 'Pažymėti užsakymą kaip vykdomą'
                    : 'Pažymėti užsakymą kaip atliktą'
                }
                aria-label={order.status === 'suplanuota' ? 'Pradėti užsakymą' : 'Užbaigti užsakymą'}
                className="min-w-[6.5rem] shrink-0 bg-blue-600 text-white py-2.5 px-2 rounded-xl text-xs font-bold flex items-center justify-center gap-1.5 disabled:opacity-60 disabled:cursor-not-allowed min-h-[44px]"
              >
                {statusUpdatingOrderId === order.id ? (
                  <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
                ) : (
                  <CheckCircle2 size={16} aria-hidden />
                )}
                {order.status === 'suplanuota' ? 'Pradėti' : 'Baigti'}
              </button>
            )}
            {order.status === 'atlikta' && (
              <button
                type="button"
                onClick={() => onRequestFeedback(order)}
                className="bg-amber-50 text-amber-500 p-2.5 rounded-xl hover:bg-amber-100 transition-colors shrink-0 min-h-[44px] min-w-[44px] flex items-center justify-center"
                title="Prašyti atsiliepimo (SMS)"
                aria-label="Prašyti atsiliepimo SMS"
              >
                <Star size={16} aria-hidden />
              </button>
            )}
            <button
              type="button"
              onClick={() => onSendSms(order)}
              title="Siųsti SMS priminimą"
              aria-label="Siųsti SMS priminimą"
              className="bg-slate-50 text-slate-400 p-2.5 rounded-xl hover:bg-slate-100 hover:text-blue-600 transition-colors shrink-0 min-h-[44px] min-w-[44px] flex items-center justify-center"
            >
              <MessageSquare size={16} aria-hidden />
            </button>
          </div>
          {order.status === 'atlikta' && !isRestrictedStaff && (
            <div className="grid grid-cols-2 gap-2 w-full min-w-0">
              <button
                type="button"
                disabled={invoiceActionOrderId === order.id}
                onClick={() => onGenerateInvoice(order)}
                className="bg-slate-900 text-white py-2.5 px-2 rounded-xl text-xs font-bold flex items-center justify-center gap-1.5 min-h-[44px] touch-manipulation disabled:opacity-70 disabled:cursor-wait"
                title="PDF sąskaita: jei Nustatymuose sukonfigūruotas serveris ir Resend – išsiunčiama automatiškai; kitaip atsisiuntimas ir el. paštas / SMS"
                aria-label="Sąskaita PDF"
              >
                {invoiceActionOrderId === order.id ? (
                  <Loader2 className="h-4 w-4 shrink-0 animate-spin" aria-hidden />
                ) : (
                  <Download size={16} aria-hidden />
                )}
                {invoiceActionOrderId === order.id ? 'Ruošiama…' : 'Sąskaita'}
              </button>
              <button
                type="button"
                disabled={invoiceActionOrderId === order.id}
                onClick={() => onSendInvoiceByEmail(order)}
                className={`py-2.5 px-2 rounded-xl text-xs font-bold flex items-center justify-center gap-1.5 border-2 min-h-[44px] touch-manipulation disabled:cursor-wait ${
                  invoiceEmailSentOrderId === order.id
                    ? 'border-emerald-600 text-emerald-800 bg-emerald-50'
                    : looksLikeValidEmail((resolveClientForOrder(order)?.email ?? '').trim())
                      ? 'border-slate-900 text-slate-900 bg-white hover:bg-slate-50 disabled:opacity-70'
                      : 'border-dashed border-amber-400 text-amber-900 bg-amber-50/80 hover:bg-amber-50 disabled:opacity-70'
                }`}
                title="Geltona: nėra tinkamo el. pašto šiam užsakymui (blogas susiejimas arba trūksta adreso kliento kortelėje). Su Resend — automatiškai; kitaip PDF + mailto."
                aria-label="Siųsti sąskaitą kliento el. paštu"
              >
                {invoiceActionOrderId === order.id ? (
                  <Loader2 className="h-4 w-4 shrink-0 animate-spin" aria-hidden />
                ) : invoiceEmailSentOrderId === order.id ? (
                  <CheckCircle2 size={16} className="text-emerald-600 shrink-0" aria-hidden />
                ) : (
                  <Mail size={16} aria-hidden />
                )}
                {invoiceActionOrderId === order.id
                  ? 'Siunčiama…'
                  : invoiceEmailSentOrderId === order.id
                    ? 'Išsiųsta'
                    : 'El. paštas'}
              </button>
            </div>
          )}
        </div>

        <div className="mt-6 pt-6 border-t border-slate-50">
          <div className="flex items-center gap-2 mb-4">
            <Camera size={16} className="text-slate-400" />
            <h4 className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">
              Nuotraukų dokumentacija
            </h4>
          </div>
          <div className="grid grid-cols-2 gap-4">
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
                      title="Įkelti prieš nuotrauką"
                      onChange={(e) =>
                        e.target.files?.[0] && onPhotoUpload(order, 'before', e.target.files[0])
                      }
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
                    title="Įkelti prieš nuotrauką"
                    onChange={(e) =>
                      e.target.files?.[0] && onPhotoUpload(order, 'before', e.target.files[0])
                    }
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
                      title="Įkelti po nuotrauką"
                      onChange={(e) =>
                        e.target.files?.[0] && onPhotoUpload(order, 'after', e.target.files[0])
                      }
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
                    title="Įkelti po nuotrauką"
                    onChange={(e) =>
                      e.target.files?.[0] && onPhotoUpload(order, 'after', e.target.files[0])
                    }
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
  );
}
