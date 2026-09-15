"""验证Cloudflare Pages部署"""
from playwright.sync_api import sync_playwright

with sync_playwright() as p:
    browser = p.chromium.launch(headless=True)
    page = browser.new_page(viewport={"width": 1440, "height": 900})
    page.set_default_timeout(30000)
    page.set_default_navigation_timeout(60000)

    print("=== 访问部署链接 ===")
    try:
        page.goto('https://throbbing-bar-f9bb.1559164272.workers.dev/', wait_until='domcontentloaded')
        page.wait_for_load_state('networkidle')
        page.wait_for_timeout(2000)

        title = page.title()
        print(f"页面标题: {title}")

        # 检查关键元素
        has_hero = page.locator('#hero').count() > 0
        has_gallery = page.locator('#gallery').count() > 0
        has_nav = page.locator('#navbar').count() > 0
        print(f"Hero区域: {has_hero}")
        print(f"画廊区域: {has_gallery}")
        print(f"导航栏: {has_nav}")

        # 截图
        page.screenshot(path='tests/deploy_screenshot.png', full_page=False)
        print("截图已保存: tests/deploy_screenshot.png")

        # 检查privacy.html
        page.goto('https://throbbing-bar-f9bb.1559164272.workers.dev/privacy.html', wait_until='domcontentloaded')
        page.wait_for_load_state('networkidle')
        privacy_ok = '隐私政策' in page.content()
        print(f"隐私政策页面: {'OK' if privacy_ok else 'FAIL'}")

        print("\n✅ 部署验证完成！")
    except Exception as e:
        print(f"❌ 访问失败: {str(e)[:200]}")

    browser.close()
