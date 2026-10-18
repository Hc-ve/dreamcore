// ============================================================
// netlify/functions/ai-proxy.mjs — AI 推理云函数代理
// 职责：接收前端 /api/ai/* 请求，转发到对应服务商，API 密钥由
//      Netlify 环境变量注入（DASHSCOPE_API_KEY / DEEPSEEK_API_KEY /
//      MIMO_API_KEY），前端零密钥。
// 路由（经 netlify.toml redirect 映射）：
//   POST /api/ai/image-understanding → DashScope qwen3.6-flash 图像理解
//   POST /api/ai/vision-recognize    → DashScope qwen3.6-flash 文化识图（识别主体+匹配知识库主题）
//   POST /api/ai/culture-story       → 文化故事讲解（事实卡注入防幻觉 + 降级链生成）
//   POST /api/ai/text-generation      → self-trained 自研微调模型 / DashScope qwen-plus / DeepSeek / MIMO 文本生成
//   POST /api/ai/image-generation     → DashScope 通义万相 文生图（异步轮询）
//   POST /api/ai/image-repaint-submit → DashScope qwen-image-3.0 图生图（异步提交，立即返回 taskId）
//   GET  /api/ai/image-repaint-query  → 轮询图生图任务状态（完成返回 imageUrl）
//   POST /api/ai/health               → 各服务商可达性 + 密钥配置探测（含自研模型端点）
// 设计原则：无状态、薄代理、错误归一化为 { error } JSON。
// 依赖：Node 18+ 内置 fetch / AbortSignal.timeout
// ============================================================

// 文化知识库（12 主题事实卡）：识图主题匹配 + 讲解事实注入（防幻觉）。
// 纯数据模块，dev（Vite 中间件 node ESM）与生产（esbuild 打包）均可直接 import。
import { getThemeById, matchThemeByText, hasFactCard } from '../../data/culture-knowledge.js';

const DASHSCOPE_KEY = process.env.DASHSCOPE_API_KEY;
const DEEPSEEK_KEY = process.env.DEEPSEEK_API_KEY;
const MIMO_KEY = process.env.MIMO_API_KEY;
const MIMO_BASE = 'https://api.xiaomimimo.com/v1';
const DASHSCOPE_BASE = 'https://dashscope.aliyuncs.com/api/v1';
// 自研微调模型（DreamCraft-1.5B，OpenAI 兼容端点）：
// 默认指向本地 ollama（演示机）；云端部署时用 SELF_TRAINED_API_BASE 覆盖。
// Netlify 生产环境不可达本地端口时自动抛错 → 前端降级到 dashscope（设计如此）。
const SELF_TRAINED_BASE = process.env.SELF_TRAINED_API_BASE || 'http://127.0.0.1:11434/v1';
const SELF_TRAINED_MODEL = process.env.SELF_TRAINED_MODEL || 'dreamcraft-1.5b';
// 讲解任务专用模型：v4 多任务版（文创走 v3 保持 10/10，讲解走 v4 达 90%）
const SELF_TRAINED_STORY_MODEL = process.env.SELF_TRAINED_STORY_MODEL || 'dreamcraft-story-1.5b:v5';

// 融合改造层2：图生图（qwen-image-3.0 图像编辑 I2I，异步提交/查询分离）
// 坑8：固定模型版本号，防止云端模型升级导致多分镜风格漂移
const REPAINT_MODEL = 'qwen-image-3.0';
// 坑5/6：RUNNING 超 150s 视为失败，触发前端降级回层1 取景兜底（同步模式实测单图 ~95s）
const REPAINT_TIMEOUT_MS = 150 * 1000;
// 进程内任务状态表：taskId → { submittedAt, status, imageUrl, error }（杨波"非必要不分布"，
// 不引入持久化；服务重启丢表后 query 返回 failed 提示重新提交，前端自动降级层1 取景）
const repaintTaskState = new Map();

/**
 * 统一 JSON 响应（含 CORS 头）
 * @param {number} statusCode
 * @param {object} body
 */
function json(statusCode, body) {
  return {
    statusCode,
    headers: {
      'Content-Type': 'application/json; charset=utf-8',
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'POST, GET, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type'
    },
    body: JSON.stringify(body)
  };
}

