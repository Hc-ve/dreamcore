# 设置模块设计市场调研报告

> 调研日期：2026-10-11
> 参考产品：Notion / 飞书 / Figma / Discord / VS Code
> 目标项目：**Dreamcore**（3D 文创类 SaaS，Web App + 管理后台 + 轻量移动端）

---

## 一、通用设置子功能清单（按类别分组）

### 1. 账号 / 个人信息
| 设置项 | 说明 |
|--------|------|
| 头像 / 昵称 | 身份最直观的标识 |
| 邮箱 / 手机号 | 登录凭据 |
| 密码 / 登录方式 | 改密、第三方登录绑定 |
| 个性签名 / Bio | 自我描述 |
| 个人名片 | 二维码、链接分享 |
| 个人状态 | 在线 / 忙碌 / 离线 |
| 外部账号绑定 | Google / GitHub / 微信 等 OAuth |

### 2. 通用 / 偏好
| 设置项 | 说明 |
|--------|------|
| 主题模式 | 浅色 / 深色 / 跟随系统 ⭐ |
| 主题色 / 强调色 | 品牌感 |
| 语言 | 多语言切换 ⭐ |
| 时区 | 国际化产品必需 |
| 字体大小 / 缩放 | 可访问性 |
| 窗口缩放 | 桌面端特有 |
| 默认编辑器 / 打开方式 | 工作流偏好 |
| 快捷键 | 重度用户刚需 |
| 文件保存位置 | 桌面端特有 |

### 3. 外观 / 视觉
| 设置项 | 说明 |
|--------|------|
| 布局密度 | 紧凑 / 舒适 / 宽松 |
| 侧边栏显示 | 展开 / 折叠 / 自动隐藏 |
| 图标风格 | 线性 / 面性 / 彩色 |
| 动画效果 | 开启 / 关闭（性能弱设备） |
| Canvas/画布背景 | 设计类产品特有 |

### 4. 通知
| 设置项 | 说明 |
|--------|------|
| 邮件通知 | 批量事件摘要 |
| 应用内通知 | 红点 / 弹窗 / 铃铛 |
| 桌面推送 | 操作系统级通知 |
| 通知声音 | 开关 + 选择 |
| 免打扰时段 | DND Schedule |
| 按事件类型分类开关 | 评论 / 点赞 / @提及 / 系统 |

### 5. 隐私 / 安全
| 设置项 | 说明 |
|--------|------|
| 信息可见范围 | 对所有人 / 仅好友 / 仅自己 |
| 谁可以找到我 | 通过手机号 / 邮箱 / 链接 |
| 2FA 双因素认证 | 安全底线 |
| 登录设备管理 | 查看并踢出 |
| 会话历史 / 数据留存 | 清除 / 保留期 |
| Cookie / 追踪 | GDPR / 合规 |
| 数据导出 | 用户可携带权 |
| 删除账号 | 危险操作独立区域 |

### 6. 工作空间 / 团队（SaaS 特有）
| 设置项 | 说明 |
|--------|------|
| 团队名称 / 图标 | 品牌 |
| 成员管理 | 邀请 / 移除 / 角色 |
| 角色与权限 | 管理员 / 编辑 / 查看 |
| 计费 / 订阅 | 套餐变更、发票 |
| 安全策略 | SSO / 域名白名单 / IP 限制 |
| 集成 / 第三方 App | Zapier / Slack / Webhook |
| API Token | 开发者能力 |
| 使用量 / 配额 | 存储、API 调用数 |

### 7. 关于 / 帮助
| 设置项 | 说明 |
|--------|------|
| 版本信息 | 检查更新 |
| 法律条款 | Terms / Privacy / Cookies |
| 开源许可 | OSS 合规 |
| 反馈入口 | 意见、Bug 报告 |
| 客服 / 支持 | 联系通道 |

### 8. 产品特有功能
- **Notion**：数据库视图偏好、块编辑器偏好、页面导出格式
- **Figma**：Auto-layout 偏好、组件库可见性、Dev Mode 设置
- **Discord**：语音/视频设备选择、消息扫描、Sticker Emoji 设置
- **VS Code**：Formatter 选择、Linter 开关、Git 行为、Terminal 配置
- **Dreamcore（建议）**：3D 渲染质量 / 贴图压缩 / 导出尺寸 / 素材库同步

