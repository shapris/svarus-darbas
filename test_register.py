from playwright.sync_api import sync_playwright
import time
with sync_playwright() as p:
    browser = p.chromium.launch(headless=True)
    page = browser.new_page()
    page.goto('http://localhost:3000')
    page.wait_for_load_state('networkidle')
    
    # Click "Sukurti paskyrą" (Register)
    page.locator('button:has-text("Sukurti paskyrą")').click()
    time.sleep(1)
    
    # Fill form
    page.locator('input[type="email"]').fill('testas@test.com')
    page.locator('input[type="password"]').first.fill('testas123')
    page.locator('input[type="text"]').fill('Testas Vartotojas')
    
    # Submit
    page.locator('button:has-text("Sukurti paskyrą")').click()
    time.sleep(3)
    
    # Get result
    text = page.locator('body').inner_text()
    with open('test_register_result.txt', 'w', encoding='utf-8') as f:
        f.write(f'Result: {text[:1500]}')
    browser.close()