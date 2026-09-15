"""Dreamcore 模块5-9 功能测试"""
from playwright.sync_api import sync_playwright
import time
import os

BASE_URL = "http://localhost:5173"
RESULTS = []

def record(test_id, name, status, detail=""):
    RESULTS.append({"id": test_id, "name": name, "status": status, "detail": detail})
    print(f"  [{status}] {test_id} {name}{' - ' + detail if detail else ''}")

def login(page):
    """执行登录流程"""
    page.evaluate("""() => {
        localStorage.clear();
        document.cookie.split(';').forEach(c => {
            document.cookie = c.trim().split('=')[0] + '=;expires=Thu, 01 Jan 1970 00:00:00 GMT;path=/';
        });
    }""")
    page.reload()
    page.wait_for_load_state('networkidle')
    page.wait_for_timeout(1000)
    # 关闭欢迎弹窗
    welcome_enter = page.locator('#welcome-enter')
    if welcome_enter.is_visible():
        welcome_enter.click()
        page.wait_for_timeout(500)
    # 点击登录
    btn_login = page.locator('#btn-login')
    if btn_login.is_visible():
        btn_login.click()
        page.wait_for_timeout(500)
    # 填写表单
    username_input = page.locator('#auth-username')
    password_input = page.locator('#auth-password')
    if username_input.is_visible():
        username_input.fill('admin')
        password_input.fill('admin123')
        page.locator('#auth-submit').click()
        page.wait_for_timeout(1000)

