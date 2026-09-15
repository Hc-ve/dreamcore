# AI+摄影文旅文创 改进实施方案

> 基于 Dreamcore 数字艺术社交平台 改造为 "AI+交叉融合实践赛道" 参赛项目
> 文档版本：v1.0 | 编制日期：2026-09-15 | 编制：老大专属AI副驾

---

## 一、项目概述

### 1.1 项目背景

**赛事**：郑州工程技术学院"校长杯"大学生"人工智能+"创新创业大赛
**赛道**："AI+"交叉融合实践赛道（侧重 AI+文旅文创 跨学科融合）
**阶段**：学院初赛截止 2026-10-30 → 校级复赛 11月中旬 → 终审决赛 12月中旬
**参赛方向**：AI+摄影文旅文创（AI辅助摄影实时构图 + AI后期修图）

### 1.2 项目定位（工具+社区闭环）

**原定位**：Dreamcore 数字艺术社交平台 — 浏览/发布/收藏梦幻艺术作品
**新定位**：**AI赋能文旅摄影创作的全流程工具+社区平台**

核心闭环：
```
取景（WebRTC相机） → AI实时构图引导 → AI后期修图 → 发布到画廊社区 → 文创衍生
```

**叙事话术（路演用）**：
> "我们用 AI 重新定义文旅摄影的创作流程。从取景构图到后期修图，AI全程辅助；拍完即发，社区共鸣。让每一个旅行者都能拍出专业级文旅大片。"

### 1.3 目标用户

| 用户角色 | 痛点 | 我们提供 |
|---|---|---|
| 文旅爱好者 | 不会构图、拍不出大片感 | AI实时构图引导，三分法/黄金分割自动识别 |
| 摄影初学者 | 后期修图门槛高 | TensorFlow.js 一键增强/风格迁移 |
| 文旅内容创作者 | 缺少发布+变现平台 | 画廊社区+文创衍生入口 |
| 高校师生（评委） | 看重产教融合/AI教学价值 | 完整工程实现+教学辅助叙事 |

---

## 二、技术架构

### 2.1 技术栈总览

| 层级 | 技术 | 用途 | 状态 |
|---|---|---|---|
| 构建层 | Vite 5 + ES Modules | 工程化、热更新、打包 | 已有 |
| 样式层 | 原生CSS+CSS变量（旧模块） + **Tailwind CSS**（新模块） | 混合策略 | 已有+新增 |
| 视觉层 | Three.js + GSAP | 3D粒子、文旅氛围 | 已有 |
| **相机交互层** | **WebRTC getUserMedia API** | 实时取景、设备切换 | **新建** |
| **AI识别层** | **MediaPipe Hands/Pose** | 主体识别、手势交互 | **新建（可复用gesture-pixel经验）** |
| **AI推理层** | **TensorFlow.js** | 图像增强、风格迁移、超分 | **新建** |
| **图像处理层** | **Canvas API** | 像素操作、滤镜、局部调整 | **新建** |
| **构图算法层** | **纯JS算法** | 三分法/黄金分割/对角线/引导线 | **新建** |
| AI对话层 | MiMo API + Edge TTS | 摄影教练助手 | 已有（改造） |
| 数据层 | IndexedDB + artworks.js | 作品存储、用户数据 | 已有 |
| 部署层 | Netlify + Vercel | 在线演示 | 已有 |
| 测试层 | Playwright | 自动化测试 | 已有 |
| 监控层 | Sentry + Web Vitals | 错误监控、性能埋点 | 已有 |

### 2.2 整体架构图

