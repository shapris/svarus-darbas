/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { GoogleGenAI, FunctionDeclaration } from '@google/genai';
import { Order, Client, Expense, Memory } from '../types.js';
import { prioritizeMemories, formatMemoriesForContext } from './memoryPriority.js';
import { isOpenRouterKey, callOpenRouter, getOpenRouterKey } from './openRouterService.js';
import { ALL_TOOLS } from './toolDefinitions.js';
import { getGeminiKeyFromEnv } from '../utils/geminiEnv.js';
import { logDevError } from '../utils/devConsole.js';

/** OpenAI/OpenRouter expects `function.arguments` as a JSON string. */
function toolArgumentsAsJsonString(raw: unknown): string {
  if (raw == null) return '{}';
  if (typeof raw === 'string') {
    const t = raw.trim();
    if (!t) return '{}';
    try {
      JSON.parse(t);
      return t;
    } catch {
      return JSON.stringify({ _raw: t });
    }
  }
  try {
    return JSON.stringify(raw);
  } catch {
    return '{}';
  }
}

/** Parse tool args from API (string or pre-parsed object). */
function parseToolArgumentsToObject(raw: unknown): Record<string, unknown> {
  if (raw == null) return {};
  if (typeof raw === 'object' && !Array.isArray(raw)) {
    return raw as Record<string, unknown>;
  }
  if (typeof raw === 'string') {
    const s = raw.trim();
    if (!s) return {};
    try {
      const parsed = JSON.parse(s) as unknown;
      return typeof parsed === 'object' && parsed !== null && !Array.isArray(parsed)
        ? (parsed as Record<string, unknown>)
        : {};
    } catch {
      return {};
    }
  }
  return {};
}

type GeminiHistoryItem = { role: 'user' | 'model'; parts: Array<{ text: string }> };
type ChatHistoryTurn = {
  role?: string;
  parts?: Array<{
    text?: string;
    functionCall?: { name?: string; args?: unknown; id?: string };
    functionResponse?: { name?: string; id?: string; response?: unknown };
  }>;
};
function sanitizeHistoryForGemini(history: ChatHistoryTurn[]): GeminiHistoryItem[] {
  return (history || [])
    .map((h) => {
      const role = h?.role === 'user' ? 'user' : 'model';
      const text = String(h?.parts?.[0]?.text ?? '').trim();
      if (!text) return null;
      return { role, parts: [{ text }] } as GeminiHistoryItem;
    })
    .filter((x): x is GeminiHistoryItem => !!x);
}

// Initialize Google SDK (will be used if key is NOT OpenRouter)
let aiInstance: GoogleGenAI | null = null;
let currentApiKey: string | null = null;
let geminiChatCooldownUntil = 0;
const AI_DAILY_BUDGET = 20;
const AI_BUDGET_STORAGE_KEY = 'ai_daily_budget_v1';

type AiBudgetState = { day: string; used: number };
function getTodayKey(): string {
  return new Date().toISOString().slice(0, 10);
}
function readBudgetState(): AiBudgetState {
  try {
    const raw =
      typeof localStorage !== 'undefined' ? localStorage.getItem(AI_BUDGET_STORAGE_KEY) : null;
    if (!raw) return { day: getTodayKey(), used: 0 };
    const parsed = JSON.parse(raw) as Partial<AiBudgetState>;
    const day = String(parsed.day || getTodayKey());
    const used = Number(parsed.used ?? 0);
    if (day !== getTodayKey()) return { day: getTodayKey(), used: 0 };
    return { day, used: Number.isFinite(used) ? used : 0 };
  } catch {
    return { day: getTodayKey(), used: 0 };
  }
}
function writeBudgetState(state: AiBudgetState): void {
  if (typeof localStorage === 'undefined') return;
  localStorage.setItem(AI_BUDGET_STORAGE_KEY, JSON.stringify(state));
}
export function getAiBudgetStatus(): { used: number; limit: number; remaining: number } {
  const s = readBudgetState();
  const remaining = Math.max(0, AI_DAILY_BUDGET - s.used);
  return { used: s.used, limit: AI_DAILY_BUDGET, remaining };
}
export function consumeAiBudget(units = 1): boolean {
  const s = readBudgetState();
  if (s.used + units > AI_DAILY_BUDGET) return false;
  writeBudgetState({ day: s.day, used: s.used + units });
  return true;
}