def test_module_5(page):
    """模块5：作品详情与灯箱"""
    print("\n=== 模块5：作品详情与灯箱 ===")
    page.goto(BASE_URL + '/')
    page.wait_for_load_state('networkidle')
    page.wait_for_timeout(1000)

    # 5.1 打开灯箱
    try:
        cards = page.locator('article.artwork-card')
        count = cards.count()
        if count > 0:
            first_card = cards.first
            first_card.scroll_into_view_if_needed()
            page.wait_for_timeout(500)
            # 点击卡片（不是hover区域，而是卡片本身）
            first_card.click()
            page.wait_for_timeout(1000)
            # 检查灯箱
            lightbox = page.locator('#artwork-modal, #artworkModal, .artwork-modal, .lightbox, [role="dialog"]').first
            if lightbox.is_visible():
                record("5.1", "打开灯箱", "PASS", "灯箱成功打开")
            else:
                # 可能用了不同的选择器
                lightbox_open = page.evaluate("""() => {
                    const modals = document.querySelectorAll('.modal, .modal-overlay, [class*="modal"], [class*="lightbox"]');
                    for (const m of modals) {
                        if (m.classList.contains('open') || window.getComputedStyle(m).visibility === 'visible') {
                            return { found: true, className: m.className, id: m.id };
                        }
                    }
                    return { found: false };
                }""")
                if lightbox_open.get('found'):
                    record("5.1", "打开灯箱", "PASS", f"灯箱打开: {lightbox_open.get('className', '')}")
                else:
                    record("5.1", "打开灯箱", "FAIL", "点击卡片后未找到灯箱元素")
        else:
            record("5.1", "打开灯箱", "FAIL", "页面无作品卡片")
    except Exception as e:
        record("5.1", "打开灯箱", "FAIL", str(e)[:100])

    # 5.2 灯箱信息
    try:
        modal_info = page.evaluate("""() => {
            const modal = document.querySelector('.modal-overlay.open, .modal.open, .lightbox.open');
            if (!modal) return { found: false };
            const title = modal.querySelector('h2, h3, .artwork-title, .modal-title');
            const author = modal.querySelector('.artwork-author, .artist-name, .modal-author');
            const tags = modal.querySelectorAll('.tag, .artwork-tag, .modal-tag');
            return {
                found: true,
                title: title?.textContent || '',
                author: author?.textContent || '',
                tagCount: tags.length
            };
        }""")
        if modal_info.get('found'):
            parts = []
            if modal_info.get('title'): parts.append(f"标题:{modal_info['title'][:30]}")
            if modal_info.get('author'): parts.append(f"作者:{modal_info['author'][:20]}")
            parts.append(f"标签数:{modal_info.get('tagCount', 0)}")
            record("5.2", "灯箱信息", "PASS", ", ".join(parts))
        else:
            record("5.2", "灯箱信息", "BLOCKED", "灯箱未打开，无法验证")
    except Exception as e:
        record("5.2", "灯箱信息", "FAIL", str(e)[:100])

    # 5.3 灯箱点赞
    try:
        like_result = page.evaluate("""() => {
            const modal = document.querySelector('.modal-overlay.open, .modal.open');
            if (!modal) return { action: 'no modal' };
            const likeBtn = modal.querySelector('[class*="like"], [data-action="like"], .heart-btn, .btn-like');
            if (!likeBtn) return { action: 'no like button' };
            likeBtn.click();
            return { action: 'clicked' };
        }""")
        if like_result.get('action') == 'clicked':
            page.wait_for_timeout(500)
            record("5.3", "灯箱点赞", "PASS", "已点击点赞按钮")
        else:
            record("5.3", "灯箱点赞", "FAIL", like_result.get('action', '未知'))
    except Exception as e:
        record("5.3", "灯箱点赞", "FAIL", str(e)[:100])

    # 5.4 灯箱收藏
    try:
        fav_result = page.evaluate("""() => {
            const modal = document.querySelector('.modal-overlay.open, .modal.open');
            if (!modal) return { action: 'no modal' };
            const favBtn = modal.querySelector('[class*="fav"], [class*="bookmark"], [data-action="favorite"], .btn-bookmark');
            if (!favBtn) return { action: 'no favorite button' };
            favBtn.click();
            return { action: 'clicked' };
        }""")
        if fav_result.get('action') == 'clicked':
            page.wait_for_timeout(500)
            record("5.4", "灯箱收藏", "PASS", "已点击收藏按钮")
        else:
            record("5.4", "灯箱收藏", "FAIL", fav_result.get('action', '未知'))
    except Exception as e:
        record("5.4", "灯箱收藏", "FAIL", str(e)[:100])

    # 5.5 灯箱评论
    try:
        comment_result = page.evaluate("""() => {
            const modal = document.querySelector('.modal-overlay.open, .modal.open');
            if (!modal) return { action: 'no modal' };
            const textarea = modal.querySelector('textarea, [contenteditable], input[type="text"]');
            if (!textarea) return { action: 'no comment input' };
            textarea.value = '这是一条测试评论';
            textarea.dispatchEvent(new Event('input', { bubbles: true }));
            const sendBtn = modal.querySelector('[class*="send"], [class*="submit"], button[type="submit"]');
            if (sendBtn) {
                sendBtn.click();
                return { action: 'submitted' };
            }
            return { action: 'no send button' };
        }""")
        if comment_result.get('action') == 'submitted':
            page.wait_for_timeout(500)
            record("5.5", "灯箱评论", "PASS", "已提交评论")
        else:
            record("5.5", "灯箱评论", "FAIL", comment_result.get('action', '未知'))
    except Exception as e:
        record("5.5", "灯箱评论", "FAIL", str(e)[:100])

    # 5.6 多图切换
    try:
        multi_img = page.evaluate("""() => {
            const modal = document.querySelector('.modal-overlay.open, .modal.open');
            if (!modal) return { action: 'no modal' };
            const navBtns = modal.querySelectorAll('[class*="next"], [class*="prev"], [class*="arrow"], .slick-next, .slick-prev');
            const dots = modal.querySelectorAll('[class*="dot"], [class*="indicator"], .slick-dot');
            return {
                navButtonCount: navBtns.length,
                dotCount: dots.length
            };
        }""")
        if multi_img.get('navButtonCount', 0) > 0 or multi_img.get('dotCount', 0) > 0:
            record("5.6", "多图切换", "PASS", f"导航按钮:{multi_img.get('navButtonCount',0)}, 指示点:{multi_img.get('dotCount',0)}")
        else:
            record("5.6", "多图切换", "BLOCKED", "当前作品无多图或无切换控件")
    except Exception as e:
        record("5.6", "多图切换", "FAIL", str(e)[:100])

    # 5.7 分享功能
    try:
        share_result = page.evaluate("""() => {
            const modal = document.querySelector('.modal-overlay.open, .modal.open');
            if (!modal) return { action: 'no modal' };
            const shareBtn = modal.querySelector('[class*="share"], [data-action="share"], .btn-share');
            if (!shareBtn) return { action: 'no share button' };
            shareBtn.click();
            return { action: 'clicked' };
        }""")
        if share_result.get('action') == 'clicked':
            page.wait_for_timeout(500)
            share_menu = page.evaluate("""() => {
                const menu = document.querySelector('.share-menu, .share-panel, [class*="share-menu"], [class*="share-panel"]');
                if (menu && window.getComputedStyle(menu).display !== 'none') {
                    const items = menu.querySelectorAll('button, a');
                    return { visible: true, itemCount: items.length };
                }
                // 也检查弹窗内的分享区域
                const shareArea = document.querySelector('[class*="share"]');
                return { visible: !!shareArea, itemCount: shareArea?.querySelectorAll('button, a')?.length || 0 };
            }""")
            record("5.7", "分享功能", "PASS" if share_menu.get('visible') else "FAIL",
                   f"分享菜单{'可见' if share_menu.get('visible') else '未显示'}, 项目数:{share_menu.get('itemCount', 0)}")
        else:
            record("5.7", "分享功能", "FAIL", share_result.get('action', '未知'))
    except Exception as e:
        record("5.7", "分享功能", "FAIL", str(e)[:100])

    # 5.8 关闭灯箱
    try:
        page.keyboard.press('Escape')
        page.wait_for_timeout(500)
        is_closed = page.evaluate("""() => {
            const modals = document.querySelectorAll('.modal-overlay.open, .modal.open');
            return modals.length === 0;
        }""")
        record("5.8", "关闭灯箱", "PASS" if is_closed else "FAIL",
               "ESC关闭成功" if is_closed else "ESC未能关闭灯箱")
    except Exception as e:
        record("5.8", "关闭灯箱", "FAIL", str(e)[:100])

    # 5.10 键盘导航
    try:
        # 先重新打开灯箱
        cards = page.locator('article.artwork-card')
        if cards.count() > 0:
            cards.first.scroll_into_view_if_needed()
            page.wait_for_timeout(300)
            cards.first.click()
            page.wait_for_timeout(1000)
            # 按右方向键
            page.keyboard.press('ArrowRight')
            page.wait_for_timeout(500)
            keyboard_result = page.evaluate("""() => {
                const modal = document.querySelector('.modal-overlay.open, .modal.open');
                return { isOpen: !!modal };
            }""")
            record("5.10", "键盘导航", "PASS" if keyboard_result.get('isOpen') else "FAIL",
                   "右方向键导航后灯箱仍打开" if keyboard_result.get('isOpen') else "灯箱已关闭")
            # 关闭灯箱
            page.keyboard.press('Escape')
            page.wait_for_timeout(300)
    except Exception as e:
        record("5.10", "键盘导航", "FAIL", str(e)[:100])

    # 5.11 灯箱暗色模式
    try:
        page.evaluate("() => { localStorage.setItem('dreamcore-theme', 'dark'); document.documentElement.setAttribute('data-theme', 'dark'); }")
        page.wait_for_timeout(300)
        cards = page.locator('article.artwork-card')
        if cards.count() > 0:
            cards.first.scroll_into_view_if_needed()
            page.wait_for_timeout(300)
            cards.first.click()
            page.wait_for_timeout(1000)
            dark_mode = page.evaluate("""() => {
                const theme = document.documentElement.getAttribute('data-theme');
                const modal = document.querySelector('.modal-overlay.open, .modal.open');
                return {
                    theme: theme,
                    modalVisible: !!modal
                };
            }""")
            record("5.11", "灯箱暗色模式", "PASS" if dark_mode.get('modalVisible') else "FAIL",
                   f"主题:{dark_mode.get('theme')}, 灯箱{'可见' if dark_mode.get('modalVisible') else '不可见'}")
            page.keyboard.press('Escape')
            page.wait_for_timeout(300)
        # 恢复亮色
        page.evaluate("() => { localStorage.setItem('dreamcore-theme', 'light'); document.documentElement.setAttribute('data-theme', 'light'); }")
    except Exception as e:
        record("5.11", "灯箱暗色模式", "FAIL", str(e)[:100])


