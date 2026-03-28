/**
 * Priority Memory Layer for AI Assistant
 * 
 * This module provides intelligent memory prioritization and relevance scoring
 * to improve AI context understanding and response quality.
 */

import { Memory } from '../types';

// Extended memory interface with calculated fields
export interface PrioritizedMemory extends Memory {
  relevanceScore: number;
  priorityScore: number;
  lastAccessed: Date;
  accessCount: number;
  keywords: string[];
  contextLinks: {
    clientId?: string;
    orderId?: string;
    expenseId?: string;
  };
}

export interface MemoryContext {
  query: string;
  userId: string;
  conversationHistory: string[];
  currentClientId?: string;
  currentOrderId?: string;
}

export interface MemoryPriorityConfig {
  maxMemories: number;
  minRelevanceScore: number;
  recencyWeight: number;
  importanceWeight: number;
  keywordWeight: number;
  contextWeight: number;
}

const DEFAULT_CONFIG: MemoryPriorityConfig = {
  maxMemories: 5,
  minRelevanceScore: 0.3,
  recencyWeight: 0.25,
  importanceWeight: 0.2,
  keywordWeight: 0.35,
  contextWeight: 0.2
};

/**
 * Calculate relevance score for a memory based on query context
 */
export function calculateRelevanceScore(
  memory: Memory,
  context: MemoryContext,
  config: MemoryPriorityConfig = DEFAULT_CONFIG
): number {
  let score = 0;
  
  // 1. Base importance (user-defined)
  const importance = memory.importance || 3;
  score += (importance / 5) * config.importanceWeight;
  
  // 2. Recency factor (exponential decay)
  const daysSinceCreation = getDaysBetween(new Date(memory.createdAt), new Date());
  const recencyScore = Math.exp(-daysSinceCreation / 90); // 90-day half-life
  score += recencyScore * config.recencyWeight;
  
  // 3. Keyword matching with query
  const memoryKeywords = extractKeywords(memory.content);
  const queryKeywords = extractKeywords(context.query);
  const keywordOverlap = calculateJaccardSimilarity(memoryKeywords, queryKeywords);
  score += keywordOverlap * config.keywordWeight;
  
  // 4. Context relevance
  let contextScore = 0;
  
  // Boost if memory category matches query intent
  if (context.query.toLowerCase().includes('klient') && memory.category === 'klientas') {
    contextScore += 0.3;
  }
  if (context.query.toLowerCase().includes('versl') && memory.category === 'verslas') {
    contextScore += 0.3;
  }
  if (context.query.toLowerCase().includes('proces') && memory.category === 'procesas') {
    contextScore += 0.3;
  }
  
  // Boost if memory links to current context
  if (context.currentClientId && memory.content.includes(context.currentClientId)) {
    contextScore += 0.2;
  }
  if (context.currentOrderId && memory.content.includes(context.currentOrderId)) {
    contextScore += 0.2;
  }
  
  // Conversation history relevance
  const recentHistory = context.conversationHistory.slice(-3).join(' ');
  if (recentHistory && containsKeywords(memory.content, extractKeywords(recentHistory))) {
    contextScore += 0.2;
  }
  
  score += Math.min(contextScore, 1.0) * config.contextWeight;
  
  return Math.min(score, 1.0);
}

/**
 * Extract keywords from text (Lithuanian optimized)
 */
export function extractKeywords(text: string): string[] {
  // Lithuanian stop words to filter out
  const stopWords = new Set([
    'ir', 'ar', 'kad', 'kur', 'ką', 'kaip', 'kas', 'yra', 'buvo', 'bus',
    'su', 'iš', 'į', 'ant', 'prie', 'per', 'be', 'tarp', 'po', 'iki',
    'aš', 'tu', 'jis', 'ji', 'mes', 'jūs', 'jie', 'jos', 'man', 'tau',
    'bet', 'tai', 'vis', 'tik', 'jau', 'dar', 'ne', 'taip', 'gal', 'gali',
    'turėti', 'galėti', 'norėti', 'reikia', 'daryti', 'būti', 'eiti'
  ]);
  
  // Clean and split text (include Lithuanian: ąčęėįšųūž)
  const words = text.toLowerCase()
    .replace(/[^\w\sàáâãäåæçèéêëìíîïðñòóôõöùúûüýþÿąčęėįšųūž]/g, ' ')
    .split(/\s+/)
    .filter(word => word.length > 2 && !stopWords.has(word));
  
  // Remove duplicates and return
  return [...new Set(words)];
}