/**
 * 构造对话消息数组（OpenAI / DashScope 通用 {role,content} 格式）
 * @param {string} [system]
 * @param {string} prompt
 */
function buildMessages(system, prompt) {
  const msgs = [];
  if (system) msgs.push({ role: 'system', content: system });
  msgs.push({ role: 'user', content: prompt });
  return msgs;
}

/**
 * 从 qwen-vl / qwen-text 响应中抽取文本（兼容 string 与 content[] 两种形态）
 * @param {object} d
 */
function extractQwenText(d) {
  const msg = d && d.output && d.output.choices && d.output.choices[0] && d.output.choices[0].message;
  if (!msg) return (d && d.output && d.output.text) || '';
  if (typeof msg.content === 'string') return msg.content;
  if (Array.isArray(msg.content)) return msg.content.map((c) => c.text || '').join('');
  return '';
}

/**
 * 轻量可达性探测（HEAD 请求，4xx 视为可达仅需鉴权，5xx/超时视为不可达）
 * @param {string} url
 */
async function ping(url) {
  try {
    const r = await fetch(url, { method: 'HEAD', signal: AbortSignal.timeout(5000) });
    return r.status < 500;
  } catch {
    return false;
  }
}

// ============================================================
// 路由分发
// ============================================================
export async function handler(event) {
  // CORS 预检
  if (event.httpMethod === 'OPTIONS') return json(204, {});

  // 解析路由：从 event.path 中截取 /api/ai/ 之后的段
  // （vite 开发中间件把 ?query 拼在 path 里，需先剥离；Netlify 真环境 path 不含 query）
  const rawPath = (event.path || '').replace(/\/+$/, '');
  const route = ((rawPath.split('/api/ai/')[1] || '').split('/')[0] || '').split('?')[0];

  // 仅图生图查询端点支持 GET（提交/查询分离的查询半边）
  const allowGet = route === 'image-repaint-query';
  if (event.httpMethod !== 'POST' && !(event.httpMethod === 'GET' && allowGet)) {
    return json(405, { error: allowGet ? '该路由支持 POST/GET 请求' : '仅支持 POST 请求' });
  }

  // 查询参数：Netlify 环境用 queryStringParameters；vite 开发环境从 path 中解析
  let queryParams = event.queryStringParameters || null;
  if (!queryParams && rawPath.includes('?')) {
    queryParams = {};
    for (const kv of rawPath.split('?')[1].split('&')) {
      const [k, v] = kv.split('=');
      if (k) queryParams[k] = decodeURIComponent(v || '');
    }
  }

  let body = {};
  if (event.httpMethod === 'POST') {
    try {
      body = event.body ? JSON.parse(event.body) : {};
    } catch {
      return json(400, { error: '请求体 JSON 解析失败' });
    }
  }

  try {
    switch (route) {
      case 'image-understanding':
        return await handleImageUnderstanding(body);
      case 'vision-recognize':
        return await handleVisionRecognize(body);
      case 'culture-story':
        return await handleCultureStory(body);
      case 'text-generation':
        return await handleTextGeneration(body);
      case 'image-generation':
        return await handleImageGeneration(body);
      case 'image-repaint-submit':
        return await handleImageRepaintSubmit(body);
      case 'image-repaint-query':
        return await handleImageRepaintQuery((queryParams && queryParams.taskId) || '');
      case 'tts':
        return await handleTTS(body);
      case 'health':
        return await handleHealth();
      default:
        return json(404, { error: `未知路由: /api/ai/${route}` });
    }
  } catch (e) {
    return json(502, { error: e.message || 'AI 推理服务异常' });
  }
}

