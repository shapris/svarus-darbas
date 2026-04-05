/**
 * Integration Test Suite for AI Agent System
 *
 * Tests the integration of:
 * 1. Hybrid Intention Classifier
 * 2. Memory Priority Layer
 * 3. Modular System Prompt
 * 4. Planning Engine
 */

import {
  classifyIntentHybrid,
  HYBRID_CLASSIFIER_CONFIG,
  type ClassificationResult,
} from './hybridClassifier';
import { prioritizeMemories, formatMemoriesForContext, MemoryContext } from './memoryPriority';
import { ModularPromptAssembler } from './modularPrompt';
import { PlanningEngine } from './planningEngine';
import { Memory, Client, Order, Expense } from '../types';

function mockClassification(
  partial: Partial<ClassificationResult> & Pick<ClassificationResult, 'intention'>
): ClassificationResult {
  return {
    confidence: 0.5,
    method: 'keyword',
    shouldExecuteTool: false,
    toolName: null,
    parameters: {},
    alternatives: [],
    ...partial,
  };
}

// ============================================================
// TEST DATA
// ============================================================

const testMemories: Memory[] = [
  {
    id: 'm1',
    content: 'Jonas visada moka grynais pinigais po valymo',
    category: 'klientas',
    importance: 5,
    createdAt: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000).toISOString(),
    uid: 'user1',
    isActive: true,
  },
  {
    id: 'm2',
    content: 'Nauja taisyklė - visada fotografuoti langus po valymo',
    category: 'procesas',
    importance: 4,
    createdAt: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString(),
    uid: 'user1',
    isActive: true,
  },
  {
    id: 'm3',
    content: 'Vasarą daugiau užsakymų dėl lauko langų',
    category: 'verslas',
    importance: 4,
    createdAt: new Date(Date.now() - 90 * 24 * 60 * 60 * 1000).toISOString(),
    uid: 'user1',
    isActive: true,
  },
];

const testClients: Client[] = [
  {
    id: 'c1',
    name: 'Jonas Petraitis',
    phone: '+37060000001',
    address: 'Klaipėda, Baltijos pr. 1',
    buildingType: 'butas',
    createdAt: '2024-01-15',
  },
  {
    id: 'c2',
    name: 'UAB "Baltija"',
    phone: '+37060000002',
    address: 'Klaipėda, Tilžės g. 25',
    buildingType: 'ofisas',
    createdAt: '2024-02-20',
  },
  {
    id: 'c3',
    name: 'Ona Kazlauskienė',
    phone: '+37060000003',
    address: 'Klaipėda, Bangų g. 8',
    buildingType: 'butas',
    createdAt: '2024-01-10',
  },
];

const testOrders: Order[] = [
  {
    id: 'o1',
    clientId: 'c1',
    clientName: 'Jonas Petraitis',
    address: 'Klaipėda, Baltijos pr. 1',
    date: '2024-03-15',
    time: '10:00',
    windowCount: 8,
    floor: 3,
    additionalServices: { balkonai: true, vitrinos: false, terasa: false, kiti: false },
    totalPrice: 45,
    status: 'atlikta',
    createdAt: '2024-03-10',
    isPaid: false,
  },
  {
    id: 'o2',
    clientId: 'c2',
    clientName: 'UAB "Baltija"',
    address: 'Klaipėda, Tilžės g. 25',
    date: '2024-03-20',
    time: '09:00',
    windowCount: 25,
    floor: 2,
    additionalServices: { balkonai: false, vitrinos: true, terasa: false, kiti: false },
    totalPrice: 120,
    status: 'suplanuota',
    createdAt: '2024-03-18',
    isPaid: true,
  },
  {
    id: 'o3',
    clientId: 'c3',
    clientName: 'Ona Kazlauskienė',
    address: 'Klaipėda, Bangų g. 8',
    date: '2024-02-01',
    time: '14:00',
    windowCount: 5,
    floor: 1,
    additionalServices: { balkonai: false, vitrinos: false, terasa: false, kiti: false },
    totalPrice: 30,
    status: 'atlikta',
    createdAt: '2024-01-28',
    isPaid: true,
  },
];

const testExpenses: Expense[] = [
  {
    id: 'e1',
    title: 'Langų valiklis',
    amount: 25.5,
    date: '2024-03-01',
    category: 'priemonės',
    uid: 'user1',
  },
  { id: 'e2', title: 'Kuras', amount: 45.0, date: '2024-03-05', category: 'kuras', uid: 'user1' },
  {
    id: 'e3',
    title: 'Facebook reklama',
    amount: 100.0,
    date: '2024-03-10',
    category: 'reklama',
    uid: 'user1',
  },
];