```
┌─────────────────────────────────────────────────────────────┐
│  用户层 (Browser)                                            │
│  ├─ 文旅摄影工坊（新入口）                                    │
│  │   ├─ 相机取景                                              │
│  │   ├─ AI构图引导 overlay                                    │
│  │   └─ AI后期修图工作台                                      │
│  ├─ 数字艺术画廊（保留）                                       │
│  ├─ AI教练"小梦"（改造）                                      │
│  └─ 社区互动（点赞/收藏/评论/分享）                            │
└─────────────────────────────────────────────────────────────┘
                            ↕
┌─────────────────────────────────────────────────────────────┐
│  应用层 (Vite + Vanilla JS + ES Modules)                     │
│  ├─ js/camera/        相机交互模块（新）                       │
│  ├─ js/composition/   AI构图算法模块（新）                     │
│  ├─ js/photo-edit/    AI修图模块（新）                        │
│  ├─ js/gallery.js     画廊模块（保留增强）                    │
│  ├─ js/ai-assistant.js AI助手（改造为摄影教练）                │
│  ├─ js/particles.js   3D粒子（保留）                          │
│  ├─ js/router.js      路由（新增摄影相关路由）                 │
│  └─ ...其他保留模块                                           │
└─────────────────────────────────────────────────────────────┘
                            ↕
┌─────────────────────────────────────────────────────────────┐
│  AI能力层                                                     │
│  ├─ MediaPipe Hands   手势/主体识别                           │
│  ├─ TensorFlow.js    图像增强/风格迁移/超分                    │
│  ├─ MiMo API          对话式摄影指导                          │
│  └─ Edge TTS          语音教练                                │
└─────────────────────────────────────────────────────────────┘
                            ↕
┌─────────────────────────────────────────────────────────────┐
│  后端层 (Node.js + Express)                                   │
│  ├─ Edge TTS 服务（已有）                                     │
│  └─ 可选：图像处理代理（如需服务器算力）                       │
└─────────────────────────────────────────────────────────────┘
```

### 2.3 新增路由

| 路由 | 页面 | 说明 |
|---|---|---|
| `#/studio` | 摄影工坊 | 相机取景+构图引导主页 |
| `#/edit` | 修图工作台 | AI后期修图界面 |
| `#/gallery` | 画廊（保留） | 作品展示 |
| `#/artwork-{id}` | 作品详情（保留） | 含拍摄参数/构图分析 |
| `#/profile` | 个人主页（保留） | 我的作品+拍摄记录 |
| `#/coach` | AI教练 | 小梦摄影指导对话 |

---

## 三、新增功能模块详细设计

### 3.1 模块A：相机交互层（WebRTC）

**目标**：实现浏览器内实时取景，支持前后摄像头切换、分辨率自适应、权限降级处理。

**文件结构**：
```
js/camera/
├── camera-manager.js     # 相机管理器（核心）
├── camera-permission.js  # 权限处理+降级
├── camera-preview.js     # 取景预览渲染
└── camera-capture.js     # 拍照捕获
```

**核心API**：
```javascript
class CameraManager {
  async start(constraints = { video: { facingMode: 'environment' } }) { ... }
  async switchCamera() { ... }       // 前后切换
  captureFrame() { return canvas; } // 拍照
  stop() { ... }
}
```

**权限降级策略**：
1. 首次请求权限
2. 若用户拒绝 → 显示"请允许相机权限"引导，提供"上传图片"替代入口
3. 若设备无相机 → 直接走上传图片流程
4. iOS Safari 需 `playsinline` 属性（已有）

**风险点**：
- HTTP环境无法用 getUserMedia（需HTTPS或localhost）
- 解决：Netlify/Vercel 已自动 HTTPS；本地用 localhost 开发
- 部分安卓浏览器对 `facingMode: 'environment'` 支持不一致 → 加 try-catch fallback

### 3.2 模块B：AI实时构图引导

**目标**：基于 MediaPipe 识别画面主体（人脸/人体/手势），叠加构图参考线，实时评分与建议。

**文件结构**：
```
js/composition/
├── composition-rules.js   # 构图规则库（三分法/黄金分割/对角线/引导线/对称）
├── composition-overlay.js # Canvas参考线叠加层
├── composition-scoring.js  # 实时评分算法
├── composition-advisor.js  # 文字建议生成（联动小梦）
└── subject-detector.js    # MediaPipe主体识别封装
```

**构图规则库设计**：
```javascript
const COMPOSITION_RULES = {
  ruleOfThirds: { name: '三分法', check: (subjects, frame) => {...} },
  goldenRatio: { name: '黄金分割', check: (subjects, frame) => {...} },
  diagonal: { name: '对角线', check: (subjects, frame) => {...} },
  leadingLines: { name: '引导线', check: (edges, frame) => {...} },
  symmetry: { name: '对称', check: (subjects, frame) => {...} },
  framing: { name: '框架构图', check: (edges, frame) => {...} }
};
```

**实时评分流程**：
```
视频帧 → MediaPipe识别主体 → 套用构图规则 → 计算匹配度分数 → 叠加参考线 → 语音/文字建议
```

**MediaPipe复用策略**：
- 当前 `gesture-pixel/` 已有 MediaPipe Hands 集成经验
- 复用其 CDN 版本锁定策略（0.4.1675469240）和初始化代码
- 新增 Pose 模型用于人体主体识别（文旅人像场景）

