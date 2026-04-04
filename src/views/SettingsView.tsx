/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useRef, useEffect } from 'react';
import { AppSettings, Memory, INVOICE_API_STORAGE_KEY } from '../types';
import {
  updateData,
  getData,
  TABLES,
  usesLocalStorageBackend,
  checkOrdersSchemaHealth,
  testConnection,
} from '../supabase';
import { useOrgAccess } from '../contexts/OrgAccessContext';
import { downloadData, importData } from '../localDb';
import {
  Settings,
  Save,
  Euro,
  Info,
  ExternalLink,
  Download,
  Upload,
  Copy,
  Check,
  Brain,
  Star,
  Bell,
  Mail,
} from 'lucide-react';
import { getAiBudgetStatus } from '../services/aiService';
import { getGeminiKeyFromEnv } from '../utils/geminiEnv';
import { useToast } from '../hooks/useToast';

interface LocalUser {
  uid: string;
}

interface SettingsViewProps {
  settings: AppSettings;
  setSettings: (settings: AppSettings) => void;
  user: LocalUser;
  memories?: Memory[];
}

export default function SettingsView({
  settings,
  setSettings,
  user,
  memories = [],
}: SettingsViewProps) {
  const { isRestrictedStaff } = useOrgAccess();
  const { showToast } = useToast();
  const [formData, setFormData] = useState<AppSettings>(settings);
  const [isSaving, setIsSaving] = useState(false);
  const [isCheckingSchema, setIsCheckingSchema] = useState(false);
  const [copySuccess, setCopySuccess] = useState(false);
  const [notifPermission, setNotifPermission] = useState<NotificationPermission | 'unsupported'>(
    () => (typeof Notification !== 'undefined' ? Notification.permission : 'unsupported')
  );
  const [readiness, setReadiness] = useState({
    backend: 'checking' as 'checking' | 'ok' | 'fail',
    aiKey: false,
    aiBudgetRemaining: 0,
    aiBudgetLimit: 0,
    bookingUrl: false,
    mode: usesLocalStorageBackend ? 'local-offline' : 'supabase',
  });
  const [invoiceServerCheck, setInvoiceServerCheck] = useState<'idle' | 'checking' | 'ok' | 'fail'>(
    'idle'
  );
  const [invoiceServerHint, setInvoiceServerHint] = useState<string>('');

  useEffect(() => {
    let inv = settings.invoiceApiBaseUrl?.trim() ?? '';
    if (!inv) {
      try {
        inv = localStorage.getItem(INVOICE_API_STORAGE_KEY)?.trim() ?? '';
      } catch {
        /* */
      }
    }
    setFormData({ ...settings, invoiceApiBaseUrl: inv });
  }, [settings]);

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isRestrictedStaff) {
      showToast.error('Kainų ir integracijų keitimas prieinamas tik administratoriui.');
      return;
    }
    setIsSaving(true);
    try {
      const { invoiceApiBaseUrl, ...dbPayload } = formData;
      try {
        localStorage.setItem(INVOICE_API_STORAGE_KEY, (invoiceApiBaseUrl ?? '').trim());
      } catch {
        /* */
      }
      if (settings.id) {
        await updateData(TABLES.SETTINGS, settings.id, dbPayload as Partial<AppSettings>);
      }
      setSettings({ ...formData });
      showToast.success('Nustatymai išsaugoti!');
    } catch {
      showToast.error('Nepavyko išsaugoti nustatymų');
    } finally {
      setIsSaving(false);
    }
  };

  const handleCheckInvoiceServer = async () => {
    const raw = formData.invoiceApiBaseUrl?.trim();
    const healthUrl = raw
      ? `${raw.replace(/\/$/, '')}/health`
      : import.meta.env.DEV
        ? '/health'
        : '';
    if (!healthUrl) {
      showToast.error(
        'Produkcijoje įrašykite serverio adresą. Lokaliai – paleiskite `npm run server` arba `npm run dev:full`.'
      );
      return;
    }
    setInvoiceServerCheck('checking');
    setInvoiceServerHint('');
    try {
      const r = await fetch(healthUrl);
      const j = (await r.json().catch(() => ({}))) as { status?: string; invoiceEmail?: boolean };
      if (!r.ok) throw new Error(`HTTP ${r.status}`);
      const emailOk = j.invoiceEmail === true;
      setInvoiceServerCheck('ok');
      setInvoiceServerHint(
        emailOk
          ? 'Serveris veikia; Resend API raktas serveryje nustatytas — sąskaitos bus siunčiamos automatiškai.'
          : 'Serveris atsako, bet serveryje trūksta RESEND_API_KEY (.env) — automatinis el. paštas neveiks, kol jį pridėsite.'
      );
      showToast.success('Ryšys su serveriu patikrintas');
    } catch {
      setInvoiceServerCheck('fail');
      setInvoiceServerHint(
        'Nepavyko pasiekti serverio. Paleiskite `npm run server` ir patikrinkite adresą.'
      );
      showToast.error('Serveris nepasiekiamas');
    }
  };

  const bookingUrl = `${window.location.origin}/booking/${user.uid}`;
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleCopy = () => {
    navigator.clipboard.writeText(bookingUrl);
    setCopySuccess(true);
    setTimeout(() => setCopySuccess(false), 2000);
  };

  const handleExport = () => {
    downloadData();
    showToast.success('Duomenys išsaugoti į failą!');
  };

  const handleExportCloudJson = async () => {
    if (usesLocalStorageBackend) {
      showToast.error('Debesies eksportas galimas tik su Supabase režimu.');
      return;
    }
    try {
      const [clients, orders, settingsRows, expenses, employees, mems] = await Promise.all([
        getData(TABLES.CLIENTS, user.uid),
        getData(TABLES.ORDERS, user.uid),
        getData(TABLES.SETTINGS, user.uid),
        getData(TABLES.EXPENSES, user.uid),
        getData(TABLES.EMPLOYEES, user.uid),
        getData('memories', user.uid),
      ]);
      const payload = {
        exportedAt: new Date().toISOString(),
        ownerUid: user.uid,
        clients,
        orders,
        settings: settingsRows,
        expenses,
        employees,
        memories: mems,
      };
      const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `svarus-crm-export-${user.uid.slice(0, 8)}.json`;
      a.click();
      URL.revokeObjectURL(url);
      showToast.success('JSON eksportas paruoštas.');
    } catch {
      showToast.error('Nepavyko eksportuoti duomenų.');
    }
  };

  const handleImport = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      const content = event.target?.result as string;
      const result = importData(content);
      if (result.success) showToast.success(result.message);
      else showToast.error(result.message);
      if (result.success) {
        window.location.reload();
      }
    };
    reader.readAsText(file);
    // Reset input
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const handleRequestBookingNotifications = async () => {
    if (typeof Notification === 'undefined') {
      showToast.error('Ši naršyklė nepalaiko darbalaukio pranešimų.');
      return;
    }
    try {
      const r = await Notification.requestPermission();
      setNotifPermission(r);
      if (r === 'granted') {
        showToast.success(
          'Įjungta: gausite sistemos pranešimą apie naują rezervaciją (kai CRM atnaujina duomenis).'
        );
      } else if (r === 'denied') {
        showToast.warning(
          'Pranešimai atmesti — vis tiek matysite žalią pranešimą programėlės viduje, kai esate prisijungę.'
        );
      }
    } catch {
      showToast.error('Nepavyko paprašyti pranešimų leidimo.');
    }
  };

  const handleCheckOrdersSchema = async () => {
    setIsCheckingSchema(true);
    try {
      const result = await checkOrdersSchemaHealth(user.uid);
      if (result.ok) showToast.success(result.message);
      else showToast.error(result.message);
    } catch (error: unknown) {
      const msg = error instanceof Error ? error.message : 'Unknown error';
      showToast.error(`Schema check failed: ${msg}`);
    } finally {
      setIsCheckingSchema(false);
    }
  };

  const refreshReadiness = async () => {
    const connected = await testConnection().catch(() => false);
    const ai = getAiBudgetStatus();
    const envGem = getGeminiKeyFromEnv();
    const custom = localStorage.getItem('custom_api_key') || '';
    setReadiness({
      backend: connected ? 'ok' : 'fail',
      aiKey: !!envGem || !!custom,
      aiBudgetRemaining: ai.remaining,
      aiBudgetLimit: ai.limit,
      bookingUrl: bookingUrl.startsWith('http'),
      mode: usesLocalStorageBackend ? 'local-offline' : 'supabase',
    });
  };

  useEffect(() => {
    void refreshReadiness();
    // Pradinė būklė: bookingUrl / user iš props jau stabilūs šiame mount'e
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div className="space-y-6">
      <h2 className="text-xl font-bold text-slate-900">Nustatymai</h2>

      {isRestrictedStaff && (
        <div className="bg-amber-50 border border-amber-200 text-amber-950 text-sm p-4 rounded-2xl">
          Prisijungėte kaip <strong>darbuotojas</strong>: matote tik dalį nustatymų (be kainų,
          sąskaitų serverio ir debesies eksporto).
        </div>
      )}

      {/* Backup Section */}
      {usesLocalStorageBackend && (
        <section className="bg-amber-50 p-6 rounded-3xl border border-amber-200 shadow-sm">
          <div className="flex items-center gap-3 mb-4">
            <div className="w-10 h-10 bg-amber-100 rounded-xl flex items-center justify-center text-amber-600">
              <Download size={20} />
            </div>
            <div>
              <h3 className="font-bold text-amber-900">Atsarginės kopijos</h3>
              <p className="text-xs text-amber-700">Duomenys saugomi tik naršyklėje</p>
            </div>
          </div>

          <div className="flex gap-3">
            <button
              type="button"
              onClick={handleExport}
              className="flex-1 flex items-center justify-center gap-2 bg-amber-500 text-white py-3 px-4 rounded-xl font-medium hover:bg-amber-600 transition-colors"
            >
              <Download size={18} />
              Eksportuoti
            </button>
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              className="flex-1 flex items-center justify-center gap-2 bg-white text-amber-700 py-3 px-4 rounded-xl font-medium border border-amber-300 hover:bg-amber-50 transition-colors"
            >
              <Upload size={18} />
              Importuoti
            </button>
            <input
              ref={fileInputRef}
              type="file"
              accept=".json"
              onChange={handleImport}
              title="Importuoti duomenų failą"
              aria-label="Importuoti duomenų failą"
              className="hidden"
            />
          </div>
        </section>
      )}

      <section className="bg-white p-6 rounded-3xl border border-slate-100 shadow-sm">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-emerald-50 rounded-xl flex items-center justify-center text-emerald-600">
              <Settings size={20} />
            </div>
            <h3 className="font-bold text-slate-900">Production Readiness</h3>
          </div>
          <button
            type="button"
            onClick={refreshReadiness}
            className="px-3 py-1.5 rounded-lg bg-slate-100 text-slate-700 text-xs font-bold hover:bg-slate-200"
          >
            Atnaujinti būseną
          </button>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-2 text-sm">
          <div className="bg-slate-50 rounded-xl px-3 py-2 border border-slate-100">
            Backend:{' '}
            <span
              className={
                readiness.backend === 'ok'
                  ? 'text-emerald-700 font-bold'
                  : readiness.backend === 'fail'
                    ? 'text-rose-700 font-bold'
                    : 'text-slate-500'
              }
            >
              {readiness.backend}
            </span>
          </div>
          <div className="bg-slate-50 rounded-xl px-3 py-2 border border-slate-100">
            Režimas: <span className="font-bold text-slate-700">{readiness.mode}</span>
          </div>
          <div className="bg-slate-50 rounded-xl px-3 py-2 border border-slate-100">
            AI raktas:{' '}
            <span
              className={readiness.aiKey ? 'text-emerald-700 font-bold' : 'text-rose-700 font-bold'}
            >
              {readiness.aiKey ? 'ok' : 'trūksta'}
            </span>
          </div>
          <div className="bg-slate-50 rounded-xl px-3 py-2 border border-slate-100">
            AI dienos biudžetas:{' '}
            <span className="font-bold text-slate-700">
              {readiness.aiBudgetRemaining}/{readiness.aiBudgetLimit}
            </span>
          </div>
          <div className="bg-slate-50 rounded-xl px-3 py-2 border border-slate-100 md:col-span-2">
            Booking URL:{' '}
            <span
              className={
                readiness.bookingUrl ? 'text-emerald-700 font-bold' : 'text-rose-700 font-bold'
              }
            >
              {readiness.bookingUrl ? 'ok' : 'klaida'}
            </span>
          </div>
        </div>
      </section>

      {!isRestrictedStaff && !usesLocalStorageBackend && (
        <section className="bg-white p-6 rounded-3xl border border-slate-100 shadow-sm">
          <div className="flex items-center gap-3 mb-4">
            <div className="w-10 h-10 bg-sky-50 rounded-xl flex items-center justify-center text-sky-600">
              <Download size={20} />
            </div>
            <div>
              <h3 className="font-bold text-slate-900">Debesies duomenų eksportas (JSON)</h3>
              <p className="text-xs text-slate-500 mt-0.5">
                Atsisiųskite klientų, užsakymų ir kitų lentelių kopiją atsargai. Failas skirtas
                administratoriui.
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={() => void handleExportCloudJson()}
            className="w-full sm:w-auto px-4 py-3 rounded-xl bg-sky-600 text-white text-sm font-bold hover:bg-sky-700"
          >
            Eksportuoti JSON
          </button>
        </section>
      )}

      {!isRestrictedStaff && (
        <section className="bg-white p-6 rounded-3xl border border-slate-100 shadow-sm">
          <div className="flex items-center gap-3 mb-4">
            <div className="w-10 h-10 bg-violet-50 rounded-xl flex items-center justify-center text-violet-600">
              <Mail size={20} />
            </div>
            <div>
              <h3 className="font-bold text-slate-900">Sąskaitų siuntimas el. paštu</h3>
              <p className="text-xs text-slate-500 mt-0.5">
                Vienas mygtukas užsakyme: PDF automatiškai išsiunčiamas į kliento el. paštą (jei jis
                įrašytas kliento kortelėje).
              </p>
            </div>
          </div>
          <ol className="text-xs text-slate-600 space-y-2 mb-4 list-decimal list-inside">
            <li>
              Sukurkite nemokamą paskyrą{' '}
              <a
                href="https://resend.com"
                target="_blank"
                rel="noopener noreferrer"
                className="text-violet-600 font-semibold underline"
              >
                resend.com
              </a>
              , gaukite API raktą.
            </li>
            <li>
              Į projekto <span className="font-mono bg-slate-100 px-1 rounded">.env</span> įrašykite{' '}
              <span className="font-mono bg-slate-100 px-1 rounded">RESEND_API_KEY</span> ir{' '}
              <span className="font-mono bg-slate-100 px-1 rounded">RESEND_FROM_EMAIL</span>{' '}
              (patvirtintas siuntėjas).
            </li>
            <li>
              Paleiskite backendą:{' '}
              <span className="font-mono bg-slate-100 px-1 rounded">npm run server</span> (atskirame
              lange) arba{' '}
              <span className="font-mono bg-slate-100 px-1 rounded">npm run dev:full</span> (CRM +
              serveris kartu).
            </li>
            <li>
              Kūrimo režime (
              <span className="font-mono bg-slate-100 px-1 rounded">npm run dev</span>) serverio
              adreso lauką galite palikti tuščią — užklausos eina per{' '}
              <span className="font-mono bg-slate-100 px-1 rounded">/api</span> į prievadą 3001 (kai
              serveris veikia).
            </li>
            <li>
              Produkcijoje žemiau įrašykite tikrą API adresą. Prisijunkite prie CRM per Supabase.
            </li>
          </ol>
          <div className="flex flex-col sm:flex-row gap-2 mb-2">
            <input
              type="url"
              placeholder="http://127.0.0.1:3001"
              value={formData.invoiceApiBaseUrl ?? ''}
              onChange={(e) => setFormData({ ...formData, invoiceApiBaseUrl: e.target.value })}
              title="API serverio bazinis URL (be / pabaigoje)"
              className="flex-1 bg-slate-50 border border-slate-100 rounded-xl p-3 text-sm focus:outline-none focus:ring-2 focus:ring-violet-500/20"
            />
            <button
              type="button"
              onClick={handleCheckInvoiceServer}
              className="shrink-0 px-4 py-3 rounded-xl bg-violet-600 text-white text-sm font-bold hover:bg-violet-700"
            >
              Tikrinti serverį
            </button>
          </div>
          {invoiceServerCheck !== 'idle' && (
            <p
              className={`text-xs mt-2 ${
                invoiceServerCheck === 'ok'
                  ? 'text-emerald-700'
                  : invoiceServerCheck === 'fail'
                    ? 'text-rose-600'
                    : 'text-slate-500'
              }`}
            >
              {invoiceServerCheck === 'checking' ? 'Tikrinama…' : invoiceServerHint}
            </p>
          )}
        </section>
      )}

      {!isRestrictedStaff && (
        <section className="bg-white p-6 rounded-3xl border border-slate-100 shadow-sm">
          <div className="flex items-center gap-3 mb-6">
            <div className="w-10 h-10 bg-blue-50 rounded-xl flex items-center justify-center text-blue-600">
              <Euro size={20} />
            </div>
            <h3 className="font-bold text-slate-900">Kainodara ir vieša rezervacija</h3>
          </div>

          <form onSubmit={handleSave} className="space-y-4">
            <label className="flex items-start gap-3 cursor-pointer rounded-xl border border-slate-100 bg-slate-50/80 p-4">
              <input
                type="checkbox"
                checked={formData.publicBookingEnabled !== false}
                onChange={(e) =>
                  setFormData({ ...formData, publicBookingEnabled: e.target.checked })
                }
                className="mt-1 rounded border-slate-300 text-blue-600 focus:ring-blue-500"
              />
              <span>
                <span className="block text-sm font-bold text-slate-900">
                  Vieša rezervacija per /booking nuorodą
                </span>
                <span className="block text-xs text-slate-500 mt-0.5">
                  Išjungus — klientai nematys rezervacijos formos (nuoroda lieka, bet užklausa bus
                  atmesta serveryje, jei atnaujinta SQL funkcija).
                </span>
              </span>
            </label>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1">
                  Kaina už langą
                </label>
                <input
                  type="number"
                  value={formData.pricePerWindow}
                  onChange={(e) =>
                    setFormData({ ...formData, pricePerWindow: parseFloat(e.target.value) })
                  }
                  title="Kaina už langą"
                  className="w-full bg-slate-50 border border-slate-100 rounded-xl p-3 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20"
                />
              </div>
              <div>
                <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1">
                  Kaina už aukštą
                </label>
                <input
                  type="number"
                  value={formData.pricePerFloor}
                  onChange={(e) =>
                    setFormData({ ...formData, pricePerFloor: parseFloat(e.target.value) })
                  }
                  title="Kaina už aukštą"
                  className="w-full bg-slate-50 border border-slate-100 rounded-xl p-3 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20"
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1">
                  Balkonai
                </label>
                <input
                  type="number"
                  value={formData.priceBalkonai}
                  onChange={(e) =>
                    setFormData({ ...formData, priceBalkonai: parseFloat(e.target.value) })
                  }
                  title="Kaina balkonams"
                  className="w-full bg-slate-50 border border-slate-100 rounded-xl p-3 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20"
                />
              </div>
              <div>
                <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1">
                  Vitrinų valymas
                </label>
                <input
                  type="number"
                  value={formData.priceVitrinos}
                  onChange={(e) =>
                    setFormData({ ...formData, priceVitrinos: parseFloat(e.target.value) })
                  }
                  title="Kaina vitrinų valymui"
                  className="w-full bg-slate-50 border border-slate-100 rounded-xl p-3 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20"
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1">
                  Terasa
                </label>
                <input
                  type="number"
                  value={formData.priceTerasa}
                  onChange={(e) =>
                    setFormData({ ...formData, priceTerasa: parseFloat(e.target.value) })
                  }
                  title="Kaina terasos valymui"
                  className="w-full bg-slate-50 border border-slate-100 rounded-xl p-3 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20"
                />
              </div>
              <div>
                <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1">
                  Kiti paviršiai
                </label>
                <input
                  type="number"
                  value={formData.priceKiti}
                  onChange={(e) =>
                    setFormData({ ...formData, priceKiti: parseFloat(e.target.value) })
                  }
                  title="Kaina kitiems paviršiams"
                  className="w-full bg-slate-50 border border-slate-100 rounded-xl p-3 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20"
                />
              </div>
            </div>

            <div className="pt-4 border-t border-slate-100">
              <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">
                SMS Priminimo Šablonas
              </label>
              <p className="text-[10px] text-slate-400 mb-2">
                Galimi kintamieji:{' '}
                <span className="font-mono bg-slate-100 px-1 rounded">{'{vardas}'}</span>,{' '}
                <span className="font-mono bg-slate-100 px-1 rounded">{'{data}'}</span>,{' '}
                <span className="font-mono bg-slate-100 px-1 rounded">{'{laikas}'}</span>,{' '}
                <span className="font-mono bg-slate-100 px-1 rounded">{'{kaina}'}</span>
              </p>
              <textarea
                rows={3}
                value={formData.smsTemplate}
                onChange={(e) => setFormData({ ...formData, smsTemplate: e.target.value })}
                title="SMS priminimo šablonas"
                className="w-full bg-slate-50 border border-slate-100 rounded-xl p-3 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20"
              />
            </div>

            <button
              type="submit"
              disabled={isSaving}
              className="w-full bg-blue-600 text-white py-4 rounded-2xl font-bold shadow-lg shadow-blue-200 hover:bg-blue-700 transition-colors flex items-center justify-center gap-2"
            >
              {isSaving ? (
                <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white"></div>
              ) : (
                <>
                  <Save size={18} />
                  Išsaugoti kainas
                </>
              )}
            </button>
          </form>
        </section>
      )}

      <section className="bg-white p-6 rounded-3xl border border-slate-100 shadow-sm">
        <div className="flex items-center gap-3 mb-4">
          <div className="w-10 h-10 bg-indigo-50 rounded-xl flex items-center justify-center text-indigo-600">
            <ExternalLink size={20} />
          </div>
          <h3 className="font-bold text-slate-900">Rezervacijos nuoroda</h3>
        </div>

        <p className="text-xs text-slate-500 mb-4">
          Pasidalinkite šia nuoroda su klientais, kad jie galėtų patys rezervuoti laiką.
        </p>

        <div className="flex flex-col gap-3">
          <div className="bg-slate-50 p-4 rounded-xl border border-slate-100 flex items-center justify-between gap-3 overflow-hidden">
            <span className="text-sm text-slate-600 truncate font-mono">{bookingUrl}</span>
            <button
              onClick={handleCopy}
              className={`flex items-center gap-2 px-4 py-2 rounded-lg font-bold transition-all ${
                copySuccess
                  ? 'bg-green-100 text-green-700'
                  : 'bg-blue-100 text-blue-700 hover:bg-blue-200'
              }`}
            >
              {copySuccess ? <Check size={16} /> : <Copy size={16} />}
              {copySuccess ? 'Nukopijuota' : 'Kopijuoti'}
            </button>
          </div>

          <a
            href={bookingUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center justify-center gap-2 bg-slate-900 text-white py-3 px-4 rounded-xl font-medium hover:bg-slate-800 transition-colors"
          >
            <ExternalLink size={18} />
            Atidaryti rezervacijos puslapį
          </a>

          <div className="mt-4 pt-4 border-t border-slate-100">
            <div className="flex items-start gap-3">
              <div className="w-10 h-10 bg-amber-50 rounded-xl flex items-center justify-center text-amber-700 shrink-0">
                <Bell size={20} />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-bold text-slate-900">
                  Perspėjimas apie naują rezervaciją
                </p>
                <p className="text-xs text-slate-500 mt-1 leading-relaxed">
                  Kai klientas užrezervuoja per jūsų nuorodą ir esate prisijungę prie CRM, viršuje
                  pasirodys žalias pranešimas su vardu ir data. Norėdami matyti sistemos pranešimą
                  net kito skirtuko fone, įjunkite leidimą žemiau. Reikia, kad Supabase būtų
                  įjungtas Realtime įrašams lentelėje{' '}
                  <code className="text-[10px] bg-slate-100 px-1 rounded">orders</code> (Dashboard →
                  Database → Replication).
                </p>
                {notifPermission === 'unsupported' ? (
                  <p className="text-xs text-slate-400 mt-2">Naršyklėje nėra pranešimų API.</p>
                ) : notifPermission === 'granted' ? (
                  <p className="text-xs text-emerald-700 font-bold mt-2">
                    Darbalaukio pranešimai leidžiami.
                  </p>
                ) : notifPermission === 'denied' ? (
                  <p className="text-xs text-rose-600 mt-2">
                    Naršyklė blokuoja pranešimus — patikrinkite svetainės leidimus adreso juostoje.
                    Programėlėje vis tiek rodysime žalią juostą viršuje.
                  </p>
                ) : (
                  <button
                    type="button"
                    onClick={handleRequestBookingNotifications}
                    className="mt-3 w-full sm:w-auto px-4 py-2 rounded-xl bg-amber-500 text-white text-xs font-bold hover:bg-amber-600 transition-colors"
                  >
                    Leisti darbalaukio pranešimus
                  </button>
                )}
              </div>
            </div>
          </div>
        </div>
      </section>

      <section className="bg-blue-600 p-6 rounded-3xl shadow-xl shadow-blue-200 text-white">
        <div className="flex items-center gap-3 mb-2">
          <Info size={20} />
          <h3 className="font-bold">Apie programėlę</h3>
        </div>
        <p className="text-sm opacity-80 leading-relaxed">
          Ši programėlė sukurta specialiai Lietuvos langų valymo paslaugų teikėjams. Valdykite
          klientus, užsakymus ir pajamas vienoje vietoje.
        </p>
      </section>

      {!isRestrictedStaff && (
        <section className="bg-white p-6 rounded-3xl border border-slate-100 shadow-sm">
          <div className="flex items-center gap-3 mb-3">
            <div className="w-10 h-10 bg-slate-100 rounded-xl flex items-center justify-center text-slate-700">
              <Info size={18} />
            </div>
            <h3 className="font-bold text-slate-900">DB schema diagnostika</h3>
          </div>
          <p className="text-xs text-slate-500 mb-4">
            Patikrina, kuri `orders` lentelės schema aktyvi (`modern` ar `legacy`) ir ar įrašymas
            veiks.
          </p>
          <button
            type="button"
            onClick={handleCheckOrdersSchema}
            disabled={isCheckingSchema}
            className="bg-slate-900 text-white py-3 px-4 rounded-xl font-medium hover:bg-slate-800 transition-colors disabled:opacity-60"
          >
            {isCheckingSchema ? 'Tikrinama...' : 'Patikrinti DB schemą'}
          </button>
        </section>
      )}

      {memories && memories.length > 0 && (
        <section className="bg-gradient-to-br from-amber-50 to-orange-50 p-5 rounded-3xl border-2 border-amber-200">
          <div className="flex items-center gap-2 mb-4">
            <Brain className="text-amber-600" size={20} />
            <h3 className="font-bold text-amber-900">Asistento atmintis</h3>
            <span className="ml-auto bg-amber-200 text-amber-800 text-xs px-2 py-1 rounded-full font-bold">
              {memories.length}
            </span>
          </div>
          <p className="text-xs text-amber-700 mb-4">
            Čia saugomi svarbūs sprendimai, klientų ypatumai ir mokymų temos.
          </p>
          <div className="space-y-3 max-h-64 overflow-y-auto">
            {memories.slice(0, 10).map((mem) => (
              <div
                key={mem.id}
                className="bg-white p-3 rounded-xl border border-amber-100 shadow-sm"
              >
                <div className="flex items-start gap-2">
                  <div className="flex gap-0.5 mt-0.5">
                    {Array.from({ length: mem.importance || 3 }).map((_, i) => (
                      <Star key={i} size={10} className="text-amber-400 fill-amber-400" />
                    ))}
                  </div>
                  <div className="flex-1">
                    <p className="text-sm text-slate-800">{mem.content}</p>
                    <div className="flex items-center gap-2 mt-1">
                      <span className="text-[10px] bg-amber-100 text-amber-700 px-2 py-0.5 rounded-full">
                        {mem.category === 'verslas'
                          ? '💼 Verslas'
                          : mem.category === 'klientas'
                            ? '👤 Klientas'
                            : mem.category === 'procesas'
                              ? '⚙️ Procesas'
                              : '📋 Kita'}
                      </span>
                      <span className="text-[10px] text-slate-400">
                        {mem.createdAt?.split('T')[0]}
                      </span>
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
          {memories.length > 10 && (
            <p className="text-xs text-amber-600 mt-3 text-center">
              + dar {memories.length - 10} įrašų...
            </p>
          )}
        </section>
      )}
    </div>
  );
}