/**
 * Calculate Jaccard similarity between two keyword sets
 */
function calculateJaccardSimilarity(set1: string[], set2: string[]): number {
  if (set1.length === 0 || set2.length === 0) return 0;
  
  const intersection = set1.filter(x => set2.includes(x));
  const union = new Set([...set1, ...set2]);
  
  return intersection.length / union.size;
}

/**
 * Check if text contains any of the keywords
 */
function containsKeywords(text: string, keywords: string[]): boolean {
  const textLower = text.toLowerCase();
  return keywords.some(keyword => textLower.includes(keyword.toLowerCase()));
}

/**
 * Get days between two dates
 */
function getDaysBetween(date1: Date, date2: Date): number {
  const diffTime = Math.abs(date2.getTime() - date1.getTime());
  return Math.floor(diffTime / (1000 * 60 * 60 * 24));
}

/**
 * Prioritize memories based on query context
 */
export function prioritizeMemories(
  memories: Memory[],
  context: MemoryContext,
  config: MemoryPriorityConfig = DEFAULT_CONFIG
): PrioritizedMemory[] {
  // Convert to prioritized memories
  const prioritized: PrioritizedMemory[] = memories.map(memory => ({
    ...memory,
    relevanceScore: calculateRelevanceScore(memory, context, config),
    priorityScore: 0, // Will be calculated below
    lastAccessed: new Date(memory.createdAt),
    accessCount: 1,
    keywords: extractKeywords(memory.content),
    contextLinks: extractContextLinks(memory.content)
  }));
  
  // Calculate priority score (relevance + category boost)
  prioritized.forEach(memory => {
    let categoryBoost = 0;
    if (memory.category === 'verslas') categoryBoost = 0.1;
    if (memory.category === 'klientas') categoryBoost = 0.05;
    
    memory.priorityScore = memory.relevanceScore + categoryBoost;
  });
  
  // Filter by minimum relevance and sort by priority
  return prioritized
    .filter(memory => memory.relevanceScore >= config.minRelevanceScore)
    .sort((a, b) => b.priorityScore - a.priorityScore)
    .slice(0, config.maxMemories);
}

/**
 * Extract context links from memory content
 */
function extractContextLinks(content: string): PrioritizedMemory['contextLinks'] {
  const links: PrioritizedMemory['contextLinks'] = {};
  
  // Look for client IDs (format: "klientas ID" or "client ID")
  const clientMatch = content.match(/klientas?\s+([A-Za-z0-9-]+)/i) ||
                     content.match(/client\s+([A-Za-z0-9-]+)/i);
  if (clientMatch) links.clientId = clientMatch[1];
  
  // Look for order IDs (format: "užsakymas ID" or "order ID")
  const orderMatch = content.match(/užsakymas?\s+([A-Za-z0-9-]+)/i) ||
                    content.match(/order\s+([A-Za-z0-9-]+)/i);
  if (orderMatch) links.orderId = orderMatch[1];
  
  return links;
}

/**
 * Format memories for AI context injection
 */
export function formatMemoriesForContext(
  prioritizedMemories: PrioritizedMemory[]
): string {
  if (prioritizedMemories.length === 0) {
    return 'Nėra susijusių prisiminimų.';
  }
  
  const formatted = prioritizedMemories.map((memory, index) => {
    const categoryEmoji = getCategoryEmoji(memory.category);
    const importanceStars = '⭐'.repeat(memory.importance || 3);
    const relevanceIndicator = memory.relevanceScore > 0.7 ? '🔥' : '💡';
    
    return `${index + 1}. ${relevanceIndicator} ${categoryEmoji} [${memory.category.toUpperCase()}] ${importanceStars}
   "${memory.content}"
   ${memory.eventDate ? `📅 ${memory.eventDate}` : ''}
   Reikšmingumas: ${(memory.relevanceScore * 100).toFixed(0)}%`;
  });
  
  return `📚 **ILGALAIKĖ ATMINTIS** (reikšmingiausi įrašai):
${formatted.join('\n\n')}`;
}

/**
 * Get emoji for memory category
 */
