/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React from 'react';
import {
  LayoutDashboard,
  Users,
  Calendar,
  Settings,
  PlusCircle,
  LogOut,
  Wallet,
  Droplets,
  CreditCard,
  MoreHorizontal,
} from 'lucide-react';

interface LayoutProps {
  children: React.ReactNode;
  activeTab: string;
  setActiveTab: (tab: string) => void;
  onLogout?: () => void;
}

export default function Layout({ children, activeTab, setActiveTab, onLogout }: LayoutProps) {
  const tabs = [
    { id: 'dashboard', icon: LayoutDashboard, label: 'Apžvalga' },
    { id: 'orders', icon: PlusCircle, label: 'Užsakymai' },
    { id: 'calendar', icon: Calendar, label: 'Kalendorius' },
    { id: 'clients', icon: Users, label: 'Klientai' },
    { id: 'expenses', icon: Wallet, label: 'Išlaidos' },
    { id: 'payments', icon: CreditCard, label: 'Mokėjimai' },
    { id: 'more', icon: MoreHorizontal, label: 'Daugiau' },
    { id: 'settings', icon: Settings, label: 'Nustatymai' },
  ];

  return (
    <div className="min-h-screen bg-gradient-to-b from-slate-100/90 via-slate-50 to-white flex flex-col max-w-md mx-auto border-x border-slate-200/90 shadow-lg shadow-slate-900/5">
      {/* Header */}
      <header className="bg-white/90 backdrop-blur-md border-b border-slate-200/80 px-4 py-3.5 sticky top-0 z-20 flex justify-between items-center shadow-sm shadow-slate-900/[0.04]">
        <div className="flex items-center gap-3 min-w-0">
          <div className="shrink-0 w-9 h-9 bg-gradient-to-br from-blue-600 to-blue-700 rounded-xl flex items-center justify-center text-white shadow-md shadow-blue-600/25 ring-1 ring-white/30">
            <Droplets size={18} strokeWidth={2.25} aria-hidden />
          </div>
          <div className="min-w-0">
            <h1 className="text-base font-bold text-slate-900 tracking-tight truncate">
              Švarus Darbas
            </h1>
          </div>
        </div>
        {onLogout && (
          <button
            type="button"
            onClick={onLogout}
            className="shrink-0 p-2.5 rounded-xl text-slate-400 hover:text-rose-600 hover:bg-rose-50 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-2"
            aria-label="Atsijungti"
          >
            <LogOut size={20} aria-hidden />
          </button>
        )}
      </header>

      {/* Main Content */}
      <main className="flex-1 overflow-y-auto pb-28 px-4 pt-4">{children}</main>

      {/* Bottom Navigation */}
      <nav
        className="bg-white/95 backdrop-blur-lg border-t border-slate-200/90 fixed bottom-0 left-0 right-0 max-w-md mx-auto z-20 pb-[max(0.5rem,env(safe-area-inset-bottom))] shadow-[0_-8px_30px_-10px_rgba(15,23,42,0.08)]"
        aria-label="Pagrindinis meniu"
      >
        <div className="flex justify-around items-stretch min-h-[4rem] px-1 pt-1">
          {tabs.map((tab) => {
            const Icon = tab.icon;
            const isActive = activeTab === tab.id;
            return (
              <button
                type="button"
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                aria-current={isActive ? 'page' : undefined}
                className={`relative flex flex-1 flex-col items-center justify-center py-2 rounded-2xl mx-0.5 transition-all duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-2 focus-visible:ring-offset-white ${
                  isActive ? 'text-blue-600' : 'text-slate-400 hover:text-slate-600'
                }`}
              >
                <span
                  className={`flex flex-col items-center justify-center w-full rounded-xl px-1 py-1 transition-all ${
                    isActive ? 'bg-blue-50 shadow-sm shadow-blue-600/5' : 'hover:bg-slate-50'
                  }`}
                >
                  <Icon
                    size={20}
                    strokeWidth={isActive ? 2.25 : 2}
                    className={isActive ? 'drop-shadow-sm' : ''}
                  />
                  <span className="text-[10px] mt-0.5 font-semibold leading-tight text-center">
                    {tab.label}
                  </span>
                </span>
              </button>
            );
          })}
        </div>
      </nav>
    </div>
  );
}
