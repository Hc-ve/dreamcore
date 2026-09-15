"""
Dreamcore Vite 迁移后功能测试
测试项目：页面加载、控制台错误、画廊渲染、导航功能、粒子背景
"""
from playwright.sync_api import sync_playwright
import sys

def test_dreamcore():
    with sync_playwright() as p:
        browser = p.chromium.launch(headless=True)
        page = browser.new_page()

        # 收集控制台错误
        errors = []
        console_msgs = []

        page.on("console", lambda msg: console_msgs.append(f"[{msg.type}] {msg.text}"))
        page.on("pageerror", lambda err: errors.append(str(err)))

        print("=" * 60)
        print("Dreamcore Vite 迁移功能测试")
        print("=" * 60)

        # 测试1：页面加载
        print("\n[测试1] 页面加载...")
        try:
            response = page.goto('http://localhost:5173/', timeout=30000)
            page.wait_for_load_state('networkidle', timeout=15000)
            print(f"  ✓ 页面加载成功 (HTTP {response.status})")
        except Exception as e:
            print(f"  ✗ 页面加载失败: {e}")
            browser.close()
            return False

        # 测试2：检查标题
        print("\n[测试2] 检查页面标题...")
        title = page.title()
        if "Dreamcore" in title:
            print(f"  ✓ 标题正确: {title}")
        else:
            print(f"  ✗ 标题异常: {title}")

        # 测试3：检查导航栏
        print("\n[测试3] 检查导航栏...")
        navbar = page.query_selector('#navbar')
        if navbar:
            print("  ✓ 导航栏存在")
        else:
            print("  ✗ 导航栏缺失")

        # 测试4：检查Hero区域
        print("\n[测试4] 检查Hero首屏...")
        hero = page.query_selector('#hero')
        if hero:
            hero_title = page.query_selector('#hero-title')
            if hero_title:
                print(f"  ✓ Hero区域存在: {hero_title.inner_text()[:30]}...")
            else:
                print("  ✗ Hero标题缺失")
        else:
            print("  ✗ Hero区域缺失")

        # 测试5：检查画廊加载
        print("\n[测试5] 检查画廊作品加载...")
        page.wait_for_timeout(3000)  # 等待画廊加载

        # 先关闭欢迎弹窗（如果存在）
        welcome_modal = page.query_selector('.welcome-modal.open')
        if welcome_modal:
            print("  ℹ 检测到欢迎弹窗，尝试关闭...")
            try:
                # 点击弹窗外部或关闭按钮
                close_btn = page.query_selector('.welcome-modal .welcome-close, .welcome-modal button')
                if close_btn:
                    close_btn.click()
                else:
                    # 点击遮罩层关闭
                    page.evaluate("document.querySelector('.welcome-modal.open').classList.remove('open')")
                page.wait_for_timeout(1000)
                print("  ✓ 欢迎弹窗已关闭")
            except Exception as e:
                print(f"  ⚠ 关闭欢迎弹窗失败: {e}")
                # 强制移除
                page.evaluate("""
                    document.querySelectorAll('.welcome-modal.open').forEach(m => m.classList.remove('open'));
                    document.body.style.overflow = '';
                """)
                page.wait_for_timeout(500)

        gallery_grid = page.query_selector('#gallery-grid')
        if gallery_grid:
            cards = page.query_selector_all('.artwork-card')
            print(f"  ✓ 画廊网格存在，已加载 {len(cards)} 件作品")
            if len(cards) == 0:
                print("  ⚠ 警告：画廊未加载任何作品卡片")
        else:
            print("  ✗ 画廊网格缺失")

        # 测试6：检查画廊计数
        print("\n[测试6] 检查画廊计数...")
        count_el = page.query_selector('#gallery-count')
        if count_el:
            count = count_el.inner_text()
            print(f"  ✓ 画廊计数: {count} 件作品")
        else:
            print("  ✗ 画廊计数元素缺失")

        # 测试7：检查3D粒子背景
        print("\n[测试7] 检查3D粒子背景...")
        canvas = page.query_selector('#particle-canvas')
        if canvas:
            print("  ✓ 粒子画布存在")
        else:
            print("  ✗ 粒子画布缺失")

        # 测试8：检查分类筛选栏
        print("\n[测试8] 检查分类筛选栏...")
        filter_bar = page.query_selector('#filter-bar')
        if filter_bar:
            chips = page.query_selector_all('.filter-chip')
            print(f"  ✓ 筛选栏存在，{len(chips)} 个分类标签")
        else:
            print("  ✗ 筛选栏缺失")

        # 测试9：检查AI助手
        print("\n[测试9] 检查AI助手...")
        page.wait_for_timeout(2000)  # 等待AI助手初始化
        ai_fab = page.query_selector('.ai-fab')
        if ai_fab:
            print("  ✓ AI助手浮动按钮存在")
        else:
            print("  ⚠ AI助手浮动按钮未找到（可能延迟加载）")

        # 测试10：检查自定义光标
        print("\n[测试10] 检查自定义光标...")
        cursor_dot = page.query_selector('#cursor-dot')
        cursor_ring = page.query_selector('#cursor-ring')
        if cursor_dot and cursor_ring:
            print("  ✓ 自定义光标存在")
        else:
            print("  ✗ 自定义光标缺失")

        # 测试11：测试分类筛选功能
        print("\n[测试11] 测试分类筛选...")
        try:
            digital_art_chip = page.query_selector('[data-category="digital-art"]')
            if digital_art_chip:
                digital_art_chip.click()
                page.wait_for_timeout(1500)
                cards_after = page.query_selector_all('.artwork-card')
                print(f"  ✓ 点击'数字艺术'筛选后，显示 {len(cards_after)} 件作品")

                # 切回全部
                all_chip = page.query_selector('[data-category="all"]')
                if all_chip:
                    all_chip.click()
                    page.wait_for_timeout(1000)
                    print("  ✓ 切回'全部'分类成功")
        except Exception as e:
            print(f"  ✗ 分类筛选测试失败: {e}")

        # 测试12：检查控制台错误
        print("\n[测试12] 检查控制台错误...")
        if errors:
            print(f"  ✗ 发现 {len(errors)} 个页面错误:")
            for err in errors[:5]:
                print(f"    - {err[:150]}")
        else:
            print("  ✓ 无页面错误")

        # 检查控制台错误消息
        console_errors = [m for m in console_msgs if m.startswith('[error]')]
        if console_errors:
            print(f"  ⚠ 发现 {len(console_errors)} 条控制台错误消息:")
            for msg in console_errors[:3]:
                print(f"    - {msg[:150]}")
        else:
            print("  ✓ 无控制台错误消息")

        # 截图
        print("\n[截图] 保存页面截图...")
        page.screenshot(path='test_vite_migration.png', full_page=True)
        print("  ✓ 截图已保存: test_vite_migration.png")

        # 打印所有控制台消息（调试用）
        print("\n[调试] 控制台消息（前10条）:")
        for msg in console_msgs[:10]:
            print(f"  {msg[:200]}")

        browser.close()

        print("\n" + "=" * 60)
        print("测试完成！")
        print("=" * 60)
        return len(errors) == 0

if __name__ == '__main__':
    success = test_dreamcore()
    sys.exit(0 if success else 1)
