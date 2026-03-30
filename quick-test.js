const puppeteer = require('puppeteer');

(async () => {
  const browser = await puppeteer.launch({ headless: true });
  const page = await browser.newPage();
  
  const errors = [];
  const debugMessages = [];
  
  page.on('console', msg => {
    const text = msg.text();
    if (msg.type() === 'error' && !text.includes('workbox')) {
      errors.push(text);
      console.log('ERROR:', text.substring(0, 100));
    }
    if (text.includes('[DEBUG]') || text.includes('Could not find') || text.includes('406') || text.includes('400')) {
      debugMessages.push(text);
      console.log('DEBUG:', text.substring(0, 100));
    }
  });
  
  try {
    await page.goto('http://localhost:3011/', { waitUntil: 'networkidle2', timeout: 30000 });
    await new Promise(r => setTimeout(r, 5000));
    
    console.log('\n=== REZULTATAI ===');
    console.log('Klaidų:', errors.length);
    console.log('Debug pranešimų:', debugMessages.length);
    
    if (errors.length === 0 && debugMessages.filter(m => m.includes('Could not find') || m.includes('406')).length === 0) {
      console.log('✅ VISKAS GERAI - jokių kritinių klaidų!');
    } else {
      console.log('❌ RASTOS KLaidOS:');
      errors.slice(0, 3).forEach(e => console.log(' -', e.substring(0, 80)));
      debugMessages.filter(m => m.includes('Could not find') || m.includes('406')).slice(0, 3).forEach(m => console.log(' -', m.substring(0, 80)));
    }
  } catch (e) {
    console.log('Test error:', e.message);
  }
  
  await browser.close();
})();
