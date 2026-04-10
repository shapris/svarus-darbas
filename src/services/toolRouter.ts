/**
 * Tool Router for AI Assistant
 *
 * This module routes user intentions to specific tool executions
 * deterministically, reducing AI hallucinations and improving stability.
 *
 * Enhanced with Hybrid Intention Classifier for better accuracy.
 */

import {
  classifyIntention,
  requiresToolExecution,
  getToolNameForIntention,
  Intention,
} from './intentionClassifier';
import {
  classifyIntentHybrid,
  shouldUseDeterministicRouting,
  ExtendedIntention,
} from './hybridClassifier';
import { prioritizeMemories, formatMemoriesForContext, MemoryContext } from './memoryPriority';
import { addData, deleteData, getData, TABLES, updateData } from '../supabase';
import type { BuildingType, Client, Expense, InventoryItem, Memory, Order } from '../types';
import { DEFAULT_SETTINGS } from '../types';
import { calculateOrderPrice } from '../utils';

// Types for context and execution
export interface ToolExecutionResult {
  success: boolean;
  data?: unknown;
  error?: string;
  toolName: string;
  intention: Intention | ExtendedIntention;
  confidence: number;
  method?: 'keyword' | 'llm' | 'hybrid';
}

export interface RoutingContext {
  clients?: Client[];
  orders?: Order[];
  expenses?: Expense[];
  memories?: Memory[];
  userId?: string;
  /** Workspace savininkas — jei perduota, galima užkrauti inventorių be iš anksto paruošto masyvo */
  dataOwnerId?: string;
  inventory?: InventoryItem[];
}

function routingDataOwnerId(context: RoutingContext): string | null {
  const o = context.dataOwnerId?.trim() || context.userId?.trim();
  return o || null;
}

/** Tikri CRM įrašai (planavimo variklis, hybrid router) — anksčiau buvo tuščias „success“. */
async function crudAddClient(
  params: Record<string, unknown>,
  context: RoutingContext
): Promise<ToolExecutionResult> {
  const owner = routingDataOwnerId(context);
  if (!owner) {
    return {
      success: false,
      error: 'Trūksta workspace (dataOwnerId / userId) — negalima pridėti kliento.',
      toolName: 'add_client',
      intention: 'add_client',
      confidence: 0,
    };
  }
  try {
    const name = String(params.name ?? 'Naujas klientas');
    const inserted = await addData(TABLES.CLIENTS, owner, {
      name,
      phone: String(params.phone ?? 'nesutarta'),
      address: String(params.address ?? 'nesutarta'),
      buildingType: ((params.buildingType as BuildingType) || 'nesutarta') as BuildingType,
      notes: String(params.notes ?? ''),
      createdAt: new Date().toISOString(),
    });
    const id = (inserted as { id?: string }).id ?? '';
    return {
      success: true,
      data: { clientId: id, id, message: `Klientas „${name}“ pridėtas.` },
      toolName: 'add_client',
      intention: 'add_client',
      confidence: 1.0,
    };
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : String(e);
    return {
      success: false,
      error: msg,
      toolName: 'add_client',
      intention: 'add_client',
      confidence: 0,
    };
  }
}

async function crudUpdateClient(
  params: Record<string, unknown>,
  _context: RoutingContext
): Promise<ToolExecutionResult> {
  const clientId = typeof params.clientId === 'string' ? params.clientId : '';
  if (!clientId) {
    return {
      success: false,
      error: 'Trūksta clientId.',
      toolName: 'update_client',
      intention: 'update_client',
      confidence: 0,
    };
  }
  try {
    const { clientId: _c, ...updates } = params;
    await updateData(TABLES.CLIENTS, clientId, updates as Partial<Client>);
    return {
      success: true,
      data: { clientId, message: 'Klientas atnaujintas.' },
      toolName: 'update_client',
      intention: 'update_client',
      confidence: 1.0,
    };
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : String(e);
    return {
      success: false,
      error: msg,
      toolName: 'update_client',
      intention: 'update_client',
      confidence: 0,
    };
  }
}