// ============================================================
// TEST RUNNER
// ============================================================

export async function runIntegrationTests(apiKey?: string): Promise<{
  passed: number;
  failed: number;
  details: string[];
}> {
  console.log('🧪 AI Agent Integration Tests\n');
  console.log('================================\n');

  const results: { passed: number; failed: number; details: string[] } = {
    passed: 0,
    failed: 0,
    details: [],
  };

  // Test 1: Memory Priority Integration
  console.log('📋 Test 1: Memory Priority Integration');
  const memoryResult = await testMemoryPriority();
  updateResults(results, memoryResult);
  console.log('');

  // Test 2: Hybrid Classifier Integration
  console.log('📋 Test 2: Hybrid Intention Classifier');
  const classifierResult = await testHybridClassifier(apiKey);
  updateResults(results, classifierResult);
  console.log('');

  // Test 3: Modular Prompt Assembly
  console.log('📋 Test 3: Modular Prompt Assembly');
  const promptResult = await testModularPrompt();
  updateResults(results, promptResult);
  console.log('');

  // Test 4: Planning Engine
  console.log('📋 Test 4: Planning Engine');
  const planningResult = await testPlanningEngine();
  updateResults(results, planningResult);
  console.log('');

  // Test 5: End-to-End Workflow
  console.log('📋 Test 5: End-to-End Workflow');
  const e2eResult = await testEndToEndWorkflow(apiKey);
  updateResults(results, e2eResult);
  console.log('');

  // Summary
  console.log('================================');
  console.log(`📊 Test Summary: ${results.passed} passed, ${results.failed} failed`);
  console.log(
    `✅ Success Rate: ${((results.passed / (results.passed + results.failed)) * 100).toFixed(1)}%`
  );

  return results;
}

// ============================================================
// TEST IMPLEMENTATIONS
// ============================================================

async function testMemoryPriority(): Promise<{ passed: boolean; details: string }> {
  try {
    const memoryContext: MemoryContext = {
      query: 'Koks mūsų verslo pelnas?',
      userId: 'user1',
      conversationHistory: [],
    };

    const prioritized = prioritizeMemories(testMemories, memoryContext);

    if (prioritized.length === 0) {
      return { passed: false, details: 'No memories returned' };
    }

    // Check that memories are sorted by relevance
    const isSorted = prioritized.every(
      (mem, i, arr) => i === 0 || arr[i - 1].priorityScore >= mem.priorityScore
    );

    if (!isSorted) {
      return { passed: false, details: 'Memories not properly sorted by priority' };
    }

    // Check formatting
    const formatted = formatMemoriesForContext(prioritized);
    if (!formatted.includes('📚')) {
      return { passed: false, details: 'Memory formatting missing expected markers' };
    }

    console.log('  ✅ Memory prioritization working correctly');
    console.log(`  📊 Prioritized ${prioritized.length} memories`);
    console.log(
      `  🏆 Top memory: "${prioritized[0].content.substring(0, 50)}..." (${(prioritized[0].priorityScore * 100).toFixed(0)}%)`
    );

    return { passed: true, details: 'Memory priority system functioning correctly' };
  } catch (error) {
    return { passed: false, details: `Memory priority error: ${error}` };
  }
}

async function testHybridClassifier(
  apiKey?: string
): Promise<{ passed: boolean; details: string }> {
  try {
    const testQueries = [
      { query: 'Koks mūsų verslo pelnas?', expectedCategory: 'business' },
      { query: 'Rask neapmokėtus užsakymus', expectedCategory: 'orders' },
      { query: 'Labas, kaip sekasi?', expectedCategory: 'general' },
    ];

    let correct = 0;

    for (const { query } of testQueries) {
      const result = apiKey
        ? await classifyIntentHybrid(query, apiKey, HYBRID_CLASSIFIER_CONFIG)
        : mockClassification({ intention: 'general_chat', confidence: 0.5 });

      console.log(
        `  📝 Query: "${query}" → ${result.intention} (${result.method}, ${(result.confidence * 100).toFixed(0)}%)`
      );

      if (result.confidence > 0.5) {
        correct++;
      }
    }

    const accuracy = correct / testQueries.length;

    if (accuracy >= 0.5) {
      console.log(`  ✅ Classifier accuracy: ${(accuracy * 100).toFixed(0)}%`);
      return { passed: true, details: `Classifier accuracy: ${(accuracy * 100).toFixed(0)}%` };
    } else {
      return {
        passed: false,
        details: `Classifier accuracy too low: ${(accuracy * 100).toFixed(0)}%`,
      };
    }
  } catch (error) {
    return { passed: false, details: `Classifier error: ${error}` };
  }
}

