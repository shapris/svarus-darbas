// OpenRouter API integration for AI chat

// Helper to check if a key is an OpenRouter key
export const isOpenRouterKey = (key: string) => key?.startsWith('sk-or-v1-');
let openRouterGlobalCooldownUntil = 0;

// Get OpenRouter API key - enhanced for multiple environments
/** Viešas eksportas: ar yra OpenRouter raktas (env / localStorage). */
export const getOpenRouterKey = () => {
  const envOr =
    (typeof import.meta !== 'undefined' && import.meta.env?.VITE_OPENROUTER_API_KEY) ||
    (typeof process !== 'undefined' && process.env?.VITE_OPENROUTER_API_KEY) ||
    (typeof window !== 'undefined' && (window as any).openrouter_api_key) ||
    '';
 const dedicated = localStorage.getItem('openrouter_api_key');
  const custom = localStorage.getItem('custom_api_key');

  const key =
    (dedicated && isOpenRouterKey(dedicated) ? dedicated : '') ||
    (custom && isOpenRouterKey(custom) ? custom : '') ||
    (typeof envOr === 'string' && isOpenRouterKey(envOr) ? envOr : '');

  if (!key) {
    console.warn('OpenRouter API key not configured');
    return null;
  }

  return key;
};

function isRetryableOpenRouterMessage(msg: string): boolean {
  const m = msg.toLowerCase();
  return (
    m.includes('429') ||
    m.includes('rate limit') ||
    m.includes('too many requests') ||
    m.includes('overloaded') ||
    m.includes('timeout') ||
    m.includes('temporarily')
  );
}

function getOpenRouterCooldownMs(msg: string): number {
  const m = msg.toLowerCase();
  if (m.includes('free-models-per-day') || m.includes('per-day')) {
    return 6 * 60 * 60 * 1000; // 6h for daily free limit
  }
  return 60 * 1000; // default 60s
}

/** Transient / routing errors — try next model without backing off long */
function isToolRoutingFailure(msg: string): boolean {
  const m = msg.toLowerCase();
  return (
    m.includes('tool use') ||
    m.includes('no endpoints found') ||
    m.includes('not a valid model') ||
    m.includes('404:') ||
    m.includes('guardrail') ||
    m.includes('data policy')
  );
}

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

export { convertToOpenAITool };

