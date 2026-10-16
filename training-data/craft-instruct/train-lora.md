# DreamCraft-1.5B LoRA 微调操作手册

> 目标：微调 Qwen2.5-1.5B-Instruct，使「AI文创灵感生成」从外部 qwen-plus API
> 迁移到自主训练的领域小模型。训练数据由本项目自建（见 ../README.md）。

## 0. 前置条件

| 项 | 最低要求 | 推荐 |
|---|---|---|
| GPU 显存 | 8GB（batch 4 + fp16） | 16GB+（RTX 4090，batch 8 + bf16） |
| 无本地 GPU | — | AutoDL 租 4090（约 2 元/h，全程 < 50 元） |
| 磁盘 | 10GB | — |
| 训练时长 | — | 1k 样本 × 3 epoch 约 1-2 小时（4090） |

## 1. 数据准备

1. 按 ../README.md 完成 `candidates.jsonl` → 人工筛选 → `train.jsonl`
2. 将 `train.jsonl` 与 `seed-samples.jsonl` 合并（人工样本直接并入，扩充风格覆盖）：
   ```bash
   cat seed-samples.jsonl >> train.jsonl
   ```
3. 校验每行可被 JSON.parse，且含 instruction/output 两个字段

## 2. 环境搭建（LLaMA-Factory）

```bash
git clone --depth 1 https://github.com/hiyouga/LLaMA-Factory.git
cd LLaMA-Factory
pip install -e ".[torch,metrics]"
```

注册数据集：把 `train.jsonl` 拷到 `data/` 目录，在 `data/dataset_info.json` 增加：
```json
{
  "dreamcraft_instruct": {
    "file_name": "train.jsonl",
    "formatting": "alpaca",
    "columns": { "prompt": "instruction", "response": "output" }
  }
}
```

## 3. 启动训练

```bash
llamafactory-cli train examples/train_lora/dreamcraft_lora.yaml
```
其中 `dreamcraft_lora.yaml` 按 ../lora-config.json 撰写（关键字段已给定：
base Qwen2.5-1.5B-Instruct / LoRA rank 16 alpha 32 / 3 epoch / lr 1e-4 / cutoff 1024）。

或直接用 WebUI：`llamafactory-cli webui` → 数据集选 dreamcraft_instruct → 参数照抄 lora-config.json。

产出：`dreamcraft-1.5b-lora/`（adapter，约 20MB，可入 git 展示成果）

## 4. 效果验收（训练后必做）

用生产同款 prompt 抽测 30 条（取自 seeds.jsonl 未入训练集的想法）：

```bash
llamafactory-cli chat --model_name_or_path Qwen/Qwen2.5-1.5B-Instruct \
  --adapter_name_or_path dreamcraft-1.5b-lora --template qwen
```

| 指标 | 基座（未微调） | 验收线 |
|---|---|---|
| JSON 可解析率 | < 40% | ≥ 90% |
| 5 字段全合规率 | < 20% | ≥ 85% |
| 标题 8-16 汉字率 | 不稳定 | ≥ 95% |
| style/craftType 合法率 | < 50% | = 100% |

未达标处理：数据翻倍（--rounds 3 重新蒸馏）→ epoch 4-5 → rank 32，逐项重试。

## 5. 合并导出（部署需要）

```bash
llamafactory-cli export --model_name_or_path Qwen/Qwen2.5-1.5B-Instruct \
  --adapter_name_or_path dreamcraft-1.5b-lora \
  --export_dir dreamcraft-1.5b-merged --template qwen
```

## 6. 竞赛材料留存

- `training_loss.png`（plot_loss: true 自动生成）
- 基座 vs 微调输出对比样例（同一想法各生成 3 次）
- 数据集卡片：来源（自建种子 × qwen-plus 蒸馏 × 人工润色）、规模、字段说明