def test_module_6(page):
    """模块6：搜索功能"""
    print("\n=== 模块6：搜索功能 ===")
    page.goto(BASE_URL + '/')
    page.wait_for_load_state('networkidle')
    page.wait_for_timeout(1000)

    # 关闭欢迎弹窗
    welcome_enter = page.locator('#welcome-enter')
    if welcome_enter.is_visible():
        welcome_enter.click()
        page.wait_for_timeout(500)

    # 6.1 打开搜索
    try:
        search_btn = page.locator('#search-open-btn, #btn-search-open, [class*="search-open"], button[aria-label*="搜索"]').first
        if search_btn.is_visible():
            search_btn.click()
        else:
            # 尝试点击搜索输入框
            search_input = page.locator('#nav-search-input')
            if search_input.is_visible():
                search_input.click()
            else:
                # 尝试快捷键
                page.keyboard.press('/')
        page.wait_for_timeout(500)
        search_modal = page.evaluate("""() => {
            const modals = document.querySelectorAll('[class*="search-modal"], [class*="searchModal"], .modal-overlay.open');
            for (const m of modals) {
                if (window.getComputedStyle(m).visibility === 'visible' || m.classList.contains('open')) {
                    const input = m.querySelector('input[type="text"], input[type="search"]');
                    return { found: true, hasInput: !!input };
                }
            }
            return { found: false };
        }""")
        record("6.1", "打开搜索", "PASS" if search_modal.get('found') else "FAIL",
               "搜索弹窗打开，有输入框" if search_modal.get('found') else "未找到搜索弹窗")
    except Exception as e:
        record("6.1", "打开搜索", "FAIL", str(e)[:100])

    # 6.2 关键词搜索
    try:
        # 找到搜索输入框并输入
        search_input = page.locator('#search-input, input[type="search"], input[placeholder*="搜索"]').first
        if search_input.is_visible():
            search_input.fill('雨')
            page.wait_for_timeout(300)
            page.keyboard.press('Enter')
            page.wait_for_timeout(1000)
            results = page.evaluate("""() => {
                const resultItems = document.querySelectorAll('.search-result-item, [class*="search-result"], article');
                const noResult = document.querySelector('[class*="no-result"], [class*="empty"]');
                return {
                    resultCount: resultItems.length,
                    hasNoResultMsg: !!noResult
                };
            }""")
            if results.get('resultCount', 0) > 0:
                record("6.2", "关键词搜索", "PASS", f"搜索'雨'找到{results['resultCount']}条结果")
            else:
                record("6.2", "关键词搜索", "FAIL", "未找到搜索结果")
        else:
            record("6.2", "关键词搜索", "FAIL", "搜索输入框不可见")
    except Exception as e:
        record("6.2", "关键词搜索", "FAIL", str(e)[:100])

    # 6.3 空结果
    try:
        search_input = page.locator('#search-input, input[type="search"], input[placeholder*="搜索"]').first
        if search_input.is_visible():
            search_input.fill('xyznotexist123')
            page.keyboard.press('Enter')
            page.wait_for_timeout(1000)
            no_result = page.evaluate("""() => {
                const noResult = document.querySelector('[class*="no-result"], [class*="empty"], [class*="not-found"]');
                return { found: !!noResult, text: noResult?.textContent || '' };
            }""")
            record("6.3", "空结果", "PASS" if no_result.get('found') else "FAIL",
                   f"显示'未找到'提示: {no_result.get('text', '')[:50]}" if no_result.get('found') else "未显示空结果提示")
        else:
            record("6.3", "空结果", "BLOCKED", "搜索弹窗未打开")
    except Exception as e:
        record("6.3", "空结果", "FAIL", str(e)[:100])

    # 6.5 搜索历史
    try:
        # 先搜索"雨"
        search_input = page.locator('#search-input, input[type="search"], input[placeholder*="搜索"]').first
        if search_input.is_visible():
            search_input.fill('雨')
            page.keyboard.press('Enter')
            page.wait_for_timeout(500)
            # 关闭搜索
            page.keyboard.press('Escape')
            page.wait_for_timeout(300)
            # 重新打开搜索
            search_btn = page.locator('#search-open-btn, #btn-search-open, [class*="search-open"], button[aria-label*="搜索"]').first
            if search_btn.is_visible():
                search_btn.click()
            else:
                page.locator('#nav-search-input').click()
            page.wait_for_timeout(500)
            # 检查搜索历史
            history = page.evaluate("""() => {
                const historyItems = document.querySelectorAll('[class*="history"] li, [class*="history"] .tag, [class*="recent"]');
                return { count: historyItems.length, text: Array.from(historyItems).map(i => i.textContent).slice(0, 3) };
            }""")
            record("6.5", "搜索历史", "PASS" if history.get('count', 0) > 0 else "FAIL",
                   f"历史记录数:{history.get('count', 0)}, 内容:{history.get('text', [])}")
            page.keyboard.press('Escape')
        else:
            record("6.5", "搜索历史", "BLOCKED", "搜索弹窗未打开")
    except Exception as e:
        record("6.5", "搜索历史", "FAIL", str(e)[:100])

    # 6.6 热门搜索
    try:
        search_btn = page.locator('#search-open-btn, #btn-search-open, [class*="search-open"], button[aria-label*="搜索"]').first
        if search_btn.is_visible():
            search_btn.click()
        else:
            page.locator('#nav-search-input').click()
        page.wait_for_timeout(500)
        hot_search = page.evaluate("""() => {
            const hotItems = document.querySelectorAll('[class*="hot"] .tag, [class*="hot"] button, [class*="popular"] .tag, [class*="trending"]');
            return { count: hotItems.length, text: Array.from(hotItems).map(i => i.textContent).slice(0, 5) };
        }""")
        record("6.6", "热门搜索", "PASS" if hot_search.get('count', 0) > 0 else "FAIL",
               f"热门标签数:{hot_search.get('count', 0)}, 内容:{hot_search.get('text', [])}")
    except Exception as e:
        record("6.6", "热门搜索", "FAIL", str(e)[:100])

    # 6.7 关闭搜索
    try:
        page.keyboard.press('Escape')
        page.wait_for_timeout(500)
        is_closed = page.evaluate("""() => {
            const modals = document.querySelectorAll('[class*="search-modal"].open, .modal-overlay.open');
            return modals.length === 0;
        }""")
        record("6.7", "关闭搜索", "PASS" if is_closed else "FAIL",
               "ESC关闭成功" if is_closed else "ESC未能关闭搜索弹窗")
    except Exception as e:
        record("6.7", "关闭搜索", "FAIL", str(e)[:100])


