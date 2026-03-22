/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React from 'react';
import { LayoutDashboard, Users, Calendar, Settings, PlusCircle, LogOut, Wallet, Droplets } from 'lucide-react';

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
    { id: 'settings', icon: Settings, label: 'Nustatymai' },
  ];

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col max-w-md mx-auto border-x border-slate-200">
      {/* Header */}
      <header className="bg-white border-b border-slate-200 p-4 sticky top-0 z-10 flex justify-between items-center">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 bg-blue-600 rounded-lg flex items-center justify-center text-white">
            <Droplets size={18} strokeWidth={2} />
          </div>
          <h1 className="text-lg font-semibold text-slate-900 tracking-tight">Švarus Darbas</h1>
        </div>
        {onLogout && (
          <button onClick={onLogout} className="p-2 text-slate-400 hover:text-red-500 transition-colors">
            <LogOut size={20} />
          </button>
        )}
      </header>

      {/* Main Content */}
      <main className="flex-1 overflow-y-auto pb-24 p-4">
        {children}
      </main>

      {/* Bottom Navigation */}
      <nav className="bg-white border-t border-slate-200 fixed bottom-0 left-0 right-0 max-w-md mx-auto z-10">
        <div className="flex justify-around items-center h-16">
          {tabs.map((tab) => {
            const Icon = tab.icon;
            const isActive = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`flex flex-col items-center justify-center w-full h-full transition-colors ${
                  isActive ? 'text-blue-600' : 'text-slate-400 hover:text-slate-600'
                }`}
              >
                <Icon size={20} className={isActive ? 'animate-in zoom-in-90 duration-300' : ''} />
                <span className="text-[10px] mt-1 font-medium">{tab.label}</span>
                {isActive && (
                  <div className="absolute top-0 w-8 h-1 bg-blue-600 rounded-b-full" />
                )}
              </button>
            );
          })}
        </div>
      </nav>
    </div>
  );
}
