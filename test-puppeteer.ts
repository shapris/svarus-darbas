import puppeteer from 'puppeteer';

async function testApplication() {
    console.log('🚀 Starting Puppeteer test...\n');
    
    const browser = await puppeteer.launch({
        headless: true,
        args: ['--no-sandbox', '--disable-setuid-sandbox']
    });
    
    const page = await browser.newPage();
    
    // Capture console messages
    const consoleMessages = [];
    page.on('console', msg => {
        const text = msg.text();
        const type = msg.type();
        consoleMessages.push({ type, text });
        
        // Show important messages immediately
        if (type === 'error' && !text.includes('workbox')) {
            console.log(`❌ Console Error: ${text}`);
        }
        if (text.includes('[DEBUG]')) {
            console.log(`🔍 ${text}`);
        }
    });
    
    // Capture network errors
    page.on('requestfailed', request => {
        const url = request.url();
        if (url.includes('supabase')) {
            console.log(`❌ Network Error: ${request.method()} ${url}`);
            console.log(`   Failure: ${request.failure()?.errorText}`);
        }
    });
    
    try {
        // Navigate to app
        console.log('📱 Opening http://localhost:3007/...');
        await page.goto('http://localhost:3007/', { 
            waitUntil: 'networkidle2',
            timeout: 30000 
        });
        
        // Wait for app to load
        await new Promise(r => setTimeout(r, 5000));
        
        console.log('\n📊 Test Results:');
        console.log('================');
        
        // Check for specific errors
        const errors = consoleMessages.filter(m => 
            m.type === 'error' && 
            !m.text.includes('workbox') &&
            !m.text.includes('Socket')
        );
        
        const debugMessages = consoleMessages.filter(m => 
            m.text.includes('[DEBUG]')
        );
        
        const supabaseErrors = consoleMessages.filter(m => 
            m.text.includes('406') || 
            m.text.includes('400') || 
            m.text.includes('column') ||
            m.text.includes('uid')
        );
        
        console.log(`\n✅ Debug messages: ${debugMessages.length}`);
        debugMessages.slice(0, 5).forEach(m => console.log(`   ${m.text.substring(0, 80)}...`));
        
        console.log(`\n❌ Errors: ${errors.length}`);
        errors.slice(0, 5).forEach(m => console.log(`   ${m.text.substring(0, 100)}`));
        
        console.log(`\n🔴 Supabase errors: ${supabaseErrors.length}`);
        supabaseErrors.forEach(m => console.log(`   ${m.text.substring(0, 100)}`));
        
        // Take screenshot
        await page.screenshot({ 
            path: 'test-screenshot.png',
            fullPage: true 
        });
        console.log('\n📸 Screenshot saved: test-screenshot.png');
        
        // Summary
        console.log('\n🎯 SUMMARY:');
        console.log('===========');
        if (errors.length === 0 && supabaseErrors.length === 0) {
            console.log('✅ ALL TESTS PASSED - No errors found!');
        } else if (supabaseErrors.length > 0) {
            console.log('❌ SUPABASE ERRORS DETECTED - Need fixes');
        } else {
            console.log('⚠️  Minor errors found (not Supabase related)');
        }
        
    } catch (error) {
        console.error('💥 Test failed:', error.message);
    } finally {
        await browser.close();
        console.log('\n🏁 Test complete');
    }
}

testApplication();
