// OpenRouter API integration for AI chat

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

export { convertToOpenAITool };

// OpenRouter API call helper
export async function callOpenRouter(apiKey: string, model: string, messages: any[], tools?: any[]) {
  const openAiTools = tools ? tools.map(convertToOpenAITool) : undefined;

  const tryModel = async (modelName: string, useTools: boolean = true, timeout: number = 15000) => {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), timeout);

    try {
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
          max_tokens: 1024,
        }),
        signal: controller.signal
      });

      clearTimeout(timeoutId);

      if (!response.ok) {
        const error = await response.json();
        throw new Error(`[${modelName}] ${error.error?.message || "Klaida"}`);
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

  // OpenRouter free models - ordered by expected speed (fastest first)
  // skip reasoning models - they are slower
  const defaultFreeModels = [
    "openrouter/free",
    "google/gemma-3n-e4b-it:free",
    "meta-llama/llama-3.1-8b-instruct:free",
    "qwen/qwen3-4b-instruct:free",
    "nvidia/nemotron-nano-9b-v2:free",
    "stepfun/step-3.5-flash:free",
    "openai/gpt-oss-20b:free",
  ];

  const modelsToTry = model === "free-auto" ? defaultFreeModels : [model, ...defaultFreeModels.filter(m => m !== model)];

  const sleep = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

  // First try with tools
  if (openAiTools) {
    for (const modelName of modelsToTry) {
      try {
        return await tryModel(modelName, true);
      } catch (e: any) {
        console.warn(`Model ${modelName} with tools failed:`, e.message);
        errors.push(e.message);
        if (e.message.includes("429") || e.message.includes("overloaded")) {
          await sleep(300);
        }
      }
    }
  }

  // If tools failed or no tools provided, try without tools as fallback
  for (const modelName of modelsToTry) {
    try {
      return await tryModel(modelName, false);
    } catch (e: any) {
      console.warn(`Model ${modelName} without tools failed:`, e.message);
      if (!errors.some(err => err.includes(modelName))) {
        errors.push(e.message);
      }
      if (e.message.includes("429") || e.message.includes("overloaded")) {
        await sleep(300);
      }
    }
  }

  throw new Error("Visi nemokami modeliai neprieinami. Detalės: " + errors.join(" | "));
}