// ============================================================
// 图像理解：DashScope qwen-vl
// ============================================================
async function handleImageUnderstanding({ image, prompt, model }) {
  if (!DASHSCOPE_KEY) throw new Error('DashScope API 密钥未配置 (环境变量 DASHSCOPE_API_KEY)');
  if (!image) throw new Error('缺少 image 参数 (base64 图片)');

  const payload = {
    model: model || 'qwen3.6-flash',
    input: {
      messages: [
        {
          role: 'user',
          content: [
            { image },
            { text: prompt || '请描述这张图片的内容、构图、色彩与主题表达' }
          ]
        }
      ]
    }
  };

  const r = await fetch(`${DASHSCOPE_BASE}/services/aigc/multimodal-generation/generation`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${DASHSCOPE_KEY}`, 'Content-Type': 'application/json' },
    body: JSON.stringify(payload)
  });
  const d = await r.json();
  if (!r.ok) throw new Error(`qwen-vl 调用失败 ${r.status}: ${JSON.stringify(d).slice(0, 200)}`);
  return json(200, { text: extractQwenText(d), provider: 'dashscope' });
}

// ============================================================
// 文本生成：按 provider 路由（self-trained | dashscope | deepseek | mimo）
// ============================================================
async function handleTextGeneration({ prompt, provider = 'dashscope', system, model, maxTokens, temperature, search }) {
  if (!prompt) throw new Error('缺少 prompt 参数');
  const { text, provider: used } = await callTextProvider(provider, {
    prompt, system, model,
    maxTokens: maxTokens || 1024,
    temperature: temperature == null ? 0.7 : temperature,
    search
  });
  return json(200, { text, provider: used });
}

/**
 * 单服务商文本调用核心（供 handleTextGeneration / culture-story 降级链复用）
 * @param {string} provider self-trained | dashscope | deepseek | mimo
 * @returns {Promise<{text: string, provider: string}>} 失败抛错（供降级链捕获）
 */
async function callTextProvider(provider, { prompt, system, model, storyTask, maxTokens = 1024, temperature = 0.7, search }) {
  // 自研微调模型（DreamCraft-1.5B）：OpenAI 兼容格式转发，无密钥需求
  if (provider === 'self-trained') {
    const r = await fetch(`${SELF_TRAINED_BASE}/chat/completions`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: storyTask ? (model || SELF_TRAINED_STORY_MODEL) : (model || SELF_TRAINED_MODEL),
        messages: buildMessages(system, prompt),
        max_tokens: maxTokens,
        temperature: temperature
      })
    });
    const d = await r.json().catch(() => ({}));
    if (!r.ok) throw new Error(`自研模型调用失败 ${r.status}: ${JSON.stringify(d).slice(0, 200)}`);
    const text = (d.choices && d.choices[0] && d.choices[0].message && d.choices[0].message.content) || '';
    if (!text) throw new Error('自研模型未返回内容');
    return { text, provider: 'self-trained' };
  }

  if (provider === 'deepseek') {
    if (!DEEPSEEK_KEY) throw new Error('DeepSeek API 密钥未配置 (环境变量 DEEPSEEK_API_KEY)');
    const r = await fetch('https://api.deepseek.com/v1/chat/completions', {
      method: 'POST',
      headers: { Authorization: `Bearer ${DEEPSEEK_KEY}`, 'Content-Type': 'application/json' },
      // seed：每次随机采样种子——避免相同 prompt（仅 nonce 差异）返回完全一致结果
      body: JSON.stringify({ model: model || 'deepseek-chat', messages: buildMessages(system, prompt), max_tokens: maxTokens, temperature: temperature, seed: Math.floor(Math.random() * 2147483647) })
    });
    const d = await r.json();
    if (!r.ok) throw new Error(`DeepSeek 调用失败 ${r.status}: ${JSON.stringify(d).slice(0, 200)}`);
    const text = (d.choices && d.choices[0] && d.choices[0].message && d.choices[0].message.content) || '';
    if (!text) throw new Error('DeepSeek 未返回内容');
    return { text, provider: 'deepseek' };
  }

  if (provider === 'mimo') {
    if (!MIMO_KEY) throw new Error('MIMO API 密钥未配置 (环境变量 MIMO_API_KEY)');
    const r = await fetch(`${MIMO_BASE}/chat/completions`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${MIMO_KEY}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ model: model || 'mimo-v2.5-pro', messages: buildMessages(system, prompt), max_tokens: maxTokens || 800, temperature: temperature == null ? 0.8 : temperature, seed: Math.floor(Math.random() * 2147483647) })
    });
    const d = await r.json();
    if (!r.ok) throw new Error(`MIMO 调用失败 ${r.status}: ${JSON.stringify(d).slice(0, 200)}`);
    const text = (d.choices && d.choices[0] && d.choices[0].message && d.choices[0].message.content) || '';
    if (!text) throw new Error('MIMO 未返回内容');
    return { text, provider: 'mimo' };
  }

  // 默认 dashscope qwen-plus
  if (!DASHSCOPE_KEY) throw new Error('DashScope API 密钥未配置 (环境变量 DASHSCOPE_API_KEY)');
  const payload = {
    model: model || 'qwen-plus',
    input: { messages: buildMessages(system, prompt) },
    parameters: { max_tokens: maxTokens, temperature: temperature, seed: Math.floor(Math.random() * 2147483647), ...(search ? { enable_search: true } : {}) }
  };
  const r = await fetch(`${DASHSCOPE_BASE}/services/aigc/text-generation/generation`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${DASHSCOPE_KEY}`, 'Content-Type': 'application/json' },
    body: JSON.stringify(payload)
  });
  const d = await r.json();
  if (!r.ok) throw new Error(`qwen 文本生成失败 ${r.status}: ${JSON.stringify(d).slice(0, 200)}`);
  const text = extractQwenText(d);
  if (!text) throw new Error('qwen 未返回内容');
  return { text, provider: 'dashscope' };
}