async function crudDeleteClient(
  params: Record<string, unknown>,
  _context: RoutingContext
): Promise<ToolExecutionResult> {
  const clientId = typeof params.clientId === 'string' ? params.clientId : '';
  if (!clientId) {
    return {
      success: false,
      error: 'Trūksta clientId.',
      toolName: 'delete_client',
      intention: 'delete_client',
      confidence: 0,
    };
  }
  try {
    await deleteData(TABLES.CLIENTS, clientId);
    return {
      success: true,
      data: { clientId, message: 'Klientas pašalintas.' },
      toolName: 'delete_client',
      intention: 'delete_client',
      confidence: 1.0,
    };
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : String(e);
    return {
      success: false,
      error: msg,
      toolName: 'delete_client',
      intention: 'delete_client',
      confidence: 0,
    };
  }
}

async function crudAddOrder(
  params: Record<string, unknown>,
  context: RoutingContext
): Promise<ToolExecutionResult> {
  const owner = routingDataOwnerId(context);
  if (!owner) {
    return {
      success: false,
      error: 'Trūksta workspace (dataOwnerId / userId).',
      toolName: 'add_order',
      intention: 'add_order',
      confidence: 0,
    };
  }
  const clients = context.clients ?? [];
  const clientName = String(params.clientName ?? '');
  const client = clients.find((c) =>
    (c.name || '').toLowerCase().includes(clientName.toLowerCase())
  );
  if (!client) {
    return {
      success: false,
      error: `Klientas pagal „${clientName}“ nerastas kontekste — pirmiausia pridėkite klientą arba naudokite tikslų vardą.`,
      toolName: 'add_order',
      intention: 'add_order',
      confidence: 0,
    };
  }
  try {
    const additionalServices = {
      balkonai: Boolean(
        params.additionalServices && (params.additionalServices as Record<string, boolean>).balkonai
      ),
      vitrinos: Boolean(
        params.additionalServices && (params.additionalServices as Record<string, boolean>).vitrinos
      ),
      terasa: Boolean(
        params.additionalServices && (params.additionalServices as Record<string, boolean>).terasa
      ),
      kiti: Boolean(
        params.additionalServices && (params.additionalServices as Record<string, boolean>).kiti
      ),
    };
    const wc = Number(params.windowCount) || 0;
    const fl = Number(params.floor) || 0;
    const totalPrice = calculateOrderPrice(wc, fl, additionalServices, DEFAULT_SETTINGS);
    const inserted = await addData(TABLES.ORDERS, owner, {
      clientId: client.id,
      clientName: client.name,
      address: String(params.address ?? client.address ?? 'nesutarta'),
      date: String(params.date ?? 'nesutarta'),
      time: String(params.time ?? 'nesutarta'),
      windowCount: wc,
      floor: fl,
      estimatedDuration: Number(params.estimatedDuration) || 0,
      additionalServices,
      totalPrice,
      status: 'suplanuota',
      notes: String(params.notes ?? ''),
      createdAt: new Date().toISOString(),
    });
    const orderId = (inserted as { id?: string }).id ?? '';
    return {
      success: true,
      data: { orderId, id: orderId, clientId: client.id, message: 'Užsakymas sukurtas.' },
      toolName: 'add_order',
      intention: 'add_order',
      confidence: 1.0,
    };
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : String(e);
    return {
      success: false,
      error: msg,
      toolName: 'add_order',
      intention: 'add_order',
      confidence: 0,
    };
  }
}

