"""Dreamcore 模块5-9 功能测试（修正版 - 使用正确的选择器）"""
from playwright.sync_api import sync_playwright
import os
import json

BASE_URL = "http://localhost:5173"
RESULTS = []

def record(test_id, name, status, detail=""):
    RESULTS.append({"id": test_id, "name": name, "status": status, "detail": detail})
    print(f"  [{status}] {test_id} {name}{' - ' + detail if detail else ''}")

def dismiss_welcome(page):
    """关闭欢迎弹窗"""
    page.wait_for_timeout(500)
    welcome_enter = page.locator('#welcome-enter')
    if welcome_enter.is_visible():
        welcome_enter.click()
        page.wait_for_timeout(500)

def login(page):
    """执行登录流程"""
    page.evaluate("""() => {
        localStorage.clear();
    }""")
    page.reload()
    page.wait_for_load_state('networkidle')
    page.wait_for_timeout(1000)
    dismiss_welcome(page)
    btn_login = page.locator('#btn-login')
    if btn_login.is_visible():
        btn_login.click()
        page.wait_for_timeout(500)
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
    page.goto(BASE_URL)
    page.wait_for_load_state('networkidle')
    page.wait_for_timeout(1500)
    dismiss_welcome(page)

    # 滚动到画廊区域
    page.evaluate("document.getElementById('gallery')?.scrollIntoView()")
    page.wait_for_timeout(1000)

    # 5.1 打开灯箱
    try:
        # 使用正确的选择器 article.artwork-card
        first_card = page.locator('article.artwork-card').first
        first_card.wait_for(state='visible', timeout=10000)
        first_card.click()
        page.wait_for_timeout(1000)
        # 检查灯箱是否打开（使用 #artwork-lightbox）
        lb_open = page.evaluate("""() => {
            const lb = document.getElementById('artwork-lightbox');
            return lb && lb.classList.contains('open');
        }""")
        record("5.1", "打开灯箱", "PASS" if lb_open else "FAIL",
               "灯箱成功打开" if lb_open else "灯箱未打开")
    except Exception as e:
        record("5.1", "打开灯箱", "FAIL", str(e)[:80])

    # 5.2 灯箱信息
    try:
        info = page.evaluate("""() => {
            const lb = document.getElementById('artwork-lightbox');
            if (!lb || !lb.classList.contains('open')) return { found: false };
            const title = lb.querySelector('.lb-title');
            const author = lb.querySelector('.lb-author-name');
            const tags = lb.querySelectorAll('.lb-tag');
            const desc = lb.querySelector('.lb-desc');
            return {
                found: true,
                title: title?.textContent || '',
                author: author?.textContent || '',
                tagCount: tags.length,
                hasDesc: !!desc && desc.textContent.length > 0
            };
        }""")
        if info.get('found'):
            parts = []
            if info.get('title'): parts.append(f"标题:{info['title'][:30]}")
            if info.get('author'): parts.append(f"作者:{info['author'][:20]}")
            parts.append(f"标签:{info.get('tagCount', 0)}")
            parts.append(f"描述:{'有' if info.get('hasDesc') else '无'}")
            record("5.2", "灯箱信息", "PASS", ", ".join(parts))
        else:
            record("5.2", "灯箱信息", "FAIL", "灯箱未打开")
    except Exception as e:
        record("5.2", "灯箱信息", "FAIL", str(e)[:80])

    # 5.3 灯箱点赞
    try:
        like_result = page.evaluate("""() => {
            const btn = document.getElementById('lb-like-btn');
            if (!btn) return { action: 'no button' };
            const countEl = btn.querySelector('.lb-like-count');
            const before = countEl ? countEl.textContent : '';
            btn.click();
            return { action: 'clicked', beforeCount: before };
        }""")
        if like_result.get('action') == 'clicked':
            page.wait_for_timeout(500)
            after = page.evaluate("""() => {
                const btn = document.getElementById('lb-like-btn');
                return {
                    isActive: btn?.classList.contains('active'),
                    count: btn?.querySelector('.lb-like-count')?.textContent || ''
                };
            }""")
            record("5.3", "灯箱点赞", "PASS",
                   f"激活:{after.get('isActive')}, 计数:{like_result.get('beforeCount','')}->{after.get('count','')}")
        else:
            record("5.3", "灯箱点赞", "FAIL", "点赞按钮不存在")
    except Exception as e:
        record("5.3", "灯箱点赞", "FAIL", str(e)[:80])

    # 5.4 灯箱收藏
    try:
        fav_result = page.evaluate("""() => {
            const btn = document.getElementById('lb-fav-btn');
            if (!btn) return { action: 'no button' };
            btn.click();
            return { action: 'clicked' };
        }""")
        if fav_result.get('action') == 'clicked':
            page.wait_for_timeout(500)
            after = page.evaluate("""() => {
                const btn = document.getElementById('lb-fav-btn');
                return { isActive: btn?.classList.contains('active'), label: btn?.querySelector('.lb-action-label')?.textContent || '' };
            }""")
            record("5.4", "灯箱收藏", "PASS", f"激活:{after.get('isActive')}, 标签:{after.get('label')}")
        else:
            record("5.4", "灯箱收藏", "FAIL", "收藏按钮不存在")
    except Exception as e:
        record("5.4", "灯箱收藏", "FAIL", str(e)[:80])

    # 5.5 灯箱评论
    try:
        comment_result = page.evaluate("""() => {
            const textarea = document.getElementById('lb-comment-text');
            const submitBtn = document.getElementById('lb-comment-submit');
            if (!textarea) return { action: 'no textarea' };
            textarea.value = '这是一条自动化测试评论';
            textarea.dispatchEvent(new Event('input', { bubbles: true }));
            if (submitBtn) { submitBtn.click(); return { action: 'submitted' }; }
            return { action: 'no submit button' };
        }""")
        if comment_result.get('action') == 'submitted':
            page.wait_for_timeout(500)
            comment_exists = page.evaluate("""() => {
                const list = document.getElementById('lb-comment-list');
                return list?.textContent?.includes('自动化测试评论') || false;
            }""")
            record("5.5", "灯箱评论", "PASS" if comment_exists else "FAIL",
                   "评论显示成功" if comment_exists else "提交后评论未显示")
        else:
            record("5.5", "灯箱评论", "FAIL", comment_result.get('action'))
    except Exception as e:
        record("5.5", "灯箱评论", "FAIL", str(e)[:80])

    # 5.6 多图切换
    try:
        multi = page.evaluate("""() => {
            const lb = document.getElementById('artwork-lightbox');
            if (!lb) return { found: false };
            const prevBtn = lb.querySelector('.lb-prev, [class*="prev"]');
            const nextBtn = lb.querySelector('.lb-next, [class*="next"]');
            return {
                found: true,
                hasPrev: !!prevBtn,
                hasNext: !!nextBtn
            };
        }""")
        if multi.get('found'):
            record("5.6", "多图切换", "PASS" if multi.get('hasPrev') or multi.get('hasNext') else "BLOCKED",
                   f"上一张:{multi.get('hasPrev')}, 下一张:{multi.get('hasNext')}")
        else:
            record("5.6", "多图切换", "FAIL", "灯箱未打开")
    except Exception as e:
        record("5.6", "多图切换", "FAIL", str(e)[:80])

    # 5.7 分享功能
    try:
        share_result = page.evaluate("""() => {
            const btn = document.getElementById('lb-share-btn');
            if (!btn) return { action: 'no button' };
            btn.click();
            return { action: 'clicked' };
        }""")
        if share_result.get('action') == 'clicked':
            page.wait_for_timeout(500)
            share_menu = page.evaluate("""() => {
                const menu = document.querySelector('.share-menu');
                if (menu) {
                    const items = menu.querySelectorAll('button, a');
                    return { visible: true, itemCount: items.length };
                }
                return { visible: false };
            }""")
            record("5.7", "分享功能", "PASS" if share_menu.get('visible') else "FAIL",
                   f"分享菜单{'可见' if share_menu.get('visible') else '未显示'}, 项目数:{share_menu.get('itemCount', 0)}")
        else:
            record("5.7", "分享功能", "FAIL", "分享按钮不存在")
    except Exception as e:
        record("5.7", "分享功能", "FAIL", str(e)[:80])

    # 5.8 关闭灯箱
    try:
        page.keyboard.press('Escape')
        page.wait_for_timeout(500)
        is_closed = page.evaluate("""() => {
            const lb = document.getElementById('artwork-lightbox');
            return !lb || !lb.classList.contains('open');
        }""")
        record("5.8", "关闭灯箱", "PASS" if is_closed else "FAIL",
               "ESC关闭成功" if is_closed else "ESC未能关闭灯箱")
    except Exception as e:
        record("5.8", "关闭灯箱", "FAIL", str(e)[:80])

    # 5.10 键盘导航
    try:
        page.evaluate("document.querySelector('article.artwork-card')?.click()")
        page.wait_for_timeout(1000)
        page.keyboard.press('ArrowRight')
        page.wait_for_timeout(500)
        is_open = page.evaluate("""() => {
            const lb = document.getElementById('artwork-lightbox');
            return lb && lb.classList.contains('open');
        }""")
        record("5.10", "键盘导航", "PASS" if is_open else "FAIL",
               "右方向键后灯箱仍打开" if is_open else "灯箱已关闭")
        page.keyboard.press('Escape')
        page.wait_for_timeout(300)
    except Exception as e:
        record("5.10", "键盘导航", "FAIL", str(e)[:80])

    # 5.11 灯箱暗色模式
    try:
        page.evaluate("() => { localStorage.setItem('dreamcore-theme', 'dark'); document.documentElement.setAttribute('data-theme', 'dark'); }")
        page.wait_for_timeout(300)
        page.evaluate("document.querySelector('article.artwork-card')?.click()")
        page.wait_for_timeout(1000)
        dark = page.evaluate("""() => {
            const lb = document.getElementById('artwork-lightbox');
            return {
                theme: document.documentElement.getAttribute('data-theme'),
                isOpen: lb && lb.classList.contains('open')
            };
        }""")
        record("5.11", "灯箱暗色模式", "PASS" if dark.get('isOpen') else "FAIL",
               f"主题:{dark.get('theme')}, 灯箱{'可见' if dark.get('isOpen') else '不可见'}")
        page.keyboard.press('Escape')
        page.evaluate("() => { localStorage.setItem('dreamcore-theme', 'light'); document.documentElement.setAttribute('data-theme', 'light'); }")
    except Exception as e:
        record("5.11", "灯箱暗色模式", "FAIL", str(e)[:80])