// OpenRouter API call helper
export const callOpenRouter = async (
  model: string = "free-auto",
  messages: any[],
  tools?: any[],
  timeout: number = 60000  // Increased to 60s for free models
) => {
  if (Date.now() < openRouterGlobalCooldownUntil) {
    throw new Error('OpenRouter laikinai sustabdytas dėl kvotos/policy. Bandykite vėliau.');
  }
  const apiKey = getOpenRouterKey();
  
  if (!apiKey) {
    throw new Error(
      "OpenRouter API raktas nesukonfigūruotas. " +
      "Prašome įvesti API raktą nustatymuose arba pridėti VITE_OPENROUTER_API_KEY aplinkos kintamąjį."
    );
  }

  const openAiTools = tools ? tools.map(convertToOpenAITool) : undefined;

  const tryModel = async (modelName: string, useTools: boolean) => {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), timeout);

    try {
      // Convert messages to prompt format if needed
      const prompt = messages && Array.isArray(messages) && messages.length > 0 
        ? messages.map((m: any) => m.content).join('\n')
        : undefined;

      const requestBody: any = {
        model: modelName,
        max_tokens: 1024,
      };

      // Add either messages or prompt based on model requirements
      if (messages && Array.isArray(messages) && messages.length > 0) {
        requestBody.messages = messages;
      } else if (prompt) {
        requestBody.prompt = prompt;
      }

      // Add tools if available
      if (useTools && openAiTools) {
        requestBody.tools = openAiTools;
        requestBody.tool_choice = 'auto';
      }

      const response = await fetch("https://openrouter.ai/api/v1/chat/completions", {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${apiKey}`,
          "Content-Type": "application/json",
          "HTTP-Referer": window.location.origin,
          "X-Title": "Svarus Darbas CRM",
        },
        body: JSON.stringify(requestBody),
        signal: controller.signal
      });

      clearTimeout(timeoutId);

      if (!response.ok) {
        let errBody: { error?: { message?: unknown } } = {};
        try {
          errBody = await response.json();
        } catch {
          /* ignore */
        }
        const msg = errBody.error?.message;
        const msgStr =
          typeof msg === 'string' ? msg : msg != null ? JSON.stringify(msg) : `HTTP ${response.status}`;
        throw new Error(`[${modelName}] ${response.status}: ${msgStr}`);
      }
      const data = await response.json();
      return data;
    } catch (e: any) {
      clearTimeout(timeoutId);
      if (e.name === 'AbortError') {
        throw new Error(`[${modelName}] Timeout - modelis per lėtas`);
      }
      throw e;
    }
  };

  const errors: string[] = [];

  /**
   * Su įrankiais: tik maršrutizatorius ir keli patikrinti „:free“ modeliai.
   * (Daugelis senų ID nebeturi endpointų arba nepalaiko tool calling — 404.)
   */
  /** Papildomi „:free“ modeliai — padeda kai paskyros „privacy“ blokuoja tam tikrus endpointus. */
  const defaultFreeModelsWithTools = [
    'openrouter/free',
    'stepfun/step-3.5-flash:free',
    'meta-llama/llama-3.2-3b-instruct:free',
    'google/gemma-2-9b-it:free',
    'openai/gpt-oss-20b:free',
  ];

  /** Be įrankių — platesnis sąrašas (tik pokalbiui, CRM veiksmai nepraeis per AI) */
  const defaultFreeModelsChatOnly = [
    'openrouter/free',
    'stepfun/step-3.5-flash:free',
    'meta-llama/llama-3.2-3b-instruct:free',
    'google/gemma-2-9b-it:free',
    'nvidia/nemotron-nano-9b-v2:free',
    'openai/gpt-oss-20b:free',
  ];

  const userPicked =
    model !== 'free-auto'
      ? [model]
      : [];

  const modelsWithTools =
    userPicked.length > 0
      ? [...userPicked, ...defaultFreeModelsWithTools.filter((m) => !userPicked.includes(m))]
      : defaultFreeModelsWithTools;

  const modelsChatOnly =
    userPicked.length > 0
      ? [...userPicked, ...defaultFreeModelsChatOnly.filter((m) => !userPicked.includes(m))]
      : defaultFreeModelsChatOnly;

  const sleep = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

  if (openAiTools) {
    for (const modelName of modelsWithTools) {
      try {
        return await tryModel(modelName, true);
      } catch (e: any) {
        const msg = e?.message || String(e);
        console.warn(`Model ${modelName} with tools failed:`, msg);
        errors.push(msg);
        if (isRetryableOpenRouterMessage(msg) || isToolRoutingFailure(msg)) {
          openRouterGlobalCooldownUntil = Math.max(openRouterGlobalCooldownUntil, Date.now() + getOpenRouterCooldownMs(msg));
        }
        if (isRetryableOpenRouterMessage(msg)) {
          await sleep(800);
        } else if (!isToolRoutingFailure(msg)) {
          await sleep(200);
        }
      }
    }
  }

  for (const modelName of modelsChatOnly) {
    try {
      return await tryModel(modelName, false);
    } catch (e: any) {
      const msg = e?.message || String(e);
      console.warn(`Model ${modelName} without tools failed:`, msg);
      if (!errors.some((err) => err.includes(modelName))) {
        errors.push(msg);
      }
      if (isRetryableOpenRouterMessage(msg) || isToolRoutingFailure(msg)) {
        openRouterGlobalCooldownUntil = Math.max(openRouterGlobalCooldownUntil, Date.now() + getOpenRouterCooldownMs(msg));
      }
      if (isRetryableOpenRouterMessage(msg)) {
        await sleep(800);
      }
    }
  }

  throw new Error("Visi nemokami modeliai neprieinami. Detalės: " + errors.join(" | "));
}