async function crudUpdateOrder(
  params: Record<string, unknown>,
  context: RoutingContext
): Promise<ToolExecutionResult> {
  const orderId = typeof params.orderId === 'string' ? params.orderId : '';
  if (!orderId) {
    return {
      success: false,
      error: 'Trūksta orderId.',
      toolName: 'update_order',
      intention: 'update_order',
      confidence: 0,
    };
  }
  const orders = context.orders ?? [];
  const existing = orders.find((o) => o.id === orderId);
  try {
    const { orderId: _o, ...updates } = params;
    const partial = { ...updates } as Partial<Order>;
    if (
      existing &&
      (partial.windowCount !== undefined ||
        partial.floor !== undefined ||
        partial.additionalServices !== undefined)
    ) {
      const newWindowCount = partial.windowCount ?? existing.windowCount;
      const newFloor = partial.floor ?? existing.floor;
      const newServices = {
        ...existing.additionalServices,
        ...(partial.additionalServices || {}),
      };
      if (partial.totalPrice === undefined) {
        partial.totalPrice = calculateOrderPrice(
          newWindowCount,
          newFloor,
          newServices,
          DEFAULT_SETTINGS
        );
      }
      partial.additionalServices = newServices;
    }
    await updateData(TABLES.ORDERS, orderId, partial);
    return {
      success: true,
      data: { orderId, message: 'Užsakymas atnaujintas.' },
      toolName: 'update_order',
      intention: 'update_order',
      confidence: 1.0,
    };
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : String(e);
    return {
      success: false,
      error: msg,
      toolName: 'update_order',
      intention: 'update_order',
      confidence: 0,
    };
  }
}

async function crudDeleteOrder(
  params: Record<string, unknown>,
  _context: RoutingContext
): Promise<ToolExecutionResult> {
  const orderId = typeof params.orderId === 'string' ? params.orderId : '';
  if (!orderId) {
    return {
      success: false,
      error: 'Trūksta orderId.',
      toolName: 'delete_order',
      intention: 'delete_order',
      confidence: 0,
    };
  }
  try {
    await deleteData(TABLES.ORDERS, orderId);
    return {
      success: true,
      data: { orderId, message: 'Užsakymas pašalintas.' },
      toolName: 'delete_order',
      intention: 'delete_order',
      confidence: 1.0,
    };
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : String(e);
    return {
      success: false,
      error: msg,
      toolName: 'delete_order',
      intention: 'delete_order',
      confidence: 0,
    };
  }
}

async function crudAddExpense(
  params: Record<string, unknown>,
  context: RoutingContext
): Promise<ToolExecutionResult> {
  const owner = routingDataOwnerId(context);
  if (!owner) {
    return {
      success: false,
      error: 'Trūksta workspace (dataOwnerId / userId).',
      toolName: 'add_expense',
      intention: 'add_expense',
      confidence: 0,
    };
  }
  try {
    const inserted = await addData(TABLES.EXPENSES, owner, {
      title: String(params.title ?? 'nesutarta'),
      amount: Number(params.amount) || 0,
      date: String(params.date ?? 'nesutarta'),
      category: (params.category as Expense['category']) || 'kita',
      notes: String(params.notes ?? ''),
      createdAt: new Date().toISOString(),
    });
    const id = (inserted as { id?: string }).id ?? '';
    return {
      success: true,
      data: { expenseId: id, id, message: 'Išlaida įrašyta.' },
      toolName: 'add_expense',
      intention: 'add_expense',
      confidence: 1.0,
    };
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : String(e);
    return {
      success: false,
      error: msg,
      toolName: 'add_expense',
      intention: 'add_expense',
      confidence: 0,
    };
  }
}

