/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useRef, lazy, Suspense, useCallback, useMemo } from 'react';
import { signIn, signUp, signOut, signInWithGoogle, getCurrentUser, subscribeToData, getData, addData, updateData, TABLES, testConnection, AuthUser, isDemoMode, usesFirebase, getUserProfile, createDefaultProfile, requestPasswordResetEmail } from './supabase';
import Layout from './components/Layout';
import { OrgAccessProvider } from './contexts/OrgAccessContext';
import ErrorBoundary from './components/ErrorBoundary';
import { FullPageLoader } from './components/LoadingSpinner';
import { Client, Order, AppSettings, DEFAULT_SETTINGS, Expense, Employee, Memory, UserProfile, INVOICE_API_STORAGE_KEY } from './types';
import { Droplets } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { ToastContainer } from './components/Toast';
import { Button } from './components/ui/Button';
import { useToast } from './hooks/useToast';
import { formatAuthErrorForUser, AUTH_FALLBACK, AUTH_INVITE_HELP } from './utils/authMessages';
import { formatNewOrderAlert, showNewOrderBrowserNotification } from './utils/bookingNotifications';

const BookingPage = lazy(() => import('./views/BookingPage'));
const ChatAssistant = lazy(() => import('./components/ChatAssistant'));

// Client Portal Components
const ClientLogin = lazy(() => import('./views/ClientPortal/ClientLogin'));
const ClientRegistration = lazy(() => import('./views/ClientPortal/ClientRegistration'));
const ClientDashboard = lazy(() => import('./views/ClientPortal/ClientDashboard'));

const Dashboard = lazy(() => import('./views/Dashboard'));
const ClientsView = lazy(() => import('./views/ClientsView'));
const OrdersView = lazy(() => import('./views/OrdersView'));
const CalendarView = lazy(() => import('./views/CalendarView'));
const SettingsView = lazy(() => import('./views/SettingsView'));
const ExpensesView = lazy(() => import('./views/ExpensesView'));
const AnalyticsView = lazy(() => import('./views/AnalyticsView'));
const LogisticsView = lazy(() => import('./views/LogisticsView'));
const TeamView = lazy(() => import('./views/TeamView'));
const InventoryView = lazy(() => import('./views/InventoryView'));
const PaymentsView = lazy(() => import('./views/PaymentsView'));
const ResetPasswordView = lazy(() => import('./views/ResetPasswordView'));

