/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from 'react';
import { getData, addData, TABLES, fetchPublicBookingSettings, submitPublicBooking, isDemoMode, isRemoteBackend } from '../supabase';
import { AppSettings, DEFAULT_SETTINGS, BuildingType, OrderStatus } from '../types';
import { calculateOrderPrice, formatCurrency, geocodeAddress } from '../utils';
import { Calendar, Clock, MapPin, User, Phone, CheckCircle2, ChevronRight, Info } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';

interface BookingPageProps {
  userId: string;
}

export default function BookingPage({ userId }: BookingPageProps) {
  const [settings, setSettings] = useState<AppSettings>(DEFAULT_SETTINGS);
  const [isBooked, setIsBooked] = useState(false);
  const [loading, setLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorBanner, setErrorBanner] = useState<string | null>(null);
  const [formData, setFormData] = useState({
    name: '',
    phone: 'nesutarta',
    address: '',
    buildingType: 'butas' as BuildingType,
    date: new Date(Date.now() + 86400000).toISOString().split('T')[0],
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
  });

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const next = await fetchPublicBookingSettings(userId);
        if (!cancelled) setSettings(next);
      } catch {
        // Error fetching settings silently
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [userId]);

  const totalPrice = calculateOrderPrice(
    formData.windowCount,
    formData.floor,
    formData.additionalServices,
    settings
  );

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    setErrorBanner(null);
    try {
      const normalizedPhone = formData.phone.trim() || 'nesutarta';
      const coords = await geocodeAddress(formData.address);
      const useCloud = isRemoteBackend && !isDemoMode;

      if (useCloud) {
        await submitPublicBooking(
          userId,
          {
            name: formData.name,
            phone: normalizedPhone,
            address: formData.address,
            buildingType: formData.buildingType,
            createdAt: new Date().toISOString(),
          },
          {
            clientName: formData.name,
            address: formData.address,
            lat: coords?.lat ?? null,
            lng: coords?.lng ?? null,
            date: formData.date,
            time: formData.time,
            windowCount: formData.windowCount,
            floor: formData.floor,
            additionalServices: formData.additionalServices,
            totalPrice,
            status: 'suplanuota',
            notes: formData.notes,
            createdAt: new Date().toISOString(),
          }
        );
      } else {
        const allClients = await getData<any>(TABLES.CLIENTS, userId);
        const existingClient =
          normalizedPhone !== 'nesutarta'
            ? allClients.find((c: any) => c.phone === normalizedPhone)
            : null;

        let clientId: string;

        if (existingClient) {
          clientId = existingClient.id;
        } else {
          const newClient = await addData(TABLES.CLIENTS, userId, {
            name: formData.name,
            phone: normalizedPhone,
            address: formData.address,
            buildingType: formData.buildingType,
            createdAt: new Date().toISOString(),
          });
          clientId = (newClient as any).id;
        }

        await addData(TABLES.ORDERS, userId, {
          clientId,
          clientName: formData.name,
          address: formData.address,
          lat: coords?.lat || null,
          lng: coords?.lng || null,
          date: formData.date,
          time: formData.time,
          windowCount: formData.windowCount,
          floor: formData.floor,
          additionalServices: formData.additionalServices,
          totalPrice,
          status: 'suplanuota' as OrderStatus,
          notes: formData.notes,
          uid: userId,
          createdAt: new Date().toISOString(),
        });
      }

      setIsBooked(true);
    } catch (error: unknown) {
      const msg = error instanceof Error ? error.message : 'Rezervacija nepavyko';
      if (String(msg).toLowerCase().includes('booking_rpc_missing')) {
        setErrorBanner(
          'Rezervacija dar nesukonfigūruota serveryje. Administratorius turi įkelti SQL failą supabase/public_booking_rpcs.sql į Supabase (SQL Editor).'
        );
      } else if (String(msg).toLowerCase().includes('invalid_booking')) {
        setErrorBanner('Ši rezervacijos nuoroda nebegalioja arba verslas neaktyvus.');
      } else {
        setErrorBanner('Apgailestaujame, įvyko klaida. Bandykite dar kartą.');
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  if (isBooked) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center p-4">
        <motion.div
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          className="bg-white p-8 rounded-3xl shadow-xl max-w-sm w-full text-center border border-slate-100"
        >
          <div className="w-20 h-20 bg-emerald-50 rounded-full flex items-center justify-center mx-auto mb-6">
            <CheckCircle2 className="text-emerald-600" size={48} />
          </div>
          <h1 className="text-2xl font-bold text-slate-900 mb-2">Rezervacija sėkminga!</h1>
          <p className="text-slate-500 mb-8 text-sm leading-relaxed">
            Dėkojame už rezervaciją. Mes su jumis susisieksime nurodytu telefonu patvirtinti laiką.
          </p>
          <div className="bg-slate-50 p-4 rounded-2xl text-left mb-8 space-y-2">
            <div className="flex justify-between text-xs">
              <span className="text-slate-400">Data:</span>
              <span className="font-bold text-slate-700">{formData.date} {formData.time}</span>
            </div>
            <div className="flex justify-between text-xs">
              <span className="text-slate-400">Kaina:</span>
              <span className="font-bold text-blue-600">{formatCurrency(totalPrice)}</span>
            </div>
          </div>
          <button
            onClick={() => window.location.reload()}
            className="w-full bg-slate-900 text-white py-4 rounded-2xl font-bold hover:bg-slate-800 transition-colors"
          >
            Atgal
          </button>
        </motion.div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50 p-4 pb-12 max-w-md mx-auto border-x border-slate-200">
      <header className="py-8 text-center">
        <h1 className="text-2xl font-black text-blue-600 tracking-tight mb-2">Langų Valymo Rezervacija</h1>
        <p className="text-slate-500 text-sm">Užpildykite formą ir sužinokite preliminarią kainą</p>
      </header>

      <AnimatePresence>
        {errorBanner && (
          <motion.div
            initial={{ opacity: 0, y: -6 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -6 }}
            className="mb-4 p-4 rounded-2xl border border-amber-200 bg-amber-50 text-amber-900"
            role="alert"
          >
            <div className="flex items-start gap-3">
              <Info className="w-5 h-5 text-amber-700 mt-0.5 shrink-0" aria-hidden />
              <div className="text-sm leading-relaxed">{errorBanner}</div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      <form onSubmit={handleSubmit} className="space-y-6">
        <section className="bg-white p-6 rounded-3xl border border-slate-100 shadow-sm space-y-4">
          <div className="flex items-center gap-2 mb-2">
            <User size={16} className="text-blue-600" />
            <h2 className="text-sm font-bold text-slate-900 uppercase tracking-wider">Jūsų duomenys</h2>
          </div>

          <div>
            <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1">Vardas</label>
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
            <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1">Telefonas</label>
            <input
              type="tel"
              value={formData.phone}
              onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
              className="w-full bg-slate-50 border border-slate-100 rounded-xl p-3 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20"
              placeholder="+370 600 00000 arba nesutarta"
            />
          </div>

          <div>
            <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1">Adresas</label>
            <input
              required
              type="text"
              value={formData.address}
              onChange={(e) => setFormData({ ...formData, address: e.target.value })}
              className="w-full bg-slate-50 border border-slate-100 rounded-xl p-3 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20"
              placeholder="Gatvė, namas, butas, miestas"
            />
          </div>

          <div>
            <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1">Pastato tipas</label>
            <div className="grid grid-cols-3 gap-2">
              {(['butas', 'namas', 'ofisas', 'nesutarta'] as BuildingType[]).map((type) => (
                <button
                  key={type}
                  type="button"
                  onClick={() => setFormData({ ...formData, buildingType: type })}
                  className={`py-2 rounded-xl text-xs font-bold capitalize border transition-all ${formData.buildingType === type
                    ? 'bg-blue-600 text-white border-blue-600 shadow-md shadow-blue-100'
                    : 'bg-white text-slate-500 border-slate-100 hover:border-blue-200'
                    }`}
                >
                  {type}
                </button>
              ))}
            </div>
          </div>
        </section>

        <section className="bg-white p-6 rounded-3xl border border-slate-100 shadow-sm space-y-4">
          <div className="flex items-center gap-2 mb-2">
            <Calendar size={16} className="text-blue-600" />
            <h2 className="text-sm font-bold text-slate-900 uppercase tracking-wider">Darbų apimtis</h2>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label htmlFor="booking-date" className="block text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1">Data</label>
              <input
                id="booking-date"
                required
                type="date"
                value={formData.date}
                onChange={(e) => setFormData({ ...formData, date: e.target.value })}
                className="w-full bg-slate-50 border border-slate-100 rounded-xl p-3 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20"
              />
            </div>
            <div>
              <label htmlFor="booking-time" className="block text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1">Laikas</label>
              <input
                id="booking-time"
                required
                type="time"
                value={formData.time}
                onChange={(e) => setFormData({ ...formData, time: e.target.value })}
                className="w-full bg-slate-50 border border-slate-100 rounded-xl p-3 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label htmlFor="booking-window-count" className="block text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1">Langų skaičius</label>
              <input
                id="booking-window-count"
                required
                type="number"
                value={formData.windowCount}
                onChange={(e) => setFormData({ ...formData, windowCount: parseInt(e.target.value) })}
                className="w-full bg-slate-50 border border-slate-100 rounded-xl p-3 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20"
              />
            </div>
            <div>
              <label htmlFor="booking-floor" className="block text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1">Aukštas</label>
              <input
                id="booking-floor"
                required
                type="number"
                value={formData.floor}
                onChange={(e) => setFormData({ ...formData, floor: parseInt(e.target.value) })}
                className="w-full bg-slate-50 border border-slate-100 rounded-xl p-3 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20"
              />
            </div>
          </div>

          <div>
            <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1">Papildomai</label>
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
        </section>

        <div className="bg-slate-900 p-6 rounded-3xl shadow-xl text-white flex justify-between items-center">
          <div>
            <p className="text-[10px] font-bold uppercase tracking-widest opacity-60 mb-1">Preliminari kaina</p>
            <p className="text-3xl font-black">{formatCurrency(totalPrice)}</p>
          </div>
          <button
            type="submit"
            disabled={isSubmitting}
            className="bg-blue-600 text-white px-6 py-4 rounded-2xl font-bold shadow-lg shadow-blue-500/20 hover:bg-blue-700 transition-all active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center min-w-[140px]"
          >
            {isSubmitting ? (
              <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white"></div>
            ) : (
              'Rezervuoti'
            )}
          </button>
        </div>

        <div className="flex items-start gap-3 p-4 bg-blue-50 rounded-2xl border border-blue-100">
          <Info size={18} className="text-blue-600 shrink-0 mt-0.5" />
          <p className="text-[10px] text-blue-900 leading-relaxed">
            Galutinė kaina gali kisti priklausomai nuo langų užterštumo ir pasiekiamumo. Meistras kainą patikslins atvykęs.
          </p>
        </div>
      </form>
    </div>
  );
}
