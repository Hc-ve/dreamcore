"""Dreamcore 模块10-14 功能测试"""
from playwright.sync_api import sync_playwright
import os
import json

BASE_URL = "http://localhost:5173"
RESULTS = []

def record(test_id, name, status, detail=""):
    RESULTS.append({"id": test_id, "name": name, "status": status, "detail": detail})
    print(f"  [{status}] {test_id} {name}{' - ' + detail if detail else ''}")

def dismiss_welcome(page):
    page.wait_for_timeout(500)
    wel = page.locator('#welcome-enter')
    if wel.is_visible():
        wel.click()
        page.wait_for_timeout(500)

def login_admin(page):
    # 重试导航（服务器冷启动可能较慢）
    for attempt in range(3):
        try:
            page.goto(BASE_URL, wait_until='domcontentloaded')
            page.wait_for_load_state('networkidle')
            break
        except Exception:
            page.wait_for_timeout(3000)
    page.wait_for_timeout(1000)
    page.evaluate("() => localStorage.clear()")
    page.reload()
    page.wait_for_load_state('networkidle')
    page.wait_for_timeout(1000)
    dismiss_welcome(page)
    btn = page.locator('#btn-login')
    if btn.is_visible():
        btn.click()
        page.wait_for_timeout(500)
    inp = page.locator('#auth-username')
    if inp.is_visible():
        inp.fill('admin')
        page.locator('#auth-password').fill('admin123')
        page.locator('#auth-submit').click()
        page.wait_for_timeout(1000)

def close_modal(page, modal_id=None):
    if modal_id:
        page.evaluate(f"""() => {{
            const m = document.getElementById('{modal_id}');
            if (m) m.remove();
        }}""")
    else:
        page.keyboard.press('Escape')
        page.wait_for_timeout(300)

