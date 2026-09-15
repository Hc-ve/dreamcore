from playwright.sync_api import sync_playwright

with sync_playwright() as p:
    browser = p.chromium.launch(headless=True)
    page = browser.new_page()
    page.goto('http://localhost:8080', wait_until='domcontentloaded', timeout=60000)
    page.wait_for_timeout(3000)

    # 关闭欢迎弹窗
    page.evaluate("() => { const m = document.querySelector('.welcome-modal'); if (m) m.classList.remove('open'); }")
    page.wait_for_timeout(500)

    # 点击第一个作品
    page.evaluate("document.querySelector('.artwork-card').click()")
    page.wait_for_timeout(1500)

    # 点击分享按钮
    page.evaluate("document.querySelector('#lb-share-btn').click()")
    page.wait_for_timeout(800)

    # 检查菜单
    result = page.evaluate("""() => {
        const menu = document.querySelector('#share-menu');
        return menu ? {
            exists: true,
            open: menu.classList.contains('open'),
            className: menu.className
        } : { exists: false };
    }""")
    print('Share menu:', result)

    # 如果菜单打开，测试复制链接
    if result.get('open'):
        page.evaluate("document.querySelector('#share-menu [data-action=copy]').click()")
        page.wait_for_timeout(500)
        print('Copy link clicked!')

    browser.close()
