# -*- coding: utf-8 -*-
"""端到端集成测试（层3 schema）：dev server(5173) → vite aiProxyDev 中间件 → ai-proxy.mjs → ollama(11434)
用法：python e2e_test.py
"""
import json, re, sys, urllib.request
sys.stdout.reconfigure(encoding='utf-8')

# 特意选用 v2 验收时最顽固的分布外用例（泛称"周边"表述）验证泛化修复
IDEA = '三星堆青铜面具周边'

prompt = (
    '你是"AI+文旅文创"平台的文创设计顾问，为用户想法定制文创衍生品方案。\n'
    f'用户想法：「{IDEA}」。\n'
    '请严格输出一个 JSON 对象（禁止 markdown 代码块、禁止任何多余文字），字段如下：\n'
    'title：文创标题，6-16 个汉字，有文旅美感；\n'
    'subtitle：副标题文案，8-20 个汉字；\n'
    'craftType：从 [wallpaper/poster/card/postcard/template] 中选最匹配的一项；\n'
    'style：从 [guofeng/feiyi/minimal/qinghua/dunhuang/ink/neon/festive] 中选最匹配的一项；\n'
    'layout：从 [poster-hero/poster-sym/postcard-circle/postcard-torn/card-layered/wallpaper-min] 中选与 craftType 匹配的一项，craftType 为 template 时输出空字符串；\n'
    'palette：2-3 个传统色名，从 [靛蓝/米白/赭石/朱砂/黛青/绛红/竹青/月白/赭黄/石绿/藤黄/水墨] 中选，JSON 字符串数组；\n'
    'scenes：0-2 个分镜对象数组，每项为 {"desc":"10-24 字分镜画面描述","slot":"main 或 scene"}；\n'
    'stickers：0-3 个契合主题的 emoji 装饰，JSON 字符串数组。'
)

payload = json.dumps({
    'prompt': prompt,
    'provider': 'self-trained',
    'maxTokens': 500,
    'temperature': 0.2
}, ensure_ascii=False).encode('utf-8')

req = urllib.request.Request(
    'http://127.0.0.1:5173/api/ai/text-generation',
    data=payload,
    headers={'Content-Type': 'application/json'}
)
d = json.loads(urllib.request.urlopen(req, timeout=90).read().decode('utf-8'))
print('provider 返回:', d.get('provider'))
print('text:', d.get('text'))
m = re.search(r'\{[\s\S]*\}', d.get('text', ''))
plan = json.loads(m.group(0)) if m else None
print('JSON 解析:', 'OK' if plan else 'FAIL')
if plan:
    print(f'title={plan["title"]} | craftType={plan["craftType"]} | style={plan["style"]} | layout={plan.get("layout")}')
    print(f'palette={plan.get("palette")} | scenes={len(plan.get("scenes", []))} 项')
    if d.get('provider') == 'self-trained' and plan.get('craftType') in ('wallpaper', 'poster', 'card', 'postcard', 'template'):
        print('\n端到端链路: 前端代理 → ai-proxy → ollama 自研模型(v3) ✓ 全部打通')
