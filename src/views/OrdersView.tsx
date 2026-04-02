/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useCallback } from 'react';
import { Order, Client, AppSettings, OrderStatus, Employee } from '../types';
import { addData, updateData, deleteData, TABLES } from '../supabase';
import {
  calculateOrderPrice,
  formatCurrency,
  formatDate,
  formatDuration,
  geocodeAddress,
  generateInvoicePDF,
  looksLikeValidEmail,
  compressImageToJpegDataUrl,
} from '../utils';
import LoadingSpinner, { ButtonLoader } from '../components/LoadingSpinner';
import { useToast } from '../hooks/useToast';
import { useOrgAccess } from '../contexts/OrgAccessContext';
import { Plus, Search, Calendar, Clock, MapPin, User as UserIcon, CheckCircle2, MoreVertical, X, FileText, Camera, MessageSquare, Star, Users, Download, Mail, Image as ImageIcon, Loader2, HelpCircle } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';

interface LocalUser {
  uid: string;
}

const ORDER_STATUS_LABEL_LT: Record<OrderStatus, string> = {
  suplanuota: 'Suplanuota',
  vykdoma: 'Vykdoma',
  atlikta: 'Atlikta',
};

const MAX_PHOTO_DATA_URL_LENGTH = 900_000;

interface OrdersViewProps {
  orders: Order[];
  clients: Client[];
  settings: AppSettings;
  user: LocalUser;
  employees: Employee[];
}

