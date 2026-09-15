"""Comprehensive bug detection for Dreamcore"""
from playwright.sync_api import sync_playwright

with sync_playwright() as p:
    browser = p.chromium.launch(headless=True)
    page = browser.new_page(viewport={"width": 1440, "height": 900})
    page.set_default_timeout(30000)
    page.set_default_navigation_timeout(60000)

    errors = []
    warnings = []
    page.on('console', lambda msg: errors.append(msg.text) if msg.type == 'error' else (warnings.append(msg.text) if msg.type == 'warning' else None))
    page.on('pageerror', lambda err: errors.append(f'PAGE_ERROR: {err}'))

    page.goto('https://lucky-beijinho-424c27.netlify.app/', wait_until='domcontentloaded')
    page.wait_for_load_state('networkidle')
    page.wait_for_timeout(2000)

    # Dismiss welcome
    wel = page.locator('#welcome-enter')
    if wel.is_visible():
        wel.click()
        page.wait_for_timeout(500)

    print("=== 1. Control Console Errors ===")
    print(f"Errors: {len(errors)}")
    for e in errors:
        print(f"  ERROR: {e[:120]}")
    print(f"Warnings: {len(warnings)}")
    for w in warnings:
        print(f"  WARN: {w[:120]}")

    print("\n=== 2. Network Errors (404/500) ===")
    failed_requests = []
    def on_response(response):
        if response.status >= 400:
            failed_requests.append(f"{response.status} {response.url[:80]}")
    page.on('response', on_response)
    page.reload()
    page.wait_for_load_state('networkidle')
    page.wait_for_timeout(2000)
    print(f"Failed requests: {len(failed_requests)}")
    for r in failed_requests:
        print(f"  {r}")

    print("\n=== 3. Lightbox Bug Analysis ===")
    wel2 = page.locator('#welcome-enter')
    if wel2.is_visible():
        wel2.click()
        page.wait_for_timeout(500)

    page.evaluate("document.getElementById('gallery')?.scrollIntoView()")
    page.wait_for_timeout(1000)
    page.locator('article.artwork-card').first.click()
    page.wait_for_timeout(1500)

    lb_debug = page.evaluate("""() => {
        const lb = document.getElementById('lightbox-modal');
        const media = document.getElementById('lb-media-container');
        const img = document.getElementById('lb-main-img');
        const artNo = lb?.querySelector('.lb-art-no');
        const spinner = lb?.querySelector('.lb-spinner');

        const imgRect = img?.getBoundingClientRect();
        const artNoRect = artNo?.getBoundingClientRect();
        const spinnerRect = spinner?.getBoundingClientRect();

        const artNoCs = artNo ? getComputedStyle(artNo) : {};
        const mediaCs = media ? getComputedStyle(media) : {};

        return {
            image: imgRect ? { left: Math.round(imgRect.left), top: Math.round(imgRect.top), width: Math.round(imgRect.width), height: Math.round(imgRect.height) } : null,
            artNo: artNoRect ? { left: Math.round(artNoRect.left), top: Math.round(artNoRect.top), width: Math.round(artNoRect.width), height: Math.round(artNoRect.height), position: artNoCs.position, bottom: artNoCs.bottom, left_css: artNoCs.left, zIndex: artNoCs.zIndex } : null,
            spinner: spinnerRect ? { left: Math.round(spinnerRect.left), top: Math.round(spinnerRect.top), width: Math.round(spinnerRect.width), height: Math.round(spinnerRect.height), display: spinner ? getComputedStyle(spinner).display : null } : null,
            mediaHeight: media ? { height: Math.round(media.getBoundingClientRect().height), minHeight: mediaCs.minHeight, maxHeight: mediaCs.maxHeight } : null
        };
    }""")

    print(f"Image rect: {lb_debug['image']}")
    print(f"ArtNo rect: {lb_debug['artNo']}")
    print(f"Spinner rect: {lb_debug['spinner']}")
    print(f"Media height: {lb_debug['mediaHeight']}")

    print("\n=== 4. Theme Toggle ===")
    page.keyboard.press('Escape')
    page.wait_for_timeout(300)
    theme_before = page.evaluate("() => document.documentElement.getAttribute('data-theme')")
    page.locator('#btn-theme').click()
    page.wait_for_timeout(500)
    theme_after = page.evaluate("() => document.documentElement.getAttribute('data-theme')")
    print(f"Theme before: {theme_before}, after: {theme_after}")

    print("\n=== 5. Search Functionality ===")
    page.locator('#btn-search').click()
    page.wait_for_timeout(500)
    search_open = page.evaluate("() => document.getElementById('search-modal')?.classList.contains('open')")
    print(f"Search modal open: {search_open}")
    if search_open:
        page.locator('#search-input').fill('雨')
        page.wait_for_timeout(1000)
        results = page.evaluate("() => document.querySelectorAll('.search-card').length")
        print(f"Search results for '雨': {results}")
        page.keyboard.press('Escape')
        page.wait_for_timeout(300)

    print("\n=== 6. Responsive (Mobile 375x812) ===")
    page.set_viewport_size({"width": 375, "height": 812})
    page.goto('https://lucky-beijinho-424c27.netlify.app/', wait_until='domcontentloaded')
    page.wait_for_load_state('networkidle')
    page.wait_for_timeout(2000)
    wel3 = page.locator('#welcome-enter')
    if wel3.is_visible():
        wel3.click()
        page.wait_for_timeout(500)

    mobile_checks = page.evaluate("""() => {
        const navbar = document.getElementById('navbar');
        const gallery = document.getElementById('gallery-grid');
        const menuToggle = document.getElementById('menu-toggle');
        return {
            navbarVisible: navbar?.offsetHeight > 0,
            galleryVisible: gallery?.offsetHeight > 0,
            menuToggleVisible: menuToggle?.offsetHeight > 0,
            viewportWidth: window.innerWidth
        };
    }""")
    print(f"Mobile checks: {mobile_checks}")

    print("\n=== Summary ===")
    print(f"Console errors: {len(errors)}")
    print(f"Failed network requests: {len(failed_requests)}")

    browser.close()
