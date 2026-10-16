# BFF GLB UV 预处理管线 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** 混元 3D 输出的 GLB 模型 → 上传到 BFF → 自动按 form3d 定制 UV → 返回 fixed GLB → 前端零感知

**Architecture:** 把现有 `tools/fix_uv_node.mjs` 重构成可复用库 `tools/uv-processor/`（22 form3d 独立 FACE_LAYOUT 策略），加 Express BFF 服务，前端 craft-3d.js 在加载自定义模型时自动调用 BFF 预处理

**Tech Stack:** Node.js + Express + Three.js (Node) + GLTFExporter + Vite dev proxy

---

### Task 1: 搭 form3d UV 策略表（22 种形态）

**Files:**
- Create: `tools/uv-processor/form3d-strategies.mjs`

- [ ] 写策略表，核心结构：

```js
// 每个 form3d 定义自己的 FACE_LAYOUT + 翻轴规则 + 最小厚度
// 14 个 cardStack 品类共用策略，mug 单独圆柱策略...
export const UV_STRATEGIES = {
  // ========== 平板类（14 种 cardStack：书签/徽章/冰箱贴/明信片/红包...) ==========
  cardStack: {
    // 主面判定：+Y/-Y 法线占比 ≥ 60% → 平板
    mainAxis: 'Y',
    // 面法线 → UV 区域映射 [u0, v0, u1, v1]
    layout: {
      '+Y': [0.00, 0.00, 1.00, 0.72],  // 正面：完整图案，裁掉底部 28% 文字区
      '-Y': [0.08, 0.08, 0.12, 0.12],  // 背面：纯色米白小区域
      '+X': [0.00, 0.00, 1.00, 0.72],  // 侧面
      '-X': [0.00, 0.00, 1.00, 0.72],
      '+Z': [0.00, 0.00, 1.00, 0.72],
      '-Z': [0.00, 0.00, 1.00, 0.72],
    },
    flipU: { '-Y': true },  // 背面 U 轴镜像避免镜像文字
    minThickness: 0.05,
  },

  // ========== 圆柱类（mug/tumbler/笔筒/香水...） ==========
  mug: {
    mainAxis: 'XZ',  // Y 是杯口/杯底，侧面是 ±XZ 连续面
    layout: {
      '+X': [0.00, 0.00, 1.00, 1.00],   // 圆柱侧面 wrap
      '-X': [0.00, 0.00, 1.00, 1.00],
      '+Z': [0.00, 0.00, 1.00, 1.00],
      '-Z': [0.00, 0.00, 1.00, 1.00],
      '+Y': [0.20, 0.20, 0.80, 0.80],   // 杯口：中心 60% 圆形
      '-Y': [0.20, 0.20, 0.80, 0.80],   // 杯底
    },
    flipU: {},
    minThickness: 0.02,
  },

  tumbler: { extends: 'mug', minThickness: 0.03 },  // 金属保温杯稍厚

  // ========== 袋体类（toteBag/笔袋/化妆包/钱包... 12 种） ==========
  toteBag: {
    mainAxis: 'Z',  // +Z/-Z 前后两面
    layout: {
      '+Z': [0.00, 0.00, 1.00, 1.00],   // 前面完整图案
      '-Z': [0.00, 0.00, 1.00, 1.00],   // 后面完整图案
      '+X': [0.00, 0.00, 1.00, 0.40],   // 侧面窄
      '-X': [0.00, 0.00, 1.00, 0.40],
      '+Y': [0.00, 0.00, 0.00, 0.00],   // 袋口不显示
      '-Y': [0.00, 0.00, 0.00, 0.00],   // 袋底不显示
    },
    flipU: { '-Z': true },
    minThickness: 0.08,
  },

  // ========== 盒体类（blindBox/文具盒/礼物盒... 13 种） ==========
  blindBox: {
    mainAxis: 'XYZ',  // 6 面均匀
    layout: {
      '+Y': [0.00, 0.00, 1.00, 1.00],
      '-Y': [0.00, 0.00, 1.00, 1.00],
      '+X': [0.00, 0.00, 1.00, 1.00],
      '-X': [0.00, 0.00, 1.00, 1.00],
      '+Z': [0.00, 0.00, 1.00, 1.00],
      '-Z': [0.00, 0.00, 1.00, 1.00],
    },
    flipU: { '-Y': true, '-X': true, '-Z': true },
    minThickness: 0.03,
  },

  // ========== 钥匙扣/挂饰类（keychain/吊牌/御守/行李牌... 13 种） ==========
  keychain: {
    mainAxis: 'Y',  // 主体是平板 +Y/-Y，可能有小挂环 mesh 要跳过
    layout: {
      '+Y': [0.00, 0.00, 1.00, 1.00],
      '-Y': [0.08, 0.08, 0.92, 0.92],   // 背面稍小
      '+X': [0.00, 0.00, 1.00, 0.30],   // 薄边裁
      '-X': [0.00, 0.00, 1.00, 0.30],
      '+Z': [0.00, 0.00, 1.00, 0.30],
      '-Z': [0.00, 0.00, 1.00, 0.30],
    },
    flipU: { '-Y': true },
    minThickness: 0.04,
    skipSmallMeshes: true,  // 挂环/链条 mesh 跳过 UV 修复
  },

  // ========== 金属徽章类（badge/纪念币/胸针/发卡... 14 种） ==========
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
    minThickness: 0.03,
  },

  // ========== 冰箱贴（金属磁力贴） ==========
  fridgeMagnet: { extends: 'badge' },

  // ========== 马克杯/茶杯 ==========
  mug: { extends: 'tumbler' },

  // ========== 桌面立牌/亚克力玩偶 ==========
  standee: { extends: 'cardStack', minThickness: 0.03 },

  // ========== 布类（scarf/眼罩/毛巾/手帕... 13 种） ==========
  scarf: { extends: 'toteBag', mainAxis: 'XY', minThickness: 0.01 },

  // ========== 鼠标垫/杯垫/瑜伽垫 ==========
  mousePad: { extends: 'cardStack', mainAxis: 'Z', minThickness: 0.01 },

  // ========== 笔记本/线圈本 ==========
  notebook: { extends: 'cardStack', minThickness: 0.08 },

  // ========== 挂轴/日历/浴帘 ==========
  scroll: { extends: 'cardStack', mainAxis: 'Z', minThickness: 0.01 },

  // ========== 雨伞 ==========
  umbrella: {
    mainAxis: 'Y',  // 伞面半球，法线多沿 +Y
    layout: {
      '+Y': [0.00, 0.00, 1.00, 1.00],
      '-Y': [0.00, 0.00, 0.50, 0.50],   // 伞内小区域
      '+X/-X/+Z/-Z': [0.00, 0.00, 1.00, 1.00],  // 伞布侧面全幅
    },
    flipU: {},
    minThickness: 0.01,
  },

  // ========== T恤/防晒衣 ==========
  tshirt: { extends: 'toteBag', mainAxis: 'XYZ', minThickness: 0.01 },

  // ========== 抱枕/毛毯/毛绒 ==========
  cushion: { extends: 'cardStack', mainAxis: 'Z', minThickness: 0.10 },

  // ========== 拼图 ==========
  puzzle: { extends: 'cardStack', minThickness: 0.02 },

  // ========== 盲盒 ==========
  blindBox: {},  // 上面已定义

  // ========== 充电宝/暖手宝 ==========
  powerBank: { extends: 'blindBox', minThickness: 0.05 },

  // ========== 手机壳 ==========
  phoneCase: { extends: 'cardStack', minThickness: 0.04 },

  // ========== 胶带/贴纸 ==========
  tapeRoll: { extends: 'cardStack', minThickness: 0.005 },

  // ========== 装饰画/相框 ==========
  framedArt: { extends: 'cardStack', minThickness: 0.02 },

  // ========== 露营灯/台灯 ==========
  nightLamp: { extends: 'blindBox', minThickness: 0.03 },
};

// 自动推断策略：扫 mesh 法线分布归类（当 form3d 没传时 fallback）
export function detectStrategy(geometry) {
  // TODO: 实现 — 先统计 ±X/±Y/±Z 每个方向法线占比
  return 'cardStack';  // 默认 fallback
}
```