// ============================================================
// 图像生成：DashScope 通义万相（异步提交 + 轮询，最长 ~60s）
// ============================================================
async function handleImageGeneration({ prompt, size = '1024*1024', n = 1, model }) {
  if (!DASHSCOPE_KEY) throw new Error('DashScope API 密钥未配置 (环境变量 DASHSCOPE_API_KEY)');
  if (!prompt) throw new Error('缺少 prompt 参数');

  const submitRes = await fetch(`${DASHSCOPE_BASE}/services/aigc/text2image/image-synthesis`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${DASHSCOPE_KEY}`,
      'Content-Type': 'application/json',
      'X-DashScope-Async': 'enable'
    },
    body: JSON.stringify({ model: model || 'wanx-v1', input: { prompt }, parameters: { n: Number(n) || 1, size } })
  });
  const submitData = await submitRes.json();
  if (!submitRes.ok) throw new Error(`通义万相提交失败 ${submitRes.status}: ${JSON.stringify(submitData).slice(0, 200)}`);
  const taskId = submitData.output && submitData.output.task_id;
  if (!taskId) throw new Error('通义万相未返回 task_id');

  const taskUrl = `${DASHSCOPE_BASE}/tasks/${taskId}`;
  for (let i = 0; i < 30; i++) {
    await new Promise((resolve) => setTimeout(resolve, 2000));
    const tr = await fetch(taskUrl, { headers: { Authorization: `Bearer ${DASHSCOPE_KEY}` } });
    const td = await tr.json();
    const status = td.output && td.output.task_status;
    if (status === 'SUCCEEDED') {
      const url = td.output.results && td.output.results[0] && td.output.results[0].url;
      if (!url) throw new Error('通义万相成功但未返回图片 URL');
      return json(200, { imageUrl: url, provider: 'dashscope' });
    }
    if (status === 'FAILED') throw new Error(`通义万相生成失败: ${(td.output && td.output.message) || '未知原因'}`);
  }
  throw new Error('通义万相生成超时 (60s)');
}

// ============================================================
// 融合改造层2：图生图（qwen-image-3.0 I2I，提交/查询分离）
// 2026-09-24 修复：当前 DASHSCOPE key 不支持 X-DashScope-Async 异步任务
// （403 "current user api does not support asynchronous calls"），
// 改用同步接口在后台 promise 中执行，对外契约不变：
//   POST /image-repaint-submit → 生成本地 taskId 立即返回
//   GET  /image-repaint-query  → 查询本地 promise 状态（running/succeeded/failed）
// 注意：同步长请求 ~95s，本地 dev（vite middleware）无时限可用；
// Netlify Functions 免费版 10s 时限内无法完成，生产需 SSE/后台任务方案
// ============================================================
async function handleImageRepaintSubmit({ image, prompt, negativePrompt }) {
  if (!DASHSCOPE_KEY) throw new Error('DashScope API 密钥未配置 (环境变量 DASHSCOPE_API_KEY)');
  if (!image) throw new Error('缺少 image 参数 (base64 图片)');
  if (!prompt) throw new Error('缺少 prompt 参数');

  // 状态表瘦身：清掉已远超判定窗口的陈旧条目
  const now = Date.now();
  for (const [k, v] of repaintTaskState) {
    if (now - v.submittedAt > REPAINT_TIMEOUT_MS + 60 * 1000) repaintTaskState.delete(k);
  }

  // 负向词：qwen-image-3.0 无独立 negative_prompt 参数，折叠为自然语言排除指令
  const text = negativePrompt
    ? `${prompt}。画面中不要出现：${negativePrompt}`
    : prompt;

  const taskId = 'repaint-' + Date.now().toString(36) + '-' + Math.random().toString(36).slice(2, 10);
  const entry = { submittedAt: Date.now(), status: 'running', imageUrl: '', error: '' };

  // 同步调用（无 X-DashScope-Async 头）在后台执行，不阻塞 submit 响应
  const syncCall = fetch(`${DASHSCOPE_BASE}/services/aigc/multimodal-generation/generation`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${DASHSCOPE_KEY}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      model: REPAINT_MODEL,
      input: {
        messages: [
          { role: 'user', content: [{ image }, { text }] }
        ]
      }
    })
  }).then(async (r) => {
    const d = await r.json().catch(() => ({}));
    if (!r.ok) throw new Error(`图生图失败 ${r.status}: ${JSON.stringify(d).slice(0, 200)}`);
    // 同步响应：output.choices[0].message.content[] 中 type==='image' 项的 image 字段即结果 URL
    const content = d.output && d.output.choices && d.output.choices[0] &&
      d.output.choices[0].message && d.output.choices[0].message.content;
    const url = Array.isArray(content)
      ? content.map((c) => c.image || c.image_url || c.url).find(Boolean)
      : '';
    if (!url) throw new Error('图生图成功但未返回图片 URL');
    return url;
  });

  // promise 结束后回写 entry 状态（catch 已消化，不会 unhandledRejection）
  syncCall.then(
    (url) => { entry.status = 'succeeded'; entry.imageUrl = url; },
    (err) => { entry.status = 'failed'; entry.error = err.message || String(err); }
  );
  repaintTaskState.set(taskId, entry);
  return json(200, { taskId, provider: 'dashscope', model: REPAINT_MODEL });
}

async function handleImageRepaintQuery(taskId) {
  if (!taskId) throw new Error('缺少 taskId 参数');
  if (!DASHSCOPE_KEY) throw new Error('DashScope API 密钥未配置 (环境变量 DASHSCOPE_API_KEY)');

  // 坑5/6：RUNNING 超 150s 判失败 → 前端降级回层1 取景兜底
  const st = repaintTaskState.get(taskId);
  if (!st) return json(200, { status: 'failed', error: '任务不存在或已过期（服务重启后状态丢失），请重新提交' });
  if (Date.now() - st.submittedAt > REPAINT_TIMEOUT_MS) {
    repaintTaskState.delete(taskId);
    return json(200, { status: 'failed', error: `图生图任务超时 (>${REPAINT_TIMEOUT_MS / 1000}s)` });
  }

  if (st.status === 'succeeded') {
    repaintTaskState.delete(taskId);
    return json(200, { status: 'succeeded', imageUrl: st.imageUrl, provider: 'dashscope' });
  }
  if (st.status === 'failed') {
    repaintTaskState.delete(taskId);
    return json(200, { status: 'failed', error: st.error || '图生图任务失败' });
  }
  // running：同步调用仍在后台执行
  return json(200, { status: 'running' });
}

// ============================================================
// AI 文化识图：qwen3.6-flash 识别文化主体 + 云端知识库主题匹配
// 防幻觉第一步：识别仅判"看见了什么"，事实讲解交给 culture-story
// （2026-10-10 qwen-vl-max 下架，替换为 qwen3-vl 系官方推荐位 qwen3.6-flash，
//   实测：原生多模态端点 dataURL 输入兼容、严格 JSON 输出、识图质量优于旧模型）
// ============================================================
const VISION_RECOGNIZE_MODEL = 'qwen3.6-flash';
const VISION_RECOGNIZE_PROMPT = [
  '你是博物馆的文化鉴定专家。请识别这张图片中的文化主体（文物/建筑/技艺/纹样/民俗/戏曲等），',
  '严格只返回一个 JSON 对象（不要 markdown 代码块、不要多余文字），字段如下：',
  '{"subject":"主体名称，中文，尽量具体（如：青铜纵目面具、马头墙、青花缠枝莲纹瓶）",',
  '"category":"类别（如：青铜文明/传统建筑/陶瓷艺术/石窟艺术/传统戏曲/非物质文化遗产/传统服饰）",',
  '"era":"主体所处年代，一句话，不确定则写『年代不详』",',
  '"description":"对图片外观与细节的一段客观描述，80字以内"}',
  '如果图片与文化艺术无关，subject 返回 "非文化主体"。'
].join('\n');

/**
 * 宽容解析模型输出的 JSON（剥掉 ``` 代码围栏 / 截取首尾花括号）
 * @param {string} text
 */
function extractJson(text) {
  if (!text) return null;
  let t = String(text).replace(/```(?:json)?/gi, '').trim();
  const s = t.indexOf('{');
  const e = t.lastIndexOf('}');
  if (s < 0 || e <= s) return null;
  try {
    return JSON.parse(t.slice(s, e + 1));
  } catch {
    return null;
  }
}

async function handleVisionRecognize({ image }) {
  if (!DASHSCOPE_KEY) throw new Error('DashScope API 密钥未配置 (环境变量 DASHSCOPE_API_KEY)');
  if (!image) throw new Error('缺少 image 参数 (base64 图片)');

  const payload = {
    model: VISION_RECOGNIZE_MODEL,
    input: {
      messages: [
        {
          role: 'user',
          content: [
            { image },
            { text: VISION_RECOGNIZE_PROMPT }
          ]
        }
      ]
    }
  };

  const r = await fetch(`${DASHSCOPE_BASE}/services/aigc/multimodal-generation/generation`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${DASHSCOPE_KEY}`, 'Content-Type': 'application/json' },
    body: JSON.stringify(payload)
  });
  const d = await r.json();
  if (!r.ok) throw new Error(`qwen-vl 识图失败 ${r.status}: ${JSON.stringify(d).slice(0, 200)}`);

  const raw = extractQwenText(d);
  const parsed = extractJson(raw) || { subject: '', description: raw.slice(0, 120) };

  // 云端知识库匹配：识别文本命中事实卡 → 返回 themeId 供讲解注入
  const matchText = `${parsed.subject || ''} ${parsed.category || ''} ${parsed.description || ''}`;
  const theme = matchThemeByText(matchText);

  return json(200, {
    subject: parsed.subject || '未识别出文化主体',
    category: parsed.category || '',
    era: parsed.era || '',
    description: parsed.description || '',
    themeId: theme ? theme.themeId : null,
    themeName: theme ? theme.name : null,
    provider: 'dashscope',
    model: VISION_RECOGNIZE_MODEL
  });
}

