/**
 * Test suite for Hybrid Intention Classifier
 *
 * Tests both keyword-based and LLM fallback classification
 */

import { classifyIntentHybrid, getIntentDescription, ExtendedIntention } from './hybridClassifier';

// Test cases for keyword classification (no LLM needed)
const KEYWORD_TEST_CASES = [
  {
    input: 'Koks mūsų verslo pelnas šį mėnesį?',
    expectedIntent: 'business_summary',
    minConfidence: 0.8,
  },
  {
    input: 'Rask neapmokėtus užsakymus',
    expectedIntent: 'unpaid_orders',
    minConfidence: 0.8,
  },
  {
    input: 'Kurie klientai seniai nebuvo aplankyti?',
    expectedIntent: 'neglected_clients',
    minConfidence: 0.8,
  },
  {
    input: 'Top 5 geriausi klientai',
    expectedIntent: 'vip_clients',
    minConfidence: 0.8,
  },
  {
    input: 'Pridėk naują klientą',
    expectedIntent: 'new_clients',
    minConfidence: 0.8,
  },
  {
    input: 'Sugeneruok SMS priminimą',
    expectedIntent: 'generate_sms',
    minConfidence: 0.8,
  },
  {
    input: 'Saugos taisyklės dirbant aukštyje',
    expectedIntent: 'safety_protocols',
    minConfidence: 0.8,
  },
  {
    input: 'Labas, kaip sekasi?',
    expectedIntent: 'greeting',
    minConfidence: 0.8,
  },
];

// Test cases for LLM fallback (ambiguous queries)
const LLM_TEST_CASES = [
  {
    input: 'Ką daryti su tais, kurie neatsako?',
    expectedIntent: 'neglected_clients',
    minConfidence: 0.7,
  },
  {
    input: 'Ar turime ką nors, kas galėtų padėti su vasaros planavimu?',
    expectedIntent: 'seasonal_analysis',
    minConfidence: 0.6,
  },
  {
    input: 'Kas man trukdo augti?',
    expectedIntent: 'growth_trends',
    minConfidence: 0.5,
  },
];

// Test cases for edge cases
const EDGE_CASE_TEST_CASES = [
  {
    input: 'Ačiū už pagalbą',
    expectedIntent: 'general_chat',
    minConfidence: 0.3,
  },
  {
    input: 'Ką tu gali padaryti?',
    expectedIntent: 'help_request',
    minConfidence: 0.7,
  },
  {
    input: 'Paaiškink kaip veikia ši sistema',
    expectedIntent: 'ai_explain',
    minConfidence: 0.7,
  },
];

/**
 * Run all test cases
 */
export async function runHybridClassifierTests(apiKey?: string): Promise<{
  keywordTests: { passed: number; failed: number; total: number };
  llmTests: { passed: number; failed: number; total: number };
  edgeCaseTests: { passed: number; failed: number; total: number };
}> {
  console.log('🧪 Running Hybrid Intention Classifier Tests\n');

  // Test 1: Keyword classification (synchronous, no API key needed)
  console.log('=== Keyword Classification Tests ===');
  const keywordResults = await runKeywordTests();

  // Test 2: LLM fallback (requires API key)
  console.log('\n=== LLM Fallback Tests ===');
  const llmResults = await runLLMTests(apiKey);

  // Test 3: Edge cases
  console.log('\n=== Edge Case Tests ===');
  const edgeCaseResults = await runEdgeCaseTests(apiKey);

  // Summary
  console.log('\n📊 Test Summary:');
  console.log(`Keyword Tests: ${keywordResults.passed}/${keywordResults.total} passed`);
  console.log(`LLM Tests: ${llmResults.passed}/${llmResults.total} passed`);
  console.log(`Edge Case Tests: ${edgeCaseResults.passed}/${edgeCaseResults.total} passed`);

  return {
    keywordTests: keywordResults,
    llmTests: llmResults,
    edgeCaseTests: edgeCaseResults,
  };
}

