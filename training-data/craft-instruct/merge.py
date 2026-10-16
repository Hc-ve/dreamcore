# merge.py 安全合并脚本，纯utf8
with open("train_clean.jsonl", "r", encoding="utf-8") as f1, \
     open("seed-samples.jsonl", "r", encoding="utf-8") as f2, \
     open("train.jsonl", "w", encoding="utf-8") as out:
    out.write(f1.read())
    out.write(f2.read())
print("✅ Python合并完成，train.jsonl 已生成")
