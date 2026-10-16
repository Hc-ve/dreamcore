# ADR: M10 将 AI文创灵感生成从外部大模型 API 迁移至自主训练微调模型（DreamCraft-1.5B）

- Status: accepted
- Date: 2026-09-23
- Deciders: 项目负责人（用户）、AI 工程协作（Trae）

## Context

项目现有 AI 能力全部经统一调用层（@js/ai-inference.js）走 /api/ai/* 云函数代理（@netlify/functions/ai-proxy.mjs）调用外部大模型 API：AI评分用 DashScope qwen-vl-plus（唯一多模态消费方）、AI文创/AI陪练用 qwen-plus（三级降级 DeepSeek/MIMO）、AI陪练另有通义万相文生图；AI策展与 AI修图为纯本地算法，无 API 可替换。为提升竞赛技术含金量，需将其中一项功能的 API 替换为自主训练的微调模型，要求训练成本最低、开发时间最短、效果提升显著可演示。

## Decision

1. **选型：替换 AI文创灵感生成**。对比三个真实调用外部 API 的模块——
   - AI评分：需"图片×五维美学评分"人工标注集 + 微调 VL 模型（3B+，24GB 显存），数据与算力成本高，1-2 周；
   - AI文创：输出为固定 schema JSON（title/subtitle/craftType/style/stickers），训练数据可程序化合成 + 蒸馏 + 人工润色（1-2 天），基座仅需 Qwen2.5-1.5B-Instruct LoRA（8-16GB 显存 2-4 小时，云 GPU 预算 < 50 元），集成仅需 ai-proxy 新增 ~30 行 provider 路由，3-5 天全交付；
   - AI陪练文生图：DreamBooth/LoRA 生图模型算力大、数据版权门槛高。
   文创全维度最优，且"通用 API → 自研领域小模型"的 A/B 对比在竞赛中叙事最强（低成本、自主可控、数据资产自有）。
2. **数据集管线**（training-data/craft-instruct/）：seeds.mjs 生成 240 条种子想法（8 风格 × 5 品类 × 6 句式）；synthesize.mjs 以生产同款 prompt 调 qwen-plus 蒸馏候选并做结构校验（标题 8-16 汉字/副标题 10-20/craftType、style 合法/stickers 0-3，支持 --rounds 扩充与 --resume 断点续跑）；seed-samples.mjs 内置 16 条人工高质量样本（覆盖全部 8 风格）。instruction 与生产 prompt 完全一致，保证训练/推理分布对齐。
3. **按调用路由而非全局切换**（对计划的细化）：textGeneration() 仅在显式传入 `provider: 'self-trained'` 时走"自研 → DashScope → DeepSeek → MIMO"链；未传时保持原"DashScope → DeepSeek → MIMO"。理由：1.5B 领域模型只擅长文创 JSON 方案生成，若全局优先会拖累 AI陪练的通用摄影指导文本质量。
4. **ai-proxy 新增 self-trained provider**：OpenAI 兼容格式转发至 `SELF_TRAINED_API_BASE`（默认 http://127.0.0.1:11434/v1，即演示机 ollama），无密钥需求；health 端点新增自研模型探测。Netlify 生产环境不可达本地端口时抛错 → 前端自动降级云端（设计如此，演示安全网）。
5. **徽标可视化**：ai-craft 生成成功后在灵感面板显示来源徽标——"⚡ 自研微调模型 DreamCraft-1.5B"（青色渐变高亮）/"☁ 云端大模型 xxx"，本地兜底方案隐藏徽标，作为竞赛演示的可视化证据。

## Alternatives Considered

1. 全局把 self-trained 设为所有 textGeneration 的主方案——被否决，领域小模型会劣化陪练等通用文本场景，改为按调用显式路由（见 Decision 3）。
2. 微调后直接替换 dashscope 分支、不保留云端降级——被否决，演示现场 ollama 可能未启动/崩溃，双保险保证按钮永远可用。
3. 用 TF.js 在浏览器内跑 1.5B 模型（零部署）——被否决，WebGPU 兼容性差且 1.5B 浏览器推理内存占用大，ollama 本地服务更稳。
4. 微调 3B/7B 追求更高生成质量——被否决，与"最低训练成本、最短时间"目标冲突，1.5B 固定 schema 输出任务已够用。

## Consequences

- AI文创生成默认优先消耗自研算力（本地零成本），云端 API 从主路径变为降级兜底——竞赛可现场演示"拔掉网络/停掉 ollama，功能不断"。
- 训练/部署全链路文档化：train-lora.md（LLaMA-Factory 参数 + 验收指标线：JSON 合规率 ≥ 90% vs 基座 < 40%）、deploy-ollama.md（Modelfile 导入 + OpenAI 兼容端点验收命令）、lora-config.json。
- 新增 tests/ai-craft.spec.js 三用例（mock /api/ai/text-generation）：自研主路径断言请求 provider 顺序与徽标文案；自研 502 → 降级 dashscope 徽标切换；全链失败本地兜底徽标隐藏。
- ai-craft.js 生成逻辑仅新增 provider 参数与徽标展示，方案校验/应用逻辑零改动；ai-tutor.js 完全不受影响。
- 遗留依赖用户侧执行：数据蒸馏（跑 synthesize.mjs 消耗 DASHSCOPE 额度）→ LoRA 训练（AutoDL/本地 GPU）→ ollama 导入（deploy-ollama.md）；在此之前自研分支自动降级，线上行为与改动前一致。

## Superseded when

- 需要更高质量的文创方案（如支持长描述/多轮交互式设计）时，升级基座至 Qwen2.5-3B/7B 并扩大数据集。
- 需要跨设备演示（演示机无法运行 ollama）时，将合并模型部署到云 GPU 并配置 SELF_TRAINED_API_BASE 环境变量。
