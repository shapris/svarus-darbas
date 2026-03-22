/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from 'react';
import { signIn, signUp, signOut, signInWithGoogle, getCurrentUser, subscribeToData, getData, addData, updateData, TABLES, testConnection, AuthUser, isDemoMode, usesFirebase } from './supabase';
import Layout from './components/Layout';
import { Client, Order, AppSettings, DEFAULT_SETTINGS, Expense, Employee, Memory } from './types';
import Dashboard from './views/Dashboard';
import ClientsView from './views/ClientsView';
import OrdersView from './views/OrdersView';
import CalendarView from './views/CalendarView';
import SettingsView from './views/SettingsView';
import BookingPage from './views/BookingPage';
import ExpensesView from './views/ExpensesView';
import AnalyticsView from './views/AnalyticsView';
import LogisticsView from './views/LogisticsView';
import TeamView from './views/TeamView';
import InventoryView from './views/InventoryView';
import ChatAssistant from './components/ChatAssistant';
import { Droplets } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';

export default function App() {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('dashboard');
  const [clients, setClients] = useState<Client[]>([]);
  const [orders, setOrders] = useState<Order[]>([]);
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [settings, setSettings] = useState<AppSettings>(DEFAULT_SETTINGS);
  const [memories, setMemories] = useState<Memory[]>([]);
  const [showLoginForm, setShowLoginForm] = useState<'login' | 'register' | null>(null);
  const [connectionStatus, setConnectionStatus] = useState<'checking' | 'connected' | 'disconnected'>('checking');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [displayName, setDisplayName] = useState('');

  // Simple routing for booking page
  const path = window.location.pathname;
  const isBookingPage = path.startsWith('/booking/');
  const bookingUserId = isBookingPage ? path.split('/')[2] : null;

  useEffect(() => {
    let cancelled = false;

    (async () => {
      // Only auto-login in demo mode
      if (!isDemoMode) {
        // Supabase configured - don't auto-login, wait for user to sign in
        if (!cancelled) setLoading(false);
        // Test connection and update status
        testConnection().then(connected => {
          if (!cancelled) setConnectionStatus(connected ? 'connected' : 'disconnected');
        }).catch(() => {
          if (!cancelled) setConnectionStatus('disconnected');
        });
        return;
      }

      try {
        const currentUser = await getCurrentUser();
        if (cancelled) return;

        // Auto-login with demo user (only in demo mode)
        const demoEmail = 'demo@example.com';
        const demoPassword = 'demo123';

        try {
          let result = await signIn(demoEmail, demoPassword).catch(() => null);
          if (cancelled) return;

          if (!result?.user) {
            // Create demo user
            await signUp(demoEmail, demoPassword, 'Demo User');
            if (cancelled) return;
            result = await signIn(demoEmail, demoPassword);
          }

          if (cancelled) return;
          const userData = result?.user;
          if (userData) {
            setUser({
              uid: userData.id,
              email: userData.email || demoEmail,
              displayName: 'Demo User',
              photoURL: null,
            });
          }
        } catch (e) {
          console.error('Demo auto-login failed:', e);
          // Still set a demo user directly
          setUser({
            uid: 'demo-user-123',
            email: demoEmail,
            displayName: 'Demo User',
            photoURL: null,
          });
        }
      } finally {
        if (!cancelled) setLoading(false);
      }

      if (!cancelled) void testConnection();
    })();

    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (!user) return;

    // Load Settings
    getData<any>(TABLES.SETTINGS, user.uid).then(settingsData => {
      if (settingsData.length > 0) {
        setSettings({ ...DEFAULT_SETTINGS, ...settingsData[0] });
      } else {
        addData(TABLES.SETTINGS, user.uid, { ...DEFAULT_SETTINGS, uid: user.uid }).then(newSettings => {
          setSettings({ ...DEFAULT_SETTINGS, ...newSettings } as AppSettings);
        });
      }
    });

    // Subscribe to Clients
    const unsubClients = subscribeToData<Client>(TABLES.CLIENTS, user.uid, (data) => {
      setClients(data);
    });

    // Subscribe to Orders
    const unsubOrders = subscribeToData<Order>(TABLES.ORDERS, user.uid, (data) => {
      setOrders(data);
    });

    // Subscribe to Expenses
    const unsubExpenses = subscribeToData<Expense>(TABLES.EXPENSES, user.uid, (data) => {
      setExpenses(data);
    });

    // Subscribe to Employees
    const unsubEmployees = subscribeToData<Employee>(TABLES.EMPLOYEES, user.uid, (data) => {
      setEmployees(data);
    });

    // Subscribe to Memories
    const unsubMemories = subscribeToData<Memory>('memories', user.uid, (data) => {
      setMemories(data);
    });

    return () => {
      unsubClients();
      unsubOrders();
      unsubExpenses();
      unsubEmployees();
      unsubMemories();
    };
  }, [user]);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const result = await signIn(email, password);
      const { user: userData } = result;
      if (userData) {
        setUser({
          uid: userData.id,
          email: userData.email || '',
          displayName: userData.user_metadata?.display_name || null,
          photoURL: userData.user_metadata?.avatar_url || null,
        });
      }
      setShowLoginForm(null);
      // Show info if using demo fallback
      if ('isDemoFallback' in result) {
        alert('Jungiamasi į demonstracinį režimą. Duomenys bus saugomi tik jūsų naršyklėje.');
      }
    } catch (error: any) {
      console.error('Login failed:', error);
      // Show the actual error message
      const errorMessage = error?.message || 'Neteisingas el. paštas arba slaptažodis';
      alert(errorMessage);
    }
  };

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await signUp(email, password, displayName);
      // After registration, try to log in
      const result = await signIn(email, password);
      const { user: userData } = result;
      if (userData) {
        setUser({
          uid: userData.id,
          email: userData.email || '',
          displayName: userData.user_metadata?.display_name || displayName,
          photoURL: userData.user_metadata?.avatar_url || null,
        });
      }
      setShowLoginForm(null);
      // Show info if using demo fallback
      if ('isDemoFallback' in result) {
        alert('Paskyra sukurta demonstraciniame režime. Duomenys bus saugomi tik jūsų naršyklėje.');
      }
    } catch (error: any) {
      console.error('Registration failed:', error);
      // Show the actual error message
      const errorMessage = error?.message || 'Registracija nepavyko';
      alert(errorMessage);
    }
  };

  const handleLogout = async () => {
    await signOut();
    setUser(null);
    setClients([]);
    setOrders([]);
    setExpenses([]);
    setEmployees([]);
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  if (isBookingPage && bookingUserId) {
    return (
      <BookingPage userId={bookingUserId} />
    );
  }

  if (!user) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50 p-4">
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.2 }}
          className="bg-white p-8 rounded-2xl shadow-md max-w-sm w-full text-center border border-slate-200"
        >
          <div className="w-14 h-14 bg-blue-600 rounded-xl flex items-center justify-center mx-auto mb-5 text-white">
            <Droplets size={28} strokeWidth={2} />
          </div>
          <h1 className="text-xl font-semibold text-slate-900 mb-2">Švarus Darbas</h1>
          <p className="text-slate-600 mb-4 text-sm leading-relaxed">Prisijunkite prie CRM: užsakymai, klientai, komanda.</p>
          {!isDemoMode && usesFirebase && (
            <div className="mb-4 p-3 bg-slate-50 rounded-lg text-xs text-slate-700 text-left border border-slate-100">
              Duomenys saugomi Google Firebase (debesis). Įjunkite Email/Google prisijungimą Firebase konsolėje.
            </div>
          )}
          {!isDemoMode && !usesFirebase && (
            <div className="mb-4 p-3 bg-slate-50 rounded-lg text-xs text-slate-700 text-left border border-slate-100">
              Duomenys saugomi Supabase (debesis). Google prisijungimas galimas, jei sukonfigūruota projekte.
            </div>
          )}
          {connectionStatus === 'checking' && !isDemoMode && (
            <div className="mb-4 p-3 bg-blue-50 rounded-lg text-xs text-blue-700 text-center border border-blue-100 flex items-center justify-center gap-2">
              <div className="animate-spin rounded-full h-3 w-3 border-b-2 border-blue-600"></div>
              Tikrinama ryšys su duomenų baze...
            </div>
          )}
          {connectionStatus === 'disconnected' && !isDemoMode && (
            <>
              <div className="mb-4 p-3 bg-red-50 rounded-lg text-xs text-red-700 text-left border border-red-100">
                ⚠️ Nepavyko prisijungti prie duomenų bazės. Įsitikinkite, kad Supabase projektas yra aktyvus (nepristabdytas). Jei naudojate nemokamą planą, projektas gali būti pristabdytas po 7 dienų neaktyvumo.
              </div>
              <button
                onClick={() => {
                  setConnectionStatus('checking');
                  testConnection().then(connected => {
                    setConnectionStatus(connected ? 'connected' : 'disconnected');
                  }).catch(() => {
                    setConnectionStatus('disconnected');
                  });
                }}
                className="w-full mb-3 bg-slate-100 text-slate-700 py-3 rounded-xl font-medium hover:bg-slate-200 transition-colors"
              >
                Bandyti vėl
              </button>
            </>
          )}
          {isDemoMode && (
            <div className="mb-4 p-3 bg-amber-50 rounded-lg text-xs text-amber-900 text-left border border-amber-100">
              Vietinis režimas: duomenys saugomi šioje naršyklėje. Debesiui: Firebase (<code className="text-[11px] bg-amber-100/80 px-1 rounded">VITE_USE_FIREBASE</code> + raktai) arba Supabase (<code className="text-[11px] bg-amber-100/80 px-1 rounded">VITE_SUPABASE_*</code>).
            </div>
          )}

          {!showLoginForm ? (
            <>
              <button
                onClick={() => setShowLoginForm('login')}
                className="w-full bg-blue-600 text-white py-3.5 rounded-xl font-medium hover:bg-blue-700 transition-colors mb-3"
              >
                Prisijungti
              </button>
              <button
                onClick={() => setShowLoginForm('register')}
                className="w-full mt-3 bg-slate-100 text-slate-700 py-3 rounded-xl font-medium hover:bg-slate-200 transition-colors"
              >
                Sukurti paskyrą
              </button>
              <div className="relative my-4">
                <div className="absolute inset-0 flex items-center">
                  <div className="w-full border-t border-slate-200"></div>
                </div>
                <div className="relative flex justify-center text-sm">
                  <span className="px-2 bg-white text-slate-500">arba</span>
                </div>
              </div>
              <button
                type="button"
                onClick={async () => {
                  try {
                    await signInWithGoogle();
                  } catch (error: any) {
                    console.error('Google login failed:', error);
                    alert('Google prisijungimas nepavyko: ' + error.message);
                  }
                }}
                className="w-full flex items-center justify-center gap-2 bg-white text-slate-700 py-3 px-4 rounded-xl font-medium border border-slate-200 hover:bg-slate-50 transition-colors"
              >
                <svg viewBox="0 0 24 24" className="w-5 h-5">
                  <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" />
                  <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
                  <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" />
                  <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" />
                </svg>
                Prisijungti su Google
              </button>
            </>
          ) : (
            <form onSubmit={showLoginForm === 'login' ? handleLogin : handleRegister}>
              <input
                type="text"
                placeholder="Vardas"
                value={displayName}
                onChange={(e) => setDisplayName(e.target.value)}
                className="w-full mb-3 px-4 py-3 rounded-lg border border-slate-200 focus:border-blue-500 focus:ring-1 focus:ring-blue-500 focus:outline-none"
                required={showLoginForm === 'register'}
              />
              <input
                type="email"
                placeholder="El. paštas"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full mb-3 px-4 py-3 rounded-lg border border-slate-200 focus:border-blue-500 focus:ring-1 focus:ring-blue-500 focus:outline-none"
                required
              />
              <input
                type="password"
                placeholder="Slaptažodis"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full mb-4 px-4 py-3 rounded-lg border border-slate-200 focus:border-blue-500 focus:ring-1 focus:ring-blue-500 focus:outline-none"
                required
              />
              <button
                type="submit"
                className="w-full bg-blue-600 text-white py-3.5 rounded-xl font-medium hover:bg-blue-700 transition-colors"
              >
                {showLoginForm === 'login' ? 'Prisijungti' : 'Sukurti paskyrą'}
              </button>
              <button
                type="button"
                onClick={() => setShowLoginForm(null)}
                className="w-full mt-3 text-slate-500 text-sm hover:text-slate-700"
              >
                Atgal
              </button>
            </form>
          )}
        </motion.div>
      </div>
    );
  }

  const renderContent = () => {
    switch (activeTab) {
      case 'dashboard':
        return <Dashboard orders={orders} clients={clients} expenses={expenses} memories={memories} setActiveTab={setActiveTab} />;
      case 'clients':
        return <ClientsView clients={clients} orders={orders} user={user} />;
      case 'orders':
        return <OrdersView orders={orders} clients={clients} settings={settings} user={user} employees={employees} />;
      case 'calendar':
        return <CalendarView orders={orders} employees={employees} />;
      case 'settings':
        return <SettingsView settings={settings} setSettings={setSettings} user={user} />;
      case 'expenses':
        return <ExpensesView expenses={expenses} user={user} />;
      case 'analytics':
        return <AnalyticsView orders={orders} expenses={expenses} clients={clients} settings={settings} />;
      case 'logistics':
        return <LogisticsView orders={orders} />;
      case 'team':
        return <TeamView employees={employees} user={user} />;
      case 'inventory':
        return <InventoryView userId={user.uid} />;
      default:
        return <Dashboard orders={orders} clients={clients} expenses={expenses} memories={memories} setActiveTab={setActiveTab} />;
    }
  };

  return (
    <Layout activeTab={activeTab} setActiveTab={setActiveTab} onLogout={handleLogout}>
      <AnimatePresence mode="wait">
        <motion.div
          key={activeTab}
          initial={{ opacity: 0, x: 10 }}
          animate={{ opacity: 1, x: 0 }}
          exit={{ opacity: 0, x: -10 }}
          transition={{ duration: 0.2 }}
        >
          {renderContent()}
        </motion.div>
      </AnimatePresence>
      <ChatAssistant
        user={user}
        clients={clients}
        orders={orders}
        expenses={expenses}
        settings={settings}
      />
    </Layout>
  );
}