async function crudUpdateExpense(
  params: Record<string, unknown>,
  _context: RoutingContext
): Promise<ToolExecutionResult> {
  const expenseId = typeof params.expenseId === 'string' ? params.expenseId : '';
  if (!expenseId) {
    return {
      success: false,
      error: 'Trūksta expenseId.',
      toolName: 'update_expense',
      intention: 'update_expense',
      confidence: 0,
    };
  }
  try {
    const { expenseId: _e, ...updates } = params;
    await updateData(TABLES.EXPENSES, expenseId, updates);
    return {
      success: true,
      data: { expenseId, message: 'Išlaida atnaujinta.' },
      toolName: 'update_expense',
      intention: 'update_expense',
      confidence: 1.0,
    };
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : String(e);
    return {
      success: false,
      error: msg,
      toolName: 'update_expense',
      intention: 'update_expense',
      confidence: 0,
    };
  }
}

async function crudDeleteExpense(
  params: Record<string, unknown>,
  _context: RoutingContext
): Promise<ToolExecutionResult> {
  const expenseId = typeof params.expenseId === 'string' ? params.expenseId : '';
  if (!expenseId) {
    return {
      success: false,
      error: 'Trūksta expenseId.',
      toolName: 'delete_expense',
      intention: 'delete_expense',
      confidence: 0,
    };
  }
  try {
    await deleteData(TABLES.EXPENSES, expenseId);
    return {
      success: true,
      data: { expenseId, message: 'Išlaida pašalinta.' },
      toolName: 'delete_expense',
      intention: 'delete_expense',
      confidence: 1.0,
    };
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : String(e);
    return {
      success: false,
      error: msg,
      toolName: 'delete_expense',
      intention: 'delete_expense',
      confidence: 0,
    };
  }
}

async function crudMemory(
  toolName: 'add_memory' | 'update_memory' | 'delete_memory',
  params: Record<string, unknown>,
  context: RoutingContext
): Promise<ToolExecutionResult> {
  const owner = routingDataOwnerId(context);
  if (!owner) {
    return {
      success: false,
      error: 'Trūksta workspace (dataOwnerId / userId).',
      toolName,
      intention: toolName,
      confidence: 0,
    };
  }
  try {
    if (toolName === 'add_memory') {
      const inserted = await addData('memories', owner, {
        ...params,
        createdAt: new Date().toISOString(),
      });
      const id = (inserted as { id?: string }).id ?? '';
      return {
        success: true,
        data: { memoryId: id, id, message: 'Atmintis įrašyta.' },
        toolName: 'add_memory',
        intention: 'add_memory',
        confidence: 1.0,
      };
    }
    if (toolName === 'update_memory') {
      const memoryId = typeof params.memoryId === 'string' ? params.memoryId : '';
      if (!memoryId) {
        return {
          success: false,
          error: 'Trūksta memoryId.',
          toolName,
          intention: toolName,
          confidence: 0,
        };
      }
      const { memoryId: _m, ...updates } = params;
      await updateData('memories', memoryId, updates);
      return {
        success: true,
        data: { memoryId, message: 'Atmintis atnaujinta.' },
        toolName: 'update_memory',
        intention: 'update_memory',
        confidence: 1.0,
      };
    }
    const memoryId = typeof params.memoryId === 'string' ? params.memoryId : '';
    if (!memoryId) {
      return {
        success: false,
        error: 'Trūksta memoryId.',
        toolName: 'delete_memory',
        intention: 'delete_memory',
        confidence: 0,
      };
    }
    await deleteData('memories', memoryId);
    return {
      success: true,
      data: { memoryId, message: 'Atmintis pašalinta.' },
      toolName: 'delete_memory',
      intention: 'delete_memory',
      confidence: 1.0,
    };
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : String(e);
    return {
      success: false,
      error: msg,
      toolName,
      intention: toolName,
      confidence: 0,
    };
  }
}