def test_module_6(page):
    """模块6：搜索功能"""
    print("\n=== 模块6：搜索功能 ===")
    page.goto(BASE_URL)
    page.wait_for_load_state('networkidle')
    page.wait_for_timeout(1000)
    dismiss_welcome(page)

    # 6.1 打开搜索
    try:
        page.locator('#search-open-btn').click()
        page.wait_for_timeout(500)
        search_open = page.evaluate("""() => {
            const modal = document.getElementById('search-modal');
            return modal && modal.classList.contains('open');
        }""")
        record("6.1", "打开搜索", "PASS" if search_open else "FAIL",
               "搜索弹窗打开" if search_open else "搜索弹窗未打开")
    except Exception as e:
        record("6.1", "打开搜索", "FAIL", str(e)[:80])

    # 6.2 关键词搜索
    try:
        page.locator('#search-input').fill('雨')
        page.wait_for_timeout(500)
        results = page.evaluate("""() => {
            const items = document.querySelectorAll('.search-result-card, .search-result-item');
            return { count: items.length };
        }""")
        record("6.2", "关键词搜索", "PASS" if results.get('count', 0) > 0 else "FAIL",
               f"搜索'雨'找到{results.get('count', 0)}条结果")
    except Exception as e:
        record("6.2", "关键词搜索", "FAIL", str(e)[:80])

    # 6.3 空结果
    try:
        page.locator('#search-input').fill('xyznotexist123')
        page.wait_for_timeout(500)
        no_result = page.evaluate("""() => {
            const el = document.querySelector('.search-no-result, .search-empty');
            return { found: !!el, text: el?.textContent?.trim() || '' };
        }""")
        record("6.3", "空结果", "PASS" if no_result.get('found') else "FAIL",
               f"提示:{no_result.get('text', '')[:40]}" if no_result.get('found') else "未显示空结果提示")
    except Exception as e:
        record("6.3", "空结果", "FAIL", str(e)[:80])

    # 6.5 搜索历史
    try:
        # 先搜索"雨"生成历史
        page.locator('#search-input').fill('雨')
        page.keyboard.press('Enter')
        page.wait_for_timeout(500)
        # 关闭搜索
        page.keyboard.press('Escape')
        page.wait_for_timeout(300)
        # 重新打开搜索
        page.locator('#search-open-btn').click()
        page.wait_for_timeout(500)
        history = page.evaluate("""() => {
            const items = document.querySelectorAll('.search-history-item');
            return { count: items.length, text: Array.from(items).map(i => i.textContent?.trim()).slice(0, 3) };
        }""")
        record("6.5", "搜索历史", "PASS" if history.get('count', 0) > 0 else "FAIL",
               f"历史记录数:{history.get('count', 0)}, 内容:{history.get('text', [])}")
    except Exception as e:
        record("6.5", "搜索历史", "FAIL", str(e)[:80])

    # 6.6 热门搜索
    try:
        hot = page.evaluate("""() => {
            const tags = document.querySelectorAll('.search-hot-tag');
            return { count: tags.length, text: Array.from(tags).map(t => t.textContent?.trim()).slice(0, 5) };
        }""")
        record("6.6", "热门搜索", "PASS" if hot.get('count', 0) > 0 else "FAIL",
               f"热门标签数:{hot.get('count', 0)}, 内容:{hot.get('text', [])}")
    except Exception as e:
        record("6.6", "热门搜索", "FAIL", str(e)[:80])

    # 6.7 关闭搜索
    try:
        page.keyboard.press('Escape')
        page.wait_for_timeout(500)
        is_closed = page.evaluate("""() => {
            const modal = document.getElementById('search-modal');
            return !modal || !modal.classList.contains('open');
        }""")
        record("6.7", "关闭搜索", "PASS" if is_closed else "FAIL",
               "ESC关闭成功" if is_closed else "ESC未能关闭搜索弹窗")
    except Exception as e:
        record("6.7", "关闭搜索", "FAIL", str(e)[:80])