function getCategoryEmoji(category: Memory['category']): string {
  switch (category) {
    case 'klientas': return '👤';
    case 'verslas': return '💼';
    case 'procesas': return '⚙️';
    case 'kita': return '📌';
    default: return '📄';
  }
}

/**
 * Update memory access tracking
 */
export function updateMemoryAccess(
  memory: PrioritizedMemory
): PrioritizedMemory {
  return {
    ...memory,
    lastAccessed: new Date(),
    accessCount: memory.accessCount + 1
  };
}

/**
 * Check if memory is still relevant (not expired)
 */
export function isMemoryStillRelevant(
  memory: PrioritizedMemory,
  maxAgeDays: number = 365
): boolean {
  const ageInDays = getDaysBetween(new Date(memory.createdAt), new Date());
  return ageInDays <= maxAgeDays && memory.isActive !== false;
}

/**
 * Get memory statistics for monitoring
 */
export function getMemoryStatistics(
  memories: PrioritizedMemory[]
): {
  totalMemories: number;
  averageRelevance: number;
  categoryDistribution: Record<string, number>;
  topRelevantMemories: Array<{ id: string; relevance: number }>;
} {
  if (memories.length === 0) {
    return {
      totalMemories: 0,
      averageRelevance: 0,
      categoryDistribution: {},
      topRelevantMemories: []
    };
  }
  
  const categoryDistribution: Record<string, number> = {};
  let totalRelevance = 0;
  
  memories.forEach(memory => {
    categoryDistribution[memory.category] = (categoryDistribution[memory.category] || 0) + 1;
    totalRelevance += memory.relevanceScore;
  });
  
  const topRelevantMemories = [...memories]
    .sort((a, b) => b.relevanceScore - a.relevanceScore)
    .slice(0, 5)
    .map(m => ({ id: m.id, relevance: m.relevanceScore }));
  
  return {
    totalMemories: memories.length,
    averageRelevance: totalRelevance / memories.length,
    categoryDistribution,
    topRelevantMemories
  };
}

/**
 * Smart memory suggestion for AI to remember
 */
export function shouldSuggestMemory(
  query: string,
  response: string,
  existingMemories: Memory[]
): { shouldRemember: boolean; suggestedContent: string; reason: string } {
  const queryLower = query.toLowerCase();
  
  // Check if query contains memory-worthy patterns
  const memoryPatterns = [
    { pattern: /prisimink|įsimink|atsimink|memory/i, reason: 'Explicit memory request' },
    { pattern: /taisyklė|rule|politika/i, reason: 'Rule or policy mentioned' },
    { pattern: /visada|niekada|dažnai|retai/i, reason: 'Frequency pattern detected' },
    { pattern: /svarbu|svarbiausia|prioritet/i, reason: 'Importance indicator' },
    { pattern: /procesas|workflow|etap/i, reason: 'Process description' }
  ];
  
  for (const { pattern, reason } of memoryPatterns) {
    if (pattern.test(query)) {
      return {
        shouldRemember: true,
        suggestedContent: extractMemoryContent(query, response),
        reason
      };
    }
  }
  
  // Check if response contains data worth remembering
  if (response.length > 100 && (response.toLowerCase().includes('svarbu') || response.toLowerCase().includes('reikia'))) {
    return {
      shouldRemember: true,
      suggestedContent: summarizeForMemory(query, response),
      reason: 'Response contains important information'
    };
  }
  
  return {
    shouldRemember: false,
    suggestedContent: '',
    reason: 'No memory-worthy content detected'
  };
}

/**
 * Extract memory content from query/response
 */
function extractMemoryContent(query: string, response: string): string {
  // Simple extraction - in production, you might use AI for summarization
  const queryParts = query.split(/[.!?]/).filter(p => p.trim().length > 10);
  return queryParts[0]?.trim() || query.slice(0, 200);
}

/**
 * Summarize for memory storage
 */
function summarizeForMemory(query: string, response: string): string {
  // Extract key points from response
  const keyPhrases = response.split(/[.!?]/)
    .filter(sentence => 
      sentence.includes('svarbu') || 
      sentence.includes('reikia') ||
      sentence.includes('turėtų') ||
      sentence.length > 30
    )
    .slice(0, 2)
    .map(s => s.trim());
  
  return keyPhrases.join('. ') || response.slice(0, 200);
}

// Export default configuration
export const MEMORY_CONFIG: MemoryPriorityConfig = DEFAULT_CONFIG;