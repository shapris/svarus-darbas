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
  IntentionMatch 
} from './intentionClassifier';
import { 
  classifyIntentHybrid,
  shouldUseDeterministicRouting,
  getIntentDescription,
  ExtendedIntention,
  ClassificationResult
} from './hybridClassifier';
import { 
  prioritizeMemories, 
  formatMemoriesForContext,
  MemoryContext,
  PrioritizedMemory 
} from './memoryPriority';

// Types for context and execution
export interface ToolExecutionResult {
  success: boolean;
  data?: any;
  error?: string;
  toolName: string;
  intention: Intention | ExtendedIntention;
  confidence: number;
  method?: 'keyword' | 'llm' | 'hybrid';
}

interface RoutingContext {
  clients?: any[];
  orders?: any[];
  expenses?: any[];
  memories?: any[];
  userId?: string;
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
        console.log('Using hybrid classifier:', hybridResult);
        
        const result = await executeToolByName(
          hybridResult.toolName, 
          hybridResult.parameters, 
          context
        );
        
        return {
          ...result,
          intention: hybridResult.intention,
          confidence: hybridResult.confidence,
          method: hybridResult.method
        };
      }
    } catch (error) {
      console.warn('Hybrid classification failed, falling back to keyword:', error);
    }
  }
  
  // Fallback to original keyword-based classification
  const intentionMatch = classifyIntention(userMessage);
  
  console.log('Intention classified:', intentionMatch);
  
  // 2. Check if tool execution is needed
  if (!requiresToolExecution(intentionMatch.intention)) {
    return {
      success: true,
      data: null,
      toolName: 'none',
      intention: intentionMatch.intention,
      confidence: intentionMatch.confidence,
      method: 'keyword'
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
      method: 'keyword'
    };
  }
  
  // 4. Execute the appropriate tool
  try {
    const result = await executeToolByName(toolName, intentionMatch.params || {}, context);
    
    return {
      ...result,
      intention: intentionMatch.intention,
      confidence: intentionMatch.confidence,
      method: 'keyword'
    };
  } catch (error: any) {
    return {
      success: false,
      error: error.message || 'Unknown error during tool execution',
      toolName,
      intention: intentionMatch.intention,
      confidence: intentionMatch.confidence,
      method: 'keyword'
    };
  }
}

/**
 * Execute tool by name
 */
async function executeToolByName(
  toolName: string,
  params: Record<string, any>,
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
    
    // Client management (would need actual database operations)
    case 'add_client':
    case 'update_client':
    case 'delete_client':
      return { 
        success: true, 
        data: { message: `Tool ${toolName} would be executed with params: ${JSON.stringify(params)}` },
        toolName,
        intention: toolName as Intention,
        confidence: 1.0
      };
    
    // Order management
    case 'add_order':
    case 'update_order':
    case 'delete_order':
      return { 
        success: true, 
        data: { message: `Tool ${toolName} would be executed with params: ${JSON.stringify(params)}` },
        toolName,
        intention: toolName as Intention,
        confidence: 1.0
      };
    
    // Expense management
    case 'add_expense':
    case 'update_expense':
    case 'delete_expense':
      return { 
        success: true, 
        data: { message: `Tool ${toolName} would be executed with params: ${JSON.stringify(params)}` },
        toolName,
        intention: toolName as Intention,
        confidence: 1.0
      };
    
    // Memory operations
    case 'add_memory':
    case 'update_memory':
    case 'delete_memory':
      return { 
        success: true, 
        data: { message: `Tool ${toolName} would be executed with params: ${JSON.stringify(params)}` },
        toolName,
        intention: toolName as Intention,
        confidence: 1.0
      };
    
    // Workflow automation
    case 'create_recurring_order':
    case 'generate_reminder_message':
    case 'batch_update_order_status':
      return { 
        success: true, 
        data: { message: `Tool ${toolName} would be executed with params: ${JSON.stringify(params)}` },
        toolName,
        intention: toolName as Intention,
        confidence: 1.0
      };
    
    default:
      throw new Error(`Unknown tool: ${toolName}`);
  }
}

// Keep all the original execution functions...
// executeGetNeglectedClients, executeGetUnpaidOrders, etc.
// (These remain the same as in the original toolRouter.ts)

async function executeGetNeglectedClients(params: Record<string, any>, context: RoutingContext) {
  const days = params.days || 90;
  const cutoffDate = new Date();
  cutoffDate.setDate(cutoffDate.getDate() - days);
  
  if (!context.clients || !context.orders) {
    throw new Error('Clients and orders data required');
  }
  
  const neglectedClients = context.clients.filter(client => {
    const clientOrders = context.orders!.filter(order => order.clientId === client.id);
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
      clients: neglectedClients.map(client => ({
        id: client.id,
        name: client.name,
        phone: client.phone,
        address: client.address,
        daysSinceLastOrder: calculateDaysSinceLastOrder(client.id, context.orders)
      }))
    },
    toolName: 'get_neglected_clients',
    intention: 'neglected_clients' as Intention,
    confidence: 1.0
  };
}