// ============================================================
// 文化故事讲解：事实卡注入 + 降级链生成（防幻觉核心）
// - 知识库命中：讲解必须忠实转述 facts/legends，knowledgeBase: true
// - 未命中：云端大模型 + 联网搜索生成，knowledgeBase: false（前端标注"AI 生成，仅供参考"）
// - 降级链：阶段4 v4 模型重训后切 self-trained 优先（改 CULTURE_STORY_CHAIN 即可）
// ============================================================
const STORY_CHAIN = (process.env.CULTURE_STORY_CHAIN || 'dashscope,deepseek,mimo').split(',').map(s => s.trim()).filter(Boolean);

const STORY_SYSTEM = '你是一位严谨的博物馆金牌讲解员。你的讲解必须完全基于给定材料忠实转述，严禁编造史实、年代、数字与人名；材料中没有的信息用概括性语言带过，不许杜撰。输出必须是严格的 JSON，不要 markdown 代码块。';

function buildStoryPromptWithFacts(theme) {
  const facts = theme.facts.map((f) => `- ${f}`).join('\n');
  const legends = theme.legends.map((l) => `- ${l}`).join('\n');
  return [
    `【文化主题】${theme.name}（${theme.era}，${theme.region}）`,
    '',
    '【已核实的事实卡（讲解的唯一事实来源）】',
    facts,
    '',
    '【经典典故（legend 字段从中选取一条转述）】',
    legends,
    '',
    `请基于以上事实卡，为文化主题《${theme.name}》撰写讲解词，严格只返回如下 JSON：`,
    '{"name":"主题名","era":"一句话年代","connotation":"文化内涵讲解，180-280字，2-3个自然段（用\\n分段）","legend":"最经典的一个典故，100-160字","creationTip":"文创创作建议，50字以内"}',
    '硬性要求：connotation 与 legend 中出现的所有年代、数字、人名、地名必须来自事实卡；不得新增任何史实细节。'
  ].join('\n');
}