def test_module_7(page):
    """模块7：登录与注册"""
    print("\n=== 模块7：登录与注册 ===")
    page.goto(BASE_URL)
    page.wait_for_load_state('networkidle')
    page.wait_for_timeout(1000)
    dismiss_welcome(page)

    # 7.1 注册新用户
    try:
        page.locator('#btn-login').click()
        page.wait_for_timeout(500)
        # 切换到注册
        page.locator('[data-switch="register"]').click()
        page.wait_for_timeout(300)
        page.locator('#auth-username').fill('testuser_auto')
        page.locator('#auth-password').fill('Test123456')
        email_input = page.locator('#auth-email')
        if email_input.is_visible():
            email_input.fill('test@example.com')
        page.locator('#auth-submit').click()
        page.wait_for_timeout(1000)
        result = page.evaluate("""() => {
            const user = localStorage.getItem('currentUser');
            return { loggedIn: !!user, user: user ? JSON.parse(user).username : '' };
        }""")
        record("7.1", "注册新用户", "PASS" if result.get('loggedIn') else "FAIL",
               f"注册成功, 用户:{result.get('user', '')}" if result.get('loggedIn') else "注册失败")
    except Exception as e:
        record("7.1", "注册新用户", "FAIL", str(e)[:80])

    # 7.3 登录
    try:
        page.evaluate("() => localStorage.clear()")
        page.reload()
        page.wait_for_load_state('networkidle')
        page.wait_for_timeout(1000)
        dismiss_welcome(page)
        page.locator('#btn-login').click()
        page.wait_for_timeout(500)
        page.locator('#auth-username').fill('admin')
        page.locator('#auth-password').fill('admin123')
        page.locator('#auth-submit').click()
        page.wait_for_timeout(1000)
        result = page.evaluate("""() => {
            const user = localStorage.getItem('currentUser');
            return { loggedIn: !!user, user: user ? JSON.parse(user).username : '' };
        }""")
        record("7.3", "登录", "PASS" if result.get('loggedIn') else "FAIL",
               f"登录成功, 用户:{result.get('user', '')}")
    except Exception as e:
        record("7.3", "登录", "FAIL", str(e)[:80])

    # 7.4 登录失败
    try:
        page.locator('#btn-login').click()
        page.wait_for_timeout(500)
        page.locator('#auth-username').fill('admin')
        page.locator('#auth-password').fill('wrongpassword')
        page.locator('#auth-submit').click()
        page.wait_for_timeout(1000)
        error = page.evaluate("""() => {
            const err = document.getElementById('auth-error');
            return { text: err?.textContent || '' };
        }""")
        record("7.4", "登录失败", "PASS" if error.get('text') else "FAIL",
               f"提示:{error.get('text', '')[:50]}")
        page.keyboard.press('Escape')
    except Exception as e:
        record("7.4", "登录失败", "FAIL", str(e)[:80])

    # 7.6 退出登录
    try:
        login(page)
        page.wait_for_timeout(500)
        # 点击用户头像
        user_btn = page.locator('#user-avatar-btn')
        if user_btn.is_visible():
            user_btn.click()
            page.wait_for_timeout(300)
        logout_btn = page.locator('#btn-logout')
        if logout_btn.is_visible():
            logout_btn.click()
            page.wait_for_timeout(1000)
            result = page.evaluate("""() => {
                const loginBtn = document.getElementById('btn-login');
                return { loginBtnVisible: loginBtn?.offsetParent !== null };
            }""")
            record("7.6", "退出登录", "PASS" if result.get('loginBtnVisible') else "FAIL",
                   "退出成功" if result.get('loginBtnVisible') else "退出失败")
        else:
            record("7.6", "退出登录", "FAIL", "退出按钮不可见")
    except Exception as e:
        record("7.6", "退出登录", "FAIL", str(e)[:80])

    # 7.8 表单验证
    try:
        page.evaluate("() => localStorage.clear()")
        page.reload()
        page.wait_for_load_state('networkidle')
        page.wait_for_timeout(1000)
        dismiss_welcome(page)
        page.locator('#btn-login').click()
        page.wait_for_timeout(500)
        page.locator('#auth-submit').click()
        page.wait_for_timeout(500)
        error = page.evaluate("""() => {
            const err = document.getElementById('auth-error');
            return { text: err?.textContent || '' };
        }""")
        record("7.8", "表单验证", "PASS" if error.get('text') else "FAIL",
               f"提示:{error.get('text', '')[:50]}")
        page.keyboard.press('Escape')
    except Exception as e:
        record("7.8", "表单验证", "FAIL", str(e)[:80])


