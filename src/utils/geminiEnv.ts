/**
 * Google Gemini kliento raktas naršyklėje:
 * - VITE_GEMINI_API_KEY — įprastas Vite kintamasis
 * - GEMINI_API_KEY — įterpiamas per vite.config `define` → process.env.GEMINI_API_KEY
 */
export function getGeminiKeyFromEnv(): string {
    const vite = import.meta.env.VITE_GEMINI_API_KEY;
    if (typeof vite === 'string' && vite.trim()) {
        return vite.trim();
    }
    const fromDefine =
        typeof process !== 'undefined'
            ? String((process.env as Record<string, string | undefined>).GEMINI_API_KEY ?? '').trim()
            : '';
    return fromDefine;
}
