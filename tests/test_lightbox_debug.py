"""Debug lightbox image coverage issue"""
from playwright.sync_api import sync_playwright

with sync_playwright() as p:
    browser = p.chromium.launch(headless=True)
    page = browser.new_page(viewport={"width": 1440, "height": 900})
    page.set_default_timeout(30000)
    page.set_default_navigation_timeout(60000)

    page.goto('https://lucky-beijinho-424c27.netlify.app/', wait_until='domcontentloaded')
    page.wait_for_load_state('networkidle')
    page.wait_for_timeout(2000)

    # Dismiss welcome
    wel = page.locator('#welcome-enter')
    if wel.is_visible():
        wel.click()
        page.wait_for_timeout(500)

    # Scroll to gallery and click first card
    page.evaluate("document.getElementById('gallery')?.scrollIntoView()")
    page.wait_for_timeout(1000)
    page.locator('article.artwork-card').first.click()
    page.wait_for_timeout(1500)

    # Check if lightbox is open
    lb_open = page.evaluate("() => document.getElementById('lightbox-modal')?.classList.contains('open')")
    print(f"Lightbox open: {lb_open}")

    # Detailed layout analysis
    result = page.evaluate("""() => {
        const lb = document.getElementById('lightbox-modal');
        const box = document.getElementById('lightbox-box');
        const media = document.getElementById('lb-media-container');
        const img = document.getElementById('lb-main-img');
        const side = lb?.querySelector('.lb-side');
        const prev = lb?.querySelector('.lb-prev');
        const next = lb?.querySelector('.lb-next');
        const close = lb?.querySelector('[data-lb-close]');

        const getRect = (el) => {
            if (!el) return null;
            const r = el.getBoundingClientRect();
            const cs = getComputedStyle(el);
            return {
                left: Math.round(r.left),
                top: Math.round(r.top),
                width: Math.round(r.width),
                height: Math.round(r.height),
                right: Math.round(r.right),
                bottom: Math.round(r.bottom),
                position: cs.position,
                zIndex: cs.zIndex,
                overflow: cs.overflow,
                display: cs.display
            };
        };

        // Check what element is at the left edge of the image
        const imgRect = img?.getBoundingClientRect();
        let leftEdge = null;
        if (imgRect) {
            const checkX = imgRect.left + 20;
            const checkY = imgRect.top + imgRect.height / 2;
            const topEl = document.elementFromPoint(checkX, checkY);
            leftEdge = {
                x: checkX,
                y: checkY,
                element: topEl ? {
                    tag: topEl.tagName,
                    className: topEl.className?.substring(0, 60),
                    id: topEl.id
                } : 'none'
            };
        }

        // Check overlaps
        const overlaps = [];
        const allOverlays = lb?.querySelectorAll('.lb-nav, .modal-close, .lb-art-no, .lb-spinner');
        if (allOverlays && imgRect) {
            allOverlays.forEach(el => {
                const r = el.getBoundingClientRect();
                if (r.left < imgRect.right && r.right > imgRect.left &&
                    r.top < imgRect.bottom && r.bottom > imgRect.top) {
                    overlaps.push({
                        className: el.className?.substring(0, 40),
                        rect: { left: Math.round(r.left), top: Math.round(r.top), width: Math.round(r.width), height: Math.round(r.height) }
                    });
                }
            });
        }

        return {
            modal: getRect(lb),
            box: getRect(box),
            media: getRect(media),
            image: getRect(img),
            side: getRect(side),
            prev: getRect(prev),
            next: getRect(next),
            close: getRect(close),
            leftEdgeCheck: leftEdge,
            overlaps: overlaps
        };
    }""")

    print("\n=== Lightbox Layout ===")
    for key, val in result.items():
        if key == 'leftEdgeCheck':
            print(f"\n--- Element at left edge of image ---")
            print(f"  Check point: ({val['x']}, {val['y']})")
            print(f"  Element: {val['element']}")
        elif key == 'overlaps':
            print(f"\n--- Elements overlapping image ---")
            for o in val:
                print(f"  {o['className']} at {o['rect']}")
        else:
            print(f"\n{key}:")
            if val:
                for k, v in val.items():
                    print(f"  {k}: {v}")
            else:
                print(f"  null")

    browser.close()
