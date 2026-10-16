import json
ok=0
with open("seed-samples.jsonl","r",encoding="utf-8",errors="replace") as f:
    for i,line in enumerate(f,1):
        l=line.strip()
        if not l:continue
        json.loads(l)
        ok+=1
print(f"有效seed样本 {ok}")