def test_module_7(page):
    """模块7：登录与注册"""
    print("\n=== 模块7：登录与注册 ===")
    page.goto(BASE_URL + '/')
    page.wait_for_load_state('networkidle')
    page.wait_for_timeout(1000)

    # 关闭欢迎弹窗
    welcome_enter = page.locator('#welcome-enter')
    if welcome_enter.is_visible():
        welcome_enter.click()
        page.wait_for_timeout(500)

    # 7.1 注册新用户
    try:
        btn_login = page.locator('#btn-login')
        if btn_login.is_visible():
            btn_login.click()
            page.wait_for_timeout(500)
            # 切换到注册tab
            register_tab = page.locator('#auth-tab-register, [data-tab="register"]')
            if register_tab.is_visible():
                register_tab.click()
                page.wait_for_timeout(300)
            # 填写注册表单
            username = page.locator('#auth-username')
            password = page.locator('#auth-password')
            if username.is_visible():
                username.fill('testuser_new')
                password.fill('Test123456')
                # 检查是否有邮箱字段
                email = page.locator('#auth-email')
                if email.is_visible():
                    email.fill('test@example.com')
                page.locator('#auth-submit').click()
                page.wait_for_timeout(1000)
                # 检查是否注册成功
                result = page.evaluate("""() => {
                    const user = localStorage.getItem('dreamcore-user');
                    const error = document.querySelector('.auth-error, .error-msg, [class*="error"]');
                    return {
                        loggedIn: !!user,
                        errorMsg: error?.textContent || ''
                    };
                }""")
                if result.get('loggedIn'):
                    record("7.1", "注册新用户", "PASS", "注册成功并自动登录")
                elif result.get('errorMsg'):
                    record("7.1", "注册新用户", "FAIL", f"错误: {result['errorMsg'][:50]}")
                else:
                    record("7.1", "注册新用户", "FAIL", "注册后未自动登录")
            else:
                record("7.1", "注册新用户", "FAIL", "用户名输入框不可见")
        else:
            record("7.1", "注册新用户", "FAIL", "登录按钮不可见")
    except Exception as e:
        record("7.1", "注册新用户", "FAIL", str(e)[:100])

    # 关闭弹窗
    page.keyboard.press('Escape')
    page.wait_for_timeout(300)

    # 7.3 登录（正确密码）
    try:
        page.evaluate("() => localStorage.clear()")
        page.reload()
        page.wait_for_load_state('networkidle')
        page.wait_for_timeout(1000)
        welcome_enter = page.locator('#welcome-enter')
        if welcome_enter.is_visible():
            welcome_enter.click()
            page.wait_for_timeout(500)
        btn_login = page.locator('#btn-login')
        if btn_login.is_visible():
            btn_login.click()
            page.wait_for_timeout(500)
            page.locator('#auth-username').fill('admin')
            page.locator('#auth-password').fill('admin123')
            page.locator('#auth-submit').click()
            page.wait_for_timeout(1000)
            result = page.evaluate("""() => {
                const userArea = document.querySelector('#nav-user-area');
                const loginBtn = document.querySelector('#btn-login');
                return {
                    userAreaVisible: userArea ? window.getComputedStyle(userArea).display !== 'none' : false,
                    loginBtnHidden: !loginBtn || window.getComputedStyle(loginBtn).display === 'none',
                    currentUser: localStorage.getItem('dreamcore_current_user') || ''
                };
            }""")
            if result.get('userAreaVisible') or result.get('loginBtnHidden'):
                record("7.3", "登录", "PASS", f"登录成功, 用户:{result.get('currentUser', '')[:20]}")
            else:
                record("7.3", "登录", "FAIL", "登录后导航栏未更新")
        else:
            record("7.3", "登录", "FAIL", "登录按钮不可见")
    except Exception as e:
        record("7.3", "登录", "FAIL", str(e)[:100])

    # 7.4 登录失败（错误密码）
    try:
        page.keyboard.press('Escape')
        page.wait_for_timeout(300)
        btn_login = page.locator('#btn-login')
        if btn_login.is_visible():
            btn_login.click()
            page.wait_for_timeout(500)
            page.locator('#auth-username').fill('admin')
            page.locator('#auth-password').fill('wrongpassword')
            page.locator('#auth-submit').click()
            page.wait_for_timeout(1000)
            error = page.evaluate("""() => {
                const err = document.querySelector('.auth-error, .error-msg, [class*="error"], [class*="alert"]');
                return { text: err?.textContent || '', visible: err ? err.offsetParent !== null : false };
            }""")
            if error.get('text'):
                record("7.4", "登录失败", "PASS", f"显示错误提示: {error['text'][:50]}")
            else:
                record("7.4", "登录失败", "FAIL", "未显示错误提示")
        page.keyboard.press('Escape')
    except Exception as e:
        record("7.4", "登录失败", "FAIL", str(e)[:100])

    # 7.6 退出登录
    try:
        # 先登录
        login(page)
        page.wait_for_timeout(500)
        # 点击用户头像/菜单
        user_menu = page.locator('#user-avatar-btn, .user-avatar-btn, [class*="user-avatar"]')
        if user_menu.is_visible():
            user_menu.click()
            page.wait_for_timeout(300)
        logout_btn = page.locator('#btn-logout, [data-action="logout"], text=退出, text=登出')
        if logout_btn.is_visible():
            logout_btn.click()
            page.wait_for_timeout(1000)
            result = page.evaluate("""() => {
                const loginBtn = document.querySelector('#btn-login');
                return { loginBtnVisible: loginBtn ? loginBtn.offsetParent !== null : false };
            }""")
            record("7.6", "退出登录", "PASS" if result.get('loginBtnVisible') else "FAIL",
                   "退出成功，显示登录按钮" if result.get('loginBtnVisible') else "退出后未显示登录按钮")
        else:
            record("7.6", "退出登录", "FAIL", "未找到退出按钮")
    except Exception as e:
        record("7.6", "退出登录", "FAIL", str(e)[:100])

    # 7.8 表单验证
    try:
        page.evaluate("() => localStorage.clear()")
        page.reload()
        page.wait_for_load_state('networkidle')
        page.wait_for_timeout(1000)
        welcome_enter = page.locator('#welcome-enter')
        if welcome_enter.is_visible():
            welcome_enter.click()
            page.wait_for_timeout(500)
        btn_login = page.locator('#btn-login')
        if btn_login.is_visible():
            btn_login.click()
            page.wait_for_timeout(500)
            # 留空直接提交
            page.locator('#auth-submit').click()
            page.wait_for_timeout(500)
            validation = page.evaluate("""() => {
                const err = document.querySelector('.auth-error, .error-msg, [class*="error"]');
                const required = document.querySelector(':invalid');
                return {
                    errorMsg: err?.textContent || '',
                    hasInvalidField: !!required
                };
            }""")
            if validation.get('errorMsg') or validation.get('hasInvalidField'):
                record("7.8", "表单验证", "PASS", f"提示:{validation.get('errorMsg', '')[:50]}")
            else:
                record("7.8", "表单验证", "FAIL", "留空提交未显示验证提示")
        page.keyboard.press('Escape')
    except Exception as e:
        record("7.8", "表单验证", "FAIL", str(e)[:100])


