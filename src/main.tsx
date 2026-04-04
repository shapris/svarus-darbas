import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { registerSW } from 'virtual:pwa-register';
import App from './App.tsx';
import './index.css';

async function hardResetStaleServiceWorkerCache() {
  const resetKey = 'sw-hard-reset-v1';
  if (localStorage.getItem(resetKey) === '1') return;
  if (!('serviceWorker' in navigator)) return;
  try {
    const regs = await navigator.serviceWorker.getRegistrations();
    await Promise.all(regs.map((r) => r.unregister()));
    if ('caches' in window) {
      const keys = await caches.keys();
      await Promise.all(keys.map((k) => caches.delete(k)));
    }
    localStorage.setItem(resetKey, '1');
    // Reload once after cache reset to ensure fresh chunks.
    window.location.reload();
  } catch {
    // Ignore and continue app bootstrap.
  }
}

registerSW({ immediate: true });

hardResetStaleServiceWorkerCache().finally(() => {
  createRoot(document.getElementById('root')!).render(
    <StrictMode>
      <App />
    </StrictMode>
  );
});
