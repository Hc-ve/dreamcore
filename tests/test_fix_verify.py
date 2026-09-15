"""Verify all bug fixes locally"""
from playwright.sync_api import sync_playwright

with sync_playwright() as p:
    browser = p.chromium.launch(headless=True)
    page = browser.new_page(viewport={"width": 1440, "height": 900})
    page.set_default_timeout(30000)
    page.set_default_navigation_timeout(60000)

    errors = []
    page.on('pageerror', lambda err: errors.append(str(err)))

    print("=== Bug Fix Verification ===\n")

    # 1. Verify Lightbox fix
    print("1. Lightbox image coverage fix:")
    page.goto('http://localhost:5173/', wait_until='domcontentloaded')
    page.wait_for_load_state('networkidle')
    page.wait_for_timeout(2000)

    wel = page.locator('#welcome-enter')
    if wel.is_visible():
        wel.click()
        page.wait_for_timeout(500)

    page.evaluate("document.getElementById('gallery')?.scrollIntoView()")
    page.wait_for_timeout(1000)
    page.locator('article.artwork-card').first.click()
    page.wait_for_timeout(2000)

    lb_fix = page.evaluate("""() => {
        const img = document.getElementById('lb-main-img');
        const artNo = document.querySelector('.lb-art-no');
        const spinner = document.getElementById('lb-spinner');
        const media = document.getElementById('lb-media-container');

        const imgRect = img?.getBoundingClientRect();
        const artNoRect = artNo?.getBoundingClientRect();
        const artNoCs = artNo ? getComputedStyle(artNo) : {};
        const mediaCs = media ? getComputedStyle(media) : {};

        return {
            artNo_width: artNoRect ? Math.round(artNoRect.width) : null,
            artNo_height: artNoRect ? Math.round(artNoRect.height) : null,
            artNo_pointerEvents: artNoCs.pointerEvents,
            media_overflow: mediaCs.overflow,
            spinner_display: spinner ? getComputedStyle(spinner).display : null,
            img_loaded: img ? img.complete && img.naturalHeight > 0 : false,
        };
    }""")

    artNo_ok = lb_fix['artNo_width'] < 200
    spinner_ok = lb_fix['spinner_display'] == 'none'
    overflow_ok = lb_fix['media_overflow'] == 'hidden'
    img_ok = lb_fix['img_loaded']

    print(f"   ArtNo width: {lb_fix['artNo_width']}px ({'FIXED' if artNo_ok else 'STILL BROKEN'})")
    print(f"   ArtNo height: {lb_fix['artNo_height']}px")
    print(f"   ArtNo pointer-events: {lb_fix['artNo_pointerEvents']}")
    print(f"   Media overflow: {lb_fix['media_overflow']} ({'OK' if overflow_ok else 'ISSUE'})")
    print(f"   Spinner hidden: {lb_fix['spinner_display']} ({'OK' if spinner_ok else 'ISSUE'})")
    print(f"   Image loaded: {lb_fix['img_loaded']} ({'OK' if img_ok else 'ISSUE'})")
    print(f"   Result: {'PASS' if artNo_ok and spinner_ok and overflow_ok and img_ok else 'FAIL'}")

    page.keyboard.press('Escape')
    page.wait_for_timeout(300)

    # 2. Verify console errors
    print(f"\n2. Console errors: {len(errors)} ({'PASS' if len(errors) == 0 else 'CHECK'})")
    for e in errors[:5]:
        print(f"   - {e[:80]}")

    # 3. Verify Sentry removed
    print(f"\n3. Sentry DSN error removed:")
    sentry_in_page = page.evaluate("() => typeof window.Sentry !== 'undefined' || document.body.innerHTML.includes('your-dsn')")
    print(f"   Sentry placeholder present: {sentry_in_page} ({'PASS' if not sentry_in_page else 'STILL PRESENT'})")

    browser.close()

    print(f"\n{'='*40}")
    all_pass = artNo_ok and spinner_ok and overflow_ok and img_ok and not sentry_in_page
    print(f"Overall: {'ALL FIXES VERIFIED' if all_pass else 'SOME ISSUES REMAIN'}")