def test_module_8(page):
    """模块8：发布作品"""
    print("\n=== 模块8：发布作品 ===")
    page.goto(BASE_URL + '/')
    page.wait_for_load_state('networkidle')
    page.wait_for_timeout(1000)

    # 关闭欢迎弹窗
    welcome_enter = page.locator('#welcome-enter')
    if welcome_enter.is_visible():
        welcome_enter.click()
        page.wait_for_timeout(500)

    # 8.6 未登录发布
    try:
        publish_btn = page.locator('#btn-publish, #publish-btn')
        if publish_btn.is_visible():
            publish_btn.click()
            page.wait_for_timeout(500)
            result = page.evaluate("""() => {
                const authModal = document.querySelector('.modal-overlay.open, .modal.open');
                const loginPrompt = document.querySelector('[class*="login-prompt"], [class*="need-login"]');
                return {
                    authModalOpen: !!authModal,
                    hasLoginPrompt: !!loginPrompt
                };
            }""")
            if result.get('authModalOpen') or result.get('hasLoginPrompt'):
                record("8.6", "未登录发布", "PASS", "未登录时点击发布，提示先登录")
            else:
                record("8.6", "未登录发布", "FAIL", "未登录点击发布无反应")
        else:
            record("8.6", "未登录发布", "FAIL", "发布按钮不可见")
        page.keyboard.press('Escape')
        page.wait_for_timeout(300)
    except Exception as e:
        record("8.6", "未登录发布", "FAIL", str(e)[:100])

    # 8.1 打开发布弹窗（登录后）
    try:
        login(page)
        page.wait_for_timeout(500)
        publish_btn = page.locator('#btn-publish, #publish-btn')
        if publish_btn.is_visible():
            publish_btn.click()
            page.wait_for_timeout(500)
            publish_modal = page.evaluate("""() => {
                const modals = document.querySelectorAll('.modal-overlay.open, .modal.open, [class*="publish-modal"]');
                for (const m of modals) {
                    const title = m.querySelector('h2, h3, .modal-title');
                    if (title) return { found: true, title: title.textContent };
                }
                return { found: false };
            }""")
            record("8.1", "打开发布弹窗", "PASS" if publish_modal.get('found') else "FAIL",
                   f"标题:{publish_modal.get('title', '')}" if publish_modal.get('found') else "发布弹窗未打开")
        else:
            record("8.1", "打开发布弹窗", "FAIL", "发布按钮不可见")
    except Exception as e:
        record("8.1", "打开发布弹窗", "FAIL", str(e)[:100])

    # 8.2 填写作品信息
    try:
        form_result = page.evaluate("""() => {
            const modal = document.querySelector('.modal-overlay.open, .modal.open');
            if (!modal) return { found: false };
            const titleInput = modal.querySelector('input[name="title"], #publish-title, [placeholder*="标题"]');
            const categorySelect = modal.querySelector('select, [class*="category"]');
            const tagInput = modal.querySelector('input[name="tags"], [placeholder*="标签"]');
            const descInput = modal.querySelector('textarea, [name="description"]');
            return {
                found: true,
                hasTitle: !!titleInput,
                hasCategory: !!categorySelect,
                hasTags: !!tagInput,
                hasDescription: !!descInput
            };
        }""")
        if form_result.get('found'):
            parts = []
            if form_result.get('hasTitle'): parts.append("标题输入框")
            if form_result.get('hasCategory'): parts.append("分类选择")
            if form_result.get('hasTags'): parts.append("标签输入")
            if form_result.get('hasDescription'): parts.append("描述输入")
            record("8.2", "填写作品信息", "PASS" if len(parts) >= 2 else "FAIL",
                   f"表单包含: {', '.join(parts)}")
        else:
            record("8.2", "填写作品信息", "BLOCKED", "发布弹窗未打开")
    except Exception as e:
        record("8.2", "填写作品信息", "FAIL", str(e)[:100])

    # 8.3 图片上传
    try:
        upload = page.evaluate("""() => {
            const modal = document.querySelector('.modal-overlay.open, .modal.open');
            if (!modal) return { found: false };
            const fileInput = modal.querySelector('input[type="file"]');
            const dropZone = modal.querySelector('[class*="upload"], [class*="drop"]');
            return {
                found: true,
                hasFileInput: !!fileInput,
                hasDropZone: !!dropZone
            };
        }""")
        if upload.get('found'):
            record("8.3", "图片上传", "PASS" if upload.get('hasFileInput') or upload.get('hasDropZone') else "FAIL",
                   f"文件输入:{upload.get('hasFileInput')}, 拖拽区域:{upload.get('hasDropZone')}")
        else:
            record("8.3", "图片上传", "BLOCKED", "发布弹窗未打开")
    except Exception as e:
        record("8.3", "图片上传", "FAIL", str(e)[:100])

    # 8.5 表单验证
    try:
        # 尝试留空提交
        submit_btn = page.evaluate("""() => {
            const modal = document.querySelector('.modal-overlay.open, .modal.open');
            if (!modal) return { action: 'no modal' };
            const btn = modal.querySelector('[type="submit"], .publish-submit, .btn-publish');
            if (btn) { btn.click(); return { action: 'clicked' }; }
            return { action: 'no submit button' };
        }""")
        if submit_btn.get('action') == 'clicked':
            page.wait_for_timeout(500)
            error = page.evaluate("""() => {
                const errs = document.querySelectorAll('.error-msg, [class*="error"], [class*="validation"]');
                return Array.from(errs).map(e => e.textContent).filter(t => t.length > 0);
            }""")
            record("8.5", "表单验证", "PASS" if len(error) > 0 else "FAIL",
                   f"验证提示: {error[:3]}" if error else "留空提交无验证提示")
        else:
            record("8.5", "表单验证", "BLOCKED", submit_btn.get('action'))
        page.keyboard.press('Escape')
    except Exception as e:
        record("8.5", "表单验证", "FAIL", str(e)[:100])


