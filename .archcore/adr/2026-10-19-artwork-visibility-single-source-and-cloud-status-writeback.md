# ADR: 作品状态可见性单一事实来源 + 状态变更云端回写

- Status: accepted
- Date: 2026-10-19
- Deciders: 项目负责人（用户）、AI 工程协作（Trae）

## Context

用户实测报缺陷：管理后台把作品「暮染雪峰」**下架**（状态 `rejected`）后，**画廊不再显示，但「作品搜索」与「个人中心」仍然能看到**；并质疑"后台管理功能是否真正落实、数据库是否同步"。

三层存储排查（localStorage + IndexedDB + Supabase）后确认为**既有实现缺陷**（非本轮改动引入），三个根因：

1. **R1 读取路径未统一（缺单一事实来源）**：可见性过滤只写在 @js/gallery.js 的 `_applySortAndFilter`（孤例），@js/search.js 与 @js/db.js 的 `getUserArtworks` 各走各自 `getAllArtworks()` → 同一份数据两种视图。这是"后台已下架但搜索/个人中心仍可见"的**直接原因**。
2. **R2 状态语义不统一**：本地四态 `pending/published/rejected/deleted`，云端三态 `draft/published/offline`（见 @supabase/schema.sql 的 `artworks.status check`），且可见性规则无统一收口。
3. **R3 状态变更不回写云端**：`status` 是服务端权威字段，但后台改状态**零云端回写**（db.js 全文无 Supabase 写路径；admin 只调本地 `updateArtwork`/`deleteArtwork`），唯一云同步是"发布"单向上云 → 换端/清缓存后云端仍旧值，下架"复活"。

## Decision

采用「**读取侧单一事实来源 + 写入侧服务端回写**」：

1. **可见性收口到 db.js（单一事实来源）**：新增 `ARTWORK_STATUS`（四态常量）、`CLOUD_STATUS_MAP`（本地→云端映射）、`isPublicArtwork` / `isOwnerVisibleArtwork` 纯函数与 `getPublicArtworks()` 入口。
   - 对外公开可见（画廊/搜索/榜单/策展/他人主页）：**仅 `published`**；历史存量无 `status` 字段 → 视为公开可见（兼容）。
   - 作者本人可见（个人中心我的作品）：**排除 `rejected`/`deleted`，保留 `pending`**（作者能看到"审核中"）。
   - `getUserArtworks()` 加 `isOwnerVisibleArtwork` 过滤；@js/search.js、@js/gallery.js 对外读取一律改走 `getPublicArtworks()`，并删除 gallery 内重复的本地过滤。
   - 后台读取（@js/admin.js `artworksCache = getAllArtworks()`、@js/ai-dashboard.js）**保留全量**，否则无法恢复下架作品。
2. **状态变更回写云端（服务端通道）**：新增 @netlify/functions/update-artwork-status.mjs（`POST /api/update-artwork-status`，`op='status'` PATCH / `op='delete'` DELETE）。**service key 会绕过 RLS，故归属校验在本函数内自行完成**：非本人时查 `profiles.role`，仅 `admin` 放行；状态白名单 `draft/published/offline`。
   - 客户端 @js/api/migrate-to-cloud.js 新增 `updateArtworkStatusToCloud(artworkId, status)`（经 `CLOUD_STATUS_MAP` 映射）与 `deleteArtworkFromCloud(cloudId)`；**best-effort**：失败仅 `console.warn`，绝不阻塞后台主流程；未上云（无 `cloudId`）/未登录 → 静默跳过。
   - @js/admin.js 五处调用点接入：`_setArtStatus`、`_batchSetArtStatus`、`_editArtwork`、`_deleteArtwork`（hard 分支用删除前捕获的 `art.cloudId` 调删除）、`_batchDeleteArtworks`。
   - 开发期 @vite.config.js 的 `aiProxyDev` 新增 `/api/update-artwork-status` 中间件（否则 dev 落到 3001 proxy 而 404）。
3. **Supabase schema 无需改动**：`artworks.status` 字段与 `artworks_select_published` 等 RLS 已存在（见 @supabase/schema.sql），本地四态与云端三态的差异靠 `CLOUD_STATUS_MAP` 映射解决。

## Alternatives Considered

1. **在各页面分别加过滤（沿用现状思路）** —— 被否决：正是本次缺陷的成因，视图会随页面各自演进再次不一致。
2. **改 Supabase 表结构把云端枚举扩为四态** —— 被否决：云端 `draft/published/offline` 已够表达"未公开/公开/已下架"，`pending` 与 `rejected` 在对外语义上都属"不可见"，改表结构收益低、迁移风险高。
3. **客户端直连 Supabase 改 artworks.status** —— 被否决：RLS `artworks_update_own` 仅本人，admin 改他人作品会被拦；且 Storage/写库已确立"统一走服务端 service key"原则（见 2026-09-22 ADR）。
4. **状态变更同步阻塞主流程（强一致）** —— 被否决：演示环境断网/云端异常时后台操作不应失败；沿用既有 best-effort 静默降级范式。

## Consequences

- 后台「下架 / 逻辑删除 / 物理删除」后，**画廊 / 搜索 / 个人中心三处视图一致**地不再暴露该作品；恢复为 `published` 后三处重新可见。
- 后台改状态会回写云端 `artworks.status`，换端/清缓存后不再"复活"；未上云的作品不受影响（静默跳过）。
- 对外可见性不再由各页面自行维护，新增对外展示面只需调用 `getPublicArtworks()`。
- 回归测试：新增 @tests/artwork-visibility.spec.js（3 用例：数据层语义 / 三视图一致 / 下架→恢复），Desktop Chrome 全绿；既有 @tests/admin-p0 / @tests/user-profile-isolation / @tests/cloud-sync 复跑通过（cloud-sync 因云端网络超时 flaky 后重试通过）。
- **同类读取点已一并收口**：另有 6 处对外展示面此前走 `getAllArtworks()`，存在"下架作品仍对外出现"的同类问题，本次统一改为 `getPublicArtworks()`：@js/leaderboard.js（榜单）、@js/ai-curate.js（策展馆取材）、@js/culture-atlas.js（主题详情关联作品）、@js/scenic-recommend.js 与 @js/culture-scan.js（文创底图匹配，含"无匹配兜底热门作品"分支）、@js/ai-aesthetic.js（相似作品候选）。后台读取（@js/admin.js `artworksCache`、@js/ai-dashboard.js）仍保留全量。
- 回归测试（收口追加）：@tests/culture-features / p0-scenic-closure / p1-digital-guide / scenic-craft-p0 / scenic-craft-p1-poster / p3-trace-card / p1-dashboard + @tests/artwork-visibility 共 **46/46 全绿**；`npm run build` 成功。
- 依赖约定：新增云函数须同步在 @vite.config.js 的 `aiProxyDev` 注册中间件（dev 期后端内嵌 Vite），否则该路由 404。

## Superseded when

- 对外可见性引入统一的"作品可见性中间层"（如统一查询网关）后，本 ADR 的 `getPublicArtworks()` 可下沉到该层。
- 云端引入 Realtime 订阅使状态变更实时广播后，"回写 + 换端读取"链路需改为订阅式失效。