**评分算法（纯JS）**：
- 主体位置 vs 构图兴趣点（三分线交点/黄金螺旋点）距离 → 位置分
- 主体大小占画面比例（0.3-0.6 为佳） → 大小分
- 画面水平线检测（地平线是否倾斜） → 平衡分
- 综合加权 → 0-100 分实时显示

### 3.3 模块C：AI后期修图

**目标**：基于 TensorFlow.js + Canvas API 实现浏览器内图像增强、风格迁移、局部调整。

**文件结构**：
```
js/photo-edit/
├── edit-manager.js      # 修图主管理器
├── enhance.js           # 图像增强（亮度/对比度/饱和度/锐化）
├── style-transfer.js    # 风格迁移（TF.js模型）
├── super-resolution.js  # 超分辨率（TF.js模型）
├── local-adjust.js      # 局部调整（选区+蒙版）
├── filter-presets.js    # 文旅预设滤镜（河南地标/古风/赛博等）
└── export.js            # 导出（JPEG/WebP/PNG）
```

**TensorFlow.js 模型选型**：
| 功能 | 模型 | 大小 | 来源 |
|---|---|---|---|
| 风格迁移 | Fast Neural Style Transfer | ~10MB | tfhub.dev（需离线化） |
| 图像增强 | DSLR画质增强 | ~5MB | 开源社区模型 |
| 超分辨率 | ESRGAN-tfjs | ~15MB | GitHub开源 |
| 人体分割 | BodyPix | ~5MB | @tensorflow-models/body-pix |

**性能策略**：
- WebGL backend 优先（自动启用GPU加速）
- 模型懒加载（用户点击功能时才下载）
- 大图分块处理（>4K图分块超分再拼回）
- 进度条+Web Worker避免阻塞UI

**文旅预设滤镜（差异化亮点）**：
- "中原暮色" — 河南地标暖色调
- "嵩山云海" — 山景雾化增强
- "洛阳牡丹" — 花卉色彩饱和
- "汴京夜话" — 夜景降噪+灯光强化
- "黄河故道" — 黄褐色调怀旧
- "赛博郑州" — 霓虹风格迁移

### 3.4 模块D：AI教练"小梦"改造

**现有能力**：MiMo API对话 + Edge TTS语音 + IndexedDB记忆 + 空闲动画
**改造方向**：

```javascript
// 新增摄影教练能力
const COACH_PROMPTS = {
  composition: "分析当前取景画面，给出构图建议",
  lighting: "评估当前光线条件，推荐拍摄参数",
  scene: "识别文旅场景（地标/自然/人像），推荐拍摄方案",
  postprocess: "根据作品风格推荐修图预设",
  history: "记录用户拍摄习惯，个性化指导"
};
```

**新增功能**：
- 拍摄前：场景识别 → 推荐构图方案
- 拍摄中：实时语音指导（"往左走半步""主体偏下，上移"）
- 拍摄后：分析照片缺陷 → 推荐修图方案
- 长期记忆：用户偏好风格、常去地点、技术短板

**复用**：现有 ai-assistant.js 的对话框架、TTS管道、记忆系统全部保留，仅扩展 prompt 和工具调用。

---

## 四、现有模块改造方案

### 4.1 画廊模块（gallery.js）增强

- 新增"拍摄参数"字段展示（构图规则/拍摄地点/AI评分）
- 新增"同款构图"推荐（点击作品 → 显示同构图作品集）
- 新增"文创衍生"入口（作品 → 生成明信片/壁纸/头像模板）

### 4.2 路由模块（router.js）扩展

```javascript
// 新增路由
const ROUTES = {
  '#/studio': () => loadStudioModule(),
  '#/edit': (params) => loadEditModule(params.imageId),
  '#/coach': () => loadCoachModule(),
  // 保留原路由
  '#/gallery': ...,
  '#/artwork-{id}': ...,
  '#/profile': ...,
  '#/search': ...,
  '#/admin': ...
};
```

### 4.3 发布流程（publish.js）改造

**原流程**：上传图片 → 填信息 → 发布
**新流程**：拍摄/上传 → AI构图优化 → AI修图 → 填信息（AI辅助生成标题/描述） → 发布

### 4.4 数据结构扩展（data/artworks.js）