def test_module_9(page):
    """模块9：互动功能"""
    print("\n=== 模块9：互动功能 ===")
    page.goto(BASE_URL + '/')
    page.wait_for_load_state('networkidle')
    page.wait_for_timeout(1000)

    # 关闭欢迎弹窗
    welcome_enter = page.locator('#welcome-enter')
    if welcome_enter.is_visible():
        welcome_enter.click()
        page.wait_for_timeout(500)

    # 先登录
    login(page)
    page.wait_for_timeout(500)

    # 9.1 点赞作品
    try:
        first_card = page.locator('article.artwork-card').first
        if first_card.is_visible():
            first_card.scroll_into_view_if_needed()
            page.wait_for_timeout(300)
            # 找到卡片上的点赞按钮
            like_result = page.evaluate("""() => {
                const card = document.querySelector('article.artwork-card');
                if (!card) return { action: 'no card' };
                const likeBtn = card.querySelector('[class*="like"], .heart-btn, .btn-like, [data-action="like"]');
                if (!likeBtn) return { action: 'no like button', html: card.innerHTML.substring(0, 200) };
                const countEl = card.querySelector('[class*="like-count"], .like-count, .count');
                const beforeCount = countEl ? parseInt(countEl.textContent) : 0;
                likeBtn.click();
                return { action: 'clicked', beforeCount: beforeCount };
            }""")
            if like_result.get('action') == 'clicked':
                page.wait_for_timeout(500)
                after = page.evaluate("""() => {
                    const card = document.querySelector('article.artwork-card');
                    const countEl = card.querySelector('[class*="like-count"], .like-count, .count');
                    const likeBtn = card.querySelector('[class*="like"], .heart-btn, .btn-like, [data-action="like"]');
                    return {
                        afterCount: countEl ? parseInt(countEl.textContent) : 0,
                        isActive: likeBtn?.classList.contains('active') || likeBtn?.classList.contains('liked') || likeBtn?.getAttribute('aria-pressed') === 'true'
                    };
                }""")
                countChanged = after.get('afterCount', 0) != like_result.get('beforeCount', 0)
                record("9.1", "点赞作品", "PASS" if countChanged or after.get('isActive') else "FAIL",
                       f"计数变化:{like_result.get('beforeCount',0)}->{after.get('afterCount',0)}, 激活:{after.get('isActive')}")
            else:
                record("9.1", "点赞作品", "FAIL", like_result.get('action'))
        else:
            record("9.1", "点赞作品", "FAIL", "无作品卡片")
    except Exception as e:
        record("9.1", "点赞作品", "FAIL", str(e)[:100])

    # 9.3 收藏作品
    try:
        fav_result = page.evaluate("""() => {
            const card = document.querySelector('article.artwork-card');
            if (!card) return { action: 'no card' };
            const favBtn = card.querySelector('[class*="fav"], [class*="bookmark"], [data-action="favorite"], .btn-bookmark');
            if (!favBtn) return { action: 'no favorite button' };
            favBtn.click();
            return { action: 'clicked' };
        }""")
        if fav_result.get('action') == 'clicked':
            page.wait_for_timeout(500)
            record("9.3", "收藏作品", "PASS", "已点击收藏按钮")
        else:
            record("9.3", "收藏作品", "FAIL", fav_result.get('action'))
    except Exception as e:
        record("9.3", "收藏作品", "FAIL", str(e)[:100])

    # 9.5 评论作品（通过灯箱）
    try:
        first_card = page.locator('article.artwork-card').first
        if first_card.is_visible():
            first_card.scroll_into_view_if_needed()
            page.wait_for_timeout(300)
            first_card.click()
            page.wait_for_timeout(1000)
            comment_result = page.evaluate("""() => {
                const modal = document.querySelector('.modal-overlay.open, .modal.open');
                if (!modal) return { action: 'no modal' };
                const textarea = modal.querySelector('textarea, [contenteditable], input[type="text"][placeholder*="评论"]');
                if (!textarea) return { action: 'no comment input' };
                textarea.value = '这是一条自动化测试评论';
                textarea.dispatchEvent(new Event('input', { bubbles: true }));
                const sendBtn = modal.querySelector('[class*="send"], [class*="submit"], button[type="submit"]');
                if (sendBtn) { sendBtn.click(); return { action: 'submitted' }; }
                return { action: 'no send button' };
            }""")
            if comment_result.get('action') == 'submitted':
                page.wait_for_timeout(500)
                comment_exists = page.evaluate("""() => {
                    const comments = document.querySelectorAll('[class*="comment"]');
                    for (const c of comments) {
                        if (c.textContent.includes('自动化测试评论')) return true;
                    }
                    return false;
                }""")
                record("9.5", "评论作品", "PASS" if comment_exists else "FAIL",
                       "评论显示成功" if comment_exists else "提交后评论未显示")
            else:
                record("9.5", "评论作品", "FAIL", comment_result.get('action'))
            page.keyboard.press('Escape')
            page.wait_for_timeout(300)
    except Exception as e:
        record("9.5", "评论作品", "FAIL", str(e)[:100])

    # 9.9 互动数据持久化
    try:
        page.reload()
        page.wait_for_load_state('networkidle')
        page.wait_for_timeout(1000)
        welcome_enter = page.locator('#welcome-enter')
        if welcome_enter.is_visible():
            welcome_enter.click()
            page.wait_for_timeout(500)
        # 检查登录状态是否持久化
        login_state = page.evaluate("""() => {
            const userArea = document.querySelector('#nav-user-area');
            const loginBtn = document.querySelector('#btn-login');
            return {
                loggedIn: userArea ? window.getComputedStyle(userArea).display !== 'none' : false,
                loginBtnVisible: loginBtn ? loginBtn.offsetParent !== null : false
            };
        }""")
        record("9.9", "互动数据持久化", "PASS" if login_state.get('loggedIn') else "FAIL",
               f"登录状态持久化:{login_state.get('loggedIn')}")
    except Exception as e:
        record("9.9", "互动数据持久化", "FAIL", str(e)[:100])


