"""CLS measurement test"""
from playwright.sync_api import sync_playwright

with sync_playwright() as p:
    browser = p.chromium.launch(headless=True)
    page = browser.new_page()
    page.set_default_timeout(60000)
    page.set_default_navigation_timeout(120000)
    
    page.goto('http://localhost:5173/', wait_until='domcontentloaded')
    page.wait_for_load_state('networkidle')
    page.wait_for_timeout(3000)
    
    cls = page.evaluate("""() => {
        return new Promise(resolve => {
            let clsValue = 0;
            const observer = new PerformanceObserver((list) => {
                for (const entry of list.getEntries()) {
                    if (!entry.hadRecentInput) clsValue += entry.value;
                }
            });
            observer.observe({ type: 'layout-shift', buffered: true });
            setTimeout(() => {
                observer.disconnect();
                resolve(clsValue);
            }, 2000);
        });
    }""")
    
    rating = 'good' if cls < 0.1 else 'needs improvement' if cls < 0.25 else 'poor'
    print(f'CLS: {cls:.4f}')
    print(f'Rating: {rating}')
    
    browser.close()
