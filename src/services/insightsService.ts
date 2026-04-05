// Dashboard business insights and analytics

import { Order, Client, Expense, Memory } from '../types';
import { getAiInstance, getGeminiApiKeyForSdk, consumeAiBudget } from './aiService';
import { isOpenRouterKey, callOpenRouter } from './openRouterService';
import { getGeminiKeyFromEnv } from '../utils/geminiEnv';

export type DashboardInsightId = 'memory' | 'market' | 'operations';

export interface DashboardInsight {
  id: DashboardInsightId;
  title: string;
  text: string;
}

const DASHBOARD_INSIGHT_ORDER: DashboardInsightId[] = ['memory', 'market', 'operations'];

export const DASHBOARD_INSIGHT_LABELS: Record<
  DashboardInsightId,
  { defaultTitle: string; badge: string }
> = {
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

let geminiInsightsCooldownUntil = 0;
let openRouterInsightsCooldownUntil = 0;
let inFlightInsightsPromise: Promise<DashboardInsight[]> | null = null;
let inFlightInsightsKey = '';
let lastInsightsSource: 'ai' | 'fallback' = 'fallback';

export function getLastInsightsSource(): 'ai' | 'fallback' {
  return lastInsightsSource;
}

function isCooldownActive(untilTs: number): boolean {
  return Date.now() < untilTs;
}

function extractRetryDelayMs(err: unknown): number {
  const raw = err instanceof Error ? err.message : String(err ?? '');
  // Free-tier "per day" exhaustion can report short retryDelay; avoid hammering for hours.
  if (/(perday|per day|requestsperday|limit:\s*0)/i.test(raw)) {
    return 6 * 60 * 60 * 1000; // 6h cooldown for hard quota exhaustion
  }
  const match = raw.match(/retry(?:Delay)?["\s:]*([0-9]+)(?:\.[0-9]+)?s/i);
  const seconds = match ? Number(match[1]) : NaN;
  if (Number.isFinite(seconds) && seconds > 0) return seconds * 1000;
  return 60_000; // default 60s cooldown
}

function isRateLimitOrQuotaError(err: unknown): boolean {
  const raw = (err instanceof Error ? err.message : String(err ?? '')).toLowerCase();
  return (
    raw.includes('429') ||
    raw.includes('resource_exhausted') ||
    raw.includes('quota') ||
    raw.includes('rate limit') ||
    raw.includes('too many requests')
  );
}

/** Nemokami modeliai dažnai įvynioja JSON į markdown, nors prompt prašo gryno JSON. */
function normalizeLikelyJsonFromChatModel(text: string): string {
  let t = text.trim();
  const fence = /^```(?:json)?\s*([\s\S]*?)\s*```/im.exec(t);
  if (fence?.[1]) t = fence[1].trim();
  return t;
}

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
      {
        id: 'operations',
        title: DASHBOARD_INSIGHT_LABELS.operations.defaultTitle,
        text: (c || b || a).trim(),
      },
    ];
  }

  return null;
}

function buildDashboardInsightsFallback(
  orders: Order[],
  clients: Client[],
  memories: Memory[],
  expenses: Expense[]
): DashboardInsight[] {
  const teamMemories = memories.filter((m) => m.isActive !== false);
  const memoryText =
    teamMemories.length > 0
      ? `Pagal ${teamMemories.length} aktyvius asistento įrašus: ${teamMemories
          .slice(0, 5)
          .map((m) => m.content)
          .join(
            ' · '
          )}${teamMemories.length > 5 ? ' …' : ''} Peržiūrėkite visą atmintį skiltyje „Asistentas" ir atnaujinkite prioritetus komandos susirinkimui.`
      : 'Asistento atmintyje įrašų nėra — fiksuokite sprendimus, klientų ypatumus ir mokymų temas, kad valdymo komanda galėtų nuosekliai tobulėti.';

  const priemones = expenses
    .filter((e) => e.category === 'priemonės')
    .reduce((s, e) => s + e.amount, 0);
  const kuras = expenses.filter((e) => e.category === 'kuras').reduce((s, e) => s + e.amount, 0);
  const marketText = `Išlaidų signalai: priemonės ${priemones.toFixed(0)} €, kuras ${kuras.toFixed(0)} € (iš viso ${expenses.length} įrašų). Planuokite sezono pasiūlymus ir naujų užsakymų paiešką (reklama, partneriai, B2B). Įrangai: peržiūrėkite ar priedai atitinka augantį užsakymų kiekį (${orders.length} užsakymų sistemoje).`;

  const now = new Date();
  const sixtyDaysAgo = new Date(now.getTime() - 60 * 24 * 60 * 60 * 1000);
  const neglected = clients
    .filter((c) => {
      const lastOrder = orders
        .filter((o) => o.clientId === c.id)
        .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())[0];
      return !lastOrder || new Date(lastOrder.date) < sixtyDaysAgo;
    })
    .slice(0, 3);
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
  expenses: Expense[]
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
    {} as Record<string, number>
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
    neglectedClients.map((c) => ({ vardas: c.name, telefonas: c.phone, adresas: c.address }))
  )}
