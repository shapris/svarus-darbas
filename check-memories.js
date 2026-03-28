// Check localStorage for any memory data
const keys = Object.keys(localStorage);
console.log('=== localStorage Keys ===');
keys.forEach(k => {
  if (k.includes('memory') || k.includes('Memory') || k.includes('prisim')) {
    console.log(`FOUND: ${k}`);
  }
});

console.log('\n=== All keys with "svaraus" ===');
keys.filter(k => k.includes('svaraus')).forEach(k => {
  console.log(k);
});

console.log('\n=== memories collection ===');
const memData = localStorage.getItem('svaraus_darbas_memories');
if (memData) {
  const memories = JSON.parse(memData);
  console.log(`Found ${memories.length} memories:`);
  memories.forEach((m, i) => {
    console.log(`${i+1}. [${m.category}] ${m.content.substring(0, 50)}...`);
  });
} else {
  console.log('No memories in localStorage');
}