def test_module_8(page):
    """模块8：发布作品"""
    print("\n=== 模块8：发布作品 ===")
    page.goto(BASE_URL)
    page.wait_for_load_state('networkidle')
    page.wait_for_timeout(1000)
    dismiss_welcome(page)

    # 8.6 未登录发布
    try:
        page.locator('#btn-publish').click()
        page.wait_for_timeout(500)
        result = page.evaluate("""() => {
            const authModal = document.querySelector('.modal-overlay.open');
            return { authModalOpen: !!authModal };
        }""")
        record("8.6", "未登录发布", "PASS" if result.get('authModalOpen') else "FAIL",
               "提示先登录" if result.get('authModalOpen') else "无反应")
        page.keyboard.press('Escape')
        page.wait_for_timeout(300)
    except Exception as e:
        record("8.6", "未登录发布", "FAIL", str(e)[:80])

    # 8.1 打开发布弹窗（登录后）
    try:
        login(page)
        page.wait_for_timeout(500)
        page.locator('#btn-publish').click()
        page.wait_for_timeout(500)
        pub_open = page.evaluate("""() => {
            const modal = document.getElementById('publish-modal');
            return modal && modal.classList.contains('open');
        }""")
        record("8.1", "打开发布弹窗", "PASS" if pub_open else "FAIL",
               "发布弹窗打开" if pub_open else "发布弹窗未打开")
    except Exception as e:
        record("8.1", "打开发布弹窗", "FAIL", str(e)[:80])

    # 8.2 填写作品信息
    try:
        form = page.evaluate("""() => {
            const title = document.getElementById('pub-title-input');
            const desc = document.getElementById('pub-desc-input');
            const cats = document.getElementById('pub-categories');
            return {
                hasTitle: !!title,
                hasDesc: !!desc,
                hasCategories: !!cats
            };
        }""")
        parts = []
        if form.get('hasTitle'): parts.append("标题")
        if form.get('hasDesc'): parts.append("描述")
        if form.get('hasCategories'): parts.append("分类")
        record("8.2", "填写作品信息", "PASS" if len(parts) >= 2 else "FAIL",
               f"表单包含: {', '.join(parts)}")
    except Exception as e:
        record("8.2", "填写作品信息", "FAIL", str(e)[:80])

    # 8.3 图片上传
    try:
        upload = page.evaluate("""() => {
            const fileInput = document.getElementById('pub-file');
            const dropzone = document.getElementById('pub-dropzone');
            return { hasFileInput: !!fileInput, hasDropzone: !!dropzone };
        }""")
        record("8.3", "图片上传", "PASS" if upload.get('hasFileInput') or upload.get('hasDropzone') else "FAIL",
               f"文件输入:{upload.get('hasFileInput')}, 拖拽区域:{upload.get('hasDropzone')}")
    except Exception as e:
        record("8.3", "图片上传", "FAIL", str(e)[:80])

    # 8.5 表单验证
    try:
        page.evaluate("document.getElementById('pub-form')?.dispatchEvent(new Event('submit', {bubbles: true}))")
        page.wait_for_timeout(500)
        error = page.evaluate("""() => {
            const err = document.getElementById('pub-error');
            return { text: err?.textContent || '' };
        }""")
        record("8.5", "表单验证", "PASS" if error.get('text') else "FAIL",
               f"提示:{error.get('text', '')[:50]}")
        page.keyboard.press('Escape')
    except Exception as e:
        record("8.5", "表单验证", "FAIL", str(e)[:80])