export function getAiInstance(apiKey: string) {
  const key = String(apiKey ?? '').trim();
  if (!key) {
    throw new Error('Gemini SDK: trūksta API rakto (tuščia reikšmė).');
  }
  if (isOpenRouterKey(key)) {
    throw new Error('Gemini SDK: naudokite Google Gemini raktą, ne OpenRouter.');
  }
  if (!aiInstance || currentApiKey !== key) {
    aiInstance = new GoogleGenAI({ apiKey: key });
    currentApiKey = key;
  }
  return aiInstance;
}

/**
 * Simple, effective system prompt that works well
 */
type AssistantDataContext = {
  clients: Client[];
  orders: Order[];
  expenses: Expense[];
  memories: Memory[];
  /** Pvz. „Užsakymai“ — vartotojas gali klausti apie tai, ką mato šioje skiltyje */
  activeViewLabel?: string;
};

function buildSystemInstruction(
  message: string,
  context: AssistantDataContext,
  history: ChatHistoryTurn[],
  businessMetrics: { totalRevenue: number; totalExpenses: number; profit: number }
): string {
  // Get a few relevant memories for context
  const relevantMemories = prioritizeMemories(context.memories, {
    query: message,
    userId: 'current_user', // In a real app, this would come from auth
    conversationHistory: history.map((h) => h.parts[0]?.text || '').filter(Boolean),
  });
  const memoriesContext = formatMemoriesForContext(relevantMemories);
  const memoriesBlock = memoriesContext.trim()
    ? `\nKONTEKSTAS IŠ ATMINTIES:\n${memoriesContext}\n`
    : '';

  const uiContext =
    context.activeViewLabel?.trim() &&
    `DABARTINĖ CRM SKILTIS: ${context.activeViewLabel.trim()}. Vartotojas naršo tarp skilčių; pokalbis išlieka atviras. Kai klausia apie „čia“, „šį ekraną“ ar konkrečią eilutę — laikykite, kad tai susiję su šia skiltimi ir matomais sąrašais / forma.\n\n`;

  // Build a clean, focused system prompt
  return `Jūs esate AI asistentas "Švarus Darbas" - langų valymo verslo valdymo sistemos.

${uiContext || ''}JŪSŲ ŠIUOŠIO KONTEKSTO:
- Klientai: ${context.clients.length} žmonių
- Aktyvūs užsakymai: ${context.orders.filter((o) => o.status !== 'atlikta').length}
- Išlaidų įrašai: ${context.expenses.length}
- Svarbios atmintys: ${relevantMemories.length}
- Pelnas: €${businessMetrics.profit.toFixed(2)}
${memoriesBlock}
JŪSŲ UŽDUOTIS:
1. Atsakykite trumpai, aiškiai ir profesionališkai lietuvių kalba
2. Naudokite konkrečius duomenis iš konteksto, kai tai tinka
3. Jei nežinote atsakymo, sakykite "nesutarta" ir pasiūlykite, kaip gauti reikiamą informaciją
4. Jei klientas kyla apie konkrečią operaciją (pridėti klientą, užsakymą, išlaidą) - naudokite odpowiedžias funkcijas
5. Visada būkite naudinga ir teigiamas
6. Jei nežinote, kaip išspręsti problemą - pasiūlykite konkrečius žingsnius arba papildomą informaciją

FUNKCIJOS, KURIOS JŪS GALITE NAUDOTI:
- add_client, add_order, add_expense - pridėti duomenis
- get_business_summary - gauti verslo suvestinę
- geocode_address - rasti adreso koordinates iš miesto ir vietos

SVARBU add_client: pastato tipas NĖRA privalomas. Jei nežinote ar vartotojas nenori rinktis — iškart kvietkite add_client su buildingType = nesutarta ir neišklausinėkite. Uždrausta atsisakyti išsaugoti klientą tik dėl pastato tipo.

ATSAKYMO FORMATO:
- Atsakykite trumpai (1-3 sakiniai) kai galima
- Naudokite punktus arba numeravimą kai reikia išvardyti kai kurius daiktus
- Jei reikia funkcijos vykdymo - nurodykite, kokią funkciją norite vykdyti ir ką
- Jei nežinote - būkite juosingi ir pasiūlykite konkrečią kitą veiksmą

PRIVERSMAS: Jei trūksta duomenų - sakykite "nesutarta" ir pasiūlykite, kaip juos gauti.`;
}