// Optimized toast system - removed DOM manipulation

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
  const [rememberMe, setRememberMe] = useState(() => {
    return localStorage.getItem('saved_email') !== null;
  });

  // Toast system
  const { toasts, removeToast, showToast } = useToast();
  const showToastRef = useRef(showToast);
  showToastRef.current = showToast;

  // Client Portal State
  const [userProfile, setUserProfile] = useState<UserProfile | null>(null);
  const [showClientPortal, setShowClientPortal] = useState<'login' | 'register' | 'dashboard' | null>(null);

  // Set saved email on load
  useEffect(() => {
    const savedEmail = localStorage.getItem('saved_email');
    if (savedEmail) {
      setEmail(savedEmail);
    }
  }, []);

  // Auto-set API key from .env if custom key not saved (OpenRouter takes precedence if both)
  useEffect(() => {
    if (localStorage.getItem('custom_api_key')) return;
    const or = import.meta.env.VITE_OPENROUTER_API_KEY;
    if (or && String(or).trim().startsWith('sk-or-v1-')) {
      localStorage.setItem('custom_api_key', String(or).trim());
      return;
    }
    const gem =
      import.meta.env.VITE_GEMINI_API_KEY ||
      (typeof process !== 'undefined'
        ? String((process.env as Record<string, string | undefined>).GEMINI_API_KEY ?? '').trim()
        : '');
    if (gem) {
      localStorage.setItem('custom_api_key', gem);
    }
  }, []);

  // Simple routing for booking page
  const path = window.location.pathname;
  const isBookingPage = path.startsWith('/booking/');
  const bookingUserId = isBookingPage ? path.split('/')[2] : null;
  const isResetPasswordPage = /^\/reset-password\/?$/.test(path);

  useEffect(() => {
    let cancelled = false;

    // Auto-login: try to restore from localStorage
    const savedUser = localStorage.getItem('saved_user');
    if (savedUser) {
      try {
        const userObj = JSON.parse(savedUser);
        if (userObj.uid && userObj.email) {
          setUser(userObj);
          setLoading(false);
          return;
        }
      } catch (e) {
        localStorage.removeItem('saved_user');
      }
    }

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
    if (!user) {
      setUserProfile(null);
      return;
    }

    // Load user profile to determine role
    getUserProfile(user.uid).then(profile => {
      if (profile) {
        setUserProfile(profile);
        // If user is client, show client portal
        if (profile.role === 'client') {
          setShowClientPortal('dashboard');
        } else {
          setShowClientPortal(null);
        }
      } else {
        // Create default profile for staff users
        createDefaultProfile(user.uid, user.email, 'admin').then(newProfile => {
          setUserProfile(newProfile);
          setShowClientPortal(null);
        });
      }
    });

    // Load Settings
    getData<any>(TABLES.SETTINGS, user.uid).then(settingsData => {
      let fromLs = '';
      try {
        fromLs = localStorage.getItem(INVOICE_API_STORAGE_KEY)?.trim() ?? '';
      } catch {
        /* */
      }
      if (settingsData.length > 0) {
        const row = settingsData[0] as AppSettings & { invoice_api_base_url?: string };
        setSettings({
          ...DEFAULT_SETTINGS,
          ...row,
          invoiceApiBaseUrl:
            row.invoiceApiBaseUrl?.trim() ||
            (typeof row.invoice_api_base_url === 'string' ? row.invoice_api_base_url.trim() : '') ||
            fromLs,
        });
      } else {
        addData(TABLES.SETTINGS, user.uid, {
          pricePerWindow: DEFAULT_SETTINGS.pricePerWindow,
          pricePerFloor: DEFAULT_SETTINGS.pricePerFloor,
          priceBalkonai: DEFAULT_SETTINGS.priceBalkonai,
          priceVitrinos: DEFAULT_SETTINGS.priceVitrinos,
          priceTerasa: DEFAULT_SETTINGS.priceTerasa,
          priceKiti: DEFAULT_SETTINGS.priceKiti,
          smsTemplate: DEFAULT_SETTINGS.smsTemplate,
          publicBookingEnabled: DEFAULT_SETTINGS.publicBookingEnabled,
        }).then((newSettings) => {
          const s = newSettings as unknown as AppSettings;
          setSettings({
            ...(DEFAULT_SETTINGS as AppSettings),
            ...s,
            invoiceApiBaseUrl: fromLs || s.invoiceApiBaseUrl || '',
          });
        });
      }
    });

    // Subscribe to Clients
    const unsubClients = subscribeToData<Client>(TABLES.CLIENTS, user.uid, (data) => {
      setClients(data);
    });

    // Subscribe to Orders (+ perspėjimas naujai rezervacijai / užsakymui)
    const ordersHydratedRef = { current: false };
    const prevOrderIdsRef = { current: new Set<string>() };

    const unsubOrders = subscribeToData<Order>(TABLES.ORDERS, user.uid, (data) => {
      const nextIds = new Set(data.map((o) => o.id));

      if (!ordersHydratedRef.current) {
        ordersHydratedRef.current = true;
        prevOrderIdsRef.current = nextIds;
        setOrders(data);
        return;
      }

      const prev = prevOrderIdsRef.current;
      const newOrders = data.filter((o) => !prev.has(o.id));
      prevOrderIdsRef.current = nextIds;
      setOrders(data);

      for (const o of newOrders) {
        const detail = formatNewOrderAlert(o);
        showToastRef.current.success(`Nauja rezervacija: ${detail}`, 10_000);
        showNewOrderBrowserNotification(o, detail);
      }
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

  const handleLogin = async (e: React.FormEvent, rememberMe: boolean = false) => {
    e.preventDefault();
    try {
      const result = await signIn(email, password);
      const { user: userData } = result;
      if (userData) {
        const userObj = {
          uid: userData.id,
          email: userData.email || '',
          displayName: userData.user_metadata?.display_name || null,
          photoURL: userData.user_metadata?.avatar_url || null,
        };
        setUser(userObj);
        
        // Auto-login: save to localStorage if remember me is checked
        if (rememberMe) {
          localStorage.setItem('saved_user', JSON.stringify(userObj));
          localStorage.setItem('saved_email', email);
        }
      }
      setShowLoginForm(null);
      // Show info if using demo fallback
      if ('isDemoFallback' in result) {
        showToast.info('Jungiamasi į demonstracinį režimą');
      }
    } catch (error: unknown) {
      console.error('Login failed:', error);
      showToast.error(formatAuthErrorForUser(error, AUTH_FALLBACK.login));
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
        showToast.success('Paskyra sukurta demonstraciniame režime');
      } else {
        showToast.success('Paskyra sukurta. Jūs automatiškai prisijungėte.');
      }
    } catch (error: unknown) {
      console.error('Registration failed:', error);
      showToast.error(formatAuthErrorForUser(error, AUTH_FALLBACK.register));
    }
  };

  const handleLogout = async () => {
    await signOut();
    setUser(null);
    setClients([]);
    setOrders([]);
    setExpenses([]);
    setEmployees([]);
    // Clear saved credentials
    localStorage.removeItem('saved_user');
    localStorage.removeItem('saved_email');
  };

  const handleClientLogin = (authUser: AuthUser) => {
    setUser(authUser);
    getUserProfile(authUser.uid).then(profile => {
      if (profile?.role === 'client') {
        setUserProfile(profile);
        setShowClientPortal('dashboard');
      } else {
        setShowClientPortal(null);
        if (profile) setUserProfile(profile);
      }
    });
  };

  const handleClientRegister = (authUser: AuthUser, client: Client) => {
    setUser(authUser);
    const profile: UserProfile = {
      id: crypto.randomUUID(),
      uid: authUser.uid,
      email: authUser.email || '',
      role: 'client',
      clientId: client.id,
      name: client.name,
      phone: client.phone,
      createdAt: new Date().toISOString()
    };
    setUserProfile(profile);
    setShowClientPortal('dashboard');
    showToast.success('Paskyra sukurta. Sveiki prisijungę!');
  };

  const handleClientLogout = () => {
    setUser(null);
    setUserProfile(null);
    setShowClientPortal(null);
    setActiveTab('dashboard');
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  if (isResetPasswordPage) {
    return (
      <Suspense fallback={<FullPageLoader text="Kraunama..." />}>
        <ResetPasswordView />
      </Suspense>
    );
  }

  if (isBookingPage && bookingUserId) {
    return (
      <Suspense fallback={
        <div className="min-h-screen flex items-center justify-center bg-slate-50">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
        </div>
      }>
        <BookingPage userId={bookingUserId} />
      </Suspense>
    );
  }

  if (!user) {
    return (
      <>
      <ToastContainer toasts={toasts} onRemove={removeToast} />
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
          <h1 className="text-xl font-semibold text-slate-900 mb-2">Švarus Darbas CRM</h1>
          <p className="text-slate-600 mb-3 text-sm leading-relaxed">Valdykite užsakymus, klientus ir komandą vienoje sistemoje.</p>
          <div className="mb-4 text-left text-[12px] text-slate-600 bg-slate-50 border border-slate-100 rounded-lg p-3">
            <p className="font-semibold text-slate-800 mb-1">Greitas startas komandai:</p>
            <p>1. Sukurkite darbuotojo paskyrą.</p>
            <p>2. Prisijunkite ir atsidarykite „Nustatymai“.</p>
            <p>3. Pasidalinkite rezervacijos nuoroda su klientais.</p>
          </div>
          <div className="mb-4 text-left text-[11px] text-slate-600 bg-white border border-slate-100 rounded-lg p-3 space-y-1.5">
            <p><span className="font-semibold text-slate-800">Komanda:</span> {AUTH_INVITE_HELP.staffInvite}</p>
            <p><span className="font-semibold text-slate-800">Klientai:</span> {AUTH_INVITE_HELP.clientInvite}</p>
          </div>
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
                ⚠️ Nepavyko prisijungti prie duomenų bazės. Patikrinkite interneto ryšį arba kreipkitės į administratorių.
              </div>
              <Button
                type="button"
                variant="secondary"
                size="lg"
                fullWidth
                className="mb-3"
                onClick={() => {
                  setConnectionStatus('checking');
                  testConnection().then(connected => {
                    setConnectionStatus(connected ? 'connected' : 'disconnected');
                  }).catch(() => {
                    setConnectionStatus('disconnected');
                  });
                }}
              >
                Bandyti vėl
              </Button>
            </>
          )}
          {isDemoMode && (
            <div className="mb-4 p-3 bg-amber-50 rounded-lg text-xs text-amber-900 text-left border border-amber-100">
              Vietinis režimas: duomenys saugomi šioje naršyklėje. Debesiui: Firebase (<code className="text-[11px] bg-amber-100/80 px-1 rounded">VITE_USE_FIREBASE</code> + raktai) arba Supabase (<code className="text-[11px] bg-amber-100/80 px-1 rounded">VITE_SUPABASE_*</code>).
            </div>
          )}

          {!showLoginForm ? (
            <>
              <Button
                variant="primary"
                size="lg"
                fullWidth
                className="mb-3"
                onClick={() => { setShowClientPortal(null); setShowLoginForm('login'); }}
              >
                Darbuotojo prisijungimas
              </Button>
              <Button
                variant="success"
                size="lg"
                fullWidth
                className="mb-3"
                onClick={() => { setShowLoginForm(null); setShowClientPortal('login'); }}
              >
                Kliento prisijungimas
              </Button>
              <Button
                variant="secondary"
                size="md"
                fullWidth
                className="mt-3"
                onClick={() => { setShowClientPortal(null); setShowLoginForm('register'); }}
              >
                Sukurti darbuotojo paskyrą
              </Button>
              <Button
                variant="successSoft"
                size="md"
                fullWidth
                className="mt-3"
                onClick={() => { setShowLoginForm(null); setShowClientPortal('register'); }}
              >
                Sukurti kliento paskyrą
              </Button>
              <div className="relative my-4">
                <div className="absolute inset-0 flex items-center">
                  <div className="w-full border-t border-slate-200"></div>
                </div>
                <div className="relative flex justify-center text-sm">
                  <span className="px-2 bg-white text-slate-500">arba</span>
                </div>
              </div>
              <Button
                type="button"
                variant="outline"
                size="lg"
                fullWidth
                className="font-medium"
                onClick={async () => {
                  try {
                    await signInWithGoogle();
                  } catch (error: unknown) {
                    console.error('Google login failed:', error);
                    showToast.error(formatAuthErrorForUser(error, AUTH_FALLBACK.google));
                  }
                }}
              >
                <svg viewBox="0 0 24 24" className="w-5 h-5">
                  <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" />
                  <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
                  <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" />
                  <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" />
                </svg>
                Prisijungti su Google
              </Button>
            </>
          ) : (
            <form onSubmit={(e) => showLoginForm === 'login' ? handleLogin(e, rememberMe) : handleRegister(e)}>
              {showLoginForm === 'register' && (
                <input
                  type="text"
                  placeholder="Vardas"
                  value={displayName}
                  onChange={(e) => setDisplayName(e.target.value)}
                  className="w-full mb-3 px-4 py-3 rounded-lg border border-slate-200 focus:border-blue-500 focus:ring-1 focus:ring-blue-500 focus:outline-none"
                  required
                />
              )}
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
              {showLoginForm === 'login' && (
                <>
                  <div className="text-right -mt-2 mb-3">
                    <button
                      type="button"
                      title="Siųsti slaptažodžio atkūrimo nuorodą į el. paštą"
                      onClick={async () => {
                        const trimmed = email.trim();
                        if (!trimmed || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmed)) {
                          showToast.error('Įveskite el. paštą aukščiau, tada spauskite „Pamiršote slaptažodį?“.');
                          return;
                        }
                        try {
                          await requestPasswordResetEmail(trimmed);
                          showToast.success('Jei paskyra egzistuoja, netrukus gausite laišką su nuoroda.');
                        } catch (e: unknown) {
                          showToast.error(formatAuthErrorForUser(e, 'Nepavyko išsiųsti atkūrimo laiško.'));
                        }
                      }}
                      className="text-xs text-blue-600 hover:text-blue-800"
                    >
                      Pamiršote slaptažodį?
                    </button>
                  </div>
                  <label className="flex items-center gap-2 mb-4 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={rememberMe}
                      onChange={(e) => setRememberMe(e.target.checked)}
                      className="w-4 h-4 text-blue-600 rounded border-slate-300 focus:ring-blue-500"
                    />
                    <span className="text-sm text-slate-600">Prisiminti mane kitą kartą</span>
                  </label>
                </>
              )}
              <Button type="submit" variant="primary" size="lg" fullWidth>
                {showLoginForm === 'login' ? 'Prisijungti' : 'Sukurti paskyrą'}
              </Button>
              <Button
                type="button"
                variant="ghost"
                size="md"
                fullWidth
                className="mt-3 text-slate-500 text-sm font-normal"
                onClick={() => setShowLoginForm(null)}
              >
                Atgal
              </Button>
            </form>
          )}
        </motion.div>
      </div>
      {showClientPortal === 'login' && (
        <Suspense fallback={<FullPageLoader text="Kraunama..." />}>
          <ClientLogin
            onSuccess={handleClientLogin}
            onRegister={() => setShowClientPortal('register')}
            onBack={() => setShowClientPortal(null)}
          />
        </Suspense>
      )}
      {showClientPortal === 'register' && (
        <Suspense fallback={<FullPageLoader text="Kraunama..." />}>
          <ClientRegistration
            onSuccess={handleClientRegister}
            onBack={() => setShowClientPortal('login')}
          />
        </Suspense>
      )}
      </>
    );
  }

  const renderContent = () => {
    const content = (() => {
      switch (activeTab) {
        case 'dashboard':
          return <Dashboard orders={orders} clients={clients} expenses={expenses} memories={memories} setActiveTab={setActiveTab} user={user} settings={settings} />;
        case 'clients':
          return <ClientsView clients={clients} orders={orders} user={user} />;
        case 'orders':
          return <OrdersView orders={orders} clients={clients} settings={settings} user={user} employees={employees} />;
        case 'calendar':
          return <CalendarView orders={orders} employees={employees} clients={clients} onOpenClient={() => setActiveTab('clients')} />;
        case 'settings':
          return <SettingsView settings={settings} setSettings={setSettings} user={user} memories={memories} />;
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
        case 'payments':
          return <PaymentsView user={user} clients={clients} orders={orders} />;
        default:
          return <Dashboard orders={orders} clients={clients} expenses={expenses} memories={memories} setActiveTab={setActiveTab} />;
      }
    })();

    return (
      <Suspense fallback={
        <div className="flex items-center justify-center p-8">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
        </div>
      }>
        {content}
      </Suspense>
    );
  };

  return (
    <ErrorBoundary>
      <div className="min-h-screen bg-slate-50">
        {/* Toast Container */}
        <ToastContainer toasts={toasts} onRemove={removeToast} />
        
        {showClientPortal === 'dashboard' && user && userProfile && (
          <ClientDashboard
            user={user}
            profile={userProfile}
            onLogout={handleClientLogout}
          />
        )}

      {/* Staff CRM */}
      {!showClientPortal && user && (
        <OrgAccessProvider value={{ isRestrictedStaff: userProfile?.role === 'staff' }}>
          <Layout 
            activeTab={activeTab} 
            setActiveTab={setActiveTab} 
            onLogout={handleLogout}
          >
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
            <Suspense fallback={
              <div className="fixed bottom-20 right-4 w-14 h-14 bg-blue-600 text-white rounded-full shadow-lg flex items-center justify-center z-40">
                <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-white"></div>
              </div>
            }>
              <ChatAssistant
                user={user}
                clients={clients}
                orders={orders}
                expenses={expenses}
                settings={settings}
                activeTab={activeTab}
              />
            </Suspense>
          </Layout>
        </OrgAccessProvider>
      )}

      </div>
    </ErrorBoundary>
  );
}
