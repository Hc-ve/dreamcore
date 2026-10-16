# -*- coding: utf-8 -*-
# ============================================================
# craft_accept_v6.py — v6 文创模型标准化验收（T8，全 OOD 用例）
# 验收对象：ollama 模型 dreamcraft-1.5b:v6（F16 GGUF 部署后）
# 指标（对标计划 T8 与 v3 基线）：
#   1. JSON 可解析率（自愈重试护栏：失败低温重试 1 次——v5 采样抖动经验）
#   2. craftType/style 枚举合规率（目标 10/10 不低于 v3 基线）
#   3. productName 知识库命中率（目标 ≥90%）
#   4. layout 与 craftType 匹配率（目标 ≥90%）
#   5. palette 合法色名率（目标 ≥95%）
#   6. 贴题率：title 扣主题词根（目标 ≥90%，20 条 OOD 主题）
# 用例设计：20 个黑名单主题（未进训练集，真 OOD；含用户报告案例秦淮河夫子庙）
# 输出：逐条明细 + 汇总指标 JSON（accept-result-v6.json，供 HTML 训练报告引用）
# 用法：python training-data/craft-instruct/craft_accept_v6.py [--model dreamcraft-1.5b:v6] [--base http://127.0.0.1:11434]
# ============================================================
import json
import re
import sys
import time
import urllib.request
from pathlib import Path

HERE = Path(__file__).parent
ASSETS = json.loads((HERE / 'accept-assets-v6.json').read_text(encoding='utf-8'))
PRODUCT_NAMES = set(ASSETS['productNames'])
HOT_NAMES = ASSETS['hotNames']
LAYOUT_TYPE_MAP = ASSETS['layoutTypeMap']
TYPE_KEYS = ['wallpaper', 'poster', 'card', 'postcard', 'template']
STYLE_KEYS = ['guofeng', 'feiyi', 'minimal', 'qinghua', 'dunhuang', 'ink', 'neon', 'festive']
PALETTE_KEYS = ['靛蓝', '米白', '赭石', '朱砂', '黛青', '绛红', '竹青', '月白', '赭黄', '石绿', '藤黄', '水墨']
HAN_RE = re.compile(r'[\u4e00-\u9fa5]')

# —— 20 条 OOD 验收用例（黑名单主题，严禁出现在训练集；synth 种子已过滤）——
# (作品标题, 主题词根用于贴题判定, 想法)
CASES = [
    ('秦淮河夜泊', '秦淮', '做一个冰箱贴，把秦淮河灯影融进去'),
    ('夫子庙灯市', '夫子庙', '想要夫子庙主题的明信片，送朋友'),
    ('大足石刻千手观音', '大足', '把这幅画做成徽章'),
    ('福建土楼群', '土楼', '土楼主题的伴手礼'),
    ('京杭大运河漕运图', '运河', '设计一款运河主题衍生品'),
    ('都江堰水则', '都江堰', '做个书签，突出治水智慧'),
    ('乐山大佛全景', '乐山', '乐山大佛的冰箱贴'),
    ('布达拉宫晨光', '布达拉宫', '国风一点，重点画布达拉宫'),
    ('避暑山庄烟雨楼', '避暑山庄', '做个挂件，要有皇家园林味'),
    ('曲阜孔庙柏树', '曲阜', '儒家文化相关的周边'),
    ('殷墟甲骨文', '殷墟', '甲骨文主题的文创产品'),
    ('良渚玉琮', '良渚', '玉琮纹样的丝巾'),
    ('开平碉楼群', '开平', '想做碉楼主题的纪念品'),
    ('庐山云雾', '庐山', '水墨留白感觉，主题是庐山云雾'),
    ('武夷山九曲溪', '武夷', '茶文化相关的伴手礼'),
    ('三清山栈道云海', '三清山', '云海主题的手机壳'),
    ('青城山幽径', '青城山', '道教文化周边，要雅致'),
    ('峨眉山金顶', '峨眉', '金顶日出的明信片'),
    ('龙门石窟卢舍那大佛', '龙门', '把卢舍那大佛做成徽章'),
    ('云台山红石峡', '云台山', '红石峡风景的冰箱贴'),
]