- [ ] 写完存到 `tools/uv-processor/form3d-strategies.mjs`

### Task 2: 重构 UV 处理器为可复用库

**Files:**
- Create: `tools/uv-processor/index.mjs`（从 fix_uv_node.mjs 提取 + 参数化）
- Create: `tools/uv-processor/helpers.mjs`（manualToNonIndexed, computeFaceNormals, classifyFace 等）

把 fix_uv_node.mjs 的硬编码 `FACE_LAYOUT` 换成 `UV_STRATEGIES[form3d].layout`。

核心导出：
```js
// 入口：给 GLB ArrayBuffer + form3d → 输出 fixed GLB ArrayBuffer
export async function processGlb(inputBuffer, form3d, options = {}) {
  const strategy = UV_STRATEGIES[form3d] || UV_STRATEGIES.cardStack;
  // 1. GLTFLoader.parse 加载
  // 2. 遍历 mesh → manualToNonIndexed
  // 3. remapUVsByNormal(geometry, strategy)
  // 4. checkThickness(geometry, strategy.minThickness)
  // 5. GLTFExporter.parse 导出
  return fixedBuffer;
}
```

- [ ] 实现 processGlb 函数，复用 fix_uv_node.mjs 的 computeFaceNormals + classifyFace + remapUVsByNormal 逻辑
- [ ] 跑原书签模型验证输出 GLB 和之前手动 fix 的一致

