# ADR: 数据持久化——本地优先 + 作品发布即上云的最小双写同步（方案B）

- Status: accepted
- Date: 2026-09-22
- Deciders: 项目负责人（用户）、AI 工程协作（Trae）

## Context

比赛演示 demo 的核心验收标准之一是"服务器重启后用户发布的作品数据不丢失"。实测确认：作品此前只写 IndexedDB（浏览器本地），重启后虽可恢复本地数据，但清缓存/换设备即全量丢失，云端 Supabase artworks 表仅存有迁移工具手动写入的 248 行历史数据，实时发布链路（@js/publish.js）完全不落云端。同时项目有既成教训：点赞数据因列表与详情使用不同数据源导致 946 vs 0 的展示不一致（2026-09-22 已修复），因此点赞/评论/关注必须保持 IndexedDB 单一数据源（baseLikes + 实时记录）。

实施时实测发现：Supabase Storage 桶 `artworks` 的 RLS 不放行已登录用户客户端直传（报错 "new row violates row-level security policy"，RLS 探测：artworks 表 insert 201 通过、Storage objects insert 400 被拒），且 storage schema 未暴露给 PostgREST，无法经 REST 补策略。

## Decision

采用「本地优先 + 作品发布即上云的最小双写同步」：@js/publish.js 在用户确认发布后 fire-and-forget 调用 CloudMigrate.syncArtworkToCloud(artworkId)（@js/api/migrate-to-cloud.js），经服务端云函数 /api/sync-artwork（@netlify/functions/sync-artwork.mjs，service key 校验 access_token → Storage 图片上传 → artworks 入库 → aesthetic_scores/comments 附带同步）完成上云；同步成功才打 cloudMigrated/cloudId 本地标记，失败静默降级（console.warn）绝不阻塞发布主流程，未标记作品可由 CloudMigrate.run() 批量补迁移。

## Alternatives Considered

1. 方案A（纯本地存储，云端仅靠手动迁移工具）——被否决，因为发布链路不落云端意味着重启后新发布作品在换设备/清缓存场景必然丢失，不满足"数据不丢失"的比赛验收标准。
2. 方案C（点赞/评论/关注全量上云 + 多端实时同步）——推迟采用，因为会引入多数据源一致性风险（项目已发生过列表/详情点赞数不一致的线上缺陷）且显著增加复杂度，超出比赛演示的功能必要范围。
3. 客户端 anon key 直传 Storage——被否决，因为实测 Storage 桶 RLS 拒绝已登录用户直传（"new row violates row-level security policy"），且 storage schema 未暴露给 PostgREST 无法经 REST 补策略，用户侧无 Dashboard SQL 权限介入路径。

## Consequences

- 发布作品后云端 artworks 行数 +1，图片落在 Storage 公共桶（user.id/ 路径隔离），服务器重启/清缓存后作品数据可从云端恢复（验证：tests/cloud-sync.spec.js 3 视口全通过）。
- 同步失败（断网/云端异常/未登录云端）零阻塞：发布主流程正常完成，失败作品保持未标记，可由 CloudMigrate.run() 补迁移（幂等，cloudMigrated 标记防重复）。
- 点赞/评论/关注仍只在 IndexedDB，换设备后这些数据不可恢复（[expected] 比赛演示场景可接受，交互数据非核心资产）。
- 新增一条服务端通道依赖 SUPABASE_SERVICE_ROLE_KEY（本地 .env 已配，Netlify 生产环境需配置同名变量，与密保找回通道共用依赖）。
- 发布同步为 fire-and-forget，同步进行中用户无感知，极端情况下（同步超时）作品最晚由下次 run() 补齐（[expected]）。

## Superseded when

- 日活用户 > 50（当前演示规模 < 10 人），需要跨设备看到自己的点赞/关注记录时升级为方案C。
- 收到明确的跨设备数据同步需求反馈（至少 2 例独立用户反馈）。
- Supabase Storage 配置了 authenticated 用户直传策略（storage policy 允许 insert）后，可将服务端上传通道降级为客户端直传以减少一跳。
