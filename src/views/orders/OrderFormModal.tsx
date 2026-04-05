/**
 * Naujo / redaguojamo užsakymo forma modale (OrdersView).
 */

import React from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { X } from 'lucide-react';
import type { Client, Employee, Order } from '../../types';
import { formatCurrency } from '../../utils';

export interface OrderFormState {
  clientId: string;
  employeeId: string;
  date: string;
  time: string;
  windowCount: number;
  floor: number;
  additionalServices: {
    balkonai: boolean;
    vitrinos: boolean;
    terasa: boolean;
    kiti: boolean;
  };
  notes: string;
  estimatedDuration: number;
  isRecurring: boolean;
  recurringInterval: number;
}

export interface NewClientFormState {
  name: string;
  phone: string;
  email: string;
  address: string;
  buildingType: Client['buildingType'];
}

export interface OrderFormModalProps {
  open: boolean;
  editingOrder: Order | null;
  onClose: () => void;
  onSubmit: (e: React.FormEvent) => void;
  clientMode: 'existing' | 'new';
  setClientMode: (m: 'existing' | 'new') => void;
  formData: OrderFormState;
  setFormData: React.Dispatch<React.SetStateAction<OrderFormState>>;
  newClientData: NewClientFormState;
  setNewClientData: React.Dispatch<React.SetStateAction<NewClientFormState>>;
  clients: Client[];
  employees: Employee[];
  orderPriceManual: boolean;
  setOrderPriceManual: (v: boolean) => void;
  orderPriceOverride: string;
  setOrderPriceOverride: (v: string) => void;
  totalPrice: number;
  parsedOrderPriceOverride: number | null;
  isSaving: boolean;
}

