/// <reference types="vite/client" />
/// <reference types="vite-plugin-pwa/client" />

interface ImportMetaEnv {
  readonly VITE_GEMINI_API_KEY?: string;
  readonly VITE_OPENROUTER_API_KEY?: string;
  /** Google Maps JavaScript API + Places (adresų automatinis užpildymas klientų kortelėje) */
  readonly VITE_GOOGLE_MAPS_API_KEY?: string;
  readonly VITE_SUPABASE_URL: string;
  readonly VITE_SUPABASE_ANON_KEY: string;
  /** @deprecated Naudokite VITE_ALLOW_OFFLINE_CRM */
  readonly VITE_DEMO_MODE?: string;
  /** Vietinis CRM be Supabase (tik kūrimas / testai) */
  readonly VITE_ALLOW_OFFLINE_CRM?: string;
  /** Klientų saviregistracija portale (debesis) */
  readonly VITE_CLIENT_SELF_REGISTRATION?: string;
  /** true → detalesni DB klaidų logai konsolėje (kūrimas / trikčių šalinimas) */
  readonly VITE_DEBUG_SUPABASE?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