async function executeGetUnpaidOrders(params: Record<string, any>, context: RoutingContext) {
  if (!context.orders) {
    throw new Error('Orders data required');
  }
  
  const unpaidOrders = context.orders.filter(order => 
    order.status === 'atlikta' && !order.isPaid
  );
  
  return {
    success: true,
    data: {
      type: 'unpaid_orders',
      count: unpaidOrders.length,
      orders: unpaidOrders.map(order => ({
        id: order.id,
        clientName: order.clientName,
        date: order.date,
        totalPrice: order.totalPrice,
        daysUnpaid: calculateDaysSince(order.date)
      }))
    },
    toolName: 'get_unpaid_orders',
    intention: 'unpaid_orders' as Intention,
    confidence: 1.0
  };
}

async function executeGetLowInventory(params: Record<string, any>, context: RoutingContext) {
  return {
    success: true,
    data: {
      type: 'low_inventory',
      items: [],
      message: 'Inventory system not fully implemented yet'
    },
    toolName: 'get_low_inventory',
    intention: 'low_inventory' as Intention,
    confidence: 1.0
  };
}

async function executeGetBusinessSummary(params: Record<string, any>, context: RoutingContext) {
  const period = params.period || 'month';
  
  if (!context.orders || !context.expenses) {
    throw new Error('Orders and expenses data required');
  }
  
  const { startDate, endDate } = getPeriodDates(period);
  
  const periodOrders = context.orders.filter(order => {
    const orderDate = new Date(order.date);
    return orderDate >= startDate && orderDate <= endDate;
  });
  
  const periodExpenses = context.expenses.filter(expense => {
    const expenseDate = new Date(expense.date);
    return expenseDate >= startDate && expenseDate <= endDate;
  });
  
  const totalRevenue = periodOrders
    .filter(o => o.status === 'atlikta')
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
        expenseCount: periodExpenses.length
      }
    },
    toolName: 'get_business_summary',
    intention: 'business_summary' as Intention,
    confidence: 1.0
  };
}

async function executeGetTopClients(params: Record<string, any>, context: RoutingContext) {
  const limit = params.limit || 5;
  const sortBy = params.by || 'revenue';
  
  if (!context.clients || !context.orders) {
    throw new Error('Clients and orders data required');
  }
  
  const clientStats: Record<string, { revenue: number; orders: number }> = {};
  
  for (const client of context.clients) {
    const clientOrders = context.orders.filter(o => o.clientId === client.id);
    const revenue = clientOrders
      .filter(o => o.status === 'atlikta')
      .reduce((sum, o) => sum + o.totalPrice, 0);
    
    clientStats[client.id] = {
      revenue,
      orders: clientOrders.length
    };
  }
  
  const sortedClients = [...context.clients]
    .sort((a, b) => {
      const aStats = clientStats[a.id];
      const bStats = clientStats[b.id];
      return sortBy === 'revenue' 
        ? bStats.revenue - aStats.revenue
        : bStats.orders - aStats.orders;
    })
    .slice(0, limit);
  
  return {
    success: true,
    data: {
      type: 'top_clients',
      sortBy,
      clients: sortedClients.map(client => ({
        id: client.id,
        name: client.name,
        phone: client.phone,
        revenue: clientStats[client.id].revenue,
        orders: clientStats[client.id].orders
      }))
    },
    toolName: 'get_top_clients',
    intention: 'top_clients' as Intention,
    confidence: 1.0
  };
}

async function executeGetRevenueTrends(params: Record<string, any>, context: RoutingContext) {
  const months = params.months || 6;
  
  if (!context.orders) {
    throw new Error('Orders data required');
  }
  
  const trends = [];
  const now = new Date();
  
  for (let i = 0; i < months; i++) {
    const monthDate = new Date(now.getFullYear(), now.getMonth() - i, 1);
    const monthEnd = new Date(now.getFullYear(), now.getMonth() - i + 1, 0);
    
    const monthOrders = context.orders.filter(order => {
      const orderDate = new Date(order.date);
      return orderDate >= monthDate && orderDate <= monthEnd;
    });
    
    const revenue = monthOrders
      .filter(o => o.status === 'atlikta')
      .reduce((sum, o) => sum + o.totalPrice, 0);
    
    trends.unshift({
      month: monthDate.toISOString().slice(0, 7),
      revenue,
      orderCount: monthOrders.length
    });
  }
  
  return {
    success: true,
    data: {
      type: 'revenue_trends',
      months,
      trends
    },
    toolName: 'get_revenue_trends',
    intention: 'revenue_trends' as Intention,
    confidence: 1.0
  };
}

// Helper functions
function calculateDaysSinceLastOrder(clientId: string, orders: any[]): number {
  const clientOrders = orders.filter(o => o.clientId === clientId);
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
  let startDate = new Date(now);
  
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
    'pridėti', 'atnaujinti', 'ištrinti', 'sukurti', 'pašalinti',
    'neapmokėt', 'neaplanky', 'pamest', 'užmiršt',
    'verslo suvestin', 'pajam', 'top', 'geriausi',
    'kartotin', 'priminim', 'batch', 'masinis'
  ];
  
  return toolKeywords.some(keyword => messageLower.includes(keyword));
}

/**
 * Enhanced route execution with memory prioritization
 */
export async function routeAndExecuteWithMemory(
  userMessage: string,
  context: RoutingContext & { allMemories?: any[] },
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
      currentOrderId: undefined
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
    memoryContext
  };
}