async function crudBatchUpdateOrderStatus(
  params: Record<string, unknown>
): Promise<ToolExecutionResult> {
  const raw = params.orderIds;
  const orderIds = Array.isArray(raw)
    ? raw.filter((id): id is string => typeof id === 'string' && id.length > 0)
    : [];
  const status = params.status;
  if (orderIds.length === 0 || typeof status !== 'string') {
    return {
      success: false,
      error: 'Reikia orderIds (string[]) ir status (tekstas).',
      toolName: 'batch_update_order_status',
      intention: 'batch_update_status',
      confidence: 0,
    };
  }
  try {
    await Promise.all(orderIds.map((id) => updateData(TABLES.ORDERS, id, { status })));
    return {
      success: true,
      data: { updated: orderIds.length, status },
      toolName: 'batch_update_order_status',
      intention: 'batch_update_status',
      confidence: 1.0,
    };
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : String(e);
    return {
      success: false,
      error: msg,
      toolName: 'batch_update_order_status',
      intention: 'batch_update_status',
      confidence: 0,
    };
  }
}

/**
 * Main router function that executes tools deterministically
 * Now supports hybrid classification
 */
export async function routeAndExecute(
  userMessage: string,
  context: RoutingContext,
  apiKey?: string
): Promise<ToolExecutionResult> {
  // Try hybrid classification first if API key is available
  if (apiKey) {
    try {
      const hybridResult = await classifyIntentHybrid(userMessage, apiKey);

      if (shouldUseDeterministicRouting(hybridResult) && hybridResult.toolName) {
        const result = await executeToolByName(
          hybridResult.toolName,
          hybridResult.parameters,
          context
        );

        return {
          ...result,
          intention: hybridResult.intention,
          confidence: hybridResult.confidence,
          method: hybridResult.method,
        };
      }
    } catch {
      // Hybrid classification failed, fall back to keyword
    }
  }

  // Fallback to original keyword-based classification
  const intentionMatch = classifyIntention(userMessage);

  // 2. Check if tool execution is needed
  if (!requiresToolExecution(intentionMatch.intention)) {
    return {
      success: true,
      data: null,
      toolName: 'none',
      intention: intentionMatch.intention,
      confidence: intentionMatch.confidence,
      method: 'keyword',
    };
  }

  // 3. Get tool name for intention
  const toolName = getToolNameForIntention(intentionMatch.intention);
  if (!toolName) {
    return {
      success: false,
      error: `No tool found for intention: ${intentionMatch.intention}`,
      toolName: 'unknown',
      intention: intentionMatch.intention,
      confidence: intentionMatch.confidence,
      method: 'keyword',
    };
  }

  // 4. Execute the appropriate tool
  try {
    const result = await executeToolByName(toolName, intentionMatch.params || {}, context);

    return {
      ...result,
      intention: intentionMatch.intention,
      confidence: intentionMatch.confidence,
      method: 'keyword',
    };
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : 'Unknown error during tool execution';
    return {
      success: false,
      error: msg,
      toolName,
      intention: intentionMatch.intention,
      confidence: intentionMatch.confidence,
      method: 'keyword',
    };
  }
}

/**
 * Execute tool by name
 */
