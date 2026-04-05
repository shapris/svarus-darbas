import { shouldSuggestMemory, extractKeywords, prioritizeMemories } from './memoryPriority.js';
import type { Memory } from '../types';

interface TestMemory {
  id: string;
  content: string;
  category: 'klientas' | 'verslas' | 'procesas' | 'kita';
  importance?: number;
  createdAt: string;
  uid: string;
}

let passed = 0;
let failed = 0;

function test(name: string, fn: () => void) {
  try {
    fn();
    console.log(`✅ ${name}`);
    passed++;
  } catch (e) {
    console.log(`❌ ${name}: ${e}`);
    failed++;
  }
}

function assert(condition: boolean, message?: string) {
  if (!condition) {
    throw new Error(message || 'Assertion failed');
  }
}

const mockMemories: TestMemory[] = [
  {
    id: '1',
    content: 'Svarbu: visada naudok tik kokybiškas valymo priemones',
    category: 'verslas',
    importance: 5,
    createdAt: '2026-03-01',
    uid: 'test',
  },
  {
    id: '2',
    content: 'Petras pageidauja langus valyti sekmadienį',
    category: 'klientas',
    importance: 4,
    createdAt: '2026-03-25',
    uid: 'test',
  },
  {
    id: '3',
    content: 'PVM kodas yra LT123456789',
    category: 'verslas',
    importance: 5,
    createdAt: '2026-01-15',
    uid: 'test',
  },
];

console.log('\n🧪 Pradedami testai...\n');

test('shouldSuggestMemory - atpažįsta svarbius žodžius', () => {
  const result = shouldSuggestMemory('prisimink svarbią taisyklę', 'Visada naudok', []);
  assert(result.shouldRemember === true, 'Turi siūlyti atmintį');
});

test('shouldSuggestMemory - atmeta paprastus klausimus', () => {
  const result = shouldSuggestMemory('koks šiandienos oras?', 'Oras geras', []);
  assert(result.shouldRemember === false, 'Neturi siūlyti atminties');
});

test('shouldSuggestMemory - atpažįna "svarbu"', () => {
  const response =
    'Svarbu visada laikytis taisyklių ir proceduralų. Tai yra labai svarbu mūsų verslo veikloje ir reikia tai atsiminti.';
  const result = shouldSuggestMemory('kokia tvarka?', response, []);
  assert(result.shouldRemember === true);
});

test('extractKeywords - išskiria raktažodžius', () => {
  const keywords = extractKeywords('langų valymas Klaipėdoje');
  assert(keywords.includes('langų'), 'Turi būti langų');
  assert(keywords.includes('valymas'), 'Turi būti valymas');
  assert(keywords.includes('klaipėdoje'), 'Turi būti klaipėdoje');
});

test('extractKeywords - filtruoja nereikšmingus žodžius', () => {
  const keywords = extractKeywords('ir aš noriu eiti su tavimi');
  assert(!keywords.includes('ir'), 'Neturi būti "ir"');
  assert(!keywords.includes('su'), 'Neturi būti "su"');
});

test('prioritizeMemories - rūšiuoja pagal svarbą', () => {
  const context = {
    query: 'kokios taisyklės versle?',
    userId: 'test',
    conversationHistory: [],
  };

  const result = prioritizeMemories(mockMemories as Memory[], context);
  assert(result.length > 0, 'Turi grąžinti rezultatų');
  assert(result[0].importance === 5, 'Svarbiausi pirmi');
});

test('prioritizeMemories - naudoja MAX_MEMORIES', () => {
  const manyMemories = Array.from({ length: 10 }, (_, i) => ({
    id: String(i),
    content: 'test',
    category: 'kita' as const,
    importance: 3,
    createdAt: '2026-03-27',
    uid: 'test',
  }));

  const context = { query: 'test', userId: 'test', conversationHistory: [] };
  const result = prioritizeMemories(manyMemories as Memory[], context);
  assert(result.length <= 5, 'Turi būti ribotas iki 5');
});

console.log(`\n📊 Rezultatai: ${passed} praėjo, ${failed} nepraėjo\n`);

if (failed > 0) {
  process.exit(1);
} else {
  console.log('🎉 Visi testai praėjo!\n');
}
