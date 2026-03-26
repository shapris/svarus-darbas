/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { GoogleGenAI, Type, FunctionDeclaration, GenerateContentResponse, Modality } from "@google/genai";
import { Order, Client, Expense, Memory } from "../types";
import { 
  ModularPromptAssembler, 
  enrichWithContext,
  DEFAULT_PROMPT_CONFIG 
} from './modularPrompt';
import { classifyIntentHybrid } from './hybridClassifier';
import { prioritizeMemories, formatMemoriesForContext } from './memoryPriority';

// Helper to check if a key is an OpenRouter key
export const isOpenRouterKey = (key: string) => key?.startsWith('sk-or-v1-');

function convertToOpenAITool(geminiTool: any) {
  const convertTypes = (obj: any): any => {
    if (Array.isArray(obj)) return obj.map(convertTypes);
    if (obj !== null && typeof obj === 'object') {
      const newObj: any = {};
      for (const key in obj) {
        if (key === 'type' && typeof obj[key] === 'string') {
          newObj[key] = obj[key].toLowerCase();
        } else {
          newObj[key] = convertTypes(obj[key]);
        }
      }
      return newObj;
    }
    return obj;
  };
  return {
    type: 'function',
    function: {
      name: geminiTool.name,
      description: geminiTool.description,
      parameters: convertTypes(geminiTool.parameters)
    }
  };
}

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