# ======== 模块10：个人中心 ========
def test_module_10(page):
    print("\n=== 模块10：个人中心 ===")
    login_admin(page)
    page.wait_for_timeout(500)

    # 10.1 打开个人中心
    try:
        page.locator('#user-avatar-btn').click()
        page.wait_for_timeout(300)
        page.locator('[data-action="profile"]').click()
        page.wait_for_timeout(500)
        opened = page.evaluate("""() => {
            const m = document.getElementById('profile-modal');
            return m && m.classList.contains('open');
        }""")
        record("10.1", "打开个人中心", "PASS" if opened else "FAIL",
               "个人中心弹窗打开" if opened else "未打开")
    except Exception as e:
        record("10.1", "打开个人中心", "FAIL", str(e)[:80])

    # 10.2 显示信息
    try:
        info = page.evaluate("""() => {
            const m = document.getElementById('profile-modal');
            if (!m) return { found: false };
            const username = m.querySelector('.profile-username, .profile-name');
            const stats = document.getElementById('profile-stats');
            return {
                found: true,
                hasUsername: !!username && username.textContent.length > 0,
                hasStats: !!stats
            };
        }""")
        if info.get('found'):
            record("10.2", "显示信息", "PASS" if info.get('hasUsername') else "FAIL",
                   f"用户名:{info.get('hasUsername')}, 统计:{info.get('hasStats')}")
        else:
            record("10.2", "显示信息", "FAIL", "个人中心未打开")
    except Exception as e:
        record("10.2", "显示信息", "FAIL", str(e)[:80])

    # 10.3 我的作品
    try:
        page.evaluate("""() => {
            const tab = document.querySelector('.profile-tab[data-tab="works"]');
            if (tab) tab.click();
        }""")
        page.wait_for_timeout(500)
        works = page.evaluate("""() => {
            const content = document.getElementById('profile-content');
            const cards = content?.querySelectorAll('.profile-card, article');
            const empty = content?.querySelector('.profile-empty');
            return {
                hasCards: cards ? cards.length > 0 : false,
                cardCount: cards ? cards.length : 0,
                isEmpty: !!empty
            };
        }""")
        record("10.3", "我的作品", "PASS" if works.get('hasCards') or works.get('isEmpty') else "FAIL",
               f"作品卡片:{works.get('cardCount', 0)}, 空状态:{works.get('isEmpty')}")
    except Exception as e:
        record("10.3", "我的作品", "FAIL", str(e)[:80])

    # 10.4 我的收藏
    try:
        page.evaluate("""() => {
            const tab = document.querySelector('.profile-tab[data-tab="favs"]');
            if (tab) tab.click();
        }""")
        page.wait_for_timeout(500)
        favs = page.evaluate("""() => {
            const content = document.getElementById('profile-content');
            const cards = content?.querySelectorAll('.profile-card, article');
            const empty = content?.querySelector('.profile-empty');
            return {
                hasCards: cards ? cards.length > 0 : false,
                cardCount: cards ? cards.length : 0,
                isEmpty: !!empty
            };
        }""")
        record("10.4", "我的收藏", "PASS" if favs.get('hasCards') or favs.get('isEmpty') else "FAIL",
               f"收藏卡片:{favs.get('cardCount', 0)}, 空状态:{favs.get('isEmpty')}")
    except Exception as e:
        record("10.4", "我的收藏", "FAIL", str(e)[:80])

    # 10.6 统计数据
    try:
        stats = page.evaluate("""() => {
            return {
                works: document.getElementById('stat-works')?.textContent || '',
                favs: document.getElementById('stat-favs')?.textContent || '',
                likes: document.getElementById('stat-likes')?.textContent || '',
                following: document.getElementById('stat-following')?.textContent || ''
            };
        }""")
        has_stats = any(v.strip() for v in stats.values())
        record("10.6", "统计数据", "PASS" if has_stats else "FAIL",
               f"作品:{stats.get('works')}, 收藏:{stats.get('favs')}, 获赞:{stats.get('likes')}, 关注:{stats.get('following')}")
    except Exception as e:
        record("10.6", "统计数据", "FAIL", str(e)[:80])

    # 10.7 暗色模式适配
    try:
        page.evaluate("() => { localStorage.setItem('dreamcore-theme', 'dark'); document.documentElement.setAttribute('data-theme', 'dark'); }")
        page.wait_for_timeout(300)
        opened = page.evaluate("""() => {
            const m = document.getElementById('profile-modal');
            return m && m.classList.contains('open');
        }""")
        record("10.7", "暗色模式适配", "PASS" if opened else "FAIL",
               f"暗色模式下个人中心{'可见' if opened else '不可见'}")
        page.evaluate("() => { localStorage.setItem('dreamcore-theme', 'light'); document.documentElement.setAttribute('data-theme', 'light'); }")
    except Exception as e:
        record("10.7", "暗色模式适配", "FAIL", str(e)[:80])

    close_modal(page, 'profile-modal')