/**
 * Enhanced error handling that provides user-friendly responses
 */
function handleAIError(
  error: unknown,
  message: string,
  history: ChatHistoryTurn[]
): { text: string; history: ChatHistoryTurn[] } {
  logDevError('AI Service Error:', error);
  const errMsg = error instanceof Error ? error.message : String(error);
  const errLower = errMsg.toLowerCase();

  // User-friendly error messages based on error type
  if (
    errMsg.includes('429') ||
    errMsg.includes('quota') ||
    errLower.includes('rate limit') ||
    errLower.includes('resource_exhausted')
  ) {
    const quotaHint =
      'Nemokama Google Gemini kvota išnaudota arba laikinai ribota (dažnai ~20 užklausų per dieną vienam modeliui). ' +
      'Galite: palaukti maždaug minutę ir bandyti vėl — sistema bando kelis modelius; ' +
      'įvesti OpenRouter raktą pokalbio nustatymuose; arba įjungti mokamą Gemini planą. ' +
      'Daugiau: https://ai.google.dev/gemini-api/docs/rate-limits';
    return {
      text: `Atsiprašau, AI užklausa atmesta dėl kvotos (429).\n\n${quotaHint}`,
      history: [
        ...history,
        { role: 'user', parts: [{ text: message }] },
        { role: 'model', parts: [{ text: `Kvotos riba. ${quotaHint}` }] },
      ],
    };
  }

  if (errMsg.includes('Timeout')) {
    return {
      text: 'Atsiprašau, AI atsako užtruko per ilgiausiai. Prašome bandyti paprastesnę užklausą arba kartoti šią užklausą.',
      history: [
        ...history,
        { role: 'user', parts: [{ text: message }] },
        {
          role: 'model',
          parts: [
            {
              text: 'Atsiprašau, AI atsako užtruko per ilgiausiai. Prašome bandyti paprastesnę užklausą arba kartoti šią užklausą.',
            },
          ],
        },
      ],
    };
  }

  if (
    errMsg.includes('API key') ||
    errMsg.includes('API_KEY_INVALID') ||
    errMsg.includes('INVALID_ARGUMENT') ||
    errMsg.includes('authentication')
  ) {
    return {
      text: 'Atsiprašau, AI paslaugos autentifikacija nepavyko. Prašome patikrinti, ar teisingai nustatytas API raktas.',
      history: [
        ...history,
        { role: 'user', parts: [{ text: message }] },
        {
          role: 'model',
          parts: [
            {
              text: 'Atsiprašau, AI paslaugos autentifikacija nepavyko. Prašome patikrinti, ar teisingai nustatytas API raktas.',
            },
          ],
        },
      ],
    };
  }

  // Generic fallback
  return {
    text: 'Atsiprašau, įvyko techninė problema su AI paslauga. Bandykite paprastesnę užklausą arba pakartokite po kelių sekundžių.',
    history: [
      ...history,
      { role: 'user', parts: [{ text: message }] },
      {
        role: 'model',
        parts: [
          {
            text: 'Atsiprašau, įvyko techninė problema su AI paslauga. Bandykite paprastesnę užklausą arba pakartokite po kelių sekundžių.',
          },
        ],
      },
    ],
  };
}