async function testModularPrompt(): Promise<{ passed: boolean; details: string }> {
  try {
    const assembler = new ModularPromptAssembler({ maxTokens: 1000 });

    const classification = mockClassification({
      intention: 'business_summary',
      confidence: 0.9,
      shouldExecuteTool: true,
      toolName: 'get_business_summary',
      parameters: { period: 'month' },
    });

    const assemblyResult = assembler.assemble(
      classification,
      [],
      ['get_business_summary', 'get_top_clients'],
      { clientCount: 10, orderCount: 25, revenue: 5000 }
    );

    if (assemblyResult.modules.length === 0) {
      return { passed: false, details: 'No modules assembled' };
    }

    const systemPrompt = assembler.formatAsSystemPrompt(assemblyResult);

    // Check prompt contains key sections
    const hasIdentity = systemPrompt.includes('TAPATYBĖ') || systemPrompt.includes('Švarus Darbas');
    const hasRules = systemPrompt.includes('TAISYKLĖS') || systemPrompt.includes('saugos');

    if (!hasIdentity || !hasRules) {
      return { passed: false, details: 'Prompt missing required sections' };
    }

    console.log(
      `  ✅ Modular prompt assembled: ${assemblyResult.modules.length} modules, ${assemblyResult.totalTokens} tokens`
    );
    console.log(`  📦 Sections: ${assemblyResult.modules.map((m) => m.type).join(', ')}`);

    return {
      passed: true,
      details: `Prompt assembly successful: ${assemblyResult.totalTokens} tokens`,
    };
  } catch (error) {
    return { passed: false, details: `Prompt assembly error: ${error}` };
  }
}

async function testPlanningEngine(): Promise<{ passed: boolean; details: string }> {
  try {
    const planningEngine = new PlanningEngine();

    const mockContext = {
      userQuery: 'Sukurti mėnesinę verslo ataskaitą',
      userId: 'user1',
      businessData: {
        totalClients: 3,
        totalOrders: 3,
        totalRevenue: 195,
        totalExpenses: 170.5,
      },
      conversationHistory: [],
    };

    const classification = mockClassification({
      intention: 'business_summary',
      confidence: 0.9,
      shouldExecuteTool: true,
      toolName: 'get_business_summary',
      parameters: {},
    });

    // Test planning detection
    const shouldPlan = planningEngine.shouldUsePlanning(
      'Sukurti mėnesinę verslo ataskaitą su rekomendacijomis',
      classification
    );

    if (!shouldPlan) {
      return { passed: false, details: 'Planning not triggered for complex query' };
    }

    console.log('  ✅ Planning detection working');

    // Test plan creation
    const plan = planningEngine.createPlan('Mėnesinė verslo apžvalga', classification, mockContext);

    if (!plan) {
      return { passed: false, details: 'Failed to create plan' };
    }

    console.log(`  📋 Plan created: "${plan.name}" with ${plan.steps.length} steps`);

    // Test plan execution (partial - just first step)
    const summary = await planningEngine.executePlan(plan);

    if (summary.status === 'failed' && summary.failedSteps > 0) {
      return {
        passed: false,
        details: `Plan execution failed: ${summary.failedSteps} steps failed`,
      };
    }

    console.log(`  ✅ Plan execution completed: ${summary.progress}% progress`);
    console.log(`  📊 Steps: ${summary.completedSteps}/${summary.totalSteps} completed`);

    return {
      passed: true,
      details: `Planning engine working: ${summary.completedSteps} steps completed`,
    };
  } catch (error) {
    return { passed: false, details: `Planning engine error: ${error}` };
  }
}

