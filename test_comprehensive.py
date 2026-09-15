
import asyncio
from playwright.async_api import async_playwright
import time
import json

async def run_tests():
    bugs = []
    
    async with async_playwright() as p:
        browser = await p.chromium.launch(headless=True)
        context = await browser.new_context(
            viewport={'width': 1280, 'height': 800},
            locale='zh-CN'
        )
        page = await context.new_page()
        
        console_errors = []
        page.on('console', lambda msg: console_errors.append(f'{msg.type}: {msg.text}') if msg.type == 'error' else None)
        page.on('pageerror', lambda err: console_errors.append(f'pageerror: {str(err)}'))
        
        print("=" * 60)
        print("测试 1: 页面加载与控制台错误")
        print("=" * 60)
        
        try:
            start_time = time.time()
            await page.goto('http://localhost:8080', wait_until='networkidle', timeout=30000)
            load_time = time.time() - start_time
            print(f"✓ 页面加载成功，耗时: {load_time:.2f}s")
        except Exception as e:
            bugs.append(f"页面加载失败: {str(e)}")
            print(f"✗ 页面加载失败: {e}")
            await browser.close()
            return bugs
        
        await page.wait_for_timeout(3000)
        
        if console_errors:
            print(f"✗ 发现 {len(console_errors)} 个控制台错误:")
            for err in console_errors[:10]:
                print(f"  - {err}")
                bugs.append(f"控制台错误: {err}")
        else:
            print("✓ 无控制台错误")
        
        print("\n" + "=" * 60)
        print("测试 2: 页面元素存在性检查")
        print("=" * 60)
        
        elements_to_check = [
            ('#navbar', '导航栏'),
            ('#hero', 'Hero区域'),
            ('#gallery', '画廊区域'),
            ('#filter-bar', '分类筛选栏'),
            ('#gallery-grid', '作品网格'),
            ('#particle-canvas', '粒子背景'),
            ('#ai-fab', 'AI助手按钮'),
            ('footer', '页脚'),
            ('#btn-search', '搜索按钮'),
            ('#btn-publish', '发布按钮'),
            ('#sound-toggle', '音效开关'),
            ('#nav-user-area', '用户区域'),
        ]
        
        for selector, name in elements_to_check:
            try:
                el = await page.wait_for_selector(selector, timeout=5000)
                if el:
                    print(f"✓ {name} 存在")
                else:
                    print(f"✗ {name} 不存在")
                    bugs.append(f"页面元素缺失: {name} ({selector})")
            except:
                print(f"✗ {name} 不存在")
                bugs.append(f"页面元素缺失: {name} ({selector})")
        
        print("\n" + "=" * 60)
        print("测试 3: 画廊作品加载")
        print("=" * 60)
        
        await page.wait_for_timeout(2000)
        cards = await page.query_selector_all('.artwork-card')
        print(f"✓ 加载了 {len(cards)} 个作品卡片")
        
        if len(cards) == 0:
            bugs.append("画廊没有加载任何作品卡片")
        
        print("\n" + "=" * 60)
        print("测试 4: 分类筛选功能")
        print("=" * 60)
        
        categories = [
            ('digital-art', '数字艺术'),
            ('photography', '摄影'),
            ('illustration', '插画'),
            ('abstract', '抽象'),
            ('3d-art', '3D艺术'),
            ('all', '全部'),
        ]
        
        for cat, name in categories:
            try:
                chip = await page.query_selector(f'.filter-chip[data-category="{cat}"]')
                if chip:
                    await chip.click()
                    await page.wait_for_timeout(500)
                    count = await page.query_selector_all('.artwork-card')
                    print(f"✓ {name} 筛选: {len(count)} 件作品")
                else:
                    print(f"✗ {name} 分类按钮不存在")
                    bugs.append(f"分类筛选按钮缺失: {name}")
            except Exception as e:
                print(f"✗ {name} 筛选失败: {e}")
                bugs.append(f"分类筛选失败: {name} - {str(e)}")
        
        print("\n" + "=" * 60)
        print("测试 5: 排序功能")
        print("=" * 60)
        
        sort_options = [
            ('latest', '最新'),
            ('popular', '热门'),
            ('recommended', '推荐'),
        ]
        
        for val, name in sort_options:
            try:
                select = await page.query_selector('#sort-select')
                if select:
                    await select.select_option(val)
                    await page.wait_for_timeout(500)
                    print(f"✓ {name} 排序正常")
                else:
                    print(f"✗ 排序选择器不存在")
                    bugs.append("排序选择器不存在")
                    break
            except Exception as e:
                print(f"✗ {name} 排序失败: {e}")
                bugs.append(f"排序失败: {name} - {str(e)}")
        
        print("\n" + "=" * 60)
        print("测试 6: AI助手功能")
        print("=" * 60)
        
        try:
            ai_btn = await page.query_selector('#ai-fab')
            if ai_btn:
                await ai_btn.click()
                await page.wait_for_timeout(1000)
                ai_dialog = await page.query_selector('#ai-dialog')
                if ai_dialog and await ai_dialog.is_visible():
                    print("✓ AI助手对话框打开成功")
                    
                    input_el = await page.query_selector('#ai-input')
                    if input_el:
                        await input_el.fill('你好')
                        send_btn = await page.query_selector('#ai-send')
                        if send_btn:
                            await send_btn.click()
                            await page.wait_for_timeout(2000)
                            messages = await page.query_selector_all('.ai-msg')
                            print(f"✓ AI对话正常，共 {len(messages)} 条消息")
                    else:
                        print("✗ AI输入框不存在")
                    
                    close_btn = await page.query_selector('#ai-close')
                    if close_btn:
                        await close_btn.click()
                        await page.wait_for_timeout(500)
                        print("✓ AI助手对话框关闭正常")
                else:
                    print("✗ AI助手对话框未打开")
                    bugs.append("AI助手对话框无法打开")
            else:
                print("✗ AI助手按钮不存在")
                bugs.append("AI助手按钮不存在")
        except Exception as e:
            print(f"✗ AI助手测试失败: {e}")
            bugs.append(f"AI助手测试失败: {str(e)}")
        
        print("\n" + "=" * 60)
        print("测试 7: 作品灯箱")
        print("=" * 60)
        
        try:
            first_card = await page.query_selector('.artwork-card')
            if first_card:
                await first_card.click()
                await page.wait_for_timeout(1500)
                
                lightbox = await page.query_selector('#lightbox-modal')
                if lightbox and await lightbox.is_visible():
                    print("✓ 作品灯箱打开成功")
                    
                    like_btn = await page.query_selector('#lb-like-btn')
                    if like_btn:
                        print("✓ 点赞按钮存在")
                    
                    fav_btn = await page.query_selector('#lb-fav-btn')
                    if fav_btn:
                        print("✓ 收藏按钮存在")
                    
                    share_btn = await page.query_selector('#lb-share-btn')
                    if share_btn:
                        print("✓ 分享按钮存在")
                    
                    close_btn = await page.query_selector('[data-lb-close]')
                    if close_btn:
                        await close_btn.click()
                        await page.wait_for_timeout(500)
                        print("✓ 灯箱关闭正常")
                    else:
                        print("✗ 灯箱关闭按钮不存在")
                        bugs.append("灯箱关闭按钮不存在")
                else:
                    print("✗ 作品灯箱未打开")
                    bugs.append("作品灯箱无法打开")
            else:
                print("✗ 没有作品卡片可点击")
        except Exception as e:
            print(f"✗ 作品灯箱测试失败: {e}")
            bugs.append(f"作品灯箱测试失败: {str(e)}")
        
        print("\n" + "=" * 60)
        print("测试 8: 搜索功能")
        print("=" * 60)
        
        try:
            search_btn = await page.query_selector('#btn-search')
            if search_btn:
                await search_btn.click()
                await page.wait_for_timeout(1000)
                
                search_modal = await page.query_selector('#search-modal')
                if search_modal and await search_modal.is_visible():
                    print("✓ 搜索弹窗打开成功")
                    
                    search_input = await page.query_selector('#search-input')
                    if search_input:
                        await search_input.fill('梦幻')
                        await page.wait_for_timeout(1500)
                        
                        results = await page.query_selector_all('.search-card')
                        print(f"✓ 搜索正常，找到 {len(results)} 个结果")
                    
                    close_btn = await page.query_selector('#search-modal [data-close]')
                    if close_btn:
                        await close_btn.click()
                        await page.wait_for_timeout(500)
                        print("✓ 搜索弹窗关闭正常")
                else:
                    print("✗ 搜索弹窗未打开")
                    bugs.append("搜索弹窗无法打开")
            else:
                print("✗ 搜索按钮不存在")
                bugs.append("搜索按钮不存在")
        except Exception as e:
            print(f"✗ 搜索功能测试失败: {e}")
            bugs.append(f"搜索功能测试失败: {str(e)}")
        
        print("\n" + "=" * 60)
        print("测试 9: 响应式布局 (移动端)")
        print("=" * 60)
        
        try:
            await page.set_viewport_size({'width': 375, 'height': 667})
            await page.wait_for_timeout(500)
            
            mobile_menu = await page.query_selector('#menu-toggle')
            if mobile_menu:
                print("✓ 移动端菜单按钮存在")
            
            nav = await page.query_selector('#navbar')
            if nav:
                print("✓ 导航栏在移动端存在")
            
            gallery_grid = await page.query_selector('#gallery-grid')
            if gallery_grid:
                print("✓ 画廊在移动端存在")
            
            await page.set_viewport_size({'width': 1280, 'height': 800})
            print("✓ 响应式切换正常")
        except Exception as e:
            print(f"✗ 响应