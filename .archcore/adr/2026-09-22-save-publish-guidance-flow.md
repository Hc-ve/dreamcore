# ADR: M8 修图工作台——保存与发布引导流程（高清导出 + 自动暂存 + 草稿箱）

- Status: accepted
- Date: 2026-09-22
- Deciders: 项目负责人（用户）、AI 工程协作（Trae）

## Context

AI 修图工作台（M2/M7）此前只有「保存版本」能力（写 IndexedDB edit_versions 表），用户修图完成后没有导出设备的路径，也没有从修图结果直达发布的引导，且修图过程意外关闭（刷新/路由跳转）会丢失全部未保存调参。发布弹窗（@js/publish.js）表单填写中途关闭后同样全量丢失，用户需要重新上传图片、重填标题/描述/分类。用户提出 6 项要求：明显保存按钮（高质量格式）、保存成功确认 + 发布选项、跳转发布页引导、全流程视觉反馈（加载/成功/失败）、修图过程自动暂存防丢失、发布草稿箱。

既成教训：M7 曾出现「写了 class 没写 id」缺陷（#edit-ai-sub），M8 首跑再次出现同模式缺陷（#edit-save-card-title），说明模板字符串生成的 DOM 需要与测试选择器约定做静态核对。

## Decision

1. **双层保存**：保留原「保存版本」按钮（btn-ghost，写 edit_versions），新增主 CTA「保存作品」（#edit-save-hd，btn-primary）——离屏 canvas 2 倍分辨率导出（长边 ≤ 1800px，ctx.filter 应用全部调参/滤镜，JPEG quality 0.95），经 a.click() 触发浏览器下载，文件名 `{作品名}-修图-YYYYMMDD_HHMMSS.jpg`；导出 dataURL 缓存于 lastHdDataUrl 供发布带入。
2. **保存→发布引导**：下载成功后显示成功引导卡片（#edit-save-card：标题 + 副标题 + 「继续编辑」/「发布作品」双按钮）；点「发布作品」→ 关闭工作台 → Publish.showPublishModal({ dataUrl, name, artworkId })，修图结果直接预填预览态（跳过手动上传），toast 提示「已带入修图结果」。
3. **自动暂存**：挂点 schedulePreviewRender()（所有参数变更的统一入口），markAutoSaveDirty() + 6s 防抖触发 runAutoSave()，以 versionType:'auto-save' 写入 edit_versions，每作品仅保留最近 3 条（超出裁剪），头部绿色胶囊指示标签（#edit-autosave-tag + 时间）；未登录跳过，closeEdit 时清理定时器与状态。
4. **发布草稿箱**：IndexedDB 升级 DB_VERSION 5→6 新增 publish_drafts 表（自增 id，索引 userId/updatedAt），@js/publish.js 弹窗底部提供「存入草稿箱」（要求标题/描述/图片至少一项）与「草稿箱 N 篇」列表（缩略图 + 恢复/删除），恢复时回填表单并渲染图片预览。
5. **视觉反馈**：保存按钮 loading 态（spinner + 文案切换）、toast 成功/失败提示、fadeSlideIn/popIn 动画（原 style.css 缺失，补建）。

## Alternatives Considered

1. FileSystem Access API 写本地文件——被否决，仅 Chromium 支持 showSaveFilePicker 且需用户授权句柄，演示场景浏览器 a.download 兼容性与稳定性更好。
2. 自动暂存全量写 localStorage——被否决，dataURL 体积大易超 5MB 配额且阻塞主线程；IndexedDB 与既有 edit_versions 体系天然合一，复用版本列表 UI。
3. 草稿箱存 Supabase 云端表——被否决，草稿是中途态非核心资产，云端写入需网络往返且演示环境可能断网；本地 IndexedDB 零延迟且与自动暂存同构。
4. 无限保留自动暂存版本——被否决，长时间调参会刷爆存储并淹没手动版本，固定保留最近 3 条平衡安全与整洁。

## Consequences

- 修图结果可一键导出设备（验证：playwright waitForEvent('download') + 文件名正则 `-修图-\d{8}_\d{6}\.jpg$`）。
- 保存→发布链路一次点击直达，发布弹窗跳过上传直接预览（验证：#publish-modal.open + #pub-preview img 可见）。
- 参数变更 6s 后出现自动暂存版本与指示标签，意外关闭最多丢失 6s 调参（验证：#edit-autosave-tag 含「已自动暂存」+ 版本列表含「自动」）。
- 发布草稿支持暂存/计数/恢复/删除闭环（验证：tests/save-publish-flow.spec.js 用例④）。
- IndexedDB schema v6：旧用户首次访问自动升级建表，无数据迁移（publish_drafts 为新增空表）。
- 防重复 DOM id 缺陷模式再现（#edit-save-card-title 首漏 class-only），已修复并在测试中以 id 断言锁定；后续模板 DOM 改动需同步核对测试选择器。
- 首跑 5 项失败中 2 项（Mobile goto 超时、toggle 点击被拦截）系当时 12 个并发后台任务致机器过载的环境问题，清理后单跑复现通过，非代码缺陷。

## Superseded when

- 需要跨设备取回草稿或暂存版本时，将 publish_drafts 与 auto-save 版本同步至云端（复用 /api/sync-artwork 通道思路）。
- 需要保存 PNG/无损格式或更高分辨率时，将导出参数开放为用户可选（当前固定 JPEG 0.95 / 长边 1800）。
