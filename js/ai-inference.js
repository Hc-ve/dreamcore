// ============================================================
// js/ai-inference.js — 统一 AI 推理调用层
// 职责：封装 图像理解 / 文本生成 / 图像生成 三类 AI 接口，
//      统一通过 /api/ai/* 云函数代理调用，前端不持有任何 API 密钥。
// 设计原则：
//   1. 主方案 阿里云百炼(DashScope) —— 三家能力最均衡，唯一覆盖
//      图像理解(qwen-vl)+文本(qwen-plus/max)+图像生成(通义万相)全链路；
//      国内可用、延迟低、有免费额度，最适合"校长杯"路演演示。
//   2. 备用方案 DeepSeek(文本降级) + MIMO(文本二级降级)。
//   3. 主方案失败自动降级到备用方案，并记录降级日志(内存)。
//   4. 前端零密钥：所有请求经 /api/ai/* 由 Netlify 云函数代理转发。
// 依赖模块：无（纯调用层，供 M1~M5 业务模块调用）
// ============================================================

// ------------------------------------------------------------
// 【SubTask 1.1 三家云函数方案评估结论】
// 评估维度：成本 / 速度(延迟) / 可用性 / 图像理解能力
//
// 1. MIMO API (api.mimo.work)
//    - 可用性：❌ api.mimo.work 域名 DNS 解析失败，主机不可达；
//             api.xiaomimimo.com 可达但需鉴权，历史接入不稳定。
//    - 图像理解：❌ 仅 mimo-v2.5-pro 文本模型，无原生图像理解能力。
//    - 图像生成：❌ 无图像生成能力。
//    - 文本生成：✅ 可用，但有免费额度限制，长文本易截断。
//    - 速度：国内可达，延迟中等。
//    - 成本：有免费额度。
//    - 结论：仅可作文本降级备选(走 api.xiaomimimo.com)，不可作主方案。
//
// 2. 阿里云百炼 DashScope (dashscope.aliyuncs.com)
//    - 可用性：✅ 国内服务，延迟低，主机可达，稳定可靠。
//    - 图像理解：✅ qwen3.6-flash（qwen-vl 系列 2026-10-10 下架后的官方推荐替代），多模态图像理解国内第一梯队。
//    - 图像生成：✅ 通义万相 wanx-v1，文生图能力完善，支持风格化。
//    - 文本生成：✅ qwen-plus/qwen-max，中文创作/文创理解优秀。
//    - 速度：国内节点，延迟低(1-3s)，路演演示体验佳。
//    - 成本：✅ 有免费额度，按量计费，演示成本可控。
//    - 结论：✅ 选定为主方案 —— 三家唯一覆盖三类能力、国内可用、
//             延迟低、免费额度充足，最契合"AI+文旅文创"赛道。
//
// 3. DeepSeek (api.deepseek.com)
//    - 可用性：✅ 主机可达，OpenAI 兼容协议，接入极简。
//    - 图像理解：❌ 无图像理解能力。
//    - 图像生成：❌ 无图像生成能力。
//    - 文本生成：✅ deepseek-chat 文本生成极强且价格极低，中文表现优秀。
//    - 速度：响应快(1-2s)。
//    - 成本：✅ 业内最低之一。
//    - 结论：✅ 选定为文本生成降级方案（主方案文本失败时自动切换）。
//
// 【最终选型】
//   主方案：阿里云百炼 DashScope（图像理解 + 文本 + 图像生成 全覆盖）
//   备用1：DeepSeek（文本生成降级，主方案 qwen 文本失败时切换）
//   备用2：MIMO xiaomimimo.com（文本生成二级降级，仅当可达且有 key）
//   图像类无降级：仅 DashScope 具备图像理解/生成能力，主方案失败时
//                抛错并提示，不硬降级到无能力的服务商（避免无意义重试）。
// ------------------------------------------------------------

// 请求基础路径（Netlify 云函数代理，前端零密钥）
const AI_PROXY_BASE = '/api/ai';

// 默认超时（毫秒）
const DEFAULT_TIMEOUT = 30000;

// 降级日志（内存，最多保留 50 条，供 admin 调试面板查看）
const _degradeLog = [];
const MAX_LOG = 50;

/**
 * 记录降级日志（内部）
 * @param {string} from - 主方案/上一级方案名
 * @param {string} to - 降级目标方案名
 * @param {string} reason - 降级原因
 */
