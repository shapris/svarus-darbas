/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from 'react';
import { CreditCard, DollarSign, FileText, Download, RefreshCw, AlertCircle, CheckCircle, Clock, X } from 'lucide-react';
import { Invoice, Transaction } from '../types';
import { formatAmountFromEur, getInvoiceStatusText, getInvoiceStatusColor } from '../services/paymentService';
import { motion } from 'motion/react';

interface PaymentsViewProps {
  user: any;
}

export default function PaymentsView({ user }: PaymentsViewProps) {
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'invoices' | 'transactions'>('invoices');
  const [selectedInvoice, setSelectedInvoice] = useState<Invoice | null>(null);
  const [stats, setStats] = useState({
    totalRevenue: 0,
    pendingPayments: 0,
    paidInvoices: 0,
    pendingInvoices: 0
  });

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      // Simulate API calls - in real app, these would be actual API calls
      const mockInvoices: Invoice[] = [
        {
          id: 'inv_001',
          order_id: 'order_001',
          client_id: 'client_001',
          amount: 50.00,
          status: 'paid',
          due_date: '2026-04-11T00:00:00Z',
          created_at: '2026-03-28T10:00:00Z',
          paid_at: '2026-03-29T14:30:00Z',
          stripe_payment_intent_id: 'pi_001'
        },
        {
          id: 'inv_002',
          order_id: 'order_002',
          client_id: 'client_002',
          amount: 75.00,
          status: 'pending',
          due_date: '2026-04-15T00:00:00Z',
          created_at: '2026-03-28T12:00:00Z'
        },
        {
          id: 'inv_003',
          order_id: 'order_003',
          client_id: 'client_003',
          amount: 120.00,
          status: 'cancelled',
          due_date: '2026-04-10T00:00:00Z',
          created_at: '2026-03-25T09:00:00Z'
        }
      ];

      const mockTransactions: Transaction[] = [
        {
          id: 'txn_001',
          invoice_id: 'inv_001',
          client_id: 'client_001',
          amount: 50.00,
          currency: 'EUR',
          status: 'succeeded',
          type: 'payment',
          stripe_charge_id: 'ch_001',
          created_at: '2026-03-29T14:30:00Z',
          processed_at: '2026-03-29T14:30:00Z'
        },
        {
          id: 'txn_002',
          invoice_id: 'inv_001',
          client_id: 'client_001',
          amount: 10.00,
          currency: 'EUR',
          status: 'succeeded',
          type: 'refund',
          stripe_charge_id: 're_001',
          created_at: '2026-03-30T10:00:00Z',
          processed_at: '2026-03-30T10:15:00Z'
        }
      ];

      setInvoices(mockInvoices);
      setTransactions(mockTransactions);

      // Calculate stats
      const totalRevenue = mockTransactions
        .filter(t => t.type === 'payment' && t.status === 'succeeded')
        .reduce((sum, t) => sum + t.amount, 0);

      const pendingPayments = mockInvoices
        .filter(inv => inv.status === 'pending')
        .reduce((sum, inv) => sum + inv.amount, 0);

      const paidInvoices = mockInvoices.filter(inv => inv.status === 'paid').length;
      const pendingInvoices = mockInvoices.filter(inv => inv.status === 'pending').length;

      setStats({
        totalRevenue,
        pendingPayments,
        paidInvoices,
        pendingInvoices
      });
    } catch {
      // Failed to load payments data silently
    } finally {
      setLoading(false);
    }
  };

  const downloadInvoice = async (invoice: Invoice) => {
    try {
      const response = await fetch(`/api/invoices/${invoice.id}/pdf`);
      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `saskaita-${invoice.id}.pdf`;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);
    } catch {
      alert('Nepavyko atsisiųsti sąskaitos');
    }
  };

  const updateInvoiceStatus = async (invoiceId: string, status: Invoice['status']) => {
    try {
      const response = await fetch(`/api/invoices/${invoiceId}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ status }),
      });

      if (response.ok) {
        const updatedInvoice = await response.json();
        setInvoices(prev => prev.map(inv => 
          inv.id === invoiceId ? updatedInvoice : inv
        ));
        setSelectedInvoice(null);
      }
    } catch {
      alert('Nepavyko atnaujinti sąskaitos statuso');
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'paid':
        return <CheckCircle className="w-4 h-4" />;
      case 'pending':
        return <Clock className="w-4 h-4" />;
      case 'cancelled':
        return <X className="w-4 h-4" />;
      default:
        return <AlertCircle className="w-4 h-4" />;
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center p-8">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
        <p className="ml-2 text-gray-500">Kraunami mokėjimai...</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
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
            <DollarSign className="w-8 h-8 text-green-600" />
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
            <Clock className="w-8 h-8 text-orange-600" />
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
            <CheckCircle className="w-8 h-8 text-green-600" />
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
            <FileText className="w-8 h-8 text-yellow-600" />
          </div>
        </motion.div>
      </div>

      {/* Navigation Tabs */}
      <div className="bg-white rounded-lg shadow">
        <div className="border-b border-gray-200">
          <nav className="flex space-x-8 px-6">
            <button
              onClick={() => setActiveTab('invoices')}
              className={`py-4 px-1 border-b-2 font-medium text-sm transition-colors ${
                activeTab === 'invoices'
                  ? 'border-blue-500 text-blue-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
              }`}
            >
              <div className="flex items-center space-x-2">
                <FileText className="w-4 h-4" />
                <span>Sąskaitos</span>
              </div>
            </button>
            <button
              onClick={() => setActiveTab('transactions')}
              className={`py-4 px-1 border-b-2 font-medium text-sm transition-colors ${
                activeTab === 'transactions'
                  ? 'border-blue-500 text-blue-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
              }`}
            >
              <div className="flex items-center space-x-2">
                <CreditCard className="w-4 h-4" />
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
                  onClick={loadData}
                  className="flex items-center space-x-2 px-3 py-2 text-blue-600 hover:text-blue-800 hover:bg-blue-50 rounded-lg transition-colors"
                >
                  <RefreshCw className="w-4 h-4" />
                  <span>Atnaujinti</span>
                </button>
              </div>

              {invoices.length === 0 ? (
                <div className="text-center py-8">
                  <FileText className="w-12 h-12 text-gray-400 mx-auto mb-4" />
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
                            {invoice.client_id}
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                            {formatAmountFromEur(invoice.amount)}
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap">
                            <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${getInvoiceStatusColor(invoice.status)}`}>
                              {getStatusIcon(invoice.status)}
                              <span className="ml-1">{getInvoiceStatusText(invoice.status)}</span>
                            </span>
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                            {new Date(invoice.created_at).toLocaleDateString('lt-LT')}
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                            {new Date(invoice.due_date).toLocaleDateString('lt-LT')}
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                            <div className="flex space-x-2">
                              <button
                                onClick={() => downloadInvoice(invoice)}
                                className="text-blue-600 hover:text-blue-900"
                                title="Atsisiųsti PDF"
                              >
                                <Download className="w-4 h-4" />
                              </button>
                              {invoice.status === 'pending' && (
                                <button
                                  onClick={() => setSelectedInvoice(invoice)}
                                  className="text-green-600 hover:text-green-900"
                                  title="Keisti būseną"
                                >
                                  <RefreshCw className="w-4 h-4" />
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
                  onClick={loadData}
                  className="flex items-center space-x-2 px-3 py-2 text-blue-600 hover:text-blue-800 hover:bg-blue-50 rounded-lg transition-colors"
                >
                  <RefreshCw className="w-4 h-4" />
                  <span>Atnaujinti</span>
                </button>
              </div>

              {transactions.length === 0 ? (
                <div className="text-center py-8">
                  <CreditCard className="w-12 h-12 text-gray-400 mx-auto mb-4" />
                  <p className="text-gray-500">Transakcijų nerasta</p>
                </div>
              ) : (
                <div className="space-y-3">
                  {transactions.map((transaction) => (
                    <div key={transaction.id} className="border rounded-lg p-4">
                      <div className="flex items-center justify-between">
                        <div className="flex-1">
                          <div className="flex items-center space-x-3">
                            <div className={`w-8 h-8 rounded-full flex items-center justify-center ${
                              transaction.type === 'payment' ? 'bg-green-100' : 'bg-red-100'
                            }`}>
                              {transaction.type === 'payment' ? (
                                <DollarSign className="w-4 h-4 text-green-600" />
                              ) : (
                                <RefreshCw className="w-4 h-4 text-red-600" />
                              )}
                            </div>
                            <div>
                              <p className="font-medium text-gray-900">
                                {transaction.type === 'payment' ? 'Mokėjimas' : 'Grąžinimas'}
                              </p>
                              <p className="text-sm text-gray-500">
                                {new Date(transaction.created_at).toLocaleDateString('lt-LT')} {new Date(transaction.created_at).toLocaleTimeString('lt-LT')}
                              </p>
                            </div>
                          </div>
                        </div>
                        <div className="text-right">
                          <p className={`text-lg font-semibold ${
                            transaction.type === 'payment' ? 'text-green-600' : 'text-red-600'
                          }`}>
                            {transaction.type === 'payment' ? '+' : '-'}{formatAmountFromEur(transaction.amount)}
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
          >
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-medium text-gray-900">Keisti Sąskaitos Būseną</h3>
              <button
                onClick={() => setSelectedInvoice(null)}
                className="text-gray-400 hover:text-gray-600"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="space-y-3">
              <p className="text-sm text-gray-600">
                Sąskaita #{selectedInvoice.id.slice(-8)}
              </p>
              <p className="text-sm text-gray-600">
                Suma: {formatAmountFromEur(selectedInvoice.amount)}
              </p>
              <div className="flex space-x-3">
                <button
                  onClick={() => updateInvoiceStatus(selectedInvoice.id, 'paid')}
                  className="flex-1 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors"
                >
                  Pažymėti kaip Apmokėta
                </button>
                <button
                  onClick={() => updateInvoiceStatus(selectedInvoice.id, 'cancelled')}
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
