from playwright.sync_api import sync_playwright
with sync_playwright() as p:
    browser = p.chromium.launch(headless=True)
    page = browser.new_page()
    page.goto('http://localhost:3000')
    page.wait_for_load_state('networkidle')
    title = page.title()
    text = page.locator('body').inner_text()
    browser.close()
    with open('test_result.txt', 'w', encoding='utf-8') as f:
        f.write(f'Title: {title}\n')
        f.write(f'Text: {text[:1000]}')