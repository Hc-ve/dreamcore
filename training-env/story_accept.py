# -*- coding: utf-8 -*-
"""v4 讲解任务部署验收：走生产同款 OpenAI 兼容端点（/v1/chat/completions）
两类任务与 netlify/functions/ai-proxy.mjs / synthesize-story.mjs 逐字对齐：
  - open  → buildStoryPromptOpen（验收保留主题：黄山/泰山/武当山/龙门石窟，OOD 泛化）
  - facts → buildStoryPromptWithFacts（核心主题事实卡注入，忠实转述）
验收线：5 字段 JSON 结构 + 字数合规率 ≥ 80%（10 条中 ≥ 8 条）
facts 任务额外做数字忠实度检查：输出中的阿拉伯数字串须来自事实卡（仅告警不判死）
"""
import json, re, sys, time, urllib.request

ENDPOINT = 'http://127.0.0.1:11434/v1/chat/completions'
MODEL = 'dreamcraft-1.5b'

# 与 ai-proxy.mjs STORY_SYSTEM 逐字一致
STORY_SYSTEM = ('你是一位严谨的博物馆金牌讲解员。你的讲解必须完全基于给定材料忠实转述，'
                '严禁编造史实、年代、数字与人名；材料中没有的信息用概括性语言带过，不许杜撰。'
                '输出必须是严格的 JSON，不要 markdown 代码块。')

def build_prompt_open(subject, description=''):
    # 与 ai-proxy.mjs buildStoryPromptOpen 逐字一致
    return '\n'.join([
        f'请介绍文化主体「{subject}」' + (f'（图片描述：{description}）' if description else '') + '的历史与文化内涵。',
        '',
        '严格只返回如下 JSON：',
        '{"name":"主体名","era":"一句话年代（不确定写 年代不详）","connotation":"文化内涵讲解，180-280字，2-3个自然段（用\\n分段）","legend":"相关的经典典故或背景故事，100-160字，没有可靠典故则概括其文化意义","creationTip":"文创创作建议，50字以内"}',
        '要求：内容需准确可靠，不确定的信息不要编造，年代与数字仅在确有把握时给出。'
    ])

def build_prompt_facts(theme):
    # 与 ai-proxy.mjs buildStoryPromptWithFacts 逐字一致
    facts = '\n'.join(f'- {f}' for f in theme['facts'])
    legends = '\n'.join(f'- {l}' for l in theme['legends'])
    return '\n'.join([
        f"【文化主题】{theme['name']}（{theme['era']}，{theme['region']}）",
        '',
        '【已核实的事实卡（讲解的唯一事实来源）】',
        facts,
        '',
        '【经典典故（legend 字段从中选取一条转述）】',
        legends,
        '',
        f"请基于以上事实卡，为文化主题《{theme['name']}》撰写讲解词，严格只返回如下 JSON：",
        '{"name":"主题名","era":"一句话年代","connotation":"文化内涵讲解，180-280字，2-3个自然段（用\\n分段）","legend":"最经典的一个典故，100-160字","creationTip":"文创创作建议，50字以内"}',
        '硬性要求：connotation 与 legend 中出现的所有年代、数字、人名、地名必须来自事实卡；不得新增任何史实细节。'
    ])

# —— 验收集：4 条 OOD open（保留主题，未入训练）+ 2 条核心 facts + 4 条泛化 open ——
DUNHUANG = {
    'name': '敦煌壁画', 'era': '前秦建元二年（366年）始凿，历经十六国至元代千年营建', 'region': '甘肃敦煌',
    'facts': [
        '莫高窟现存洞窟735个、壁画4.5万平方米、彩塑2400余尊，是世界上现存规模最大的佛教艺术地。',
        '敦煌壁画代表作包括飞天、九色鹿本生、反弹琵琶乐舞等形象，飞天是不长翅膀、凭借飘带凌空飞舞的东方艺术形象。',
        '1900年道士王圆箓在莫高窟第17窟发现"藏经洞"，出土文书约6万件，催生了国际显学"敦煌学"。',
        '1944年国立敦煌艺术研究所成立，常书鸿、樊锦诗等几代守护者接力保护，"数字敦煌"工程已实现洞窟高清数字化。'
    ],
    'legends': [
        '乐尊和尚云游至鸣沙山东麓，见对面三危山金光万道状若千佛，遂在崖壁凿下第一个洞窟，莫高窟由此发端。',
        '藏经洞文书封存近九百年后重见天日，却逢晚清乱世，大量经卷流失海外，陈寅恪痛言"敦煌者，吾国学术之伤心史也"。'
    ]
}
SANXINGDUI = {
    'name': '三星堆青铜', 'era': '距今约4500-2900年（新石器时代晚期至商周）', 'region': '四川广汉',
    'facts': [
        '三星堆遗址是古蜀国都城遗址，1986年两个"祭祀坑"出土青铜大立人、青铜神树、纵目面具等上千件文物，2021年起再获黄金面具等重要发现。',
        '青铜纵目面具眼球外凸达16厘米，被学者认为与古蜀先王"蚕丛纵目"的传说相关；青铜神树高3.96米，是我国现存最大的单件青铜文物。',
        '三星堆青铜器采用分铸法与铆接工艺，尊、罍等容器形制受中原商文化影响，神像面具系统则独具古蜀特色，印证中华文明多元一体格局。',
        '三星堆博物馆新馆2023年开放，"青铜啾"等文创产品全网累计销售超30万件，成为文物活化的标杆案例。'
    ],
    'legends': [
        '《华阳国志》记载古蜀先王蚕丛"其目纵"，青铜纵目面具的造型恰与这一传说呼应，被视作先王神化的化身。',
        '青铜神树九枝栖九鸟，与《山海经》中"扶桑树，十日所浴，九日居下枝"的记载高度契合，可能是古蜀人太阳崇拜的具象。'
    ]
}