function buildStoryPromptOpen(subject, description) {
  return [
    `请介绍文化主体「${subject}」${description ? `（图片描述：${description}）` : ''}的历史与文化内涵。`,
    '',
    '严格只返回如下 JSON：',
    '{"name":"主体名","era":"一句话年代（不确定写 年代不详）","connotation":"文化内涵讲解，180-280字，2-3个自然段（用\\n分段）","legend":"相关的经典典故或背景故事，100-160字，没有可靠典故则概括其文化意义","creationTip":"文创创作建议，50字以内"}',
    '要求：内容需准确可靠，不确定的信息不要编造，年代与数字仅在确有把握时给出。'
  ].join('\n');
}

/** 讲解结果兜底校验：模型偶尔漏字段/破格式时补齐，保证前端契约稳定 */
function normalizeStory(obj, fallbackName) {
  const s = obj && typeof obj === 'object' ? obj : {};
  return {
    name: String(s.name || fallbackName || '文化主题').slice(0, 40),
    era: String(s.era || '年代不详').slice(0, 80),
    connotation: String(s.connotation || '').trim() || '暂无讲解内容，请稍后重试。',
    legend: String(s.legend || '').trim() || '暂无典故记载。',
    creationTip: String(s.creationTip || '').trim().slice(0, 120)
  };
}