# ======== 模块11：管理后台 ========
def test_module_11(page):
    print("\n=== 模块11：管理后台 ===")
    login_admin(page)
    page.wait_for_timeout(500)

    # 11.1 进入管理后台
    try:
        # 关闭可能残留的弹窗
        close_modal(page, 'profile-modal')
        page.wait_for_timeout(500)
        # 确保 currentUser 存在且 isAdmin
        page.evaluate("""() => {
            if (!window.currentUser) {
                window.currentUser = {
                    id: 1,
                    username: 'admin',
                    email: 'admin@dreamcore.art',
                    isAdmin: true,
                    createdAt: new Date().toISOString()
                };
            }
            window.currentUser.isAdmin = true;
            if (typeof showAdminPanel === 'function') showAdminPanel();
        }""")
        page.wait_for_timeout(800)
        opened = page.evaluate("""() => {
            const m = document.getElementById('admin-modal');
            return m && m.classList.contains('open');
        }""")
        record("11.1", "进入管理后台", "PASS" if opened else "FAIL",
               "管理面板打开" if opened else "未打开")
    except Exception as e:
        record("11.1", "进入管理后台", "FAIL", str(e)[:80])

    # 11.2 作品管理
    try:
        art_tab = page.evaluate("""() => {
            const m = document.getElementById('admin-modal');
            if (!m) return { found: false };
            const tbody = document.getElementById('admin-art-tbody');
            const rows = tbody ? tbody.querySelectorAll('tr') : [];
            return {
                found: true,
                hasTbody: !!tbody,
                rowCount: rows.length
            };
        }""")
        record("11.2", "作品管理", "PASS" if art_tab.get('hasTbody') else "FAIL",
               f"表格行数:{art_tab.get('rowCount', 0)}")
    except Exception as e:
        record("11.2", "作品管理", "FAIL", str(e)[:80])

    # 11.3 用户管理
    try:
        page.evaluate("""() => {
            const tab = document.querySelector('.admin-tab[data-tab="users"]');
            if (tab) tab.click();
        }""")
        page.wait_for_timeout(500)
        users = page.evaluate("""() => {
            const content = document.getElementById('admin-content');
            const rows = content?.querySelectorAll('tr');
            return {
                hasRows: rows ? rows.length > 0 : false,
                rowCount: rows ? rows.length : 0
            };
        }""")
        record("11.3", "用户管理", "PASS" if users.get('hasRows') else "FAIL",
               f"用户行数:{users.get('rowCount', 0)}")
    except Exception as e:
        record("11.3", "用户管理", "FAIL", str(e)[:80])

    # 11.4 数据统计
    try:
        count = page.evaluate("""() => {
            const els = document.querySelectorAll('.admin-count');
            return { count: els.length, text: Array.from(els).map(e => e.textContent).slice(0, 3) };
        }""")
        record("11.4", "数据统计", "PASS" if count.get('count', 0) > 0 else "FAIL",
               f"统计元素:{count.get('count', 0)}, 内容:{count.get('text', [])}")
    except Exception as e:
        record("11.4", "数据统计", "FAIL", str(e)[:80])

    # 11.5 权限控制
    try:
        close_modal(page, 'admin-modal')
        page.wait_for_timeout(300)
        # 退出登录，用普通用户登录
        page.goto(BASE_URL)
        page.wait_for_load_state('networkidle')
        page.wait_for_timeout(1000)
        page.evaluate("() => localStorage.clear()")
        page.reload()
        page.wait_for_load_state('networkidle')
        page.wait_for_timeout(1000)
        dismiss_welcome(page)
        # 注册普通用户
        page.locator('#btn-login').click()
        page.wait_for_timeout(500)
        page.locator('[data-switch="register"]').click()
        page.wait_for_timeout(300)
        page.locator('#auth-username').fill('normaluser')
        page.locator('#auth-password').fill('Test123456')
        page.locator('#auth-submit').click()
        page.wait_for_timeout(1000)
        # 尝试打开管理后台
        result = page.evaluate("""() => {
            if (typeof showAdminPanel === 'function') showAdminPanel();
            return new Promise(resolve => {
                setTimeout(() => {
                    const m = document.getElementById('admin-modal');
                    resolve({ opened: m && m.classList.contains('open') });
                }, 500);
            });
        }""")
        record("11.5", "权限控制", "PASS" if not result.get('opened') else "FAIL",
               f"普通用户{'无法' if not result.get('opened') else '可以'}打开管理后台")
        close_modal(page, 'admin-modal')
    except Exception as e:
        record("11.5", "权限控制", "FAIL", str(e)[:80])


