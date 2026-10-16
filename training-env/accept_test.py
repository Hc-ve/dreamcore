# -*- coding: utf-8 -*-
"""训练验收脚本：加载基座+LoRA，用 10 条生产同款 prompt 抽测 JSON 合规率"""
import json, re, sys, time
import torch
from transformers import AutoModelForCausalLM, AutoTokenizer
from peft import PeftModel

BASE = r"E:\a\6a578b50553ee2fa56364236\training-env\models\Qwen2.5-1.5B-Instruct"
ADAPTER = r"E:\a\6a578b50553ee2fa56364236\training-env\LlamaFactory-main\saves\dreamcraft-1.5b-lora"

CRAFT_TYPES = ['wallpaper', 'poster', 'card', 'postcard', 'template']
STYLES = ['guofeng', 'feiyi', 'minimal', 'qinghua', 'dunhuang', 'ink', 'neon', 'festive']

# 生产同款 prompt 模板（与 js/ai-craft.js buildIdeaPrompt 逻辑一致）
def build_prompt(idea):
    return (
        '你是"AI+文旅文创"平台的文创设计顾问，为用户想法定制文创衍生品方案。\n'
        f'用户想法：「{idea}」。\n'
        '请严格输出一个 JSON 对象（禁止 markdown 代码块、禁止任何多余文字），字段如下：\n'
        'title：文创标题，8-16 个汉字，有文旅美感；\n'
        'subtitle：副标题文案，10-20 个汉字；\n'
        'craftType：从 [wallpaper/poster/card/postcard/template] 中选最匹配的一项；\n'
        'style：从 [guofeng/feiyi/minimal/qinghua/dunhuang/ink/neon/festive] 中选最匹配的一项；\n'
        'stickers：0-3 个契合主题的 emoji 装饰，JSON 字符串数组。'
    )

TEST_IDEAS = [
    '敦煌飞天主题的明信片',
    '青花瓷纹样的手机壁纸',
    '赛博朋克风格的文旅海报',
    '苗族银饰灵感的藏品卡',
    '江南水乡水墨画模板',
    '春节庙会主题的文创设计',
    '三星堆青铜面具周边',
    '故宫红墙雪景壁纸',
    '皮影戏主题的文创衍生品',
    '茶马古道纪念明信片',
]

def validate(plan):
    """与 training-data/craft-instruct/synthesize.mjs validate 同规则"""
    try:
        title = str(plan.get('title', ''))
        han_t = len(re.findall(r'[\u4e00-\u9fa5]', title))
        if not (1 <= han_t <= 16): return 'title汉字数'
        subtitle = str(plan.get('subtitle', ''))
        han_s = len(re.findall(r'[\u4e00-\u9fa5]', subtitle))
        if not (1 <= han_s <= 30): return 'subtitle汉字数'
        if plan.get('craftType') not in CRAFT_TYPES: return 'craftType'
        if plan.get('style') not in STYLES: return 'style'
        st = plan.get('stickers')
        if not isinstance(st, list) or len(st) > 3 or not all(isinstance(x, str) for x in st): return 'stickers'
        return None
    except Exception:
        return '字段缺失'

def main():
    print('加载基座模型...')
    tok = AutoTokenizer.from_pretrained(BASE, trust_remote_code=True)
    model = AutoModelForCausalLM.from_pretrained(
        BASE, torch_dtype=torch.bfloat16, device_map='cuda', trust_remote_code=True
    )
    print('加载 LoRA adapter...')
    model = PeftModel.from_pretrained(model, ADAPTER)
    model.eval()

    ok, bad_json, bad_valid = 0, 0, []
    t0 = time.time()
    for i, idea in enumerate(TEST_IDEAS, 1):
        msgs = [{'role': 'user', 'content': build_prompt(idea)}]
        text = tok.apply_chat_template(msgs, tokenize=False, add_generation_prompt=True)
        inputs = tok(text, return_tensors='pt').to('cuda')
        with torch.no_grad():
            out = model.generate(**inputs, max_new_tokens=180, temperature=0.8,
                                  top_p=0.9, do_sample=True)
        gen = tok.decode(out[0][inputs.input_ids.shape[1]:], skip_special_tokens=True).strip()
        m = re.search(r'\{[\s\S]*\}', gen)
        if not m:
            bad_json += 1
            print(f'  [{i}] ✗ 无JSON: {gen[:60]}')
            continue
        try:
            plan = json.loads(m.group(0))
        except json.JSONDecodeError:
            bad_json += 1
            print(f'  [{i}] ✗ JSON解析失败: {m.group(0)[:60]}')
            continue
        err = validate(plan)
        if err:
            bad_valid.append(f'[{i}]{err}')
            print(f'  [{i}] △ 字段不合规({err}): {m.group(0)[:80]}')
        else:
            ok += 1
            print(f'  [{i}] ✓ {plan["title"]} | {plan["craftType"]} | {plan["style"]}')

    total = len(TEST_IDEAS)
    rate = ok / total * 100
    print(f'\n===== 验收结果 =====')
    print(f'JSON 可解析: {total - bad_json}/{total}（≥90% 达标线）')
    print(f'字段全合规: {ok}/{total} = {rate:.0f}%（≥85% 达标线）')
    print(f'耗时: {time.time() - t0:.0f}s')
    sys.exit(0 if rate >= 80 else 1)

if __name__ == '__main__':
    main()
