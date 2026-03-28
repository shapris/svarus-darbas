/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from 'react';
import { Calendar, Clock, DollarSign, User, Home, Settings, LogOut, FileText, CheckCircle, AlertCircle, X } from 'lucide-react';
import { getClientOrders, signOut, type AuthUser } from '../../supabase';
import { Order, UserProfile } from '../../types';
import { motion } from 'motion/react';

interface ClientDashboardProps {
    user: AuthUser;
    profile: UserProfile;
    onLogout: () => void;
}

export default function ClientDashboard({ user, profile, onLogout }: ClientDashboardProps) {
    const [orders, setOrders] = useState<Order[]>([]);
    const [loading, setLoading] = useState(true);
    const [activeTab, setActiveTab] = useState<'orders' | 'profile'>('orders');
    const [showLogoutConfirm, setShowLogoutConfirm] = useState(false);

    useEffect(() => {
        loadOrders();
    }, []);

    const loadOrders = async () => {
        if (!profile.clientId) return;
        
        try {
            const clientOrders = await getClientOrders(profile.clientId);
            setOrders(clientOrders);
        } catch (err) {
            console.error('Error loading orders:', err);
        } finally {
            setLoading(false);
        }
    };

    const getStatusColor = (status: string) => {
        switch (status) {
            case 'suplanuota': return 'bg-blue-100 text-blue-800';
            case 'vykdoma': return 'bg-yellow-100 text-yellow-800';
            case 'atlikta': return 'bg-green-100 text-green-800';
            default: return 'bg-gray-100 text-gray-800';
        }
    };

    const getStatusIcon = (status: string) => {
        switch (status) {
            case 'suplanuota': return <Calendar className="w-4 h-4" />;
            case 'vykdoma': return <Clock className="w-4 h-4" />;
            case 'atlikta': return <CheckCircle className="w-4 h-4" />;
            default: return <AlertCircle className="w-4 h-4" />;
        }
    };

    const formatDate = (dateString: string) => {
        const date = new Date(dateString);
        return date.toLocaleDateString('lt-LT', {
            year: 'numeric',
            month: 'long',
            day: 'numeric'
        });
    };

    const formatTime = (timeString: string) => {
        return timeString.substring(0, 5);
    };

    const handleLogout = async () => {
        try {
            await signOut();
            onLogout();
        } catch (err) {
            console.error('Logout error:', err);
        }
    };

    const stats = {
        total: orders.length,
        planned: orders.filter(o => o.status === 'suplanuota').length,
        completed: orders.filter(o => o.status === 'atlikta').length,
        totalSpent: orders.filter(o => o.isPaid).reduce((sum, o) => sum + o.totalPrice, 0)
    };

    return (
        <div className="min-h-screen bg-gray-50">
            {/* Header */}
            <header className="bg-white shadow-sm border-b">
                <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
                    <div className="flex justify-between items-center h-16">
                        <div className="flex items-center space-x-4">
                            <div className="w-10 h-10 bg-blue-600 rounded-lg flex items-center justify-center">
                                <Home className="w-6 h-6 text-white" />
                            </div>
                            <div>
                                <h1 className="text-xl font-semibold text-gray-900">Kliento Portalas</h1>
                                <p className="text-sm text-gray-500">Sveiki, {profile.name || user.email}</p>
                            </div>
                        </div>
                        <div className="flex items-center space-x-4">
                            <button
                                onClick={() => setShowLogoutConfirm(true)}
                                className="flex items-center space-x-2 px-3 py-2 text-gray-600 hover:text-gray-900 hover:bg-gray-100 rounded-lg transition-colors"
                            >
                                <LogOut className="w-4 h-4" />
                                <span>Atsijungti</span>
                            </button>
                        </div>
                    </div>
                </div>
            </header>

            {/* Navigation Tabs */}
            <div className="bg-white border-b">
                <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
                    <nav className="flex space-x-8">
                        <button
                            onClick={() => setActiveTab('orders')}
                            className={`py-4 px-1 border-b-2 font-medium text-sm transition-colors ${
                                activeTab === 'orders'
                                    ? 'border-blue-500 text-blue-600'
                                    : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                            }`}
                        >
                            <div className="flex items-center space-x-2">
                                <FileText className="w-4 h-4" />
                                <span>Mano Užsakymai</span>
                            </div>
                        </button>
                        <button
                            onClick={() => setActiveTab('profile')}
                            className={`py-4 px-1 border-b-2 font-medium text-sm transition-colors ${
                                activeTab === 'profile'
                                    ? 'border-blue-500 text-blue-600'
                                    : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                            }`}
                        >
                            <div className="flex items-center space-x-2">
                                <User className="w-4 h-4" />
                                <span>Mano Profilis</span>
                            </div>
                        </button>
                    </nav>
                </div>
            </div>

            <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
                {activeTab === 'orders' && (
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
                                        <p className="text-sm font-medium text-gray-600">Viso užsakymų</p>
                                        <p className="text-2xl font-semibold text-gray-900">{stats.total}</p>
                                    </div>
                                    <FileText className="w-8 h-8 text-blue-600" />
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
                                        <p className="text-sm font-medium text-gray-600">Suplanuota</p>
                                        <p className="text-2xl font-semibold text-blue-600">{stats.planned}</p>
                                    </div>
                                    <Calendar className="w-8 h-8 text-blue-600" />
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
                                        <p className="text-sm font-medium text-gray-600">Atlikta</p>
                                        <p className="text-2xl font-semibold text-green-600">{stats.completed}</p>
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
                                        <p className="text-sm font-medium text-gray-600">Išleista</p>
                                        <p className="text-2xl font-semibold text-gray-900">€{stats.totalSpent}</p>
                                    </div>
                                    <DollarSign className="w-8 h-8 text-green-600" />
                                </div>
                            </motion.div>
                        </div>

                        {/* Orders List */}
                        <motion.div
                            initial={{ opacity: 0, y: 20 }}
                            animate={{ opacity: 1, y: 0 }}
                            transition={{ delay: 0.4 }}
                            className="bg-white rounded-lg shadow"
                        >
                            <div className="px-6 py-4 border-b border-gray-200">
                                <h2 className="text-lg font-medium text-gray-900">Užsakymų Istorija</h2>
                            </div>
                            <div className="divide-y divide-gray-200">
                                {loading ? (
                                    <div className="px-6 py-8 text-center">
                                        <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
                                        <p className="mt-2 text-gray-500">Kraunami užsakymai...</p>
                                    </div>
                                ) : orders.length === 0 ? (
                                    <div className="px-6 py-8 text-center">
                                        <FileText className="w-12 h-12 text-gray-400 mx-auto mb-4" />
                                        <p className="text-gray-500">Jūs dar neturite užsakymų</p>
                                    </div>
                                ) : (
                                    orders.map((order, index) => (
                                        <motion.div
                                            key={order.id}
                                            initial={{ opacity: 0, x: -20 }}
                                            animate={{ opacity: 1, x: 0 }}
                                            transition={{ delay: 0.5 + index * 0.1 }}
                                            className="px-6 py-4 hover:bg-gray-50 transition-colors"
                                        >
                                            <div className="flex items-center justify-between">
                                                <div className="flex-1">
                                                    <div className="flex items-center space-x-3">
                                                        <span className={`inline-flex items-center space-x-1 px-2.5 py-0.5 rounded-full text-xs font-medium ${getStatusColor(order.status)}`}>
                                                            {getStatusIcon(order.status)}
                                                            <span>{order.status}</span>
                                                        </span>
                                                        <h3 className="text-sm font-medium text-gray-900">
                                                            Langų valymas - {order.address}
                                                        </h3>
                                                    </div>
                                                    <div className="mt-2 flex items-center space-x-4 text-sm text-gray-500">
                                                        <div className="flex items-center space-x-1">
                                                            <Calendar className="w-4 h-4" />
                                                            <span>{formatDate(order.date)}</span>
                                                        </div>
                                                        <div className="flex items-center space-x-1">
                                                            <Clock className="w-4 h-4" />
                                                            <span>{formatTime(order.time)}</span>
                                                        </div>
                                                        <div className="flex items-center space-x-1">
                                                            <span>Langai: {order.windowCount}</span>
                                                        </div>
                                                        <div className="flex items-center space-x-1">
                                                            <span>Aukštas: {order.floor}</span>
                                                        </div>
                                                    </div>
                                                </div>
                                                <div className="text-right">
                                                    <p className="text-lg font-semibold text-gray-900">€{order.totalPrice}</p>
                                                    {order.isPaid && (
                                                        <p className="text-xs text-green-600">Apmokėta</p>
                                                    )}
                                                </div>
                                            </div>
                                        </motion.div>
                                    ))
                                )}
                            </div>
                        </motion.div>
                    </div>
                )}

                {activeTab === 'profile' && (
                    <motion.div
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        className="max-w-2xl mx-auto"
                    >
                        <div className="bg-white rounded-lg shadow">
                            <div className="px-6 py-4 border-b border-gray-200">
                                <h2 className="text-lg font-medium text-gray-900">Mano Profilis</h2>
                            </div>
                            <div className="px-6 py-6 space-y-6">
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-1">Vardas</label>
                                    <p className="text-gray-900">{profile.name || 'Nenustatyta'}</p>
                                </div>
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-1">El. paštas</label>
                                    <p className="text-gray-900">{user.email}</p>
                                </div>
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-1">Telefonas</label>
                                    <p className="text-gray-900">{profile.phone || 'Nenustatyta'}</p>
                                </div>
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-1">Adresas</label>
                                    <p className="text-gray-900">Nustatoma per užsakymą</p>
                                </div>
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-1">Vartotojo tipas</label>
                                    <p className="text-gray-900">Klientas</p>
                                </div>
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-1">Registracijos data</label>
                                    <p className="text-gray-900">{formatDate(profile.createdAt)}</p>
                                </div>
                            </div>
                        </div>
                    </motion.div>
                )}
            </main>

            {/* Logout Confirmation Modal */}
            {showLogoutConfirm && (
                <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
                    <motion.div
                        initial={{ opacity: 0, scale: 0.9 }}
                        animate={{ opacity: 1, scale: 1 }}
                        className="bg-white rounded-lg p-6 max-w-sm w-full"
                    >
                        <div className="flex items-center justify-between mb-4">
                            <h3 className="text-lg font-medium text-gray-900">Atsijungti</h3>
                            <button
                                onClick={() => setShowLogoutConfirm(false)}
                                className="text-gray-400 hover:text-gray-600"
                            >
                                <X className="w-5 h-5" />
                            </button>
                        </div>
                        <p className="text-gray-600 mb-6">Ar tikrai norite atsijungti?</p>
                        <div className="flex space-x-3">
                            <button
                                onClick={() => setShowLogoutConfirm(false)}
                                className="flex-1 px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors"
                            >
                                Atšaukti
                            </button>
                            <button
                                onClick={handleLogout}
                                className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
                            >
                                Atsijungti
                            </button>
                        </div>
                    </motion.div>
                </div>
            )}
        </div>
    );
}