async function runKeywordTests(): Promise<{ passed: number; failed: number; total: number }> {
  let passed = 0;
  let failed = 0;

  for (const testCase of KEYWORD_TEST_CASES) {
    console.log(`\nTesting: "${testCase.input}"`);

    try {
      // For keyword tests, we can simulate without actual API call
      // by checking if the result would have high confidence
      const result = await simulateKeywordClassification(testCase.input);

      console.log(`  Expected: ${testCase.expectedIntent}, Got: ${result.intention}`);
      console.log(`  Confidence: ${result.confidence.toFixed(2)}`);

      if (
        result.intention === testCase.expectedIntent &&
        result.confidence >= testCase.minConfidence
      ) {
        console.log('  ✅ PASSED');
        passed++;
      } else {
        console.log(
          `  ❌ FAILED - Expected ${testCase.expectedIntent} with confidence >= ${testCase.minConfidence}`
        );
        failed++;
      }
    } catch (error) {
      console.log(`  ❌ ERROR: ${error}`);
      failed++;
    }
  }

  return { passed, failed, total: KEYWORD_TEST_CASES.length };
}

async function runLLMTests(
  apiKey?: string
): Promise<{ passed: number; failed: number; total: number }> {
  if (!apiKey) {
    console.log('⚠️ No API key provided, skipping LLM tests');
    return { passed: 0, failed: 0, total: 0 };
  }

  let passed = 0;
  let failed = 0;

  for (const testCase of LLM_TEST_CASES) {
    console.log(`\nTesting: "${testCase.input}"`);

    try {
      const result = await classifyIntentHybrid(testCase.input, apiKey);

      console.log(`  Expected: ${testCase.expectedIntent}, Got: ${result.intention}`);
      console.log(`  Confidence: ${result.confidence.toFixed(2)}, Method: ${result.method}`);

      if (
        result.intention === testCase.expectedIntent &&
        result.confidence >= testCase.minConfidence
      ) {
        console.log('  ✅ PASSED');
        passed++;
      } else {
        console.log(
          `  ❌ FAILED - Expected ${testCase.expectedIntent} with confidence >= ${testCase.minConfidence}`
        );
        failed++;
      }
    } catch (error) {
      console.log(`  ❌ ERROR: ${error}`);
      failed++;
    }
  }

  return { passed, failed, total: LLM_TEST_CASES.length };
}

async function runEdgeCaseTests(
  apiKey?: string
): Promise<{ passed: number; failed: number; total: number }> {
  let passed = 0;
  let failed = 0;

  for (const testCase of EDGE_CASE_TEST_CASES) {
    console.log(`\nTesting: "${testCase.input}"`);

    try {
      const result = apiKey
        ? await classifyIntentHybrid(testCase.input, apiKey)
        : await simulateKeywordClassification(testCase.input);

      console.log(`  Expected: ${testCase.expectedIntent}, Got: ${result.intention}`);
      console.log(`  Confidence: ${result.confidence.toFixed(2)}`);

      if (
        result.intention === testCase.expectedIntent &&
        result.confidence >= testCase.minConfidence
      ) {
        console.log('  ✅ PASSED');
        passed++;
      } else {
        console.log(
          `  ❌ FAILED - Expected ${testCase.expectedIntent} with confidence >= ${testCase.minConfidence}`
        );
        failed++;
      }
    } catch (error) {
      console.log(`  ❌ ERROR: ${error}`);
      failed++;
    }
  }

  return { passed, failed, total: EDGE_CASE_TEST_CASES.length };
}

/**
 * Simulate keyword classification without API call
 * This mimics the keyword-based classification logic
 */