```javascript
// 作品数据新增字段
{
  id: 221,
  title: "嵩山日出",
  // ... 原有字段
  captureInfo: {                    // 新增：拍摄信息
    camera: 'webcam',
    resolution: '1920x1080',
    location: '河南·嵩山',
    timestamp: '2026-10-15 06:30'
  },
  compositionInfo: {                // 新增：构图分析
    rule: '三分法',
    score: 87,
    subjects: ['日出', '山脊线'],
    advice: '地平线略低，可上移强化天空'
  },
  editInfo: {                       // 新增：修图信息
    preset: '中原暮色',
    adjustments: ['亮度+10', '饱和度+15', '锐化中等'],
    aiEnhanced: true
  }
}
```

---

## 五、技术栈混合策略（Tailwind + 原生CSS）

### 5.1 策略原则

- **旧模块（gallery/profile/admin等）**：保留原生CSS+CSS变量，零迁移
- **新模块（studio/edit/coach）**：用 Tailwind CSS 工具类快速搭建
- **主题色统一**：Tailwind 配置 extends 映射到现有 CSS 变量

### 5.2 Tailwind 接入步骤

1. `npm install -D tailwindcss postcss autoprefixer`
2. 创建 `tailwind.config.js`：
```javascript
export default {
  content: ['./index.html', './js/camera/**/*', './js/composition/**/*', './js/photo-edit/**/*'],
  theme: {
    extend: {
      colors: {
        // 映射现有梦境主题色到 Tailwind
        dream: {
          bg: '#0a0612',
          purple: '#9d6cff',
          pink: '#ff6ec7',
          cyan: '#00e5ff'
        }
      }
    }
  }
}
```
3. 创建 `css/tailwind.css`：`@tailwind base; @tailwind components; @tailwind utilities;`
4. 在 `vite.config.js` 引入 PostCSS 插件
5. 新模块HTML直接用 `class="flex items-center gap-3 bg-dream-bg/80 backdrop-blur"` 等工具类

### 5.3 共存方案

- Tailwind 的 `preflight`（base reset）可能与现有样式冲突 → 用 `corePlugins: { preflight: false }` 关闭，仅用 utilities 层
- 或在 Tailwind 上层加 `layer` 隔离

---

## 六、里程碑与时间规划

**总时间窗口**：2026-09-15 → 2026-10-30（学院初赛截止，约45天）

| 阶段 | 时间窗 | 交付物 | 优先级 |
|---|---|---|---|
| **M1: 项目骨架** | 9/15-9/20 | 项目重命名、Tailwind接入、路由扩展、相机交互层v1 | P0 |
| **M2: AI构图核心** | 9/21-9/30 | MediaPipe接入、构图规则库、实时评分、参考线叠加 | P0 |
| **M3: AI修图核心** | 10/1-10/10 | TF.js接入、图像增强、风格迁移、文旅预设滤镜 | P0 |
| **M4: 闭环整合** | 10/11-10/20 | 拍摄→构图→修图→发布流程打通、小梦教练改造 | P1 |
| **M5: 比赛材料** | 10/21-10/28 | 申报表、20页PPT、商业计划书、演示视频、AI原型打包 | P0 |
| **M6: 初赛提交** | 10/29-10/30 | 最终检查、提交 | P0 |
| **M7: 复赛准备** | 11月 | 路演PPT优化、现场demo演练、答辩预案 | P1 |
| **M8: 决赛冲刺** | 12月 | 8分钟路演、现场互动优化 | P1 |

### 6.1 M1 详细任务（9/15-9/20）

1. 项目重命名：`dreamcore-art-platform` → `ai-photo-tourism-platform`（或保留品牌名，加副标题）
2. package.json 依赖新增：`tailwindcss postcss autoprefixer @tensorflow/tfjs @mediapipe/pose @mediapipe/hands`
3. tailwind.config.js + css/tailwind.css + vite.config.js PostCSS配置
4. 路由扩展：新增 `#/studio` `#/edit` `#/coach` 路由占位
5. 相机交互层 v1：CameraManager 类、权限处理、预览渲染、拍照捕获
6. 摄影工坊页面骨架（Tailwind搭建）

### 6.2 M2 详细任务（9/21-9/30）

1. MediaPipe Hands/Pose 在 studio 页面接入
2. 构图规则库 composition-rules.js（6条规则）
3. composition-overlay.js Canvas叠加层
4. composition-scoring.js 评分算法
5. composition-advisor.js 联动小梦生成建议
6. 实时性能优化（30fps目标）

### 6.3 M3 详细任务（10/1-10/10）

