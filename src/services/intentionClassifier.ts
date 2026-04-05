/**
 * Intention Classifier for AI Assistant
 *
 * This module provides deterministic intention classification
 * to improve stability of tool usage and reduce AI hallucinations.
 */

export type Intention =
  // Client management
  | 'add_client'
  | 'update_client'
  | 'delete_client'
  | 'client_info'

  // Order management
  | 'add_order'
  | 'update_order'
  | 'delete_order'
  | 'order_info'

  // Expense management
  | 'add_expense'
  | 'update_expense'
  | 'delete_expense'
  | 'expense_info'

  // Memory operations
  | 'add_memory'
  | 'update_memory'
  | 'delete_memory'
  | 'memory_info'

  // Proactive alerts
  | 'neglected_clients'
  | 'unpaid_orders'
  | 'low_inventory'

  // Business analytics
  | 'business_summary'
  | 'top_clients'
  | 'revenue_trends'

  // Workflow automation
  | 'create_recurring_order'
  | 'generate_reminder'
  | 'batch_update_status'

  // General queries
  | 'general_query'
  | 'dashboard_insights';

export interface IntentionMatch {
  intention: Intention;
  confidence: number;
  params?: Record<string, unknown>;
}

/**
 * Keywords map for intention classification
 */
const KEYWORD_MAP: Record<Intention, RegExp[]> = {
  // Client management
  add_client: [/pridėti\s+klient/i, /naujas\s+klient/i, /sukurti\s+klient/i, /add\s+client/i],
  update_client: [
    /atnaujinti\s+klient/i,
    /pakeisti\s+klient/i,
    /update\s+client/i,
    /kliento\s+duomenis/i,
  ],
  delete_client: [/ištrinti\s+klient/i, /pašalinti\s+klient/i, /delete\s+client/i],
  client_info: [/kliento\s+informacij/i, /apie\s+klient/i, /client\s+info/i, /kas\s+yra\s+klient/i],

  // Order management
  add_order: [/naujas\s+užsakym/i, /sukurti\s+užsakym/i, /pridėti\s+užsakym/i, /add\s+order/i],
  update_order: [
    /atnaujinti\s+užsakym/i,
    /pakeisti\s+užsakym/i,
    /update\s+order/i,
    /užsakymo\s+būsen/i,
  ],
  delete_order: [/ištrinti\s+užsakym/i, /pašalinti\s+užsakym/i, /delete\s+order/i],
  order_info: [
    /užsakymo\s+informacij/i,
    /apie\s+užsakym/i,
    /order\s+info/i,
    /kas\s+yra\s+užsakym/i,
  ],

  // Expense management
  add_expense: [/nauja\s+išlaid/i, /pridėti\s+išlaid/i, /sukurti\s+išlaid/i, /add\s+expense/i],
  update_expense: [/atnaujinti\s+išlaid/i, /pakeisti\s+išlaid/i, /update\s+expense/i],
  delete_expense: [/ištrinti\s+išlaid/i, /pašalinti\s+išlaid/i, /delete\s+expense/i],
  expense_info: [/išlaid\s+informacij/i, /apie\s+išlaid/i, /expense\s+info/i],

  // Memory operations
  add_memory: [
    /įsiminti/i,
    /prisiminti/i,
    /saugoti\s+atminty/i,
    /add\s+memory/i,
    /ilgalaikė\s+atmint/i,
  ],
  update_memory: [/atnaujinti\s+atmint/i, /pakeisti\s+atmint/i, /update\s+memory/i],
  delete_memory: [/ištrinti\s+atmint/i, /pašalinti\s+atmint/i, /delete\s+memory/i],
  memory_info: [/atminties\s+informacij/i, /kas\s+įsimint/i, /memory\s+info/i],

  // Proactive alerts
  neglected_clients: [/neaplanky/i, /pamest/i, /seniai\s+nelankyt/i, /užmiršt/i, /neglected/i],
  unpaid_orders: [/neapmokėt/i, /skola/i, /mokėjim/i, /unpaid/i, /neatsiskaityt/i],
  low_inventory: [/trūksta\s+inventoria/i, /mažai\s+priemon/i, /low\s+inventory/i],

  // Business analytics
  business_summary: [
    /verslo\s+suvestin/i,
    /bendras\s+vaizd/i,
    /pajam.*išlaid/i,
    /business\s+summary/i,
    /pelno\s+analiz/i,
  ],
  top_clients: [/geriausi\s+klient/i, /pelningiausi/i, /top\s+clients/i, /dažniausiai\s+užsakant/i],
  revenue_trends: [/pajamų\s+tendencij/i, /augim/i, /revenue\s+trends/i, /pajam\s+analiz/i],

  // Workflow automation
  create_recurring_order: [
    /kartotinį\s+užsakym/i,
    /pasikartojant/i,
    /automatinis\s+užsakym/i,
    /recurring\s+order/i,
  ],
  generate_reminder: [/priminim/i, /sms/i, /žinutė\s+klient/i, /reminder/i],
  batch_update_status: [/masinis\s+atnaujinim/i, /visų\s+užsakymų/i, /batch\s+update/i],

  // General queries
  general_query: [/koks\s+yra/i, /kas\s+yra/i, /kaip\s+veiki/i, /paaiškink/i, /explain/i],
  dashboard_insights: [/dashboard/i, /įžvalgos/i, /strategij/i, /plan/i, /rekomendacij/i],
};

