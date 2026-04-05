/**
 * Hubas papildomoms CRM skiltims (apačios meniu netelpa visų sekcijų).
 */

import React from 'react';
import { BarChart3, Truck, Users, Package } from 'lucide-react';
import { motion } from 'motion/react';

const items: { tab: string; label: string; icon: typeof BarChart3 }[] = [
  { tab: 'analytics', label: 'Analitika', icon: BarChart3 },
  { tab: 'logistics', label: 'Logistika', icon: Truck },
  { tab: 'team', label: 'Komanda', icon: Users },
  { tab: 'inventory', label: 'Inventorius', icon: Package },
];

export default function MoreSectionsView({
  setActiveTab,
}: {
  setActiveTab: (tab: string) => void;
}) {
  return (
    <div className="space-y-4 pb-4">
      <h2 className="text-xl font-bold text-slate-900">Daugiau</h2>
      <div className="grid gap-3">
        {items.map(({ tab, label, icon: Icon }, i) => (
          <motion.button
            key={tab}
            type="button"
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: i * 0.04 }}
            onClick={() => setActiveTab(tab)}
            className="flex items-center gap-4 w-full text-left p-4 rounded-2xl bg-white border border-slate-200 shadow-sm hover:border-blue-200 hover:bg-blue-50/40 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500"
          >
            <div className="shrink-0 w-12 h-12 rounded-xl bg-slate-100 flex items-center justify-center text-blue-600">
              <Icon size={22} strokeWidth={2} aria-hidden />
            </div>
            <p className="font-semibold text-slate-900 min-w-0">{label}</p>
          </motion.button>
        ))}
      </div>
    </div>
  );
}