export function OrderFormModal({
  open,
  editingOrder,
  onClose,
  onSubmit,
  clientMode,
  setClientMode,
  formData,
  setFormData,
  newClientData,
  setNewClientData,
  clients,
  employees,
  orderPriceManual,
  setOrderPriceManual,
  orderPriceOverride,
  setOrderPriceOverride,
  totalPrice,
  parsedOrderPriceOverride,
  isSaving,
}: OrderFormModalProps) {
  return (
    <AnimatePresence>
      {open && (
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
              <h3 className="text-xl font-bold text-slate-900">
                {editingOrder ? 'Redaguoti užsakymą' : 'Naujas užsakymas'}
              </h3>
              <button
                type="button"
                onClick={onClose}
                title="Uždaryti formą"
                aria-label="Uždaryti formą"
                className="p-2 text-slate-400 hover:text-slate-600"
              >
                <X size={24} />
              </button>
            </div>

            <form onSubmit={onSubmit} className="space-y-4">
              {!editingOrder && (
                <div className="flex gap-2 bg-slate-50 p-1 rounded-xl">
                  <button
                    type="button"
                    onClick={() => setClientMode('existing')}
                    className={`flex-1 py-2 rounded-lg text-xs font-bold ${clientMode === 'existing' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500'}`}
                  >
                    Esamas klientas
                  </button>
                  <button
                    type="button"
                    onClick={() => setClientMode('new')}
                    className={`flex-1 py-2 rounded-lg text-xs font-bold ${clientMode === 'new' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500'}`}
                  >
                    Naujas klientas
                  </button>
                </div>
              )}

              {clientMode === 'existing' || editingOrder ? (
                <div>
                  <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1">
                    Klientas
                  </label>
                  <select
                    required
                    value={formData.clientId}
                    onChange={(e) => setFormData({ ...formData, clientId: e.target.value })}
                    title="Klientas"
                    className="w-full bg-slate-50 border border-slate-100 rounded-xl p-3 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20"
                  >
                    <option value="">Pasirinkite klientą</option>
                    {clients.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.name} - {c.address}
                      </option>
                    ))}
                  </select>
                </div>
              ) : (
                <div className="grid grid-cols-1 gap-3">
                  <div>
                    <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1">
                      Kliento vardas
                    </label>
                    <input
                      required
                      type="text"
                      value={newClientData.name}
                      onChange={(e) =>
                        setNewClientData((prev) => ({ ...prev, name: e.target.value }))
                      }
                      className="w-full bg-slate-50 border border-slate-100 rounded-xl p-3 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20"
                      placeholder="Pvz. Jonas Jonaitis"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1">
                      Telefonas
                    </label>
                    <input
                      type="text"
                      value={newClientData.phone}
                      onChange={(e) =>
                        setNewClientData((prev) => ({ ...prev, phone: e.target.value }))
                      }
                      className="w-full bg-slate-50 border border-slate-100 rounded-xl p-3 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20"
                      placeholder="+370..."
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1">
                      El. paštas (neprivaloma)
                    </label>
                    <input
                      type="email"
                      inputMode="email"
                      autoComplete="email"
                      value={newClientData.email}
                      onChange={(e) =>
                        setNewClientData((prev) => ({ ...prev, email: e.target.value }))
                      }
                      className="w-full bg-slate-50 border border-slate-100 rounded-xl p-3 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20"
                      placeholder="vardas@pastas.lt"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1">
                      Adresas
                    </label>
                    <input
                      required
                      type="text"
                      value={newClientData.address}
                      onChange={(e) =>
                        setNewClientData((prev) => ({ ...prev, address: e.target.value }))
                      }
                      className="w-full bg-slate-50 border border-slate-100 rounded-xl p-3 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20"
                      placeholder="Gatvė, miestas"
                    />
                  </div>
                </div>
              )}

              <div>
                <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1">
                  Priskirtas darbuotojas
                </label>
                <select
                  value={formData.employeeId}
                  onChange={(e) => setFormData({ ...formData, employeeId: e.target.value })}
                  title="Priskirtas darbuotojas"
                  className="w-full bg-slate-50 border border-slate-100 rounded-xl p-3 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20"
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

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1">
                    Data
                  </label>
                  <input
                    required
                    type="date"
                    value={formData.date}
                    onChange={(e) => setFormData({ ...formData, date: e.target.value })}
                    title="Data"
                    className="w-full bg-slate-50 border border-slate-100 rounded-xl p-3 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1">
                    Laikas
                  </label>
                  <input
                    required
                    type="time"
                    value={formData.time}
                    onChange={(e) => setFormData({ ...formData, time: e.target.value })}
                    title="Laikas"
                    className="w-full bg-slate-50 border border-slate-100 rounded-xl p-3 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1">
                    Langų skaičius
                  </label>
                  <input
                    required
                    type="number"
                    value={formData.windowCount}
                    onChange={(e) =>
                      setFormData({ ...formData, windowCount: parseInt(e.target.value) })
                    }
                    title="Langų skaičius"
                    className="w-full bg-slate-50 border border-slate-100 rounded-xl p-3 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1">
                    Aukštas
                  </label>
                  <input
                    required
                    type="number"
                    value={formData.floor}
                    onChange={(e) =>
                      setFormData({ ...formData, floor: parseInt(e.target.value) })
                    }
                    title="Aukštas"
                    className="w-full bg-slate-50 border border-slate-100 rounded-xl p-3 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">
                  Trukmė
                </label>
                <div className="grid grid-cols-3 gap-2">
                  <div className="space-y-1">
                    <input
                      type="number"
                      min="0"
                      title="Trukmė dienomis"
                      value={Math.floor(formData.estimatedDuration / (24 * 60))}
                      onChange={(e) => {
                        const d = parseInt(e.target.value) || 0;
                        const h = Math.floor((formData.estimatedDuration % (24 * 60)) / 60);
                        const m = formData.estimatedDuration % 60;
                        setFormData({ ...formData, estimatedDuration: d * 24 * 60 + h * 60 + m });
                      }}
                      className="w-full bg-slate-50 border border-slate-100 rounded-xl p-3 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20"
                    />
                    <span className="text-[10px] text-slate-400 font-bold uppercase block text-center">
                      d.
                    </span>
                  </div>
                  <div className="space-y-1">
                    <input
                      type="number"
                      min="0"
                      max="23"
                      title="Trukmė valandomis"
                      value={Math.floor((formData.estimatedDuration % (24 * 60)) / 60)}
                      onChange={(e) => {
                        const d = Math.floor(formData.estimatedDuration / (24 * 60));
                        const h = parseInt(e.target.value) || 0;
                        const m = formData.estimatedDuration % 60;
                        setFormData({ ...formData, estimatedDuration: d * 24 * 60 + h * 60 + m });
                      }}
                      className="w-full bg-slate-50 border border-slate-100 rounded-xl p-3 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20"
                    />
                    <span className="text-[10px] text-slate-400 font-bold uppercase block text-center">
                      val.
                    </span>
                  </div>
                  <div className="space-y-1">
                    <input
                      type="number"
                      min="0"
                      max="59"
                      title="Trukmė minutėmis"
                      value={formData.estimatedDuration % 60}
                      onChange={(e) => {
                        const d = Math.floor(formData.estimatedDuration / (24 * 60));
                        const h = Math.floor((formData.estimatedDuration % (24 * 60)) / 60);
                        const m = parseInt(e.target.value) || 0;
                        setFormData({ ...formData, estimatedDuration: d * 24 * 60 + h * 60 + m });
                      }}
                      className="w-full bg-slate-50 border border-slate-100 rounded-xl p-3 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20"
                    />
                    <span className="text-[10px] text-slate-400 font-bold uppercase block text-center">
                      min.
                    </span>
                  </div>
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1">
                  Papildomos paslaugos
                </label>
                <div className="grid grid-cols-2 gap-2">
                  {Object.entries(formData.additionalServices).map(([key, val]) => (
                    <button
                      key={key}
                      type="button"
                      onClick={() =>
                        setFormData({
                          ...formData,
                          additionalServices: { ...formData.additionalServices, [key]: !val },
                        })
                      }
                      className={`py-2 rounded-xl text-xs font-bold capitalize border transition-all ${
                        val
                          ? 'bg-blue-50 text-blue-600 border-blue-200'
                          : 'bg-white text-slate-400 border-slate-100'
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
                    title="Perjungti periodinį užsakymą"
                    aria-label="Perjungti periodinį užsakymą"
                    onClick={() =>
                      setFormData({ ...formData, isRecurring: !formData.isRecurring })
                    }
                    className={`w-12 h-6 rounded-full transition-colors relative ${
                      formData.isRecurring ? 'bg-blue-500' : 'bg-slate-300'
                    }`}
                  >
                    <div
                      className={`w-4 h-4 rounded-full bg-white absolute top-1 transition-transform ${
                        formData.isRecurring ? 'left-7' : 'left-1'
                      }`}
                    />
                  </button>
                </div>

                {formData.isRecurring && (
                  <div className="pt-2 border-t border-slate-200">
                    <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1">
                      Intervalas (mėnesiais)
                    </label>
                    <input
                      type="number"
                      min="1"
                      max="12"
                      title="Periodiškumo intervalas mėnesiais"
                      value={formData.recurringInterval}
                      onChange={(e) =>
                        setFormData({
                          ...formData,
                          recurringInterval: parseInt(e.target.value) || 3,
                        })
                      }
                      className="w-full bg-white border border-slate-200 rounded-xl p-3 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20"
                    />
                  </div>
                )}
              </div>

              <div className="bg-blue-50 p-4 rounded-2xl border border-blue-100 space-y-3">
                <div className="flex justify-between items-center gap-2">
                  <span className="text-sm font-bold text-blue-900">Kaina pagal įkainius</span>
                  <span className="text-lg font-black text-blue-600 tabular-nums">
                    {formatCurrency(totalPrice)}
                  </span>
                </div>
                <label className="flex items-start gap-3 cursor-pointer rounded-xl p-2 -m-2 hover:bg-blue-100/50">
                  <input
                    type="checkbox"
                    checked={orderPriceManual}
                    onChange={(e) => {
                      const on = e.target.checked;
                      setOrderPriceManual(on);
                      if (on && !orderPriceOverride.trim()) {
                        setOrderPriceOverride(String(Math.round(totalPrice * 100) / 100));
                      }
                    }}
                    className="mt-1 rounded border-blue-300 text-blue-600 focus:ring-blue-500"
                  />
                  <span className="text-sm text-blue-950 leading-snug">
                    <span className="font-bold">Nustatyti kainą rankiniu būdu</span>
                    <span className="block text-xs text-blue-900/80 font-normal mt-0.5">
                      Sutarta kita suma (nuolaida, fiksuotas darbas ir pan.).
                    </span>
                  </span>
                </label>
                {orderPriceManual && (
                  <div>
                    <label className="block text-xs font-bold text-blue-900 uppercase tracking-wider mb-1">
                      Kaina (€)
                    </label>
                    <input
                      type="text"
                      inputMode="decimal"
                      value={orderPriceOverride}
                      onChange={(e) => setOrderPriceOverride(e.target.value)}
                      placeholder="pvz. 75,50"
                      title="Užsakymo kaina eurais"
                      className="w-full bg-white border border-blue-200 rounded-xl p-3 text-lg font-bold text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500/30"
                    />
                  </div>
                )}
                {!orderPriceManual && (
                  <p className="text-xs text-blue-900/75">
                    Į užsakymą bus įrašyta kaina pagal nustatymų įkainius.
                  </p>
                )}
                {orderPriceManual && parsedOrderPriceOverride !== null && (
                  <p className="text-xs font-semibold text-blue-900">
                    Bus išsaugota: {formatCurrency(parsedOrderPriceOverride)}
                  </p>
                )}
              </div>

              <button
                type="submit"
                disabled={isSaving}
                className="w-full bg-blue-600 text-white py-4 rounded-2xl font-bold shadow-lg shadow-blue-200 hover:bg-blue-700 transition-colors mt-4 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center"
              >
                {isSaving ? (
                  <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white"></div>
                ) : editingOrder ? (
                  'Išsaugoti pakeitimus'
                ) : (
                  'Sukurti užsakymą'
                )}
              </button>
            </form>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
