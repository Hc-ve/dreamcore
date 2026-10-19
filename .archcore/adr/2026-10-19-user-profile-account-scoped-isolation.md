# ADR: 用户资料（头像/昵称/简介）按账户隔离存储与云端记录重键

- Status: accepted
- Date: 2026-10-19
- Deciders: 项目负责人（用户）、AI 工程协作（Trae）

## Context

用户实测报告四类缺陷：①admin 上传自定义头像后切到 h.c，h.c 显示的是 admin 的头像；②admin 的自定义头像在他人端（作品详情页作者行、个人资料页）不生效，且头像数据未正确落库；③点击他人头像未进入其个人资料页而是回到首页；④「更多设置」的昵称/简介疑似只写本地未生效。

定位结果（三层存储 localStorage + IndexedDB + Supabase）：

1. **资料键全账户共享**。@js/settings.js 的 `LS_KEYS` 只登记了 `avatar`/`nickname`，`bio`/`tags` 未登记 → `LS_KEYS[key]` 为 `undefined`，拼出脏键 `dreamcore-undefined`，导致 bio 与 tags 互相覆盖；而 `avatar`/`nickname` 用的是**不带 userId 的全局键** `dreamcore-avatar`/`dreamcore-nickname`，登出也不清理 → 换账户登录即继承上一位用户的头像（Bug #1、#4 的根因）。
2. **写入端残缺**。`_syncProfileToBackend` 只把昵称/简介写进 Supabase metadata，头像 dataURL 仅进 IndexedDB，云端 `profiles` 表 / `users` 表均未持有头像。
3. **读取端缺失**。`_cloudProfileToUser()` 构建登录态时不带出 avatar/nickname/bio，登录后用户对象里没有资料字段；多处头像渲染直接硬编码 `(username).charAt(0)`。
4. **本地记录建不起来（关键）**：种子数据 `seedIfEmpty` 会创建一个 `username='admin'` 的本地用户（自增数字 id）。云端 admin 以 UUID 登录时，`ensureLocalUserForCloudUser` 遇到「同名不同 id」直接 `return null`（静默跳过以避免唯一索引 ConstraintError）→ 云端用户永远拿不到本地 users 记录 → 后续 `updateUser(uuid)` 抛「用户不存在」，头像/昵称/简介**永远写不进 users 表**。这正是 Bug #2「头像数据未正确持久化」的直接根因，也解释了为何 admin 的头像在他人端完全不生效。
5. **路由跳转**。作品详情页作者行的点击处理器先 `closeLightbox()` 再 `Artist.openByUserId()`，而后者查不到用户时静默 `return` → 用户停在首页，形成死胡同（Bug #3 的根因）。

## Decision

采用「**账户级资料存储 + 云端 id 重键 + 统一头像渲染**」：

1. **localStorage 资料键按 userId 隔离**：@js/settings.js 引入 `ACCOUNT_SCOPED_KEYS = ['avatar','nickname','bio','tags']` 与 `_resolveLsKey(key)`，账户级键实际键名变为 `dreamcore-<key>-u-<userId>`；未登录时账户级键**不可读写**（读返回默认值、写直接跳过）。一次性清理遗留全局键（`dreamcore-avatar`/`dreamcore-nickname`/`dreamcore-bio`/`dreamcore-tags`/`dreamcore-undefined`）。
2. **登录后以 IndexedDB users 记录为权威源回灌**：新增 `Settings.hydrateUserProfile(user)`，登录链路的 `_ensureLocalUser()` 统一调用；头像 dataURL 落 IndexedDB 用户记录（`avatar: {type:'custom',dataURL}` | `{type:'system',id}`），并与账户级 localStorage 互为缓存。
3. **新增统一渲染函数 `Settings.renderAvatarHtml(user, opts)`**：所有头像位（导航栏、个人资料页、艺术家主页、作品详情作者行、关注列表）一律经它渲染，杜绝各处 `charAt(0)` 硬编码。
4. **云端用户本地记录「重键」**：`ensureLocalUserForCloudUser` 遇到「同名不同 id」不再跳过，而是把旧记录（种子 admin / 历史本地账户）**迁移到云端 id**（`delete` 旧键 + `put` 新键），保留旧记录的本地字段、并以云端 metadata 为资料优先源。既消除唯一索引冲突，又保证后续所有以 UUID 为主键的写入可用。
5. **他人个人资料页走 hash 路由**：作者头像/用户名点击统一跳 `#/profile-<encodeURIComponent(userId)>`；`_renderProfile(params)` 支持查看他人（昵称优先、动态 Tab 与统计、关注按钮），查不到时渲染「未找到该用户」友好卡片而非跳回首页。

## Alternatives Considered

