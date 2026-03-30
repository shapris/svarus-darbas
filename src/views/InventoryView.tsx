import React, { useState, useEffect } from 'react';
import { InventoryItem } from '../types';
import { getData, addData, updateData, deleteData, subscribeToData, TABLES } from '../supabase';
import { Package, Plus, Search, AlertTriangle, Edit2, Trash2, X } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';

interface InventoryViewProps {
  userId: string;
}

export default function InventoryView({ userId }: InventoryViewProps) {
  const [items, setItems] = useState<InventoryItem[]>([]);
  const [isAddingItem, setIsAddingItem] = useState(false);
  const [editingItem, setEditingItem] = useState<InventoryItem | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [filterCategory, setFilterCategory] = useState<InventoryItem['category'] | 'all'>('all');

  const [formData, setFormData] = useState({
    name: '',
    quantity: 0,
    unit: 'vnt',
    minQuantity: 5,
    category: 'valikliai' as InventoryItem['category'],
  });

  useEffect(() => {
    const unsubscribe = subscribeToData<InventoryItem>(TABLES.INVENTORY, userId, (data) => {
      setItems(data.sort((a, b) => a.name.localeCompare(b.name)));
    });

    return () => unsubscribe();
  }, [userId]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      if (editingItem) {
        await updateData(TABLES.INVENTORY, editingItem.id, {
          ...formData,
          lastRestocked: formData.quantity > editingItem.quantity ? new Date().toISOString() : editingItem.lastRestocked,
        });
      } else {
        await addData(TABLES.INVENTORY, userId, {
          ...formData,
          uid: userId,
          lastRestocked: new Date().toISOString(),
        });
      }
      setIsAddingItem(false);
      setEditingItem(null);
      setFormData({ name: '', quantity: 0, unit: 'vnt', minQuantity: 5, category: 'valikliai' });
    } catch {
      alert('Klaida išsaugant inventorių.');
    }
  };

  const handleDelete = async (id: string) => {
    if (window.confirm('Ar tikrai norite ištrinti šią prekę?')) {
      try {
        deleteData(TABLES.INVENTORY, id);
      } catch {
        // Silent fail
      }
    }
  };

  const startEdit = (item: InventoryItem) => {
    setEditingItem(item);
    setFormData({
      name: item.name,
      quantity: item.quantity,
      unit: item.unit,
      minQuantity: item.minQuantity,
      category: item.category,
    });
    setIsAddingItem(true);
  };

  const handleStockChange = async (item: InventoryItem, amount: number) => {
    const newQuantity = Math.max(0, item.quantity + amount);
    try {
      await updateData(TABLES.INVENTORY, item.id, {
        quantity: newQuantity,
        lastRestocked: amount > 0 ? new Date().toISOString() : item.lastRestocked,
      });
    } catch {
      // Silent fail on stock update
    }
  };

  const filteredItems = items.filter(item => {
    const matchesSearch = (item.name || "").toLowerCase().includes(searchTerm.toLowerCase());
    const matchesCategory = filterCategory === 'all' || item.category === filterCategory;
    return matchesSearch && matchesCategory;
  });

  const lowStockItems = items.filter(item => item.quantity <= item.minQuantity);

  return (
    <div className="space-y-6 pb-20">
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-2xl font-bold text-slate-900">Inventorius</h2>
          <p className="text-sm text-slate-500">Valiklių ir įrankių likučiai</p>
        </div>
        <button
          onClick={() => {
            setEditingItem(null);
            setFormData({ name: '', quantity: 0, unit: 'vnt', minQuantity: 5, category: 'valikliai' });
            setIsAddingItem(true);
          }}
          className="bg-blue-600 text-white p-3 rounded-2xl shadow-lg shadow-blue-200 hover:bg-blue-700 transition-colors"
        >
          <Plus size={24} />
        </button>
      </div>

      {lowStockItems.length > 0 && (
        <div className="bg-amber-50 border border-amber-200 p-4 rounded-2xl flex items-start gap-3">
          <AlertTriangle className="text-amber-500 shrink-0 mt-0.5" size={20} />
          <div>
            <h3 className="font-bold text-amber-800 text-sm">Trūksta atsargų</h3>
            <p className="text-xs text-amber-700 mt-1">
              {lowStockItems.map(i => i.name).join(', ')} kiekis yra kritinis.
            </p>
          </div>
        </div>
      )}

      <div className="flex flex-col sm:flex-row gap-4">
        <div className="relative flex-1">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" size={20} />
          <input
            type="text"
            placeholder="Ieškoti inventoriuje..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-12 pr-4 py-3 bg-white border border-slate-200 rounded-2xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20"
          />
        </div>
        <div className="flex gap-2 overflow-x-auto pb-2 sm:pb-0 hide-scrollbar">
          {(['all', 'valikliai', 'įrankiai', 'kita'] as const).map((cat) => (
            <button
              key={cat}
              onClick={() => setFilterCategory(cat)}
              className={`px-4 py-2 rounded-xl text-sm font-bold capitalize whitespace-nowrap transition-colors ${filterCategory === cat
                ? 'bg-slate-900 text-white'
                : 'bg-white text-slate-600 border border-slate-200 hover:bg-slate-50'
                }`}
            >
              {cat === 'all' ? 'Visi' : cat}
            </button>
          ))}
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {filteredItems.map((item) => {
          const isLowStock = item.quantity <= item.minQuantity;
          return (
            <motion.div
              layout
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              key={item.id}
              className={`bg-white p-5 rounded-3xl border shadow-sm relative group overflow-hidden ${isLowStock ? 'border-amber-200' : 'border-slate-100'
                }`}
            >
              {isLowStock && (
                <div className="absolute top-0 right-0 w-16 h-16 overflow-hidden">
                  <div className="absolute top-4 -right-4 bg-amber-500 text-white text-[10px] font-bold uppercase tracking-wider py-1 px-6 rotate-45">
                    Trūksta
                  </div>
                </div>
              )}

              <div className="flex justify-between items-start mb-4">
                <div className="flex items-center gap-3">
                  <div className={`p-3 rounded-2xl ${item.category === 'valikliai' ? 'bg-blue-50 text-blue-600' :
                    item.category === 'įrankiai' ? 'bg-purple-50 text-purple-600' :
                      'bg-slate-50 text-slate-600'
                    }`}>
                    <Package size={20} />
                  </div>
                  <div>
                    <h3 className="font-bold text-slate-900">{item.name}</h3>
                    <span className="text-xs font-bold text-slate-400 uppercase tracking-wider">
                      {item.category}
                    </span>
                  </div>
                </div>
              </div>

              <div className="flex items-end justify-between mt-6">
                <div>
                  <p className="text-xs text-slate-500 mb-1">Likutis</p>
                  <div className="flex items-baseline gap-1">
                    <span className={`text-3xl font-black ${isLowStock ? 'text-amber-600' : 'text-slate-900'}`}>
                      {item.quantity}
                    </span>
                    <span className="text-sm font-bold text-slate-400">{item.unit}</span>
                  </div>
                </div>

                <div className="flex items-center gap-1 bg-slate-50 p-1 rounded-xl">
                  <button
                    onClick={() => handleStockChange(item, -1)}
                    className="w-8 h-8 flex items-center justify-center rounded-lg hover:bg-white hover:shadow-sm transition-all text-slate-600"
                  >
                    -
                  </button>
                  <button
                    onClick={() => handleStockChange(item, 1)}
                    className="w-8 h-8 flex items-center justify-center rounded-lg hover:bg-white hover:shadow-sm transition-all text-slate-600"
                  >
                    +
                  </button>
                </div>
              </div>

              {/* Hover Actions */}
              <div className="absolute top-4 right-4 flex gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                <button
                  onClick={() => startEdit(item)}
                  className="p-2 bg-white shadow-sm border border-slate-100 rounded-xl text-blue-600 hover:bg-blue-50 transition-colors"
                >
                  <Edit2 size={16} />
                </button>
                <button
                  onClick={() => handleDelete(item.id)}
                  className="p-2 bg-white shadow-sm border border-slate-100 rounded-xl text-red-600 hover:bg-red-50 transition-colors"
                >
                  <Trash2 size={16} />
                </button>
              </div>
            </motion.div>
          );
        })}
      </div>

      <AnimatePresence>
        {isAddingItem && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-slate-900/20 backdrop-blur-sm z-50 flex items-center justify-center p-4"
          >
            <motion.div
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              className="bg-white rounded-3xl shadow-xl w-full max-w-md overflow-hidden"
            >
              <div className="p-6 border-b border-slate-100 flex justify-between items-center bg-slate-50">
                <h3 className="text-xl font-bold text-slate-900">
                  {editingItem ? 'Redaguoti prekę' : 'Nauja prekė'}
                </h3>
                <button
                  onClick={() => {
                    setIsAddingItem(false);
                    setEditingItem(null);
                  }}
                  className="text-slate-400 hover:text-slate-600 transition-colors"
                >
                  <X size={24} />
                </button>
              </div>

              <form onSubmit={handleSubmit} className="p-6 space-y-4">
                <div>
                  <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">
                    Pavadinimas
                  </label>
                  <input
                    required
                    type="text"
                    value={formData.name}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl p-3 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20"
                    placeholder="Pvz.: Langų valiklis 5L"
                  />
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">
                      Kiekis
                    </label>
                    <input
                      required
                      type="number"
                      min="0"
                      step="0.1"
                      value={formData.quantity}
                      onChange={(e) => setFormData({ ...formData, quantity: parseFloat(e.target.value) || 0 })}
                      className="w-full bg-slate-50 border border-slate-200 rounded-xl p-3 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">
                      Matavimo vnt.
                    </label>
                    <input
                      required
                      type="text"
                      value={formData.unit}
                      onChange={(e) => setFormData({ ...formData, unit: e.target.value })}
                      className="w-full bg-slate-50 border border-slate-200 rounded-xl p-3 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20"
                      placeholder="vnt, l, kg"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">
                      Kategorija
                    </label>
                    <select
                      value={formData.category}
                      onChange={(e) => setFormData({ ...formData, category: e.target.value as any })}
                      className="w-full bg-slate-50 border border-slate-200 rounded-xl p-3 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20"
                    >
                      <option value="valikliai">Valikliai</option>
                      <option value="įrankiai">Įrankiai</option>
                      <option value="kita">Kita</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">
                      Kritinis likutis
                    </label>
                    <input
                      required
                      type="number"
                      min="0"
                      step="0.1"
                      value={formData.minQuantity}
                      onChange={(e) => setFormData({ ...formData, minQuantity: parseFloat(e.target.value) || 0 })}
                      className="w-full bg-slate-50 border border-slate-200 rounded-xl p-3 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20"
                    />
                  </div>
                </div>

                <button
                  type="submit"
                  className="w-full bg-blue-600 text-white py-4 rounded-2xl font-bold shadow-lg shadow-blue-200 hover:bg-blue-700 transition-colors mt-6"
                >
                  {editingItem ? 'Išsaugoti pakeitimus' : 'Pridėti prekę'}
                </button>
              </form>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