async function executeToolByName(
  toolName: string,
  params: Record<string, unknown>,
  context: RoutingContext
): Promise<ToolExecutionResult> {
  // This is a simplified implementation
  // In reality, you would call the actual API/database operations

  switch (toolName) {
    // Proactive alerts
    case 'get_neglected_clients':
      return await executeGetNeglectedClients(params, context);

    case 'get_unpaid_orders':
      return await executeGetUnpaidOrders(params, context);

    case 'get_low_inventory':
      return await executeGetLowInventory(params, context);

    // Business analytics
    case 'get_business_summary':
      return await executeGetBusinessSummary(params, context);

    case 'get_top_clients':
      return await executeGetTopClients(params, context);

    case 'get_revenue_trends':
      return await executeGetRevenueTrends(params, context);

    case 'add_client':
      return await crudAddClient(params, context);
    case 'update_client':
      return await crudUpdateClient(params, context);
    case 'delete_client':
      return await crudDeleteClient(params, context);

    case 'add_order':
      return await crudAddOrder(params, context);
    case 'update_order':
      return await crudUpdateOrder(params, context);
    case 'delete_order':
      return await crudDeleteOrder(params, context);

    case 'add_expense':
      return await crudAddExpense(params, context);
    case 'update_expense':
      return await crudUpdateExpense(params, context);
    case 'delete_expense':
      return await crudDeleteExpense(params, context);

    case 'add_memory':
      return await crudMemory('add_memory', params, context);
    case 'update_memory':
      return await crudMemory('update_memory', params, context);
    case 'delete_memory':
      return await crudMemory('delete_memory', params, context);

    case 'create_recurring_order':
      return {
        success: false,
        error:
          'Pasikartojantys užsakymai per planą dar nekonfigūruoti — sukurkite užsakymą rankiniu būdu arba naudokite pokalbio asistentą.',
        toolName,
        intention: 'create_recurring_order',
        confidence: 0,
      };
    case 'generate_reminder_message':
      return {
        success: false,
        error:
          'Priminimo šablonas per šį maršrutą dar neįgyvendintas — naudokite nustatymus / asistentą.',
        toolName,
        intention: 'generate_reminder',
        confidence: 0,
      };
    case 'batch_update_order_status':
      return await crudBatchUpdateOrderStatus(params);

    default:
      throw new Error(`Unknown tool: ${toolName}`);
  }
}

/**
 * Deterministinis įrankio vykdymas (planavimo variklis, testai) — be intention klasifikatoriaus.
 */
export async function executeToolDirect(
  toolName: string,
  params: Record<string, unknown>,
  context: RoutingContext
): Promise<ToolExecutionResult> {
  return executeToolByName(toolName, params, context);
}

// Keep all the original execution functions...
// executeGetNeglectedClients, executeGetUnpaidOrders, etc.
// (These remain the same as in the original toolRouter.ts)

async function executeGetNeglectedClients(
  params: Record<string, unknown>,
  context: RoutingContext
) {
  const days = Number(params.days) || 90;
  const cutoffDate = new Date();
  cutoffDate.setDate(cutoffDate.getDate() - days);

  if (!context.clients || !context.orders) {
    throw new Error('Clients and orders data required');
  }

  const neglectedClients = context.clients.filter((client) => {
    const clientOrders = context.orders!.filter((order) => order.clientId === client.id);
    if (clientOrders.length === 0) return true;

    const lastOrderDate = clientOrders.reduce((latest, order) => {
      const orderDate = new Date(order.date);
      return orderDate > latest ? orderDate : latest;
    }, new Date(0));

    return lastOrderDate < cutoffDate;
  });

  return {
    success: true,
    data: {
      type: 'neglected_clients',
      days,
      count: neglectedClients.length,
      clients: neglectedClients.map((client) => ({
        id: client.id,
        name: client.name,
        phone: client.phone,
        address: client.address,
        daysSinceLastOrder: calculateDaysSinceLastOrder(client.id, context.orders),
      })),
    },
    toolName: 'get_neglected_clients',
    intention: 'neglected_clients' as Intention,
    confidence: 1.0,
  };
}

async function executeGetUnpaidOrders(params: Record<string, unknown>, context: RoutingContext) {
  if (!context.orders) {
    throw new Error('Orders data required');
  }

  const unpaidOrders = context.orders.filter(
    (order) => order.status === 'atlikta' && order.isPaid !== true
  );

  return {
    success: true,
    data: {
      type: 'unpaid_orders',
      count: unpaidOrders.length,
      orders: unpaidOrders.map((order) => ({
        id: order.id,
        clientName: order.clientName,
        date: order.date,
        totalPrice: order.totalPrice,
        daysUnpaid: calculateDaysSince(order.date),
      })),
    },
    toolName: 'get_unpaid_orders',
    intention: 'unpaid_orders' as Intention,
    confidence: 1.0,
  };
}