def build_prompt(artwork_title, idea):
    """与 js/ai-craft.js generateIdeaCraft 逐字一致（无主题匹配行——验收用例标题不在 12 主题内）"""
    lines = [
        '你是"AI+文旅文创"平台的文创设计顾问，为用户想法定制文创衍生品方案。',
        '用户正在为作品《' + artwork_title + '》设计文创衍生品。',
        '用户想法：「' + idea + '」。',
        '硬性要求：title 与 subtitle 必须紧扣作品主题与用户想法进行融合创作，禁止脱离作品主题凭空发挥。',
        '请严格输出一个 JSON 对象（禁止 markdown 代码块、禁止任何多余文字），字段如下：',
        'title：文创标题，6-16 个汉字，必须体现作品主题元素；',
        'subtitle：副标题文案，8-20 个汉字，呼应主题意境；',
        'productName：从 [' + '/'.join(HOT_NAMES) + '] 等文创产品中推荐最匹配的一项具体产品名，直接输出产品名；',
        'craftType：从 [' + '/'.join(TYPE_KEYS) + '] 中选与 productName 形态最匹配的一项；',
        'style：从 [' + '/'.join(STYLE_KEYS) + '] 中选最匹配的一项；',
        'layout：从 [' + '/'.join(LAYOUT_TYPE_MAP.keys()) + '] 中选与 craftType 匹配的一项，craftType 为 template 时输出空字符串；',
        'palette：2-3 个传统色名，从 [' + '/'.join(PALETTE_KEYS) + '] 中选，JSON 字符串数组；',
        'scenes：0-2 个分镜对象数组，每项为 {"desc":"10-24 字分镜画面描述","slot":"main 或 scene"}；',
        'stickers：0-3 个契合主题的 emoji 装饰，JSON 字符串数组。'
    ]
    return '\n'.join(lines)


def ollama_generate(base, model, prompt, temperature):
    body = json.dumps({
        'model': model,
        'prompt': prompt,
        'stream': False,
        'options': {'temperature': temperature, 'num_predict': 500}
    }).encode('utf-8')
    req = urllib.request.Request(base + '/api/generate', data=body,
                                 headers={'Content-Type': 'application/json'})
    with urllib.request.urlopen(req, timeout=120) as r:
        return json.loads(r.read().decode('utf-8')).get('response', '')


def han_count(s):
    return len(HAN_RE.findall(s or ''))


def check_plan(plan, artwork_title, topic_root):
    """返回 (明细 dict, 是否全合规)"""
    d = {'title': plan.get('title', ''), 'productName': plan.get('productName', '')}
    ok_json = isinstance(plan, dict)
    ok_type = ok_json and plan.get('craftType') in TYPE_KEYS
    ok_style = ok_json and plan.get('style') in STYLE_KEYS
    ok_product = ok_json and plan.get('productName') in PRODUCT_NAMES
    layout = plan.get('layout', '')
    ok_layout = ok_json and (
        (plan.get('craftType') == 'template' and not layout) or
        (layout in LAYOUT_TYPE_MAP and plan.get('craftType') in LAYOUT_TYPE_MAP.get(layout, []))
    )
    palette = plan.get('palette', [])
    ok_palette = ok_json and isinstance(palette, list) and 2 <= len(palette) <= 3 \
        and all(c in PALETTE_KEYS for c in palette)
    # 贴题（与蒸馏校验同口径 2-gram 重叠）：title 含主题词根，或与作品标题存在连续 2 字重叠
    def gram_hit(t, ref):
        return any(ref[i:i+2] in t for i in range(len(ref) - 1))
    ok_topic = ok_json and isinstance(plan.get('title'), str) and \
        (topic_root in plan['title'] or gram_hit(plan['title'], artwork_title))
    # title/subtitle 字数
    ok_len = ok_json and 6 <= han_count(plan.get('title', '')) <= 16 \
        and 8 <= han_count(plan.get('subtitle', '')) <= 20
    d.update({
        'craftType': plan.get('craftType', ''), 'style': plan.get('style', ''),
        'layout': layout, 'palette': palette,
        'json_ok': ok_json, 'type_ok': ok_type, 'style_ok': ok_style,
        'product_ok': ok_product, 'layout_ok': ok_layout, 'palette_ok': ok_palette,
        'topic_ok': ok_topic, 'len_ok': ok_len,
        'pass': all([ok_json, ok_type, ok_style, ok_product, ok_layout, ok_palette, ok_topic, ok_len])
    })
    return d