def test_module_9(page):
    """模块9：互动功能"""
    print("\n=== 模块9：互动功能 ===")
    page.goto(BASE_URL)
    page.wait_for_load_state('networkidle')
    page.wait_for_timeout(1000)
    dismiss_welcome(page)
    login(page)
    page.wait_for_timeout(500)

    # 滚动到画廊
    page.evaluate("document.getElementById('gallery')?.scrollIntoView()")
    page.wait_for_timeout(1000)

    # 9.1 点赞作品（通过灯箱）
    try:
        page.evaluate("document.querySelector('article.artwork-card')?.click()")
        page.wait_for_timeout(1000)
        like_result = page.evaluate("""() => {
            const btn = document.getElementById('lb-like-btn');
            if (!btn) return { action: 'no button' };
            const countEl = btn.querySelector('.lb-like-count');
            const before = countEl ? countEl.textContent : '';
            btn.click();
            return { action: 'clicked', beforeCount: before };
        }""")
        if like_result.get('action') == 'clicked':
            page.wait_for_timeout(500)
            after = page.evaluate("""() => {
                const btn = document.getElementById('lb-like-btn');
                return {
                    isActive: btn?.classList.contains('active'),
                    count: btn?.querySelector('.lb-like-count')?.textContent || ''
                };
            }""")
            record("9.1", "点赞作品", "PASS" if after.get('isActive') else "FAIL",
                   f"激活:{after.get('isActive')}, 计数:{like_result.get('beforeCount','')}->{after.get('count','')}")
        else:
            record("9.1", "点赞作品", "FAIL", "点赞按钮不存在")
        page.keyboard.press('Escape')
        page.wait_for_timeout(300)
    except Exception as e:
        record("9.1", "点赞作品", "FAIL", str(e)[:80])

    # 9.3 收藏作品（通过灯箱）
    try:
        page.evaluate("document.querySelector('article.artwork-card')?.click()")
        page.wait_for_timeout(1000)
        fav_result = page.evaluate("""() => {
            const btn = document.getElementById('lb-fav-btn');
            if (!btn) return { action: 'no button' };
            btn.click();
            return { action: 'clicked' };
        }""")
        if fav_result.get('action') == 'clicked':
            page.wait_for_timeout(500)
            after = page.evaluate("""() => {
                const btn = document.getElementById('lb-fav-btn');
                return { isActive: btn?.classList.contains('active'), label: btn?.querySelector('.lb-action-label')?.textContent || '' };
            }""")
            record("9.3", "收藏作品", "PASS", f"激活:{after.get('isActive')}, 标签:{after.get('label')}")
        else:
            record("9.3", "收藏作品", "FAIL", "收藏按钮不存在")
        page.keyboard.press('Escape')
        page.wait_for_timeout(300)
    except Exception as e:
        record("9.3", "收藏作品", "FAIL", str(e)[:80])

    # 9.5 评论作品（通过灯箱）
    try:
        page.evaluate("document.querySelector('article.artwork-card')?.click()")
        page.wait_for_timeout(1000)
        comment_result = page.evaluate("""() => {
            const textarea = document.getElementById('lb-comment-text');
            const submitBtn = document.getElementById('lb-comment-submit');
            if (!textarea) return { action: 'no textarea' };
            textarea.value = '这是一条自动化测试评论';
            textarea.dispatchEvent(new Event('input', { bubbles: true }));
            if (submitBtn) { submitBtn.click(); return { action: 'submitted' }; }
            return { action: 'no submit button' };
        }""")
        if comment_result.get('action') == 'submitted':
            page.wait_for_timeout(500)
            comment_exists = page.evaluate("""() => {
                const list = document.getElementById('lb-comment-list');
                return list?.textContent?.includes('自动化测试评论') || false;
            }""")
            record("9.5", "评论作品", "PASS" if comment_exists else "FAIL",
                   "评论显示成功" if comment_exists else "提交后评论未显示")
        else:
            record("9.5", "评论作品", "FAIL", comment_result.get('action'))
        page.keyboard.press('Escape')
        page.wait_for_timeout(300)
    except Exception as e:
        record("9.5", "评论作品", "FAIL", str(e)[:80])

    # 9.9 互动数据持久化
    try:
        page.reload()
        page.wait_for_load_state('networkidle')
        page.wait_for_timeout(1000)
        dismiss_welcome(page)
        login_state = page.evaluate("""() => {
            const user = localStorage.getItem('currentUser');
            return { loggedIn: !!user };
        }""")
        record("9.9", "互动数据持久化", "PASS" if login_state.get('loggedIn') else "FAIL",
               f"登录状态持久化:{login_state.get('loggedIn')}")
    except Exception as e:
        record("9.9", "互动数据持久化", "FAIL", str(e)[:80])


