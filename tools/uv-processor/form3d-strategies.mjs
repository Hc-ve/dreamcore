/**
 * tools/uv-processor/form3d-strategies.mjs
 *
 * 22 种 form3d 独立 UV 修复策略 —— 按品类形状自动适配
 * 数据源：craft-products.js 的 form3d 字段（22 种形态，100+ 产品）
 *
 * 每个策略定义：
 *   mainAxis     — 主面法线方向线索（Y/XY/XZ/XYZ），用于 fallback 自动推断
 *   layout       — 6 面法线方向 → UV 矩形 [u0, v0, u1, v1]
 *   flipU/flipV  — 哪些面 U/V 轴需要翻转（避免背面镜像）
 *   minThickness — Z 轴压缩下限（normalize 后）
 *   skipSmallMeshes — 是否跳过小 mesh（挂环/链条）
 *   extends      — 可选，继承另一个 form3d 的策略
 */

// 解析 extends 链，返回扁平化策略
function resolve(name, seen = new Set()) {
  if (seen.has(name)) throw new Error('cycle in UV_STRATEGIES extends: ' + name);
  seen.add(name);
  const raw = _RAW[name];
  if (!raw) throw new Error('unknown form3d: ' + name);
  const flat = { ...raw };
  if (raw.extends) {
    const parent = resolve(raw.extends, seen);
    // 子策略覆盖父策略的 layout 条目（浅合并）
    flat.layout = { ...parent.layout, ...(raw.layout || {}) };
    flat.flipU = { ...parent.flipU, ...(raw.flipU || {}) };
    flat.flipV = { ...parent.flipV, ...(raw.flipV || {}) };
    flat.minThickness = raw.minThickness ?? parent.minThickness;
    flat.mainAxis = raw.mainAxis || parent.mainAxis;
    flat.skipSmallMeshes = raw.skipSmallMeshes ?? parent.skipSmallMeshes;
  }
  return flat;
}