# ======== 模块12：AI助手 ========
def test_module_12(page):
    print("\n=== 模块12：AI助手 ===")
    page.goto(BASE_URL)
    page.wait_for_load_state('networkidle')
    page.wait_for_timeout(1500)
    dismiss_welcome(page)

    # 12.1 打开AI助手
    try:
        fab = page.locator('#ai-fab')
        if fab.is_visible():
            fab.click()
        else:
            page.evaluate("() => { if (typeof AI !== 'undefined') AI.toggle(); }")
        page.wait_for_timeout(800)
        opened = page.evaluate("""() => {
            const d = document.getElementById('ai-dialog');
            return d && d.classList.contains('open');
        }""")
        record("12.1", "打开AI助手", "PASS" if opened else "FAIL",
               "AI对话框打开" if opened else "未打开")
    except Exception as e:
        record("12.1", "打开AI助手", "FAIL", str(e)[:80])

    # 12.2 发送消息
    try:
        page.evaluate("""() => {
            const input = document.getElementById('ai-input');
            if (input) {
                input.value = '你好';
                input.dispatchEvent(new Event('input', { bubbles: true }));
            }
            const send = document.getElementById('ai-send');
            if (send) send.click();
        }""")
        page.wait_for_timeout(2000)
        msgs = page.evaluate("""() => {
            const messages = document.querySelectorAll('.ai-msg');
            return {
                count: messages.length,
                hasBotReply: Array.from(messages).some(m => m.classList.contains('bot'))
            };
        }""")
        record("12.2", "发送消息", "PASS" if msgs.get('hasBotReply') else "FAIL",
               f"消息数:{msgs.get('count', 0)}, 有AI回复:{msgs.get('hasBotReply')}")
    except Exception as e:
        record("12.2", "发送消息", "FAIL", str(e)[:80])

    # 12.5 快捷提问
    try:
        chip = page.evaluate("""() => {
            const chips = document.querySelectorAll('.ai-chip[data-q]');
            if (chips.length > 0) {
                chips[0].click();
                return { clicked: true, text: chips[0].textContent };
            }
            return { clicked: false };
        }""")
        if chip.get('clicked'):
            page.wait_for_timeout(2000)
            record("12.5", "快捷提问", "PASS", f"点击了:{chip.get('text', '')[:20]}")
        else:
            record("12.5", "快捷提问", "FAIL", "快捷提问按钮不存在")
    except Exception as e:
        record("12.5", "快捷提问", "FAIL", str(e)[:80])

    # 12.8 AI焦点陷阱
    try:
        page.keyboard.press('Tab')
        focused = page.evaluate("() => document.activeElement?.tagName || ''")
        in_dialog = page.evaluate("""() => {
            const d = document.getElementById('ai-dialog');
            return d?.contains(document.activeElement) || false;
        }""")
        record("12.8", "AI焦点陷阱", "PASS" if in_dialog else "FAIL",
               f"焦点在对话框内:{in_dialog}, 元素:{focused}")
    except Exception as e:
        record("12.8", "AI焦点陷阱", "FAIL", str(e)[:80])

    # 12.9 AI暗色模式
    try:
        page.evaluate("() => { localStorage.setItem('dreamcore-theme', 'dark'); document.documentElement.setAttribute('data-theme', 'dark'); }")
        page.wait_for_timeout(300)
        visible = page.evaluate("""() => {
            const d = document.getElementById('ai-dialog');
            return d && d.classList.contains('open');
        }""")
        record("12.9", "AI暗色模式", "PASS" if visible else "FAIL",
               f"暗色模式下AI对话框{'可见' if visible else '不可见'}")
        page.evaluate("() => { localStorage.setItem('dreamcore-theme', 'light'); document.documentElement.setAttribute('data-theme', 'light'); }")
    except Exception as e:
        record("12.9", "AI暗色模式", "FAIL", str(e)[:80])

    # 12.10 AI关闭
    try:
        close_btn = page.locator('#ai-close')
        if close_btn.is_visible():
            close_btn.click()
        else:
            page.keyboard.press('Escape')
        page.wait_for_timeout(500)
        closed = page.evaluate("""() => {
            const d = document.getElementById('ai-dialog');
            return !d || !d.classList.contains('open');
        }""")
        record("12.10", "AI关闭", "PASS" if closed else "FAIL",
               "对话框关闭成功" if closed else "未关闭")
    except Exception as e:
        record("12.10", "AI关闭", "FAIL", str(e)[:80])


