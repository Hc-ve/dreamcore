import json
cnt=0
with open("train_final.jsonl","r",encoding="utf-8") as f:
    for i,l in enumerate(f,1):
        ll=l.strip()
        if not ll:continue
        json.loads(ll)
        cnt+=1
print(f"校验通过，总行数 {cnt}")
