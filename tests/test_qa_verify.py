"""验证质检报告中的8个问题"""
from playwright.sync_api import sync_playwright
import os
import json

RESULTS = []

def record(bug_id, name, status, detail=""):
    RESULTS.append({"id": bug_id, "name": name, "status": status, "detail": detail})
    print(f"  [{status}] {bug_id} {name}{' - ' + detail if detail else ''}")

def dismiss_welcome(page):
    page.wait_for_timeout(500)
    wel = page.locator('#welcome-enter')
    if wel.is_visible():
        wel.click()
        page.wait_for_timeout(500)

with sync_playwright() as p:
    browser = p.chromium.launch(headless=True)
    page = browser.new_page(viewport={"width": 1440, "height": 900})
    page.set_default_timeout(60000)
    page.set_default_navigation_timeout(120000)

    # --- Bug1: 作品详情页面能否打开 ---
    print("\n=== Bug1: 作品详情页面 ===")
    page.goto('http://localhost:5173/', wait_until='domcontentloaded')
    page.wait_for_load_state('networkidle')
    page.wait_for_timeout(1500)
    dismiss_welcome(page)

    page.evaluate("document.getElementById('gallery')?.scrollIntoView()")
    page.wait_for_timeout(1000)

    first_card = page.locator('article.artwork-card').first
    first_card.wait_for(state='visible', timeout=10000)
    first_card.click()
    page.wait_for_timeout(1500)

    lb_open = page.evaluate("""() => {
        const lb = document.getElementById('lightbox-modal');
        return lb && lb.classList.contains('open');
    }""")
    record("Bug1", "作品详情(灯箱)", "PASS" if lb_open else "FAIL",
           "灯箱成功打开" if lb_open else "灯箱未打开")

    if lb_open:
        page.keyboard.press('Escape')
        page.wait_for_timeout(300)

    # --- Bug2: 页脚链接 ---
    print("\n=== Bug2: 页脚链接 ===")
    page.evaluate("document.querySelector('footer')?.scrollIntoView()")
    page.wait_for_timeout(500)

    privacy_link = page.evaluate("""() => {
        const links = document.querySelectorAll('footer a');
        for (const l of links) {
            if (l.textContent.includes('隐私')) return { href: l.href, text: l.textContent };
        }
        return null;
    }""")
    terms_link = page.evaluate("""() => {
        const links = document.querySelectorAll('footer a');
        for (const l of links) {
            if (l.textContent.includes('协议')) return { href: l.href, text: l.textContent };
        }
        return null;
    }""")
    record("Bug2a", "隐私政策链接", "PASS" if privacy_link and privacy_link.get('href') else "FAIL",
           f"href={privacy_link.get('href', '') if privacy_link else 'not found'}")
    record("Bug2b", "用户协议链接", "PASS" if terms_link and terms_link.get('href') else "FAIL",
           f"href={terms_link.get('href', '') if terms_link else 'not found'}")

    # 实际导航测试
    if privacy_link and privacy_link.get('href'):
        try:
            page.goto(privacy_link['href'], wait_until='domcontentloaded')
            page.wait_for_load_state('networkidle')
            has_content = page.evaluate("() => document.body.textContent.length > 100")
            record("Bug2c", "隐私政策页面可访问", "PASS" if has_content else "FAIL",
                   f"内容长度: {page.evaluate('() => document.body.textContent.length')}")
        except Exception as e:
            record("Bug2c", "隐私政策页面可访问", "FAIL", str(e)[:80])

    # --- Bug3: 分类标签筛选 ---
    print("\n=== Bug3: 分类标签筛选 ===")
    page.goto('http://localhost:5173/', wait_until='domcontentloaded')
    page.wait_for_load_state('networkidle')
    page.wait_for_timeout(1000)
    dismiss_welcome(page)

    page.evaluate("document.getElementById('gallery')?.scrollIntoView()")
    page.wait_for_timeout(1000)

    # 获取全部作品数
    total_count = page.evaluate("""() => {
        return document.querySelectorAll('#gallery-grid article.artwork-card').length;
    }""")

    # 点击"数字艺术"
    digital_chip = page.locator('.filter-chip[data-category="digital-art"]')
    digital_chip.click()
    page.wait_for_timeout(1000)

    digital_count = page.evaluate("""() => {
        return document.querySelectorAll('#gallery-grid article.artwork-card').length;
    }""")
    is_active = page.evaluate("""() => {
        const chip = document.querySelector('.filter-chip[data-category="digital-art"]');
        return chip && chip.classList.contains('active');
    }""")

    record("Bug3", "分类标签筛选", "PASS" if is_active and digital_count != total_count else "FAIL",
           f"总作品:{total_count}, 数字艺术:{digital_count}, 标签高亮:{is_active}")

    # --- Bug4: 移动端汉堡菜单 ---
    print("\n=== Bug4: 移动端汉堡菜单 ===")
    page.set_viewport_size({"width": 375, "height": 812})
    page.goto('http://localhost:5173/', wait_until='domcontentloaded')
    page.wait_for_load_state('networkidle')
    page.wait_for_timeout(1000)
    dismiss_welcome(page)

    hamburger = page.locator('#menu-toggle, .menu-toggle, [aria-label*="菜单"], [aria-label*="menu"]')
    if hamburger.count() > 0:
        hamburger.first.click()
        page.wait_for_timeout(500)
        menu_open = page.evaluate("""() => {
            const menu = document.getElementById('mobile-menu');
            return menu && menu.classList.contains('open');
        }""")
        record("Bug4", "移动端汉堡菜单", "PASS" if menu_open else "FAIL",
               f"菜单{'展开' if menu_open else '未展开'}")
    else:
        # 检查是否有移动端菜单按钮
        mobile_btn = page.evaluate("""() => {
            const btns = document.querySelectorAll('button, [role="button"]');
            const results = [];
            btns.forEach(b => {
                if (b.textContent.includes('菜单') || b.textContent.includes('menu') || b.getAttribute('aria-label')?.includes('菜单')) {
                    results.push({ tag: b.tagName, id: b.id, text: b.textContent.substring(0, 30), visible: b.offsetParent !== null });
                }
            });
            // Also check for hamburger icon
            const menuToggle = document.getElementById('menu-toggle');
            if (menuToggle) results.push({ tag: menuToggle.tagName, id: menuToggle.id, visible: menuToggle.offsetParent !== null });
            return results;
        }""")
        record("Bug4", "移动端汉堡菜单", "FAIL", f"未找到菜单按钮, 候选:{mobile_btn}")

    # 恢复桌面视口
    page.set_viewport_size({"width": 1440, "height": 900})

    # --- Bug5: 登录功能 ---
    print("\n=== Bug5: 登录功能 ===")
    page.goto('http://localhost:5173/', wait_until='domcontentloaded')
    page.wait_for_load_state('networkidle')
    page.wait_for_timeout(1000)
    page.evaluate("() => localStorage.clear()")
    page.reload()
    page.wait_for_load_state('networkidle')
    page.wait_for_timeout(1000)
    dismiss_welcome(page)

    # 用错误密码测试
    page.locator('#btn-login').click()
    page.wait_for_timeout(500)
    page.locator('#auth-username').fill('testuser')
    page.locator('#auth-password').fill('password123')
    page.locator('#auth-submit').click()
    page.wait_for_timeout(1000)

    error_text = page.evaluate("() => document.getElementById('auth-error')?.textContent || ''")
    record("Bug5a", "登录错误提示(testuser)", "PASS" if error_text else "FAIL",
           f"错误提示: {error_text[:50]}")

    # 用正确账号测试
    page.locator('#auth-username').fill('')
    page.locator('#auth-username').fill('admin')
    page.locator('#auth-password').fill('')
    page.locator('#auth-password').fill('admin123')
    page.locator('#auth-submit').click()
    page.wait_for_timeout(1000)

    logged_in = page.evaluate("() => !!window.currentUser")
    record("Bug5b", "登录功能(admin)", "PASS" if logged_in else "FAIL",
           f"登录{'成功' if logged_in else '失败'}, 用户:{page.evaluate('() => window.currentUser?.username || \"\"')}")

    # --- Bug6: 排序下拉菜单 ---
    print("\n=== Bug6: 排序下拉菜单 ===")
    page.evaluate("document.getElementById('gallery')?.scrollIntoView()")
    page.wait_for_timeout(500)

    sort_result = page.evaluate("""() => {
        const select = document.getElementById('sort-select');
        if (!select) return { found: false };
        return {
            found: true,
            options: Array.from(select.options).map(o => o.value),
            current: select.value
        };
    }""")
    record("Bug6", "排序下拉菜单", "PASS" if sort_result.get('found') else "FAIL",
           f"选项:{sort_result.get('options', [])}, 当前:{sort_result.get('current', '')}")

    # --- Bug7: AI助手消息发送 ---
    print("\n=== Bug7: AI助手消息发送 ===")
    page.goto('http://localhost:5173/', wait_until='domcontentloaded')
    page.wait_for_load_state('networkidle')
    page.wait_for_timeout(1000)
    dismiss_welcome(page)

    # 打开AI助手
    fab = page.locator('#ai-fab')
    if fab.is_visible():
        fab.click()
    else:
        page.evaluate("() => { if (typeof AI !== 'undefined') AI.toggle(); }")
    page.wait_for_timeout(800)

    ai_open = page.evaluate("() => { const d = document.getElementById('ai-dialog'); return d && d.classList.contains('open'); }")
    if ai_open:
        page.evaluate("""() => {
            const input = document.getElementById('ai-input');
            if (input) { input.value = '你好'; input.dispatchEvent(new Event('input', { bubbles: true })); }
            const send = document.getElementById('ai-send');
            if (send) send.click();
        }""")
        page.wait_for_timeout(3000)
        msgs = page.evaluate("""() => {
            const messages = document.querySelectorAll('.ai-msg');
            return { count: messages.length, hasBot: Array.from(messages).some(m => m.classList.contains('bot')) };
        }""")
        record("Bug7", "AI助手消息发送", "PASS" if msgs.get('hasBot') else "FAIL",
               f"消息数:{msgs.get('count', 0)}, 有AI回复:{msgs.get('hasBot')}")
    else:
        record("Bug7", "AI助手消息发送", "FAIL", "AI对话框未打开")

    # --- Bug8: 搜索框状态残留 ---
    print("\n=== Bug8: 搜索框状态残留 ===")
    page.locator('#btn-search').click()
    page.wait_for_timeout(500)
    page.locator('#search-input').fill('雨后')
    page.wait_for_timeout(1000)
    page.keyboard.press('Escape')
    page.wait_for_timeout(500)

    # 重新打开
    page.locator('#btn-search').click()
    page.wait_for_timeout(500)
    input_val = page.evaluate("() => document.getElementById('search-input')?.value || ''")
    record("Bug8", "搜索框状态残留", "PASS" if input_val == '' else "FAIL",
           f"关闭后重新打开，输入框内容:'{input_val}'")

    browser.close()

# 汇总
print("\n" + "=" * 60)
print("验证结果汇总")
print("=" * 60)
real_bugs = [r for r in RESULTS if r['status'] == 'FAIL']
passed = [r for r in RESULTS if r['status'] == 'PASS']
for r in RESULTS:
    print(f"  [{r['status']}] {r['id']} {r['name']}{' - ' + r['detail'] if r['detail'] else ''}")
print(f"\n总计: {len(RESULTS)} 项, 通过: {len(passed)}, 失败: {len(real_bugs)}")
if real_bugs:
    print("\n确认为真实Bug:")
    for r in real_bugs:
        print(f"  - {r['id']}: {r['name']} ({r['detail']})")
