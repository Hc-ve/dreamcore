#!/usr/bin/env node
/**
 * Dreamcore 一键启动：Vite 前端 + UV BFF + ollama 自持模型
 * 用法：npm run dev / npm run start / npm run dev:all / node scripts/dev-all.mjs
 * 注意：本脚本内部用 `npm run dev:vite` 拉起 Vite（`dev` 已指向本脚本，直接写 dev 会递归）
 *
 * 特性：
 *   - 并行拉起三个服务，输出加前缀区分
 *   - Windows 自动用 npm.cmd 规避 ENOENT
 *   - Ctrl+C / 任一子进程退出 → 统一回收全部子进程（fail-fast）
 *   - ollama 直接 spawn ollama.exe 而非跑 ps1，纳入子进程管理
 */

import { spawn, spawnSync } from 'child_process';
import path from 'node:path';
import fs from 'node:fs';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..');
const IS_WIN = process.platform === 'win32';

// ─── 服务定义 ────────────────────────────────────────────────────────
// 自研模型（dreamcraft-1.5b:v6 文创 + dreamcraft-story-1.5b:v5 讲解）存放在该目录，
// 必须通过 OLLAMA_MODELS 传给 ollama 才可见；否则会退化成"看不到任何模型"的空实例。
const OLLAMA_MODELS = path.join(ROOT, 'training-env', 'ollama-models');

// ollama.exe 多候选定位：项目内置目录 → 官方安装目录 → PATH
function resolveOllamaExe() {
  const exeName = IS_WIN ? 'ollama.exe' : 'ollama';
  const candidates = [
    path.join(ROOT, 'training-env', 'ollama', exeName),
    process.env.LOCALAPPDATA && path.join(process.env.LOCALAPPDATA, 'Programs', 'Ollama', exeName),
    process.env.ProgramFiles && path.join(process.env.ProgramFiles, 'Ollama', exeName),
  ].filter(Boolean);
  for (const c of candidates) if (fs.existsSync(c)) return c;
  try {
    const r = spawnSync(IS_WIN ? 'where.exe' : 'which', ['ollama'], { encoding: 'utf8' });
    const hit = (r.stdout || '')
      .split(/\r?\n/)
      .map((s) => s.trim())
      .find((s) => s && fs.existsSync(s));
    if (hit) return hit;
  } catch { /* PATH 中未安装 → 落空 */ }
  return null;
}

const OLLAMA_EXE = resolveOllamaExe();

// 已运行的 ollama 能否看到本项目模型（官方桌面版可能用默认空模型目录抢占 11434）
function ollamaSeesModels(exe) {
  if (!exe) return false;
  try {
    const r = spawnSync(exe, ['list'], {
      encoding: 'utf8',
      timeout: 20000,
      env: { ...process.env, OLLAMA_MODELS },
    });
    return /dreamcraft/i.test(r.stdout || '');
  } catch { return false; }
}

const isPortOpen = (port) =>
  new Promise((resolve) => {
    import('node:net').then((net) => {
      const s = net.connect({ port });
      s.on('connect', () => { s.destroy(); resolve(true); });
      s.on('error', () => resolve(false));
    });
  });

// ollama 就绪判定：不仅要端口通，还要能看到 Dreamcore 模型
const ollamaUp = await isPortOpen(11434);
const ollamaReady = ollamaUp && ollamaSeesModels(OLLAMA_EXE);
let needStartOllama = !!OLLAMA_EXE;

if (ollamaReady) {
  needStartOllama = false;
  console.log('[ollama] 11434 已就绪（Dreamcore 模型可见），复用现有实例');
} else if (ollamaUp) {
  // 端口被占但看不到本项目模型 → 判定为占坑的空实例，回收后由本脚本重启
  console.log('[ollama] 11434 被占用但看不到 Dreamcore 模型，回收旧进程后重启');
  for (const img of (IS_WIN ? ['ollama.exe', 'ollama app.exe'] : ['ollama'])) {
    spawnSync(IS_WIN ? 'taskkill' : 'pkill',
      IS_WIN ? ['/IM', img, '/F', '/T'] : ['-f', img],
      { stdio: 'ignore' });
  }
  for (let i = 0; i < 20 && (await isPortOpen(11434)); i++) {
    await new Promise((r) => setTimeout(r, 500));
  }
} else if (!OLLAMA_EXE) {
  needStartOllama = false;
  console.log('[ollama] 未找到 ollama 可执行文件，跳过启动（AI 将走云端降级链）');
}

