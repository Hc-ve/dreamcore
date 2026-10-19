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

import { spawn } from 'child_process';
import path from 'node:path';
import fs from 'node:fs';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..');
const IS_WIN = process.platform === 'win32';

// ─── 服务定义 ────────────────────────────────────────────────────────
// ollama.exe 路径（绝对路径，避免 CWD 偏移）
const OLLAMA_DIR = path.join(ROOT, 'training-env');
const OLLAMA_EXE = path.join(OLLAMA_DIR, 'ollama', IS_WIN ? 'ollama.exe' : 'ollama');
const OLLAMA_MODELS = path.join(OLLAMA_DIR, 'ollama-models');

const isPortOpen = (port) =>
  new Promise((resolve) => {
    import('node:net').then((net) => {
      const s = net.connect({ port });
      s.once('connect', () => { s.destroy(); resolve(true); });
      s.once('error', () => resolve(false));
    });
  });

// ollama 是否已在运行（端口 11434 已监听）
const ollamaUp = await isPortOpen(11434);
if (ollamaUp) {
  console.log('[ollama] 11434 已被占用，跳过启动（需手动处理若为僵死进程）');
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

if (!ollamaUp && fs.existsSync(OLLAMA_EXE)) {
  services.push({
    name: 'ollama',
    cmd: OLLAMA_EXE,
    args: ['serve'],
    cwd: path.dirname(OLLAMA_EXE),
    env: {
      ...process.env,
      OLLAMA_MODELS: OLLAMA_MODELS,
      OLLAMA_KEEP_ALIVE: '12h',
    },
    skip: false,
  });
} else if (!ollamaUp && !fs.existsSync(OLLAMA_EXE)) {
  console.log('[ollama] 未找到 ' + OLLAMA_EXE + '，跳过启动');
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
    shell: IS_WIN, // Windows 下必须 shell:true 才能正确解析 PATH
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

console.log('\n全部服务已拉起。按 Ctrl+C 终止所有进程。\n');
