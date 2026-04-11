import type { Client, Order } from '../types';

/** Vienodas adresų palyginimui (tuščios eilutės, didžiosios raidės, tarpai). */
export function normalizeAddressForMatch(raw: string): string {
  return raw
    .trim()
    .toLowerCase()
    .replace(/\s+/g, ' ')
    .replace(/[.,;]+$/g, '');
}

/**
 * Kliento vardas sąraše / kalendoriuje: pirmiausia užsakyme įrašytas vardas,
 * tada — pagal `clientId` iš klientų lentelės.
 *
 * Jei `client_name` DB tuščias ir `client_id` nebeatitinka jokios matomos kortelės
 * (pvz. po sujungimo, viešas užsakymas, senas ID), bet užsakyme likęs **adresas**
 * sutampa su **viena** kliento kortele arba keliomis su **tuo pačiu** vardu —
 * rodomas tas vardas. Tai sumažina „Klientas nenurodytas“, kai adresas aiškus.
 */
export function resolveOrderClientNameDisplay(order: Order, clients: Client[]): string {
  const fromOrder = (order.clientName ?? '').trim();
  if (fromOrder) return fromOrder;

  const byId = clients.find((c) => c.id === order.clientId);
  if (byId?.name?.trim()) return byId.name.trim();

  const addr = (order.address ?? '').trim();
  if (!addr) return '';

  const key = normalizeAddressForMatch(addr);
  if (!key) return '';

  const addressMatches = clients.filter((c) => normalizeAddressForMatch(c.address ?? '') === key);

  if (addressMatches.length === 0) return '';

  const names = addressMatches.map((c) => c.name?.trim()).filter((n): n is string => Boolean(n));
  if (names.length === 0) return '';

  const uniqueNames = [...new Set(names)];
  if (uniqueNames.length === 1) return uniqueNames[0]!;

  // Kelios kortelės tame pačiame adrese su skirtingais vardais — ne spėliojame.
  return '';
}

/**
 * Kliento įrašas UI (tel. ir pan.): pagal `clientId`, o jei nerasta — vienintelė
 * kortelė su tuo pačiu adresu kaip užsakyme (kai `client_id` pasenęs).
 */
export function resolveClientRecordForOrder(order: Order, clients: Client[]): Client | undefined {
  const byId = clients.find((c) => c.id === order.clientId);
  if (byId) return byId;

  const key = normalizeAddressForMatch(order.address ?? '');
  if (!key) return undefined;

  const matches = clients.filter((c) => normalizeAddressForMatch(c.address ?? '') === key);
  if (matches.length === 1) return matches[0];
  const names = matches.map((c) => c.name?.trim()).filter(Boolean);
  const unique = [...new Set(names)];
  if (matches.length > 1 && unique.length === 1) {
    return matches.find((c) => (c.name ?? '').trim() === unique[0]);
  }
  return undefined;
}
