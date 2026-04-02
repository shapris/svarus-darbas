import type {IncomingMessage, ServerResponse} from 'http';
import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import path from 'path';
import {defineConfig, loadEnv} from 'vite';
import {VitePWA} from 'vite-plugin-pwa';

/** Kai server.cjs neveikia :3001, proxy kitaip meta 500 — CRM health tikrinimui grąžiname 200 + invoiceEmail: false. */
function healthProxyOnError(proxy: {on: (ev: string, fn: (...args: unknown[]) => void) => void}) {
  proxy.on('error', (err: NodeJS.ErrnoException, _req: IncomingMessage, res: unknown) => {
    if (!res || typeof res !== 'object' || !('writeHead' in res)) return;
    const r = res as ServerResponse;
    if (r.writableEnded) return;
    const msg = err?.code === 'ECONNREFUSED' ? 'connection_refused' : err?.message || 'proxy_error';
    r.writeHead(200, {'Content-Type': 'application/json'});
    r.end(
      JSON.stringify({
        status: 'ok',
        timestamp: new Date().toISOString(),
        invoiceEmail: false,
        backend: 'unavailable',
        hint: 'Paleiskite npm run server arba npm run dev:full (Vite + API :3001).',
        proxyError: msg,
      }),
    );
  });
}

export default defineConfig(({mode}) => {
  const env = loadEnv(mode, '.', '');
  return {
    plugins: [
      react(),
      tailwindcss(),
      VitePWA({
        // Temporary hardening: force old service workers to self-unregister,
        // because stale cached index/chunks are breaking module loading in production.
        selfDestroying: true,
        registerType: 'autoUpdate',
        includeAssets: ['pwa-192x192.png', 'pwa-512x512.png'],
        manifest: {
          name: 'Švarus Darbas CRM',
          short_name: 'Švarus CRM',
          description: 'Užsakymų, klientų ir komandos valdymas langų valymo verslui.',
          theme_color: '#2563eb',
          background_color: '#f8fafc',
          display: 'standalone',
          orientation: 'portrait-primary',
          start_url: '/',
          scope: '/',
          lang: 'lt',
          icons: [
            {src: 'pwa-192x192.png', sizes: '192x192', type: 'image/png'},
            {src: 'pwa-512x512.png', sizes: '512x512', type: 'image/png'},
            {
              src: 'pwa-512x512.png',
              sizes: '512x512',
              type: 'image/png',
              purpose: 'any maskable',
            },
          ],
        },
        workbox: {
          globPatterns: ['**/*.{js,css,html,ico,png,svg,woff2}'],
          navigateFallback: '/index.html',
        },
        devOptions: {
          enabled: true,
        },
      }),
    ],
    define: {
      'process.env.GEMINI_API_KEY': JSON.stringify(env.GEMINI_API_KEY ?? env.VITE_GEMINI_API_KEY ?? ''),
    },
    resolve: {
      alias: {
        '@': path.resolve(__dirname, '.'),
      },
    },
    build: {
      rollupOptions: {
        output: {
          manualChunks(id) {
            // Vendor buckets (stable caching)
            if (id.includes('node_modules')) {
              if (id.includes('@google/genai')) return 'vendor-ai';
              if (id.includes('recharts')) return 'vendor-charts';
              if (id.includes('jspdf') || id.includes('jspdf-autotable')) return 'vendor-pdf';
              if (id.includes('leaflet') || id.includes('react-leaflet')) return 'vendor-maps';
              if (id.includes('motion')) return 'vendor-motion';
              // NOTE: keep React inside the general vendor chunk to avoid circular chunk warnings
              // (some transitive deps reference each other across these boundaries).
              return 'vendor';
            }

            // App buckets (reduce initial index chunk)
            if (id.includes('/src/supabase')) return 'app-supabase';
            if (id.includes('/src/services/')) return 'app-services';
            if (id.includes('/src/views/')) return 'app-views';
            if (id.includes('/src/components/')) return 'app-components';
            if (id.includes('/src/hooks/')) return 'app-hooks';
            if (id.includes('/src/utils')) return 'app-utils';

            return undefined;
          },
        },
      },
      chunkSizeWarningLimit: 500,
    },
    server: {
      // HMR can be disabled via DISABLE_HMR=true (e.g. remote or constrained environments).
      hmr: process.env.DISABLE_HMR !== 'true',
      /** „OS + naršyklė“: `npm run dev` atidaro numatytąją naršykę. Išjungti: VITE_OPEN_BROWSER=false */
      open:
        process.env.VITE_OPEN_BROWSER === 'false' || process.env.CI === 'true'
          ? false
          : true,
      // Sąskaitų API (server.cjs) — užklausos į tą patį dev prievadą, be tiesiai :3001
      proxy: {
        '/api': {
          target: 'http://127.0.0.1:3001',
          changeOrigin: true,
        },
        '/health': {
          target: 'http://127.0.0.1:3001',
          changeOrigin: true,
          configure: healthProxyOnError,
        },
      },
    },
    preview: {
      open:
        process.env.VITE_OPEN_BROWSER === 'false' || process.env.CI === 'true'
          ? false
          : true,
      port: 4173,
      // Kaip dev: `/api` ir `/health` į server.cjs (build + preview + server lokaliai)
      proxy: {
        '/api': {
          target: 'http://127.0.0.1:3001',
          changeOrigin: true,
        },
        '/health': {
          target: 'http://127.0.0.1:3001',
          changeOrigin: true,
          configure: healthProxyOnError,
        },
      },
    },
  };
});