1. TensorFlow.js 接入 + WebGL backend
2. enhance.js 基础调整（亮度/对比度/饱和度/锐化）
3. style-transfer.js 风格迁移（模型离线化到 public/models/）
4. filter-presets.js 6个文旅预设
5. local-adjust.js 局部调整
6. export.js 导出
7. 修图工作台UI（Tailwind）

---

## 七、风险点与应对

| 风险 | 影响 | 应对 |
|---|---|---|
| MediaPipe CDN 在比赛现场不稳定 | 演示失败 | 离线化到 public/mediapipe/，自托管 |
| TF.js 模型体积大（>30MB） | 首屏慢 | 懒加载+进度条+Web Worker，模型放CDN |
| 相机权限被拒/无相机 | 演示流程断 | 提前准备"上传图片"降级方案，演示用本机 |
| 构图评分算法主观性 | 评委质疑 | 提供规则可解释性（叠加线+评分依据可视化） |
| 比赛要求不能包装教师成果 | 资格风险 | 项目从0到1全程学生主导，保留开发记录 |
| 时间紧（45天） | 功能做不完 | P0/P1优先级严格，P0必做P1可选 |
| 部署环境HTTP限制 | 相机无法用 | Netlify/Vercel 已自动HTTPS，演示前确认 |
| iOS Safari 兼容性 | 现场演示失败 | 提前用Windows+Chrome做主演示设备 |

---

## 八、比赛提交材料清单

| 材料 | 负责人 | 截止 | 状态 |
|---|---|---|---|
| 申报表（附件1） | 老大 | 10/30 | 待办 |
| 项目展示PPT（20页内PDF） | AI副驾起草+老大审定 | 10/28 | 待办 |
| 商业计划书 | AI副驾起草+老大审定 | 10/28 | 待办 |
| AI应用原型（在线Demo） | AI副驾开发 | 10/20 | 已有基础（Netlify） |
| 演示视频（3-5分钟） | 老大录制+AI副驾脚本 | 10/28 | 待办 |
| 其他证明（专利/协议） | 老大 | 10/30 | 视情况 |

---

## 九、项目目录规划（新增）

```
项目根/
├── index.html              # 主入口（新增工坊入口）
├── package.json            # 新增依赖
├── tailwind.config.js      # 新增
├── css/
│   ├── style.css          # 原有原生CSS
│   └── tailwind.css       # 新增Tailwind入口
├── js/
│   ├── camera/            # 新：相机交互层
│   ├── composition/       # 新：AI构图算法
│   ├── photo-edit/        # 新：AI修图
│   ├── gallery.js        # 保留增强
│   ├── ai-assistant.js   # 改造为摄影教练
│   ├── particles.js      # 保留
│   ├── router.js         # 扩展路由
│   └── ...其他保留
├── public/
│   ├── models/           # 新：TF.js模型离线化
│   ├── mediapipe/        # 新：MediaPipe离线化
│   └── images/fallback/  # 已有
├── data/
│   └── artworks.js       # 扩展字段
├── server/
│   └── server.js         # 可选扩展图像处理代理
├── tests/
│   ├── camera.spec.js    # 新
│   ├── composition.spec.js # 新
│   └── photo-edit.spec.js # 新
├── docs/
│   └── AI摄影文旅文创-改进实施方案.md # 本文档
└── dist/                 # 构建输出
```

---

## 十、待老大决策事项

1. **项目重命名**：是否从 Dreamcore 改名为更贴合比赛主题的名称？建议候选：
   - 「光语文旅」AI摄影创作平台
   - 「文旅光盒」AI摄影工坊
   - 保留 Dreamcore + 副标题"AI摄影文旅创作平台"

2. **项目路径**：当前项目在 TRAE工作模式目录下，是否需要复制到 `E:\TRAE\workspace\projectXXX-名称\` 规范路径？还是直接在当前位置继续开发？

3. **团队信息**：参赛团队成员、指导教师信息（申报表需要），请老大提供。

4. **文创衍生**：是否要做文创衍生功能（作品→明信片/壁纸/头像）？这会增加亮点但也会增加开发量。

5. **演示视频脚本**：是否需要我先起草演示视频的分镜脚本？

6. **商业计划书重点**：商业模式偏向哪种？
   - C端：摄影爱好者会员制
   - B端：文旅景区/酒店SaaS
   - G端：文旅局宣传合作
   - 或混合

---

**文档结束**

下一步：等老大审阅本方案，批复后立即进入 M1 阶段实施。