CASES = [
    # (task, 标签, prompt, 事实卡全文或 None)
    ('open', '黄山(保留)', build_prompt_open('黄山', '奇松怪石云海温泉'), None),
    ('open', '泰山(保留)', build_prompt_open('泰山', '五岳独尊日出石刻'), None),
    ('open', '武当山(保留)', build_prompt_open('武当山', '道教宫观金顶武术'), None),
    ('open', '龙门石窟(保留)', build_prompt_open('龙门石窟', '卢舍那大佛伊水石窟'), None),
    ('open', '大足石刻', build_prompt_open('大足石刻', ''), None),
    ('open', '福建土楼', build_prompt_open('福建土楼', ''), None),
    ('open', '大运河', build_prompt_open('京杭大运河', ''), None),
    ('open', '泉州古城', build_prompt_open('泉州', '世遗海丝古城'), None),
    ('facts', '敦煌(事实卡)', build_prompt_facts(DUNHUANG), DUNHUANG),
    ('facts', '三星堆(事实卡)', build_prompt_facts(SANXINGDUI), SANXINGDUI),
]

HAN = re.compile(r'[\u4e00-\u9fa5]')
NUM = re.compile(r'\d+(?:\.\d+)?')

def han_len(s):
    return len(HAN.findall(str(s or '')))

def validate_story(story):
    """与 synthesize-story.mjs validateStory 逐字对齐"""
    if not isinstance(story, dict): return '非对象'
    for k in ['name', 'era', 'connotation', 'legend', 'creationTip']:
        v = story.get(k)
        if not isinstance(v, str) or not v.strip(): return f'{k}缺失'
    if han_len(story['name']) < 2: return 'name过短'
    if not (120 <= han_len(story['connotation']) <= 300): return f"connotation字数{han_len(story['connotation'])}"
    if not (60 <= han_len(story['legend']) <= 190): return f"legend字数{han_len(story['legend'])}"
    if han_len(story['creationTip']) > 60: return 'creationTip超限'
    if '\n' not in story['connotation']: return 'connotation未分段'
    return None

def check_fidelity(story, theme):
    """facts 任务数字忠实度：输出中阿拉伯数字串须出现在事实卡/典故文本中（告警）"""
    src = ''.join(theme['facts'] + theme['legends'])
    text = story.get('connotation', '') + story.get('legend', '') + story.get('era', '')
    unknown = [n for n in NUM.findall(text) if n not in src]
    return unknown

def main():
    ok, t0 = 0, time.time()
    fails, warns = [], []
    for i, (task, label, prompt, theme) in enumerate(CASES, 1):
        payload = json.dumps({'model': MODEL,
                              'messages': [{'role': 'system', 'content': STORY_SYSTEM},
                                           {'role': 'user', 'content': prompt}]},
                             ensure_ascii=False).encode('utf-8')
        req = urllib.request.Request(ENDPOINT, data=payload, headers={'Content-Type': 'application/json'})
        try:
            d = json.loads(urllib.request.urlopen(req, timeout=120).read().decode('utf-8'))
            gen = d['choices'][0]['message']['content'].strip()
        except Exception as e:
            fails.append(f'[{i}]{label}: 请求失败 {e}')
            print(f'  [{i}] x {label}: 请求失败 {e}')
            continue
        m = re.search(r'\{[\s\S]*\}', gen)
        if not m:
            fails.append(f'[{i}]{label}: 无JSON')
            print(f'  [{i}] x {label}: 无JSON: {gen[:60]}')
            continue
        try:
            story = json.loads(m.group(0))
        except json.JSONDecodeError:
            fails.append(f'[{i}]{label}: 解析失败')
            print(f'  [{i}] x {label}: 解析失败')
            continue
        err = validate_story(story)
        if err:
            fails.append(f'[{i}]{label}: {err}')
            print(f'  [{i}] △ {label}: 不合规({err})')
            continue
        ok += 1
        extra = ''
        if theme:
            unknown = check_fidelity(story, theme)
            if unknown:
                warns.append(f'[{i}]{label}: 疑似编造数字 {unknown}')
                extra = f' ⚠数字存疑{unknown}'
        print(f'  [{i}] OK {label}: {story["name"]} | {story["era"][:20]}{extra}')
    total = len(CASES)
    rate = ok / total
    print(f'\n===== v4 讲解任务验收（open OOD + facts 忠实）=====')
    print(f'结构合规率: {ok}/{total} = {rate*100:.0f}%  [验收线 ≥80%]')
    print(f'平均耗时: {(time.time()-t0)/total:.1f}s/条')
    if fails: print(f'不合规明细: {fails}')
    if warns: print(f'忠实度告警: {warns}')
    sys.exit(0 if rate >= 0.8 else 1)

if __name__ == '__main__':
    main()
