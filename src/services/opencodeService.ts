import type { FunctionDeclaration } from '@google/genai';
import { supabase, usesLocalStorageBackend } from '../supabase';
import { getInvoiceApiBaseUrl } from '../utils/invoiceApiBase';
import { convertToOpenAITool } from './openRouterService';

export type OpenCodeVariant = 'go' | 'zen';

function getApiBaseUrl(): string {
  return getInvoiceApiBaseUrl();
}

export function isOpenCodeKey(key: string): boolean {
  const k = String(key ?? '').trim();
  // OpenCode Go/Zen keys shown in their console are `sk-...` (not `sk-or-v1-...`).
  // We treat any `sk-` that is NOT OpenRouter as OpenCode by default.
  return k.startsWith('sk-') && !k.startsWith('sk-or-v1-');
}

export function getOpenCodeVariant(): OpenCodeVariant {
  const v =
    (typeof import.meta !== 'undefined' && import.meta.env?.VITE_OPENCODE_VARIANT) ||
    (typeof process !== 'undefined' && process.env?.VITE_OPENCODE_VARIANT) ||
    '';
  const t = String(v).trim().toLowerCase();
  return t === 'zen' ? 'zen' : 'go';
}

export function getOpenCodeModel(): string {
  const m =
    (typeof import.meta !== 'undefined' && import.meta.env?.VITE_OPENCODE_MODEL) ||
    (typeof process !== 'undefined' && process.env?.VITE_OPENCODE_MODEL) ||
    '';
  const t = String(m).trim();
  return t || 'glm-5';
}

/** Ar galima kviesti OpenCode iš naršyklės: serverio proxy arba kliento `sk-` raktas. */
export function canUseOpenCodeFromBrowser(): boolean {
  const base = getApiBaseUrl();
  if (base) return true;
  return getOpenCodeKey() !== null;
}

export function getOpenCodeKey(): string | null {
  const envKey =
    (typeof import.meta !== 'undefined' && import.meta.env?.VITE_OPENCODE_API_KEY) ||
    (typeof process !== 'undefined' && process.env?.VITE_OPENCODE_API_KEY) ||
    '';

  const custom = typeof localStorage !== 'undefined' ? localStorage.getItem('custom_api_key') : '';
  const key =
    (typeof custom === 'string' && isOpenCodeKey(custom) ? custom.trim() : '') ||
    (typeof envKey === 'string' && isOpenCodeKey(envKey) ? envKey.trim() : '');

  return key || null;
}

type OpenAICompatibleMessage = {
  role: 'system' | 'user' | 'assistant' | 'tool';
  content?: string;
  tool_calls?: Array<{
    id: string;
    type: 'function';
    function: { name: string; arguments: string };
  }>;
  tool_call_id?: string;
  name?: string;
};

export async function callOpenCodeChatCompletions(args: {
  messages: OpenAICompatibleMessage[];
  tools?: FunctionDeclaration[];
  model?: string;
  timeoutMs?: number;
}): Promise<unknown> {
  const base = getApiBaseUrl();
  // If API base is configured (Vercel -> Render), always use server proxy.
  // Prevents browser CORS failures and keeps shared key server-side.
  if (base) {
    const headers: Record<string, string> = { 'Content-Type': 'application/json' };
    if (supabase) {
      const {
        data: { session },
      } = await supabase.auth.getSession();
      const token = session?.access_token?.trim();
      if (token) headers.Authorization = `Bearer ${token}`;
    }
    const controller = new AbortController();
    const timeoutMs = Math.max(5_000, args.timeoutMs ?? 60_000);
    const timeoutId = setTimeout(() => controller.abort(), timeoutMs);
    try {
      const res = await fetch(`${base}/api/ai/chat`, {
        method: 'POST',
        headers,
        body: JSON.stringify({
          messages: args.messages,
          tools: args.tools,
          model: args.model,
        }),
        signal: controller.signal,
      });
      const text = await res.text();
      if (!res.ok) {
        throw new Error(text || `HTTP ${res.status}`);
      }
      try {
        return JSON.parse(text) as unknown;
      } catch {
        return text;
      }
    } finally {
      clearTimeout(timeoutId);
    }
  }

  const apiKey = getOpenCodeKey();
  // Dev/local fallback: if no server base configured, allow direct key usage.
  if (!apiKey) {
    throw new Error(
      'OpenCode API raktas nerastas kliente, o serverio API bazė nesukonfigūruota. ' +
        'Produkcijoje nustatykite VITE_INVOICE_API_BASE_URL arba įveskite sk- raktą nustatymuose; lokaliai — dev proxy arba raktas.'
    );
  }

  const variant = getOpenCodeVariant();
  const endpoint =
    variant === 'zen'
      ? 'https://opencode.ai/zen/v1/chat/completions'
      : 'https://opencode.ai/zen/go/v1/chat/completions';

  const model = (args.model || '').trim() || getOpenCodeModel();
  const openAiTools = args.tools ? args.tools.map(convertToOpenAITool) : undefined;

  const controller = new AbortController();
  const timeoutMs = Math.max(5_000, args.timeoutMs ?? 60_000);
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const res = await fetch(endpoint, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model,
        messages: args.messages,
        tools: openAiTools,
        tool_choice: openAiTools ? 'auto' : undefined,
        max_tokens: 1024,
      }),
      signal: controller.signal,
    });

    const text = await res.text();
    if (!res.ok) {
      let msg = res.statusText;
      try {
        const j = JSON.parse(text) as { error?: { message?: unknown } };
        const m = j?.error?.message;
        msg = typeof m === 'string' ? m : m != null ? JSON.stringify(m) : msg;
      } catch {
        /* ignore */
      }
      throw new Error(`[OpenCode ${variant}] HTTP ${res.status}: ${msg}`);
    }

    try {
      return JSON.parse(text) as unknown;
    } catch {
      return text;
    }
  } finally {
    clearTimeout(timeoutId);
  }
}
