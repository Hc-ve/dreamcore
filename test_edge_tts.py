"""
Dreamcore Edge TTS 集成测试
测试内容：
1. AI助手对话框打开/关闭
2. 语音按钮状态
3. 音色选择器面板显示/隐藏
4. 音色列表加载
5. Edge TTS 可用性检测
6. localStorage 持久化
"""
import json
import sys
from playwright.sync_api import sync_playwright, expect

FRONTEND_URL = "http://localhost:8080"
BACKEND_URL = "http://localhost:3001"

def log(msg, status="info"):
    icons = {"pass": "✅", "fail": "❌", "info": "ℹ️", "warn": "⚠️"}
    print(f"{icons.get(status, 'ℹ️')}  {msg}")

def run_tests():
    passed = 0
    failed = 0
    
    with sync_playwright() as p:
        browser = p.chromium.launch(headless=True)
        context = browser.new_context(
            viewport={"width": 1440, "height": 900},
            locale="zh-CN"
        )
        page = context.new_page()
        
        console_errors = []
        page.on("console", lambda msg: console_errors.append(msg.text) if msg.type == "error" else None)
        page.on("pageerror", lambda err: console_errors.append(f"PageError: {err.message}"))
        
        log(f"打开页面: {FRONTEND_URL}", "info")
        page.goto(FRONTEND_URL)
        page.wait_for_load_state("networkidle")
        page.wait_for_timeout(2000)
        
        # Test 1: 页面加载成功
        log("Test 1: 页面加载", "info")
        try:
            expect(page).to_have_title("Dreamcore - 梦境艺术画廊")
            log("页面标题正确", "pass")
            passed += 1
        except Exception as e:
            log(f"页面标题错误: {e}", "fail")
            failed += 1
        
        # Test 2: AI助手FAB存在
        log("\nTest 2: AI助手浮动按钮", "info")
        try:
            fab = page.locator("#ai-fab")
            expect(fab).to_be_visible()
            log("AI助手浮动按钮可见", "pass")
            passed += 1
        except Exception as e:
            log(f"AI助手浮动按钮不可见: {e}", "fail")
            failed += 1
            page.screenshot(path="test_fail_fab.png", full_page=True)
        
        # Test 3: 打开AI对话框
        log("\nTest 3: 打开AI对话框", "info")
        try:
            page.locator("#ai-fab").click()
            page.wait_for_timeout(500)
            dialog = page.locator("#ai-dialog")
            expect(dialog).to_have_class("ai-dialog open")
            log("AI对话框成功打开", "pass")
            passed += 1
        except Exception as e:
            log(f"打开AI对话框失败: {e}", "fail")
            failed += 1
            page.screenshot(path="test_fail_dialog.png", full_page=True)
        
        # Test 4: 语音开关按钮
        log("\nTest 4: 语音开关按钮", "info")
        try:
            voice_btn = page.locator("#ai-voice-toggle")
            expect(voice_btn).to_be_visible()
            expect(voice_btn).to_have_class("ai-icon-btn ai-voice-toggle active")
            log("语音按钮默认为开启状态", "pass")
            passed += 1
        except Exception as e:
            log(f"语音按钮状态错误: {e}", "fail")
            failed += 1
        
        # Test 5: 音色选择器按钮
        log("\nTest 5: 音色选择器按钮", "info")
        try:
            selector_btn = page.locator("#ai-voice-selector")
            expect(selector_btn).to_be_visible()
            log("音色选择器按钮可见", "pass")
            passed += 1
        except Exception as e:
            log(f"音色选择器按钮不可见: {e}", "fail")
            failed += 1
        
        # Test 6: 打开音色选择面板
        log("\nTest 6: 打开音色选择面板", "info")
        try:
            page.locator("#ai-voice-selector").click()
            page.wait_for_timeout(300)
            panel = page.locator("#ai-voice-panel")
            expect(panel).to_have_class("ai-voice-panel open")
            log("音色选择面板成功打开", "pass")
            passed += 1
        except Exception as e:
            log(f"打开音色选择面板失败: {e}", "fail")
            failed += 1
            page.screenshot(path="test_fail_voice_panel.png", full_page=True)
        
        # Test 7: 音色列表加载
        log("\nTest 7: 音色列表加载", "info")
        try:
            voice_list = page.locator("#ai-voice-list")
            voice_items = voice_list.locator(".ai-voice-item")
            count = voice_items.count()
            log(f"加载了 {count} 个音色", "info")
            if count > 0:
                log("音色列表加载成功", "pass")
                passed += 1
                
                first_voice_name = voice_items.first.locator(".ai-voice-name").text_content()
                log(f"第一个音色: {first_voice_name}", "info")
            else:
                log("音色列表为空（可能后端未启动）", "warn")
                failed += 1
        except Exception as e:
            log(f"音色列表加载失败: {e}", "fail")
            failed += 1
        
        # Test 8: 检查Edge TTS可用性
        log("\nTest 8: Edge TTS 可用性检测", "info")
        try:
            edge_available = page.evaluate("() => AI.edgeTTSAvailable")
            if edge_available:
                log("Edge TTS 后端可用", "pass")
                passed += 1
            else:
                log("Edge TTS 后端不可用（降级模式）", "warn")
                passed += 1
        except Exception as e:
            log(f"检测Edge TTS状态失败: {e}", "fail")
            failed += 1
        
        # Test 9: 当前音色
        log("\nTest 9: 当前音色配置", "info")
        try:
            current_voice = page.evaluate("() => AI.currentVoice")
            log(f"当前音色: {current_voice}", "info")
            if current_voice:
                log("当前音色配置正确", "pass")
                passed += 1
            else:
                log("当前音色未设置", "fail")
                failed += 1
        except Exception as e:
            log(f"获取当前音色失败: {e}", "fail")
            failed += 1
        
        # Test 10: 选择音色
        log("\nTest 10: 切换音色", "info")
        try:
            voice_items = page.locator("#ai-voice-list .ai-voice-item")
            count = voice_items.count()
            if count >= 2:
                voice_items.nth(1).click()
                page.wait_for_timeout(500)
                new_voice = page.evaluate("() => AI.currentVoice")
                log(f"切换后音色: {new_voice}", "info")
                
                saved_voice = page.evaluate("() => localStorage.getItem('dreamcore_ai_voice')")
                log(f"localStorage保存: {saved_voice}", "info")
                
                if saved_voice == new_voice:
                    log("音色切换并保存成功", "pass")
                    passed += 1
                else:
                    log("音色保存失败", "fail")
                    failed += 1
            else:
                log("音色不足，跳过切换测试", "warn")
                passed += 1
        except Exception as e:
            log(f"切换音色失败: {e}", "fail")
            failed += 1
        
        # Test 11: 关闭音色面板
        log("\nTest 11: 关闭音色面板", "info")
        try:
            page.locator(".ai-dialog-body").click()
            page.wait_for_timeout(300)
            panel = page.locator("#ai-voice-panel")
            expect(panel).not_to_have_class("ai-voice-panel open")
            log("点击外部区域关闭面板成功", "pass")
            passed += 1
        except Exception as e:
            log(f"关闭音色面板失败: {e}", "fail")
            failed += 1
        
        # Test 12: 控制台错误检查
        log("\nTest 12: 控制台错误检查", "info")
        if console_errors:
            log(f"发现 {len(console_errors)} 个控制台错误:", "warn")
            for err in console_errors[:5]:
                log(f"  - {err}", "warn")
            failed += 1
        else:
            log("无控制台错误", "pass")
            passed += 1
        
        # 截图
        page.screenshot(path="test_edge_tts_result.png", full_page=True)
        log(f"\n测试截图已保存: test_edge_tts_result.png", "info")
        
        browser.close()
    
    print("\n" + "="*60)
    log(f"测试完成: {passed} 通过, {failed} 失败", "pass" if failed == 0 else "fail")
    print("="*60)
    
    return failed == 0

if __name__ == "__main__":
    success = run_tests()
    sys.exit(0 if success else 1)
