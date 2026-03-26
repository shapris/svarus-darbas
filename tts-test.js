/**
 * TTS Test - Tests browser voice availability and quality
 */

console.log('='.repeat(50));
console.log('🧪 TTS TYRIMAS - Lithuanian Voice Test');
console.log('='.repeat(50));

// Wait for voices to load
const init = () => {
  const synth = window.speechSynthesis;
  const voices = synth.getVoices();
  
  console.log(`\n📊 Rasta balsų: ${voices.length}`);
  
  // Analyze available languages
  const languages = new Set();
  voices.forEach(v => languages.add(v.lang.split('-')[0]));
  
  console.log(`\n🌐 Kalbos: ${Array.from(languages).join(', ')}`);
  
  // Find Lithuanian voices
  console.log('\n🇱🇹 Lietuvių balsai:');
  const ltVoices = voices.filter(v => v.lang.startsWith('lt'));
  if (ltVoices.length > 0) {
    ltVoices.forEach(v => console.log(`   ✓ ${v.name} (${v.lang})`));
  } else {
    console.log('   ✗ Nėra');
  }
  
  // Find closest alternatives
  console.log('\n🔄 Artimiausios alternatyvos:');
  const plVoices = voices.filter(v => v.lang.startsWith('pl'));
  const ruVoices = voices.filter(v => v.lang.startsWith('ru'));
  const deVoices = voices.filter(v => v.lang.startsWith('de'));
  const enVoices = voices.filter(v => v.lang.startsWith('en'));
  
  if (plVoices.length) console.log(`   🇵🇱 Lenkų: ${plVoices.length}`);
  if (ruVoices.length) console.log(`   🇷🇺 Rusų: ${ruVoices.length}`);
  if (deVoices.length) console.log(`   🇩🇪 Vokiečių: ${deVoices.length}`);
  if (enVoices.length) console.log(`   🇬🇧 Anglų: ${enVoices.length}`);
  
  // Test speaking
  console.log('\n🗣️ Testuojame kalbėjimą...');
  testSpeaking();
};

const testSpeaking = () => {
  const synth = window.speechSynthesis;
  const voices = synth.getVoices();
  const testText = 'Sveiki! Aš esu jūsų asistentas. Kaip jums sekasi šiandien?';
  
  // Try different approaches
  const tests = [
    { name: 'LT Exact', lang: 'lt-LT', voice: voices.find(v => v.lang === 'lt-LT') },
    { name: 'LT Broad', lang: 'lt', voice: voices.find(v => v.lang.startsWith('lt')) },
    { name: 'PL Fallback', lang: 'pl-PL', voice: voices.find(v => v.lang.startsWith('pl')) },
    { name: 'EN Default', lang: 'en-US', voice: voices[0] },
  ];
  
  let index = 0;
  
  const runTest = () => {
    if (index >= tests.length) {
      console.log('\n✅ Testavimas baigtas');
      return;
    }
    
    const t = tests[index];
    if (!t.voice) {
      console.log(`   ${t.name}: praleista (nėra balso)`);
      index++;
      runTest();
      return;
    }
    
    const utterance = new SpeechSynthesisUtterance(testText);
    utterance.voice = t.voice;
    utterance.lang = t.lang;
    utterance.rate = 0.9;
    utterance.volume = 1;
    
    console.log(`   ${t.name}: ${t.voice.name}...`);
    
    utterance.onend = () => {
      console.log(`      ✓ Baigė`);
      index++;
      setTimeout(runTest, 500);
    };
    
    utterance.onerror = (e) => {
      console.log(`      ✗ Klaida: ${e.error}`);
      index++;
      setTimeout(runTest, 500);
    };
    
    synth.speak(utterance);
  };
  
  runTest();
};

// Initialize
if (window.speechSynthesis.getVoices().length > 0) {
  init();
} else {
  window.speechSynthesis.onvoiceschanged = init;
}