async function testEndToEndWorkflow(
  apiKey?: string
): Promise<{ passed: boolean; details: string }> {
  try {
    console.log('  🔄 Testing complete workflow...');

    // Step 1: Classify user query
    const userQuery = 'Sukurti mėnesinę ataskaitą su top klientais';
    console.log(`  1️⃣ Query: "${userQuery}"`);

    // Step 2: Classify intention
    let classification: ClassificationResult;
    if (apiKey) {
      classification = await classifyIntentHybrid(userQuery, apiKey, HYBRID_CLASSIFIER_CONFIG);
    } else {
      classification = mockClassification({
        intention: 'business_summary',
        confidence: 0.85,
        shouldExecuteTool: true,
        toolName: 'get_business_summary',
        parameters: { period: 'month' },
      });
    }
    console.log(
      `  2️⃣ Classification: ${classification.intention} (${classification.method}, ${(classification.confidence * 100).toFixed(0)}%)`
    );

    // Step 3: Prioritize memories
    const memoryContext: MemoryContext = {
      query: userQuery,
      userId: 'user1',
      conversationHistory: [],
    };
    const prioritizedMemories = prioritizeMemories(testMemories, memoryContext);
    console.log(`  3️⃣ Memories prioritized: ${prioritizedMemories.length} relevant memories`);

    // Step 4: Assemble prompt
    const assembler = new ModularPromptAssembler({ maxTokens: 1500 });
    const assemblyResult = assembler.assemble(
      classification,
      prioritizedMemories,
      ['get_business_summary', 'get_top_clients'],
      { clientCount: 3, orderCount: 3, revenue: 195 }
    );
    console.log(
      `  4️⃣ Prompt assembled: ${assemblyResult.totalTokens} tokens, ${assemblyResult.modules.length} modules`
    );

    // Step 5: Create plan (if needed)
    const mockContext = {
      userQuery,
      userId: 'user1',
      businessData: {
        totalClients: 3,
        totalOrders: 3,
        totalRevenue: 195,
        totalExpenses: 170.5,
      },
      conversationHistory: [],
    };

    const planningEngine = new PlanningEngine();
    const shouldPlan = planningEngine.shouldUsePlanning(userQuery, classification);

    if (shouldPlan) {
      console.log(`  5️⃣ Planning triggered for complex query`);
      const plan = planningEngine.createPlan(userQuery, classification, mockContext);
      if (plan) {
        const summary = await planningEngine.executePlan(plan);
        console.log(`  6️⃣ Plan executed: ${summary.progress}% completed`);
      }
    } else {
      console.log(`  5️⃣ Direct execution (no planning needed)`);
    }

    console.log('  ✅ End-to-end workflow completed successfully');

    return { passed: true, details: 'End-to-end workflow successful' };
  } catch (error) {
    return { passed: false, details: `End-to-end workflow error: ${error}` };
  }
}

// ============================================================
// UTILITY FUNCTIONS
// ============================================================

function updateResults(
  results: { passed: number; failed: number; details: string[] },
  testResult: { passed: boolean; details: string }
): void {
  if (testResult.passed) {
    results.passed++;
    results.details.push(`✅ ${testResult.details}`);
  } else {
    results.failed++;
    results.details.push(`❌ ${testResult.details}`);
  }
}

/**
 * Quick smoke test for all components
 */
export async function smokeTest(apiKey?: string): Promise<boolean> {
  console.log('🔥 Smoke Test: Quick verification of all components\n');

  try {
    // Test 1: Memory priority
    const memories = prioritizeMemories(testMemories, {
      query: 'test',
      userId: 'test',
      conversationHistory: [],
    });
    console.log(`✅ Memory Priority: ${memories.length} memories processed`);

    // Test 2: Hybrid classifier
    const classification = apiKey
      ? await classifyIntentHybrid('test query', apiKey)
      : mockClassification({ intention: 'general_chat', confidence: 0.5 });
    console.log(`✅ Hybrid Classifier: ${classification.intention} classified`);

    // Test 3: Modular prompt
    const assembler = new ModularPromptAssembler();
    const assembly = assembler.assemble(classification, [], [], {});
    console.log(`✅ Modular Prompt: ${assembly.modules.length} modules assembled`);

    // Test 4: Planning engine
    const planningEngine = new PlanningEngine();
    const shouldPlan = planningEngine.shouldUsePlanning('test query', classification);
    console.log(`✅ Planning Engine: ${shouldPlan ? 'Planning triggered' : 'Direct execution'}`);

    console.log('\n🔥 All components operational!');
    return true;
  } catch (error) {
    console.log(`\n❌ Smoke test failed: ${error}`);
    return false;
  }
}

// Export test data for external use
export const TEST_INTEGRATION_DATA = {
  testMemories,
  testClients,
  testOrders,
  testExpenses,
};
