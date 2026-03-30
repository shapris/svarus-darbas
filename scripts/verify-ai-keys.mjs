/**
 * Patikrina .env AI raktus (nieko jautraus į konsolę neveda).
 * Naudojimas: node scripts/verify-ai-keys.mjs
 */
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.join(__dirname, '..', '.env') });

const gemini = process.env.VITE_GEMINI_API_KEY?.trim() || process.env.GEMINI_API_KEY?.trim() || '';
const openrouter = process.env.VITE_OPENROUTER_API_KEY?.trim() || '';

const GEMINI_MODELS_TRY = ['gemini-2.5-flash', 'gemini-flash-latest', 'gemini-2.0-flash', 'gemini-2.0-flash-lite'];

async function testGemini() {
  if (!gemini) return { name: 'Gemini', ok: false, detail: 'Nėra VITE_GEMINI_API_KEY / GEMINI_API_KEY' };

  for (const model of GEMINI_MODELS_TRY) {
    const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${encodeURIComponent(gemini)}`;
    try {
      const res = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ contents: [{ parts: [{ text: 'Say OK' }] }] }),
      });
      const text = await res.text();
      if (!res.ok) {
        let msg = res.statusText;
        try {
          const j = JSON.parse(text);
          msg = j?.error?.message || j?.error?.status || msg;
        } catch {
          /* ignore */
        }
        if (model === GEMINI_MODELS_TRY[GEMINI_MODELS_TRY.length - 1]) {
          return { name: 'Gemini', ok: false, detail: `HTTP ${res.status}: ${msg}` };
        }
        continue;
      }
      return { name: 'Gemini', ok: true, detail: `generateContent OK (${model})` };
    } catch (e) {
      if (model === GEMINI_MODELS_TRY[GEMINI_MODELS_TRY.length - 1]) {
        return { name: 'Gemini', ok: false, detail: e instanceof Error ? e.message : String(e) };
      }
    }
  }
  return { name: 'Gemini', ok: false, detail: 'Visi bandyti modeliai nepavyko' };
}

/** Atnaujinkite pagal https://openrouter.ai/models — seni „:free“ ID dažnai 404. */
const OPENROUTER_MODELS_TRY = ['openrouter/free', 'stepfun/step-3.5-flash:free'];

async function testOpenRouter() {
  if (!openrouter) return { name: 'OpenRouter', ok: false, detail: 'Nėra VITE_OPENROUTER_API_KEY' };

  for (const model of OPENROUTER_MODELS_TRY) {
    try {
      const res = await fetch('https://openrouter.ai/api/v1/chat/completions', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${openrouter}`,
          'Content-Type': 'application/json',
          'HTTP-Referer': 'https://localhost',
          'X-Title': 'Svarus Darbas key check',
        },
        body: JSON.stringify({
          model,
          messages: [{ role: 'user', content: 'Reply with OK only.' }],
          max_tokens: 8,
        }),
      });
      const text = await res.text();
      if (!res.ok) {
        let msg = res.statusText;
        try {
          const j = JSON.parse(text);
          msg = j.error?.message || j.error || msg;
        } catch {
          /* ignore */
        }
        if (model === OPENROUTER_MODELS_TRY[OPENROUTER_MODELS_TRY.length - 1]) {
          return { name: 'OpenRouter', ok: false, detail: `HTTP ${res.status}: ${msg}` };
        }
        continue;
      }
      return { name: 'OpenRouter', ok: true, detail: `chat/completions OK (${model})` };
    } catch (e) {
      if (model === OPENROUTER_MODELS_TRY[OPENROUTER_MODELS_TRY.length - 1]) {
        return { name: 'OpenRouter', ok: false, detail: e instanceof Error ? e.message : String(e) };
      }
    }
  }
  return { name: 'OpenRouter', ok: false, detail: 'Visi bandyti modeliai nepavyko' };
}

const results = await Promise.all([testGemini(), testOpenRouter()]);
for (const r of results) {
  const status = r.ok ? 'VEIKIA' : 'NEVEIKIA';
  console.log(`[${status}] ${r.name}: ${r.detail}`);
}
process.exit(results.some((r) => r.ok) ? 0 : 1);
