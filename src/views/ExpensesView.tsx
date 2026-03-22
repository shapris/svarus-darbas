/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from 'react';
import { Expense } from '../types';
import { addData, deleteData, TABLES } from '../supabase';
import { Plus, Trash2, Wallet, Calendar, Tag, Search, TrendingDown } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { formatCurrency, formatDate } from '../utils';

interface LocalUser {
  uid: string;
}

interface ExpensesViewProps {
  expenses: Expense[];
  user: LocalUser;
}

export default function ExpensesView({ expenses, user }: ExpensesViewProps) {
  const [isAdding, setIsAdding] = useState(false);
  const [selectedExpense, setSelectedExpense] = useState<Expense | null>(null);
  const [formData, setFormData] = useState({
    title: '',
    amount: '',
    date: new Date().toISOString().split('T')[0],
    category: 'kita' as Expense['category'],
    notes: '',
  });

  const totalExpenses = expenses.reduce((sum, e) => sum + e.amount, 0);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await addData(TABLES.EXPENSES, user.uid, {
        ...formData,
        amount: parseFloat(formData.amount),
      });
      setIsAdding(false);
      setFormData({
        title: '',
        amount: '',
        date: new Date().toISOString().split('T')[0],
        category: 'kita',
        notes: '',
      });
    } catch (error) {
      console.error('Error saving expense:', error);
    }
  };

  const handleDelete = async (id: string) => {
    if (window.confirm('Ar tikrai norite ištrinti šias išlaidas?')) {
      try {
        deleteData(TABLES.EXPENSES, id);
        if (selectedExpense?.id === id) setSelectedExpense(null);
      } catch (error) {
        console.error('Error deleting expense:', error);
      }
    }
  };

  const categories = {
    kuras: { label: 'Kuras', color: 'bg-blue-50 text-blue-600' },
    priemonės: { label: 'Priemonės', color: 'bg-emerald-50 text-emerald-600' },
    reklama: { label: 'Reklama', color: 'bg-purple-50 text-purple-600' },
    mokesčiai: { label: 'Mokesčiai', color: 'bg-orange-50 text-orange-600' },
    kita: { label: 'Kita', color: 'bg-slate-50 text-slate-600' },
  };

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h2 className="text-xl font-bold text-slate-900">Išlaidos</h2>
        <button
          onClick={() => setIsAdding(true)}
          className="bg-red-600 text-white p-3 rounded-2xl shadow-lg shadow-red-200 hover:bg-red-700 transition-colors"
        >
          <Plus size={20} />
        </button>
      </div>

      <div className="bg-white p-6 rounded-[2.5rem] border border-slate-100 shadow-sm flex items-center gap-6">
        <div className="w-14 h-14 bg-red-50 rounded-2xl flex items-center justify-center text-red-600">
          <TrendingDown size={28} />
        </div>
        <div>
          <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Visos išlaidos</p>
          <p className="text-2xl font-black text-slate-900">{formatCurrency(totalExpenses)}</p>
        </div>
      </div>

      <div className="space-y-4">
        {expenses.sort((a, b) => b.date.localeCompare(a.date)).map((expense) => (
          <motion.div
            layout
            key={expense.id}
            onClick={() => setSelectedExpense(expense)}
            className="bg-white p-4 rounded-3xl border border-slate-100 shadow-sm flex items-center gap-4 cursor-pointer hover:border-red-100 transition-colors"
          >
            <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${categories[expense.category].color}`}>
              <Wallet size={18} />
            </div>
            <div className="flex-1 min-w-0">
              <h3 className="font-bold text-slate-900 leading-tight">{expense.title}</h3>
              <div className="flex items-center gap-2 mt-0.5">
                <span className="text-[10px] font-bold uppercase tracking-tighter opacity-40">{formatDate(expense.date)}</span>
                <span className="text-[10px] text-slate-300">•</span>
                <span className="text-[10px] font-bold uppercase tracking-tighter opacity-40">{categories[expense.category].label}</span>
              </div>
            </div>
            <div className="text-right flex items-center gap-4">
              <p className="font-black text-red-600">-{formatCurrency(expense.amount)}</p>
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  handleDelete(expense.id);
                }}
                className="p-2 text-slate-300 hover:text-red-600 transition-colors"
              >
                <Trash2 size={16} />
              </button>
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
            className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm z-50 flex items-end md:items-center justify-center p-4"
          >
            <motion.div
              initial={{ y: 100 }}
              animate={{ y: 0 }}
              exit={{ y: 100 }}
              className="bg-white w-full max-w-md rounded-t-[2.5rem] md:rounded-[2.5rem] p-8 shadow-2xl"
            >
              <div className="flex justify-between items-center mb-8">
                <h3 className="text-xl font-black text-slate-900">Pridėti išlaidas</h3>
                <button onClick={() => setIsAdding(false)} className="p-2 bg-slate-50 rounded-full text-slate-400">
                  <Plus size={20} className="rotate-45" />
                </button>
              </div>

              <form onSubmit={handleSubmit} className="space-y-6">
                <div>
                  <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-2">Pavadinimas</label>
                  <input
                    required
                    type="text"
                    value={formData.title}
                    onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                    className="w-full bg-slate-50 border border-slate-100 rounded-2xl p-4 text-sm focus:outline-none focus:ring-2 focus:ring-red-500/20"
                    placeholder="Pvz: Kuras, Valymo priemonės"
                  />
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-2">Suma (€)</label>
                    <input
                      required
                      type="number"
                      step="0.01"
                      value={formData.amount}
                      onChange={(e) => setFormData({ ...formData, amount: e.target.value })}
                      className="w-full bg-slate-50 border border-slate-100 rounded-2xl p-4 text-sm focus:outline-none focus:ring-2 focus:ring-red-500/20"
                      placeholder="0.00"
                    />
                  </div>
                  <div>
                    <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-2">Data</label>
                    <input
                      required
                      type="date"
                      value={formData.date}
                      onChange={(e) => setFormData({ ...formData, date: e.target.value })}
                      className="w-full bg-slate-50 border border-slate-100 rounded-2xl p-4 text-sm focus:outline-none focus:ring-2 focus:ring-red-500/20"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-2">Kategorija</label>
                  <div className="grid grid-cols-2 gap-2">
                    {Object.entries(categories).map(([key, { label }]) => (
                      <button
                        key={key}
                        type="button"
                        onClick={() => setFormData({ ...formData, category: key as Expense['category'] })}
                        className={`p-3 rounded-xl text-xs font-bold transition-all ${formData.category === key
                          ? 'bg-red-600 text-white shadow-lg shadow-red-200'
                          : 'bg-slate-50 text-slate-600 border border-slate-100'
                          }`}
                      >
                        {label}
                      </button>
                    ))}
                  </div>
                </div>

                <div>
                  <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-2">Pastabos (neprivaloma)</label>
                  <textarea
                    value={formData.notes}
                    onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                    className="w-full bg-slate-50 border border-slate-100 rounded-2xl p-4 text-sm focus:outline-none focus:ring-2 focus:ring-red-500/20 h-24 resize-none"
                    placeholder="Papildoma informacija apie išlaidas..."
                  />
                </div>

                <button
                  type="submit"
                  className="w-full bg-slate-900 text-white py-5 rounded-2xl font-black text-sm shadow-xl shadow-slate-200 active:scale-95 transition-all mt-4"
                >
                  Išsaugoti
                </button>
              </form>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {selectedExpense && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm z-50 flex items-end md:items-center justify-center p-4"
          >
            <motion.div
              initial={{ y: 100 }}
              animate={{ y: 0 }}
              exit={{ y: 100 }}
              className="bg-white w-full max-w-md rounded-t-[2.5rem] md:rounded-[2.5rem] p-8 shadow-2xl"
            >
              <div className="flex justify-between items-center mb-8">
                <div className="flex items-center gap-3">
                  <div className={`w-12 h-12 rounded-2xl flex items-center justify-center ${categories[selectedExpense.category].color}`}>
                    <Wallet size={24} />
                  </div>
                  <div>
                    <h3 className="text-xl font-black text-slate-900">Išlaidų detalės</h3>
                    <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">{categories[selectedExpense.category].label}</p>
                  </div>
                </div>
                <button onClick={() => setSelectedExpense(null)} className="p-2 bg-slate-50 rounded-full text-slate-400">
                  <Plus size={20} className="rotate-45" />
                </button>
              </div>

              <div className="space-y-6">
                <div className="bg-slate-50 p-6 rounded-3xl border border-slate-100">
                  <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1">Pavadinimas</p>
                  <p className="text-lg font-bold text-slate-900">{selectedExpense.title}</p>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="bg-slate-50 p-6 rounded-3xl border border-slate-100">
                    <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1">Suma</p>
                    <p className="text-lg font-black text-red-600">-{formatCurrency(selectedExpense.amount)}</p>
                  </div>
                  <div className="bg-slate-50 p-6 rounded-3xl border border-slate-100">
                    <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1">Data</p>
                    <p className="text-lg font-bold text-slate-900">{formatDate(selectedExpense.date)}</p>
                  </div>
                </div>

                {selectedExpense.notes && (
                  <div className="bg-slate-50 p-6 rounded-3xl border border-slate-100">
                    <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1">Pastabos</p>
                    <p className="text-sm text-slate-600 leading-relaxed">{selectedExpense.notes}</p>
                  </div>
                )}

                <div className="flex gap-3 pt-4">
                  <button
                    onClick={() => handleDelete(selectedExpense.id)}
                    className="flex-1 bg-red-50 text-red-600 py-4 rounded-2xl font-bold text-sm hover:bg-red-100 transition-colors flex items-center justify-center gap-2"
                  >
                    <Trash2 size={16} />
                    Ištrinti
                  </button>
                  <button
                    onClick={() => setSelectedExpense(null)}
                    className="flex-1 bg-slate-900 text-white py-4 rounded-2xl font-bold text-sm active:scale-95 transition-all"
                  >
                    Uždaryti
                  </button>
                </div>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
