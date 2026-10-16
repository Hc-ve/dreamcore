import json

error_count = 0
ok_count = 0
out_file = open("train_final.jsonl", "w", encoding="utf-8")

with open("train.jsonl","r",encoding="utf-8",errors="replace") as f:
    for line_no, raw_line in enumerate(f, start=1):
        line = raw_line.strip()
        if not line:
            continue
        try:
            obj = json.loads(line)
            out_file.write(json.dumps(obj, ensure_ascii=False) + "\n")
            ok_count +=1
        except Exception as e:
            print(f"第{line_no}行丢弃，错误：{e}")
            error_count +=1
out_file.close()
print(f"\n清洗完成！有效样本：{ok_count}，丢弃坏样本：{error_count}")
