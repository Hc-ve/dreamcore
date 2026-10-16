# -*- coding: utf-8 -*-
"""层3 直接验收：transformers 直读 merged 模型（不经 ollama/GGUF），10 条
目的：区分枚举混淆来自量化还是模型本体
"""
import json, re, sys, time
sys.stdout.reconfigure(encoding='utf-8')
import torch
from transformers import AutoModelForCausalLM, AutoTokenizer

MODEL = 'E:/a/6a578b50553ee2fa56364236/training-env/models/dreamcraft-1.5b-merged'
TEST_IDEAS = ['敦煌飞天主题的明信片', '青花瓷纹样的手机壁纸', '赛博朋克风格的文旅海报',
              '苗族银饰灵感的藏品卡', '江南水乡水墨画模板', '春节庙会主题的文创设计',
              '三星堆青铜面具周边', '故宫红墙雪景壁纸', '皮影戏主题的文创衍生品', '茶马古道纪念明信片']
CRAFT_TYPES = ['wallpaper', 'poster', 'card', 'postcard', 'template']
STYLES = ['guofeng', 'feiyi', 'minimal', 'qinghua', 'dunhuang', 'ink', 'neon', 'festive']
LAYOUT_TYPE_MAP = {'poster-hero': ['poster'], 'poster-sym': ['poster'], 'postcard-circle': ['postcard'],
                   'postcard-torn': ['postcard'], 'card-layered': ['card'], 'wallpaper-min': ['wallpaper']}
PALETTES = ['靛蓝', '米白', '赭石', '朱砂', '黛青', '绛红', '竹青', '月白', '赭黄', '石绿', '藤黄', '水墨']
HAN = re.compile(r'[\u4e00-\u9fa5]')

def build_prompt(idea):
    return (
        '你是"AI+文旅文创"平台的文创设计顾问，为用户想法定制文创衍生品方案。\n'
        f'用户想法：「{idea}」。\n'
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

def validate_base(plan):
    try:
        title = str(plan.get('title', ''))
        if not (6 <= len(HAN.findall(title)) <= 16): return 'title'
        if not (8 <= len(HAN.findall(str(plan.get('subtitle', '')))) <= 20): return 'subtitle'
        if plan.get('craftType') not in CRAFT_TYPES: return 'craftType'
        if plan.get('style') not in STYLES: return 'style'
        st = plan.get('stickers')
        if not isinstance(st, list) or len(st) > 3 or not all(isinstance(x, str) for x in st): return 'stickers'
        return None
    except Exception:
        return 'fields'

def validate_new_fields(plan):
    layout, palette, scenes = plan.get('layout'), plan.get('palette'), plan.get('scenes')
    if layout is None and palette is None and scenes is None: return 'missing'
    ct = plan.get('craftType')
    if ct == 'template':
        if layout: return 'layout'
    else:
        if layout not in LAYOUT_TYPE_MAP: return 'layout'
        if ct not in LAYOUT_TYPE_MAP[layout]: return 'layout-type'
    if not isinstance(palette, list) or not (2 <= len(palette) <= 3) \
            or not all(c in PALETTES for c in palette): return 'palette'
    if not isinstance(scenes, list) or len(scenes) > 2: return 'scenes'
    for s in scenes:
        if not isinstance(s, dict) or not isinstance(s.get('desc'), str): return 'scenes.desc'
        if not (10 <= len(HAN.findall(s['desc'])) <= 24): return 'scenes.desc-len'
        if s.get('slot') not in ('main', 'scene'): return 'scenes.slot'
    return None

def main():
    print('loading model...')
    tok = AutoTokenizer.from_pretrained(MODEL, trust_remote_code=True)
    model = AutoModelForCausalLM.from_pretrained(MODEL, torch_dtype=torch.bfloat16,
                                                 device_map='auto', trust_remote_code=True)
    model.eval()
    ok, new_ok, bad, new_bad = 0, 0, [], []
    t0 = time.time()
    for i, idea in enumerate(TEST_IDEAS, 1):
        msgs = [{'role': 'user', 'content': build_prompt(idea)}]
        text = tok.apply_chat_template(msgs, tokenize=False, add_generation_prompt=True)
        inputs = tok(text, return_tensors='pt').to(model.device)
        with torch.no_grad():
            out = model.generate(**inputs, max_new_tokens=500, do_sample=True,
                                 temperature=0.2, top_p=0.9, top_k=50)
        gen = tok.decode(out[0][inputs.input_ids.shape[1]:], skip_special_tokens=True).strip()
        m = re.search(r'\{[\s\S]*\}', gen)
        if not m:
            bad.append(f'[{i}]无JSON'); new_bad.append(f'[{i}]无JSON')
            print(f'  [{i}] x 无JSON: {gen[:50]}'); continue
        try:
            plan = json.loads(m.group(0))
        except json.JSONDecodeError:
            bad.append(f'[{i}]解析失败'); new_bad.append(f'[{i}]解析失败')
            print(f'  [{i}] x 解析失败'); continue
        err, nerr = validate_base(plan), validate_new_fields(plan)
        if err:
            bad.append(f'[{i}]{err}')
            print(f'  [{i}] △ 不合规({err}) craftType={plan.get("craftType")!r}')
        else:
            ok += 1
            if nerr is None:
                new_ok += 1
                print(f'  [{i}] OK {plan["title"]} | {plan.get("craftType")} | {plan.get("layout")}')
            else:
                new_bad.append(f'[{i}]{nerr}')
                print(f'  [{i}] OK-旧字段 新字段异常({nerr})')
    total = len(TEST_IDEAS)
    print(f'\n===== 直接验收（transformers bf16，无量化）=====')
    print(f'JSON 合法率: {ok}/{total} = {ok/total*100:.0f}%  [线 ≥90%]')
    print(f'新字段合规率: {new_ok}/{total} = {new_ok/total*100:.0f}%  [线 ≥85%]')
    print(f'平均耗时: {(time.time()-t0)/total:.1f}s/条')
    if bad: print(f'不合规明细: {bad}')
    if new_bad: print(f'新字段异常明细: {new_bad}')
    sys.exit(0 if (ok/total >= 0.9 and new_ok/total >= 0.85) else 1)

if __name__ == '__main__':
    main()
