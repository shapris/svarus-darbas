/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from 'react';
import { CreditCard, Calendar, DollarSign, CheckCircle, AlertCircle, FileText, Download } from 'lucide-react';
import { Order, Invoice } from '../../types';
import { 
  createPaymentIntent, 
  confirmPayment, 
  generateInvoice, 
  getInvoices, 
  formatAmountFromEur,
  getInvoiceStatusText,
  getInvoiceStatusColor,
  validatePaymentForm,
  type PaymentFormData
} from '../../services/paymentService';
import { motion } from 'motion/react';
import { useToast } from '../../hooks/useToast';

interface PaymentViewProps {
  order: Order;
  onPaymentComplete?: () => void;
}

export default function PaymentView({ order, onPaymentComplete }: PaymentViewProps) {
  const { showToast } = useToast();
  const [loading, setLoading] = useState(false);
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [showPaymentForm, setShowPaymentForm] = useState(false);
  const [paymentData, setPaymentData] = useState<PaymentFormData>({
    cardNumber: '',
    expiryDate: '',
    cvc: '',
    name: '',
    email: ''
  });
  const [formErrors, setFormErrors] = useState<Record<string, string>>({});
  const [paymentProcessing, setPaymentProcessing] = useState(false);

  useEffect(() => {
    loadInvoices();
  }, []);

  const loadInvoices = async () => {
    try {
      const invoiceList = await getInvoices(order.clientId);
      setInvoices(invoiceList.filter(inv => inv.order_id === order.id));
    } catch {
      // Failed to load invoices silently
    }
  };

  const handlePayment = async () => {
    const validation = validatePaymentForm(paymentData);
    if (!validation.isValid) {
      setFormErrors(validation.errors);
      return;
    }

    setPaymentProcessing(true);
    try {
      // Create payment intent
      const paymentIntent = await createPaymentIntent(order);
      
      // Confirm payment
      await confirmPayment(paymentIntent.client_secret!);
      
      // Generate invoice
      await generateInvoice(order);
      
      // Reload invoices
      await loadInvoices();
      
      setShowPaymentForm(false);
      setPaymentData({
        cardNumber: '',
        expiryDate: '',
        cvc: '',
        name: '',
        email: ''
      });
      
      if (onPaymentComplete) {
        onPaymentComplete();
      }
    } catch (error: unknown) {
      const msg = error instanceof Error ? error.message : 'Mokėjimas nepavyko';
      showToast.error(msg);
    } finally {
      setPaymentProcessing(false);
    }
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    let formattedValue = value;

    // Format card number
    if (name === 'cardNumber') {
      formattedValue = value.replace(/\s/g, '').replace(/(.{4})/g, '$1 ').trim();
    }

    // Format expiry date
    if (name === 'expiryDate') {
      formattedValue = value.replace(/\D/g, '').replace(/(\d{2})(\d)/, '$1/$2');
    }

    // Only numbers for CVC
    if (name === 'cvc') {
      formattedValue = value.replace(/\D/g, '');
    }

    setPaymentData(prev => ({ ...prev, [name]: formattedValue }));
    setFormErrors(prev => ({ ...prev, [name]: '' }));
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
      showToast.error('Nepavyko atsisiųsti sąskaitos');
    }
  };

  const isOrderPaid = invoices.some(inv => inv.status === 'paid');
  const hasPendingInvoice = invoices.some(inv => inv.status === 'pending');

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      {/* Order Summary */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="bg-white rounded-lg shadow p-6"
      >
        <h2 className="text-xl font-semibold text-gray-900 mb-4">Užsakymo Informacija</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <p className="text-sm text-gray-600">Užsakymo ID</p>
            <p className="font-medium">{order.id}</p>
          </div>
          <div>
            <p className="text-sm text-gray-600">Adresas</p>
            <p className="font-medium">{order.address}</p>
          </div>
          <div>
            <p className="text-sm text-gray-600">Data</p>
            <p className="font-medium">{new Date(order.date).toLocaleDateString('lt-LT')}</p>
          </div>
          <div>
            <p className="text-sm text-gray-600">Laikas</p>
            <p className="font-medium">{order.time}</p>
          </div>
          <div>
            <p className="text-sm text-gray-600">Langų skaičius</p>
            <p className="font-medium">{order.windowCount}</p>
          </div>
          <div>
            <p className="text-sm text-gray-600">Aukštas</p>
            <p className="font-medium">{order.floor}</p>
          </div>
        </div>
        <div className="mt-6 pt-6 border-t">
          <div className="flex justify-between items-center">
            <span className="text-lg font-medium text-gray-900">Suma:</span>
            <span className="text-2xl font-bold text-green-600">
              {formatAmountFromEur(order.totalPrice)}
            </span>
          </div>
        </div>
      </motion.div>

      {/* Payment Status */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.1 }}
        className="bg-white rounded-lg shadow p-6"
      >
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-xl font-semibold text-gray-900">Mokėjimo Būsena</h2>
          {isOrderPaid ? (
            <div className="flex items-center space-x-2 text-green-600">
              <CheckCircle className="w-5 h-5" />
              <span className="font-medium">Apmokėta</span>
            </div>
          ) : (
            <div className="flex items-center space-x-2 text-yellow-600">
              <AlertCircle className="w-5 h-5" />
              <span className="font-medium">Laukiama apmokėjimo</span>
            </div>
          )}
        </div>

        {!isOrderPaid && !showPaymentForm && (
          <button
            onClick={() => setShowPaymentForm(true)}
            className="w-full bg-blue-600 text-white py-3 rounded-lg font-medium hover:bg-blue-700 transition-colors flex items-center justify-center space-x-2"
          >
            <CreditCard className="w-5 h-5" />
            <span>Apmokėti Užsakymą</span>
          </button>
        )}
      </motion.div>

      {/* Payment Form */}
      {showPaymentForm && (
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="bg-white rounded-lg shadow p-6"
        >
          <h2 className="text-xl font-semibold text-gray-900 mb-6">Mokėjimo Informacija</h2>
          
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Kortelės Numeris
              </label>
              <input
                type="text"
                name="cardNumber"
                value={paymentData.cardNumber}
                onChange={handleInputChange}
                placeholder="1234 5678 9012 3456"
                className={`w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent ${
                  formErrors.cardNumber ? 'border-red-500' : 'border-gray-300'
                }`}
                maxLength={19}
                disabled={paymentProcessing}
              />
              {formErrors.cardNumber && (
                <p className="mt-1 text-sm text-red-600">{formErrors.cardNumber}</p>
              )}
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Galiojimo Data
                </label>
                <input
                  type="text"
                  name="expiryDate"
                  value={paymentData.expiryDate}
                  onChange={handleInputChange}
                  placeholder="MM/YY"
                  className={`w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent ${
                    formErrors.expiryDate ? 'border-red-500' : 'border-gray-300'
                  }`}
                  maxLength={5}
                  disabled={paymentProcessing}
                />
                {formErrors.expiryDate && (
                  <p className="mt-1 text-sm text-red-600">{formErrors.expiryDate}</p>
                )}
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  CVC
                </label>
                <input
                  type="text"
                  name="cvc"
                  value={paymentData.cvc}
                  onChange={handleInputChange}
                  placeholder="123"
                  className={`w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent ${
                    formErrors.cvc ? 'border-red-500' : 'border-gray-300'
                  }`}
                  maxLength={4}
                  disabled={paymentProcessing}
                />
                {formErrors.cvc && (
                  <p className="mt-1 text-sm text-red-600">{formErrors.cvc}</p>
                )}
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Vardas Pavardė
              </label>
              <input
                type="text"
                name="name"
                value={paymentData.name}
                onChange={handleInputChange}
                placeholder="Jonas Jonaitis"
                className={`w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent ${
                  formErrors.name ? 'border-red-500' : 'border-gray-300'
                }`}
                disabled={paymentProcessing}
              />
              {formErrors.name && (
                <p className="mt-1 text-sm text-red-600">{formErrors.name}</p>
              )}
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                El. Paštas
              </label>
              <input
                type="email"
                name="email"
                value={paymentData.email}
                onChange={handleInputChange}
                placeholder="email@example.com"
                className={`w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent ${
                  formErrors.email ? 'border-red-500' : 'border-gray-300'
                }`}
                disabled={paymentProcessing}
              />
              {formErrors.email && (
                <p className="mt-1 text-sm text-red-600">{formErrors.email}</p>
              )}
            </div>
          </div>

          <div className="mt-6 flex space-x-3">
            <button
              onClick={() => setShowPaymentForm(false)}
              className="flex-1 px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors"
              disabled={paymentProcessing}
            >
              Atšaukti
            </button>
            <button
              onClick={handlePayment}
              disabled={paymentProcessing}
              className="flex-1 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center space-x-2"
            >
              {paymentProcessing ? (
                <>
                  <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                  <span>Apdorojama...</span>
                </>
              ) : (
                <>
                  <DollarSign className="w-4 h-4" />
                  <span>Apmokėti {formatAmountFromEur(order.totalPrice)}</span>
                </>
              )}
            </button>
          </div>
        </motion.div>
      )}

      {/* Invoices */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.2 }}
        className="bg-white rounded-lg shadow p-6"
      >
        <h2 className="text-xl font-semibold text-gray-900 mb-4">Sąskaitos</h2>
        
        {invoices.length === 0 ? (
          <div className="text-center py-8">
            <FileText className="w-12 h-12 text-gray-400 mx-auto mb-4" />
            <p className="text-gray-500">Sąskaitų nerasta</p>
          </div>
        ) : (
          <div className="space-y-3">
            {invoices.map((invoice) => (
              <div key={invoice.id} className="border rounded-lg p-4">
                <div className="flex items-center justify-between">
                  <div className="flex-1">
                    <div className="flex items-center space-x-3">
                      <FileText className="w-5 h-5 text-gray-400" />
                      <div>
                        <p className="font-medium">Sąskaita #{invoice.id.slice(-8)}</p>
                        <p className="text-sm text-gray-500">
                          Sukurta: {new Date(invoice.created_at).toLocaleDateString('lt-LT')}
                        </p>
                      </div>
                    </div>
                    <div className="text-right">
                      <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${getInvoiceStatusColor(invoice.status)}`}>
                        {getInvoiceStatusText(invoice.status)}
                      </span>
                      <p className="text-lg font-semibold mt-1">
                        {formatAmountFromEur(invoice.amount)}
                      </p>
                    </div>
                  </div>
                  <div className="ml-4">
                    <button
                      onClick={() => downloadInvoice(invoice)}
                      className="p-2 text-gray-600 hover:text-gray-900 hover:bg-gray-100 rounded-lg transition-colors"
                      title="Atsisiųsti PDF"
                    >
                      <Download className="w-5 h-5" />
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </motion.div>
    </div>
  );
}
