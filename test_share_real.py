from playwright.sync_api import sync_playwright

with sync_playwright() as p:
    browser = p.chromium.launch(headless=True)
    page = browser.new_page(viewport={"width": 1440, "height": 900})
    page.goto('http://localhost:8080', wait_until='domcontentloaded', timeout=60000)
    page.wait_for_timeout(3000)

    # 关闭欢迎弹窗 - 通过Escape
    page.keyboard.press("Escape")
    page.wait_for_timeout(500)

    # 真实点击第一个作品卡片
    page.locator(".artwork-card").first.click()
    page.wait_for_timeout(1500)

    # 真实点击分享按钮
    page.locator("#lb-share-btn").click()
    page.wait_for_timeout(800)

    # 检查菜单是否打开
    menu_open = page.evaluate("""() => {
        const menu = document.querySelector('#share-menu');
        return menu ? menu.classList.contains('open') : false;
    }""")
    print(f'1. Share menu open after real click: {menu_open}')

    # 截图
    page.screenshot(path="test_share_real.png")
    print("2. Screenshot saved")

    # 如果菜单打开，真实点击复制链接
    if menu_open:
        page.locator("#share-menu [data-action=copy]").click()
        page.wait_for_timeout(500)
        print("3. Copy link clicked via real click!")
    else:
        print("3. FAILED: Menu not open, trying JS click...")
        page.evaluate("document.querySelector('#lb-share-btn').click()")
        page.wait_for_timeout(800)
        menu_open2 = page.evaluate("document.querySelector('#share-menu')?.classList.contains('open')")
        print(f'4. Menu open after JS click: {menu_open2}')

    browser.close()