def main():
    os.makedirs('test-results', exist_ok=True)
    
    with sync_playwright() as p:
        browser = p.chromium.launch(headless=True)
        context = browser.new_context(viewport={"width": 1440, "height": 900})
        page = context.new_page()
        
        # 先测试模块5和6（无需登录）
        test_module_5(page)
        test_module_6(page)
        
        # 再测试模块7-9（需要登录相关）
        test_module_7(page)
        test_module_8(page)
        test_module_9(page)
        
        browser.close()
    
    # 输出汇总
    print("\n" + "=" * 60)
    print("测试结果汇总")
    print("=" * 60)
    passed = sum(1 for r in RESULTS if r['status'] == 'PASS')
    failed = sum(1 for r in RESULTS if r['status'] == 'FAIL')
    blocked = sum(1 for r in RESULTS if r['status'] == 'BLOCKED')
    
    for r in RESULTS:
        print(f"  [{r['status']}] {r['id']} {r['name']}{' - ' + r['detail'] if r['detail'] else ''}")
    
    print(f"\n总计: {len(RESULTS)} 项, 通过: {passed}, 失败: {failed}, 阻塞: {blocked}")
    
    # 保存结果
    import json
    with open('test-results/modules_5_9_results.json', 'w', encoding='utf-8') as f:
        json.dump(RESULTS, f, ensure_ascii=False, indent=2)
    print(f"\n结果已保存到 test-results/modules_5_9_results.json")


if __name__ == '__main__':
    main()