1. **保留全局资料键、仅在登出时清空** —— 被否决：只解决「登出→登录」路径，无法覆盖「同一浏览器多标签/未登出直接切换」与并发写入，且 bio/tags 脏键问题是结构性的。
2. **资料全部上云、以 Supabase metadata 为唯一真源** —— 被否决：头像 dataURL 体积大，写 metadata 会显著撑大 JWT 与 profile 行；且本项目已确立「本地优先 + 最小双写」原则（见 2026-09-22 ADR）。
3. **同名冲突时改用户名为 admin-2 之类规避** —— 被否决：对外展示的用户名被污染，且云端用户名与邮箱绑定，改名破坏身份一致性。
4. **同名冲突时删除旧记录、不迁移** —— 被否决：会丢失旧记录里已有的本地头像/简介/计数等字段。
5. **点击作者头像直接内嵌 Artist 弹窗（不走路由）** —— 被否决：Artist.openByUserId 在用户不存在时无法给出可见反馈，且无法呈现「他人个人资料页」的完整形态（动态 Tab/关注按钮/统计）。

## Consequences

- 换账户登录后导航栏、个人资料页、他人端展示的头像/昵称/简介**完全按账户隔离**，互不串扰；遗留全局键被一次性清理，不再有 `dreamcore-undefined` 脏键。
- 云端 admin/h.c 等账户首次登录即能建立 UUID 主键的本地 users 记录，头像/昵称/简介可正常落库并在他人端生效（旧种子 admin 记录被重键覆盖，其本地字段保留）。
- 头像渲染统一收口到 `Settings.renderAvatarHtml`，新增头像位只需调用该函数，避免再次出现硬编码首字母。
- 「选择我的作品」选择器默认停在「我的作品」Tab（AI评分/修图/文创均作用于自己的作品）；未登录时如实展示登录引导，不回退到全局热门作品（与 reg① 数据隔离一致）。
- 回归测试：新增 @tests/user-profile-isolation.spec.js（7 用例），并与既有 @tests/bugfix-regression.spec.js 合并全量跑通（3 视口 × 51 用例全绿）。
- 依赖约定：`Auth.getCurrentUser()` / `Auth.updateNavForUser()` / `Auth.requireLogin()` 统一以 `window.currentUser` 为登录态真源（auth.js 内部赋值时同步写两者），消除「模块内 currentUser 与 window.currentUser 双份状态可能不一致」的隐患。

## 追加修订（同日 · Bug #5 与头像统一收口）

**新缺陷**：在他人个人资料页（`#/profile-<userId>`）点击「返回首页」按钮无任何反应，浏览器标签页标题变为「页面未找到 · Dreamcore」。

**根因（Bug #5）**：@js/router.js 的 `home` 路由正则为 `/^#?$/`，只匹配 `''` 与 `'#'`，**不匹配 `'#/'`**；而全站「返回首页」入口统一使用 `href="#/"`（个人资料页返回条、未找到该用户卡片、登录引导卡、法律页 host）。点击后 hash 变为 `#/` → 未命中任何路由 → 落到 `notFound` → 标题变「页面未找到」，且 `_render404()` 不清理 `#__profile_host`（z-index 9998 全屏浮层），故视觉上"没反应"。

**修订决策**：

1. `home` 路由正则改为 `/^#?\/?$/`，同时接受 `''`、`'#'`、`'#/'`（保留对历史 `href="#"` 入口的兼容）。
2. **头像渲染全站统一收口**：新增 `Settings.buildUserMap()`（一次性 `getAllUsers()` 建 `String(id)→user` 映射，供只持有 userId 的展示面批量取头像，避免逐条查询）。将此前遗留的展示面全部改走 `Settings.renderAvatarHtml`：
   - @js/admin.js 用户表格（`u` 为完整记录，直接渲染，`sm` 尺寸）
   - @js/notifications.js 通知项（`fromUser` 记录）
   - @js/gallery.js `_renderCommentList` 与 @js/interactions.js `renderComments`（改为 async，经 `buildUserMap` 解析评论者头像）
   - @js/leaderboard.js 领奖台与列表行（`_render` 内挂载 `r.user`）
   - @js/router.js `_profileRenderFollowing` 关注列表（由 `charAt(0)` 硬编码改为 `renderAvatarHtml`，点击跳 `#/profile-<userId>`）
3. **排行榜 UUID 关联修复**：`_onRowClick` 旧实现 `Number(key.slice(1))` 把云端 UUID 变 `NaN`，`_isMe`/`_findMyRow` 亦用 `Number` 比较 → 云端账户永远识别不到「我的排名」；统一收敛到字符串比较的 `_rowIsUser(r,u)`（有 `userId` 比 `String(userId)`，仅虚拟艺术家回退作者名）。

