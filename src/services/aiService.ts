/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { GoogleGenAI, Type, FunctionDeclaration, GenerateContentResponse } from "@google/genai";
import { Order, Client, Expense, Memory } from "../types.js";
import { geocodeAddress } from "../utils.js";
import { classifyIntentHybrid } from './hybridClassifier.js';
import { prioritizeMemories, formatMemoriesForContext, MemoryContext } from './memoryPriority.js';
import { isOpenRouterKey, callOpenRouter } from './openRouterService.js';
import { stopAllAudio, generateSpeech, getSpeechAudio, getElevenLabsSpeech, getOpenAITSViaOpenRouter } from './ttsService.js';
import { getBusinessInsights, DASHBOARD_INSIGHT_LABELS } from './insightsService.js';
import { ALL_TOOLS } from './toolDefinitions.js';
import { getGeminiKeyFromEnv } from '../utils/geminiEnv.js';

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
function sanitizeHistoryForGemini(history: any[]): GeminiHistoryItem[] {
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
    const raw = typeof localStorage !== 'undefined' ? localStorage.getItem(AI_BUDGET_STORAGE_KEY) : null;
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
  if (!aiInstance || currentApiKey !== apiKey) {
    aiInstance = new GoogleGenAI({ apiKey });
    currentApiKey = apiKey;
  }
  return aiInstance;
}

/**
 * Geocoding function - can automatically find address coordinates
 * Returns { lat, lng } or null if not found
 */
async function autoGeocodeAddress(address: string): Promise<{ lat: number, lng: number } | null> {
  return await geocodeAddress(address);
}

/**
 * Simple, effective system prompt that works well
 */
