/** Išsaugota Gemini / OpenRouter istorija (localStorage). */
export type ChatHistoryMessage = {
  role?: string;
  parts?: Array<{
    text?: string;
    functionCall?: { name?: string; args?: unknown; id?: string };
    functionResponse?: unknown;
  }>;
};

export type AssistantToolCall = {
  name: string;
  args?: unknown;
  id?: string;
};

export interface Message {
  role: 'user' | 'model';
  text: string;
  timestamp?: number;
  failed?: boolean;
}

export interface LocalUser {
  uid: string;
  email: string | null;
  displayName: string | null;
}

export const CRM_TAB_LABEL_LT: Record<string, string> = {
  dashboard: 'Apžvalga',
  orders: 'Užsakymai',
  calendar: 'Kalendorius',
  clients: 'Klientai',
  expenses: 'Išlaidos',
  payments: 'Mokėjimai',
  settings: 'Nustatymai',
  analytics: 'Analitika',
  logistics: 'Logistika',
  team: 'Komanda',
  inventory: 'Atsargos',
};

export function chatPanelOpenKey(uid: string) {
  return `chat_assistant_open_${uid}`;
}

export function chatPanelMessagesKey(uid: string) {
  return `chat_assistant_messages_${uid}`;
}