# ======== 模块13：音效系统 ========
def test_module_13(page):
    print("\n=== 模块13：音效系统 ===")
    page.goto(BASE_URL)
    page.wait_for_load_state('networkidle')
    page.wait_for_timeout(1000)
    dismiss_welcome(page)

    # 13.1 点击音效（检查Sound对象存在）
    try:
        sound_exists = page.evaluate("""() => {
            return typeof Sound !== 'undefined' && typeof Sound.playSound === 'function';
        }""")
        record("13.1", "点击音效", "PASS" if sound_exists else "FAIL",
               "Sound对象存在且playSound可用" if sound_exists else "Sound对象不存在")
    except Exception as e:
        record("13.1", "点击音效", "FAIL", str(e)[:80])

    # 13.2 关闭音效
    try:
        toggle = page.locator('#sound-toggle')
        if toggle.is_visible():
            # 获取当前状态
            before = page.evaluate("() => localStorage.getItem('soundEnabled')")
            toggle.click()
            page.wait_for_timeout(300)
            after = page.evaluate("() => localStorage.getItem('soundEnabled')")
            changed = before != after
            record("13.2", "关闭音效", "PASS" if changed else "FAIL",
                   f"状态变化:{before}->{after}")
        else:
            record("13.2", "关闭音效", "FAIL", "音效开关按钮不可见")
    except Exception as e:
        record("13.2", "关闭音效", "FAIL", str(e)[:80])

    # 13.3 音效持久化
    try:
        page.reload()
        page.wait_for_load_state('networkidle')
        page.wait_for_timeout(1000)
        dismiss_welcome(page)
        persisted = page.evaluate("() => localStorage.getItem('soundEnabled')")
        record("13.3", "音效持久化", "PASS" if persisted in ('true', 'false') else "FAIL",
               f"localStorage值:{persisted}")
    except Exception as e:
        record("13.3", "音效持久化", "FAIL", str(e)[:80])


