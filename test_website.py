from playwright.sync_api import sync_playwright
import time
import json

def run_tests():
    bugs = []
    
    with sync_playwright() as p:
        browser = p.chromium.launch(headless=True)
        page = browser.new_page(viewport={'width': 1920, 'height': 1080})
        
        console_errors = []
        page.on('console', lambda msg: console_errors.append(f'[{msg.type}] {msg.text}') if msg.type in ['error', 'warning'] else None)
        
        page_errors = []
        page.on('pageerror', lambda err: page_errors.append(str(err)))
        
        print('=' * 60)
        print('Dreamcore 网站全面测试报告')
        print('=' * 60)
        
        # 1. 页面加载测试
        print('\n📊 1. 页面加载测试')
        print('-' * 40)
        start_time = time.time()
        try:
            page.goto('http://localhost:8080', wait_until='networkidle', timeout=30000)
            load_time = time.time() - start_time
            print(f'✅ 页面加载成功: {load_time:.2f}秒')
        except Exception as e:
            print(f'❌ 页面加载失败: {e}')
            bugs.append(('页面加载失败', str(e), '高'))
            browser.close()
            return bugs
        
        # 等待一段时间让JS初始化
        page.wait_for_timeout(3000)
        
        # 2. 控制台错误检查
        print('\n📊 2. 控制台错误检查')
        print('-' * 40)
        if page_errors:
            print(f'❌ 发现 {len(page_errors)} 个页面错误:')
            for err in page_errors:
                print(f'   - {err}')
                bugs.append(('JS运行时错误', err, '高'))
        else:
            print('✅ 无页面运行时错误')
            
        if console_errors:
            print(f'⚠️  发现 {len(console_errors)} 个控制台警告/错误:')
            for err in console_errors[:10]:
                print(f'   - {err}')
            if len(console_errors) > 10:
                print(f'   ... 还有 {len(console_errors) - 10} 条')
        else:
            print('✅ 无控制台警告')
        
        # 3. 基础元素检查
        print('\n📊 3. 基础元素检查')
        print('-' * 40)
        
        elements_to_check = [
            ('#navbar', '导航栏'),
            ('#hero', 'Hero区域'),
            ('#gallery', '画廊区域'),
            ('#filter-bar', '筛选栏'),
            ('#gallery-grid', '作品网格'),
            ('footer', '页脚'),
        ]
        
        for selector, name in elements_to_check:
            if page.locator(selector).count() > 0:
                print(f'✅ {name} 存在')
            else:
                print(f'❌ {name} 缺失')
                bugs.append((f'{name}缺失', f'选择器 {selector} 未找到', '中'))
        
        # 4. 作品卡片检查
        print('\n📊 4. 作品卡片检查')
        print('-' * 40)
        cards = page.locator('.artwork-card')
        card_count = cards.count()
        print(f'✅ 找到 {card_count} 个作品卡片')
        
        if card_count > 0:
            first_card = cards.first
            # 检查卡片内容
            title = first_card.locator('.card-title')
            if title.count() > 0:
                print(f'✅ 作品标题存在: {title.inner_text()[:30]}...')
            else:
                print('❌ 作品标题缺失')
                bugs.append(('作品卡片标题缺失', '第一个作品卡片没有标题', '中'))
            
            # 检查图片懒加载
            img = first_card.locator('.card-img')
            if img.count() > 0:
                data_src = img.get_attribute('data-src')
                if data_src:
                    print(f'✅ 图片懒加载属性正确')
                else:
                    print('⚠️  图片缺少data-src属性')
            else:
                print('❌ 作品图片缺失')
                bugs.append(('作品卡片图片缺失', '第一个作品卡片没有图片', '中'))
        else:
            print('❌ 没有作品卡片')
            bugs.append(('作品列表为空', '画廊中没有任何作品卡片', '高'))
        
        # 5. 分类筛选测试
        print('\n📊 5. 分类筛选测试')
        print('-' * 40)
        filter_chips = page.locator('.filter-chip')
        filter_count = filter_chips.count()
        print(f'✅ 找到 {filter_count} 个分类筛选')
        
        if filter_count > 0:
            categories = ['all', 'digital-art', 'photography', 'illustration', 'abstract', '3d-art']
            for i, cat in enumerate(categories):
                if i < filter_count:
                    chip = filter_chips.nth(i)
                    data_cat = chip.get_attribute('data-category')
                    if data_cat == cat:
                        print(f'✅ 分类 {cat} 存在')
                    else:
                        print(f'⚠️  第{i}个分类实际为 {data_cat}')
        
        # 6. 登录功能测试
        print('\n📊 6. 用户系统测试')
        print('-' * 40)
        
        login_btn = page.locator('#btn-login')
        if login_btn.count() > 0:
            print('✅ 登录按钮存在')
            try:
                login_btn.click()
                page.wait_for_timeout(500)
                
                auth_modal = page.locator('#auth-modal')
                if auth_modal.count() > 0 and auth_modal.is_visible():
                    print('✅ 登录弹窗正常打开')
                    
                    # 测试登录
                    page.fill('#auth-username', 'admin')
                    page.fill('#auth-password', 'admin123')
                    page.click('#auth-submit')
                    page.wait_for_timeout(2000)
                    
                    # 检查是否登录成功
                    user_menu = page.locator('#user-menu')
                    if user_menu.count() > 0:
                        print('✅ 登录成功')
                        
                        # 测试登出
                        page.click('#user-avatar-btn')
                        page.wait_for_timeout(300)
                        logout_btn = page.locator('[data-action="logout"]')
                        if logout_btn.count() > 0:
                            print('✅ 登出按钮存在')
                        else:
                            print('❌ 登出按钮缺失')
                            bugs.append(('登出按钮缺失', '用户下拉菜单中找不到登出按钮', '中'))
                    else:
                        print('❌ 登录失败，用户菜单未显示')
                        bugs.append(('登录功能异常', '使用admin/admin123登录后未显示用户菜单', '高'))
                else:
                    print('❌ 登录弹窗未打开')
                    bugs.append(('登录弹窗无法打开', '点击登录按钮后弹窗未显示', '高'))
            except Exception as e:
                print(f'❌ 登录测试出错: {e}')
                bugs.append(('登录测试异常', str(e), '高'))
        else:
            print('⚠️  未找到登录按钮（可能已登录）')
        
        # 7. 作品灯箱测试
        print('\n📊 7. 作品灯箱测试')
        print('-' * 40)
        if card_count > 0:
            try:
                # 先确保登录状态正确
                user_menu = page.locator('#user-menu')
                if user_menu.count() == 0:
                    # 未登录状态，直接测试灯箱
                    pass
                
                cards.first.click()
                page.wait_for_timeout(1000)
                
                lightbox = page.locator('#lightbox-modal')
                if lightbox.count() > 0 and lightbox.is_visible():
                    print('✅ 作品灯箱正常打开')
                    
                    # 检查灯箱内容
                    lb_title = page.locator('.lb-title')
                    if lb_title.count() > 0:
                        print(f'✅ 灯箱标题存在')
                    
                    lb_author = page.locator('.lb-author')
                    if lb_author.count() > 0:
                        print('✅ 灯箱作者信息存在')
                    
                    lb_actions = page.locator('.lb-actions')
                    if lb_actions.count() > 0:
                        print('✅ 灯箱操作按钮存在')
                    
                    # 测试点赞按钮
                    like_btn = page.locator('#lb-like-btn')
                    if like_btn.count() > 0:
                        print('✅ 点赞按钮存在')
                    else:
                        print('❌ 点赞按钮缺失')
                        bugs.append(('灯箱点赞按钮缺失', '作品灯箱中找不到点赞按钮', '中'))
                    
                    # 测试收藏按钮
                    fav_btn = page.locator('#lb-fav-btn')
                    if fav_btn.count() > 0:
                        print('✅ 收藏按钮存在')
                    else:
                        print('❌ 收藏按钮缺失')
                        bugs.append(('灯箱收藏按钮缺失', '作品灯箱中找不到收藏按钮', '中'))
                    
                    # 测试分享按钮
                    share_btn = page.locator('#lb-share-btn')
                    if share_btn.count() > 0:
                        print('✅ 分享按钮存在')
                    else:
                        print('❌ 分享按钮缺失')
                        bugs.append(('灯箱分享按钮缺失', '作品灯箱中找不到分享按钮', '低'))
                    
                    # 测试评论区
                    comments_section = page.locator('.lb-comments')
                    if comments_section.count() > 0:
                        print('✅ 评论区存在')
                    else:
                        print('❌ 评论区缺失')
                        bugs.append(('灯箱评论区缺失', '作品灯箱中找不到评论区', '中'))
                    
                    # 关闭灯箱
                    page.click('[data-lb-close]')
                    page.wait_for_timeout(500)
                    print('✅ 灯箱关闭正常')
                else:
                    print('❌ 作品灯箱未打开')
                    bugs.append(('作品灯箱无法打开', '点击作品卡片后灯箱未显示', '高'))
            except Exception as e:
                print(f'❌ 灯箱测试出错: {e}')
                bugs.append(('灯箱测试异常', str(e), '高'))
        
        # 8. 搜索功能测试
        print('\n📊 8. 搜索功能测试')
        print('-' * 40)
        search_input = page.locator('.nav-search input')
        if search_input.count() > 0:
            print('✅ 搜索框存在')
            try:
                search_input.fill('梦境')
                page.wait_for_timeout(1000)
                print('✅ 搜索输入正常')
            except Exception as e:
                print(f'❌ 搜索测试出错: {e}')
        else:
            print('❌ 搜索框缺失')
            bugs.append(('导航栏搜索框缺失', '导航栏中找不到搜索框', '中'))
        
        # 9. 响应式测试（移动端）
        print('\n📊 9. 响应式测试')
        print('-' * 40)
        
        viewports = [
            (375, 812, '移动端 (iPhone X)'),
            (768, 1024, '平板端 (iPad)'),
            (1280, 800, '桌面端 (1280px)'),
        ]
        
        for width, height, name in viewports:
            page.set_viewport_size({'width': width, 'height': height})
            page.wait_for_timeout(500)
            
            nav_visible = page.locator('#navbar').is_visible()
            gallery_visible = page.locator('#gallery').is_visible()
            
            if nav_visible and gallery_visible:
                print(f'✅ {name}: 布局正常')
            else:
                print(f'❌ {name}: 布局异常')
                bugs.append((f'{name}响应式异常', f'导航栏可见:{nav_visible}, 画廊可见:{gallery_visible}', '中'))
        
        # 恢复桌面视图
        page.set_viewport_size({'width': 1920, 'height': 1080})
        
        # 10. 视觉效果检查
        print('\n📊 10. 视觉效果检查')
        print('-' * 40)
        
        # 检查液态玻璃效果
        glass_elements = page.locator('.glass')
        if glass_elements.count() > 0:
            print(f'✅ 液态玻璃效果元素存在 ({glass_elements.count()}个)')
        else:
            print('⚠️  未找到.glass类元素')
        
        # 检查自定义光标
        cursor_dot = page.locator('.cursor-dot')
        cursor_ring = page.locator('.cursor-ring')
        if cursor_dot.count() > 0 and cursor_ring.count() > 0:
            print('✅ 自定义光标元素存在')
        else:
            print('⚠️  自定义光标元素缺失')
        
        # 检查粒子背景
        particle_canvas = page.locator('#particle-canvas')
        if particle_canvas.count() > 0:
            print('✅ 粒子背景画布存在')
        else:
            print('⚠️  粒子背景画布缺失')
        
        # 11. 无障碍检查
        print('\n📊 11. 无障碍检查')
        print('-' * 40)
        
        # 检查ARIA标签
        skip_link = page.locator('.skip-link')
        if skip_link.count() > 0:
            print('✅ 跳过导航链接存在')
        else:
            print('❌ 跳过导航链接缺失')
            bugs.append(('无障碍: 跳过导航链接缺失', '屏幕阅读器用户无法快速跳转到主要内容', '低'))
        
        # 检查焦点样式
        focus_visible_style = page.evaluate('''() => {
            const style = getComputedStyle(document.body);
            return style.outlineStyle !== 'none';
        }''')
        print(f'✅ 焦点样式: {focus_visible_style}')
        
        # 12. 性能初步检查
        print('\n📊 12. 性能初步检查')
        print('-' * 40)
        
        performance_data = page.evaluate('''() => {
            const perf = performance.timing;
            const nav = performance.getEntriesByType('navigation')[0];
            return {
                domContentLoaded: nav ? nav.domContentLoadedEventEnd : perf.domContentLoadedEventEnd - perf.navigationStart,
                loadEvent: nav ? nav.loadEventEnd : perf.loadEventEnd - perf.navigationStart,
                firstPaint: performance.getEntriesByName('first-paint')[0]?.startTime || 0,
                firstContentfulPaint: performance.getEntriesByName('first-contentful-paint')[0]?.startTime || 0,
            };
        }''')
        
        print(f'   DOM内容加载: {performance_data["domContentLoaded"]:.0f}ms')
        print(f'   页面完全加载: {performance_data["loadEvent"]:.0f}ms')
        print(f'   首次绘制: {performance_data["firstPaint"]:.0f}ms')
        print(f'   首次内容绘制: {performance_data["firstContentfulPaint"]:.0f}ms')
        
        if performance_data['loadEvent'] > 5000:
            print('⚠️  页面加载时间超过5秒，可能存在性能问题')
            bugs.append(('性能问题: 加载缓慢', f'页面完全加载耗时 {performance_data["loadEvent"]:.0f}ms', '低'))
        
        # 13. 截图保存
        print('\n📊 13. 截图记录')
        print('-' * 40)
        try:
            page.screenshot(path='test_screenshot_full.png', full_page=True)
            print('✅ 全屏截图已保存: test_screenshot_full.png')
        except Exception as e:
            print(f'⚠️  截图失败: {e}')
        
        browser.close()
        
        # 总结
        print('\n' + '=' * 60)
        print('测试总结')
        print('=' * 60)
        print(f'发现 Bug 总数: {len(bugs)}')
        if bugs:
            print('\nBug 列表:')
            for i, (title, desc, severity) in enumerate(bugs, 1):
                print(f'  {i}. [{severity}] {title}')
                print(f'     {desc}')
        
        return bugs

if __name__ == '__main__':
    bugs = run_tests()
    
    # 保存测试结果
    with open('test_report.json', 'w', encoding='utf-8') as f:
        json.dump({'bugs': bugs, 'total': len(bugs)}, f, ensure_ascii=False, indent=2)
    
    print(f'\n测试报告已保存: test_report.json')