const _RAW = {
  // ========== 平板类（14 cardStack 品类：书签/徽章/冰箱贴/明信片/红包/便利贴/贺卡/信封/信纸/卡牌/扑克牌/种子纸/布贴/卡套） ==========
  cardStack: {
    mainAxis: 'Y',
    layout: {
      '+Y': [0.00, 0.00, 1.00, 0.72],
      '-Y': [0.08, 0.08, 0.12, 0.12],
      '+X': [0.00, 0.00, 1.00, 0.72],
      '-X': [0.00, 0.00, 1.00, 0.72],
      '+Z': [0.00, 0.00, 1.00, 0.72],
      '-Z': [0.00, 0.00, 1.00, 0.72],
    },
    flipU: { '-Y': true },
    flipV: {},
    minThickness: 0.05,
  },

  // ========== 圆柱类（mug / tumbler / 笔筒 / 香水 / 保温杯 / 玻璃杯 / 折叠杯 / 竹筒杯 / 搪瓷杯 / 茶具 / 瓷器） ==========
  mug: {
    mainAxis: 'XZ',
    cylindricalWrap: true,             // 圆柱用 atan2 参数化 → 外壁一圈连续 wrap
    layout: {
      '+X': [0.00, 0.00, 1.00, 1.00],   // 外壁前 → wrap 全幅
      '-X': [0.00, 0.00, 1.00, 1.00],   // 外壁后 → wrap 全幅
      '+Z': [0.00, 0.00, 1.00, 1.00],   // 外壁右 → wrap 全幅
      '-Z': [0.00, 0.00, 1.00, 1.00],   // 外壁左 → wrap 全幅
      '+Y': [0.00, 0.00, 0.00, 0.00],   // 杯口内外沿 → 零面积 → sentinel UV → canvas 右上角米白
      '-Y': [0.00, 0.00, 0.00, 0.00],   // 杯底内外 → 零面积 → sentinel UV → canvas 右上角米白
    },
    flipU: {},
    flipV: {},
    minThickness: 0.02,
  },

  tumbler: { extends: 'mug', minThickness: 0.03 },

  // ========== 袋体类（toteBag / 笔袋 / 化妆包 / 运动包 / 钱包 / 包包 / 腰包 ... 12 种） ==========
  toteBag: {
    mainAxis: 'Z',
    layout: {
      '+Z': [0.00, 0.00, 1.00, 1.00],
      '-Z': [0.00, 0.00, 1.00, 1.00],
      '+X': [0.00, 0.00, 1.00, 0.40],
      '-X': [0.00, 0.00, 1.00, 0.40],
      '+Y': [0.00, 0.00, 0.00, 0.00],
      '-Y': [0.00, 0.00, 0.00, 0.00],
    },
    flipU: { '-Z': true },
    flipV: {},
    minThickness: 0.08,
  },

  // ========== 盒体类（blindBox / 文具盒 / 礼物盒 / 收纳盒 / 便当盒 ... 13 种） ==========
  blindBox: {
    mainAxis: 'XYZ',
    layout: {
      '+Y': [0.00, 0.00, 1.00, 1.00],
      '-Y': [0.00, 0.00, 1.00, 1.00],
      '+X': [0.00, 0.00, 1.00, 1.00],
      '-X': [0.00, 0.00, 1.00, 1.00],
      '+Z': [0.00, 0.00, 1.00, 1.00],
      '-Z': [0.00, 0.00, 1.00, 1.00],
    },
    flipU: { '-Y': true, '-X': true, '-Z': true },
    flipV: {},
    minThickness: 0.03,
  },

  // ========== 钥匙扣/挂饰类（keychain / 吊牌 / 御守 / 行李牌 / 车挂 ... 13 种） ==========
  keychain: {
    mainAxis: 'Y',
    layout: {
      '+Y': [0.00, 0.00, 1.00, 1.00],
      '-Y': [0.08, 0.08, 0.92, 0.92],
      '+X': [0.00, 0.00, 1.00, 0.30],
      '-X': [0.00, 0.00, 1.00, 0.30],
      '+Z': [0.00, 0.00, 1.00, 0.30],
      '-Z': [0.00, 0.00, 1.00, 0.30],
    },
    flipU: { '-Y': true },
    flipV: {},
    minThickness: 0.04,
    skipSmallMeshes: true,
  },

  // ========== 金属徽章类（badge / 纪念币 / 胸针 / 发卡 / 发箍 ... 14 种） ==========
  badge: {
    mainAxis: 'Y',
    layout: {
      '+Y': [0.00, 0.00, 1.00, 1.00],
      '-Y': [0.00, 0.00, 1.00, 1.00],
      '+X': [0.00, 0.00, 1.00, 0.25],
      '-X': [0.00, 0.00, 1.00, 0.25],
      '+Z': [0.00, 0.00, 1.00, 0.25],
      '-Z': [0.00, 0.00, 1.00, 0.25],
    },
    flipU: { '-Y': true },
    flipV: {},
    minThickness: 0.03,
  },

  // ========== 冰箱贴 ==========
  // 独立策略（不再继承 badge）：徽章背面要别针设计→全幅 CanvasTexture；
  // 冰箱贴背面 = 金属背板 + 圆形软磁铁 → 零面积 → sentinel → paperMat 米白背板
  fridgeMagnet: {
    mainAxis: 'Y',
    layout: {
      '+Y': [0.00, 0.00, 1.00, 0.75],   // 正面 → 上 75%（主图，裁掉底部大段文字）
      '-Y': [0.00, 0.00, 0.00, 0.00],   // 背面 → 零面积 → sentinel
      '+X': [0.00, 0.00, 0.00, 0.00],   // 侧面 → 零面积
      '-X': [0.00, 0.00, 0.00, 0.00],
      '+Z': [0.00, 0.00, 0.00, 0.00],
      '-Z': [0.00, 0.00, 0.00, 0.00],
    },
    flipU: {},
    flipV: {},
    minThickness: 0.02,
    appendMagnet: true,
  },

  // ========== 马克杯/茶杯 ==========
  mugAlias: { extends: 'mug' },  // 马克杯/搪瓷杯/竹筒杯/茶具/瓷器 都走 mug

  // ========== 桌面立牌/亚克力玩偶 ==========
  standee: { extends: 'cardStack', minThickness: 0.03 },

  // ========== 布类（scarf / 眼罩 / 毛巾 / 手帕 / 发带 / 护膝 ... 13 种） ==========
  scarf: { extends: 'toteBag', mainAxis: 'XY', minThickness: 0.01 },

  // ========== 鼠标垫/杯垫/瑜伽垫 ==========
  mousePad: { extends: 'cardStack', mainAxis: 'Z', minThickness: 0.01 },

  // ========== 笔记本 ==========
  // ========== 笔记本/手账本（独立三段式布局：封面/书脊/背面各占 CanvasTexture 不同区域） ==========
  // CanvasTexture 画布规划（纵向三段）：
  //   V 0.00 ──────────── 封面完整设计区（55%）
  //   V 0.55 ──────────── 分隔线
  //   V 0.55─0.60        书脊专用窄条（5%，可以是纯色或竖排书名）
  //   V 0.60 ──────────── 分隔线
  //   V 0.60 ──────────── 背面简化设计区（40%，纯色+品牌小logo+slogan）
  notebook: {
    mainAxis: 'Y',
    layout: {
      '+Y': [0.00, 0.00, 1.00, 0.55],   // 封面 → CanvasTexture 上 55%（完整主设计）
      '-Y': [0.05, 0.60, 0.95, 1.00],   // 背面 → CanvasTexture 下 40%（简化版：纯色+logo+slogan）
      '+X': [0.45, 0.55, 0.55, 0.60],   // 书脊 → CanvasTexture 中间窄条 5%（纯色或书名竖排）
      '-X': [0.00, 0.00, 0.00, 0.00],   // 裁切线侧：空 → 米白纸边
      '+Z': [0.00, 0.00, 0.00, 0.00],   // 书顶：空 → 米白纸边
      '-Z': [0.00, 0.00, 0.00, 0.00],   // 书底：空 → 米白纸边
    },
    flipU: { '-Y': true, '+X': true },  // 背面 U 轴镜像（背面是反向看），书脊 U 轴镜像（书名方向正确）
    flipV: {},
    minThickness: 0.12,
  },

  // ========== 挂轴/日历/浴帘 ==========
  // ========== 台历/日历（独立，不继承 scroll 挂轴） ==========
  // 典型台立月历结构：正面完整当月+主题图，背面纯色+品牌小tag，
  // 侧面 ±X 和底部 -Z 是纸边米白色（零面积 UV → mesh 原色），
  // 顶部 +Z 是装订线圈区（窄条）。
  deskCalendar: {
    mainAxis: 'Y',
    layout: {
      '+Y': [0.00, 0.00, 1.00, 1.00],   // 正面 → CanvasTexture 全幅（当月日历+主题图）
      '-Y': [0.05, 0.90, 0.95, 1.00],   // 背面 → CanvasTexture 底部 10%（纯色+品牌小tag）
      '+X': [0.00, 0.00, 0.00, 0.00],   // 左侧面 → 零面积（纸边原色米白）
      '-X': [0.00, 0.00, 0.00, 0.00],   // 右侧面 → 零面积
      '+Z': [0.40, 0.00, 0.60, 1.00],   // 顶部装订条 → Canvas 中间 20% 竖条（线圈/装订区）
      '-Z': [0.00, 0.00, 0.00, 0.00],   // 底部纸边 → 零面积
    },
    flipU: {},   // deskCalendar 背面 Canvas 底部 10% 是专门设计的，不需要翻 U 轴
    flipV: {},
    minThickness: 0.10,   // A5 台历 13 页 normalize 后约 10%
  },

  // 产品 key 别名 → deskCalendar 独立策略
  rili: { extends: 'deskCalendar' },

  scroll: { extends: 'cardStack', mainAxis: 'Z', minThickness: 0.01 },

  // ========== 雨伞 ==========
  umbrella: {
    mainAxis: 'Y',
    layout: {
      '+Y': [0.00, 0.00, 1.00, 1.00],
      '-Y': [0.00, 0.00, 0.50, 0.50],
      '+X': [0.00, 0.00, 1.00, 1.00],
      '-X': [0.00, 0.00, 1.00, 1.00],
      '+Z': [0.00, 0.00, 1.00, 1.00],
      '-Z': [0.00, 0.00, 1.00, 1.00],
    },
    flipU: {},
    flipV: {},
    minThickness: 0.01,
  },

  // ========== T恤/防晒衣 ==========
  tshirt: { extends: 'toteBag', mainAxis: 'XYZ', minThickness: 0.01 },

  // ========== 抱枕/毛毯/毛绒 ==========
  cushion: { extends: 'cardStack', mainAxis: 'Z', minThickness: 0.10 },

  // ========== 充电宝/暖手宝/耳机盒 ==========
  powerBank: { extends: 'blindBox', minThickness: 0.05 },

  // ========== 手机壳 ==========
  phoneCase: { extends: 'cardStack', minThickness: 0.04 },

  // ========== 胶带/贴纸 ==========
  tapeRoll: { extends: 'cardStack', minThickness: 0.005 },

  // ========== 装饰画/相框 ==========
  // framedArt 正面法线可能在 +Y（台立相框）或 +Z（挂墙相框）
  // → +Y/+Z 正面全幅；-Y/-Z 背面画框背板 → 零面积 → paperMat 米白
  framedArt: {
    mainAxis: 'Z',
    layout: {
      '+Y': [0.00, 0.00, 1.00, 1.00],   // 正面1 → 全幅（台立相框 Y 朝人）
      '-Y': [0.00, 0.00, 0.00, 0.00],   // 背面1 → 零面积 → paperMat 米白背板
      '+Z': [0.00, 0.00, 1.00, 1.00],   // 正面2 → 全幅（挂墙相框 Z 朝人）
      '-Z': [0.00, 0.00, 0.00, 0.00],   // 背面2 → 零面积 → paperMat 米白背板
      '+X': [0.00, 0.00, 0.00, 0.00],   // 左侧面 → 画框窄边
      '-X': [0.00, 0.00, 0.00, 0.00],   // 右侧面 → 画框窄边
    },
    flipU: {},
    flipV: {},
    minThickness: 0.02,
  },

  // ========== 露营灯/台灯 ==========
  nightLamp: { extends: 'blindBox', minThickness: 0.03 },

  // ========== 拼图 ==========
  puzzle: { extends: 'cardStack', minThickness: 0.02 },

  // ========== 产品 key 别名层（craft-products.js 里的 product.key 映射） ==========
  shuqian:       { extends: 'cardStack' },  // 书签
  bookmark:      { extends: 'cardStack' },
  kapai:         { extends: 'cardStack' },  // 卡牌
  piaofu:        { extends: 'cardStack' },  // 票根
  fengxin:       { extends: 'cardStack' },  // 信封
  xinyongka:     { extends: 'cardStack' },  // 信用卡
  yinhangka:     { extends: 'cardStack' },  // 银行卡
  hongbao:       { extends: 'cardStack' },  // 红包
  helipai:       { extends: 'cardStack' },  // 贺年卡
  mingxinpian:   { extends: 'cardStack' },  // 明信片
  bianliTie:     { extends: 'cardStack' },  // 便利贴
  fengmian:      { extends: 'cardStack' },  // 封面
  kaitou:        { extends: 'cardStack' },  // 抬头
  beizhu:        { extends: 'cardStack' },  // 备注
  shuomingshu:   { extends: 'cardStack' },  // 说明书

  yaoshikou:     { extends: 'keychain' },   // 钥匙扣
  diaopai:       { extends: 'keychain' },   // 吊牌
  xinglijipai:   { extends: 'keychain' },   // 行李牌
  chegua:        { extends: 'keychain' },   // 车挂
  muzhi:         { extends: 'keychain' },   // 拇指（挂饰）
  yushou:        { extends: 'keychain' },   // 御守

  xiongzhang:    { extends: 'badge' },      // 胸章
  jinianbi:      { extends: 'badge' },      // 纪念币
  faqia:         { extends: 'badge' },      // 发卡
  fahuang:       { extends: 'badge' },      // 发箍

  beizi:         { extends: 'mug' },        // 杯子
  shuitong:      { extends: 'mug' },        // 水桶杯
  wenjuhe:       { extends: 'blindBox' },   // 文具盒
  lihe:          { extends: 'blindBox' },   // 礼盒
  nabaohe:       { extends: 'blindBox' },   // 拿包盒

  fanbudai:      { extends: 'toteBag' },    // 帆布袋
  qianbao:       { extends: 'toteBag' },    // 钱包
  wenzi:         { extends: 'toteBag' },    // 蚊字（腰包？）

  bingxiangtie:  { extends: 'fridgeMagnet' }, // 冰箱贴
  tushu:         { extends: 'mousePad' },    // 鼠标垫
  beidian:       { extends: 'mousePad' },    // 杯垫
  yujiaodian:    { extends: 'mousePad' },    // 瑜伽垫
  bijiben:       { extends: 'notebook' },    // 笔记本
  yanbu:         { extends: 'scarf' },       // 眼罩
  maojin:        { extends: 'scarf' },       // 毛巾
  shoupa:        { extends: 'scarf' },       // 手帕
  yusan:         { extends: 'umbrella' },     // 雨伞
  tuxu:          { extends: 'tshirt' },       // T恤
  baozhen:       { extends: 'cushion' },     // 抱枕
  yunongdian:    { extends: 'powerBank' },   // 充电宝
  shoujike:      { extends: 'phoneCase' },    // 手机壳
  jiaoshui:      { extends: 'tapeRoll' },    // 胶带
  tuzhi:         { extends: 'framedArt' },   // 图纸（装饰画）
  luxingdeng:    { extends: 'nightLamp' },   // 露营灯
  pinyin:        { extends: 'puzzle' },       // 拼图

  // 其他 —— fallback 到 cardStack（平板形状最通用）
  default:       { extends: 'cardStack' },
};