// 自愈重试护栏：讲解输出结构校验（字段存在 + 汉字数下限，阈值略宽于验收线 120/80，
// 覆盖实测失败模式 legend 56-59 / connotation 103 / creationTip 缺失）
function isValidStoryOutput(story) {
  if (!story) return false;
  const han = (v) => (String(v || '').match(/[\u4e00-\u9fa5]/g) || []).length;
  return Boolean(story.era && story.era !== '年代不详')
    && Boolean(story.creationTip)
    && han(story.connotation) >= 110
    && han(story.legend) >= 60;
}

async function handleCultureStory({ themeId, subject, description }) {
  const theme = themeId ? getThemeById(themeId) : (subject ? matchThemeByText(subject) : null);

  // 方案 A 分级知识库：仅核心主题（有事实卡）走注入防幻觉；
  // 扩展主题有身份（themeId/themeName，供足迹点亮与图鉴跳转）但无事实卡，
  // 讲解走云端联网搜索，前端标注"AI 生成，仅供参考"。
  const isKnowledgeBase = hasFactCard(theme);
  const subjectText = subject || (theme ? theme.name : '');
  if (!isKnowledgeBase && !subjectText) throw new Error('缺少 themeId 或 subject 参数');
  const prompt = isKnowledgeBase
    ? buildStoryPromptWithFacts(theme)
    : buildStoryPromptOpen(subjectText, description || '');

  // 降级链：逐个尝试，全失败抛最后一个错误
  // 知识库命中时低温度（忠实转述）；未命中开启联网搜索（用户约束：可实时联网搜索景区主体）
  let lastErr = null;
  for (const provider of STORY_CHAIN) {
    try {
      const selfTrained = provider === 'self-trained';
      const callOpts = {
        prompt,
        system: STORY_SYSTEM,
        storyTask: true, // 自研链路走 v5 讲解专用模型 dreamcraft-story-1.5b:v5
        maxTokens: 1024,
        // v5 为 1.5B 小模型，高温放大 JSON/字数方差 → 自研链路固定低温 0.2（验收实测）
        temperature: selfTrained ? 0.2 : (isKnowledgeBase ? 0.3 : 0.7),
        search: !isKnowledgeBase // 仅 dashscope 支持 enable_search，其余 provider 静默忽略
      };
      const { text, provider: used } = await callTextProvider(provider, callOpts);
      let story = normalizeStory(extractJson(text), isKnowledgeBase ? theme.name : subjectText);
      // 自愈重试护栏：自研输出不达标（字数/缺字段）时原地重试一次（升温跳出坏模式），
      // 仍不达标抛错走降级链 → 有效通过率 ≈ 99%，演示时"自研微调模型"徽标更稳定
      if (selfTrained && !isValidStoryOutput(story)) {
        const retry = await callTextProvider(provider, { ...callOpts, temperature: 0.4 });
        const story2 = normalizeStory(extractJson(retry.text), isKnowledgeBase ? theme.name : subjectText);
        if (!isValidStoryOutput(story2)) throw new Error('自研模型讲解输出不达标（重试后仍失败），降级云模型');
        story = story2;
      }
      return json(200, {
        ...story,
        provider: used,
        knowledgeBase: isKnowledgeBase,
        // 两级主题均返回身份：核心=事实卡讲解，扩展=联网讲解；前端据此点亮足迹
        themeId: theme ? theme.themeId : null,
        themeName: theme ? theme.name : null
      });
    } catch (e) {
      lastErr = e;
    }
  }
  throw lastErr || new Error('文化故事生成失败（全部降级链不可用）');
}