---

## 二、高频设置项 Top 10（用户最常用）

综合 Material Design、Android 设置指南、Gummble UX 调研 + 5 款头部产品的菜单顺序：

| 排名 | 设置项 | 出现频次 | 说明 |
|------|--------|----------|------|
| 🥇 1 | **主题 / 深色模式** | 5/5 全中 | 用户第一眼感受，几乎每次产品迭代都会被调 |
| 🥈 2 | **通知开关** | 5/5 全中 | 信息过载治理，日活用户高频调整 |
| 🥉 3 | **密码 / 账号安全** | 5/5 全中 | 低频但高敏感，安全事件后必改 |
| 4 | **语言** | 5/5 全中 | 国际化产品必带 |
| 5 | **个人资料（头像/昵称）** | 5/5 全中 | 身份建立的入口 |
| 6 | **字体大小 / 缩放** | 4/5 | 移动端可访问性核心 |
| 7 | **第三方登录绑定** | 4/5 | 降低登录摩擦 |
| 8 | **隐私可见范围** | 3/5 | 社交 / 内容类产品高频 |
| 9 | **快捷键** | 3/5 | 重度用户刚需 |
| 10 | **导出 / 数据备份** | 3/5 | 数据主权敏感点 |

> 来源：[Android 设置设计指南](https://source.android.com/docs/core/settings/settings-guidelines)、[Material Design Patterns](https://m1.material.io/patterns/settings.html)、[Gummble Settings Checklist](https://gummble.com/blog/settings-screen-design-examples)

---

## 三、5 款参考产品的设置模块速览

### Notion（Web / Desktop SaaS）
- **入口**：侧边栏底部 Settings → 展开为左侧 tab + 右侧 panel 的全屏页
- **结构**：
  - **Account**：头像、邮箱、偏好、语言、主题、时区
  - **My integrations**：第三方集成
  - **Workspace**：General / Members / Security / Billing / Source control / Provisioning
  - **Notifications**：邮件 & 应用内分开，按事件类型细分
  - **Privacy**：数据导出、删除 workspace
  - **Settings search**：顶部全局搜索（> 15 项设置必加）
- **亮点**：支持 workspace 级与 account 级设置分离，搜索框前置

### 飞书（Web / Desktop / Mobile）
- **入口**：头像 → 设置（个人）；管理后台 → 企业设置 + 产品设置（管理员）
- **个人设置分类**：
  1. 账号与安全
  2. 通用（主题色 / 显示模式 / 语言 / 文件保存位置 / 字体大小）
  3. 通知（桌面通知 / 声音 / 免打扰）
  4. 隐私（谁能找到我 / 手机号可见）
  5. 快捷键
- **管理后台分类**：企业信息 / 成员与部门 / 权限管理 / 安全 / 计费 / 应用管理
- **亮点**：个人设置与组织设置完全隔离；桌面端有快捷键独立分类

### Figma（Web / Desktop）
- **入口**：头像 → Settings **弹窗（Modal）**，Preferences 单独一级菜单
- **Settings Modal 内 Tabs**：Account / Community / Plugins / Notifications
- **Preferences（独立页）**：Theme / Language / UI Scale / Keyboard Layout / Canvas Scroll Zoom
- **管理后台（Team Settings）**：成员 / 权限 / Billing / Security / Libraries
- **亮点**：**双层结构**——高频账号设置用轻量 Modal，深层偏好放主菜单；Account 与 Team 严格分离

### Discord（Desktop / Mobile / Web）
- **入口**：左下角齿轮图标 → **全屏面板（覆盖主区域）**
- **左侧 Tab 分组**（用细分割线分块）：
  - **User Settings**：我的账号 / 个人资料与头像 / 隐私与安全 / 友情请求 / 活动状态
  - **应用设置**：外观 / 文本 & 图片 / 通知 / 语音 & 视频 / 叠加层 / 高级
  - **服务器设置**（按服务器）：概述 / 成员 / 角色 / 频道权限 / 邀请 / 删除服务器
- **亮点**：分组清晰 + 底部"Red Zone"独立；Tab 多但有滚动和视觉分隔

### VS Code（Desktop IDE）
- **入口**：Ctrl+, → Settings Editor 或 `settings.json`
- **独特设计**：**双视图并存**
  - 图形化 Editor：搜索 + 分类（Editor / Workbench / Window / Files / Git / Terminal…）
  - JSON 原生化：所有图形化设置都映射到 JSON，开发者可手动编辑
  - User Settings / Workspace Settings / Folder Settings **三级作用域**
- **亮点**：作用域层级 + JSON 兜底，是重配置产品的极致形态

---

## 四、不同类型产品的差异点

| 维度 | Web App（Notion/Figma） | Mobile App（飞书/抖音） | SaaS 后台（飞书管理后台） |
|------|-------------------------|-------------------------|--------------------------|
| **入口位置** | 头像 / 侧边栏底部 | 底部 tab（"我" → 设置）或头像下拉 | 顶部导航 / 侧边栏 |
| **交互模式** | 全屏页 **或** 弹窗 | **全屏 push 栈**（层级导航） | 左 Tab + 右 Panel |
| **组织设置** | 与个人设置分屏 | 通常无组织设置 | 以组织/工作空间为中心 |
| **作用域层级** | Account / Workspace 两级 | 基本只有 User 级 | Workspace / Team / Project 多级 |
| **数量级** | 15–50 项 | 8–20 项（精简） | 30–200 项（含系统级） |
| **搜索** | 通常有（≥15 项必加） | 极少 | 必须有 |
| **危险操作区** | 底部 Danger Zone | 底部 Danger Zone | 独立的 Security / 数据标签页 |
| **快捷键** | 独立 Tab 或 Modal | 不存在（触屏无） | 一般无，重桌面场景例外 |
| **第三方集成** | 独立 Tab | 内嵌于账号或隐私 | 独立 Integration 模块 |

---

## 五、设置页典型交互模式

### 模式 A：左侧 Tab + 右侧 Panel（最主流）
**使用**：Notion（全屏）、Discord（全屏面板）、飞书管理后台、Linear、Arc
- 左侧 200–260px 导航栏，Section 分组
- 右侧内容区独立滚动
- 当前项高亮 + 可能有面包屑
- ✅ **可扩展性好**，新 Tab 直接追加
- ❌ 手机屏 < 768px 要改成抽屉
- **适合 Dreamcore**：后台管理页首选 ✅

### 模式 B：Modal 弹窗 Tabs（轻量高频）
**使用**：Figma Settings、GitHub Profile、Stripe Dashboard Settings
- 700–900px 宽的居中 Modal，顶部横向 Tabs
- 关闭即回到上下文
- ✅ 不打断当前工作流
- ❌ 内容不宜太多（< 5 Tabs，每 Tab < 10 项）
- **适合 Dreamcore**：用户从主画布进入账号设置时 ✅

### 模式 C：全屏 Push（移动端独占）
**使用**：飞书 App、Discord Mobile、Instagram
- settings 是多层级导航栈，一级一级 push
- 顶部返回键导航
- ✅ 符合移动端手势习惯
- ❌ 跳深层级麻烦，需要"通用 / 隐私"等中间层
- **适合 Dreamcore**：移动端或 PWA ✅

### 模式 D：Drawer 抽屉（中等复杂度）
**使用**：Slack 设置、部分 SaaS
- 从右侧滑出 400–500px 抽屉
- 可覆盖但不离开主视图
- ✅ 半模态，保持对主内容的感知
- ❌ 深度不够，< 4 个 Tab
- **适合 Dreamcore**：轻量快捷设置（如快速切换主题、语言） ✅

### 模式 E：搜索优先 + JSON 兜底（重配置）
**使用**：VS Code、JetBrains IDE
- 顶部搜索框置顶，模糊匹配所有设置项
- 图形化 + 原始 JSON 双视图
- ✅ 高阶用户效率高
- ❌ 学习成本高，不适合大众产品
- **适合 Dreamcore**：暂不建议（除非有开发者模式）

### 模式 F：Accordion 折叠（单页）
**使用**：Material Design 默认、简单官网
- 所有分组在一个长页面，点击展开
- ✅ 最简洁，无导航成本
- ❌ 分组 > 5 个时滚动疲劳
- **适合 Dreamcore**：文档站 / 官网的设置预览，非产品主设置页

---

## 六、Dreamcore 适配建议

### 6.1 产品定位复盘
Dreamcore = 3D 文创 SaaS，用户画像：设计师 / 文创运营 / 市场人员，既有 Web App 也有管理后台，部分用户会用移动端 PWA。

### 6.2 建议保留的设置分类（必选）

| 优先级 | 分类 | 理由 |
|--------|------|------|
| P0 | 账号 / 个人资料 | 身份 + 登录凭据，所有产品必需 |
| P0 | 主题 / 外观 | 3D 产品的视觉敏感性高于一般 Web App |
| P0 | 通知 | 协作 / 发布工作流的关键 |
| P0 | 隐私 / 安全 | 含 3D 资产归属权，合规红线 |
| P0 | 工作空间（管理员） | SaaS 协作核心 |
| P1 | 通用偏好（语言 / 时区） | 国际化扩展必备 |
| P1 | 3D 特有设置（渲染质量 / 贴图压缩 / 导出格式） | 差异化价值所在 |
| P1 | 集成（Figma / Blender / Shopify Webhook） | 对接设计师现有工具链 |
| P2 | 快捷键 | 重度创作者加分项 |
| P2 | 关于 / 帮助 / 数据导出 | 合规底线 |

### 6.3 建议**砍掉**或**延后**的设置

| 设置 | 理由 |
|------|------|
| 复杂的 Role 层级（RBAC > 3 级） | 早期团队 20 人内 Owner/Editor/Viewer 三级足够 |
| 高级 IDE 式 JSON 配置 | 非开发者用户看不懂，增加维护成本 |
| 过多的系统音量/铃声选择 | 3D 产品没有语音协作场景 |
| App Store / 系统级集成 | 纯 Web SaaS，不是 App |
| Developer Mode 开关 | 等 API 开放后再考虑 |

### 6.4 推荐的交互方案

**主设置页（用户入口）**：
- 从头像或侧边栏"设置"进入 **左侧 Tab + 右侧 Panel 的全屏页**
- Tab 顺序建议（按高频度）：
  1. 个人资料
  2. 外观 / 主题 ⭐
  3. 通用（语言 / 时区 / 3D 渲染偏好）
  4. 通知
  5. 隐私与安全
  6. 集成（3D 工具链 / Webhook）
  7. 关于
- 顶部带 **搜索框**（≥ 15 项设置）
- 底部 Danger Zone 独立（删除账号 / 转让工作空间）

**管理员入口**：
- 同框架，多几个 Tab：成员 / 角色 / 计费 / 品牌资产 / 审计日志
- 与个人设置严格分屏（参考 Notion Workspace 与 Account 的分离）

**移动端（PWA）**：
- 改为 **全屏 push 栈**，一级分组 + 二级详情
- 砍掉管理类设置，保留个人 / 通知 / 隐私 / 外观
- 3D 渲染设置简化（只有"高 / 低"两档，移动端不需要画质）

**快速设置（快捷入口）**：
- 从顶部 toolbar 齿轮图标弹出 **小型 Drawer（400px）**
- 只放高频 3 项：主题切换、通知快速开关、导出格式快捷选择
- 类似 Slack 快捷设置面板

### 6.5 视觉 & 交互细节速查

| 细节 | 建议 | 依据 |
|------|------|------|
| 设置项标签文案 | 中性词"通知"而非"通知我"；避免否定词 | Android 设置设计指南 |
| Toggle 行为 | 即时生效，Toast 反馈"已保存" | Figma / Discord 模式 |
| 下拉 / 表单 | 失焦即保存，不依赖"保存按钮" | Notion / Linear 模式 |
| 当前值可见 | 每行右侧显示当前状态（如"主题：深色"） | Gummble Checklist |
| Preview | 外观类设置（主题 / 3D 渲染）**实时预览** | Figma Theme Preview |
| Danger Zone | 独立分组 + 红色系 + 独立弹窗二次确认 | Discord / Linear |
| 空状态 | 新用户首次进入显示引导说明（如"上传头像展示作品署名"） | Material Design |
| Search 范围 | 只覆盖文本标签和 description，不覆盖嵌套值 | VS Code / Notion |

### 6.6 3D 文创类产品**独有的设置建议**

这是 Dreamcore 与 Notion/Figma 这类通用工具最大的差异点：

| 独有设置 | 类别 | 说明 |
|----------|------|------|
| 默认 3D 渲染质量 | 通用 | 高（默认）/ 中 / 低，按设备性能自适应 |
| 贴图压缩策略 | 通用 | 上传时自动压缩 / 保持原图 |
| 模型坐标系偏好 | 通用 | Y-up / Z-up，兼容 Blender vs Maya |
| 默认导出格式 | 通用 | GLB / FBX / OBJ / USDZ，文创电商各有偏好 |
| 水印 / 署名 | 外观 | 下载预览图时自动加作者名 + Dreamcore Logo |
| 作品授权默认值 | 隐私 | CC-BY / CC0 / 保留所有权利 |
| AI 训练同意 | 隐私 | 用户资产是否允许用于平台 AI 训练（**合规重点**） |
| 文创品牌资产库 | 工作空间 | Logo / VI / 字体预设集中管理，团队共用 |
| Shopify / 微店 Webhook | 集成 | 3D 模型同步到电商产品页 |
| AR 预览开关 | 外观 | 生成 USDZ 用于 iOS Safari AR 预览 |

---

## 七、总结速查卡

```
Dreamcore 设置页骨架（v1 建议）

┌─────────────────────────────────────────────────┐
│  🔍 搜索设置                                   │
├──────────┬──────────────────────────────────────┤
│ 👤 个人  │  头像、昵称、邮箱、Bio、状态          │
│          │  第三方登录绑定                       │
├──────────┼──────────────────────────────────────┤
│ 🎨 外观  │  主题（浅/深/跟随系统）                │
│          │  主题色、字体大小、3D 渲染质量        │
│          │  AR 预览水印、布局密度                │
├──────────┼──────────────────────────────────────┤
│ ⚙️ 通用  │  语言、时区、默认导出格式             │
│          │  贴图压缩、模型坐标系                 │
│          │  快捷键                                │
├──────────┼──────────────────────────────────────┤
│ 🔔 通知  │  邮件 / 应用内 / 桌面推送             │
│          │  按事件类型开关、免打扰时段           │
├──────────┼──────────────────────────────────────┤
│ 🔒 隐私  │  信息可见范围、AI 训练同意            │
│          │  2FA、登录设备、数据导出              │
├──────────┼──────────────────────────────────────┤
│ 🔌 集成  │  Figma / Blender / Shopify Webhook   │
│          │  API Token                            │
├──────────┼──────────────────────────────────────┤
│ 💼 工作空间 │  (管理员) 成员、角色、计费         │
│          │  品牌资产库                            │
├──────────┼──────────────────────────────────────┤
│ ❓ 关于  │  版本、条款、反馈、开源许可           │
├──────────┴──────────────────────────────────────┤
│  ⚠️ Danger Zone（底部）                          │
│  退出所有设备 · 停用账号 · 转让工作空间           │
└─────────────────────────────────────────────────┘

交互模式：左侧 Tab + 右侧 Panel（≥ 768px）
          → 移动端 push 栈 + 一级分组展开（< 768px）
          → 高频入口：顶部 Drawer（主题 / 通知 / 导出）
```

---

## 参考来源

1. [Android 设置设计指南 - AOSP](https://source.android.com/docs/core/settings/settings-guidelines?hl=zh-cn)
2. [Material Design Settings Pattern](https://m1.material.io/patterns/settings.html)
3. [Gummble Settings Screen Design Examples](https://gummble.com/blog/settings-screen-design-examples)
4. [Setproduct Settings UI Design](https://www.setproduct.com/blog/settings-ui-design)
5. [SaaSUI Settings Page UX Patterns](https://www.saasui.design/blog/saas-settings-page-ux-patterns)
6. [Notion Help Center - Workspace Settings](https://www.notion.com/zh-cn/help/workspace-settings)
7. [Figma Help - Account Settings](https://help.figma.com/hc/en-us/articles/1500006061462)
8. [Discord Account Settings Guide 2025](https://www.discords.ai/wiki/discord-account-settings-guide)
9. [VS Code Docs - User and Workspace Settings](https://code.visualstudio.com/docs/configure/settings)
10. [飞书帮助中心 - 偏好设置](https://www.feishu.cn/hc/zh-CN/category)
11. [Bricx Labs - 8 Account Settings Design Examples](https://bricxlabs.com/blogs/account-settings-design-examples)