function buildSystemInstruction(
  message: string,
  context: { clients: Client[]; orders: Order[]; expenses: Expense[]; memories: Memory[] },
  history: any[],
  businessMetrics: { totalRevenue: number; totalExpenses: number; profit: number }
): string {
  // Get a few relevant memories for context
  const relevantMemories = prioritizeMemories(context.memories, {
    query: message,
    userId: 'current_user', // In a real app, this would come from auth
    conversationHistory: history.map(h => h.parts[0]?.text || '').filter(Boolean)
  });
  const memoriesContext = formatMemoriesForContext(relevantMemories);
  
  // Build a clean, focused system prompt
  return `Jūs esate AI asistentas "Švarus Darbas" - langų valymo verslo valdymo sistemos.

JŪSŲ ŠIUOŠIO KONTEKSTO:
- Klientai: ${context.clients.length} žmonių
- Aktyvūs užsakymai: ${context.orders.filter(o => o.status !== 'atlikta').length}
- Išlaidų įrašai: ${context.expenses.length}
- Svarbios atmintys: ${relevantMemories.length}
- Pelnas: €${businessMetrics.profit.toFixed(2)}

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
function handleAIError(error: any, message: string, history: any[]): { text: string; history: any[] } {
  console.error('AI Service Error:', error);
  
  // User-friendly error messages based on error type
  if (
    error.message?.includes("429") ||
    error.message?.includes("quota") ||
    error.message?.toLowerCase().includes("rate limit")
  ) {
    return {
      text: "Atsiprašau, šiuo metu AI paslauga yra per užėmta dėl didelio užklausų kiekio. Prašome palaukti kaišias minutes ir bandyti dar kartą.",
      history: [...history, { role: 'user', parts: [{ text: message }] }, { role: 'model', parts: [{ text: "Atsiprašau, šiuo metu AI paslauga yra per užėmta dėl didelio užklausų kiekio. Prašome palaukti kaišias minutes ir bandyti dar kartą." }] }]
    };
  }
  
  if (error.message?.includes("Timeout")) {
    return {
      text: "Atsiprašau, AI atsako užtruko per ilgiausiai. Prašome bandyti paprastesnę užklausą arba kartoti šią užklausą.",
      history: [...history, { role: 'user', parts: [{ text: message }] }, { role: 'model', parts: [{ text: "Atsiprašau, AI atsako užtruko per ilgiausiai. Prašome bandyti paprastesnę užklausą arba kartoti šią užklausą." }] }]
    };
  }
  
  if (
    error.message?.includes("API key") ||
    error.message?.includes("API_KEY_INVALID") ||
    error.message?.includes("INVALID_ARGUMENT") ||
    error.message?.includes("authentication")
  ) {
    return {
      text: "Atsiprašau, AI paslaugos autentifikacija nepavyko. Prašome patikrinti, ar teisingai nustatytas API raktas.",
      history: [...history, { role: 'user', parts: [{ text: message }] }, { role: 'model', parts: [{ text: "Atsiprašau, AI paslaugos autentifikacija nepavyko. Prašome patikrinti, ar teisingai nustatytas API raktas." }] }]
    };
  }
  
  // Generic fallback
  return {
    text: "Atsiprašau, įvyko tekninė problema su AI paslauga. Prašome bandyti paprastesnę užklausą arba kartoti šią užklausą po kaišių sekundžių.",
    history: [...history, { role: 'user', parts: [{ text: message }] }, { role: 'model', parts: [{ text: "Atsiprašau, įvyko tekninė problema su AI paslauga. Prašome bandyti paprastesnę užklausą arba kartoti šią užklausą po kaišių sekundžių." }] }]
  };
}

function getGeminiCooldownMs(errorMessage: string): number {
  const m = errorMessage.toLowerCase();
  if (m.includes('perday') || m.includes('per day') || m.includes('limit: 0')) {
    return 6 * 60 * 60 * 1000;
  }
  const retryMatch = errorMessage.match(/retry(?:Delay)?["\s:]*([0-9]+)(?:\.[0-9]+)?s/i);
  const sec = retryMatch ? Number(retryMatch[1]) : NaN;
  if (Number.isFinite(sec) && sec > 0) return sec * 1000;
  return 60 * 1000;
}

/** Google Gemini key for @google/genai — never use an OpenRouter `sk-or-v1-` key here. */
export function getGeminiApiKeyForSdk(): string {
  const custom = typeof localStorage !== 'undefined' ? localStorage.getItem('custom_api_key') || '' : '';
  if (custom && !isOpenRouterKey(custom)) {
    return custom;
  }
  const env = getGeminiKeyFromEnv();
  if (env) return env;
  if (typeof window !== 'undefined') {
    const studio = (window as any).aistudio?.getApiKey?.();
    if (typeof studio === 'string' && studio && !isOpenRouterKey(studio)) {
      return studio;
    }
  }
  return '';
}

/**
 * Main chat function - simplified and more reliable
 */
export async function chatWithAssistant(
  message: string,
  history: any[],
  context: { clients: Client[]; orders: Order[]; expenses: Expense[]; memories: Memory[] }
) {
  try {
      const preferredGeminiKey = getGeminiApiKeyForSdk();
      const fallbackApiKey =
        localStorage.getItem('custom_api_key') ||
        (window as any).aistudio?.getApiKey?.() ||
        getGeminiKeyFromEnv() ||
        '';
      const apiKey = preferredGeminiKey || fallbackApiKey;

    if (!apiKey) {
      return {
        text: "Atsiprašau, API raktas nenustatytas. Į .env įrašykite VITE_GEMINI_API_KEY arba GEMINI_API_KEY (Gemini), arba VITE_OPENROUTER_API_KEY (OpenRouter), ir perkraukite dev serverį. Arba įveskite raktą chat skydelyje.",
        history: [...history, { role: 'user', parts: [{ text: message }] }, { role: 'model', parts: [{ text: "API raktas trūksta" }] }]
      };
    }
    if (!consumeAiBudget(1)) {
      return {
        text: "AI dienos kvota išnaudota. Įjungtas vietinis režimas: naudokite trumpesnes komandas (pvz. pridėti klientą/užsakymą/išlaidas) arba bandykite rytoj.",
        history: [...history, { role: 'user', parts: [{ text: message }] }, { role: 'model', parts: [{ text: "AI kvota šiandien išnaudota." }] }]
      };
    }

    const totalRevenue = context.orders
      .filter(o => o.status === 'atlikta')
      .reduce((sum, o) => sum + o.totalPrice, 0);
    const totalExpenses = context.expenses.reduce((sum, e) => sum + e.amount, 0);
    const profit = totalRevenue - totalExpenses;

    // Build simple, effective system instruction
    const systemInstruction = buildSystemInstruction(message, context, history, {
      totalRevenue,
      totalExpenses,
      profit
    });

    const tools = ALL_TOOLS;

     // Try OpenRouter first if it looks like an OpenRouter key
     if (!preferredGeminiKey && isOpenRouterKey(apiKey)) {
       try {
         // OpenRouter flow
         const messages: any[] = [
           { role: "system", content: systemInstruction }
         ];

         // Add conversation history
         for (const h of history) {
           const part = h.parts[0];
           if (part.text) {
             messages.push({
               role: h.role === 'model' ? 'assistant' : (h.role === 'function' ? 'tool' : 'user'),
               content: part.text
             });
           } else if (part.functionCall) {
             messages.push({
               role: "assistant",
               content: "",
               tool_calls: [{
                 id: part.functionCall.id || "call_" + Math.random().toString(36).substring(7),
                 type: "function",
                 function: {
                   name: part.functionCall.name,
                   arguments: toolArgumentsAsJsonString(part.functionCall.args),
                 }
               }]
             });
           } else if (part.functionResponse) {
             messages.push({
               role: "tool",
               tool_call_id: part.functionResponse.id || "unknown_call_id",
               name: part.functionResponse.name,
               content: JSON.stringify(part.functionResponse.response)
             });
           }
         }

         // Add current user message
         if (message) {
           messages.push({ role: "user", content: message });
         }

         const result = await callOpenRouter("free-auto", messages, tools);

          if (!result.choices || result.choices.length === 0) {
            throw new Error("Empty response from AI");
          }
         
         const choice = result.choices[0].message;
         
         // Safely parse function calls
         let functionCalls: any[] = [];
         if (choice.tool_calls) {
           functionCalls = choice.tool_calls.map((tc: any) => {
             const args = parseToolArgumentsToObject(tc?.function?.arguments);
             return {
               name: tc.function.name,
               args,
               id: tc.id,
             };
           });
         }

         return {
           text: choice.content || "Atsiprašau, nepavyko gauti atsakymo. Prašome bandyti dar kartą.",
           functionCalls,
           history: [...history, { role: 'user', parts: [{ text: message }] }, { role: 'model', parts: [{ text: choice.content || "" }] }]
         };
       } catch (openRouterError: unknown) {
         const orMsg =
           openRouterError instanceof Error
             ? openRouterError.message
             : typeof openRouterError === 'string'
               ? openRouterError
               : JSON.stringify(openRouterError);
         console.warn('OpenRouter failed, falling back to Google SDK:', orMsg);
         // Continue to Google SDK flow below
       }
     }
     
      // Google SDK — must use a real Gemini key (OpenRouter keys are invalid here)
      try {
        if (Date.now() < geminiChatCooldownUntil) {
          return {
            text: "Gemini AI laikinai sustabdytas dėl kvotos (429). Pabandykite po kelių minučių arba naudokite kitą API raktą.",
            history: [...history, { role: 'user', parts: [{ text: message }] }, { role: 'model', parts: [{ text: "Gemini laikinai nepasiekiamas dėl kvotos." }] }]
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
        const modelsToTry = ["gemini-2.0-flash", "gemini-2.5-flash", "gemini-1.5-flash", "gemini-1.5-flash-8b"];
        let lastError: any = null;

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
            let functionCalls: any[] = [];
            if (response.functionCalls) {
              functionCalls = response.functionCalls.map((fc: any) => ({
                name: fc.name,
                args: parseToolArgumentsToObject(fc.args),
                id: fc.id || `call_${Math.random().toString(36).substring(7)}`,
              }));
            }
            const hasFunctionCalls = Array.isArray(functionCalls) && functionCalls.length > 0;
            const responseText = hasFunctionCalls
              ? ""
              : (response.text || "Atsiprašau, nepavyko gauti atsakymo. Prašome bandyti dar kartą.");

            return {
              text: responseText,
              functionCalls,
              history: await chat.getHistory()
            };
          } catch (error: any) {
            lastError = error;
            const errorText = error?.message || String(error);
            const isQuota = errorText.toLowerCase().includes('429') || errorText.toLowerCase().includes('resource_exhausted') || errorText.toLowerCase().includes('quota');
            if (isQuota) {
              geminiChatCooldownUntil = Math.max(geminiChatCooldownUntil, Date.now() + getGeminiCooldownMs(errorText));
              break; // stop hammering multiple Gemini models on quota errors
            }
            continue; // Try next model
          }
        }

         // If all models failed
         const errorToHandle = lastError || new Error("All AI models failed");
         // Ensure we have a proper error message for handleAIError
         const errorMessage = errorToHandle.message || errorToHandle.toString() || "Unknown AI error";
         return handleAIError(new Error(errorMessage), message, history);
       } catch (googleError) {
         // If both OpenRouter and Google SDK fail
         const errorMessage = googleError.message || googleError.toString() || "Unknown Google SDK error";
         return handleAIError(new Error(errorMessage), message, history);
       }
  } catch (error: any) {
   // Catch-all error handler
   return handleAIError(error, message, history);
  }
}

// Re-export TTS functions for backward compatibility
export { stopAllAudio, generateSpeech, getSpeechAudio, getElevenLabsSpeech, getOpenAITSViaOpenRouter };
export type { VoiceProvider, GoogleVoice, ElevenLabsVoice, OpenAIVoice } from './ttsService.js';

// Re-export from sub-models for backward compatibility
export { isOpenRouterKey, callOpenRouter } from './openRouterService.js';
export { getBusinessInsights, DASHBOARD_INSIGHT_LABELS } from './insightsService.js';
export type { DashboardInsightId, DashboardInsight } from './insightsService.js';
export { ALL_TOOLS } from './toolDefinitions.js';
