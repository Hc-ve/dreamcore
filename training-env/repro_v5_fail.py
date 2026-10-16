# 复现第二轮失败用例（武当山保留 legend 短 / 中山陵解析失败），输出原始文本与长度
import json, sys, urllib.request
sys.path.insert(0, r'E:\a\6a578b50553ee2fa56364236\training-env')
from story_accept_v5 import CASES, MODEL  # noqa

def gen(prompt, nump=800):
    payload = json.dumps({'model': MODEL, 'prompt': prompt, 'stream': False,
                          'options': {'temperature': 0.2, 'top_p': 0.9, 'top_k': 50,
                                      'num_ctx': 2048, 'num_predict': nump}}).encode()
    req = urllib.request.Request('http://127.0.0.1:11434/api/generate',
                                 data=payload, headers={'Content-Type': 'application/json'})
    with urllib.request.urlopen(req, timeout=180) as r:
        return json.loads(r.read())['response']

for idx in (2, 12):  # [3]武当山(保留), [13]中山陵
    _, label, prompt, _ = CASES[idx]
    print(f'===== [{idx+1}] {label} =====')
    raw = gen(prompt)
    print('RAW>>>')
    print(raw)
    print('<<<RAW  total_len =', len(raw))
    try:
        d = json.loads(raw[raw.index('{'):raw.rindex('}')+1])
        print('JSON OK; legend_len =', len(d.get('legend','')), 'connotation_len =', len(d.get('connotation','')))
    except Exception as e:
        print('JSON FAIL:', e)
    print()