/** 按法线分布 fallback 推断策略（当 form3d 没传时用） */
export function detectStrategy(normalBuckets) {
  // normalBuckets = { '+X': n, '-X': n, '+Y': n, '-Y': n, '+Z': n, '-Z': n }
  const total = Object.values(normalBuckets).reduce((a, b) => a + b, 0) || 1;
  const ratios = {};
  for (const k of Object.keys(normalBuckets)) ratios[k] = normalBuckets[k] / total;

  const yDominant = (ratios['+Y'] || 0) + (ratios['-Y'] || 0) > 0.55;
  const evenXYZ = Math.abs(ratios['+X'] - ratios['-X']) < 0.15 &&
                  Math.abs(ratios['+Y'] - ratios['-Y']) < 0.15 &&
                  Math.abs(ratios['+Z'] - ratios['-Z']) < 0.15 &&
                  ratios['+X'] > 0.15 && ratios['+Y'] > 0.15 && ratios['+Z'] > 0.15;

  if (evenXYZ) return 'blindBox';      // 盒体
  if (yDominant) return 'cardStack';   // 平板/徽章
  return 'toteBag';                    // 袋体/圆柱 fallback
}

export const UV_STRATEGIES = new Proxy(_RAW, {
  get(target, prop) {
    if (!(prop in target)) return undefined;
    try { return resolve(prop); } catch { return target[prop]; }
  },
});

export const VALID_FORM3DS = Object.keys(_RAW);

// 策略表版本号 —— 每次策略表有结构性变化（layout 改、新策略、magnet/paperMat 等）+1
// 前端 craft-3d.js 会比较这个版本号和缓存里的 _bffVersion，不一致则强制重新处理
export const STRATEGIES_VERSION = 13;  // v13: BFF 拆分 sentinel mesh + paperMat 注入，前端 _injectCanvasTextureToModel 按 UV range 分材质

export function hasStrategy(form3d) {
  return form3d in _RAW;
}
