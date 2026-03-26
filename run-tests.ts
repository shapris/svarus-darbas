import { getIntentDescription, classifyIntentHybrid, ExtendedIntention } from './src/services/hybridClassifier';

console.log('🧪 HYBRID CLASSIFIER TESTS\n');
console.log('=== Intent Descriptions ===');
const intents: ExtendedIntention[] = [
  'business_summary',
  'neglected_clients', 
  'unpaid_orders',
  'vip_clients',
  'safety_protocols',
  'greeting',
  'help_request',
  'new_clients'
];

intents.forEach(intent => {
  console.log(`  ${intent}: ${getIntentDescription(intent)}`);
});

console.log('\n=== Classification Tests ===');

const testCases = [
  'Koks mūsų verslo pelnas šį mėnesį?',
  'Rask neapmokėtus užsakymus',
  'Kurie klientai seniai nebuvo aplankyti?',
  'Top 5 geriausi klientai',
  'Pridėk naują klientą',
  'Sugeneruok SMS priminimą',
  'Saugos taisyklės dirbant aukštyje',
  'Labas, kaip sekasi?'
];

const apiKey = '';

for (const input of testCases) {
  const result = await classifyIntentHybrid(input, apiKey);
  console.log(`\n"${input}"`);
  console.log(`  → ${result.intention} (${result.method}, conf: ${result.confidence.toFixed(2)})`);
}

console.log('\n✅ Tests completed!');
