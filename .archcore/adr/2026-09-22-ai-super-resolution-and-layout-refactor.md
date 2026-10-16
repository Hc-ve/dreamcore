# ADR: M9 修图工作台——布局重构（画布下方次级按钮行）+ AI超清（Super-Resolution）

- Status: accepted
- Date: 2026-09-22
- Deciders: 项目负责人（用户）、AI 工程协作（Trae）

## Context

用户提出两项需求：

1. **布局重构**：工作台头部堆叠了一排大按钮（重置/AI智能优化/前后对比/保存版本/保存作品），次级功能（版本对比、保存版本、重置）占据主按钮位，视觉噪音大。参照醒图式设计（图2）：顶栏极简只留主操作，画布下方放小按钮区承载次级功能。
2. **AI超清**：调研主流修图软件的 AI 增强/AI 超分辨率技术原理，并实现一个"从模糊输入恢复细节、提升清晰度"的超清功能，交互参照图3（进度百分比 + 取消按钮 + 处理完成前确认禁用）。

**市场调研结论**（Photoshop Super Resolution、Topaz Gigapixel、醒图/美图秀秀 AI超清、Remini、Upscayl/Real-ESRGAN、Swin2SR、浏览器端 Pica+Glfx 方案）：

- 技术三代演进：插值（bicubic/Lanczos，快但糊）→ 深度学习（SRCNN→EDSR→ESRGAN/Real-ESRGAN：RRDB+U-Net 判别器+感知损失）→ Transformer/生成式（SwinIR/Swin2SR、扩散模型、4KAgent 多智能体执行-反思-回滚）。
- 商业产品通用工程范式：**特征分析 → 预降噪 → 细节重建 → 局部对比增强 → 量化验证**；美图 MTIR 管线为"人脸修复与全图修复并行 → 贴回 → 超分网络收尾"。
- 纯浏览器无 GPU/无模型下载场景的业界标准做法（Pica/Glfx 系、TF.js UpscalerJS 之外的经典路线）：**高质量重采样 + 多遍 Unsharp Mask + 边缘门控细节恢复**，比神经网络轻量且零依赖。
- 关键设计张力：fidelity（忠实原图）vs plausibility（生成式补细节）。演示项目选 fidelity 优先，加防幻觉约束。

## Decision

1. **布局重构**：头部 `.edit-header-actions` 仅保留主操作（AI智能优化 / AI超清 / 保存作品主 CTA / 关闭）；重置（#edit-reset）、前后对比（#edit-compare）、保存版本（#edit-save）迁移到画布下方新增的次级按钮行 `#edit-canvas-tools`（.edit-tool-btn 小圆角胶囊按钮，含深色模式样式）。**DOM id 全部保留**，既有测试与事件绑定不受影响。
2. **AI超清管线**（@js/ai-knowledge.js `runSuperResolutionPipeline`，纯前端 Canvas 像素运算，零网络依赖）：
   - Stage 1 特征分析：复用 extractImageFeatures 评估模糊度（blurScore），自适应决定各阶段强度；
   - Stage 2 预降噪：色度向低频靠拢 + 平坦区亮度降噪（|Y-Yblur|<13 才处理，边缘原样保留）；
   - Stage 3 结构感知细节重建：双尺度亮度 USM（r=1 微细节 + r=3 结构），**边缘门控**（梯度差 <1.4 的平坦区跳过，防幻觉纹理）、**振铃限幅**（单像素增量 ±38）、高光/暗部保护（不推过 250/压破 6）；
   - Stage 4 局部微对比：r=8 大半径差值增强中频层次（clarity ≤0.32，限幅 ±18）；
   - Stage 5 量化验证：Laplacian 边缘能量前后对比，输出提升百分比进决策报告。
   - 工作分辨率上限 1200×800（高于智能优化的 900×600）；按行分块 + RAF nextTick，进度实时刷新、随时可取消。
3. **交互（参照图3）**：头部新增「AI超清」按钮（#edit-sr），复用 M7 醒图式等待浮层（进度环百分比 + 阶段文案"正在超清处理…" + 取消按钮）；取消按钮同时取消智能优化与超清；完成前结果不生效（取消即丢弃，等价于"完成前确认禁用"）；完成后 sourceImage 替换为超清结果、hasOptimized 置位 → 前后对比/重置联动可用，展示含清晰度提升百分比的量化报告。
4. **互斥保护**：srRunning/optimizing 双向互斥，closeEdit 时取消进行中的超清。

## Alternatives Considered

1. TF.js + UpscalerJS 跑 ESRGAN（浏览器 WebGL 推理）——被否决：需下载 ~15MB 模型+运行时，演示环境可能离线/弱机；且生成式补细节存在幻觉风险，违背 fidelity 优先原则。
2. pica（Lanczos3 重采样库）——被否决：引入新依赖；本项目为清晰度恢复而非尺寸放大，canvas imageSmoothingQuality='high' 重采样已满足工作画布构建需求。
3. 2×/4× 分辨率放大作为超清主目标——被否决：醒图"AI超清"核心价值是画质清晰度恢复而非像素扩张；且放大后预览画布仍受限，演示效果不直观。分辨率提升已由 M8 高清导出（长边≤1800）承担。
4. 单遍全局 USM——被否决：无边缘门控会在平坦区放大噪点、无多尺度则微细节与结构轮廓无法兼顾（M7 色彩质量修复的同类教训）。

## Consequences

- 头部视觉降噪：次级功能不再以主按钮形态出现，层级清晰（图2 目标达成）。
- AI超清可量化验证：tests/super-resolution.spec.js 用例③断言画布 Laplacian 边缘能量提升 ≥15%。
- 超清结果自动纳入既有体系：前后对比、重置恢复、自动暂存（6s 防抖）、高清导出、发布引导全部无感复用。
- 事件绑定与测试选择器零迁移成本（id 保留），仅新增 #edit-sr / #edit-canvas-tools 两个锚点。
- 模糊输入（blurScore 高）获得更强重建强度，清晰图片自动轻处理（usmMicro 0.55~1.30 自适应），避免过度锐化。

## Superseded when

- 需要真·生成式超分（人脸修复、纹理合成）时，接入 Netlify function 代理 Real-ESRGAN/Swan2SR 服务端推理。
- 需要 2×/4× 像素放大输出时，在导出链路追加 Lanczos 重采样级。