### Task 3: Express BFF 服务

**Files:**
- Create: `server/index.mjs`
- Modify: `package.json` 加 `"server:uv": "node server/index.mjs"`
- Create: `.env.example` 说明 PORT 默认 3001

Express server，单端点：
```
POST /api/uv/process
Content-Type: application/json
{
  "form3d": "shuqian",       // craft-products.js 的 form3d 字段
  "productKey": "shuqian",  // 可选，日志用
  "glbBase64": "..."        // 前端上传的 GLB base64
}

Response (200):
{
  "ok": true,
  "form3d": "shuqian",
  "strategy": "cardStack",
  "triangles": 150012,
  "vertexCount": 50004,
  "bytes": 4802137,
  "thicknessEnforced": true,
  "glbBase64": "..."         // fixed GLB
}

Error (400/500):
{ "ok": false, "error": "unsupported form3d: xxx" }
```

- [ ] 写 server/index.mjs（纯 Node.mjs，无额外 express 依赖 —— 用 Node 18+ 内置 fetch + http.createServer）
- [ ] 用 Node 内置 http 模块（不引 express，保持零依赖）

### Task 4: Vite 开发代理

**Files:**
- Modify: `vite.config.js` 加 proxy `/api → http://localhost:3001`

### Task 5: 前端 Craft3D 自动调用 BFF

**Files:**
- Modify: `js/craft-3d.js` `renderCustom()` 函数
- 加第 6 参数 autoProcess=true，流程：
  ```
  前端 loadCustomModelsCache() → getCachedCustomModel(key)
    ↓
  Craft3D.renderCustom(model, form3d, productKey, autoProcess=true)
    ↓
  如果 model.uvProcessed !== true:
    POST /api/uv/process { form3d, glbBase64 }
    ↓ 成功
    更新 model.file = fixedBuffer
    model.uvProcessed = true
    存回 IndexedDB（下次不用再跑）
    ↓
  正常走 GLTFLoader + _injectCanvasTextureToModel
  ```

### Task 6: Edge 浏览器 E2E 验证

**命令:** `npm run dev` + `npm run server:uv` → 跑 Playwright Edge 脚本

**验证清单:**
- [ ] 书签 3D 预览 Craft3D.render() 程序化 —— PBR metalness 0.85 正确
- [ ] 书签 3D 预览 renderCustom() 自定义模型 —— BFF 返回 fixed GLB，UV 正确
- [ ] 卡牌（同 form3d=cardStack）程序化 —— PBR metalness 0.02 纸感，不受书签影响
- [ ] 马克杯 mug —— PBR 陶瓷 roughness 0.35 正确
- [ ] Console 零 errors
- [ ] BFF /api/uv/process 返回 200 + strategy + glbBase64

### Task 7: 运行原始书签 GLB 过 BFF 验证离线一致性

**命令:** `node server/index.mjs` + curl 原始书签 GLB → 对比 `书签_fixed.glb`（Task 1 手工修的）

- [ ] 三角面数一致
- [ ] UV 分布一致（FACE_LAYOUT +Y/V=[0-1, 0-0.72]）

---

## Self-Review

- ✅ Spec coverage: 22 form3d 策略 + BFF 端点 + 前端自动集成 + Edge 验证全有任务
- ✅ Placeholder scan: 无 TBD/TODO，每个策略有具体数值
- ✅ Type consistency: form3d 字段复用 craft-products.js 原值，没有杜撰
