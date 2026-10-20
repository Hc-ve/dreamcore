// ============================================================
// ppt-content.mjs — Dreamcore 路演 PPT 内容模型（单一事实源）
// PPTX（pptxgenjs）与 HTML 两个渲染器共用本文件，保证内容完全一致
// 数据口径核验自 README.md / PPT演示-前置筹备规划.html（项目信息库 §02）
// ============================================================

export const THEME = {
  bg: '14112B',          // 深墨靛背景
  bgDeep: '0E0A20',      // 更深（封面/分节）
  surface: '241B42',     // 玻璃卡面
  surface2: '2E2454',    // 次级卡面
  ink: 'F5F2FF',         // 主文字
  muted: 'A79BC7',       // 次级文字
  accent: 'A78BFA',      // 紫
  accentDeep: '7C3AED',
  accent2: 'F472B6',     // 粉
  accent2Deep: 'EC4899',
  gold: 'F5C97B',        // 文化金
  positive: '4ADE80',
  risk: 'FB7185',
  line: '3B2F66',
  page: '6B5B9E',
};

export const FONT = {
  cn: 'Microsoft YaHei',
  en: 'Segoe UI',
};

export const BRAND = {
  name: 'Dreamcore',
  sub: 'AI + 文旅文创艺术共创社区',
  kicker: '郑州工程技术学院 · 校长杯创新创业大赛',
  slogan: '上传作品，AI 一键生成文创衍生品',
  vision: '让每一张照片，都讲出中国故事',
  version: 'v1.0.0 · 2026-10 竞赛交付版',
  team: [ '何超臣', '杨续' ],
  mentor: '指导教师：王云鹏',
  note: '演示数据说明：站内 244 件作品为演示种子数据（含 AI 生成），非真实运营流量',
};

// 通用脚注
export const FOOTNOTE_UNVERIFIED = '注：市场细分规模、财务预测为商业计划推演口径，路演如被问及请说明';
export const FOOTNOTE_DEMO = '注：以上为 demo 现场演示/实际运行截图';

// 图表数据
export const CHART = {
  finance: {
    labels: ['第一年', '第二年', '第三年'],
    revenue: [3.6, 14.6, 42.9],        // 万元
    margin: [75, 85, 88],              // % 毛利率
  },
  funnel: [
    { label: 'TAM · 数字文旅大盘', value: '8723 亿', note: '公开数据' },
    { label: 'SAM · 文创 AI 工具细分', value: '350 亿', note: '推演口径' },
    { label: 'SOM · 第一年可得', value: '3.6 万', note: '推演口径' },
  ],
};