async function executeGetLowInventory(_params: Record<string, unknown>, context: RoutingContext) {
  let items: InventoryItem[] = context.inventory ?? [];
  if (items.length === 0 && context.dataOwnerId) {
    try {
      items = await getData<InventoryItem>(TABLES.INVENTORY, context.dataOwnerId);
    } catch {
      items = [];
    }
  }
  const low = items.filter((i) => Number(i.quantity) < Number(i.minQuantity));
  return {
    success: true,
    data: {
      type: 'low_inventory',
      items: low,
      count: low.length,
      message:
        low.length === 0
          ? 'Žemiau minimalios ribos prekių nėra arba inventoriaus duomenys neperduoti.'
          : `Rasta ${low.length} pozicijų žemiau minimalios ribos.`,
    },
    toolName: 'get_low_inventory',
    intention: 'low_inventory' as Intention,
    confidence: 1.0,
  };
}

async function executeGetBusinessSummary(params: Record<string, unknown>, context: RoutingContext) {
  const period = String(params.period ?? 'month');

  if (!context.orders || !context.expenses) {
    throw new Error('Orders and expenses data required');
  }

  const { startDate, endDate } = getPeriodDates(period);

  const periodOrders = context.orders.filter((order) => {
    const orderDate = new Date(order.date);
    return orderDate >= startDate && orderDate <= endDate;
  });

  const periodExpenses = context.expenses.filter((expense) => {
    const expenseDate = new Date(expense.date);
    return expenseDate >= startDate && expenseDate <= endDate;
  });

  const totalRevenue = periodOrders
    .filter((o) => o.status === 'atlikta')
    .reduce((sum, o) => sum + o.totalPrice, 0);

  const totalExpenses = periodExpenses.reduce((sum, e) => sum + e.amount, 0);
  const profit = totalRevenue - totalExpenses;

  return {
    success: true,
    data: {
      type: 'business_summary',
      period,
      startDate: startDate.toISOString().split('T')[0],
      endDate: endDate.toISOString().split('T')[0],
      metrics: {
        totalRevenue,
        totalExpenses,
        profit,
        orderCount: periodOrders.length,
        expenseCount: periodExpenses.length,
      },
    },
    toolName: 'get_business_summary',
    intention: 'business_summary' as Intention,
    confidence: 1.0,
  };
}

async function executeGetTopClients(params: Record<string, unknown>, context: RoutingContext) {
  const limit = Number(params.limit) || 5;
  const sortBy = String(params.by ?? 'revenue');

  if (!context.clients || !context.orders) {
    throw new Error('Clients and orders data required');
  }

  const clientStats: Record<string, { revenue: number; orders: number }> = {};

  for (const client of context.clients) {
    const clientOrders = context.orders.filter((o) => o.clientId === client.id);
    const revenue = clientOrders
      .filter((o) => o.status === 'atlikta')
      .reduce((sum, o) => sum + o.totalPrice, 0);

    clientStats[client.id] = {
      revenue,
      orders: clientOrders.length,
    };
  }

  const sortedClients = [...context.clients]
    .sort((a, b) => {
      const aStats = clientStats[a.id];
      const bStats = clientStats[b.id];
      return sortBy === 'revenue' ? bStats.revenue - aStats.revenue : bStats.orders - aStats.orders;
    })
    .slice(0, limit);

  return {
    success: true,
    data: {
      type: 'top_clients',
      sortBy,
      clients: sortedClients.map((client) => ({
        id: client.id,
        name: client.name,
        phone: client.phone,
        revenue: clientStats[client.id].revenue,
        orders: clientStats[client.id].orders,
      })),
    },
    toolName: 'get_top_clients',
    intention: 'top_clients' as Intention,
    confidence: 1.0,
  };
}

