/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useCallback, useEffect, useState } from 'react';
import { Client, BuildingType, Order, OrderStatus } from '../types';
import { addData, updateData, deleteData, TABLES } from '../supabase';
import {
  Search,
  Plus,
  User as UserIcon,
  Phone,
  MapPin,
  X,
  Edit,
  Trash2,
  History,
  ChevronRight,
  Loader2,
  Users,
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { formatDate, formatCurrency } from '../utils';
import LoadingSpinner from '../components/LoadingSpinner';
import { useToast } from '../hooks/useToast';
import { useOrgAccess } from '../contexts/OrgAccessContext';
import ClientAddressAutocomplete, {
  googleMapsSearchUrl,
} from '../components/ClientAddressAutocomplete';

interface LocalUser {
  uid: string;
  email: string | null;
  displayName: string | null;
  photoURL: string | null;
}

interface ClientsViewProps {
  clients: Client[];
  orders: Order[];
  user: LocalUser;
}

const ORDER_STATUS_LABEL_LT: Record<OrderStatus, string> = {
  suplanuota: 'Suplanuota',
  vykdoma: 'Vykdoma',
  atlikta: 'Atlikta',
};

function formatClientSaveError(err: unknown): string {
  const msg =
    err &&
    typeof err === 'object' &&
    'message' in err &&
    typeof (err as { message: unknown }).message === 'string'
      ? (err as { message: string }).message
      : '';
  return msg ? ` (${msg})` : '';
}

export default function ClientsView({ clients, orders, user }: ClientsViewProps) {
  const { isRestrictedStaff } = useOrgAccess();
  const [search, setSearch] = useState('');
  const [isAdding, setIsAdding] = useState(false);
  const [editingClient, setEditingClient] = useState<Client | null>(null);
  const [viewingHistory, setViewingHistory] = useState<Client | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isDeleting, setIsDeleting] = useState<string | null>(null);
  const [highlightedClientId, setHighlightedClientId] = useState<string | null>(null);
  const { showToast } = useToast();
  const [formData, setFormData] = useState({
    name: '',
    phone: 'nesutarta',
    email: '',
    address: '',
    lat: undefined as number | undefined,
    lng: undefined as number | undefined,
    buildingType: 'butas' as BuildingType,
    notes: '',
  });

  const onAddressFieldChange = useCallback(
    (address: string, coords?: { lat: number; lng: number }) => {
      setFormData((prev) => ({
        ...prev,
        address,
        ...(coords ? { lat: coords.lat, lng: coords.lng } : { lat: undefined, lng: undefined }),
      }));
    },
    []
  );

  const filteredClients = clients.filter(
    (c) =>
      (c.name || '').toLowerCase().includes(search.toLowerCase()) ||
      (c.address || '').toLowerCase().includes(search.toLowerCase()) ||
      (c.phone || '').includes(search) ||
      (c.email || '').toLowerCase().includes(search.toLowerCase())
  );

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    // Validation
    if (!formData.name.trim()) {
      showToast.error('Privaloma nurodyti kliento vardą');
      return;
    }
    if (!formData.address.trim()) {
      showToast.error('Privaloma nurodyti adresą');
      return;
    }

    const normalizedPhone = formData.phone.trim() || 'nesutarta';

    setIsSubmitting(true);
    try {
      if (editingClient) {
        await updateData(TABLES.CLIENTS, editingClient.id, { ...formData, phone: normalizedPhone });
        showToast.success('Kliento informacija atnaujinta!');
      } else {
        await addData(TABLES.CLIENTS, user.uid, {
          ...formData,
          phone: normalizedPhone,
          createdAt: new Date().toISOString(),
        });
        showToast.success('Naujas klientas sėkmingai pridėtas!');
      }
      setIsAdding(false);
      setEditingClient(null);
      setFormData({
        name: '',
        phone: 'nesutarta',
        email: '',
        address: '',
        lat: undefined,
        lng: undefined,
        buildingType: 'butas',
        notes: '',
      });
    } catch (error) {
      showToast.error(`Nepavyko išsaugoti kliento${formatClientSaveError(error)}`);
      console.error('Error saving client:', error);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleEdit = (client: Client) => {
    setEditingClient(client);
    setFormData({
      name: client.name,
      phone: client.phone,
      email: client.email ?? '',
      address: client.address,
      lat: client.lat,
      lng: client.lng,
      buildingType: client.buildingType,
      notes: client.notes || '',
    });
    setIsAdding(true);
  };

  const handleDelete = async (id: string) => {
    if (isRestrictedStaff) return;
    if (!window.confirm('Ar tikrai norite ištrinti šį klientą?')) return;

    setIsDeleting(id);
    try {
      await deleteData(TABLES.CLIENTS, id);
      showToast.success('Klientas sėkmingai ištrintas');
    } catch (error) {
      showToast.error(`Nepavyko ištrinti kliento${formatClientSaveError(error)}`);
      console.error('Error deleting client:', error);
    } finally {
      setIsDeleting(null);
    }
  };

  const getClientOrders = (clientId: string) => {
    return orders
      .filter((o) => o.clientId === clientId)
      .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
  };

  useEffect(() => {
    const selectedClientId = localStorage.getItem('selected_client_id');
    if (!selectedClientId) return;
    const target = clients.find((c) => c.id === selectedClientId);
    if (!target) {
      localStorage.removeItem('selected_client_id');
      return;
    }

    setSearch(target.name || '');
    setViewingHistory(target);
    setHighlightedClientId(target.id);
    localStorage.removeItem('selected_client_id');

    setTimeout(() => {
      const el = document.querySelector(`[data-client-id="${target.id}"]`) as HTMLElement | null;
      el?.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }, 120);

    setTimeout(() => setHighlightedClientId(null), 4000);
  }, [clients]);

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h2 className="text-xl font-bold text-slate-900">Klientai</h2>
        <button
          type="button"
          onClick={() => setIsAdding(true)}
          title="Pridėti klientą"
          aria-label="Pridėti klientą"
          className="bg-blue-600 text-white p-3 rounded-2xl shadow-lg shadow-blue-200 hover:bg-blue-700 transition-colors"
        >
          <Plus size={20} />
        </button>
      </div>

      <div className="relative">
        <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
        <input
          type="text"
          placeholder="Ieškoti kliento..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="w-full bg-white border border-slate-100 rounded-2xl py-4 pl-12 pr-4 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20 transition-all shadow-sm"
        />
      </div>

      <div className="space-y-3">
        {filteredClients.length === 0 && (
          <div className="bg-white border border-slate-100 rounded-3xl p-10 text-center shadow-sm">
            <Users className="w-12 h-12 text-slate-200 mx-auto mb-3" aria-hidden />
            <p className="text-slate-700 font-semibold text-sm">
              {clients.length === 0 ? 'Dar nėra klientų' : 'Klientų nerasta'}
            </p>
            <p className="text-slate-500 text-xs mt-2 max-w-xs mx-auto">
              {clients.length === 0
                ? 'Pridėkite pirmą klientą mygtuku viršuje.'
                : 'Pakeiskite paieškos frazę arba išvalykite lauką.'}
            </p>
          </div>
        )}
        {filteredClients.map((client) => (
          <motion.div
            layout
            key={client.id}
            data-client-id={client.id}
            className={`bg-white p-4 rounded-3xl border shadow-sm transition-colors ${
              highlightedClientId === client.id
                ? 'border-blue-400 shadow-blue-100 ring-2 ring-blue-200'
                : 'border-slate-100 hover:border-blue-100'
            }`}
          >
            <div className="flex justify-between items-start mb-3">
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 bg-blue-50 rounded-2xl flex items-center justify-center text-blue-600 border border-blue-100">
                  <UserIcon size={20} />
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <h3 className="font-bold text-slate-900">{client.name}</h3>
                    {getClientOrders(client.id).length >= 5 && (
                      <span className="bg-amber-100 text-amber-700 text-[8px] font-black px-1.5 py-0.5 rounded-full uppercase tracking-widest border border-amber-200">
                        VIP
                      </span>
                    )}
                  </div>
                  <div className="flex items-center gap-1 mt-1">
                    <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
                      {client.buildingType}
                    </span>
                    <span className="text-[10px] text-slate-300">•</span>
                    <span className="text-[10px] font-bold text-blue-600">
                      {getClientOrders(client.id).length} užsakymai
                    </span>
                    {!isRestrictedStaff && (
                      <>
                        <span className="text-[10px] text-slate-300">•</span>
                        <span className="text-[10px] font-bold text-emerald-600">
                          {formatCurrency(
                            getClientOrders(client.id).reduce((sum, o) => sum + o.totalPrice, 0)
                          )}
                        </span>
                      </>
                    )}
                  </div>
                </div>
              </div>
              <div className="flex gap-1">
                <button
                  type="button"
                  onClick={() => setViewingHistory(client)}
                  title="Peržiūrėti istoriją"
                  aria-label={`Peržiūrėti ${client.name || 'kliento'} užsakymų istoriją`}
                  className="p-2 text-slate-400 hover:text-blue-600 transition-colors"
                >
                  <History size={18} aria-hidden />
                </button>
                <button
                  type="button"
                  onClick={() => handleEdit(client)}
                  title="Redaguoti klientą"
                  aria-label={`Redaguoti klientą ${client.name || ''}`}
                  className="p-2 text-slate-400 hover:text-blue-600 transition-colors"
                >
                  <Edit size={18} aria-hidden />
                </button>
                {!isRestrictedStaff && (
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      handleDelete(client.id);
                    }}
                    title="Ištrinti klientą"
                    aria-label={`Ištrinti klientą ${client.name || ''}`}
                    className="p-2 text-slate-400 hover:text-red-500 transition-colors disabled:opacity-50"
                    disabled={isDeleting === client.id}
                  >
                    {isDeleting === client.id ? (
                      <LoadingSpinner size="sm" />
                    ) : (
                      <Trash2 size={18} aria-hidden />
                    )}
                  </button>
                )}
              </div>
            </div>

            <div className="grid grid-cols-2 gap-2">
              <div className="flex items-center gap-2 text-xs text-slate-600 bg-slate-50 p-2 rounded-xl border border-slate-100">
                <Phone size={14} className="text-slate-400 shrink-0" />
                <a
                  href={`tel:${client.phone}`}
                  className="hover:text-blue-600 truncate font-medium"
                >
                  {client.phone}
                </a>
              </div>
              <div className="flex items-center gap-2 text-xs text-slate-600 bg-slate-50 p-2 rounded-xl border border-slate-100 min-w-0">
                <MapPin size={14} className="text-slate-400 shrink-0" />
                <a
                  href={
                    client.lat != null && client.lng != null
                      ? `https://www.google.com/maps?q=${client.lat},${client.lng}`
                      : googleMapsSearchUrl(client.address)
                  }
                  target="_blank"
                  rel="noopener noreferrer"
                  title="Atidaryti Google žemėlapyje"
                  className="truncate font-medium hover:text-blue-600"
                >
                  {client.address}
                </a>
              </div>
            </div>

            {client.notes && (
              <div className="mt-3 p-3 bg-amber-50/50 rounded-xl border border-amber-100/50">
                <p className="text-[10px] font-bold text-amber-600 uppercase tracking-widest mb-1">
                  Pastabos
                </p>
                <p className="text-xs text-amber-900/70 italic leading-relaxed">{client.notes}</p>
              </div>
            )}
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
                <h3 className="text-xl font-bold text-slate-900">
                  {editingClient ? 'Redaguoti klientą' : 'Pridėti klientą'}
                </h3>
                <button
                  type="button"
                  onClick={() => {
                    setIsAdding(false);
                    setEditingClient(null);
                  }}
                  title="Uždaryti"
                  aria-label="Uždaryti kliento formą"
                  className="p-2 text-slate-400 hover:text-slate-600"
                >
                  <X size={24} aria-hidden />
                </button>
              </div>

              <form onSubmit={handleSubmit} className="space-y-4">
                <div>
                  <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1">
                    Vardas
                  </label>
                  <input
                    required
                    type="text"
                    value={formData.name}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                    className="w-full bg-slate-50 border border-slate-100 rounded-xl p-3 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20"
                    placeholder="Vardas Pavardė"
                  />
                </div>
                <div>
                  <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1">
                    Telefonas
                  </label>
                  <input
                    type="tel"
                    value={formData.phone}
                    onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                    className="w-full bg-slate-50 border border-slate-100 rounded-xl p-3 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20"
                    placeholder="+370 600 00000 arba nesutarta"
                  />
                </div>
                <div>
                  <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1">
                    El. paštas (sąskaitoms)
                  </label>
                  <input
                    type="email"
                    inputMode="email"
                    autoComplete="email"
                    value={formData.email}
                    onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                    className="w-full bg-slate-50 border border-slate-100 rounded-xl p-3 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20"
                    placeholder="vardas@pastas.lt (neprivaloma)"
                  />
                </div>
                <div>
                  <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1">
                    Adresas
                  </label>
                  <ClientAddressAutocomplete
                    key={editingClient?.id ?? 'new-client'}
                    value={formData.address}
                    onChange={onAddressFieldChange}
                    disabled={isSubmitting}
                    inputClassName="w-full bg-slate-50 border border-slate-100 rounded-xl p-3 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20"
                  />
                </div>
                <div>
                  <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1">
                    Pastato tipas
                  </label>
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                    {(['butas', 'namas', 'ofisas', 'nesutarta'] as BuildingType[]).map((type) => (
                      <button
                        key={type}
                        type="button"
                        onClick={() => setFormData({ ...formData, buildingType: type })}
                        className={`py-2 rounded-xl text-xs font-bold capitalize border transition-all ${
                          formData.buildingType === type
                            ? 'bg-blue-600 text-white border-blue-600 shadow-md shadow-blue-100'
                            : 'bg-white text-slate-500 border-slate-100 hover:border-blue-200'
                        }`}
                      >
                        {type}
                      </button>
                    ))}
                  </div>
                </div>
                <div>
                  <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1">
                    Pastabos
                  </label>
                  <textarea
                    rows={3}
                    value={formData.notes}
                    onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                    className="w-full bg-slate-50 border border-slate-100 rounded-xl p-3 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20"
                    placeholder="Papildoma informacija..."
                  />
                </div>
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="w-full bg-blue-600 text-white py-4 rounded-2xl font-bold shadow-lg shadow-blue-200 hover:bg-blue-700 transition-colors mt-4 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {isSubmitting ? (
                    <div className="flex items-center justify-center gap-2">
                      <Loader2 className="w-4 h-4 animate-spin text-white" />
                      <span>{editingClient ? 'Išsaugoma...' : 'Pridedama...'}</span>
                    </div>
                  ) : (
                    <>{editingClient ? 'Išsaugoti pakeitimus' : 'Pridėti klientą'}</>
                  )}
                </button>
              </form>
            </motion.div>
          </motion.div>
        )}

        {viewingHistory && (
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
              className="bg-white w-full max-w-md rounded-t-3xl sm:rounded-3xl p-6 shadow-2xl max-h-[80vh] overflow-y-auto"
            >
              <div className="flex justify-between items-center mb-6">
                <div>
                  <h3 className="text-xl font-bold text-slate-900">Užsakymų istorija</h3>
                  <p className="text-xs text-slate-400 font-medium">{viewingHistory.name}</p>
                </div>
                <button
                  type="button"
                  onClick={() => setViewingHistory(null)}
                  title="Uždaryti istoriją"
                  aria-label="Uždaryti užsakymų istoriją"
                  className="p-2 text-slate-400 hover:text-slate-600"
                >
                  <X size={24} aria-hidden />
                </button>
              </div>

              <div className="space-y-4">
                {getClientOrders(viewingHistory.id).length > 0 ? (
                  getClientOrders(viewingHistory.id).map((order) => (
                    <div
                      key={order.id}
                      className="bg-slate-50 p-4 rounded-2xl border border-slate-100 flex justify-between items-center"
                    >
                      <div>
                        <p className="text-xs font-bold text-slate-900">{formatDate(order.date)}</p>
                        <p className="text-[10px] text-slate-400 font-medium">
                          {order.windowCount} langai •{' '}
                          {ORDER_STATUS_LABEL_LT[order.status] ?? order.status}
                        </p>
                      </div>
                      <div className="text-right">
                        <p className="text-sm font-black text-slate-900">
                          {formatCurrency(order.totalPrice)}
                        </p>
                        <ChevronRight size={14} className="text-slate-300 ml-auto mt-1" />
                      </div>
                    </div>
                  ))
                ) : (
                  <div className="text-center py-10">
                    <History size={32} className="text-slate-200 mx-auto mb-2" />
                    <p className="text-slate-400 text-sm italic">Užsakymų dar nebuvo</p>
                  </div>
                )}
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