/**
 * Classifies user input into specific intentions
 * @param input User's message or query
 * @returns IntentionMatch with intention, confidence and optional parameters
 */
export function classifyIntention(input: string): IntentionMatch {
  const inputLower = input.toLowerCase();
  let bestMatch: IntentionMatch = {
    intention: 'general_query',
    confidence: 0.3,
  };

  // Check each intention's keywords
  for (const [intention, patterns] of Object.entries(KEYWORD_MAP)) {
    for (const pattern of patterns) {
      const match = inputLower.match(pattern);
      if (match) {
        // Calculate confidence based on match position and specificity
        const confidence = calculateConfidence(inputLower, pattern, match);

        if (confidence > bestMatch.confidence) {
          bestMatch = {
            intention: intention as Intention,
            confidence,
            params: extractParams(input, intention as Intention),
          };
        }
      }
    }
  }

  return bestMatch;
}

/**
 * Calculate confidence score for a match
 */
function calculateConfidence(input: string, pattern: RegExp, match: RegExpMatchArray): number {
  let confidence = 0.7; // Base confidence for pattern match

  // Boost confidence if match is at the beginning of input
  if (match.index === 0) {
    confidence += 0.2;
  }

  // Boost confidence for longer matches (more specific keywords)
  if (match[0].length > 5) {
    confidence += 0.1;
  }

  // Additional boost for action verbs
  const actionVerbs = ['pridėti', 'atnaujinti', 'ištrinti', 'sukurti', 'sužinoti', 'rodyti'];
  for (const verb of actionVerbs) {
    if (input.includes(verb)) {
      confidence += 0.1;
      break;
    }
  }

  return Math.min(confidence, 1.0); // Cap at 1.0
}

/**
 * Extract parameters from the input based on intention
 */
function extractParams(input: string, intention: Intention): Record<string, unknown> {
  const params: Record<string, unknown> = {};

  // Extract common parameters
  const numbers = input.match(/\d+/g)?.map(Number) || [];

  switch (intention) {
    case 'business_summary':
      if (input.includes('savait') || input.includes('week')) {
        params.period = 'week';
      } else if (input.includes('mėn') || input.includes('month')) {
        params.period = 'month';
      } else if (input.includes('meta') || input.includes('year')) {
        params.period = 'year';
      }
      break;

    case 'top_clients':
      if (numbers.length > 0) {
        params.limit = numbers[0];
      }
      if (input.includes('užsakym') || input.includes('orders')) {
        params.by = 'orders';
      } else if (input.includes('pajam') || input.includes('revenue')) {
        params.by = 'revenue';
      }
      break;

    case 'revenue_trends':
      if (numbers.length > 0) {
        params.months = numbers[0];
      }
      break;

    case 'neglected_clients':
      if (numbers.length > 0) {
        params.days = numbers[0];
      }
      break;

    case 'create_recurring_order':
      if (numbers.length > 0) {
        params.intervalMonths = numbers[0];
      }
      break;
  }

  return params;
}

/**
 * Check if intention requires tool execution
 */
export function requiresToolExecution(intention: Intention): boolean {
  const nonToolIntentions: Intention[] = [
    'general_query',
    'client_info',
    'order_info',
    'expense_info',
    'memory_info',
  ];

  return !nonToolIntentions.includes(intention);
}

/**
 * Get default tool name for intention
 */
export function getToolNameForIntention(intention: Intention): string | null {
  const toolMap: Partial<Record<Intention, string>> = {
    add_client: 'add_client',
    update_client: 'update_client',
    delete_client: 'delete_client',
    add_order: 'add_order',
    update_order: 'update_order',
    delete_order: 'delete_order',
    add_expense: 'add_expense',
    update_expense: 'update_expense',
    delete_expense: 'delete_expense',
    add_memory: 'add_memory',
    update_memory: 'update_memory',
    delete_memory: 'delete_memory',
    neglected_clients: 'get_neglected_clients',
    unpaid_orders: 'get_unpaid_orders',
    low_inventory: 'get_low_inventory',
    business_summary: 'get_business_summary',
    top_clients: 'get_top_clients',
    revenue_trends: 'get_revenue_trends',
    create_recurring_order: 'create_recurring_order',
    generate_reminder: 'generate_reminder_message',
    batch_update_status: 'batch_update_order_status',
  };

  return toolMap[intention] || null;
}