export default function OrdersView({ orders, clients, settings, user, employees }: OrdersViewProps) {
  const { isRestrictedStaff } = useOrgAccess();
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<OrderStatus | 'all'>('all');
  const [focusFilter, setFocusFilter] = useState<'all' | 'today' | 'overdue' | 'unassigned'>('all');
  const [selectedOrderIds, setSelectedOrderIds] = useState<string[]>([]);
  const [bulkEmployeeId, setBulkEmployeeId] = useState<string>('');
  const [isBulkUpdating, setIsBulkUpdating] = useState(false);
  const [assigningOrderId, setAssigningOrderId] = useState<string | null>(null);
  const [isAdding, setIsAdding] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [isUploading, setIsUploading] = useState<string | null>(null);
  const [editingOrder, setEditingOrder] = useState<Order | null>(null);
  const [isDeleting, setIsDeleting] = useState<string | null>(null);
  const [actionsMenuOrderId, setActionsMenuOrderId] = useState<string | null>(null);
  const [statusUpdatingOrderId, setStatusUpdatingOrderId] = useState<string | null>(null);
  const [invoiceActionOrderId, setInvoiceActionOrderId] = useState<string | null>(null);
  const [invoiceEmailSentOrderId, setInvoiceEmailSentOrderId] = useState<string | null>(null);
  const [clientMode, setClientMode] = useState<'existing' | 'new'>('existing');
  const { showToast } = useToast();
  const [newClientData, setNewClientData] = useState({
    name: '',
    phone: '',
    email: '',
    address: '',
    buildingType: 'nesutarta' as Client['buildingType'],
  });
  /** Rankinė užsakymo kaina (EUR), kai įjungta „Nustatyti kainą rankiniu būdu“. */
  const [orderPriceManual, setOrderPriceManual] = useState(false);
  const [orderPriceOverride, setOrderPriceOverride] = useState('');
  const [formData, setFormData] = useState({
    clientId: '',
    employeeId: '',
    date: new Date().toISOString().split('T')[0],
    time: '10:00',
    windowCount: 10,
    floor: 1,
    additionalServices: {
      balkonai: false,
      vitrinos: false,
      terasa: false,
      kiti: false,
    },
    notes: '',
    estimatedDuration: 60,
    isRecurring: false,
    recurringInterval: 3,
  });

  useEffect(() => {
    if (!invoiceEmailSentOrderId) return;
    const t = window.setTimeout(() => setInvoiceEmailSentOrderId(null), 5500);
    return () => clearTimeout(t);
  }, [invoiceEmailSentOrderId]);

  const today = new Date().toISOString().split('T')[0];
  const overdueCount = orders.filter((o) => o.status !== 'atlikta' && o.date < today).length;
  const todayCount = orders.filter((o) => o.date === today && o.status !== 'atlikta').length;
  const unassignedCount = orders.filter((o) => o.status !== 'atlikta' && !o.employeeId).length;

  const filteredOrders = orders.filter((o) => {
    const statusMatch = statusFilter === 'all' || o.status === statusFilter;
    const textMatch =
      (o.clientName || "").toLowerCase().includes(search.toLowerCase()) ||
      (o.address || "").toLowerCase().includes(search.toLowerCase());
    const focusMatch =
      focusFilter === 'all'
        ? true
        : focusFilter === 'today'
          ? o.status !== 'atlikta' && o.date === today
          : focusFilter === 'overdue'
            ? o.status !== 'atlikta' && o.date < today
            : o.status !== 'atlikta' && !o.employeeId;

    return statusMatch && textMatch && focusMatch;
  }).sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());

  const visibleOrderIds = filteredOrders.map((o) => o.id);
  const selectedVisibleCount = selectedOrderIds.filter((id) => visibleOrderIds.includes(id)).length;
  const allVisibleSelected = visibleOrderIds.length > 0 && selectedVisibleCount === visibleOrderIds.length;

  const totalPrice = calculateOrderPrice(
    formData.windowCount,
    formData.floor,
    formData.additionalServices,
    settings
  );

  const parsedOrderPriceOverride = (() => {
    const raw = orderPriceOverride.replace(/\s/g, '').replace(',', '.');
    if (raw === '') return null;
    const n = Number(raw);
    if (!Number.isFinite(n) || n < 0) return null;
    return Math.round(n * 100) / 100;
  })();

  const effectiveTotalPrice =
    orderPriceManual && parsedOrderPriceOverride !== null ? parsedOrderPriceOverride : totalPrice;

  useEffect(() => {
    // Keep selection valid when filters/data change.
    setSelectedOrderIds((prev) => prev.filter((id) => orders.some((o) => o.id === id)));
  }, [orders]);

  useEffect(() => {
    if (!actionsMenuOrderId) return;
    const onDocClick = () => setActionsMenuOrderId(null);
    document.addEventListener('click', onDocClick);
    return () => document.removeEventListener('click', onDocClick);
  }, [actionsMenuOrderId]);

  const orderDisplayAddress = useCallback(
    (order: Order) => {
      const fromOrder = order.address?.trim();
      if (fromOrder) return fromOrder;
      return clients.find((c) => c.id === order.clientId)?.address?.trim() || '';
    },
    [clients]
  );

  /** Rodoma eilutėje: jei užsakyme `clientName` tuščias (seni/ vieši įrašai), imama iš kliento kortelės. */
  const resolveOrderClientName = useCallback(
    (order: Order): string => {
      const fromOrder = (order.clientName ?? '').trim();
      if (fromOrder) return fromOrder;
      return (clients.find((c) => c.id === order.clientId)?.name ?? '').trim();
    },
    [clients]
  );

  /**
   * Sąskaitai / „El. paštas“: pirmiausia klientas pagal užsakymo clientId.
   * Jei ten nėra tinkamo el. pašto, bet egzistuoja tik vienas klientas su tuo pačiu vardu ir galiojančiu el. paštu —
   * naudojame jį (dažnas atvejis: dublikatas DB arba senas clientId po kliento sujungimo).
   * Jei keli to paties vardo su skirtingais paštais — lieka susiejimas pagal id (geltonas mygtukas kol neištaisysite).
   */
  const resolveClientForOrder = useCallback(
    (order: Order): Client | undefined => {
      const byId = clients.find((c) => c.id === order.clientId);
      if (byId && looksLikeValidEmail((byId.email ?? '').trim())) {
        return byId;
      }
      const nameKey = (order.clientName ?? '').trim().toLowerCase();
      if (!nameKey) return byId;

      const sameName = clients.filter((c) => (c.name ?? '').trim().toLowerCase() === nameKey);
      const withEmail = sameName.filter((c) => looksLikeValidEmail((c.email ?? '').trim()));

      if (withEmail.length === 1) {
        return withEmail[0];
      }
      return byId;
    },
    [clients]
  );

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (orderPriceManual && parsedOrderPriceOverride === null) {
      showToast.error('Įveskite galiojančią kainą (EUR) arba išjunkite rankinį nustatymą.');
      return;
    }

    setIsSaving(true);
    try {
      let orderClient: Client | null = null;
      if (clientMode === 'existing') {
        orderClient = clients.find(c => c.id === formData.clientId) || null;
        if (!orderClient) {
          showToast.error('Pasirinkite klientą');
          return;
        }
      } else {
        const name = newClientData.name.trim();
        const address = newClientData.address.trim();
        if (!name || !address) {
          showToast.error('Naujam klientui būtinas vardas ir adresas');
          return;
        }
        const createdClient = await addData(TABLES.CLIENTS, user.uid, {
          name,
          phone: newClientData.phone.trim(),
          email: newClientData.email.trim() || undefined,
          address,
          buildingType: newClientData.buildingType,
          createdAt: new Date().toISOString(),
        } as any);
        orderClient = createdClient as unknown as Client;
      }
      const coords = await geocodeAddress(orderClient.address);

      const orderData = {
        ...formData,
        clientId: orderClient.id,
        clientName: orderClient.name,
        address: orderClient.address,
        lat: coords?.lat || null,
        lng: coords?.lng || null,
        windowCount: Math.max(1, Number(formData.windowCount) || 1),
        floor: Math.max(1, Number(formData.floor) || 1),
        estimatedDuration: Math.max(15, Number(formData.estimatedDuration) || 60),
        totalPrice: effectiveTotalPrice,
        status: 'suplanuota' as OrderStatus,
        uid: user.uid,
        createdAt: new Date().toISOString(),
      };

      if (editingOrder) {
        await updateData(TABLES.ORDERS, editingOrder.id, orderData as any);
      } else {
        await addData(TABLES.ORDERS, user.uid, orderData as any);
      }
      setIsAdding(false);
      setEditingOrder(null);
      setClientMode('existing');
      setOrderPriceManual(false);
      setOrderPriceOverride('');
      setNewClientData({ name: '', phone: '', email: '', address: '', buildingType: 'nesutarta' });
      showToast.success('Užsakymas išsaugotas');
    } catch {
      showToast.error('Klaida išsaugant užsakymą');
    } finally {
      setIsSaving(false);
    }
  };

  const handleStatusUpdate = async (order: Order, status: OrderStatus) => {
    setStatusUpdatingOrderId(order.id);
    try {
      await updateData(TABLES.ORDERS, order.id, { status } as any);

      // Handle recurring orders
      if (status === 'atlikta' && order.isRecurring && order.recurringInterval) {
        const nextDate = new Date(order.date);
        nextDate.setMonth(nextDate.getMonth() + order.recurringInterval);

        const newOrderData = {
          clientId: order.clientId,
          clientName: resolveOrderClientName(order),
          employeeId: order.employeeId || '',
          address: orderDisplayAddress(order),
          date: nextDate.toISOString().split('T')[0],
          time: order.time,
          windowCount: order.windowCount,
          floor: order.floor,
          additionalServices: order.additionalServices,
          totalPrice: order.totalPrice,
          status: 'suplanuota' as OrderStatus,
          estimatedDuration: order.estimatedDuration || 60,
          isRecurring: true,
          recurringInterval: order.recurringInterval,
          notes: order.notes || '',
          uid: user.uid,
          createdAt: new Date().toISOString(),
        };

        await addData(TABLES.ORDERS, user.uid, newOrderData as any);
        showToast.success(`Užsakymas baigtas. Sukurtas naujas periodinis užsakymas: ${newOrderData.date}`);
      }
      if (status === 'atlikta' && !order.isRecurring) {
        showToast.success('Užsakymas pažymėtas kaip atliktas');
      }
    } catch (error: any) {
      console.error('Status update failed:', error);
      const details = typeof error?.message === 'string' ? ` (${error.message})` : '';
      showToast.error(`Nepavyko išsaugoti būsenos${details}`);
    } finally {
      setStatusUpdatingOrderId(null);
    }
  };

  const handlePhotoUpload = async (order: Order, type: 'before' | 'after', file: File) => {
    if (file.size > 12 * 1024 * 1024) {
      showToast.error('Failas per didelis (daugiausia ~12 MB).');
      return;
    }
    setIsUploading(`${order.id}-${type}`);
    try {
      const dataUrl = await compressImageToJpegDataUrl(file);
      if (dataUrl.length > MAX_PHOTO_DATA_URL_LENGTH) {
        showToast.error('Nuotrauka per didelė po suspaudimo. Bandykite mažesnę raišką arba kitą kadrą.');
        return;
      }
      const patch = type === 'before' ? { photoBefore: dataUrl } : { photoAfter: dataUrl };
      await updateData(TABLES.ORDERS, order.id, patch as Record<string, unknown>);
      showToast.success(type === 'before' ? '„Prieš“ nuotrauka įrašyta' : '„Po“ nuotrauka įrašyta');
    } catch (e: unknown) {
      const msg = e && typeof e === 'object' && 'message' in e ? String((e as { message: string }).message) : '';
      showToast.error(msg ? `Nepavyko įkelti: ${msg}` : 'Nepavyko įkelti nuotraukos');
    } finally {
      setIsUploading(null);
    }
  };

  const handleGenerateInvoice = async (order: Order, opts?: { fromEmailButton?: boolean }) => {
    if (isRestrictedStaff) return;
    const client = resolveClientForOrder(order);
    if (!client) {
      showToast.error('Nerastas klientas — negalima sugeneruoti sąskaitos. Redaguokite užsakymą.');
      return;
    }
    setInvoiceActionOrderId(order.id);
    try {
      const result = await generateInvoicePDF(order, client);
      if (result.method === 'email') {
        showToast.success(result.detail, 10_000);
        setInvoiceEmailSentOrderId(order.id);
      } else if (opts?.fromEmailButton) {
        showToast.success(result.detail, 9000);
      } else {
        showToast.success(result.detail);
      }
    } catch (e: unknown) {
      console.error(e);
      const msg = e instanceof Error ? e.message.trim() : '';
      if (msg) {
        showToast.error(
          /resend|el\. pašt|email|domain|verify|smtp|502|503|401|fetch/i.test(msg)
            ? `El. paštas / serveris: ${msg}`
            : `Nepavyko: ${msg}`
        );
      } else {
        showToast.error('Nepavyko sugeneruoti PDF arba išsiųsti el. paštu.');
      }
    } finally {
      setInvoiceActionOrderId(null);
    }
  };

  /** Aiškus kelias į el. paštą (automatinis per Resend arba Outlook / mailto su priedu). */
  const handleSendInvoiceByEmail = async (order: Order) => {
    if (isRestrictedStaff) return;
    const client = resolveClientForOrder(order);
    if (!client) {
      showToast.error('Nerastas klientas.');
      return;
    }
    const em = client.email?.trim() ?? '';
    if (!em || !looksLikeValidEmail(em)) {
      showToast.error('Kliento kortelėje nėra el. pašto. Skiltyje „Klientai“ redaguokite klientą ir įrašykite adresą.');
      return;
    }
    await handleGenerateInvoice(order, { fromEmailButton: true });
  };

  const handleDelete = async (id: string) => {
    if (isRestrictedStaff) return;
    if (!window.confirm('Ar tikrai norite ištrinti šį užsakymą?')) return;
    
    setIsDeleting(id);
    try {
      await deleteData(TABLES.ORDERS, id);
      showToast.success('Užsakymas sėkmingai ištrintas');
    } catch (error) {
      showToast.error('Nepavyko ištrinti užsakymo');
      console.error('Error deleting order:', error);
    } finally {
      setIsDeleting(null);
    }
  };

  const startEdit = (order: Order) => {
    setEditingOrder(order);
    setOrderPriceManual(true);
    setOrderPriceOverride(
      typeof order.totalPrice === 'number' && Number.isFinite(order.totalPrice)
        ? String(Math.round(order.totalPrice * 100) / 100)
        : ''
    );
    setFormData({
      clientId: order.clientId,
      employeeId: order.employeeId || '',
      date: order.date,
      time: order.time,
      windowCount: order.windowCount,
      floor: order.floor,
      additionalServices: { ...order.additionalServices },
      notes: order.notes || '',
      estimatedDuration: order.estimatedDuration || 60,
      isRecurring: order.isRecurring || false,
      recurringInterval: order.recurringInterval || 3,
    });
    setIsAdding(true);
    setClientMode('existing');
  };

  const sendSMS = (order: Order) => {
    const client = clients.find(c => c.id === order.clientId);
    if (!client || !client.phone) {
      showToast.error('Klientas neturi telefono numerio.');
      return;
    }

    let text = settings.smsTemplate || "Sveiki {vardas}, primename apie langų valymą {data} {laikas}. Kaina: {kaina}. Iki pasimatymo!";
    const vardas = resolveOrderClientName(order) || client.name || 'kliente';
    text = text.replace('{vardas}', vardas)
      .replace('{data}', formatDate(order.date))
      .replace('{laikas}', order.time)
      .replace('{kaina}', formatCurrency(order.totalPrice));

    window.open(`sms:${client.phone}?body=${encodeURIComponent(text)}`);
  };

  const requestFeedback = (order: Order) => {
    const client = clients.find(c => c.id === order.clientId);
    if (!client || !client.phone) {
      showToast.error('Klientas neturi telefono numerio.');
      return;
    }

    const vardas = resolveOrderClientName(order) || client.name || 'kliente';
    const text = `Sveiki, ${vardas}! Dėkojame, kad naudojatės mūsų paslaugomis. Būtume labai dėkingi, jei paliktumėte atsiliepimą: https://g.page/r/your-google-review-link/review`;
    window.open(`sms:${client.phone}?body=${encodeURIComponent(text)}`);
  };

  const toggleSelectAllVisible = () => {
    if (allVisibleSelected) {
      setSelectedOrderIds((prev) => prev.filter((id) => !visibleOrderIds.includes(id)));
      return;
    }
    setSelectedOrderIds((prev) => Array.from(new Set([...prev, ...visibleOrderIds])));
  };

  const toggleSelectOrder = (orderId: string) => {
    setSelectedOrderIds((prev) =>
      prev.includes(orderId) ? prev.filter((id) => id !== orderId) : [...prev, orderId]
    );
  };

  const runBulkStatusUpdate = async (status: OrderStatus) => {
    if (selectedOrderIds.length === 0) return;
    setIsBulkUpdating(true);
    try {
      await Promise.all(selectedOrderIds.map((id) => updateData(TABLES.ORDERS, id, { status } as any)));
      showToast.success(`Atnaujinta užsakymų: ${selectedOrderIds.length}`);
      setSelectedOrderIds([]);
    } catch {
      showToast.error('Nepavyko masiškai atnaujinti būsenos');
    } finally {
      setIsBulkUpdating(false);
    }
  };

  const runBulkAssignEmployee = async () => {
    if (selectedOrderIds.length === 0) return;
    setIsBulkUpdating(true);
    try {
      await Promise.all(
        selectedOrderIds.map((id) =>
          updateData(TABLES.ORDERS, id, { employeeId: bulkEmployeeId || '' } as any)
        )
      );
      showToast.success(`Priskyrimas atnaujintas: ${selectedOrderIds.length}`);
      setSelectedOrderIds([]);
      setBulkEmployeeId('');
    } catch {
      showToast.error('Nepavyko masiškai priskirti darbuotojo');
    } finally {
      setIsBulkUpdating(false);
    }
  };

  const handleQuickAssign = async (order: Order, employeeId: string) => {
    setAssigningOrderId(order.id);
    try {
      await updateData(TABLES.ORDERS, order.id, { employeeId: employeeId || '' } as any);
      showToast.success(employeeId ? 'Darbuotojas priskirtas' : 'Priskyrimas pašalintas');
    } catch {
      showToast.error('Nepavyko atnaujinti darbuotojo priskyrimo');
    } finally {
      setAssigningOrderId(null);
    }
  };

  return (
    <div className="space-y-6">
      <details className="group bg-slate-50 border border-slate-200 rounded-2xl px-4 py-3 text-slate-800 shadow-sm">
        <summary className="flex cursor-pointer list-none items-center gap-2 font-semibold text-sm text-slate-900 [&::-webkit-details-marker]:hidden">
          <HelpCircle className="h-4 w-4 shrink-0 text-blue-600" aria-hidden />
          Kaip naudotis užsakymais
          <span className="ml-auto text-xs font-normal text-slate-500 group-open:hidden">(bakstelėkite)</span>
        </summary>
        <ul className="mt-3 space-y-2 text-xs text-slate-600 leading-relaxed border-t border-slate-200/80 pt-3">
          <li>
            <strong className="text-slate-800">Pradėti</strong> — pažymi, kad vykstate į objektą (būsena „Vykdoma“).
          </li>
          <li>
            <strong className="text-slate-800">Baigti</strong> — darbas atliktas (būsena „Atlikta“; tada galite „Sąskaita“ ir SMS).
          </li>
          <li>
            <strong className="text-slate-800">Nepriskirtas</strong> — pasirinkite darbuotoją iš sąrašo šalia.
          </li>
          <li>
            <strong className="text-slate-800">Įkelti</strong> prie „Prieš / Po“ — nuotrauka suspaudžiama ir išsaugoma prie užsakymo.
          </li>
          <li>
            <strong className="text-slate-800">Trys taškai (⋮)</strong> — redaguoti arba ištrinti užsakymą (bakstelėkite piktogramą).
          </li>
        </ul>
      </details>

      <div className="flex justify-between items-center">
        <h2 className="text-xl font-bold text-slate-900">Užsakymai</h2>
        <div className="flex items-center gap-2">
          <button
            type="button"
            title="Naujas užsakymas"
            aria-label="Naujas užsakymas"
            onClick={() => {
              setEditingOrder(null);
              setOrderPriceManual(false);
              setOrderPriceOverride('');
              setIsAdding(true);
            }}
            className="hidden sm:inline-flex items-center gap-2 bg-blue-600 text-white px-4 py-2.5 rounded-2xl shadow-lg shadow-blue-200 hover:bg-blue-700 transition-colors text-sm font-bold"
          >
            <Plus size={18} />
            Naujas užsakymas
          </button>
          <button
            type="button"
            title="Naujas užsakymas"
            aria-label="Naujas užsakymas"
            onClick={() => {
              setEditingOrder(null);
              setOrderPriceManual(false);
              setOrderPriceOverride('');
              setIsAdding(true);
            }}
            className="sm:hidden bg-blue-600 text-white p-3 rounded-2xl shadow-lg shadow-blue-200 hover:bg-blue-700 transition-colors"
          >
            <Plus size={20} />
          </button>
        </div>
      </div>

      <div className="flex flex-col md:flex-row gap-4">
        <div className="relative flex-1">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
          <input
            type="text"
            placeholder="Ieškoti užsakymo..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full bg-white border border-slate-100 rounded-2xl py-4 pl-12 pr-4 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20 shadow-sm"
          />
        </div>
        <div className="flex gap-2 overflow-x-auto pb-2 md:pb-0 no-scrollbar">
          {(['all', 'suplanuota', 'vykdoma', 'atlikta'] as const).map((status) => (
            <button
              key={status}
              type="button"
              onClick={() => setStatusFilter(status)}
              className={`px-4 py-2 rounded-xl text-xs font-bold whitespace-nowrap transition-all ${statusFilter === status
                ? 'bg-blue-600 text-white shadow-lg shadow-blue-200'
                : 'bg-white text-slate-600 border border-slate-100 hover:bg-slate-50'
                }`}
            >
              {status === 'all' ? 'Visi' : ORDER_STATUS_LABEL_LT[status]}
            </button>
          ))}
        </div>
      </div>

      <div className="flex gap-2 overflow-x-auto pb-1 no-scrollbar">
        <button
          type="button"
          onClick={() => setFocusFilter('all')}
          className={`px-3 py-2 rounded-xl text-xs font-bold whitespace-nowrap transition-all ${focusFilter === 'all'
              ? 'bg-slate-900 text-white'
              : 'bg-white text-slate-600 border border-slate-100 hover:bg-slate-50'
            }`}
        >
          Visi darbai
        </button>
        <button
          type="button"
          onClick={() => setFocusFilter('today')}
          className={`px-3 py-2 rounded-xl text-xs font-bold whitespace-nowrap transition-all ${focusFilter === 'today'
              ? 'bg-blue-600 text-white'
              : 'bg-white text-slate-600 border border-slate-100 hover:bg-slate-50'
            }`}
        >
          Šiandien ({todayCount})
        </button>
        <button
          type="button"
          onClick={() => setFocusFilter('overdue')}
          className={`px-3 py-2 rounded-xl text-xs font-bold whitespace-nowrap transition-all ${focusFilter === 'overdue'
              ? 'bg-red-600 text-white'
              : 'bg-white text-slate-600 border border-slate-100 hover:bg-slate-50'
            }`}
        >
          Pavėluoti ({overdueCount})
        </button>
        <button
          type="button"
          onClick={() => setFocusFilter('unassigned')}
          className={`px-3 py-2 rounded-xl text-xs font-bold whitespace-nowrap transition-all ${focusFilter === 'unassigned'
              ? 'bg-amber-600 text-white'
              : 'bg-white text-slate-600 border border-slate-100 hover:bg-slate-50'
            }`}
        >
          Nepriskirti ({unassignedCount})
        </button>
      </div>

      <section className="bg-white border border-slate-100 rounded-2xl p-3 shadow-sm">
        <div className="flex flex-col md:flex-row md:items-center gap-3">
          <div className="flex items-center gap-3">
            <label className="inline-flex items-center gap-2 text-sm font-semibold text-slate-700">
              <input
                type="checkbox"
                checked={allVisibleSelected}
                onChange={toggleSelectAllVisible}
                className="w-4 h-4 rounded border-slate-300 text-blue-600 focus:ring-blue-500"
              />
              Pažymėti visus rodomus
            </label>
            <span className="text-xs text-slate-500">Pažymėta: {selectedOrderIds.length}</span>
          </div>
          <div className="flex flex-wrap items-center gap-2 md:ml-auto">
            <button
              type="button"
              disabled={selectedOrderIds.length === 0 || isBulkUpdating}
              onClick={() => runBulkStatusUpdate('vykdoma')}
              className="px-3 py-2 rounded-xl text-xs font-bold bg-blue-600 text-white disabled:opacity-50"
            >
              Žymėti „vykdoma“
            </button>
            <button
              type="button"
              disabled={selectedOrderIds.length === 0 || isBulkUpdating}
              onClick={() => runBulkStatusUpdate('atlikta')}
              className="px-3 py-2 rounded-xl text-xs font-bold bg-emerald-600 text-white disabled:opacity-50"
            >
              Žymėti „atlikta“
            </button>
            <select
              value={bulkEmployeeId}
              onChange={(e) => setBulkEmployeeId(e.target.value)}
              title="Pasirinkti darbuotoją masiniam priskyrimui"
              aria-label="Pasirinkti darbuotoją masiniam priskyrimui"
              className="px-2 py-2 rounded-xl text-xs border border-slate-200 bg-white"
            >
              <option value="">Nepriskirti</option>
              {employees.filter((e) => e.isActive).map((emp) => (
                <option key={emp.id} value={emp.id}>
                  {emp.name}
                </option>
              ))}
            </select>
            <button
              type="button"
              disabled={selectedOrderIds.length === 0 || isBulkUpdating}
              onClick={runBulkAssignEmployee}
              className="px-3 py-2 rounded-xl text-xs font-bold bg-amber-600 text-white disabled:opacity-50"
            >
              Priskirti darbuotoją
            </button>
          </div>
        </div>
      </section>

      <div className="space-y-4">
        {filteredOrders.map((order) => (
          <motion.div
            layout
            key={order.id}
            className="bg-white rounded-3xl border border-slate-100 shadow-sm overflow-hidden"
          >
            <div className="p-4 border-b border-slate-50 flex justify-between items-center bg-slate-50/50">
              <div className="flex items-center gap-2">
                <input
                  type="checkbox"
                  checked={selectedOrderIds.includes(order.id)}
                  onChange={() => toggleSelectOrder(order.id)}
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
                    <span className="text-xs font-bold text-slate-500">~{formatDuration(order.estimatedDuration)}</span>
                  </>
                )}
                {order.employeeId && (
                  <>
                    <span className="text-slate-300 mx-2">•</span>
                    <div className="flex items-center gap-1 text-xs font-bold text-slate-600">
                      <Users size={12} className="text-blue-500" />
                      {employees.find(e => e.id === order.employeeId)?.name || 'Nežinomas'}
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
                  className={`px-2 py-1 rounded-full text-[10px] font-bold tracking-wider ${order.status === 'atlikta' ? 'bg-emerald-50 text-emerald-600' :
                  order.status === 'vykdoma' ? 'bg-blue-50 text-blue-600' : 'bg-amber-50 text-amber-600'
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
                      setActionsMenuOrderId((id) => (id === order.id ? null : order.id));
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
                          startEdit(order);
                          setActionsMenuOrderId(null);
                        }}
                        className="w-full text-left px-4 py-3 text-xs font-bold text-slate-700 hover:bg-slate-50"
                      >
                        Redaguoti užsakymą
                      </button>
                      {!isRestrictedStaff && (
                      <button
                        type="button"
                        role="menuitem"
                        onClick={() => {
                          handleDelete(order.id);
                          setActionsMenuOrderId(null);
                        }}
                        className="w-full text-left px-4 py-3 text-xs font-bold text-red-600 hover:bg-red-50"
                      >
                        Ištrinti
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
                        <span className="text-amber-700 font-medium">Adresas neįvestas — atidarykite ⋮ → Redaguoti</span>
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
                      onChange={(e) => handleQuickAssign(order, e.target.value)}
                      disabled={assigningOrderId === order.id}
                      title="Greitas darbuotojo priskyrimas"
                      aria-label={`Greitas darbuotojo priskyrimas užsakymui ${resolveOrderClientName(order) || '—'}`}
                      className="w-full bg-slate-50 border border-slate-100 rounded-xl py-2.5 px-2 text-xs font-semibold text-slate-700 focus:outline-none focus:ring-2 focus:ring-blue-500/20 disabled:opacity-60 min-h-[44px]"
                    >
                      <option value="">Nepriskirtas</option>
                      {employees.filter((e) => e.isActive).map((emp) => (
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
                      onClick={() => handleStatusUpdate(order, order.status === 'suplanuota' ? 'vykdoma' : 'atlikta')}
                      title={order.status === 'suplanuota' ? 'Pažymėti užsakymą kaip vykdomą' : 'Pažymėti užsakymą kaip atliktą'}
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
                      onClick={() => requestFeedback(order)}
                      className="bg-amber-50 text-amber-500 p-2.5 rounded-xl hover:bg-amber-100 transition-colors shrink-0 min-h-[44px] min-w-[44px] flex items-center justify-center"
                      title="Prašyti atsiliepimo (SMS)"
                      aria-label="Prašyti atsiliepimo SMS"
                    >
                      <Star size={16} aria-hidden />
                    </button>
                  )}
                  <button
                    type="button"
                    onClick={() => sendSMS(order)}
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
                      onClick={() => handleGenerateInvoice(order)}
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
                      onClick={() => handleSendInvoiceByEmail(order)}
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

              {/* Nuotraukų dokumentacija */}
              <div className="mt-6 pt-6 border-t border-slate-50">
                <div className="flex items-center gap-2 mb-4">
                  <Camera size={16} className="text-slate-400" />
                  <h4 className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Nuotraukų dokumentacija</h4>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  {/* Prieš */}
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
                            onChange={(e) => e.target.files?.[0] && handlePhotoUpload(order, 'before', e.target.files[0])}
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
                          onChange={(e) => e.target.files?.[0] && handlePhotoUpload(order, 'before', e.target.files[0])}
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

                  {/* Po */}
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
                            onChange={(e) => e.target.files?.[0] && handlePhotoUpload(order, 'after', e.target.files[0])}
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
                          onChange={(e) => e.target.files?.[0] && handlePhotoUpload(order, 'after', e.target.files[0])}
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
                  {editingOrder ? 'Redaguoti užsakymą' : 'Naujas užsakymas'}
                </h3>
                <button
                  type="button"
                  onClick={() => {
                    setIsAdding(false);
                    setEditingOrder(null);
                    setOrderPriceManual(false);
                    setOrderPriceOverride('');
                  }}
                  title="Uždaryti formą"
                  aria-label="Uždaryti formą"
                  className="p-2 text-slate-400 hover:text-slate-600"
                >
                  <X size={24} />
                </button>
              </div>

              <form onSubmit={handleSubmit} className="space-y-4">
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
                  <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1">Klientas</label>
                  <select
                    required
                    value={formData.clientId}
                    onChange={(e) => setFormData({ ...formData, clientId: e.target.value })}
                    title="Klientas"
                    className="w-full bg-slate-50 border border-slate-100 rounded-xl p-3 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20"
                  >
                    <option value="">Pasirinkite klientą</option>
                    {clients.map(c => (
                      <option key={c.id} value={c.id}>{c.name} - {c.address}</option>
                    ))}
                  </select>
                </div>
                ) : (
                  <div className="grid grid-cols-1 gap-3">
                    <div>
                      <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1">Kliento vardas</label>
                      <input
                        required
                        type="text"
                        value={newClientData.name}
                        onChange={(e) => setNewClientData((prev) => ({ ...prev, name: e.target.value }))}
                        className="w-full bg-slate-50 border border-slate-100 rounded-xl p-3 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20"
                        placeholder="Pvz. Jonas Jonaitis"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1">Telefonas</label>
                      <input
                        type="text"
                        value={newClientData.phone}
                        onChange={(e) => setNewClientData((prev) => ({ ...prev, phone: e.target.value }))}
                        className="w-full bg-slate-50 border border-slate-100 rounded-xl p-3 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20"
                        placeholder="+370..."
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1">El. paštas (neprivaloma)</label>
                      <input
                        type="email"
                        inputMode="email"
                        autoComplete="email"
                        value={newClientData.email}
                        onChange={(e) => setNewClientData((prev) => ({ ...prev, email: e.target.value }))}
                        className="w-full bg-slate-50 border border-slate-100 rounded-xl p-3 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20"
                        placeholder="vardas@pastas.lt"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1">Adresas</label>
                      <input
                        required
                        type="text"
                        value={newClientData.address}
                        onChange={(e) => setNewClientData((prev) => ({ ...prev, address: e.target.value }))}
                        className="w-full bg-slate-50 border border-slate-100 rounded-xl p-3 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20"
                        placeholder="Gatvė, miestas"
                      />
                    </div>
                  </div>
                )}

                <div>
                  <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1">Priskirtas darbuotojas</label>
                  <select
                    value={formData.employeeId}
                    onChange={(e) => setFormData({ ...formData, employeeId: e.target.value })}
                    title="Priskirtas darbuotojas"
                    className="w-full bg-slate-50 border border-slate-100 rounded-xl p-3 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20"
                  >
                    <option value="">Nepriskirtas</option>
                    {employees.filter(e => e.isActive).map(emp => (
                      <option key={emp.id} value={emp.id}>{emp.name}</option>
                    ))}
                  </select>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1">Data</label>
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
                    <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1">Laikas</label>
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
                    <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1">Langų skaičius</label>
                    <input
                      required
                      type="number"
                      value={formData.windowCount}
                      onChange={(e) => setFormData({ ...formData, windowCount: parseInt(e.target.value) })}
                      title="Langų skaičius"
                      className="w-full bg-slate-50 border border-slate-100 rounded-xl p-3 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1">Aukštas</label>
                    <input
                      required
                      type="number"
                      value={formData.floor}
                      onChange={(e) => setFormData({ ...formData, floor: parseInt(e.target.value) })}
                      title="Aukštas"
                      className="w-full bg-slate-50 border border-slate-100 rounded-xl p-3 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">Trukmė</label>
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
                      <span className="text-[10px] text-slate-400 font-bold uppercase block text-center">d.</span>
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
                      <span className="text-[10px] text-slate-400 font-bold uppercase block text-center">val.</span>
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
                      <span className="text-[10px] text-slate-400 font-bold uppercase block text-center">min.</span>
                    </div>
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1">Papildomos paslaugos</label>
                  <div className="grid grid-cols-2 gap-2">
                    {Object.entries(formData.additionalServices).map(([key, val]) => (
                      <button
                        key={key}
                        type="button"
                        onClick={() => setFormData({
                          ...formData,
                          additionalServices: { ...formData.additionalServices, [key]: !val }
                        })}
                        className={`py-2 rounded-xl text-xs font-bold capitalize border transition-all ${val ? 'bg-blue-50 text-blue-600 border-blue-200' : 'bg-white text-slate-400 border-slate-100'
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
                      onClick={() => setFormData({ ...formData, isRecurring: !formData.isRecurring })}
                      className={`w-12 h-6 rounded-full transition-colors relative ${formData.isRecurring ? 'bg-blue-500' : 'bg-slate-300'
                        }`}
                    >
                      <div className={`w-4 h-4 rounded-full bg-white absolute top-1 transition-transform ${formData.isRecurring ? 'left-7' : 'left-1'
                        }`} />
                    </button>
                  </div>

                  {formData.isRecurring && (
                    <div className="pt-2 border-t border-slate-200">
                      <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1">Intervalas (mėnesiais)</label>
                      <input
                        type="number"
                        min="1"
                        max="12"
                        title="Periodiškumo intervalas mėnesiais"
                        value={formData.recurringInterval}
                        onChange={(e) => setFormData({ ...formData, recurringInterval: parseInt(e.target.value) || 3 })}
                        className="w-full bg-white border border-slate-200 rounded-xl p-3 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20"
                      />
                    </div>
                  )}
                </div>

                <div className="bg-blue-50 p-4 rounded-2xl border border-blue-100 space-y-3">
                  <div className="flex justify-between items-center gap-2">
                    <span className="text-sm font-bold text-blue-900">Kaina pagal įkainius</span>
                    <span className="text-lg font-black text-blue-600 tabular-nums">{formatCurrency(totalPrice)}</span>
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
                    <p className="text-xs text-blue-900/75">Į užsakymą bus įrašyta kaina pagal nustatymų įkainius.</p>
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
                  ) : (
                    editingOrder ? 'Išsaugoti pakeitimus' : 'Sukurti užsakymą'
                  )}
                </button>
              </form>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