// OpenRouter API call helper
async function callOpenRouter(apiKey: string, model: string, messages: any[], tools?: any[]) {
  const openAiTools = tools ? tools.map(convertToOpenAITool) : undefined;

  const tryModel = async (modelName: string, useTools: boolean = true) => {
    const response = await fetch("https://openrouter.ai/api/v1/chat/completions", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${apiKey}`,
        "Content-Type": "application/json",
        "HTTP-Referer": window.location.origin,
        "X-Title": "Svarus Darbas CRM",
      },
      body: JSON.stringify({
        model: modelName,
        messages: messages,
        tools: useTools ? openAiTools : undefined,
        tool_choice: useTools && openAiTools ? 'auto' : undefined,
        max_tokens: 4096,
      })
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(`[${modelName}] ${error.error?.message || "Klaida"}`);
    }
    const data = await response.json();

    // Log reasoning tokens if available
    if (data.usage?.reasoning_tokens) {
      // Reasoning tokens tracked
    } else if (data.usage?.reasoningTokens) {
      // Reasoning tokens tracked
    }

    return data;
  };

  const errors: string[] = [];

  const defaultFreeModels = [
    "stepfun/step-3.5-flash:free",
    "google/gemini-2.0-flash-001:free",
    "google/gemini-2.0-flash-lite-001:free",
    "google/gemini-2.0-flash-exp:free",
    "google/gemini-flash-1.5:free",
    "google/gemini-flash-1.5-8b:free",
    "meta-llama/llama-3.3-70b-instruct:free",
    "meta-llama/llama-3.1-8b-instruct:free",
    "meta-llama/llama-3.1-70b-instruct:free",
    "deepseek/deepseek-chat:free",
    "deepseek/deepseek-r1:free",
    "qwen/qwen-2.5-72b-instruct:free",
    "qwen/qwen-2.5-coder-32b-instruct:free",
    "mistralai/mistral-nemo:free",
    "meta-llama/llama-3.2-3b-instruct:free",
    "microsoft/phi-3-medium-128k-instruct:free",
    "microsoft/phi-3-mini-128k-instruct:free",
    "gryphe/mythomax-l2-13b:free",
    "nousresearch/hermes-3-llama-3.1-8b:free",
    "huggingfaceh4/zephyr-7b-beta:free",
    "openchat/openchat-7b:free"
  ];

  const modelsToTry = model === "free-auto" ? defaultFreeModels : [model, ...defaultFreeModels.filter(m => m !== model)];

  const sleep = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

  // First try with tools
  if (openAiTools) {
    for (const modelName of modelsToTry) {
      try {
        return await tryModel(modelName, true);
      } catch (e: any) {
        console.warn(`Model ${modelName} with tools failed:`, e);
        errors.push(e.message);
        // If it's a rate limit or temporary error, wait a bit
        if (e.message.includes("429") || e.message.includes("overloaded")) {
          await sleep(500);
        }
      }
    }
  }

  // If tools failed or no tools provided, try without tools as fallback
  for (const modelName of modelsToTry) {
    try {
      return await tryModel(modelName, false);
    } catch (e: any) {
      console.warn(`Model ${modelName} without tools failed:`, e);
      // If we haven't already added this model's error, or if it's a different error
      if (!errors.some(err => err.includes(modelName))) {
        errors.push(e.message);
      }
      if (e.message.includes("429") || e.message.includes("overloaded")) {
        await sleep(500);
      }
    }
  }

  throw new Error("Visi nemokami modeliai neprieinami. Detalės: " + errors.join(" | "));
}

const addClientTool: FunctionDeclaration = {
  name: "add_client",
  parameters: {
    type: Type.OBJECT,
    description: "Pridėti naują klientą į sistemą.",
    properties: {
      name: { type: Type.STRING, description: "Kliento vardas ir pavardė" },
      phone: { type: Type.STRING, description: "Telefono numeris" },
      address: { type: Type.STRING, description: "Adresas" },
      buildingType: { type: Type.STRING, enum: ["butas", "namas", "ofisas"], description: "Pastato tipas" },
      notes: { type: Type.STRING, description: "Papildomos pastabos apie klientą" },
    },
    required: ["name", "phone", "address", "buildingType"],
  },
};

const addOrderTool: FunctionDeclaration = {
  name: "add_order",
  parameters: {
    type: Type.OBJECT,
    description: "Sukurti naują užsakymą klientui.",
    properties: {
      clientName: { type: Type.STRING, description: "Kliento vardas (iš esamų klientų sąrašo)" },
      address: { type: Type.STRING, description: "Valymo adresas" },
      date: { type: Type.STRING, description: "Data (YYYY-MM-DD)" },
      time: { type: Type.STRING, description: "Laikas (HH:MM)" },
      windowCount: { type: Type.NUMBER, description: "Langų kiekis" },
      floor: { type: Type.NUMBER, description: "Aukštas" },
      estimatedDuration: { type: Type.NUMBER, description: "Apytikslė trukmė bendromis minutėmis (pvz. 1 valanda = 60, 1 diena = 1440)" },
      notes: { type: Type.STRING, description: "Užsakymo pastabos" },
      additionalServices: {
        type: Type.OBJECT,
        description: "Papildomos paslaugos",
        properties: {
          balkonai: { type: Type.BOOLEAN, description: "Balkonų valymas" },
          vitrinos: { type: Type.BOOLEAN, description: "Vitrinų valymas" },
          terasa: { type: Type.BOOLEAN, description: "Terasos valymas" },
          kiti: { type: Type.BOOLEAN, description: "Kitos paslaugos" },
        }
      }
    },
    required: ["clientName", "address", "date", "time", "windowCount", "floor"],
  },
};

const addExpenseTool: FunctionDeclaration = {
  name: "add_expense",
  parameters: {
    type: Type.OBJECT,
    description: "Užregistruoti verslo išlaidas.",
    properties: {
      title: { type: Type.STRING, description: "Išlaidų pavadinimas (pvz. Kuras)" },
      amount: { type: Type.NUMBER, description: "Suma eurais" },
      date: { type: Type.STRING, description: "Data (YYYY-MM-DD)" },
      category: { type: Type.STRING, enum: ["kuras", "priemonės", "reklama", "kita"], description: "Kategorija" },
      notes: { type: Type.STRING, description: "Papildomos pastabos apie išlaidas" },
    },
    required: ["title", "amount", "date", "category"],
  },
};

const updateOrderTool: FunctionDeclaration = {
  name: "update_order",
  parameters: {
    type: Type.OBJECT,
    description: "Atnaujinti esamą užsakymą.",
    properties: {
      orderId: { type: Type.STRING, description: "Užsakymo ID" },
      status: { type: Type.STRING, enum: ["suplanuota", "vykdoma", "atlikta"], description: "Nauja būsena" },
      notes: { type: Type.STRING, description: "Naujos pastabos" },
      totalPrice: { type: Type.NUMBER, description: "Nauja kaina" },
      address: { type: Type.STRING, description: "Naujas adresas" },
      date: { type: Type.STRING, description: "Nauja data (YYYY-MM-DD)" },
      time: { type: Type.STRING, description: "Naujas laikas (HH:MM)" },
      windowCount: { type: Type.NUMBER, description: "Naujas langų kiekis" },
      floor: { type: Type.NUMBER, description: "Naujas aukštas" },
      estimatedDuration: { type: Type.NUMBER, description: "Nauja apytikslė trukmė bendromis minutėmis (pvz. 1 valanda = 60, 1 diena = 1440)" },
      additionalServices: {
        type: Type.OBJECT,
        description: "Atnaujintos papildomos paslaugos",
        properties: {
          balkonai: { type: Type.BOOLEAN },
          vitrinos: { type: Type.BOOLEAN },
          terasa: { type: Type.BOOLEAN },
          kiti: { type: Type.BOOLEAN },
        }
      }
    },
    required: ["orderId"],
  },
};

const deleteOrderTool: FunctionDeclaration = {
  name: "delete_order",
  parameters: {
    type: Type.OBJECT,
    description: "Ištrinti užsakymą.",
    properties: {
      orderId: { type: Type.STRING, description: "Užsakymo ID" },
    },
    required: ["orderId"],
  },
};

const updateClientTool: FunctionDeclaration = {
  name: "update_client",
  parameters: {
    type: Type.OBJECT,
    description: "Atnaujinti kliento informaciją.",
    properties: {
      clientId: { type: Type.STRING, description: "Kliento ID" },
      name: { type: Type.STRING, description: "Naujas vardas" },
      phone: { type: Type.STRING, description: "Naujas telefonas" },
      address: { type: Type.STRING, description: "Naujas adresas" },
      notes: { type: Type.STRING, description: "Naujos pastabos" },
      buildingType: { type: Type.STRING, enum: ["butas", "namas", "ofisas"], description: "Naujas pastato tipas" },
    },
    required: ["clientId"],
  },
};

const deleteClientTool: FunctionDeclaration = {
  name: "delete_client",
  parameters: {
    type: Type.OBJECT,
    description: "Ištrinti klientą.",
    properties: {
      clientId: { type: Type.STRING, description: "Kliento ID" },
    },
    required: ["clientId"],
  },
};

const updateExpenseTool: FunctionDeclaration = {
  name: "update_expense",
  parameters: {
    type: Type.OBJECT,
    description: "Atnaujinti išlaidas.",
    properties: {
      expenseId: { type: Type.STRING, description: "Išlaidų ID" },
      amount: { type: Type.NUMBER, description: "Nauja suma" },
      title: { type: Type.STRING, description: "Naujas pavadinimas" },
      date: { type: Type.STRING, description: "Nauja data (YYYY-MM-DD)" },
      category: { type: Type.STRING, enum: ["kuras", "priemonės", "reklama", "kita"], description: "Nauja kategorija" },
      notes: { type: Type.STRING, description: "Naujos pastabos" },
    },
    required: ["expenseId"],
  },
};

const deleteExpenseTool: FunctionDeclaration = {
  name: "delete_expense",
  parameters: {
    type: Type.OBJECT,
    description: "Ištrinti išlaidas.",
    properties: {
      expenseId: { type: Type.STRING, description: "Išlaidų ID" },
    },
    required: ["expenseId"],
  },
};

const addMemoryTool: FunctionDeclaration = {
  name: "add_memory",
  parameters: {
    type: Type.OBJECT,
    description: "Išsaugoti svarbią informaciją asistento atminčiai (ilgalaikė atmintis).",
    properties: {
      content: { type: Type.STRING, description: "Informacija, kurią reikia įsiminti" },
      category: { type: Type.STRING, enum: ["klientas", "verslas", "procesas", "kita"], description: "Kategorija" },
      importance: { type: Type.NUMBER, description: "Svarba (1-5)" },
    },
    required: ["content", "category"],
  },
};

const updateMemoryTool: FunctionDeclaration = {
  name: "update_memory",
  parameters: {
    type: Type.OBJECT,
    description: "Atnaujinti esamą atmintį.",
    properties: {
      memoryId: { type: Type.STRING, description: "Atminties ID" },
      content: { type: Type.STRING, description: "Naujas turinys" },
      category: { type: Type.STRING, enum: ["klientas", "verslas", "procesas", "kita"], description: "Nauja kategorija" },
      importance: { type: Type.NUMBER, description: "Nauja svarba (1-5)" },
    },
    required: ["memoryId"],
  },
};

const deleteMemoryTool: FunctionDeclaration = {
  name: "delete_memory",
  parameters: {
    type: Type.OBJECT,
    description: "Ištrinti atmintį.",
    properties: {
      memoryId: { type: Type.STRING, description: "Atminties ID" },
    },
    required: ["memoryId"],
  },
};

// ====== PROACTIVE ALERTS TOOLS ======

const getNeglectedClientsTool: FunctionDeclaration = {
  name: "get_neglected_clients",
  parameters: {
    type: Type.OBJECT,
    description: "Randa klientų, kurie nebuvo aptarnauti per nurodytą dienų skaičių. Naudinga norint priminti apie paslaugas.",
    properties: {
      days: { type: Type.NUMBER, description: "Dienų skaičius (numatyta: 90 dienų)" },
    },
  },
};

const getLowInventoryTool: FunctionDeclaration = {
  name: "get_low_inventory",
  parameters: {
    type: Type.OBJECT,
    description: "Randa inventoriaus prekes, kurių kiekis yra žemiau minimalaus ribos. Naudinga planuojant pirkimus.",
    properties: {},
  },
};

const getUnpaidOrdersTool: FunctionDeclaration = {
  name: "get_unpaid_orders",
  parameters: {
    type: Type.OBJECT,
    description: "Randa užsakymus, kurie yra atlikti bet dar nėra apmokėti. Padeda sekti mokėjimus.",
    properties: {},
  },
};

// ====== BUSINESS ANALYTICS TOOLS ======

const getBusinessSummaryTool: FunctionDeclaration = {
  name: "get_business_summary",
  parameters: {
    type: Type.OBJECT,
    description: "Pateikia verslo suvestinę už nurodytą laikotarpį: pajamas, išlaidas, pelną, užsakymų skaičių.",
    properties: {
      period: { type: Type.STRING, enum: ["week", "month", "year"], description: "Laikotarpis: week (savaitė), month (mėnuo), year (metai)" },
    },
  },
};

const getTopClientsTool: FunctionDeclaration = {
  name: "get_top_clients",
  parameters: {
    type: Type.OBJECT,
    description: "Pateikia pelningiausius ar dažniausiai užsakančius klientus. Padeda nustatyti svarbiausius klientus.",
    properties: {
      limit: { type: Type.NUMBER, description: "Kiek klientų rodyti (numatyta: 5)" },
      by: { type: Type.STRING, enum: ["orders", "revenue"], description: "Rikiuoti pagal: orders (užsakymų skaičius) arba revenue (pajamas)" },
    },
  },
};

const getRevenueTrendsTool: FunctionDeclaration = {
  name: "get_revenue_trends",
  parameters: {
    type: Type.OBJECT,
    description: "Pateikia pajamų tendencijas per nurodytą mėnesių skaičių. Naudinga planuojant biudžetą.",
    properties: {
      months: { type: Type.NUMBER, description: "Mėnesių skaičius (numatyta: 6)" },
    },
  },
};

// ====== WORKFLOW AUTOMATION TOOLS ======

const createRecurringOrderTool: FunctionDeclaration = {
  name: "create_recurring_order",
  parameters: {
    type: Type.OBJECT,
    description: "Sukuria kartotinį užsakymą, kuris bus kartojamas kas nurodytą mėnesių skaičių.",
    properties: {
      clientName: { type: Type.STRING, description: "Kliento vardas" },
      address: { type: Type.STRING, description: "Valymo adresas" },
      date: { type: Type.STRING, description: "Pradžios data (YYYY-MM-DD)" },
      time: { type: Type.STRING, description: "Laikas (HH:MM)" },
      windowCount: { type: Type.NUMBER, description: "Langų kiekis" },
      floor: { type: Type.NUMBER, description: "Aukštas" },
      intervalMonths: { type: Type.NUMBER, description: "Kartojimo intervalas mėnesiais (pvz. 1 = kas mėnesį)" },
      additionalServices: {
        type: Type.OBJECT,
        description: "Papildomos paslaugos",
        properties: {
          balkonai: { type: Type.BOOLEAN },
          vitrinos: { type: Type.BOOLEAN },
          terasa: { type: Type.BOOLEAN },
          kiti: { type: Type.BOOLEAN },
        }
      },
    },
    required: ["clientName", "address", "date", "time", "windowCount", "floor", "intervalMonths"],
  },
};

const generateReminderMessageTool: FunctionDeclaration = {
  name: "generate_reminder_message",
  parameters: {
    type: Type.OBJECT,
    description: "Sugalvoja priminimo žinutę klientui pagal užsakymą, naudojant SMS šabloną.",
    properties: {
      orderId: { type: Type.STRING, description: "Užsakymo ID" },
    },
    required: ["orderId"],
  },
};

const batchUpdateOrderStatusTool: FunctionDeclaration = {
  name: "batch_update_order_status",
  parameters: {
    type: Type.OBJECT,
    description: "Masinis užsakymų būsenos pakeitimas. Naudinga kai reikia vienu metu atnaujinti daug užsakymų.",
    properties: {
      orderIds: { type: Type.ARRAY, items: { type: Type.STRING }, description: "Užsakymų ID sąrašas" },
      status: { type: Type.STRING, enum: ["suplanuota", "vykdoma", "atlikta"], description: "Nauja būsena" },
    },
    required: ["orderIds", "status"],
  },
};

/**
 * Build modular system instruction based on current context
 */
async function buildModularSystemInstruction(
  message: string,
  context: { clients: Client[]; orders: Order[]; expenses: Expense[]; memories: Memory[] },
  history: any[],
  businessMetrics: { totalRevenue: number; totalExpenses: number; profit: number }
): Promise<string> {
  const assembler = new ModularPromptAssembler({
    maxTokens: 1500,
    includeExamples: true,
    includeDebugInfo: false
  });
  
  // Prioritize memories based on current query
  const prioritizedMemories = prioritizeMemories(context.memories, {
    query: message,
    userId: 'system',
    conversationHistory: history.map((h: any) => h.parts?.[0]?.text || '').filter(Boolean)
  });
  
  // Create mock classification for prompt assembly
  const mockClassification = {
    intention: 'general_chat' as any,
    confidence: 0.8,
    method: 'keyword' as const,
    shouldExecuteTool: false,
    toolName: null,
    parameters: {},
    alternatives: []
  };
  
  // Try to get actual classification if API key is available
  const apiKey = localStorage.getItem('custom_api_key') || (window as any).aistudio?.getApiKey?.() || import.meta.env.VITE_GEMINI_API_KEY || '';
  if (apiKey) {
    try {
      const classification = await classifyIntentHybrid(message, apiKey);
      mockClassification.intention = classification.intention;
      mockClassification.confidence = classification.confidence;
      mockClassification.shouldExecuteTool = classification.shouldExecuteTool;
      mockClassification.toolName = classification.toolName;
    } catch (error) {
      console.warn('Failed to classify intent for prompt assembly:', error);
    }
  }
  
  // Assemble the prompt
  const assemblyResult = assembler.assemble(
    mockClassification,
    prioritizedMemories,
    ['add_client', 'get_business_summary', 'get_unpaid_orders', 'generate_reminder_message'], // Available tools
    {
      clientCount: context.clients.length,
      orderCount: context.orders.length,
      revenue: businessMetrics.totalRevenue
    }
  );
  
  let systemPrompt = assembler.formatAsSystemPrompt(assemblyResult);
  
  // Add dynamic business context
  systemPrompt = enrichWithContext(systemPrompt, {
    currentDate: new Date().toISOString().split('T')[0],
    recentOrders: context.orders.length,
    pendingPayments: context.orders.filter(o => !o.isPaid && o.status === 'atlikta').length,
    memoryCount: prioritizedMemories.length
  });
  
  // Add prioritized memories context
  if (prioritizedMemories.length > 0) {
    systemPrompt += '\n\n' + formatMemoriesForContext(prioritizedMemories);
  }
  
  // Add business data context
  systemPrompt += `
  
📊 VERSLO DUOMENYS:
- Klientai: ${context.clients.length}
- Užsakymai: ${context.orders.length}
- Pajamos: ${businessMetrics.totalRevenue}€
- Išlaidos: ${businessMetrics.totalExpenses}€
- Pelnas: ${businessMetrics.profit}€

${context.clients.length > 0 ? `Klientų sąrašas: ${JSON.stringify(context.clients.slice(0, 10).map((c: Client) => ({ id: c.id, name: c.name, address: c.address })))}` : ''}
${context.orders.length > 0 ? `\nPaskutiniai užsakymai: ${JSON.stringify(context.orders.slice(-5).map((o: Order) => ({ id: o.id, client: o.clientName, date: o.date, status: o.status, price: o.totalPrice })))}` : ''}
${context.expenses.length > 0 ? `\nPaskutinės išlaidos: ${JSON.stringify(context.expenses.slice(-5).map((e: Expense) => ({ id: e.id, title: e.title, amount: e.amount, date: e.date })))}` : ''}

📅 Data: ${new Date().toISOString().split('T')[0]}

Atsakyk lietuvių kalba. Naudok Markdown formatavimą atsakymams.`;

  // Log assembly info for debugging
  console.log('Modular Prompt Assembly:', {
    intention: mockClassification.intention,
    confidence: mockClassification.confidence,
    tokenCount: assemblyResult.totalTokens,
    moduleCount: assemblyResult.modules.length,
    warnings: assemblyResult.warnings
  });
  
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

  const tools = [
    addClientTool, addOrderTool, addExpenseTool,
    updateOrderTool, deleteOrderTool,
    updateClientTool, deleteClientTool,
    updateExpenseTool, deleteExpenseTool,
    addMemoryTool, updateMemoryTool, deleteMemoryTool,
    // Proactive alerts
    getNeglectedClientsTool, getLowInventoryTool, getUnpaidOrdersTool,
    // Business analytics
    getBusinessSummaryTool, getTopClientsTool, getRevenueTrendsTool,
    // Workflow automation
    createRecurringOrderTool, generateReminderMessageTool, batchUpdateOrderStatusTool
  ];

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
      const choice = result.choices[0].message;

      return {
        text: choice.content || "",
        functionCalls: choice.tool_calls?.map((tc: any) => ({
          name: tc.function.name,
          args: JSON.parse(tc.function.arguments),
          id: tc.id
        })),
        history: [...history, { role: 'user', parts: [{ text: message }] }, { role: 'model', parts: [{ text: choice.content || "" }] }],
      };
    } catch (error: any) {
      console.error("OpenRouter Chat Error:", error);

      // Fallback for quota/error
      if (error.message?.includes("429") || error.message?.includes("quota") || error.message?.includes("neprieinami")) {
        return {
          text: "Atsiprašau, šiuo metu visi nemokami AI modeliai yra perkrauti. Galite tęsti darbą rankiniu būdu, o aš grįšiu po kurio laiko! Ar galiu dar kuo nors padėti be AI funkcijų?",
          history: [...history, { role: 'user', parts: [{ text: message }] }, { role: 'model', parts: [{ text: "AI Fallback mode active." }] }],
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
          maxOutputTokens: 4096,
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
        console.warn(`Gemini model ${modelName} failed:`, error);
        lastError = error;
        // If it's not a quota error, maybe don't try other models? 
        // But usually it's worth trying another model if one fails.
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

export type DashboardInsightId = 'memory' | 'market' | 'operations';

export interface DashboardInsight {
  id: DashboardInsightId;
  title: string;
  text: string;
}

const DASHBOARD_INSIGHT_ORDER: DashboardInsightId[] = ['memory', 'market', 'operations'];

export const DASHBOARD_INSIGHT_LABELS: Record<DashboardInsightId, { defaultTitle: string; badge: string }> = {
  memory: {
    defaultTitle: 'Asistento atmintis ir komandos tobulėjimas',
    badge: 'Atmintis',
  },
  market: {
    defaultTitle: 'Rinka, nauji darbai ir įranga',
    badge: 'Rinka',
  },
  operations: {
    defaultTitle: 'Klientai ir operacinis valdymas',
    badge: 'Operacijos',
  },
};

function normalizeDashboardInsightsFromObjects(raw: unknown[]): DashboardInsight[] {
  const byId = new Map<DashboardInsightId, DashboardInsight>();
  for (const item of raw) {
    if (!item || typeof item !== 'object') continue;
    const o = item as Record<string, unknown>;
    const id = o.id as string;
    if (id !== 'memory' && id !== 'market' && id !== 'operations') continue;
    const title = String(o.title ?? DASHBOARD_INSIGHT_LABELS[id].defaultTitle).trim();
    const text = String(o.text ?? '').trim();
    if (text) byId.set(id, { id, title: title || DASHBOARD_INSIGHT_LABELS[id].defaultTitle, text });
  }
  return DASHBOARD_INSIGHT_ORDER.map((id) => {
    if (byId.has(id)) return byId.get(id)!;
    return {
      id,
      title: DASHBOARD_INSIGHT_LABELS[id].defaultTitle,
      text: 'Šiai kategorijai įžvalgos šiuo metu nėra.',
    };
  });
}

function parseDashboardInsightsPayload(obj: unknown): DashboardInsight[] | null {
  if (!obj || typeof obj !== 'object') return null;
  const insights = (obj as Record<string, unknown>).insights;
  if (!Array.isArray(insights) || insights.length === 0) return null;

  if (insights.every((x) => x && typeof x === 'object')) {
    return normalizeDashboardInsightsFromObjects(insights as unknown[]);
  }

  if (insights.every((x) => typeof x === 'string')) {
    const [a, b, c] = insights as string[];
    return [
      { id: 'memory', title: DASHBOARD_INSIGHT_LABELS.memory.defaultTitle, text: a.trim() },
      { id: 'market', title: DASHBOARD_INSIGHT_LABELS.market.defaultTitle, text: (b || a).trim() },
      { id: 'operations', title: DASHBOARD_INSIGHT_LABELS.operations.defaultTitle, text: (c || b || a).trim() },
    ];
  }

  return null;
}

function buildDashboardInsightsFallback(
  orders: Order[],
  clients: Client[],
  memories: Memory[],
  expenses: Expense[],
): DashboardInsight[] {
  const teamMemories = memories.filter((m) => m.isActive !== false);
  const memoryText =
    teamMemories.length > 0
      ? `Pagal ${teamMemories.length} aktyvius asistento įrašus: ${teamMemories
          .slice(0, 5)
          .map((m) => m.content)
          .join(' · ')}${teamMemories.length > 5 ? ' …' : ''} Peržiūrėkite visą atmintį skiltyje „Asistentas“ ir atnaujinkite prioritetus komandos susirinkimui.`
      : 'Asistento atmintyje įrašų nėra — fiksuokite sprendimus, klientų ypatumus ir mokymų temas, kad valdymo komanda galėtų nuosekliai tobulėti.';

  const priemones = expenses.filter((e) => e.category === 'priemonės').reduce((s, e) => s + e.amount, 0);
  const kuras = expenses.filter((e) => e.category === 'kuras').reduce((s, e) => s + e.amount, 0);
  const marketText = `Išlaidų signalai: priemonės ${priemones.toFixed(0)} €, kuras ${kuras.toFixed(0)} € (iš viso ${expenses.length} įrašų). Planuokite sezono pasiūlymus ir naujų užsakymų paiešką (reklama, partneriai, B2B). Įrangai: peržiūrėkite ar priedai atitinka augantį užsakymų kiekį (${orders.length} užsakymų sistemoje).`;

  const now = new Date();
  const sixtyDaysAgo = new Date(now.getTime() - 60 * 24 * 60 * 60 * 1000);
  const neglected = clients.filter((c) => {
    const lastOrder = orders
      .filter((o) => o.clientId === c.id)
      .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())[0];
    return !lastOrder || new Date(lastOrder.date) < sixtyDaysAgo;
  }).slice(0, 3);
  const opsText =
    neglected.length > 0
      ? `Dėmesio reikalauja klientai (>60 d. be užsakymo): ${neglected.map((c) => `${c.name} (${c.phone || 'tel. nėra'})`).join('; ')}. Susisiekite su konkrečiu pasiūlymu ir data.`
      : clients.length === 0
        ? 'Klientų sąrašas tuščias — sutelkite dėmesį į naujų kontaktų rinkimą ir pirmų vizitų planą.'
        : `Klientų: ${clients.length}, užsakymų: ${orders.length}. Peržiūrėkite kalendorių ir laukiančius vizitus; stiprinkite pastovius klientus papildomomis paslaugomis.`;

  return [
    { id: 'memory', title: DASHBOARD_INSIGHT_LABELS.memory.defaultTitle, text: memoryText },
    { id: 'market', title: DASHBOARD_INSIGHT_LABELS.market.defaultTitle, text: marketText },
    { id: 'operations', title: DASHBOARD_INSIGHT_LABELS.operations.defaultTitle, text: opsText },
  ];
}

function buildBusinessInsightsPrompt(
  orders: Order[],
  clients: Client[],
  memories: Memory[],
  expenses: Expense[],
): string {
  const now = new Date();
  const month = now.getMonth() + 1;
  const sezonoPastaba =
    month >= 4 && month <= 9
      ? 'Šiltasis sezonas — didesnis lauko langų valymo poreikis ir konkurencija dėl brigadų.'
      : 'Ruduo/žiema — akcentuokite planavimą, vidaus darbus ir pavasario išankstinę prekybą.';

  const teamMemories = memories
    .filter((m) => m.isActive !== false)
    .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
    .map((m) => ({
      turinys: m.content,
      kategorija: m.category,
      sukurta: m.createdAt,
      ivykiData: m.eventDate ?? null,
      svarba: m.importance ?? null,
    }));

  const expensesRecent = [...expenses]
    .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
    .slice(0, 45)
    .map((e) => ({
      data: e.date,
      suma: e.amount,
      kategorija: e.category,
      pastabos: e.notes ?? '',
    }));

  const expenseTotals = expenses.reduce(
    (acc, e) => {
      acc[e.category] = (acc[e.category] || 0) + e.amount;
      return acc;
    },
    {} as Record<string, number>,
  );

  const sixtyDaysAgo = new Date(now.getTime() - 60 * 24 * 60 * 60 * 1000);
  const neglectedClients = clients
    .filter((c) => {
      const lastOrder = orders
        .filter((o) => o.clientId === c.id)
        .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())[0];
      return !lastOrder || new Date(lastOrder.date) < sixtyDaysAgo;
    })
    .slice(0, 8);

  const clientSpending: Record<string, number> = {};
  orders.forEach((o) => {
    const price = parseFloat(String(o.totalPrice || 0));
    clientSpending[o.clientId] = (clientSpending[o.clientId] || 0) + price;
  });
  const topSpenders = Object.entries(clientSpending)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 6);

  const areas = [...new Set(clients.map((c) => c.address).filter(Boolean))].slice(0, 25);

  return `
Esi Švarus Darbas CRM strateginis asistentas VALDYMO KOMANDAI (langų valymas, Lietuva).

ŠIANDIENOS DATA: ${now.toISOString().split('T')[0]}
SEZONO KONTEKSTAS: ${sezonoPastaba}

--- DUOMENYS: ASISTENTO ATMINTIS (VISI AKTYVŪS ĮRAŠAI, PILNAS KONTEKSTAS) ---
${JSON.stringify(teamMemories)}

--- DUOMENYS: RINKA / IŠLAIDOS / ĮRANGA IR PRIEMONĖS ---
Išlaidų sumos pagal kategorijas (€): ${JSON.stringify(expenseTotals)}
Paskutinės išlaidos (įskaitant priemonės, kuras — įrangos ir eksploatacijos signalai): ${JSON.stringify(expensesRecent)}
Geografija (adresų imtis): ${JSON.stringify(areas)}
Užsakymų iš viso: ${orders.length}, klientų: ${clients.length}

--- DUOMENYS: OPERACIJOS IR KLIENTAI ---
Pamesti ar ilgai neaktyvūs klientai (>60 d.): ${JSON.stringify(
    neglectedClients.map((c) => ({ vardas: c.name, telefonas: c.phone, adresas: c.address })),
  )}
Didžiausi klientai pagal apyvartą: ${JSON.stringify(
    topSpenders.map(([id, sum]) => {
      const client = clients.find((c) => c.id === id);
      return { vardas: client?.name, sumaEur: sum, telefonas: client?.phone };
    }),
  )}
Paskutiniai užsakymai: ${JSON.stringify(
    orders.slice(0, 18).map((o) => ({
      data: o.date,
      kaina: o.totalPrice,
      statusas: o.status,
      adresas: o.address,
    })),
  )}
Klientų imtis: ${JSON.stringify(
    clients.slice(0, 25).map((c) => ({
      vardas: c.name,
      adresas: c.address,
      telefonas: c.phone,
    })),
  )}

UŽDUOTIS — PATEIK TIKSLIAI 3 ATSKIRAS ĮŽVALGAS (lietuviškai), kad komanda galėtų TOBULĖTI:

1) id: "memory" — Asistento atmintis ir komandos tobulėjimas
   - Remkis VISU atminties sąrašu. Išskirk prioritetus, rizikas, mokymų ar procesų temas.
   - Jei įrašų nėra — pasiūlyk kaip tvarkyti atmintį ir komandos rutiną.

2) id: "market" — Rinka, naujų darbų (užsakymų) paieška ir įrangos / priemonių tobulinimas
   - Naudok išlaidas, sezoniškumą, geografiją, užsakymų apimtis.
   - Įtrauk konkrečias kryptis (pvz. B2B, rajonai, paslaugų paketai, inventorius), ne tik bendras frazes.

3) id: "operations" — Klientai ir operacinis valdymas
   - Konkretūs veiksmai: pamesti klientai su vardais ir telefonais, VIP klientai, artimiausi žingsniai.
   - Venk tuščių šūkių — jei duomenų trūksta, pasakyk ko trūksta ir ką įrašyti į CRM.

