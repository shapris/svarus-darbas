/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useCallback } from 'react';
import { Order, Client, AppSettings, OrderStatus, Employee } from '../types';
import { MAX_PHOTO_DATA_URL_LENGTH, ORDER_STATUS_LABEL_LT } from './orders/orderConstants';
import { addData, updateData, deleteData, TABLES } from '../supabase';
import {
  calculateOrderPrice,
  formatCurrency,
  formatDate,
  geocodeAddress,
  generateInvoicePDF,
  looksLikeValidEmail,
  compressImageToJpegDataUrl,
} from '../utils';
import { useToast } from '../hooks/useToast';
import { useOrgAccess } from '../contexts/OrgAccessContext';
import { Plus, Search, Download, HelpCircle } from 'lucide-react';
import { OrderListCard } from './orders/OrderListCard';
import { OrderFormModal } from './orders/OrderFormModal';

interface LocalUser {
  uid: string;
}

interface OrdersViewProps {
  orders: Order[];
  clients: Client[];
  settings: AppSettings;
  user: LocalUser;
  employees: Employee[];
}

export default function OrdersView({
  orders,
  clients,
  settings,
  user,
  employees,
}: OrdersViewProps) {
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

  const filteredOrders = orders
    .filter((o) => {
      const statusMatch = statusFilter === 'all' || o.status === statusFilter;
      const textMatch =
        (o.clientName || '').toLowerCase().includes(search.toLowerCase()) ||
        (o.address || '').toLowerCase().includes(search.toLowerCase());
      const focusMatch =
        focusFilter === 'all'
          ? true
          : focusFilter === 'today'
            ? o.status !== 'atlikta' && o.date === today
            : focusFilter === 'overdue'
              ? o.status !== 'atlikta' && o.date < today
              : o.status !== 'atlikta' && !o.employeeId;

      return statusMatch && textMatch && focusMatch;
    })
    .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());

  const visibleOrderIds = filteredOrders.map((o) => o.id);
  const selectedVisibleCount = selectedOrderIds.filter((id) => visibleOrderIds.includes(id)).length;
  const allVisibleSelected =
    visibleOrderIds.length > 0 && selectedVisibleCount === visibleOrderIds.length;

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
        orderClient = clients.find((c) => c.id === formData.clientId) || null;
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
        } as Record<string, unknown>);
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
        await updateData(TABLES.ORDERS, editingOrder.id, orderData as Record<string, unknown>);
      } else {
        await addData(TABLES.ORDERS, user.uid, orderData as Record<string, unknown>);
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
      await updateData(TABLES.ORDERS, order.id, { status } as Record<string, unknown>);

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

        await addData(TABLES.ORDERS, user.uid, newOrderData as Record<string, unknown>);
        showToast.success(
          `Užsakymas baigtas. Sukurtas naujas periodinis užsakymas: ${newOrderData.date}`
        );
      }
      if (status === 'atlikta' && !order.isRecurring) {
        showToast.success('Užsakymas pažymėtas kaip atliktas');
      }
    } catch (err: unknown) {
      const details =
        err && typeof err === 'object' && 'message' in err
          ? ` (${String((err as { message: unknown }).message)})`
          : '';
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
        showToast.error(
          'Nuotrauka per didelė po suspaudimo. Bandykite mažesnę raišką arba kitą kadrą.'
        );
        return;
      }
      const patch = type === 'before' ? { photoBefore: dataUrl } : { photoAfter: dataUrl };
      await updateData(TABLES.ORDERS, order.id, patch as Record<string, unknown>);
      showToast.success(type === 'before' ? '„Prieš“ nuotrauka įrašyta' : '„Po“ nuotrauka įrašyta');
    } catch (e: unknown) {
      const msg =
        e && typeof e === 'object' && 'message' in e
          ? String((e as { message: string }).message)
          : '';
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
      const msg = e instanceof Error ? e.message.trim() : '';
      if (msg) {
        showToast.error(
          /resend|el\. pašt|email|domain|verify|smtp|502|422|503|401|fetch|pasiekiamas/i.test(msg)
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
      showToast.error(
        'Kliento kortelėje nėra el. pašto. Skiltyje „Klientai“ redaguokite klientą ir įrašykite adresą.'
      );
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
    } catch {
      showToast.error('Nepavyko ištrinti užsakymo');
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
    const client = clients.find((c) => c.id === order.clientId);
    if (!client || !client.phone) {
      showToast.error('Klientas neturi telefono numerio.');
      return;
    }

    let text =
      settings.smsTemplate ||
      'Sveiki {vardas}, primename apie langų valymą {data} {laikas}. Kaina: {kaina}. Iki pasimatymo!';
    const vardas = resolveOrderClientName(order) || client.name || 'kliente';
    text = text
      .replace('{vardas}', vardas)
      .replace('{data}', formatDate(order.date))
      .replace('{laikas}', order.time)
      .replace('{kaina}', formatCurrency(order.totalPrice));

    window.open(`sms:${client.phone}?body=${encodeURIComponent(text)}`);
  };

  const requestFeedback = (order: Order) => {
    const client = clients.find((c) => c.id === order.clientId);
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
      await Promise.all(
        selectedOrderIds.map((id) =>
          updateData(TABLES.ORDERS, id, { status } as Record<string, unknown>)
        )
      );
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
          updateData(TABLES.ORDERS, id, {
            employeeId: bulkEmployeeId || '',
          } as Record<string, unknown>)
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
      await updateData(TABLES.ORDERS, order.id, {
        employeeId: employeeId || '',
      } as Record<string, unknown>);
      showToast.success(employeeId ? 'Darbuotojas priskirtas' : 'Priskyrimas pašalintas');
    } catch {
      showToast.error('Nepavyko atnaujinti darbuotojo priskyrimo');
    } finally {
      setAssigningOrderId(null);
    }
  };

  /** Eksportas operacijai: dabartinis filtras (CSV, UTF-8 su BOM Exceliui). */
  const handleExportCsv = () => {
    const esc = (val: string) => {
      const s = String(val ?? '');
      if (/[",\n\r]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
      return s;
    };
    const header = [
      'id',
      'data',
      'laikas',
      'klientas',
      'adresas',
      'statusas',
      'langai',
      'aukstas',
      'kaina_eur',
      'darbuotojas',
      'pastabos',
    ];
    const lines = [
      header.join(','),
      ...filteredOrders.map((o) => {
        const emp = employees.find((e) => e.id === o.employeeId)?.name ?? '';
        return [
          esc(o.id),
          esc(o.date),
          esc(o.time),
          esc(resolveOrderClientName(o)),
          esc(orderDisplayAddress(o)),
          esc(o.status),
          esc(String(o.windowCount)),
          esc(String(o.floor)),
          esc(String(o.totalPrice)),
          esc(emp),
          esc(o.notes ?? ''),
        ].join(',');
      }),
    ];
    const csv = `\ufeff${lines.join('\n')}`;
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `uzsakymai_${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
    showToast.success(
      filteredOrders.length
        ? `CSV: ${filteredOrders.length} užsakymų (pagal filtrus)`
        : 'CSV tuščias — pakeiskite filtrus'
    );
  };

  return (
    <div className="space-y-6">
      <details className="group bg-slate-50 border border-slate-200 rounded-2xl px-4 py-3 text-slate-800 shadow-sm">
        <summary className="flex cursor-pointer list-none items-center gap-2 font-semibold text-sm text-slate-900 [&::-webkit-details-marker]:hidden">
          <HelpCircle className="h-4 w-4 shrink-0 text-blue-600" aria-hidden />
          Kaip naudotis užsakymais
          <span className="ml-auto text-xs font-normal text-slate-500 group-open:hidden">
            (bakstelėkite)
          </span>
        </summary>
        <ul className="mt-3 space-y-2 text-xs text-slate-600 leading-relaxed border-t border-slate-200/80 pt-3">
          <li>
            <strong className="text-slate-800">Pradėti</strong> — pažymi, kad vykstate į objektą
            (būsena „Vykdoma“).
          </li>
          <li>
            <strong className="text-slate-800">Baigti</strong> — darbas atliktas (būsena „Atlikta“;
            tada galite „Sąskaita“ ir SMS).
          </li>
          <li>
            <strong className="text-slate-800">Nepriskirtas</strong> — pasirinkite darbuotoją iš
            sąrašo šalia.
          </li>
          <li>
            <strong className="text-slate-800">Įkelti</strong> prie „Prieš / Po“ — nuotrauka
            suspaudžiama ir išsaugoma prie užsakymo.
          </li>
          <li>
            <strong className="text-slate-800">Trys taškai (⋮)</strong> — redaguoti arba ištrinti
            užsakymą (bakstelėkite piktogramą).
          </li>
        </ul>
      </details>

      <div className="flex justify-between items-center">
        <h2 className="text-xl font-bold text-slate-900">Užsakymai</h2>
        <div className="flex items-center gap-2">
          <button
            type="button"
            title="Eksportuoti matomą sąrašą į CSV"
            aria-label="Eksportuoti užsakymus CSV"
            onClick={handleExportCsv}
            className="hidden sm:inline-flex items-center gap-2 bg-white border border-slate-200 text-slate-800 px-4 py-2.5 rounded-2xl shadow-sm hover:border-slate-300 transition-colors text-sm font-bold"
          >
            <Download size={18} aria-hidden />
            CSV
          </button>
          <button
            type="button"
            title="Eksportuoti CSV"
            aria-label="Eksportuoti užsakymus CSV"
            onClick={handleExportCsv}
            className="sm:hidden bg-white border border-slate-200 text-slate-800 p-3 rounded-2xl shadow-sm hover:border-slate-300 transition-colors"
          >
            <Download size={20} aria-hidden />
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
              className={`px-4 py-2 rounded-xl text-xs font-bold whitespace-nowrap transition-all ${
                statusFilter === status
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
          className={`px-3 py-2 rounded-xl text-xs font-bold whitespace-nowrap transition-all ${
            focusFilter === 'all'
              ? 'bg-slate-900 text-white'
              : 'bg-white text-slate-600 border border-slate-100 hover:bg-slate-50'
          }`}
        >
          Visi darbai
        </button>
        <button
          type="button"
          onClick={() => setFocusFilter('today')}
          className={`px-3 py-2 rounded-xl text-xs font-bold whitespace-nowrap transition-all ${
            focusFilter === 'today'
              ? 'bg-blue-600 text-white'
              : 'bg-white text-slate-600 border border-slate-100 hover:bg-slate-50'
          }`}
        >
          Šiandien ({todayCount})
        </button>
        <button
          type="button"
          onClick={() => setFocusFilter('overdue')}
          className={`px-3 py-2 rounded-xl text-xs font-bold whitespace-nowrap transition-all ${
            focusFilter === 'overdue'
              ? 'bg-red-600 text-white'
              : 'bg-white text-slate-600 border border-slate-100 hover:bg-slate-50'
          }`}
        >
          Pavėluoti ({overdueCount})
        </button>
        <button
          type="button"
          onClick={() => setFocusFilter('unassigned')}
          className={`px-3 py-2 rounded-xl text-xs font-bold whitespace-nowrap transition-all ${
            focusFilter === 'unassigned'
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
              {employees
                .filter((e) => e.isActive)
                .map((emp) => (
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
          <OrderListCard
            key={order.id}
            order={order}
            employees={employees}
            isRestrictedStaff={isRestrictedStaff}
            selectedOrderIds={selectedOrderIds}
            actionsMenuOrderId={actionsMenuOrderId}
            assigningOrderId={assigningOrderId}
            statusUpdatingOrderId={statusUpdatingOrderId}
            isDeleting={isDeleting}
            isUploading={isUploading}
            invoiceActionOrderId={invoiceActionOrderId}
            invoiceEmailSentOrderId={invoiceEmailSentOrderId}
            resolveOrderClientName={resolveOrderClientName}
            orderDisplayAddress={orderDisplayAddress}
            resolveClientForOrder={resolveClientForOrder}
            onToggleSelect={toggleSelectOrder}
            onOpenActionsMenu={setActionsMenuOrderId}
            onStartEdit={startEdit}
            onDelete={handleDelete}
            onQuickAssign={handleQuickAssign}
            onStatusUpdate={handleStatusUpdate}
            onRequestFeedback={requestFeedback}
            onSendSms={sendSMS}
            onGenerateInvoice={handleGenerateInvoice}
            onSendInvoiceByEmail={handleSendInvoiceByEmail}
            onPhotoUpload={handlePhotoUpload}
          />
        ))}
      </div>

      <OrderFormModal
        open={isAdding}
        editingOrder={editingOrder}
        onClose={() => {
          setIsAdding(false);
          setEditingOrder(null);
          setOrderPriceManual(false);
          setOrderPriceOverride('');
        }}
        onSubmit={handleSubmit}
        clientMode={clientMode}
        setClientMode={setClientMode}
        formData={formData}
        setFormData={setFormData}
        newClientData={newClientData}
        setNewClientData={setNewClientData}
        clients={clients}
        employees={employees}
        orderPriceManual={orderPriceManual}
        setOrderPriceManual={setOrderPriceManual}
        orderPriceOverride={orderPriceOverride}
        setOrderPriceOverride={setOrderPriceOverride}
        totalPrice={totalPrice}
        parsedOrderPriceOverride={parsedOrderPriceOverride}
        isSaving={isSaving}
      />
    </div>
  );
}