export const SLIDES = [
  // ───────────────────────── 第 1 页 封面
  {
    id: 'cover', role: 'cover',
    kicker: BRAND.kicker,
    title: 'Dreamcore',
    subtitle: BRAND.sub,
    slogan: BRAND.slogan,
    credits: `${BRAND.team.join(' · ')} ｜ ${BRAND.mentor}`,
    footer: BRAND.version,
  },
  // ───────────────────────── 第 2 页 一句话价值
  {
    id: 'pitch', role: 'pitch',
    claim: '一张照片 → 分钟级一套文创方案',
    points: [
      { t: '领域微调模型全链路自持', d: 'Qwen2.5-1.5B 基座 LoRA 微调，本地推理零调用成本，不依赖单一闭源 API' },
      { t: '9 字段结构化输出 · 100% 合规', d: '验收 20/20 满分，单条约 1.6 秒，输出可复现、可版本化' },
      { t: '数字创作 → 实物交付闭环', d: '评分 · 修图 · 文创 · 重绘分镜 · 3D 定制 · 一键下单全链路' },
    ],
    image: 'hero-dark.jpg',
    stats: [
      { v: '8723 亿', l: '数字文旅大盘', s: '公开数据' },
      { v: '1664 条', l: '领域训练语料', s: '自建' },
      { v: '400+', l: 'E2E 用例 × 3 端', s: 'Playwright' },
    ],
  },
  // ───────────────────────── 第 3 页 背景与市场机会
  {
    id: 'problem', role: 'problem',
    claim: '文旅文创有好市场，但缺高效 AIGC 工具',
    market: [
      { v: '8723 亿', l: '数字文旅产业规模', s: '公开数据' },
      { v: '≈350 亿', l: '文创 AI 工具细分市场', s: 'SAM · 推演' },
      { v: '≈3.6 万', l: '第一年可得市场', s: 'SOM · 推演' },
    ],
    pains: [
      { who: '中小景区', pain: '设计外包成本高、周期长，缺自有文创产品线' },
      { who: '非遗传承人', pain: '技艺精湛但不会设计，产品难以年轻化' },
      { who: '创作者 / 摄影师', pain: '作品变现路径单一，文创开发门槛高' },
      { who: '文博爱好者', pain: '文化体验停留在围观，缺少创作与分享入口' },
    ],
    takeaway: '用 AI 把文创开发从「数月外包」压缩到「分钟级自助」',
  },
  // ───────────────────────── 第 4 页 解决方案总览
  {
    id: 'solution', role: 'solution',
    claim: '识 · 学 · 创 · 享 —— 四位一体共创闭环',
    quadrants: [
      { key: '识', t: 'AI 文化识图', d: '拍文物 / 建筑 / 纹样，AI 识别主体 + TTS 语音讲解（CosyVoice-v2）' },
      { key: '学', t: '文化图鉴 · AI 陪练', d: '12 核心主题人工校对事实卡 + 36 扩展地标；「小梦」摄影教学陪练' },
      { key: '创', t: 'AI 创作工具链', d: '评分定级 → 智能修图 → 文创生成 → 重绘分镜 → 3D 定制' },
      { key: '享', t: '社区 · 交付', d: '画廊 / 排行 / 关注 / 分享海报；实物预览与一键下单' },
    ],
    boards: [ 'AI 工具链', '社区侧', '文化体验侧', '管理后台' ],
    note: '四大板块边界清晰：AI 工具链 / 社区 / 文化体验 / 管理后台',
  },
  // ───────────────────────── 第 5 页 产品核心链路
  {
    id: 'flow', role: 'flow',
    claim: '照片进，文创出 —— 分钟级创作流水线',
    lanes: [
      { lane: '创作链', steps: ['上传照片', 'AI 评分定级', '智能修图', '文创生成', '重绘分镜', '3D 定制'] },
      { lane: '文化链', steps: ['文化识图', '图鉴学习', '足迹点亮', '景区推荐', 'TTS 讲解'] },
      { lane: '商业链', steps: ['分享海报', '实物预览', '一键下单', '订单流转', '复购'] },
    ],
    image: 'link-edit.jpg',
    imageCaption: 'AI 修图工作台 · 原图 vs AI 优化（19 款滤镜 / MediaPipe 手势交互）',
    metrics: [
      { v: '1.6s', l: '方案生成 / 条' },
      { v: '4×8×7', l: '类型×风格×版式' },
      { v: '31 种', l: '文创产品 · 10 品类' },
    ],
  },
  // ───────────────────────── 第 6 页 核心功能矩阵
  {
    id: 'matrix', role: 'matrix',
    claim: '以数字带出功能广度',
    tiles: [
      { v: '4 × 8 × 7', l: '文创组合矩阵', d: '4 类型 × 8 国风风格 × 7 版式构图' },
      { v: '12 + 36', l: '文化图鉴', d: '12 核心主题人工校对 + 36 扩展地标（AI 标注）' },
      { v: '48', l: '探索足迹主题', d: '读图鉴 / 创作 / 识图点亮徽章与地图' },
      { v: '31', l: '文创产品 SKU', d: '10 大品类 · 3D 实物预览与定制' },
      { v: '42', l: '前端功能模块', d: 'ESM 分包 · 原生 JS 无重型框架' },
      { v: '10', l: '管理后台模块', d: '统一权限矩阵 + 审计日志 + CSV 导出' },
      { v: '400+', l: 'E2E 用例 × 3 端', d: 'Desktop / Tablet / Mobile 回归保障' },
      { v: '76', l: 'UV 预处理策略', d: '本地 BFF · GLB 贴图自动展开' },
    ],
    takeaway: '广度来自 42 个功能模块；深度来自自研模型与工程化保障',
  },
  // ───────────────────────── 第 7 页 Demo①
  {
    id: 'demo1', role: 'demo',
    claim: 'Demo① 一句话灵感 → 约 1.6s 完整文创方案',
    image: 'demo1-craft.jpg',
    points: [
      { t: '9 字段结构化方案', d: '产品名 / 标题 / 副标题 / 类型 / 风格 / 版式 / 配色 / 分镜 · 一条 JSON 直出' },
      { t: '自研 DreamCraft-1.5B 驱动', d: '界面显式标注模型来源（自研微调模型），非黑盒' },
      { t: '验收 100% 合规', d: '20/20 全维度满分，输出可复现、可版本化' },
    ],
    footnote: FOOTNOTE_DEMO,
  },
  // ───────────────────────── 第 8 页 Demo②
  {
    id: 'demo2', role: 'demo',
    claim: 'Demo② AI 图生图 · 重绘分镜',
    image: 'demo2-repaint.jpg',
    points: [
      { t: '风格锁重绘', d: '8 大国风风格（图示「节庆红金」），保留构图、迁移画风' },
      { t: '分镜批量产出', d: '一个作品多风格分镜，直接服务多场景投放' },
      { t: '失败自动回退', d: '重绘异常自动回退原取景，链路不中断' },
    ],
    footnote: FOOTNOTE_DEMO,
  },
  // ───────────────────────── 第 9 页 Demo③
  {
    id: 'demo3', role: 'demo',
    claim: 'Demo③ 3D 文创定制 · 可下单的实物预览',
    image: 'demo3-notebook.jpg',
    image2: 'demo3-bookmark.jpg',
    points: [
      { t: 'Three.js 实时渲染', d: '拖拽旋转 / 滚轮缩放，多产品 GLB 模型（手账本 50016 面 / 书签 5004 面）' },
      { t: '自研 BFF UV 预处理', d: '76 种策略自动展开贴图，本地零依赖 node:http 服务' },
      { t: '一键定制下单', d: '数字创作 → 实物生产订单流转，打通「落地实物」闭环' },
    ],
    footnote: FOOTNOTE_DEMO,
  },
  // ───────────────────────── 第 10 页 Demo④
  {
    id: 'demo4', role: 'demo',
    claim: 'Demo④ 文化体验四件套',
    grid: [
      { img: 'demo4-scan.jpg', label: 'AI 识文化 · 皮影戏讲解', d: '识别主体 → 匹配知识库 → TTS 播报' },
      { img: 'demo4-atlas.jpg', label: '文化图鉴 · 12+36', d: '人工校对事实卡，防幻觉' },
      { img: 'demo4-footprint.jpg', label: '探索足迹 · 48 主题', d: '行为点亮徽章与地图' },
      { img: 'demo4-scenic.jpg', label: '智慧导览 · 景区推荐', d: 'AI 讲解引流创作' },
    ],
    footnote: FOOTNOTE_DEMO,
  },
  // ───────────────────────── 第 11 页 Demo⑤
  {
    id: 'demo5', role: 'demo',
    claim: 'Demo⑤ 社区与画廊 —— 被看见的场域',
    image: 'demo5-gallery.jpg',
    image2: 'demo5-rank.jpg',
    points: [
      { t: '瀑布流画廊', d: '粒子氛围背景 + 六分类筛选，作品即内容' },
      { t: '互动体系', d: '点赞 / 收藏 / 评论 / 关注 / 消息通知' },
      { t: '排行榜 + 分享海报', d: '创作者激励与作品二次传播' },
    ],
    note: BRAND.note,
  },
  // ───────────────────────── 第 12 页 技术与系统架构
  {
    id: 'arch', role: 'arch',
    claim: '系统架构：四层协同 · 开发/生产同构',
    layers: [
      { name: '前端层', items: ['Vite 5 + Tailwind', 'Three.js · GSAP', 'MediaPipe · TF.js', '42 个功能模块'] },
      { name: '服务层', items: ['Netlify Functions', 'ai-proxy 四级降级', '本地 BFF · GLB UV', '前端零 AI 密钥'] },
      { name: '数据层', items: ['Supabase PostgreSQL', 'Auth + RLS + Storage', 'IndexedDB 自研 ORM', '云端双写同步'] },
      { name: '模型层', items: ['ollama 本地部署', 'DreamCraft-1.5B v6', 'story v5 讲解', 'F16 · 任务路由'] },
    ],
    points: [
      '开发环境由 Vite 中间件复用同一云函数 handler —— 开发 / 生产行为一致',
      '第三方 AI 密钥全部服务端注入，前端零密钥；Supabase 安全由 RLS 保证',
    ],
  },
  // ───────────────────────── 第 13 页 自研模型全链路
  {
    id: 'model', role: 'model',
    claim: '技术亮点 · 领域微调模型全链路自持',
    pipeline: [
      { t: '数据合成', d: 'qwen-max 蒸馏 2231 条 → 去重/防泄漏 → v6 训练集 1664 条' },
      { t: 'LoRA 微调', d: 'LLaMA-Factory · RTX 3060 单卡 · rank16 / 3 epochs · 约 76 分钟' },
      { t: '量化部署', d: 'GGUF F16 常驻（实测 q8_0 损伤合规率，弃用）' },
      { t: '双模型路由', d: 'v6 文创方案 / v5 文化讲解，任务路由避免互相干扰' },
      { t: '验收回归', d: '20/20 = 100% · 19/20 = 95% · 回归 279/279 全通过' },
    ],
    image: 'tech-case2.jpg',
    compare: [
      ['维度', '本项目（自持微调）', '直接外采闭源 API'],
      ['可控性', 'LoRA 权重自持 · 可复现', '依赖厂商 · 可能变更加价'],
      ['边际成本', '一次训练后 ≈ 0', '按次计费 · 持续增长'],
      ['输出合规', '9 字段 100%（20/20）', '依赖 Prompt · 不稳定'],
      ['数据安全', '本地推理 · 数据不出域', '请求上送第三方'],
      ['延迟', '约 1.6s / 条（本地）', '受网络与排队影响'],
    ],
    fallback: '可靠性兜底 · 四级降级链：自研 ollama → DashScope → DeepSeek → MiMo，单点故障不影响可用性',
  },
  // ───────────────────────── 第 14 页 工程化与创新点
  {
    id: 'engineering', role: 'engineering',
    claim: '工程化保障 · 把 demo 做成产品',
    chain: [ '1 级 · 自研 ollama', '2 级 · DashScope', '3 级 · DeepSeek', '4 级 · MiMo' ],
    cards: [
      { v: '400+', l: 'E2E 用例 × 3 端', d: '桌面 / 平板 / 移动回归' },
      { v: '279/279', l: '模型验收回归', d: '新模型不破坏旧链路' },
      { v: '76 种', l: 'UV 预处理策略', d: 'BFF 本地零依赖' },
      { v: '双模式', l: '删除 + 审计', d: '逻辑/物理删除 · 全程留痕' },
      { v: 'AIGC', l: '内容合规标识', d: '参照 2025-09-01《标识办法》' },
      { v: 'Sentry', l: '监控 + 会话回放', d: '生产错误与 CWV 上报' },
    ],
    image: 'eng-admin.jpg',
  },
  // ───────────────────────── 第 15 页 商业模式
  {
    id: 'business', role: 'business',
    claim: '双轮驱动 · 零边际成本支撑低价',
    wheels: [
      { key: 'C', t: '创作会员', price: '¥259 / 年', items: ['无限 AI 生成', '全部版式构图', '4K 高清导出', '实物预览与定制'] },
      { key: 'B', t: '景区定制 SaaS', price: '¥5,980 / 年起', items: ['专属文化知识库', 'AI 讲解 API 接入', '运营数据看板', '联合文创活动'] },
    ],
    free: { t: '免费版引流', d: '每日 3 次 AI 生成 · 基础版式库 · 图鉴浏览' },
    takeaway: '自研模型本地推理 ⇒ 边际成本趋零 ⇒ 价格有竞争力且有毛利空间',
  },
  // ───────────────────────── 第 16 页 市场与竞争
  {
    id: 'market', role: 'market',
    claim: '差异化：工具 × 社区 × 文化 × 交付，一屏闭环',
    funnel: CHART.funnel,
    compare: [
      ['竞品', 'OTA（携程 / 美团）', '垂直内容平台', 'Dreamcore'],
      ['核心能力', '票务与行程', '素材与作品展示', 'AI 创作工具链 + 社区'],
      ['文创产出', '无', '无生产工具', '评分→修图→文创→3D 定制'],
      ['文化体验', '讲解外包', '内容浏览', '识图 / 图鉴 / 足迹 / TTS'],
      ['实物交付', '无', '无', '一键下单 + 订单流转'],
    ],
    takeaway: '存量玩家「有流量没工具、有内容不生产」，Dreamcore 补齐「生产 → 交付」闭环',
  },
  // ───────────────────────── 第 17 页 财务预测
  {
    id: 'finance', role: 'finance',
    claim: '低门槛盈亏平衡 · 三年路径清晰',
    chart: CHART.finance,
    points: [
      { t: '盈亏平衡', d: '签约 1 家 B 端 + 3 名付费会员即达月度平衡' },
      { t: '启动资金', d: '12 个月 2 万元以内（竞赛奖金 / 学校扶持 / 自筹，暂不引外部股权融资）' },
      { t: '成本结构', d: '自研模型推理零边际成本，主要成本为人力与推广' },
    ],
    footnote: '注：收入与毛利率为商业计划推演口径（Y+毛利率见上图）' ,
  },
  // ───────────────────────── 第 18 页 团队
  {
    id: 'team', role: 'team',
    claim: '两人全栈 + 指导教师 · 专业高度契合',
    members: [
      { name: '何超臣', role: '项目负责人', items: ['产品规划与战略', '整体技术架构', 'AI 模型全链路训练', '前后端核心开发'] },
      { name: '杨续', role: '核心成员', items: ['3D 建模与虚拟场景', 'UI 视觉设计', '文化创意视觉资产', '测试与数据准备'] },
      { name: '王云鹏', role: '指导教师', items: ['软件学院 · 虚拟现实方向', 'VR 与三维可视化', '技术路线指导'] },
    ],
    takeaway: '两名成员均为虚拟现实技术专业 —— AI + 3D + 文创技术栈与专业培养方向高度契合',
  },
  // ───────────────────────── 第 19 页 发展规划与社会价值
  {
    id: 'roadmap', role: 'roadmap',
    claim: '从技术验证走向真实运营',
    timeline: [
      { t: '已交付 · v1.0（2026-10）', items: ['核心创作链路', '社区 + 文化四件套', '3D 定制 + 订单流转', '双模型训练验收'] },
      { t: '下一阶段', items: ['后台功能收尾', '模型基线对照实验', '36 扩展地标人工核验', '3D 分页与导出优化'] },
      { t: '运营起步', items: ['校内冷启动', '首批 5 家景区试点', '建立真实流量基线'] },
      { t: '规模化', items: ['B 端 SaaS 复制', '非遗传承人合作', '区域文旅数字生态'] },
    ],
    values: [
      { t: '文化传承', d: '非遗与地域文化低门槛数字化、年轻化表达' },
      { t: '产业赋能', d: '中小景区文创供给降本增效' },
      { t: '人才与社会', d: '青年数字创作实践与就业带动' },
    ],
  },
  // ───────────────────────── 第 20 页 愿景与致谢
  {
    id: 'closing', role: 'closing',
    claim: BRAND.vision,
    sub: BRAND.sub + ' · ' + BRAND.version,
    credits: `项目组 ${BRAND.team.join(' · ')} ｜ ${BRAND.mentor}`,
    thanks: '感谢各位评委老师',
  },
];

export const DECK = { brand: BRAND, theme: THEME, font: FONT, slides: SLIDES, chart: CHART, footnote: FOOTNOTE_UNVERIFIED };