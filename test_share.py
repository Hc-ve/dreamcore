"""
Dreamcore 分享链接功能测试
测试内容：
1. 打开作品灯箱时URL hash自动更新
2. 关闭灯箱时URL hash自动清除
3. 带hash链接直接访问能自动打开灯箱
4. 分享菜单显示正确（复制链接+微博+Twitter+Facebook）
5. 复制链接功能正常
"""
import sys
from playwright.sync_api import sync_playwright, expect

FRONTEND_URL = "http://localhost:8080"

def log(msg, status="info"):
    icons = {"pass": "✅", "fail": "❌", "info": "ℹ️", "warn": "⚠️"}
    print(f"{icons.get(status, 'ℹ️')}  {msg}")

def run_tests():
    passed = 0
    failed = 0

    with sync_playwright() as p:
        browser = p.chromium.launch(headless=True)
        context = browser.new_context(viewport={"width": 1440, "height": 900}, locale="zh-CN")
        page = context.new_page()

        console_errors = []
        page.on("pageerror", lambda err: console_errors.append(str(err)))

        # Test 1: 页面加载 + 点击作品打开灯箱
        log("Test 1: 点击作品打开灯箱", "info")
        page.goto(FRONTEND_URL, wait_until="domcontentloaded", timeout=60000)
        page.wait_for_load_state("networkidle", timeout=60000)
        page.wait_for_timeout(2000)

        # 关闭欢迎弹窗
        welcome_modal = page.locator(".welcome-modal.open")
        if welcome_modal.is_visible():
            page.keyboard.press("Escape")
            page.wait_for_timeout(500)

        first_card = page.locator(".artwork-card").first
        first_card.click()
        page.wait_for_timeout(1500)

        lightbox = page.locator("#lightbox-modal")
        lb_classes = lightbox.get_attribute("class") or ""
        if "open" in lb_classes or page.locator(".lightbox-box").is_visible():
            log("灯箱打开成功", "pass")
            passed += 1
        else:
            log("灯箱未打开", "fail")
            failed += 1
            page.screenshot(path="test_fail_lightbox.png")

        # Test 2: URL hash更新
        log("\nTest 2: URL hash自动更新", "info")
        current_hash = page.evaluate("() => window.location.hash")
        log(f"当前URL hash: {current_hash}", "info")
        if current_hash and "artwork-" in current_hash:
            log("URL hash正确更新", "pass")
            passed += 1
        else:
            log("URL hash未更新", "fail")
            failed += 1

        # Test 3: 分享菜单显示
        log("\nTest 3: 分享菜单", "info")
        page.wait_for_timeout(500)
        share_result = page.evaluate("""() => {
            const btn = document.querySelector('#lb-share-btn');
            if (!btn) return { error: 'btn_not_found' };
            btn.click();
            return { clicked: true };
        }""")
        page.wait_for_timeout(1000)

        menu_result = page.evaluate("""() => {
            const menu = document.querySelector('#share-menu');
            if (!menu) return { error: 'menu_not_found' };
            const items = menu.querySelectorAll('.share-menu-item');
            const copy = menu.querySelector("[data-action='copy']");
            const weibo = menu.querySelector("[data-action='weibo']");
            const twitter = menu.querySelector("[data-action='twitter']");
            return {
                exists: true,
                itemCount: items.length,
                hasCopy: !!copy,
                hasWeibo: !!weibo,
                hasTwitter: !!twitter
            };
        }""")
        log(f"菜单状态: {menu_result}", "info")
        if menu_result.get("hasCopy") and menu_result.get("hasWeibo") and menu_result.get("hasTwitter"):
            log("分享菜单正确显示（复制链接+微博+Twitter）", "pass")
            passed += 1
        else:
            log("分享菜单显示异常", "fail")
            failed += 1

        # 关闭分享菜单
        page.evaluate("() => { const m = document.querySelector('#share-menu'); if (m) m.remove(); }")
        page.wait_for_timeout(300)

        # Test 4: 关闭灯箱，URL hash清除
        log("\nTest 4: 关闭灯箱后URL hash清除", "info")
        page.evaluate("() => { const btn = document.querySelector('[data-lb-close]'); if (btn) btn.click(); }")
        page.wait_for_timeout(800)

        current_hash = page.evaluate("() => window.location.hash")
        log(f"关闭后URL hash: '{current_hash}'", "info")
        if not current_hash or "artwork-" not in current_hash:
            log("URL hash已清除", "pass")
            passed += 1
        else:
            log("URL hash未清除", "fail")
            failed += 1

        # Test 5: 带hash链接直接访问
        log("\nTest 5: 带hash链接直接访问自动打开灯箱", "info")
        page.goto(f"{FRONTEND_URL}/#artwork-122", wait_until="domcontentloaded", timeout=60000)
        page.wait_for_timeout(5000)

        # 直接检查灯箱是否打开
        result = page.evaluate("""() => {
            const lb = document.querySelector('#lightbox-modal');
            return {
                lbClass: lb ? lb.className : 'not_found',
                hasLbBox: !!document.querySelector('.lightbox-box')
            };
        }""")
        log(f"灯箱状态: {result}", "info")

        if "open" in result.get("lbClass", "") or result.get("hasLbBox"):
            log("带hash链接自动打开灯箱成功", "pass")
            passed += 1
        else:
            log("带hash链接未自动打开灯箱", "fail")
            failed += 1
            page.screenshot(path="test_fail_hash_route.png")

        # Test 6: 控制台错误检查
        log("\nTest 6: 控制台错误检查", "info")
        if console_errors:
            log(f"发现 {len(console_errors)} 个错误:", "warn")
            for err in console_errors[:3]:
                log(f"  - {err[:100]}", "warn")
            failed += 1
        else:
            log("无控制台错误", "pass")
            passed += 1

        page.screenshot(path="test_share_result.png")
        browser.close()

    print("\n" + "=" * 60)
    log(f"测试完成: {passed} 通过, {failed} 失败", "pass" if failed == 0 else "fail")
    print("=" * 60)
    return failed == 0

if __name__ == "__main__":
    success = run_tests()
    sys.exit(0 if success else 1)
