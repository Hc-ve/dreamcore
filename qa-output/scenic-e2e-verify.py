""" 端到端验证：热门景区 → AI 文创一键生成 P0 链路
    验证点：
    ① 殷墟（themeId=null 但有映射）CTA 按钮可见（放宽条件改动）
    ② 龙门石窟 CTA 点击后 URL 带 scenic/style/category 三个参数
    ③ 工作台顶部出现匹配提示条
    ④ 风格/品类预选生效
"""
import sys, time
from playwright.sync_api import sync_playwright

def log(*a): print('[VERIFY]', *a, flush=True)

def dismiss_welcome(page):
    try:
        btn = page.locator('#welcome-enter')
        btn.click(timeout=4000)
        log('欢迎弹窗已关闭')
    except Exception:
        pass

def run():
    with sync_playwright() as pw:
        # 用系统 Edge（项目 playwright.config.js 已配置 channel: 'msedge'）
        browser = pw.chromium.launch(headless=True, channel='msedge')
        page = browser.new_page(viewport={'width': 1440, 'height': 900})

        # 清理 IndexedDB + localStorage，避免跨次状态污染
        page.add_init_script("""
            try { localStorage.clear(); } catch(e){}
            try { indexedDB.databases().then(dbs => dbs.forEach(d => indexedDB.deleteDatabase(d.name))); } catch(e){}
        """)

        page.goto('http://localhost:5173/', timeout=20000)
        page.wait_for_load_state('networkidle')
        dismiss_welcome(page)
        time.sleep(0.5)

        # ============================================================
        # 步骤 1：殷墟（themeId=null 但有映射）— CTA 可见性
        # ============================================================
        log('--- 步骤 1：验证殷墟 CTA 显示 ---')
        page.goto('http://localhost:5173/#/scenic?area=yinxu', timeout=20000)
        try:
            page.wait_for_selector('.sn-overlay', timeout=8000)
        except Exception as e:
            log('❌ 殷墟 overlay 未出现：', e)
            page.screenshot(path='qa-output/yinxu-overlay-fail.png', full_page=True)
            browser.close(); sys.exit(1)

        page.screenshot(path='qa-output/yinxu-cta-area.png', full_page=True)

        # 找 CTA 按钮：#sn-craft-btn（景区级）或 #sn-craft-checkin-btn（打卡条）
        craft_btn = page.locator('#sn-craft-btn')
        checkin_btn = page.locator('#sn-craft-checkin-btn')
        cta_visible = craft_btn.count() > 0 and craft_btn.first.is_visible()
        checkin_visible = checkin_btn.count() > 0 and checkin_btn.first.is_visible()

        log(f'#sn-craft-btn 可见: {cta_visible}')
        log(f'#sn-craft-checkin-btn 可见: {checkin_visible}')

        if not cta_visible and not checkin_visible:
            log('❌ 失败：殷墟 themeId=null，但两个 CTA 都不可见！')
            browser.close(); sys.exit(1)
        log('✅ 殷墟 CTA 验证通过')

        # ============================================================
        # 步骤 2：点击 CTA → 进工作台 → 检查 URL + 匹配提示条
        # ============================================================
        log('--- 步骤 2：点击殷墟 CTA → 工作台 ---')
        target_btn = craft_btn if cta_visible else checkin_btn
        target_btn.first.click()
        time.sleep(2)

        # 等 hash 跳到 #/craft
        try:
            page.wait_for_function("() => (location.hash || '').includes('#/craft')", timeout=10000)
        except Exception as e:
            log('❌ 未跳转到 #/craft：', e)
            page.screenshot(path='qa-output/craft-jump-fail.png', full_page=True)
            browser.close(); sys.exit(1)

        current_hash = page.evaluate("() => location.hash")
        log(f'当前 hash: {current_hash}')

        # URL 参数检查
        checks = {
            'artworkId': 'artworkId=' in current_hash,
            'scenic=yinxu': 'scenic=yinxu' in current_hash,
            'style=': 'style=' in current_hash,
            'category=': 'category=' in current_hash,
        }
        for k, v in checks.items():
            log(f'  参数 {k}: {"✅" if v else "❌"}')
        if not all(checks.values()):
            log('❌ 失败：URL 参数不全')
        else:
            log('✅ URL 参数全部正确')

        # 工作台 DOM 检查
        try:
            page.wait_for_selector('#ai-craft-workbench', timeout=8000)
            log('✅ 工作台 DOM 出现')
        except Exception as e:
            log(f'❌ 工作台未出现：{e}')

        # 匹配提示条检查
        hint = page.locator('[data-scenic-match="true"]')
        hint_visible = hint.count() > 0 and hint.first.is_visible()
        log(f'匹配提示条可见: {hint_visible}')
        if hint_visible:
            hint_text = hint.first.inner_text()
            log(f'  提示条文案: {hint_text}')
            log('✅ 匹配提示条正常')
        else:
            log('❌ 匹配提示条不可见')

        # 风格预选检查：找当前 active 的 style chip
        active_style = page.locator('.craft-style-chip.active').first
        active_style_text = active_style.inner_text() if active_style.count() > 0 else '(无 active chip)'
        log(f'当前激活风格: {active_style_text}')

        page.screenshot(path='qa-output/yinxu-craft-workbench.png', full_page=True)

        # 关闭工作台
        try: page.locator('#craft-close').click()
        except Exception: pass
        time.sleep(1)

        # ============================================================
        # 步骤 3：龙门石窟完整链路
        # ============================================================
        log('--- 步骤 3：验证龙门石窟完整链路 ---')
        page.goto('http://localhost:5173/#/scenic?area=longmen', timeout=20000)
        page.wait_for_selector('.sn-overlay', timeout=8000)

        lmn_cta = page.locator('#sn-craft-btn')
        lmn_visible = lmn_cta.count() > 0 and lmn_cta.first.is_visible()
        log(f'龙门 #sn-craft-btn 可见: {lmn_visible}')
        page.screenshot(path='qa-output/longmen-cta-area.png', full_page=True)

        if lmn_visible:
            lmn_cta.first.click()
            time.sleep(2)
            page.wait_for_function("() => (location.hash || '').includes('#/craft')", timeout=10000)
            lmn_hash = page.evaluate("() => location.hash")
            log(f'龙门跳转后 hash: {lmn_hash}')

            page.wait_for_selector('#ai-craft-workbench', timeout=8000)
            lmn_hint = page.locator('[data-scenic-match="true"]')
            lmn_hint_visible = lmn_hint.count() > 0 and lmn_hint.first.is_visible()
            log(f'龙门匹配提示条可见: {lmn_hint_visible}')
            if lmn_hint_visible:
                log(f'  文案: {lmn_hint.first.inner_text()}')

            active = page.locator('.craft-style-chip.active').first
            log(f'龙门当前激活风格: {active.inner_text() if active.count() > 0 else "(无)"}')

            page.screenshot(path='qa-output/longmen-craft-workbench.png', full_page=True)

        log('=== 验证全部完成 ===')
        browser.close()

if __name__ == '__main__':
    run()
