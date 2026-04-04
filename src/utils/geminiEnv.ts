/**
 * Google Gemini kliento raktas naršyklėje:
 * - VITE_GEMINI_API_KEY — įprastas Vite kintamasis
 */
export function getGeminiKeyFromEnv(): string {
  const vite = import.meta.env.VITE_GEMINI_API_KEY;
  return typeof vite === 'string' ? vite.trim() : '';
}