def main():
    args = sys.argv[1:]
    model = 'dreamcraft-1.5b:v6'
    base = 'http://127.0.0.1:11434'
    if '--model' in args:
        model = args[args.index('--model') + 1]
    if '--base' in args:
        base = args[args.index('--base') + 1]

    results = []
    n_pass = 0
    t0 = time.time()
    for i, (title, root, idea) in enumerate(CASES):
        prompt = build_prompt(title, idea)
        plan, raw = None, ''
        for attempt in range(2):  # 自愈重试护栏（v5 经验：首采样偶发格式抖动）
            try:
                raw = ollama_generate(base, model, prompt, 0.2 if attempt == 0 else 0.1)
                m = re.search(r'\{[\s\S]*\}', raw)
                if m:
                    plan = json.loads(m.group(0))
                    break
            except Exception as e:
                raw = f'ERROR: {e}'
                time.sleep(2)
        if plan is None:
            d = {'title': '', 'error': raw[:120], 'pass': False, 'json_ok': False,
                 'topic_ok': False, 'type_ok': False, 'style_ok': False,
                 'product_ok': False, 'layout_ok': False, 'palette_ok': False, 'len_ok': False}
        else:
            d = check_plan(plan, title, root)
        d['case'] = f'{title} / {idea[:12]}'
        d['attempt_retried'] = plan is not None
        results.append(d)
        n_pass += 1 if d['pass'] else 0
        mark = 'PASS' if d['pass'] else 'FAIL'
        print(f'[{i+1:02d}/{len(CASES)}] {mark} {d["case"]} → title=「{d.get("title","")}」 product={d.get("productName","")}')
        sys.stdout.flush()

    total = len(CASES)
    def rate(key):
        return round(sum(1 for r in results if r.get(key)) / total, 4)
    summary = {
        'model': model,
        'time': time.strftime('%Y-%m-%d %H:%M:%S'),
        'duration_sec': round(time.time() - t0, 1),
        'cases': total,
        'pass_all': n_pass,
        'pass_rate': round(n_pass / total, 4),
        'json_parse_rate': rate('json_ok'),
        'crafttype_enum_rate': rate('type_ok'),
        'style_enum_rate': rate('style_ok'),
        'product_hit_rate': rate('product_ok'),
        'layout_match_rate': rate('layout_ok'),
        'palette_valid_rate': rate('palette_ok'),
        'topic_adherence_rate': rate('topic_ok'),
        'title_subtitle_len_rate': rate('len_ok'),
        'targets': {'crafttype_enum': 1.0, 'style_enum': 1.0, 'product_hit': 0.9,
                    'layout_match': 0.9, 'palette_valid': 0.95, 'topic_adherence': 0.9},
        'details': results
    }
    out = HERE / 'accept-result-v6.json'
    out.write_text(json.dumps(summary, ensure_ascii=False, indent=2), encoding='utf-8')
    print('\n========== v6 验收汇总 ==========')
    print(f"全合规通过率      {n_pass}/{total} = {summary['pass_rate']:.0%}  (目标 ≥90%)")
    print(f"JSON 可解析率     {summary['json_parse_rate']:.0%}")
    print(f"craftType 枚举    {summary['crafttype_enum_rate']:.0%}  (目标 100%)")
    print(f"style 枚举        {summary['style_enum_rate']:.0%}  (目标 100%)")
    print(f"productName 命中  {summary['product_hit_rate']:.0%}  (目标 ≥90%)")
    print(f"layout 匹配       {summary['layout_match_rate']:.0%}  (目标 ≥90%)")
    print(f"palette 合法      {summary['palette_valid_rate']:.0%}  (目标 ≥95%)")
    print(f"贴题率            {summary['topic_adherence_rate']:.0%}  (目标 ≥90%)")
    print(f'→ {out}')
    # 全 OOD 贴题率与枚举是切链门槛
    sys.exit(0 if summary['pass_rate'] >= 0.9 and summary['crafttype_enum_rate'] == 1.0
             and summary['style_enum_rate'] == 1.0 else 1)


if __name__ == '__main__':
    main()