async function executeGetRevenueTrends(params: Record<string, unknown>, context: RoutingContext) {
  const months = Number(params.months) || 6;

  if (!context.orders) {
    throw new Error('Orders data required');
  }

  const trends = [];
  const now = new Date();

  for (let i = 0; i < months; i++) {
    const monthDate = new Date(now.getFullYear(), now.getMonth() - i, 1);
    const monthEnd = new Date(now.getFullYear(), now.getMonth() - i + 1, 0);

    const monthOrders = context.orders.filter((order) => {
      const orderDate = new Date(order.date);
      return orderDate >= monthDate && orderDate <= monthEnd;
    });

    const revenue = monthOrders
      .filter((o) => o.status === 'atlikta')
      .reduce((sum, o) => sum + o.totalPrice, 0);

    trends.unshift({
      month: monthDate.toISOString().slice(0, 7),
      revenue,
      orderCount: monthOrders.length,
    });
  }

  return {
    success: true,
    data: {
      type: 'revenue_trends',
      months,
      trends,
    },
    toolName: 'get_revenue_trends',
    intention: 'revenue_trends' as Intention,
    confidence: 1.0,
  };
}

// Helper functions
function calculateDaysSinceLastOrder(clientId: string, orders: Order[]): number {
  const clientOrders = orders.filter((o) => o.clientId === clientId);
  if (clientOrders.length === 0) return 999;

  const lastOrder = clientOrders.reduce((latest, order) => {
    const orderDate = new Date(order.date);
    return orderDate > latest ? orderDate : latest;
  }, new Date(0));

  return calculateDaysSince(lastOrder.toISOString());
}

function calculateDaysSince(dateString: string): number {
  const date = new Date(dateString);
  const now = new Date();
  const diffTime = now.getTime() - date.getTime();
  return Math.floor(diffTime / (1000 * 60 * 60 * 24));
}

function getPeriodDates(period: string): { startDate: Date; endDate: Date } {
  const now = new Date();
  const endDate = new Date(now);
  const startDate = new Date(now);

  switch (period) {
    case 'week':
      startDate.setDate(startDate.getDate() - 7);
      break;
    case 'month':
      startDate.setMonth(startDate.getMonth() - 1);
      break;
    case 'year':
      startDate.setFullYear(startDate.getFullYear() - 1);
      break;
    default:
      startDate.setMonth(startDate.getMonth() - 1);
  }

  return { startDate, endDate };
}

/**
 * Check if user message is asking for tool execution
 */
export function shouldUseToolRouter(userMessage: string): boolean {
  const messageLower = userMessage.toLowerCase();

  const toolKeywords = [
    'pridėti',
    'atnaujinti',
    'ištrinti',
    'sukurti',
    'pašalinti',
    'neapmokėt',
    'neaplanky',
    'pamest',
    'užmiršt',
    'verslo suvestin',
    'pajam',
    'top',
    'geriausi',
    'kartotin',
    'priminim',
    'batch',
    'masinis',
  ];

  return toolKeywords.some((keyword) => messageLower.includes(keyword));
}

/**
 * Enhanced route execution with memory prioritization
 */
export async function routeAndExecuteWithMemory(
  userMessage: string,
  context: RoutingContext & { allMemories?: Memory[] },
  apiKey?: string
): Promise<ToolExecutionResult & { memoryContext?: string }> {
  // 1. First, get prioritized memories if available
  let memoryContext: string | undefined;

  if (context.allMemories && context.allMemories.length > 0) {
    const memoryCtx: MemoryContext = {
      query: userMessage,
      userId: context.userId || 'system',
      conversationHistory: [],
      currentClientId: undefined,
      currentOrderId: undefined,
    };

    const prioritized = prioritizeMemories(context.allMemories, memoryCtx);

    if (prioritized.length > 0) {
      memoryContext = formatMemoriesForContext(prioritized);
    }
  }

  // 2. Execute the tool routing as usual
  const result = await routeAndExecute(userMessage, context, apiKey);

  // 3. Attach memory context to result
  return {
    ...result,
    memoryContext,
  };
}