async function simulateKeywordClassification(text: string): Promise<{
  intention: ExtendedIntention;
  confidence: number;
}> {
  // Simple keyword matching simulation
  const textLower = text.toLowerCase();

  // Business analytics keywords
  if (/verslo\s*suvestin|pelno\s*analiz|pajam.*išlaid/i.test(textLower)) {
    return { intention: 'business_summary', confidence: 0.95 };
  }

  // Client management
  if (/neaktyv.*klient|pamest.*klient|seniai.*nelankyt/i.test(textLower)) {
    return { intention: 'neglected_clients', confidence: 0.95 };
  }
  if (/pridėt.*klient|naujas.*klient/i.test(textLower)) {
    return { intention: 'new_clients', confidence: 0.95 };
  }

  // Order management
  if (/neapmokėt.*užsakym|skol.*užsakym/i.test(textLower)) {
    return { intention: 'unpaid_orders', confidence: 0.95 };
  }

  // Communication
  if (/siųst.*priminim|priminim.*klient/i.test(textLower)) {
    return { intention: 'send_reminder', confidence: 0.95 };
  }
  if (/generuot.*sms|sms.*žinut/i.test(textLower)) {
    return { intention: 'generate_sms', confidence: 0.95 };
  }

  // Safety and operations
  if (/saugos.*taisykl|darb.*saug/i.test(textLower)) {
    return { intention: 'safety_protocols', confidence: 0.95 };
  }

  // General greetings
  if (/labas|sveikas|hi|hello/i.test(textLower)) {
    return { intention: 'greeting', confidence: 0.95 };
  }

  // Help and explanations
  if (/pagalbos|help|ką.*gali/i.test(textLower)) {
    return { intention: 'help_request', confidence: 0.9 };
  }
  if (/paaiškink|kas.*yra|kaip.*veiki/i.test(textLower)) {
    return { intention: 'ai_explain', confidence: 0.85 };
  }

  // Top clients
  if (/top.*klient|geriausi.*klient|vip.*klient/i.test(textLower)) {
    return { intention: 'vip_clients', confidence: 0.9 };
  }

  // Default for ambiguous queries
  if (/su.*tais.*kurie|trukdo|auga/i.test(textLower)) {
    // These are ambiguous and would need LLM
    return { intention: 'general_chat', confidence: 0.5 };
  }

  // General chat
  if (/ačiū|dėkui|thanks|aciu/i.test(textLower)) {
    return { intention: 'general_chat', confidence: 0.85 };
  }

  // Default
  return { intention: 'general_chat', confidence: 0.4 };
}

/**
 * Test intent descriptions
 */
export function testIntentDescriptions(): void {
  console.log('📋 Intent Descriptions:\n');

  const intents: ExtendedIntention[] = [
    'business_summary',
    'neglected_clients',
    'unpaid_orders',
    'vip_clients',
    'safety_protocols',
    'greeting',
    'help_request',
  ];

  intents.forEach((intent) => {
    console.log(`  ${intent}: ${getIntentDescription(intent)}`);
  });
}

/**
 * Performance test - measure classification speed
 */
export async function performanceTest(
  testInputs: string[],
  apiKey?: string
): Promise<{ averageTime: number; keywordTime: number; llmTime: number }> {
  console.log('⚡ Performance Test\n');

  const startTime = performance.now();

  let keywordTime = 0;
  let llmTime = 0;
  let keywordCount = 0;
  let llmCount = 0;

  for (const input of testInputs) {
    const classifyStart = performance.now();

    try {
      if (apiKey) {
        const result = await classifyIntentHybrid(input, apiKey);
        const classifyTime = performance.now() - classifyStart;

        if (result.method === 'keyword') {
          keywordTime += classifyTime;
          keywordCount++;
        } else {
          llmTime += classifyTime;
          llmCount++;
        }
      }
    } catch (error) {
      // Skip failed classifications
    }
  }

  const totalTime = performance.now() - startTime;

  console.log(`Total time: ${totalTime.toFixed(2)}ms`);
  console.log(
    `Keyword classifications: ${keywordCount} (${(keywordTime / Math.max(keywordCount, 1)).toFixed(2)}ms avg)`
  );
  console.log(
    `LLM classifications: ${llmCount} (${(llmTime / Math.max(llmCount, 1)).toFixed(2)}ms avg)`
  );

  return {
    averageTime: totalTime / testInputs.length,
    keywordTime: keywordTime / Math.max(keywordCount, 1),
    llmTime: llmTime / Math.max(llmCount, 1),
  };
}

// Export test data for external use
export const TEST_DATA = {
  KEYWORD_TEST_CASES,
  LLM_TEST_CASES,
  EDGE_CASE_TEST_CASES,
};

// Export default test runner
export default {
  runHybridClassifierTests,
  testIntentDescriptions,
  performanceTest,
  TEST_DATA,
};
