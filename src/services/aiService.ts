/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { GoogleGenAI, Type, FunctionDeclaration, GenerateContentResponse } from "@google/genai";
import { Order, Client, Expense, Memory } from "../types";
import { geocodeAddress } from "../utils";
import { classifyIntentHybrid } from './hybridClassifier';
import { prioritizeMemories, formatMemoriesForContext } from './memoryPriority';

// Re-export from sub-modules for backward compatibility
export { isOpenRouterKey, callOpenRouter } from './openRouterService';
export { stopAllAudio, generateSpeech, getSpeechAudio, getElevenLabsSpeech, getOpenAITSViaOpenRouter } from './ttsService';
export type { VoiceProvider, GoogleVoice, ElevenLabsVoice, OpenAIVoice } from './ttsService';
export { getBusinessInsights, DASHBOARD_INSIGHT_LABELS } from './insightsService';
export type { DashboardInsightId, DashboardInsight } from './insightsService';
export { ALL_TOOLS } from './toolDefinitions';

import { isOpenRouterKey, callOpenRouter } from './openRouterService';
import { ALL_TOOLS } from './toolDefinitions';

// Initialize Google SDK (will be used if key is NOT OpenRouter)
let aiInstance: GoogleGenAI | null = null;
let currentApiKey: string | null = null;

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
 * Build modular system instruction based on current context
 */
async function buildModularSystemInstruction(
  message: string,
  context: { clients: Client[]; orders: Order[]; expenses: Expense[]; memories: Memory[] },
  history: any[],
  businessMetrics: { totalRevenue: number; totalExpenses: number; profit: number }
): Promise<string> {
  // SIMPLE system prompt - short and fast
  const clientList = context.clients.slice(0, 5).map(c => c.name).join(', ') || 'nėra';
  const orderCount = context.orders.length;
  
  let systemPrompt = `Tu esi verslo asistentas "Švarus Darbas" (langų valymo verslas). 

KLIENTAI: ${clientList}
UŽSAKYMŲ: ${orderCount}
ŠIANDIEN: ${new Date().toISOString().split('T')[0]}

SVARBU: Jei trūksta duomenų - naudok "nesutarta". Geriau dalinė info nei jokios.

FUNKCIJOS: add_client, add_order, add_expense, geocode_address, get_business_summary

Atsakyk trumpai ir aiškiai lietuvių kalba.`;
  
  return systemPrompt;
}

export async function chatWithAssistant(
  message: string,
  history: any[],
  context: { clients: Client[]; orders: Order[]; expenses: Expense[]; memories: Memory[] }
) {
  const apiKey = localStorage.getItem('custom_api_key') || (window as any).aistudio?.getApiKey?.() || import.meta.env.VITE_GEMINI_API_KEY || '';

  const totalRevenue = context.orders
    .filter(o => o.status === 'atlikta')
    .reduce((sum, o) => sum + o.totalPrice, 0);
  const totalExpenses = context.expenses.reduce((sum, e) => sum + e.amount, 0);
  const profit = totalRevenue - totalExpenses;

  // 🧠 MODULAR SYSTEM PROMPT - Dynamic assembly based on context
  const systemInstruction = await buildModularSystemInstruction(message, context, history, {
    totalRevenue,
    totalExpenses,
    profit
  });

  const tools = ALL_TOOLS;

  if (isOpenRouterKey(apiKey)) {
    // OpenRouter flow
    const messages: any[] = [
      { role: "system", content: systemInstruction }
    ];

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
              arguments: JSON.stringify(part.functionCall.args)
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

    if (message) {
      messages.push({ role: "user", content: message });
    }

    try {
      const result = await callOpenRouter(apiKey, "free-auto", messages, tools);

      if (!result.choices || result.choices.length === 0) {
        throw new Error("Tuščias atsakymas iš AI - bandykite dar kartą");
      }
      
      const choice = result.choices[0].message;

      // Safely parse function calls, skip malformed JSON
      let functionCalls: any[] = [];
      if (choice.tool_calls) {
        functionCalls = choice.tool_calls.map((tc: any) => {
          try {
            return {
              name: tc.function.name,
              args: JSON.parse(tc.function.arguments),
              id: tc.id
            };
          } catch (parseError) {
            return null; // Skip this malformed call
          }
        }).filter(Boolean); // Remove null entries
      }

      return {
        text: choice.content || "",
        functionCalls,
        history: [...history, { role: 'user', parts: [{ text: message }] }, { role: 'model', parts: [{ text: choice.content || "" }] }],
      };
    } catch (error: any) {
      // Fallback for quota/error
      if (error.message?.includes("429") || error.message?.includes("quota") || error.message?.includes("neprieinami") || error.message?.includes("Timeout")) {
        return {
          text: "Atsiprašau, šiuo metu AI užimtas. Bandykite dar kartą po kelių sekundžių.",
          history: [...history, { role: 'user', parts: [{ text: message }] }, { role: 'model', parts: [{ text: "AI užimtas" }] }],
        };
      }

      throw error;
    }
  } else {
    // Google SDK flow
    const ai = getAiInstance(apiKey);
    const modelsToTry = ["gemini-3-flash-preview", "gemini-2.0-flash-exp", "gemini-1.5-flash", "gemini-1.5-flash-8b"];
    let lastError: any = null;

    for (const modelName of modelsToTry) {
      const chat = ai.chats.create({
        model: modelName,
        config: {
          systemInstruction,
          tools: [{ functionDeclarations: tools }],
          maxOutputTokens: 1024,
        },
        history: history,
      });

      try {
        const response = await chat.sendMessage({ message });
        return {
          text: response.text || "",
          functionCalls: response.functionCalls,
          history: await chat.getHistory(),
        };
      } catch (error: any) {
        lastError = error;
      }
    }

    // If all Gemini models failed, check for quota/overload
    if (lastError && (lastError.message?.includes("429") || lastError.message?.includes("quota") || lastError.message?.includes("overloaded"))) {
      return {
        text: "Atsiprašau, šiuo metu mano AI smegenys ilsisi dėl didelio užklausų kiekio. Galite tęsti darbą rankiniu būdu, o aš grįšiu po kurio laiko! Ar galiu dar kuo nors padėti be AI funkcijų?",
        history: [...history, { role: 'user', parts: [{ text: message }] }, { role: 'model', parts: [{ text: "AI Fallback mode active." }] }],
      };
    }

    throw lastError || new Error("Nepavyko susisiekti su AI paslauga.");
  }
}
