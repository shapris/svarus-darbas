// Hybrid Classifier - simplified version for testing
export type ExtendedIntention =
  | 'business_summary'
  | 'business_forecast'
  | 'revenue_analysis'
  | 'expense_analysis'
  | 'profit_margin'
  | 'seasonal_analysis'
  | 'growth_trends'
  | 'neglected_clients'
  | 'client_history'
  | 'client_preferences'
  | 'client_segments'
  | 'vip_clients'
  | 'new_clients'
  | 'inactive_clients'
  | 'unpaid_orders'
  | 'pending_orders'
  | 'completed_orders'
  | 'order_details'
  | 'order_statistics'
  | 'recurring_orders'
  | 'batch_operations'
  | 'payment_status'
  | 'debt_analysis'
  | 'invoice_management'
  | 'profit_calculation'
  | 'cost_breakdown'
  | 'cleaning_schedule'
  | 'service_pricing'
  | 'equipment_inventory'
  | 'safety_protocols'
  | 'quality_standards'
  | 'seasonal_services'
  | 'send_reminder'
  | 'generate_sms'
  | 'client_followup'
  | 'review_requests'
  | 'ai_explain'
  | 'ai_suggest'
  | 'ai_review'
  | 'ai_optimize'
  | 'ai_plan'
  | 'greeting'
  | 'farewell'
  | 'help_request'
  | 'status_check'
  | 'general_chat';

export interface ClassificationResult {
  intention: ExtendedIntention;
  confidence: number;
  method: 'keyword' | 'llm' | 'hybrid';
  shouldExecuteTool: boolean;
  toolName: string | null;
  parameters: Record<string, unknown>;
  fallbackReason?: string;
  alternatives: Array<{
    intention: ExtendedIntention;
    confidence: number;
  }>;
}

export const HYBRID_CLASSIFIER_CONFIG = {
  keywordConfidenceThreshold: 0.85,
  llmConfidenceThreshold: 0.7,
  enableLLMFallback: true,
  cacheLLMResults: true,
  cacheTimeoutMs: 300000,
};

// Simple classifier for testing
export async function classifyIntentHybrid(
  text: string,
  _apiKey?: string,
  _config?: unknown
): Promise<ClassificationResult> {
  const textLower = text.toLowerCase();

  // === CLIENT MANAGEMENT ===
  if (/prid/i.test(textLower) && /klient/i.test(textLower)) {
    return {
      intention: 'new_clients',
      confidence: 0.9,
      method: 'keyword',
      shouldExecuteTool: true,
      toolName: 'add_client',
      parameters: {},
      alternatives: [],
    };
  }

  if (/neaktyv.*klient|pamest.*klient|seniai.*(ne)?(lankyt|aplankyt)/i.test(textLower)) {
    return {
      intention: 'neglected_clients',
      confidence: 0.92,
      method: 'keyword',
      shouldExecuteTool: true,
      toolName: 'get_neglected_clients',
      parameters: {},
      alternatives: [],
    };
  }

  if (/top.*klient|geriausi.*klient|vip.*klient/i.test(textLower)) {
    return {
      intention: 'vip_clients',
      confidence: 0.9,
      method: 'keyword',
      shouldExecuteTool: true,
      toolName: 'get_top_clients',
      parameters: { limit: 5, by: 'revenue' },
      alternatives: [],
    };
  }

  // === BUSINESS ANALYTICS ===
  if (/verslo.*suvestin|pelnas|pajam.*išlaid/i.test(textLower)) {
    return {
      intention: 'business_summary',
      confidence: 0.9,
      method: 'keyword',
      shouldExecuteTool: true,
      toolName: 'get_business_summary',
      parameters: {},
      alternatives: [],
    };
  }

  // === ORDER MANAGEMENT ===
  if (/neapmokėt.*užsakym|skol/i.test(textLower)) {
    return {
      intention: 'unpaid_orders',
      confidence: 0.95,
      method: 'keyword',
      shouldExecuteTool: true,
      toolName: 'get_unpaid_orders',
      parameters: {},
      alternatives: [],
    };
  }

  // === COMMUNICATION ===
  if (/sms|priminim|žinut/i.test(textLower)) {
    return {
      intention: 'generate_sms',
      confidence: 0.85,
      method: 'keyword',
      shouldExecuteTool: true,
      toolName: 'generate_reminder_message',
      parameters: {},
      alternatives: [],
    };
  }

  // === SAFETY ===
  if (/saugos|safety/i.test(textLower)) {
    return {
      intention: 'safety_protocols',
      confidence: 0.9,
      method: 'keyword',
      shouldExecuteTool: false,
      toolName: null,
      parameters: {},
      alternatives: [],
    };
  }

  // === HELP ===
  if (/pagalbos|ką.*gali|help/i.test(textLower)) {
    return {
      intention: 'help_request',
      confidence: 0.85,
      method: 'keyword',
      shouldExecuteTool: false,
      toolName: null,
      parameters: {},
      alternatives: [],
    };
  }

  // === AI EXPLANATION ===
  if (/paaišk|kaip.*veiki|system/i.test(textLower)) {
    return {
      intention: 'ai_explain',
      confidence: 0.85,
      method: 'keyword',
      shouldExecuteTool: false,
      toolName: null,
      parameters: {},
      alternatives: [],
    };
  }

  // === GREETING ===
  if (/labas|sveikas|hi|hello/i.test(textLower)) {
    return {
      intention: 'greeting',
      confidence: 0.95,
      method: 'keyword',
      shouldExecuteTool: false,
      toolName: null,
      parameters: {},
      alternatives: [],
    };
  }

  // Default
  return {
    intention: 'general_chat',
    confidence: 0.5,
    method: 'hybrid',
    shouldExecuteTool: false,
    toolName: null,
    parameters: {},
    fallbackReason: 'No clear keyword match',
    alternatives: [],
  };
}

export function shouldUseDeterministicRouting(classification: ClassificationResult): boolean {
  return (
    classification.method === 'keyword' &&
    classification.confidence >= HYBRID_CLASSIFIER_CONFIG.keywordConfidenceThreshold &&
    classification.shouldExecuteTool
  );
}

export function getIntentDescription(intention: ExtendedIntention): string {
  const descriptions: Record<string, string> = {
    business_summary: 'Verslo suvestinė',
    neglected_clients: 'Neaktyvūs klientai',
    unpaid_orders: 'Neapmokėti užsakymai',
    vip_clients: 'VIP klientai',
    greeting: 'Sveikinimas',
    general_chat: 'Bendras pokalbis',
    // Add more as needed
  };
  return descriptions[intention] || intention;
}