function _logDegrade(from, to, reason) {
  _degradeLog.unshift({ from, to, reason, time: Date.now() });
  if (_degradeLog.length > MAX_LOG) _degradeLog.length = MAX_LOG;
}

/**
 * 统一 fetch 封装：带超时 + JSON 解析 + 错误归一化（内部）
 * @param {string} path - /api/ai 下的子路径
 * @param {object} body - 请求体
 * @param {number} [timeout] - 超时毫秒
 * @returns {Promise<object>} 服务端返回的 JSON
 */
async function _post(path, body, timeout = DEFAULT_TIMEOUT) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeout);
  try {
    const res = await fetch(`${AI_PROXY_BASE}${path}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body || {}),
      signal: controller.signal
    });
    if (!res.ok) {
      const detail = await res.text().catch(() => '');
      throw new Error(`AI代理HTTP ${res.status}: ${detail.slice(0, 200)}`);
    }
    const data = await res.json();
    if (data && data.error) {
      const msg = typeof data.error === 'string' ? data.error : JSON.stringify(data.error);
      throw new Error(msg);
    }
    return data || {};
  } finally {
    clearTimeout(timer);
  }
}

/**
 * 统一 GET 封装（内部）：带超时 + JSON 解析 + 错误归一化
 * 用于提交/查询分离型异步任务的查询半边（GET /api/ai/image-repaint-query?taskId=）
 * 注意：查询协议中任务失败以 { status:'failed', error } 表达，error 是协议字段；
 *      tolerateBodyError=true 时不把 body 内 error 当传输异常抛出（否则轮询循环
 *      会把 failed 误判为网络抖动而空转到 90s 总超时）
 * @param {string} path - /api/ai 下的子路径（含 query string）
 * @param {number} [timeout] - 超时毫秒
 * @param {object} [opts] - { tolerateBodyError:boolean }
 * @returns {Promise<object>} 服务端返回的 JSON
 */
async function _get(path, timeout = DEFAULT_TIMEOUT, opts = {}) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeout);
  try {
    const res = await fetch(`${AI_PROXY_BASE}${path}`, {
      method: 'GET',
      signal: controller.signal
    });
    if (!res.ok) {
      const detail = await res.text().catch(() => '');
      throw new Error(`AI代理HTTP ${res.status}: ${detail.slice(0, 200)}`);
    }
    const data = await res.json();
    if (data && data.error && !opts.tolerateBodyError) {
      const msg = typeof data.error === 'string' ? data.error : JSON.stringify(data.error);
      throw new Error(msg);
    }
    return data || {};
  } finally {
    clearTimeout(timer);
  }
}

/**
 * 归一化图片 base64（内部）
 * 确保 base64 字符串携带 data:image/* 前缀，便于多模态模型直接消费。
 * @param {string} b64 - 原始 base64（可含/不含 data: 前缀）
 * @returns {string}
 */
function _normalizeBase64(b64) {
  if (!b64) return '';
  if (b64.startsWith('data:image')) return b64;
  const idx = b64.indexOf('base64,');
  if (idx >= 0) return 'data:image/jpeg;' + b64.slice(idx);
  return 'data:image/jpeg;base64,' + b64;
}

// ============================================================
// 对外接口：三类 AI 能力
// ============================================================

/**
 * 图像理解：输入图片 base64 + 提示词，返回文本分析
 * 主方案：DashScope qwen-vl（无降级，仅 DashScope 具备图像理解能力）
 * @param {string} imageBase64 - 图片 base64（可含或不含 data: 前缀）
 * @param {string} prompt - 分析提示词
 * @param {object} [opts] - 可选参数 { provider, timeout, model }
 * @returns {Promise<{text:string, provider:string}>}
 */
async function imageUnderstanding(imageBase64, prompt, opts = {}) {
  const image = _normalizeBase64(imageBase64);
  const payload = {
    image,
    prompt: prompt || '请描述这张图片的内容、构图、色彩与主题表达',
    provider: opts.provider || 'dashscope',
    model: opts.model || 'qwen3.6-flash'
  };
  const data = await _post('/image-understanding', payload, opts.timeout);
  return { text: data.text || '', provider: data.provider || 'dashscope' };
}

/**
 * 文本生成：输入提示词，返回文本
 * 默认链：DashScope → DeepSeek → MIMO（三级降级）
 * 指定 opts.provider = 'self-trained' 时：自研微调模型（DreamCraft-1.5B）
 *   优先 → 失败自动降级回云端链（DashScope → DeepSeek → MIMO）。
 *   仅显式请求才走自研模型，避免领域模型影响其他模块（如 AI陪练）的通用文本质量。
 * @param {string} prompt - 文本生成提示词
 * @param {object} [opts] - 可选参数 { system, model, maxTokens, temperature, timeout, provider }
 * @returns {Promise<{text:string, provider:string, degraded:boolean}>}
 */
async function textGeneration(prompt, opts = {}) {
  const params = { prompt, ...opts };

  // 内部：按 provider 调用一次文本生成，返回 {text, provider}
  const gen = (provider) => (p) => _textGenOnce(provider, p);

  // 二级降级：DeepSeek → MIMO（拍平嵌套结果）
  const deepseekThenMimo = async (p) => {
    const inner = await callWithFallback(gen('deepseek'), gen('mimo'), p);
    return inner.result;
  };

  if (opts.provider === 'self-trained') {
    // 自研优先：self-trained → (DashScope → DeepSeek → MIMO)
    const outer = await callWithFallback(gen('self-trained'), async (p) => {
      const inner = await callWithFallback(gen('dashscope'), deepseekThenMimo, p);
      return inner.result;
    }, params);
    return {
      text: outer.result.text,
      provider: outer.provider,
      degraded: outer.degraded
    };
  }

  // 默认链：DashScope → (DeepSeek → MIMO)
  const outer = await callWithFallback(gen('dashscope'), deepseekThenMimo, params);
  return {
    text: outer.result.text,
    provider: outer.provider,
    degraded: outer.degraded
  };
}

/**
 * 图像生成：输入提示词，返回图片 URL（无降级，仅 DashScope 通义万相）
 * @param {string} prompt - 图像生成提示词
 * @param {object} [opts] - 可选参数 { size, n, timeout, model }
 * @returns {Promise<{imageUrl:string, provider:string}>}
 */
async function imageGeneration(prompt, opts = {}) {
  const payload = {
    prompt,
    size: opts.size || '1024*1024',
    n: opts.n || 1,
    provider: opts.provider || 'dashscope',
    model: opts.model || 'wanx-v1'
  };
  const data = await _post('/image-generation', payload, opts.timeout || 60000);
  return { imageUrl: data.imageUrl || '', provider: data.provider || 'dashscope' };
}

// ============================================================
// 融合改造层2：图生图（qwen-image-3.0 I2I，提交/查询分离）
// ============================================================

/** qwen-image-3.0 I2I 限额：2048×2048 / 2MB base64（超出触发服务端拒绝或超时） */
const I2I_MAX_PX = 2048;
const I2I_MAX_BYTES = 2 * 1024 * 1024;

/**
 * 预压缩：将 dataURL 图片缩到 I2I 限额内（≥30% 时才动，避免过度压缩）
 * 返回 Promise<dataURL>，已在限额内则原样返回
 * @param {string} dataUrl - data:image/*;base64,...
 */
async function _precompressImage(dataUrl) {
  if (!dataUrl || typeof dataUrl !== 'string' || !dataUrl.startsWith('data:image')) return dataUrl;
  // 估算 base64 字节数
  const base64 = dataUrl.split(',')[1] || '';
  const approxBytes = Math.floor(base64.length * 3 / 4);
  if (approxBytes <= I2I_MAX_BYTES && (base64.length < 5000 || true)) {
    // 字节在 2MB 内，但可能像素超限——需要解码检查
  }
  try {
    const img = await new Promise((resolve, reject) => {
      const i = new Image();
      i.onload = () => resolve(i); i.onerror = reject;
      i.src = dataUrl;
    });
    const { naturalWidth: w, naturalHeight: h } = img;
    const maxDim = Math.max(w, h);
    if (maxDim <= I2I_MAX_PX && approxBytes <= I2I_MAX_BYTES) return dataUrl;
    // 计算缩放比
    let scale = Math.min(I2I_MAX_PX / maxDim, Math.sqrt(I2I_MAX_BYTES / approxBytes), 1);
    scale = Math.max(scale, 0.3); // 至少保留 30%
    const cw = Math.round(w * scale), ch = Math.round(h * scale);
    const canvas = document.createElement('canvas');
    canvas.width = cw; canvas.height = ch;
    const ctx = canvas.getContext('2d');
    ctx.drawImage(img, 0, 0, cw, ch);
    return canvas.toDataURL('image/jpeg', 0.88);
  } catch (_) { /* 压缩失败则原样返回，让服务端决定 */ return dataUrl; }
}

/** 轮询间隔基线与上限（指数退避 1s→2s→4s→…上限 10s，坑5） */
const REPOLL_START_MS = 1000;
const REPOLL_MAX_MS = 10000;
/** 总超时（与云函数 150s RUNNING 判定窗口对齐；qwen-image-3.0 同步模式实测单图 ~95s，坑5/6） */
const REPOLL_DEADLINE_MS = 150 * 1000;

/**
 * 图生图 · 提交：上传原图 + 提示词，立即返回任务 ID（不阻塞等待出图）
 * @param {string} image - 原图 base64/dataURL（qwen-image-3.0 I2I 像素上限 2048×2048，调用方负责缩放）
 * @param {string} prompt - 重绘提示词（含风格锁，坑1/8）
 * @param {object} [opts] - { negativePrompt, timeout }
 * @returns {Promise<{taskId:string, provider:string}>}
 */
async function imageRepaintSubmit(image, prompt, opts = {}) {
  // P2-7：预压缩（G2 素材 4.5MB 触发超时，先缩到 2048×2048/2MB）
  let compressed = image;
  try { compressed = await _precompressImage(image); } catch (_) { /* 压缩失败不阻塞，用原图继续 */ }
  const payload = {
    image: compressed,
    prompt,
    negativePrompt: opts.negativePrompt || '文字,水印,logo,边框',
    provider: 'dashscope'
  };
  const data = await _post('/image-repaint-submit', payload, opts.timeout || 20000);
  return { taskId: data.taskId || '', provider: data.provider || 'dashscope' };
}

/**
 * 图生图 · 查询：轮询单个任务状态（查询半边）
 * @param {string} taskId
 * @param {object} [opts] - { timeout }
 * @returns {Promise<{status:'running'|'succeeded'|'failed', imageUrl:string, error:string}>}
 */
async function imageRepaintQuery(taskId, opts = {}) {
  // tolerateBodyError：云函数任务失败返回 200 + { status:'failed', error }，error 是协议字段
  const data = await _get(`/image-repaint-query?taskId=${encodeURIComponent(taskId)}`, opts.timeout || 15000, { tolerateBodyError: true });
  const status = data.status || (data.error ? 'failed' : 'running');
  return { status, imageUrl: data.imageUrl || '', error: data.error || '' };
}

/**
 * 图生图 · 一体化便捷调用：提交 + 前端指数退避轮询 + 总超时 150s
 * 失败 throw（调用方降级回层1 取景兜底，画面不白屏）
 * 多分镜场景建议用 submit/query 拆分调用（并行提交、串行查询防 429，坑7）
 * @param {string} image - 原图 base64/dataURL
 * @param {string} prompt - 重绘提示词
 * @param {object} [opts] - { negativePrompt, totalTimeout, timeout }
 * @returns {Promise<{imageUrl:string, provider:string}>}
 */
async function imageRepaint(image, prompt, opts = {}) {
  const maxRetries = opts.maxRetries != null ? opts.maxRetries : 1; // P2-7：默认超时自动重试 1 次
  let lastErr = null;
  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      const { taskId } = await imageRepaintSubmit(image, prompt, opts);
      if (!taskId) throw new Error('图生图提交未返回 taskId');
      const deadline = Date.now() + (opts.totalTimeout || REPOLL_DEADLINE_MS);
      let delay = REPOLL_START_MS;
      while (Date.now() < deadline) {
        await new Promise((r) => setTimeout(r, delay));
        const r = await imageRepaintQuery(taskId, opts);
        if (r.status === 'succeeded') return { imageUrl: r.imageUrl, provider: 'dashscope' };
        if (r.status === 'failed') throw new Error(r.error || '图生图任务失败');
        delay = Math.min(delay * 2, REPOLL_MAX_MS);
      }
      throw new Error('图生图生成超时 (150s)');
    } catch (err) {
      lastErr = err;
      if (attempt < maxRetries) {
        _logDegrade('qwen-image-3.0', 'retry', (err && err.message) || '未知错误');
        continue; // 重试（不消耗用户重生成计数）
      }
    }
  }
  throw lastErr;
}

// ============================================================
// SubTask 1.4：健康检查与降级策略
// ============================================================

/**
 * 健康检查：检测网络环境、主推理方案与备用方案可达性
 * 一次性探测全部服务商，返回结构化健康报告。
 * @returns {Promise<object>} 健康报告
 *   { network, primary:{name,available,keyConfigured}, fallbacks:[...], latency, timestamp }
 */
async function healthCheck() {
  const start = Date.now();
  let data;
  try {
    data = await _post('/health', {}, 10000);
  } catch (e) {
    return {
      network: typeof navigator !== 'undefined' ? navigator.onLine : true,
      reachable: false,
      error: e.message,
      timestamp: Date.now()
    };
  }
  return {
    network: typeof navigator !== 'undefined' ? navigator.onLine : true,
    reachable: true,
    primary: {
      name: 'dashscope',
      available: !!(data.dashscope && data.dashscope.available),
      keyConfigured: !!(data.dashscope && data.dashscope.keyConfigured)
    },
    fallbacks: [
      {
        name: 'deepseek',
        available: !!(data.deepseek && data.deepseek.available),
        keyConfigured: !!(data.deepseek && data.deepseek.keyConfigured)
      },
      {
        name: 'mimo',
        available: !!(data.mimo && data.mimo.available),
        keyConfigured: !!(data.mimo && data.mimo.keyConfigured)
      }
    ],
    selfTrained: {
      name: 'self-trained',
      model: (data.selfTrained && data.selfTrained.model) || 'dreamcraft-1.5b',
      available: !!(data.selfTrained && data.selfTrained.available)
    },
    latency: Date.now() - start,
    timestamp: Date.now()
  };
}

/**
 * 主动降级：外部触发的降级记录（供业务模块在自定义降级场景调用）
 * @param {string} fromProvider - 源方案名
 * @param {string} toProvider - 目标方案名
 * @param {string} reason - 降级原因
 * @returns {object} 降级记录 { from, to, reason, time }
 */
function degrade(fromProvider, toProvider, reason) {
  _logDegrade(fromProvider, toProvider, reason);
  return { from: fromProvider, to: toProvider, reason, time: Date.now() };
}

/**
 * 统一降级调用封装：依次尝试 主方案 → 备用方案，首个成功即返回
 * 主方案失败时自动记录降级日志并切换备用方案；两者皆失败则抛聚合错误。
 * @param {Function} primaryMethod - 主方案调用函数，接收 params，返回 Promise<{provider:string,...}>
 * @param {Function} fallbackMethod - 备用方案调用函数，接收 params，返回 Promise
 * @param {*} params - 传给两个方法 的参数
 * @returns {Promise<{result:*, provider:string, degraded:boolean}>}
 */
async function callWithFallback(primaryMethod, fallbackMethod, params) {
  try {
    const result = await primaryMethod(params);
    return { result, provider: (result && result.provider) || 'primary', degraded: false };
  } catch (primaryErr) {
    if (!fallbackMethod) throw primaryErr;
    _logDegrade('primary', 'fallback', primaryErr.message);
    try {
      const result = await fallbackMethod(params);
      return { result, provider: (result && result.provider) || 'fallback', degraded: true };
    } catch (fallbackErr) {
      const err = new Error(`主方案与备用方案均失败。主: ${primaryErr.message}；备: ${fallbackErr.message}`);
      err.primaryError = primaryErr.message;
      err.fallbackError = fallbackErr.message;
      throw err;
    }
  }
}

/**
 * 获取降级日志副本（供 Admin 调试面板 / 运维排查）
 * @returns {Array<{from,to,reason,time}>}
 */
function getDegradeLog() {
  return _degradeLog.slice();
}

// ------------------------------------------------------------
// 内部：按 provider 调用一次文本生成（经云函数代理）
// @param {string} provider - dashscope | deepseek | mimo
// @param {object} p - { prompt, system, model, maxTokens, temperature, timeout }
// @returns {Promise<{text:string, provider:string}>}
// ------------------------------------------------------------
async function _textGenOnce(provider, p) {
  const payload = {
    prompt: p.prompt,
    provider,
    system: p.system,
    model: p.model,
    maxTokens: p.maxTokens,
    temperature: p.temperature,
    search: p.search
  };
  const data = await _post('/text-generation', payload, p.timeout);
  return { text: data.text || '', provider: data.provider || provider };
}

// ============================================================
// 模块导出（ES Module）
// ============================================================
export {
  imageUnderstanding,
  textGeneration,
  imageGeneration,
  imageRepaint,
  imageRepaintSubmit,
  imageRepaintQuery,
  healthCheck,
  degrade,
  callWithFallback,
  getDegradeLog
};