Didžiausi klientai pagal apyvartą: ${JSON.stringify(
    topSpenders.map(([id, sum]) => {
      const client = clients.find((c) => c.id === id);
      return { vardas: client?.name, sumaEur: sum, telefonas: client?.phone };
    })
  )}
Paskutiniai užsakymai: ${JSON.stringify(
    orders.slice(0, 18).map((o) => ({
      data: o.date,
      kaina: o.totalPrice,
      statusas: o.status,
      adresas: o.address,
    }))
  )}
Klientų imtis: ${JSON.stringify(
    clients.slice(0, 25).map((c) => ({
      vardas: c.name,
      adresas: c.address,
      telefonas: c.phone,
    }))
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
  expenses: Expense[] = []
): Promise<DashboardInsight[]> {
  const requestKey = `${orders.length}|${clients.length}|${memories.length}|${expenses.length}`;
  if (inFlightInsightsPromise && inFlightInsightsKey === requestKey) {
    return inFlightInsightsPromise;
  }

  const run = async (): Promise<DashboardInsight[]> => {
    const apiKey =
      localStorage.getItem('custom_api_key') ||
      (
        window as typeof window & { aistudio?: { getApiKey?: () => string } }
      ).aistudio?.getApiKey?.() ||
      getGeminiKeyFromEnv() ||
      '';

    const prompt = buildBusinessInsightsPrompt(orders, clients, memories, expenses);
    const fallback = buildDashboardInsightsFallback(orders, clients, memories, expenses);
    const geminiKey = getGeminiApiKeyForSdk();

    if (!apiKey && !geminiKey) {
      lastInsightsSource = 'fallback';
      return fallback;
    }

    const runOpenRouterInsights = async (): Promise<DashboardInsight[] | null> => {
      if (isCooldownActive(openRouterInsightsCooldownUntil)) {
        return null;
      }
      if (!consumeAiBudget(1)) {
        return null;
      }
      try {
        const result = await callOpenRouter('free-auto', [{ role: 'user', content: prompt }]);
        if (!result || !result.choices || !result.choices[0]) {
          return null;
        }
        const text = result.choices[0].message?.content || '';
        if (!text) return null;

        const normalized = normalizeLikelyJsonFromChatModel(text);
        const jsonSlice = normalized.startsWith('{')
          ? normalized
          : (normalized.match(/\{[\s\S]*\}/)?.[0] ?? text.match(/\{[\s\S]*\}/)?.[0]);
        if (!jsonSlice) return null;

        try {
          return parseDashboardInsightsPayload(JSON.parse(jsonSlice));
        } catch {
          console.warn('Insights: nepavyko išanalizuoti OpenRouter JSON, bandoma kita paslauga');
          return null;
        }
      } catch (e: unknown) {
        if (isRateLimitOrQuotaError(e)) {
          openRouterInsightsCooldownUntil = Date.now() + extractRetryDelayMs(e);
        }
        console.warn('OpenRouter insights:', e);
        return null;
      }
    };

    const runGeminiInsights = async (): Promise<DashboardInsight[] | null> => {
      if (!geminiKey) return null;
      if (isCooldownActive(geminiInsightsCooldownUntil)) {
        return null;
      }
      if (!consumeAiBudget(1)) {
        return null;
      }
      try {
        const ai = getAiInstance(geminiKey);
        const response = await ai.models.generateContent({
          model: 'gemini-2.5-flash',
          contents: prompt,
          config: { responseMimeType: 'application/json' },
        });
        const text = response.text;
        if (!text) return null;

        try {
          return parseDashboardInsightsPayload(JSON.parse(text));
        } catch {
          console.warn('Insights: nepavyko išanalizuoti Gemini JSON');
          return null;
        }
      } catch (error) {
        if (isRateLimitOrQuotaError(error)) {
          geminiInsightsCooldownUntil = Date.now() + extractRetryDelayMs(error);
          return null;
        }
        // Keep dev console clean for expected provider failures.
        return null;
      }
    };

    /** Pirmiau Gemini — išvengiama OpenRouter „free“ dienos ribos kiekvienam dashboard atnaujinimui. */
    const fromGeminiFirst = await runGeminiInsights();
    if (fromGeminiFirst) {
      lastInsightsSource = 'ai';
      return fromGeminiFirst;
    }

    if (apiKey && isOpenRouterKey(apiKey)) {
      const fromOr = await runOpenRouterInsights();
      if (fromOr) {
        lastInsightsSource = 'ai';
        return fromOr;
      }
    }

    lastInsightsSource = 'fallback';
    return fallback;
  };

  inFlightInsightsKey = requestKey;
  inFlightInsightsPromise = run();
  try {
    return await inFlightInsightsPromise;
  } finally {
    if (inFlightInsightsKey === requestKey) {
      inFlightInsightsPromise = null;
      inFlightInsightsKey = '';
    }
  }
}