// ============================================================
// 语音合成（TTS）：DashScope CosyVoice（复用现有 DASHSCOPE_API_KEY）
// 同步接口：POST /services/audio/tts → output.audio.url（24h 有效）
// 文本上限 2000 字符（cosyvoice-v2），超出截断
// ============================================================
async function handleTTS({ text, voice, model, rate, pitch }) {
  if (!DASHSCOPE_KEY) throw new Error('DashScope API 密钥未配置 (环境变量 DASHSCOPE_API_KEY)');
  const clean = String(text || '').trim();
  if (!clean) throw new Error('缺少 text 参数');
  const clipped = clean.length > 2000 ? clean.slice(0, 2000) : clean;
  const ttsModel = model || 'cosyvoice-v2';
  const r = await fetch(`${DASHSCOPE_BASE}/services/audio/tts/SpeechSynthesizer`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${DASHSCOPE_KEY}`, 'Content-Type': 'application/json' },
    // 2026 新格式：扁平 input（text/voice/format 同级），无 parameters 包装
    body: JSON.stringify({
      model: ttsModel,
      input: {
        text: clipped,
        voice: voice || 'longxiaochun_v2',
        format: 'mp3'
      }
    })
  });
  const d = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error(`CosyVoice 合成失败 ${r.status}: ${JSON.stringify(d).slice(0, 200)}`);
  const url = d && d.output && d.output.audio && d.output.audio.url;
  if (!url) throw new Error('CosyVoice 未返回音频地址');
  return json(200, {
    audioUrl: url,
    model: ttsModel,
    voice: voice || 'longxiaochun_v2',
    clipped: clipped.length < clean.length,
    expiresAt: (d.output.audio && d.output.audio.expires_at) || null
  });
}

// ============================================================
// 健康检查：各服务商可达性 + 密钥配置状态
// ============================================================
async function handleHealth() {
  const [dash, deep, mimo, self] = await Promise.all([
    ping('https://dashscope.aliyuncs.com'),
    ping('https://api.deepseek.com'),
    ping(MIMO_BASE),
    ping(SELF_TRAINED_BASE)
  ]);
  return json(200, {
    dashscope: { available: !!DASHSCOPE_KEY && dash, keyConfigured: !!DASHSCOPE_KEY },
    deepseek: { available: !!DEEPSEEK_KEY && deep, keyConfigured: !!DEEPSEEK_KEY },
    mimo: { available: !!MIMO_KEY && mimo, keyConfigured: !!MIMO_KEY },
    selfTrained: { available: self, model: SELF_TRAINED_MODEL, base: SELF_TRAINED_BASE }
  });
}