Kiekviena įžvalga: 2–4 sakiniai, "title" — trumpa antraštė (iki 8 žodžių), "text" — pilnas tekstas perklausai.

ATSAKYK TIK JSON (be markdown):
{
  "insights": [
    { "id": "memory", "title": "...", "text": "..." },
    { "id": "market", "title": "...", "text": "..." },
    { "id": "operations", "title": "...", "text": "..." }
  ]
}
`.trim();
}

export async function getBusinessInsights(
  orders: Order[],
  clients: Client[],
  memories: Memory[] = [],
  expenses: Expense[] = [],
): Promise<DashboardInsight[]> {
  const apiKey =
    localStorage.getItem('custom_api_key') ||
    (window as any).aistudio?.getApiKey?.() ||
    import.meta.env.VITE_GEMINI_API_KEY ||
    '';

  const prompt = buildBusinessInsightsPrompt(orders, clients, memories, expenses);
  const fallback = buildDashboardInsightsFallback(orders, clients, memories, expenses);

  if (!apiKey) {
    return fallback;
  }

  const runOpenRouter = async (): Promise<DashboardInsight[] | null> => {
    try {
      const result = await callOpenRouter(apiKey, 'free-auto', [{ role: 'user', content: prompt }]);
      const text = result.choices[0].message.content || '';
      const jsonMatch = text.match(/\{[\s\S]*\}/);
      if (!jsonMatch) return null;
      const parsed = parseDashboardInsightsPayload(JSON.parse(jsonMatch[0]));
      return parsed;
    } catch (e) {
      console.error('OpenRouter Insights Error:', e);
      return null;
    }
  };

  const runGemini = async (): Promise<DashboardInsight[] | null> => {
    try {
      const ai = getAiInstance(apiKey);
      const response = await ai.models.generateContent({
        model: 'gemini-3-flash-preview',
        contents: prompt,
        config: { responseMimeType: 'application/json' },
      });
      const text = response.text;
      if (!text) return null;
      return parseDashboardInsightsPayload(JSON.parse(text));
    } catch (error) {
      console.error('Error getting AI insights:', error);
      return null;
    }
  };

  if (isOpenRouterKey(apiKey)) {
    const fromOr = await runOpenRouter();
    if (fromOr) return fromOr;
    return fallback;
  }

  const fromGemini = await runGemini();
  if (fromGemini) return fromGemini;
  return fallback;
}

let currentAudio: HTMLAudioElement | null = null;

export function stopAllAudio() {
  if (currentAudio) {
    currentAudio.pause();
    currentAudio.currentTime = 0;
    currentAudio = null;
  }
  if (window.speechSynthesis) {
    window.speechSynthesis.cancel();
  }
}

function wrapPcmInWav(base64Pcm: string, sampleRate: number = 24000): string {
  const pcmData = Uint8Array.from(atob(base64Pcm), c => c.charCodeAt(0));
  const dataSize = pcmData.length;
  const header = new ArrayBuffer(44);
  const view = new DataView(header);

  // RIFF identifier
  view.setUint32(0, 0x52494646, false); // "RIFF"
  // file length
  view.setUint32(4, 36 + dataSize, true);
  // RIFF type
  view.setUint32(8, 0x57415645, false); // "WAVE"
  // format chunk identifier
  view.setUint32(12, 0x666d7420, false); // "fmt "
  // format chunk length
  view.setUint32(16, 16, true);
  // sample format (raw)
  view.setUint16(20, 1, true);
  // channel count
  view.setUint16(22, 1, true);
  // sample rate
  view.setUint32(24, sampleRate, true);
  // byte rate (sample rate * block align)
  view.setUint32(28, sampleRate * 2, true);
  // block align (channel count * bytes per sample)
  view.setUint16(32, 2, true);
  // bits per sample
  view.setUint16(34, 16, true);
  // data chunk identifier
  view.setUint32(36, 0x64617461, false); // "data"
  // data chunk length
  view.setUint32(40, dataSize, true);

  const wavData = new Uint8Array(44 + dataSize);
  wavData.set(new Uint8Array(header), 0);
  wavData.set(pcmData, 44);

  let binary = '';
  const bytes = new Uint8Array(wavData);
  const len = bytes.byteLength;
  for (let i = 0; i < len; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary);
}

// Helper to map voice names to Google voices
function mapToGoogleVoice(voice: string): string {
  const googleVoices = ['Puck', 'Charon', 'Kore', 'Fenrir', 'Zephyr', 'Aoede'];
  return googleVoices.includes(voice) ? voice : 'Zephyr';
}

// ElevenLabs TTS
export async function getElevenLabsSpeech(
  text: string,
  voice: string = 'bella'
): Promise<HTMLAudioElement | null> {
  const apiKey = localStorage.getItem('custom_api_key') || '';
  if (!apiKey || !apiKey.startsWith('sk_')) return null;

  try {
    const response = await fetch('https://api.elevenlabs.io/v1/text-to-speech/' + voice, {
      method: 'POST',
      headers: {
        'Accept': 'audio/mpeg',
        'Content-Type': 'application/json',
        'xi-api-key': apiKey,
      },
      body: JSON.stringify({
        text: text,
        model_id: 'eleven_monolingual_v1',
        voice_settings: {
          stability: 0.5,
          similarity_boost: 0.8,
        }
      })
    });

    if (!response.ok) return null;

    const blob = await response.blob();
    const url = URL.createObjectURL(blob);
    return new Audio(url);
  } catch (e) {
    console.warn('ElevenLabs TTS failed:', e);
    return null;
  }
}

// OpenAI TTS via OpenRouter
export async function getOpenAITSViaOpenRouter(
  text: string,
  voice: string = 'alloy'
): Promise<HTMLAudioElement | null> {
  const apiKey = localStorage.getItem('custom_api_key') || '';
  if (!apiKey) return null;

  // Map common voice names to OpenAI voices
  const voiceMap: Record<string, string> = {
    'Puck': 'onyx', 'Charon': 'onyx', 'Kore': 'nova', 'Fenrir': 'shimmer',
    'Zephyr': 'alloy', 'Aoede': 'alloy', 'rachel': 'nova', 'domi': 'nova',
    'adam': 'onyx', 'sam': 'shimmer', 'bella': 'shimmer', 'josh': 'onyx'
  };
  const openAIVoice = voiceMap[voice] || 'alloy';

  // OpenRouter deprecated their audio/speech endpoint, use browser TTS as fallback
  console.warn('OpenRouter TTS endpoint no longer available, using browser TTS');
  return null;
}

// Extended voice types for all providers
export type VoiceProvider = 'google' | 'elevenlabs' | 'openai' | 'browser';
export type GoogleVoice = 'Puck' | 'Charon' | 'Kore' | 'Fenrir' | 'Zephyr' | 'Aoede';
export type ElevenLabsVoice = 'rachel' | 'domi' | 'adam' | 'sam' | 'bella' | 'josh';
export type OpenAIVoice = 'alloy' | 'echo' | 'fable' | 'onyx' | 'nova' | 'shimmer';

export async function getSpeechAudio(
  text: string,
  voice: string = 'Zephyr',
  provider: VoiceProvider = 'google'
): Promise<HTMLAudioElement | null> {
  // Check for dedicated TTS API key first
  let apiKey = localStorage.getItem('tts_api_key') || '';
  
  // Fall back to main API key if no dedicated TTS key
  if (!apiKey) {
    apiKey = localStorage.getItem('custom_api_key') || (window as any).aistudio?.getApiKey?.() || import.meta.env.VITE_GEMINI_API_KEY || '';
  }

  // If using OpenRouter key without dedicated TTS key, try browser TTS instead
  if (isOpenRouterKey(apiKey) && !localStorage.getItem('tts_api_key')) {
    return null;
  }

  // Try ElevenLabs if API key looks like ElevenLabs (starts with sk_ but not sk-or-)
  if (apiKey.startsWith('sk_') && !apiKey.startsWith('sk-or-')) {
    const elevenResult = await getElevenLabsSpeech(text, voice);
    if (elevenResult) return elevenResult;
  }

  // Default to Google Gemini TTS
  const googleVoice = mapToGoogleVoice(voice);

  const ai = getAiInstance(apiKey);
  try {
    const response = await ai.models.generateContent({
      model: "gemini-2.5-flash-preview-tts",
      contents: [{ parts: [{ text: `Perskaityk šį tekstą kaip gyvas, šiltas, modernus ir itin profesionalus asistentas. Naudok natūralią, žmogišką intonaciją, daryk logines pauzes, skambėk užtikrintai ir maloniai. Svarbu: venk bet kokio robotiškumo ar senamadiško tono. Tekstas: ${text}` }] }],
      config: {
        responseModalities: [Modality.AUDIO],
        speechConfig: {
          voiceConfig: {
            prebuiltVoiceConfig: { voiceName: voice },
          },
        },
      },
    });

    const base64Audio = response.candidates?.[0]?.content?.parts?.[0]?.inlineData?.data;
    if (base64Audio) {
      const wavBase64 = wrapPcmInWav(base64Audio);
      return new Audio(`data:audio/wav;base64,${wavBase64}`);
    }
  } catch (error: any) {
    const isQuotaError =
      error?.status === 'RESOURCE_EXHAUSTED' ||
      error?.code === 429 ||
      error?.error?.code === 429 ||
      error?.error?.status === 'RESOURCE_EXHAUSTED' ||
      (typeof error === 'string' && error.includes('429'));

    if (isQuotaError) {
      console.warn("Speech generation quota exceeded, falling back to browser TTS.");
    } else {
      console.error("Error generating speech:", error);
    }
  }
  return null;
}

export async function generateSpeech(text: string, voice: 'Puck' | 'Charon' | 'Kore' | 'Fenrir' | 'Zephyr' = 'Zephyr') {
  // Get voice rate from localStorage or use default
  const rate = parseFloat(localStorage.getItem('voice_rate') || '1.0');
  const selectedLang = localStorage.getItem('tts_language') || 'lt-LT';

  console.log(`🗣️ TTS Debug: lang=${selectedLang}, voice=${voice}, rate=${rate}`);
  
  stopAllAudio();

  // Map selected voice to browser voice parameters (with Lithuanian language support)
  const voiceMap: Record<string, { lang: string; rate: number; pitch: number }> = {
    'Zephyr': { lang: selectedLang, rate: 1.0, pitch: 1.0 },      // warm
    'Puck': { lang: selectedLang, rate: 0.9, pitch: 0.8 },        // masculine
    'Charon': { lang: selectedLang, rate: 0.85, pitch: 0.7 },      // deep
    'Kore': { lang: selectedLang, rate: 1.0, pitch: 1.0 },         // neutral
    'Fenrir': { lang: selectedLang, rate: 0.95, pitch: 0.9 },      // strong
    'Aoede': { lang: selectedLang, rate: 1.1, pitch: 1.2 },        // gentle
  };
  const voiceSettings = voiceMap[voice] || voiceMap['Zephyr'];

  // Use browser TTS by default - it supports rate changes
  if (window.speechSynthesis) {
    return new Promise<void>((resolve) => {
      const utterance = new SpeechSynthesisUtterance(text);
      
      // Smart voice selection based on language
      const voices = window.speechSynthesis.getVoices();
      
      console.log(`🗣️ TTS Debug: Available voices=${voices.length}`);
      
      // Priority: exact language match > broad language match > any available
      const langCode = selectedLang.split('-')[0]; // e.g., 'lt' from 'lt-LT'
      
      // Try exact match first (lt-LT)
      let selectedVoice = voices.find(v => v.lang === selectedLang);
      console.log(`🗣️ TTS Debug: Exact match (${selectedLang}): ${selectedVoice?.name || 'none'}`);
      
      // Try broad match (lt)
      if (!selectedVoice) {
        selectedVoice = voices.find(v => v.lang.startsWith(langCode));
        console.log(`🗣️ TTS Debug: Broad match (${langCode}): ${selectedVoice?.name || 'none'}`);
      }
      
      // Try any voice that might work for this language
      if (!selectedVoice) {
        // For Lithuanian, try Polish or Russian as fallback (similar Slavic)
        if (langCode === 'lt') {
          selectedVoice = voices.find(v => v.lang.startsWith('pl') || v.lang.startsWith('ru'));
          console.log(`🗣️ TTS Debug: Slavic fallback: ${selectedVoice?.name || 'none'}`);
        }
      }
      
      // Last resort: use default English voice but set language anyway
      if (!selectedVoice) {
        selectedVoice = voices[0];
        console.log(`🗣️ TTS Debug: Using default: ${selectedVoice?.name || 'none'}`);
      }
      
      utterance.voice = selectedVoice;
      utterance.lang = selectedLang;
      utterance.rate = rate;
      utterance.pitch = voiceSettings.pitch;

      console.log(`🗣️ TTS Debug: Speaking with voice=${selectedVoice?.name}, lang=${selectedLang}`);
      
      utterance.onend = () => {
        console.log(`🗣️ TTS Debug: Finished speaking`);
        resolve();
      };
      utterance.onerror = (e) => {
        console.warn('🗣️ TTS Debug error:', e);
        resolve();
      };
      
      window.speechSynthesis.speak(utterance);
    });
  }

  // Fallback to AI TTS if browser TTS is not available
  try {
    console.log('🗣️ TTS Debug: Trying AI TTS fallback...');
    const audio = await getSpeechAudio(text, voice);
    if (audio) {
      console.log('🗣️ TTS Debug: AI TTS audio received');
      currentAudio = audio;
      return new Promise<void>((resolve, reject) => {
        audio.onended = () => {
          currentAudio = null;
          resolve();
        };
        audio.onerror = (e) => {
          currentAudio = null;
          reject(e);
        };
        audio.play().catch(reject);
      });
    } else {
      console.log('🗣️ TTS Debug: AI TTS returned null');
    }
  } catch (e) {
    console.warn("🗣️ TTS Debug: All TTS failed:", e);
  }
}
