/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useRef } from 'react';
import { AppSettings } from '../types';
import { updateData, TABLES, isDemoMode } from '../supabase';
import { downloadData, importData } from '../localDb';
import { Settings, Save, Euro, Info, ExternalLink, Download, Upload, Copy, Check } from 'lucide-react';
import { motion } from 'motion/react';

interface LocalUser {
  uid: string;
}

interface SettingsViewProps {
  settings: AppSettings;
  setSettings: (settings: AppSettings) => void;
  user: LocalUser;
}

export default function SettingsView({ settings, setSettings, user }: SettingsViewProps) {
  const [formData, setFormData] = useState<AppSettings>(settings);
  const [isSaving, setIsSaving] = useState(false);
  const [copySuccess, setCopySuccess] = useState(false);

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSaving(true);
    try {
      if (settings.id) {
        await updateData(TABLES.SETTINGS, settings.id, formData as any);
      }
      setSettings(formData);
      alert('Nustatymai išsaugoti!');
    } catch (error) {
      console.error('Error saving settings:', error);
    } finally {
      setIsSaving(false);
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
    alert('Duomenys išsaugoti į failą!');
  };

  const handleImport = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      const content = event.target?.result as string;
      const result = importData(content);
      alert(result.message);
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

  return (
    <div className="space-y-6">
      <h2 className="text-xl font-bold text-slate-900">Nustatymai</h2>

      {/* Backup Section */}
      {isDemoMode && (
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
              className="hidden"
            />
          </div>
        </section>
      )}

      <section className="bg-white p-6 rounded-3xl border border-slate-100 shadow-sm">
        <div className="flex items-center gap-3 mb-6">
          <div className="w-10 h-10 bg-blue-50 rounded-xl flex items-center justify-center text-blue-600">
            <Euro size={20} />
          </div>
          <h3 className="font-bold text-slate-900">Kainodara</h3>
        </div>

        <form onSubmit={handleSave} className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1">Kaina už langą</label>
              <input
                type="number"
                value={formData.pricePerWindow}
                onChange={(e) => setFormData({ ...formData, pricePerWindow: parseFloat(e.target.value) })}
                className="w-full bg-slate-50 border border-slate-100 rounded-xl p-3 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20"
              />
            </div>
            <div>
              <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1">Kaina už aukštą</label>
              <input
                type="number"
                value={formData.pricePerFloor}
                onChange={(e) => setFormData({ ...formData, pricePerFloor: parseFloat(e.target.value) })}
                className="w-full bg-slate-50 border border-slate-100 rounded-xl p-3 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1">Balkonai</label>
              <input
                type="number"
                value={formData.priceBalkonai}
                onChange={(e) => setFormData({ ...formData, priceBalkonai: parseFloat(e.target.value) })}
                className="w-full bg-slate-50 border border-slate-100 rounded-xl p-3 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20"
              />
            </div>
            <div>
              <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1">Vitrinų valymas</label>
              <input
                type="number"
                value={formData.priceVitrinos}
                onChange={(e) => setFormData({ ...formData, priceVitrinos: parseFloat(e.target.value) })}
                className="w-full bg-slate-50 border border-slate-100 rounded-xl p-3 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1">Terasa</label>
              <input
                type="number"
                value={formData.priceTerasa}
                onChange={(e) => setFormData({ ...formData, priceTerasa: parseFloat(e.target.value) })}
                className="w-full bg-slate-50 border border-slate-100 rounded-xl p-3 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20"
              />
            </div>
            <div>
              <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1">Kiti paviršiai</label>
              <input
                type="number"
                value={formData.priceKiti}
                onChange={(e) => setFormData({ ...formData, priceKiti: parseFloat(e.target.value) })}
                className="w-full bg-slate-50 border border-slate-100 rounded-xl p-3 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20"
              />
            </div>
          </div>

          <div className="pt-4 border-t border-slate-100">
            <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">SMS Priminimo Šablonas</label>
            <p className="text-[10px] text-slate-400 mb-2">Galimi kintamieji: <span className="font-mono bg-slate-100 px-1 rounded">{'{vardas}'}</span>, <span className="font-mono bg-slate-100 px-1 rounded">{'{data}'}</span>, <span className="font-mono bg-slate-100 px-1 rounded">{'{laikas}'}</span>, <span className="font-mono bg-slate-100 px-1 rounded">{'{kaina}'}</span></p>
            <textarea
              rows={3}
              value={formData.smsTemplate}
              onChange={(e) => setFormData({ ...formData, smsTemplate: e.target.value })}
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

      <section className="bg-white p-6 rounded-3xl border border-slate-100 shadow-sm">
        <div className="flex items-center gap-3 mb-4">
          <div className="w-10 h-10 bg-indigo-50 rounded-xl flex items-center justify-center text-indigo-600">
            <ExternalLink size={20} />
          </div>
          <h3 className="font-bold text-slate-900">Rezervacijos nuoroda</h3>
        </div>

        <p className="text-xs text-slate-500 mb-4">Pasidalinkite šia nuoroda su klientais, kad jie galėtų patys rezervuoti laiką.</p>

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
        </div>
      </section>

      <section className="bg-blue-600 p-6 rounded-3xl shadow-xl shadow-blue-200 text-white">
        <div className="flex items-center gap-3 mb-2">
          <Info size={20} />
          <h3 className="font-bold">Apie programėlę</h3>
        </div>
        <p className="text-sm opacity-80 leading-relaxed">
          Ši programėlė sukurta specialiai Lietuvos langų valymo paslaugų teikėjams. Valdykite klientus, užsakymus ir pajamas vienoje vietoje.
        </p>
      </section>
    </div>
  );
}