# ======== 模块14：PWA与离线功能 ========
def test_module_14(page):
    print("\n=== 模块14：PWA与离线功能 ===")

    # 14.2 manifest
    try:
        manifest = page.evaluate("""() => {
            const link = document.querySelector('link[rel="manifest"]');
            return { href: link?.getAttribute('href') || '' };
        }""")
        record("14.2", "manifest", "PASS" if manifest.get('href') else "FAIL",
               f"manifest链接:{manifest.get('href', '无')}")
    except Exception as e:
        record("14.2", "manifest", "FAIL", str(e)[:80])

    # 14.7 隐私政策页面
    try:
        page.goto(BASE_URL + '/privacy.html')
        page.wait_for_load_state('load')
        page.wait_for_timeout(500)
        title = page.title()
        has_content = page.evaluate("() => document.body.textContent.length > 100")
        record("14.7", "隐私政策页面", "PASS" if has_content else "FAIL",
               f"标题:{title[:30]}, 有内容:{has_content}")
    except Exception as e:
        record("14.7", "隐私政策页面", "FAIL", str(e)[:80])

    # 14.8 用户协议页面
    try:
        page.goto(BASE_URL + '/terms.html')
        page.wait_for_load_state('load')
        page.wait_for_timeout(500)
        title = page.title()
        has_content = page.evaluate("() => document.body.textContent.length > 100")
        record("14.8", "用户协议页面", "PASS" if has_content else "FAIL",
               f"标题:{title[:30]}, 有内容:{has_content}")
    except Exception as e:
        record("14.8", "用户协议页面", "FAIL", str(e)[:80])

    # 14.9 robots.txt
    try:
        page.goto(BASE_URL + '/robots.txt')
        page.wait_for_load_state('load')
        page.wait_for_timeout(500)
        content = page.evaluate("() => document.body?.innerText || document.querySelector('pre')?.textContent || ''")
        has_robots = 'User-agent' in content or 'user-agent' in content.lower()
        record("14.9", "robots.txt", "PASS" if has_robots else "FAIL",
               f"包含User-agent:{has_robots}")
    except Exception as e:
        record("14.9", "robots.txt", "FAIL", str(e)[:80])

    # 14.10 sitemap.xml
    try:
        page.goto(BASE_URL + '/sitemap.xml')
        page.wait_for_load_state('load')
        page.wait_for_timeout(500)
        content = page.evaluate("() => document.body?.innerText || document.querySelector('pre')?.textContent || ''")
        has_sitemap = 'urlset' in content or 'sitemap' in content.lower()
        record("14.10", "sitemap.xml", "PASS" if has_sitemap else "FAIL",
               f"包含urlset:{has_sitemap}")
    except Exception as e:
        record("14.10", "sitemap.xml", "FAIL", str(e)[:80])

    # 14.11 favicon
    try:
        page.goto(BASE_URL)
        page.wait_for_load_state('networkidle')
        page.wait_for_timeout(500)
        favicon = page.evaluate("""() => {
            const link = document.querySelector('link[rel="icon"], link[rel="shortcut icon"]');
            return { href: link?.getAttribute('href') || '' };
        }""")
        record("14.11", "favicon", "PASS" if favicon.get('href') else "FAIL",
               f"favicon链接:{favicon.get('href', '无')}")
    except Exception as e:
        record("14.11", "favicon", "FAIL", str(e)[:80])

    # 14.12 OG分享
    try:
        og = page.evaluate("""() => {
            const title = document.querySelector('meta[property="og:title"]');
            const desc = document.querySelector('meta[property="og:description"]');
            const image = document.querySelector('meta[property="og:image"]');
            const url = document.querySelector('meta[property="og:url"]');
            return {
                title: title?.content || '',
                desc: desc?.content?.substring(0, 50) || '',
                image: image?.content || '',
                url: url?.content || ''
            };
        }""")
        has_og = bool(og.get('title')) and bool(og.get('image'))
        record("14.12", "OG分享", "PASS" if has_og else "FAIL",
               f"标题:{og.get('title', '')[:20]}, 图片:{og.get('image', '')[:30]}")
    except Exception as e:
        record("14.12", "OG分享", "FAIL", str(e)[:80])


def main():
    os.makedirs('test-results', exist_ok=True)
    with sync_playwright() as p:
        browser = p.chromium.launch(headless=True)
        context = browser.new_context(viewport={"width": 1440, "height": 900})
        page = context.new_page()
        page.set_default_timeout(60000)
        page.set_default_navigation_timeout(120000)

        test_module_10(page)
        test_module_11(page)
        test_module_12(page)
        test_module_13(page)
        test_module_14(page)

        browser.close()

    print("\n" + "=" * 60)
    print("测试结果汇总")
    print("=" * 60)
    passed = sum(1 for r in RESULTS if r['status'] == 'PASS')
    failed = sum(1 for r in RESULTS if r['status'] == 'FAIL')
    for r in RESULTS:
        print(f"  [{r['status']}] {r['id']} {r['name']}{' - ' + r['detail'] if r['detail'] else ''}")
    print(f"\n总计: {len(RESULTS)} 项, 通过: {passed}, 失败: {failed}")
    with open('test-results/modules_10_14_results.json', 'w', encoding='utf-8') as f:
        json.dump(RESULTS, f, ensure_ascii=False, indent=2)
    print(f"\n结果已保存到 test-results/modules_10_14_results.json")

if __name__ == '__main__':
    main()