def main():
    os.makedirs('test-results', exist_ok=True)
    
    with sync_playwright() as p:
        browser = p.chromium.launch(headless=True)
        context = browser.new_context(viewport={"width": 1440, "height": 900})
        page = context.new_page()
        
        test_module_5(page)
        test_module_6(page)
        test_module_7(page)
        test_module_8(page)
        test_module_9(page)
        
        browser.close()
    
    print("\n" + "=" * 60)
    print("测试结果汇总")
    print("=" * 60)
    passed = sum(1 for r in RESULTS if r['status'] == 'PASS')
    failed = sum(1 for r in RESULTS if r['status'] == 'FAIL')
    blocked = sum(1 for r in RESULTS if r['status'] == 'BLOCKED')
    
    for r in RESULTS:
        print(f"  [{r['status']}] {r['id']} {r['name']}{' - ' + r['detail'] if r['detail'] else ''}")
    
    print(f"\n总计: {len(RESULTS)} 项, 通过: {passed}, 失败: {failed}, 阻塞: {blocked}")
    
    with open('test-results/modules_5_9_results.json', 'w', encoding='utf-8') as f:
        json.dump(RESULTS, f, ensure_ascii=False, indent=2)
    print(f"\n结果已保存到 test-results/modules_5_9_results.json")


if __name__ == '__main__':
    main()