**修订影响**：

- 个人资料页「返回首页」在本人页、他人页、未找到用户卡片三条路径下均回到 `#/` 并正常渲染首页（标题不再变「页面未找到」）。
- 评论区、通知、排行榜、管理后台用户表、关注列表的头像与导航栏/资料页/作品详情页**按账户一致**，不再出现同账户在不同展示面头像不一致（首字母色块 vs 自定义头像）。
- 回归测试 @tests/user-profile-isolation.spec.js 由 7 用例扩至 11 用例（新增 ⑤ 返回首页 2 例、⑥ 评论/排行榜头像 2 例），与 @tests/bugfix-regression.spec.js 合并全量跑通（3 视口）。

## 追加修订（同日 · 法律文档站内路由化 + 全屏浮层统一覆盖导航）

**新缺陷（用户实测）**：
①「更多设置 → 关于」里的「服务条款 / 隐私政策」点击后**跳出本站**（新开窗口进入 `terms.html` / `privacy.html`），且文档页主题色与主站不统一（静态页自带 `#0a0612` 紫色系，主站为 `--accent` 红色系）；
②停留在「更多设置」这类全屏页时，**仍能点到首页顶部主导航**（文化探索 / 搜索 / 创作工坊 / 用户区）——用户质疑"更多设置不是一个独立页面吗"。

**根因**：
1. @js/settings.js「关于」Tab 与 @index.html 页脚的法律链接直接指向静态文件 `/terms.html`、`/privacy.html`，其中设置页还带 `target="_blank"`；而 `public/terms.html`、`public/privacy.html` 是**自带独立 `<style>` 的静态页**，主题与主站不同 → 形成"跳出 + 主题不统一"。
2. 所有全屏浮层（`#__profile_host` / `#__search_host` / `#__settings_host` / `#__legal_host` / `#__notfound_host`）此前统一用 `inset:72px 0 0 0`（从导航下方 72px 处铺开），`#navbar`（`z-index:500`）未被覆盖 → 全屏页期间导航始终可点。这是**既有设计**，非本轮引入。

**修订决策**：

1. **法律文档站内路由化（单一来源 + 站点主题）**：@js/router.js 新增 `terms`（`/^#\/?terms(?:\?.*)?$/`）与 `privacy` 两条路由；`handleRoute` 新增对应 case，调用新方法 `_renderLegalDoc(kind)`。该方法 `fetch('/terms.html' | '/privacy.html', {cache:'force-cache'})` 后用 `DOMParser` 抽取 `#main-content`，移除独立页自身的 `.legal-nav` 与 `h1`，把静态页 `<style>` 注入 `#__legal_page_style`（并将其 `padding:100px 28px 80px` 覆盖为 `0 0 8px`，避免站内浮层出现 ~100px 空白），再交给 `_renderHost` 以主站主题渲染，并附「隐私政策 / 用户协议」页内互链。**不新开窗口、不离开 SPA**；`public/*.html` 静态页保留供直接访问与 SEO 收录。
2. **全屏浮层统一改为 `inset:0` 覆盖整个视口**：`_renderProfile` / `_renderSearch`（含注入的 `#search-modal` CSS）/ `_render404` / `_renderHost`（定价、AI 披露、法律文档共用）与 @js/settings.js 的 `#__settings_host` 全部由 `inset:72px 0 0 0` 改为 `inset:0`，`z-index` 层级（9998/9997/9996）不变。全屏页期间顶部导航被完全盖住，符合"独立页面"的交互预期。
3. **`_renderHost` 签名扩展为 `(title, bodyHTML, opts)`**：新增 `opts.maxWidth` / `opts.padding` / `opts.actions` / `opts.dismissOnBackdrop`；背景空白点击关闭的 handler 改为按实例挂在 `host._backdropHandler` 上，以支持 `dismissOnBackdrop:false`（法律文档为长文阅读页，铺满视口后误触空白不应直接关掉）。既有 `_renderPricing` / `_renderAiDisclosure` 以 2 参调用，靠默认 `opts = {}` 向后兼容。
4. **其余法律入口同步改为站内路由**：@js/settings.js「关于」两条链接去 `target="_blank"` 改 `#/terms`、`#/privacy`；@index.html 页脚两条链接改 `#/privacy`、`#/terms`；`_renderProfile` 未登录卡片的"用户协议与隐私政策"文案改为可点链接。

**修订影响**：