// UV BFF 是否已在运行（默认 3001，可被 PORT 环境变量覆盖）
// 已监听则复用：否则 bff-uv 会 EADDRINUSE 退出 → fail-fast 连带把 Vite/ollama 一起拉停
//（Vite 端口被占用会自动顺延到 5174，无需处理）
const UV_PORT = Number(process.env.PORT || 3001);
const uvUp = await isPortOpen(UV_PORT);
if (uvUp) {
  console.log(`[bff-uv] ${UV_PORT} 已被占用，跳过启动（复用已有 UV BFF）`);
}

const services = [
  {
    name: 'vite',
    cmd: IS_WIN ? 'npm.cmd' : 'npm',
    args: ['run', 'dev:vite'],  // 必须走 dev:vite —— 若写 'dev' 会递归调回 dev-all.mjs
    cwd: ROOT,
    env: process.env,
    skip: false,
  },
  {
    name: 'bff-uv',
    cmd: IS_WIN ? 'npm.cmd' : 'npm',
    args: ['run', 'server:uv'],
    cwd: ROOT,
    env: process.env,
    skip: uvUp,   // 3001 已监听则复用已有 BFF，避免 EADDRINUSE → fail-fast 拉停全部服务
  },
];

if (needStartOllama && OLLAMA_EXE) {
  services.push({
    name: 'ollama',
    cmd: OLLAMA_EXE,
    args: ['serve'],
    cwd: path.dirname(OLLAMA_EXE),
    env: {
      ...process.env,
      OLLAMA_MODELS: OLLAMA_MODELS,
      OLLAMA_KEEP_ALIVE: '12h',   // 不要加 KV 量化/FlashAttention（会拉低合规率）
    },
    shell: false,   // 绝对路径 exe，交给 shell 反而有引号/空格风险
    skip: false,
  });
}

// ─── 并行启动 ───────────────────────────────────────────────────────
const children = new Map(); // name -> ChildProcess
let shuttingDown = false;

function killAll() {
  if (shuttingDown) return;
  shuttingDown = true;
  for (const [name, cp] of children) {
    if (cp.exitCode === null) {
      console.log(`[shutdown] 终止 ${name} (pid ${cp.pid})`);
      cp.kill('SIGKILL');
    }
  }
}

for (const svc of services) {
  if (svc.skip) continue;
  console.log(`[spawn] ${svc.name} → ${svc.cmd} ${svc.args.join(' ')}`);
  const cp = spawn(svc.cmd, svc.args, {
    cwd: svc.cwd,
    env: svc.env,
    stdio: ['ignore', 'pipe', 'pipe'],
    // npm/npm.cmd 需要 shell 解析 PATH；ollama 是绝对路径 exe，走 shell:false
    shell: svc.shell === undefined ? IS_WIN : svc.shell,
    windowsHide: false,
  });

  const prefix = `[${svc.name}]`;
  const tagLine = (buf) =>
    buf.toString().split('\n').forEach((line) => {
      if (line.trim()) console.log(`${prefix} ${line}`);
    });

  cp.stdout.on('data', tagLine);
  cp.stderr.on('data', tagLine);

  cp.on('error', (err) => {
    console.error(`${prefix} 启动失败: ${err.message}`);
    killAll();
    process.exit(1);
  });

  cp.on('close', (code, signal) => {
    console.log(`${prefix} 退出 (code=${code}, signal=${signal})`);
    if (!shuttingDown && code !== 0) {
      // fail-fast：任一子进程非 0 退出 → 全部回收
      console.error(`${prefix} 异常退出，终止所有服务`);
      killAll();
      process.exit(code ?? 1);
    }
  });

  children.set(svc.name, cp);
}

// ─── 生命周期钩子 ───────────────────────────────────────────────────
const exitHandler = () => { killAll(); process.exit(0); };
process.on('SIGINT', exitHandler);
process.on('SIGTERM', exitHandler);
process.on('exit', killAll);

// Windows 下 Ctrl+C 需要显式触发 exit
if (IS_WIN) {
  process.on('SIGBREAK', exitHandler);
}

const ollamaLine = ollamaReady ? '复用已运行实例' : (OLLAMA_EXE ? '已启动' : '未找到，跳过');
console.log('\n' + '─'.repeat(60));
console.log('全部服务已拉起，按 Ctrl+C 终止所有进程');
console.log(`  前端页面  http://localhost:5173/        （浏览器会自动打开）`);
console.log(`  UV BFF    http://localhost:${UV_PORT}/api/uv/process`);
console.log(`  ollama    http://127.0.0.1:11434        （${ollamaLine}，模型目录 training-env/ollama-models）`);
console.log('─'.repeat(60) + '\n');
