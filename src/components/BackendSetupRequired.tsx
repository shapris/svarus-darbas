/**
 * Rodoma, kai nėra Supabase — gamybinėje versijoje CRM neveikia be debesies.
 */

import React from 'react';
import { Droplets } from 'lucide-react';
import { motion } from 'motion/react';

export default function BackendSetupRequired() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-slate-50 p-4">
      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.2 }}
        className="bg-white p-8 rounded-2xl shadow-md max-w-md w-full border border-slate-200"
      >
        <div className="w-14 h-14 bg-blue-600 rounded-xl flex items-center justify-center mx-auto mb-5 text-white">
          <Droplets size={28} strokeWidth={2} />
        </div>
        <h1 className="text-xl font-semibold text-slate-900 mb-2 text-center">
          Reikalinga duomenų bazė
        </h1>
        <p className="text-slate-600 text-sm leading-relaxed mb-4">
          Ši CRM versija skirta darbui su debesimi. Sukonfigūruokite <strong>Supabase</strong> aplinkos
          kintamuosius pagal repo{' '}
          <code className="text-xs bg-slate-100 px-1 rounded">.env.example</code> ir{' '}
          <code className="text-xs bg-slate-100 px-1 rounded">README.md</code>.
        </p>
        <ul className="text-sm text-slate-600 space-y-2 list-disc pl-5 mb-4">
          <li>
            Failas <code className="text-xs bg-slate-100 px-1 rounded">.env</code> turi gulėti šalia{' '}
            <code className="text-xs bg-slate-100 px-1 rounded">package.json</code> (projekto šaknyje).
          </li>
          <li>
            Būtent šie vardai (su raide <strong>VITE_</strong> priekyje):{' '}
            <code className="text-xs bg-slate-100 px-1 rounded">VITE_SUPABASE_URL</code>,{' '}
            <code className="text-xs bg-slate-100 px-1 rounded">VITE_SUPABASE_ANON_KEY</code>.
            Ne tik <code className="text-xs bg-slate-100 px-1 rounded">SUPABASE_URL</code> — naršyklė jo
            nemato.
          </li>
          <li>
            Išjunkite <code className="text-xs bg-slate-100 px-1 rounded">VITE_ALLOW_OFFLINE_CRM</code>{' '}
            ir <code className="text-xs bg-slate-100 px-1 rounded">VITE_DEMO_MODE</code>, jei norite
            tikros debesies.
          </li>
          <li>
            Po kiekvieno <code className="text-xs bg-slate-100 px-1 rounded">.env</code> pakeitimo:{' '}
            <strong>sustabdykite</strong> terminalą (<kbd className="px-1 bg-slate-100 rounded">Ctrl+C</kbd>)
            ir vėl paleiskite <code className="text-xs bg-slate-100 px-1 rounded">npm run dev</code>.
          </li>
          <li>
            Tik kūrimui be debesies:{' '}
            <code className="text-xs bg-amber-100 px-1 rounded">VITE_ALLOW_OFFLINE_CRM=true</code>
          </li>
        </ul>
        <p className="text-xs text-slate-500">
          Po pakeitimų gamybiniame serveryje — iš naujo surinkite build (
          <code className="bg-slate-100 px-1 rounded">npm run build</code>).
        </p>
      </motion.div>
    </div>
  );
}
