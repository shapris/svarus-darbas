import type { Client } from '../../types';
import type { ChatHistoryMessage } from './types';

export function sanitizeHistoryForGemini(hist: ChatHistoryMessage[]) {
  return (hist || [])
    .map((h) => {
      const role = h?.role === 'user' ? 'user' : 'model';
      const text = String(h?.parts?.[0]?.text ?? '').trim();
      if (!text) return null;
      return { role, parts: [{ text }] };
    })
    .filter(Boolean);
}

export function detectMemoryCategory(
  query: string,
  response: string
): 'klientas' | 'verslas' | 'procesas' | 'kita' {
  const combined = (query + ' ' + response).toLowerCase();
  if (
    combined.includes('klient') ||
    combined.includes('adres') ||
    combined.includes('telefon') ||
    combined.includes('kontakt')
  ) {
    return 'klientas';
  }
  if (
    combined.includes('kain') ||
    combined.includes('pajam') ||
    combined.includes('išlaid') ||
    combined.includes('peln') ||
    combined.includes('versl')
  ) {
    return 'verslas';
  }
  if (
    combined.includes('proces') ||
    combined.includes('taisykl') ||
    combined.includes('veiksm') ||
    combined.includes(' žingsnis')
  ) {
    return 'procesas';
  }
  return 'kita';
}

export function detectOrderInConversation(
  query: string,
  response: string,
  clients: Client[]
): {
  shouldCreate: boolean;
  clientId?: string;
  date?: string;
  time?: string;
  windowCount?: number;
} {
  const combined = (query + ' ' + response).toLowerCase();
  const orderKeywords = [
    'užsakymas',
    'langai',
    'valymas',
    'atlikti',
    'darbas',
    'tvarkyti',
    'grafikas',
    'suplanuoti',
    'prie',
    'ryt',
    'poryt',
    'sekmadien',
    'šeštadien',
    'penktadien',
  ];
  const hasOrderKeyword = orderKeywords.some((kw) => combined.includes(kw));
  const hasDate =
    combined.includes('ryt') ||
    combined.includes('poryt') ||
    combined.includes('sekmadien') ||
    combined.includes('šeštadien') ||
    combined.includes('penktadien') ||
    /\d{4}-\d{2}-\d{2}/.test(combined);

  if (!hasOrderKeyword || !clients.length) {
    return { shouldCreate: false };
  }

  let clientId: string | undefined;
  for (const client of clients) {
    if (
      combined.includes(client.name.toLowerCase()) ||
      combined.includes(client.address.toLowerCase())
    ) {
      clientId = client.id;
      break;
    }
  }

  let date: string | undefined;
  const today = new Date();
  if (combined.includes('ryt')) {
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);
    date = tomorrow.toISOString().split('T')[0];
  } else if (combined.includes('poryt')) {
    const dayAfter = new Date(today);
    dayAfter.setDate(dayAfter.getDate() + 2);
    date = dayAfter.toISOString().split('T')[0];
  } else if (combined.includes('sekmadien')) {
    const nextSun = new Date(today);
    nextSun.setDate(today.getDate() + (7 - today.getDay()));
    date = nextSun.toISOString().split('T')[0];
  }

  let time: string | undefined;
  const timeMatch = combined.match(/(\d{1,2}):(\d{2})/);
  if (timeMatch) {
    time = timeMatch[0];
  }

  let windowCount: number | undefined;
  const windowMatch = combined.match(/(\d+)\s*(lang|langų|langus)/i);
  if (windowMatch) {
    windowCount = parseInt(windowMatch[1], 10);
  }

  return {
    shouldCreate: hasOrderKeyword && hasDate && !!clientId,
    clientId,
    date,
    time,
    windowCount,
  };
}
