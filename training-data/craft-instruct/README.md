# DreamCraft-1.5B 训练数据集构建管线

## 目标
为「AI文创灵感生成」功能构建领域微调数据集（instruction-output 对），
用于 LoRA 微调 Qwen2.5-1.5B-Instruct，替代外部 qwen-plus API。

## 数据流水线

```
seeds.mjs（生成种子想法）
   ↓ seeds.jsonl
synthesize.mjs（调 DashScope qwen-plus 蒸馏候选 + 结构校验）
   ↓ candidates.jsonl
人工筛选/润色（剔除弱样本、润色标题文案）
   ↓ train.jsonl（最终训练集）
```

## 使用步骤

### 1. 生成种子想法（离线，无 API 消耗）
```bash
node seeds.mjs          # 产出 seeds.jsonl（默认 240 条：8 风格 × 5 品类 × 6 想法）
```

### 2. 蒸馏候选样本（消耗 DASHSCOPE 额度）
```bash
# 从项目根目录运行（读取 .env 中 DASHSCOPE_API_KEY）
node synthesize.mjs                # 每条种子生成 1 个候选
node synthesize.mjs --rounds 2     # 每条种子生成 2 个候选（温度 0.9，更多样）
node synthesize.mjs --resume       # 断点续跑（跳过已完成种子）
```
脚本内置结构校验：JSON 可解析、title 8-16 汉字、subtitle 10-20 汉字、
craftType/style 必须在合法 key 内、stickers 0-3 个。不合格候选自动丢弃。

### 3. 人工筛选
- 打开 `candidates.jsonl`，删除标题文案平庸、风格判断错误的样本
- 建议保留率 60-80%，最终规模 1k+ 条（配合 --rounds 2/3 扩充）
- 重命名为 `train.jsonl`

### 4. 训练数据格式
每行一个 JSON 对象：
```json
{"instruction": "<生产环境完全一致的 prompt>", "output": "{\"title\":\"...\",\"subtitle\":\"...\",\"craftType\":\"poster\",\"style\":\"dunhuang\",\"stickers\":[\"🏮\"]}"}
```
注意：`instruction` 由 synthesize.mjs 按生产模板（js/ai-craft.js generateIdeaCraft）
原样生成，保证训练/推理分布对齐；`output` 是模型应输出的合规 JSON 字符串。

## 人工样例（seed-samples.jsonl）
内置 16 条人工撰写的高质量样本（覆盖全部 8 风格），可直接并入 train.jsonl，
也作为筛选质量基准与格式参考。

## 质量红线
- 想法 → craftType/style 的映射必须符合常识（如"桌面壁纸"→wallpaper）
- 标题必须有文旅美感，禁止"XX·AI共创"这类降级套路命名
- 全部使用简体中文；emoji 贴纸须契合主题（敦煌配🕌、春节配🏮）
