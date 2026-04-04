/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useCallback, useMemo } from 'react';
import {
  CreditCard,
  DollarSign,
  FileText,
  Download,
  RefreshCw,
  AlertCircle,
  CheckCircle,
  Clock,
  X,
} from 'lucide-react';
import { Client, Invoice, Order, Transaction } from '../types';
import {
  formatAmountFromEur,
  getInvoiceStatusText,
  getInvoiceStatusColor,
} from '../services/paymentService';
import { fetchPaymentsWorkspaceData, updateInvoiceStatusInSupabase } from '../supabase';
import { motion } from 'motion/react';
import { useToast } from '../hooks/useToast';
import { generateInvoicePDF } from '../utils';

interface PaymentsViewProps {
  user: { uid: string };
  clients: Client[];
  orders: Order[];
}

export default function PaymentsView({ user, clients, orders }: PaymentsViewProps) {
  const { showToast } = useToast();
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [loading, setLoading] = useState(true);
  const [tablesMissing, setTablesMissing] = useState(false);
  const [workspaceError, setWorkspaceError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<'invoices' | 'transactions'>('invoices');
  const [selectedInvoice, setSelectedInvoice] = useState<Invoice | null>(null);

  const stats = useMemo(() => {
    const totalRevenue = transactions
      .filter((t) => t.type === 'payment' && t.status === 'succeeded')
      .reduce((sum, t) => sum + t.amount, 0);

    const pendingPayments = invoices
      .filter((inv) => inv.status === 'pending')
      .reduce((sum, inv) => sum + inv.amount, 0);

    return {
      totalRevenue,
      pendingPayments,
      paidInvoices: invoices.filter((inv) => inv.status === 'paid').length,
      pendingInvoices: invoices.filter((inv) => inv.status === 'pending').length,
    };
  }, [invoices, transactions]);

  const loadData = useCallback(async () => {
    if (!user?.uid) {
      setLoading(false);
      return;
    }
    setLoading(true);
    setWorkspaceError(null);
    setTablesMissing(false);
    try {
      const result = await fetchPaymentsWorkspaceData(user.uid);
      setTablesMissing(result.tablesMissing);
      setWorkspaceError(result.queryError ?? null);
      setInvoices(result.invoices);
      setTransactions(result.transactions);
    } catch (err) {
      const msg =
        err && typeof err === 'object' && 'message' in err
          ? String((err as { message: string }).message)
          : '';
      showToast.error(msg ? `Nepavyko įkelti mokėjimų: ${msg}` : 'Nepavyko įkelti mokėjimų');
    } finally {
      setLoading(false);
    }
  }, [user?.uid, showToast]);

  useEffect(() => {
    void loadData();
  }, [loadData]);

  const clientNameForInvoice = useCallback(
    (invoice: Invoice) =>
      clients.find((c) => c.id === invoice.client_id)?.name ?? invoice.client_id,
    [clients]
  );

  const downloadInvoice = async (invoice: Invoice) => {
    const rawUrl = invoice.invoice_url?.trim();
    if (rawUrl) {
      window.open(rawUrl, '_blank', 'noopener,noreferrer');
      return;
    }
    const order = orders.find((o) => o.id === invoice.order_id);
    const client =
      order != null
        ? (clients.find((c) => c.id === order.clientId) ??
          clients.find((c) => c.id === invoice.client_id))
        : clients.find((c) => c.id === invoice.client_id);
    if (order && client) {
      try {
        const result = await generateInvoicePDF(order, client);
        showToast.success(`${result.detail} (Sąskaitos nuoroda DB nebuvo — duomenys iš užsakymo.)`);
      } catch {
        showToast.error('Nepavyko sugeneruoti PDF.');
      }
      return;
    }
    showToast.error(
      'Nėra išsaugotos sąskaitos nuorodos. PDF negalima sugeneruoti — nerastas susietas užsakymas ar klientas.'
    );
  };

  const updateInvoiceStatus = async (invoiceId: string, status: Invoice['status']) => {
    try {
      const updated = await updateInvoiceStatusInSupabase(invoiceId, status);
      setInvoices((prev) => prev.map((inv) => (inv.id === invoiceId ? updated : inv)));
      setSelectedInvoice(null);
      showToast.success('Sąskaitos statusas atnaujintas');
    } catch (err) {
      const msg =
        err && typeof err === 'object' && 'message' in err
          ? String((err as { message: string }).message)
          : '';
      showToast.error(
        msg ? `Nepavyko atnaujinti sąskaitos: ${msg}` : 'Nepavyko atnaujinti sąskaitos statuso'
      );
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'paid':
        return <CheckCircle className="w-4 h-4" aria-hidden />;
      case 'pending':
        return <Clock className="w-4 h-4" aria-hidden />;
      case 'cancelled':
        return <X className="w-4 h-4" aria-hidden />;
      default:
        return <AlertCircle className="w-4 h-4" aria-hidden />;
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center p-8">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600" />
        <p className="ml-2 text-gray-500">Kraunami mokėjimai...</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {tablesMissing && (
        <div
          className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-950"
          role="status"
        >
          Mokėjimų lentelės nesukonfigūruotos arba nepasiekiamos. Supabase SQL editor įkelkite{' '}
          <code className="rounded bg-amber-100 px-1">payments-schema.sql</code> (lentelės{' '}
          <code className="rounded bg-amber-100 px-1">invoices</code> ir{' '}
          <code className="rounded bg-amber-100 px-1">transactions</code>).
        </div>
      )}
      {!tablesMissing && workspaceError && (
        <div
          className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-900"
          role="alert"
        >
          {workspaceError}
        </div>
      )}

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="bg-white rounded-lg shadow p-6"
        >
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-600">Bendros Pajamos</p>
              <p className="text-2xl font-semibold text-gray-900">
                {formatAmountFromEur(stats.totalRevenue)}
              </p>
            </div>
            <DollarSign className="w-8 h-8 text-green-600" aria-hidden />
          </div>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
          className="bg-white rounded-lg shadow p-6"
        >
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-600">Laukia Apmokėjimo</p>
              <p className="text-2xl font-semibold text-orange-600">
                {formatAmountFromEur(stats.pendingPayments)}
              </p>
            </div>
            <Clock className="w-8 h-8 text-orange-600" aria-hidden />
          </div>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
          className="bg-white rounded-lg shadow p-6"
        >
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-600">Apmokėtos Sąskaitos</p>
              <p className="text-2xl font-semibold text-green-600">{stats.paidInvoices}</p>
            </div>
            <CheckCircle className="w-8 h-8 text-green-600" aria-hidden />
          </div>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.3 }}
          className="bg-white rounded-lg shadow p-6"
        >
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-600">Laukiančios Sąskaitos</p>
              <p className="text-2xl font-semibold text-yellow-600">{stats.pendingInvoices}</p>
            </div>
            <FileText className="w-8 h-8 text-yellow-600" aria-hidden />
          </div>
        </motion.div>
      </div>

      {/* Navigation Tabs */}
      <div className="bg-white rounded-lg shadow">
        <div className="border-b border-gray-200">
          <nav className="flex space-x-8 px-6" aria-label="Mokėjimų skiltys">
            <button
              type="button"
              onClick={() => setActiveTab('invoices')}
              className={`py-4 px-1 border-b-2 font-medium text-sm transition-colors ${
                activeTab === 'invoices'
                  ? 'border-blue-500 text-blue-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
              }`}
            >
              <div className="flex items-center space-x-2">
                <FileText className="w-4 h-4" aria-hidden />
                <span>Sąskaitos</span>
              </div>
            </button>
            <button
              type="button"
              onClick={() => setActiveTab('transactions')}
              className={`py-4 px-1 border-b-2 font-medium text-sm transition-colors ${
                activeTab === 'transactions'
                  ? 'border-blue-500 text-blue-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
              }`}
            >
              <div className="flex items-center space-x-2">
                <CreditCard className="w-4 h-4" aria-hidden />
                <span>Transakcijos</span>
              </div>
            </button>
          </nav>
        </div>

        {/* Content */}
        <div className="p-6">
          {activeTab === 'invoices' && (
            <div className="space-y-4">
              <div className="flex justify-between items-center">
                <h3 className="text-lg font-medium text-gray-900">Sąskaitų Sąrašas</h3>
                <button
                  type="button"
                  onClick={() => void loadData()}
                  className="flex items-center space-x-2 px-3 py-2 text-blue-600 hover:text-blue-800 hover:bg-blue-50 rounded-lg transition-colors"
                >
                  <RefreshCw className="w-4 h-4" aria-hidden />
                  <span>Atnaujinti</span>
                </button>
              </div>

              {invoices.length === 0 ? (
                <div className="text-center py-8">
                  <FileText className="w-12 h-12 text-gray-400 mx-auto mb-4" aria-hidden />
                  <p className="text-gray-500">Sąskaitų nerasta</p>
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="min-w-full divide-y divide-gray-200">
                    <thead className="bg-gray-50">
                      <tr>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                          Sąskaitos Nr.
                        </th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                          Klientas
                        </th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                          Suma
                        </th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                          Būsena
                        </th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                          Sukurta
                        </th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                          Terminas
                        </th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                          Veiksmai
                        </th>
                      </tr>
                    </thead>
                    <tbody className="bg-white divide-y divide-gray-200">
                      {invoices.map((invoice) => (
                        <tr key={invoice.id} className="hover:bg-gray-50">
                          <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                            #{invoice.id.slice(-8)}
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                            {clientNameForInvoice(invoice)}
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                            {formatAmountFromEur(invoice.amount)}
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap">
                            <span
                              className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${getInvoiceStatusColor(invoice.status)}`}
                            >
                              {getStatusIcon(invoice.status)}
                              <span className="ml-1">{getInvoiceStatusText(invoice.status)}</span>
                            </span>
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                            {invoice.created_at
                              ? new Date(invoice.created_at).toLocaleDateString('lt-LT')
                              : '—'}
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                            {invoice.due_date
                              ? new Date(invoice.due_date).toLocaleDateString('lt-LT')
                              : '—'}
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                            <div className="flex space-x-2">
                              <button
                                type="button"
                                onClick={() => void downloadInvoice(invoice)}
                                className="text-blue-600 hover:text-blue-900"
                                title="Atsisiųsti / atidaryti PDF"
                                aria-label={`Atsisiųsti arba atidaryti sąskaitą ${invoice.id.slice(-8)}`}
                              >
                                <Download className="w-4 h-4" aria-hidden />
                              </button>
                              {invoice.status === 'pending' && (
                                <button
                                  type="button"
                                  onClick={() => setSelectedInvoice(invoice)}
                                  className="text-green-600 hover:text-green-900"
                                  title="Keisti būseną"
                                  aria-label={`Keisti sąskaitos ${invoice.id.slice(-8)} būseną`}
                                >
                                  <RefreshCw className="w-4 h-4" aria-hidden />
                                </button>
                              )}
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          )}

          {activeTab === 'transactions' && (
            <div className="space-y-4">
              <div className="flex justify-between items-center">
                <h3 className="text-lg font-medium text-gray-900">Transakcijų Istorija</h3>
                <button
                  type="button"
                  onClick={() => void loadData()}
                  className="flex items-center space-x-2 px-3 py-2 text-blue-600 hover:text-blue-800 hover:bg-blue-50 rounded-lg transition-colors"
                >
                  <RefreshCw className="w-4 h-4" aria-hidden />
                  <span>Atnaujinti</span>
                </button>
              </div>

              {transactions.length === 0 ? (
                <div className="text-center py-8">
                  <CreditCard className="w-12 h-12 text-gray-400 mx-auto mb-4" aria-hidden />
                  <p className="text-gray-500">Transakcijų nerasta</p>
                </div>
              ) : (
                <div className="space-y-3">
                  {transactions.map((transaction) => (
                    <div key={transaction.id} className="border rounded-lg p-4">
                      <div className="flex items-center justify-between">
                        <div className="flex-1">
                          <div className="flex items-center space-x-3">
                            <div
                              className={`w-8 h-8 rounded-full flex items-center justify-center ${
                                transaction.type === 'payment' ? 'bg-green-100' : 'bg-red-100'
                              }`}
                            >
                              {transaction.type === 'payment' ? (
                                <DollarSign className="w-4 h-4 text-green-600" aria-hidden />
                              ) : (
                                <RefreshCw className="w-4 h-4 text-red-600" aria-hidden />
                              )}
                            </div>
                            <div>
                              <p className="font-medium text-gray-900">
                                {transaction.type === 'payment' ? 'Mokėjimas' : 'Grąžinimas'}
                              </p>
                              <p className="text-sm text-gray-500">
                                {new Date(transaction.created_at).toLocaleDateString('lt-LT')}{' '}
                                {new Date(transaction.created_at).toLocaleTimeString('lt-LT')}
                              </p>
                            </div>
                          </div>
                        </div>
                        <div className="text-right">
                          <p
                            className={`text-lg font-semibold ${
                              transaction.type === 'payment' ? 'text-green-600' : 'text-red-600'
                            }`}
                          >
                            {transaction.type === 'payment' ? '+' : '-'}
                            {formatAmountFromEur(transaction.amount)}
                          </p>
                          <p className="text-sm text-gray-500">{transaction.status}</p>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Invoice Status Modal */}
      {selectedInvoice && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <motion.div
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            className="bg-white rounded-lg p-6 max-w-md w-full"
            role="dialog"
            aria-modal="true"
            aria-labelledby="invoice-status-title"
          >
            <div className="flex items-center justify-between mb-4">
              <h3 id="invoice-status-title" className="text-lg font-medium text-gray-900">
                Keisti Sąskaitos Būseną
              </h3>
              <button
                type="button"
                title="Uždaryti"
                aria-label="Uždaryti"
                onClick={() => setSelectedInvoice(null)}
                className="text-gray-400 hover:text-gray-600"
              >
                <X className="w-5 h-5" aria-hidden />
              </button>
            </div>
            <div className="space-y-3">
              <p className="text-sm text-gray-600">Sąskaita #{selectedInvoice.id.slice(-8)}</p>
              <p className="text-sm text-gray-600">
                Suma: {formatAmountFromEur(selectedInvoice.amount)}
              </p>
              <div className="flex space-x-3">
                <button
                  type="button"
                  onClick={() => void updateInvoiceStatus(selectedInvoice.id, 'paid')}
                  className="flex-1 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors"
                >
                  Pažymėti kaip Apmokėta
                </button>
                <button
                  type="button"
                  onClick={() => void updateInvoiceStatus(selectedInvoice.id, 'cancelled')}
                  className="flex-1 px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors"
                >
                  Atšaukti
                </button>
              </div>
            </div>
          </motion.div>
        </div>
      )}
    </div>
  );
}
