/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from 'react';
import { Employee } from '../types';
import { addData, updateData, deleteData, TABLES } from '../supabase';
import { Users, Plus, Edit2, Trash2, X, Phone } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';

interface LocalUser {
  uid: string;
}

interface TeamViewProps {
  employees: Employee[];
  user: LocalUser;
}

const COLORS = ['#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#ec4899', '#6366f1', '#14b8a6'];

export default function TeamView({ employees, user }: TeamViewProps) {
  const [isAdding, setIsAdding] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [formData, setFormData] = useState({
    name: '',
    phone: '',
    color: COLORS[0],
    isActive: true,
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      if (editingId) {
        await updateData(TABLES.EMPLOYEES, editingId, formData);
      } else {
        await addData(TABLES.EMPLOYEES, user.uid, {
          ...formData,
        });
      }
      setIsAdding(false);
      setEditingId(null);
      setFormData({ name: '', phone: '', color: COLORS[0], isActive: true });
    } catch {
      alert('Klaida išsaugant darbuotoją');
    }
  };

  const handleEdit = (emp: Employee) => {
    setFormData({
      name: emp.name,
      phone: emp.phone,
      color: emp.color,
      isActive: emp.isActive,
    });
    setEditingId(emp.id);
    setIsAdding(true);
  };

  const handleDelete = async (id: string) => {
    if (window.confirm('Ar tikrai norite ištrinti šį darbuotoją?')) {
      try {
        deleteData(TABLES.EMPLOYEES, id);
      } catch {
        // Silent fail - already alerted
      }
    }
  };

  return (
    <div className="space-y-6 pb-10">
      <div className="flex justify-between items-center">
        <h2 className="text-xl font-bold text-slate-900">Komanda</h2>
        <button
          onClick={() => {
            setEditingId(null);
            setFormData({ name: '', phone: '', color: COLORS[Math.floor(Math.random() * COLORS.length)], isActive: true });
            setIsAdding(true);
          }}
          className="bg-blue-600 text-white p-3 rounded-2xl shadow-lg shadow-blue-200 hover:bg-blue-700 transition-colors"
        >
          <Plus size={20} />
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {employees.map((emp) => (
          <motion.div
            key={emp.id}
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            className={`bg-white p-5 rounded-3xl border ${emp.isActive ? 'border-slate-100' : 'border-slate-200 opacity-60'} shadow-sm flex items-center justify-between`}
          >
            <div className="flex items-center gap-4">
              <div
                className="w-12 h-12 rounded-2xl flex items-center justify-center text-white font-bold text-lg shadow-sm"
                style={{ backgroundColor: emp.color }}
              >
                {emp.name.charAt(0).toUpperCase()}
              </div>
              <div>
                <h3 className="font-bold text-slate-900 flex items-center gap-2">
                  {emp.name}
                  {!emp.isActive && <span className="text-[10px] bg-slate-100 text-slate-500 px-2 py-0.5 rounded-md uppercase tracking-wider">Neaktyvus</span>}
                </h3>
                <div className="flex items-center gap-1 text-slate-500 text-xs mt-1">
                  <Phone size={12} />
                  {emp.phone}
                </div>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <button onClick={() => handleEdit(emp)} className="p-2 text-slate-400 hover:text-blue-600 transition-colors bg-slate-50 rounded-xl">
                <Edit2 size={16} />
              </button>
              <button onClick={(e) => { e.stopPropagation(); handleDelete(emp.id); }} className="p-2 text-slate-400 hover:text-red-500 transition-colors bg-slate-50 rounded-xl">
                <Trash2 size={16} />
              </button>
            </div>
          </motion.div>
        ))}

        {employees.length === 0 && (
          <div className="col-span-full text-center py-12 bg-white rounded-3xl border border-slate-100 border-dashed">
            <div className="w-16 h-16 bg-slate-50 rounded-full flex items-center justify-center mx-auto mb-4">
              <Users size={32} className="text-slate-300" />
            </div>
            <p className="text-slate-500 font-medium">Jūsų komandoje dar nėra darbuotojų.</p>
            <p className="text-sm text-slate-400 mt-1">Pridėkite darbuotojus, kad galėtumėte jiems priskirti užsakymus.</p>
          </div>
        )}
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
              className="bg-white w-full max-w-md rounded-t-3xl sm:rounded-3xl p-6 shadow-2xl"
            >
              <div className="flex justify-between items-center mb-6">
                <h3 className="text-xl font-bold text-slate-900">
                  {editingId ? 'Redaguoti darbuotoją' : 'Naujas darbuotojas'}
                </h3>
                <button onClick={() => setIsAdding(false)} className="p-2 text-slate-400 hover:text-slate-600">
                  <X size={20} />
                </button>
              </div>

              <form onSubmit={handleSubmit} className="space-y-4">
                <div>
                  <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1">Vardas</label>
                  <input
                    required
                    type="text"
                    value={formData.name}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                    className="w-full bg-slate-50 border border-slate-100 rounded-xl p-3 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20"
                    placeholder="Vardenis Pavardenis"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1">Telefonas</label>
                  <input
                    required
                    type="tel"
                    value={formData.phone}
                    onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                    className="w-full bg-slate-50 border border-slate-100 rounded-xl p-3 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20"
                    placeholder="+370 600 00000"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">Spalva kalendoriuje</label>
                  <div className="flex gap-2 flex-wrap">
                    {COLORS.map(color => (
                      <button
                        key={color}
                        type="button"
                        onClick={() => setFormData({ ...formData, color })}
                        className={`w-8 h-8 rounded-full transition-transform ${formData.color === color ? 'scale-125 ring-2 ring-offset-2 ring-slate-400' : 'hover:scale-110'}`}
                        style={{ backgroundColor: color }}
                      />
                    ))}
                  </div>
                </div>

                <div className="flex items-center gap-2 pt-2">
                  <input
                    type="checkbox"
                    id="isActive"
                    checked={formData.isActive}
                    onChange={(e) => setFormData({ ...formData, isActive: e.target.checked })}
                    className="w-4 h-4 text-blue-600 rounded border-slate-300 focus:ring-blue-500"
                  />
                  <label htmlFor="isActive" className="text-sm font-medium text-slate-700">Aktyvus darbuotojas</label>
                </div>

                <button
                  type="submit"
                  className="w-full bg-blue-600 text-white py-4 rounded-2xl font-bold shadow-lg shadow-blue-500/20 hover:bg-blue-700 transition-colors mt-6"
                >
                  Išsaugoti
                </button>
              </form>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