function getGeminiCooldownMs(errorMessage: string): number {
  const m = errorMessage.toLowerCase();
  if (m.includes('perday') || m.includes('per day') || m.includes('limit: 0')) {
    return 6 * 60 * 60 * 1000;
  }
  const retryIn = errorMessage.match(/retry in\s+([0-9]+(?:\.[0-9]+)?)\s*s/i);
  if (retryIn) {
    const sec = Number(retryIn[1]);
    if (Number.isFinite(sec) && sec > 0) return Math.min(Math.ceil(sec * 1000), 120_000);
  }
  const retryMatch = errorMessage.match(/retry(?:Delay)?["\s:]*([0-9]+)(?:\.[0-9]+)?s/i);
  const sec = retryMatch ? Number(retryMatch[1]) : NaN;
  if (Number.isFinite(sec) && sec > 0) return sec * 1000;
  return 60 * 1000;
}

/** Ar 429 greičiausiai taikomas tik tam pačiam modeliui (kiti Gemini modeliai gali dar veikti). */
function isLikelyPerModelQuotaError(errorText: string, modelTried: string): boolean {
  const t = errorText.toLowerCase();
  if (!t.includes('429') && !t.includes('resource_exhausted') && !t.includes('quota')) return false;
  const slug = modelTried.toLowerCase();
  if (
    t.includes(`model: ${slug}`) ||
    t.includes(`"model":"${slug}"`) ||
    t.includes(`"model": "${slug}"`)
  ) {
    return true;
  }
  if (
    /generate_content_free_tier|generate_content.*per.*model/i.test(t) &&
    t.includes(slug.split('-')[0])
  ) {
    return true;
  }
  return false;
}

/** Google Gemini key for @google/genai — never use an OpenRouter `sk-or-v1-` key here. */
export function getGeminiApiKeyForSdk(): string {
  const custom =
    typeof localStorage !== 'undefined' ? localStorage.getItem('custom_api_key') || '' : '';
  if (custom && !isOpenRouterKey(custom)) {
    return custom;
  }
  const env = getGeminiKeyFromEnv();
  if (env) return env;
  if (typeof window !== 'undefined') {
    const w = window as Window & { aistudio?: { getApiKey?: () => string } };
    const studio = w.aistudio?.getApiKey?.();
    if (typeof studio === 'string' && studio && !isOpenRouterKey(studio)) {
      return studio;
    }
  }
  return '';
}

type AssistantFunctionCall = { name: string; args: Record<string, unknown>; id?: string };

type OpenRouterMessageRow = {
  role: string;
  content?: string;
  tool_calls?: Array<{
    id: string;
    type: string;
    function: { name: string; arguments: string };
  }>;
  tool_call_id?: string;
  name?: string;
};

/** OpenRouter pokalbis (įrankiai perduodami į callOpenRouter). */
async function runOpenRouterAssistantChat(
  message: string,
  history: ChatHistoryTurn[],
  systemInstruction: string,
  tools: FunctionDeclaration[]
): Promise<{
  text: string;
  functionCalls?: AssistantFunctionCall[];
  history: ChatHistoryTurn[];
}> {
  const messages: OpenRouterMessageRow[] = [{ role: 'system', content: systemInstruction }];

  for (const h of history) {
    const part = h.parts?.[0];
    if (!part) continue;
    if (part.text) {
      messages.push({
        role: h.role === 'model' ? 'assistant' : h.role === 'function' ? 'tool' : 'user',
        content: part.text,
      });
    } else if (part.functionCall) {
      messages.push({
        role: 'assistant',
        content: '',
        tool_calls: [
          {
            id: part.functionCall.id || 'call_' + Math.random().toString(36).substring(7),
            type: 'function',
            function: {
              name: part.functionCall.name,
              arguments: toolArgumentsAsJsonString(part.functionCall.args),
            },
          },
        ],
      });
    } else if (part.functionResponse) {
      messages.push({
        role: 'tool',
        tool_call_id: part.functionResponse.id || 'unknown_call_id',
        name: part.functionResponse.name,
        content: JSON.stringify(part.functionResponse.response),
      });
    }
  }

  if (message) {
    messages.push({ role: 'user', content: message });
  }

  const result = await callOpenRouter('free-auto', messages, tools);
  if (!result.choices || result.choices.length === 0) {
    throw new Error('Tuščias atsakymas iš OpenRouter');
  }

  const choice = result.choices[0].message as OpenRouterMessageRow & {
    tool_calls?: Array<{
      id: string;
      function: { name: string; arguments: string };
    }>;
  };
  let functionCalls: AssistantFunctionCall[] = [];
  if (choice.tool_calls) {
    functionCalls = choice.tool_calls.map((tc) => {
      const args = parseToolArgumentsToObject(tc?.function?.arguments);
      return {
        name: tc.function.name,
        args,
        id: tc.id,
      };
    });
  }

  return {
    text: choice.content || 'Atsiprašau, nepavyko gauti atsakymo.',
    functionCalls,
    history: [
      ...history,
      { role: 'user', parts: [{ text: message }] },
      { role: 'model', parts: [{ text: choice.content || '' }] },
    ],
  };
}

/**
 * Main chat function - simplified and more reliable
 */
export async function chatWithAssistant(
  message: string,
  history: ChatHistoryTurn[],
  context: AssistantDataContext
) {
  try {
    const preferredGeminiKey = getGeminiApiKeyForSdk();
    const w = typeof window !== 'undefined' ? window : undefined;
    const studioKey =
      w != null
        ? (w as Window & { aistudio?: { getApiKey?: () => string } }).aistudio?.getApiKey?.()
        : undefined;
    const fallbackApiKey =
      localStorage.getItem('custom_api_key') ||
      (typeof studioKey === 'string' ? studioKey : '') ||
      getGeminiKeyFromEnv() ||
      '';
    const apiKey = preferredGeminiKey || fallbackApiKey;

    if (!apiKey) {
      return {
        text: 'Atsiprašau, API raktas nenustatytas. Į .env įrašykite VITE_GEMINI_API_KEY (Gemini) arba VITE_OPENROUTER_API_KEY (OpenRouter), ir perkraukite dev serverį. Arba įveskite raktą chat skydelyje.',
        history: [
          ...history,
          { role: 'user', parts: [{ text: message }] },
          { role: 'model', parts: [{ text: 'API raktas trūksta' }] },
        ],
      };
    }
    if (!consumeAiBudget(1)) {
      return {
        text: 'AI dienos kvota išnaudota. Įjungtas vietinis režimas: naudokite trumpesnes komandas (pvz. pridėti klientą/užsakymą/išlaidas) arba bandykite rytoj.',
        history: [
          ...history,
          { role: 'user', parts: [{ text: message }] },
          { role: 'model', parts: [{ text: 'AI kvota šiandien išnaudota.' }] },
        ],
      };
    }

    const totalRevenue = context.orders
      .filter((o) => o.status === 'atlikta')
      .reduce((sum, o) => sum + o.totalPrice, 0);
    const totalExpenses = context.expenses.reduce((sum, e) => sum + e.amount, 0);
    const profit = totalRevenue - totalExpenses;

    // Build simple, effective system instruction
    const systemInstruction = buildSystemInstruction(message, context, history, {
      totalRevenue,
      totalExpenses,
      profit,
    });

    const tools = ALL_TOOLS;

    // Jei įvestas tik OpenRouter raktas — pirmiausia OpenRouter
    if (!preferredGeminiKey && isOpenRouterKey(apiKey)) {
      try {
        return await runOpenRouterAssistantChat(message, history, systemInstruction, tools);
      } catch (openRouterError: unknown) {
        const orMsg =
          openRouterError instanceof Error
            ? openRouterError.message
            : typeof openRouterError === 'string'
              ? openRouterError
              : JSON.stringify(openRouterError);
        console.warn('OpenRouter failed, falling back to Google SDK:', orMsg);
      }
    }

    // Google SDK — must use a real Gemini key (OpenRouter keys are invalid here)
    try {
      if (Date.now() < geminiChatCooldownUntil) {
        if (getOpenRouterKey()) {
          try {
            return await runOpenRouterAssistantChat(message, history, systemInstruction, tools);
          } catch (e) {
            console.warn('OpenRouter (Gemini „cooldown“ metu) nepavyko:', e);
          }
        }
        return {
          text: 'Gemini AI laikinai sustabdytas dėl kvotos (429). Pabandykite po kelių minučių, įveskite OpenRouter raktą arba naudokite kitą API raktą.',
          history: [
            ...history,
            { role: 'user', parts: [{ text: message }] },
            { role: 'model', parts: [{ text: 'Gemini laikinai nepasiekiamas dėl kvotos.' }] },
          ],
        };
      }
      const geminiKey = getGeminiApiKeyForSdk();
      if (!geminiKey) {
        const onlyOr = isOpenRouterKey(apiKey);
        const hint = onlyOr
          ? 'OpenRouter: nemokama kvota išnaudota (429), modelis neprieinamas arba paskyros „Privacy“ riboja nemokamus modelius (https://openrouter.ai/settings/privacy). Sprendimai: įveskite Google Gemini raktą (aistudio.google.com/apikey) arba VITE_GEMINI_API_KEY į .env, arba įdėkite ~10 kreditų į OpenRouter.'
          : 'Trūksta galiojančio Google Gemini rakto. Sukurkite raktą https://aistudio.google.com/apikey ir įveskite nustatymuose (Gemini / „Mano API“) arba ENV kintamąjį VITE_GEMINI_API_KEY.';
        return {
          text: hint,
          history: [
            ...history,
            { role: 'user', parts: [{ text: message }] },
            { role: 'model', parts: [{ text: hint }] },
          ],
        };
      }

      const ai = getAiInstance(geminiKey);
      // Pirmiausia pigesni / alternatyvūs modeliai — kai 2.5-flash kvota pilna, kiti dažnai dar pasiekiami
      const modelsToTry = [
        'gemini-2.0-flash',
        'gemini-2.5-flash',
        'gemini-flash-latest',
        'gemini-1.5-flash',
        'gemini-1.5-flash-8b',
      ];
      let lastError: unknown = null;
      let quotaCooldownMs = 0;

      // Convert history to Google SDK compatible format
      const googleCompatibleHistory = sanitizeHistoryForGemini(history);

      for (const modelName of modelsToTry) {
        try {
          const chat = ai.chats.create({
            model: modelName,
            config: {
              systemInstruction,
              tools: [{ functionDeclarations: tools }],
              maxOutputTokens: 1024,
              temperature: 0.7,
            },
            history: googleCompatibleHistory,
          });

          const response = await chat.sendMessage({ message });

          // Safely parse function calls
          let functionCalls: AssistantFunctionCall[] = [];
          if (response.functionCalls) {
            functionCalls = response.functionCalls.map((fc) => ({
              name: fc.name ?? 'unknown_tool',
              args: parseToolArgumentsToObject(fc.args),
              id: fc.id || `call_${Math.random().toString(36).substring(7)}`,
            }));
          }
          const hasFunctionCalls = Array.isArray(functionCalls) && functionCalls.length > 0;
          const responseText = hasFunctionCalls
            ? ''
            : response.text || 'Atsiprašau, nepavyko gauti atsakymo. Prašome bandyti dar kartą.';

          return {
            text: responseText,
            functionCalls,
            history: await chat.getHistory(),
          };
        } catch (error: unknown) {
          lastError = error;
          const errorText = error instanceof Error ? error.message : String(error);
          const isQuota =
            errorText.toLowerCase().includes('429') ||
            errorText.toLowerCase().includes('resource_exhausted') ||
            errorText.toLowerCase().includes('quota');
          if (isQuota) {
            quotaCooldownMs = Math.max(quotaCooldownMs, getGeminiCooldownMs(errorText));
            if (isLikelyPerModelQuotaError(errorText, modelName)) {
              continue;
            }
          }
          continue;
        }
      }

      if (quotaCooldownMs > 0) {
        geminiChatCooldownUntil = Math.max(geminiChatCooldownUntil, Date.now() + quotaCooldownMs);
      }

      // Visi Gemini modeliai nepavyko — OpenRouter atsarginis kelias (jei VITE_OPENROUTER_API_KEY arba sk-or raktas)
      if (getOpenRouterKey()) {
        try {
          return await runOpenRouterAssistantChat(message, history, systemInstruction, tools);
        } catch (orErr) {
          console.warn('OpenRouter atsarginis variantas po Gemini klaidų nepavyko:', orErr);
        }
      }

      const errorToHandle =
        lastError instanceof Error ? lastError : new Error('All AI models failed');
      const errorMessage = errorToHandle.message || errorToHandle.toString() || 'Unknown AI error';
      return handleAIError(new Error(errorMessage), message, history);
    } catch (googleError: unknown) {
      // If both OpenRouter and Google SDK fail
      const errorMessage =
        googleError instanceof Error
          ? googleError.message || googleError.toString()
          : String(googleError);
      return handleAIError(new Error(errorMessage || 'Unknown Google SDK error'), message, history);
    }
  } catch (error: unknown) {
    // Catch-all error handler
    return handleAIError(error, message, history);
  }
}

export { isOpenRouterKey, callOpenRouter } from './openRouterService.js';
export type { DashboardInsightId, DashboardInsight } from './insightsService.js';
export { ALL_TOOLS } from './toolDefinitions.js';