- 「服务条款 / 隐私政策」在设置页、页脚、登录引导卡片三处入口均**站内渲染**：不新开窗口、不整页跳 `.html`，标题正确、不再是 404，主题与主站一致（红色系 `--accent`），并可页内一键互切。
- 设置页 / 个人中心 / 搜索 / 法律页 / 404 五类全屏页均**铺满视口**（几何 + 层叠 + 行为三层验证），顶部导航不再可点。
- 回归测试：新增 @tests/legal-pages-and-fullscreen.spec.js（7 用例 × 3 视口 = 21 用例全绿：法律页站内渲染与切换、设置页/页脚链接、五类全屏页覆盖导航）；既有 @tests/bugfix-regression.spec.js + @tests/user-profile-isolation.spec.js 全量 63 用例保持全绿。

## 追加修订（同日 · `#/pricing` 与 `#/ai-disclosure` 重复实现统一为交互版）

**背景（排查中发现的既有批次冲突，非本轮引入）**：在上一节的 `inset:0` 改造后复跑既有回归时，`tests/p0-pricing.spec.js`（2 用例）与 `tests/p1-disclosure.spec.js`（1 用例）共 7 个用例在全视口下报错 `#__legal_host subtree intercepts pointer events`。

**根因**：`#/pricing`、`#/ai-disclosure` 存在**两套叠加实现**：

1. @js/pricing-page.js / @js/ai-disclosure-page.js 以 `.modal-overlay`（`z-index:1000`）渲染的**交互版**（含「一键下单」三步状态机等），import 时自注册 `hashchange`。
2. @js/router.js 的 `_renderPricing()` / `_renderAiDisclosure()` 又用 `_renderHost` 渲染了一份**静态版** `#__legal_host`（`z-index:9996`）。

静态层 `z-index` 更高，把交互层整个盖住，导致「一键下单」按钮点不到——这正是竞赛加分刚需的演示链路。

**对照实验（证明与本轮 `inset:0` 改动无关）**：临时把 `_renderHost` 的 host 样式改回 `top:72px;right:0;bottom:0;left:0` 后单跑该用例，失败现象完全一致（`__legal_host` 仍拦截 `.pp-order-btn`）；随后精确还原为 `inset:0`。

**修订决策（用户选择「统一为交互版」）**：删除 @js/router.js 中重复的 `_renderPricing()` 与 `_renderAiDisclosure()`，`handleRoute` 的 switch 中 `case 'pricing': case 'ai-disclosure':` 改为**只锁 body 滚动、不再渲染任何 host**，两页仅由 `pricing-page.js` / `ai-disclosure-page.js` 渲染。符合「同一功能只保留一个入口 / 一套实现」的项目约定，并恢复「一键下单」演示链路。

**修订影响**：

- `#/pricing`、`#/ai-disclosure` 由模块自带 `.modal-overlay` 单一实现渲染，交互（下单状态机 / 关闭清 hash / 重开单例复位）全部可用；`tests/p1-disclosure.spec.js`、`tests/p3-disclosure.spec.js` 全部转绿。
- 附带修复一处窄视口 flake：@tests/p0-pricing.spec.js 末次点击 `#pp-done-btn` 前先 `page.mouse.move(0, 0)`。根因是 `:hover` 反馈抖动——指针停在上一步 `#pp-submit-btn` 旧位置，loading→success 后弹窗高度变化使 `#pp-done-btn` 底边恰落在指针 ~1.3px 内，`.btn-primary:hover{transform:translateY(-2px) scale(1.03)}` 令下边缘上移→指针脱离→hover 取消→回落→再进入，逐帧振荡使 Playwright 稳定性检查永不通过（`element is not stable`，仅 Mobile 复现）。**仅调整测试侧指针定位，不改动 `.btn-primary:hover` 全局视觉**；`--repeat-each=3 --retries=0` 连续 3 次通过。
- 回归测试：`legal-pages-and-fullscreen`(21) + `p0-pricing`(9) + `p1-disclosure`(9) + `p3-disclosure`(6) 四套 **45/45 全绿**；`bugfix-regression` + `user-profile-isolation` **63/63 全绿**（0 flaky）。
- **遗留说明**：@tests/_report-fixes.mjs、@tests/_e2e-full.mjs 两个非 spec 脚本中仍断言「`#/pricing` / `#/ai-disclosure` 必有 `__legal_host`」，与本次「统一为交互版」的决策相反，属历史遗留脚本（不在 Playwright 收集范围、未运行），如需继续使用应改为断言 `.modal-overlay` 交互版。

## Superseded when

- 项目启用真正的多端实时资料同步（Realtime/推送）后，账户级 localStorage 缓存需改为订阅式失效。
- 头像改为对象存储 URL（Storage 桶）而非 dataURL 后，`avatar` 结构需从 `{type,dataURL}` 迁移为 `{type,url}`，此 ADR 的存储形态部分需重审。
- 引入统一的 hash 路由注册表（集中校验所有 `href` 与路由正则的一致性）后，本条「`#/` 兼容」修订可回归到路由表单点维护。
