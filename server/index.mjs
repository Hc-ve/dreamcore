/**
 * server/index.mjs — Node.js 内置 http 模块 GLB UV 预处理 BFF
 *
 * 单端点：POST /api/uv/process
 * 零依赖（不引 express/fastify），纯 Node 18+ http.createServer
 *
 * 启动: node server/index.mjs
 * 默认端口 3001
 */

import http from 'node:http';
import { processGlb, hasStrategy, VALID_FORM3DS, UV_STRATEGIES } from '../tools/uv-processor/index.mjs';

const PORT = process.env.PORT || 3001;

function send(res, status, json) {
  const body = JSON.stringify(json);
  res.writeHead(status, {
    'Content-Type': 'application/json; charset=utf-8',
    'Content-Length': Buffer.byteLength(body),
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
  });
  res.end(body);
}

function readJson(req) {
  return new Promise((resolve, reject) => {
    let chunks = [];
    req.on('data', c => chunks.push(c));
    req.on('end', () => {
      try {
        const raw = Buffer.concat(chunks).toString('utf-8');
        resolve(raw ? JSON.parse(raw) : {});
      } catch (e) { reject(e); }
    });
    req.on('error', reject);
  });
}

async function handleProcess(req, res, body) {
  const start = Date.now();

  // 参数校验
  const form3d = (body.form3d || '').toString().trim();
  if (!form3d) {
    return send(res, 400, { ok: false, error: 'missing form3d' });
  }

  const glbBase64 = body.glbBase64;
  if (!glbBase64 || typeof glbBase64 !== 'string') {
    return send(res, 400, { ok: false, error: 'missing glbBase64' });
  }

  // 解码
  const inputBuf = Buffer.from(glbBase64, 'base64');
  if (inputBuf.length < 4 || inputBuf.toString('ascii', 0, 4) !== 'glTF') {
    return send(res, 400, { ok: false, error: 'invalid GLB magic: ' + inputBuf.toString('ascii', 0, 4) });
  }

  console.log(`[UV-BFF] process form3d=${form3d} (${(inputBuf.length/1024/1024).toFixed(1)}MB)`);

  try {
    const { buffer: outBuf, stats } = await processGlb(inputBuf.buffer.slice(inputBuf.byteOffset, inputBuf.byteOffset + inputBuf.byteLength), form3d, { normalize: true });

    const outBase64 = Buffer.from(outBuf).toString('base64');
    const cost = Date.now() - start;

    const strategyUsed = stats.strategy;
    const strat = UV_STRATEGIES[strategyUsed];

    console.log(`[UV-BFF] ✅ ${cost}ms triangles=${Math.round(stats.triangles)} strategy=${strategyUsed} thickness=${stats.thicknessScale}x`);

    return send(res, 200, {
      ok: true,
      form3d: stats.form3d,
      strategy: strategyUsed,
      strategyLayout: strat ? strat.layout : null,
      strategyFlipU: strat ? strat.flipU : null,
      meshCount: stats.meshCount,
      triangles: Math.round(stats.triangles),
      vertexCount: Math.round(stats.triangles) * 3,
      inputBytes: stats.inputBytes,
      outputBytes: stats.outputBytes,
      thicknessEnforced: stats.thicknessEnforced,
      thicknessScale: stats.thicknessScale,
      ms: cost,
      glbBase64: outBase64,
    });
  } catch (err) {
    console.error('[UV-BFF] ❌', err.message);
    console.error(err.stack);
    return send(res, 500, { ok: false, error: err.message || String(err) });
  }
}

const server = http.createServer(async (req, res) => {
  const url = req.url || '';

  if (req.method === 'OPTIONS') {
    res.writeHead(204, {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type',
    });
    return res.end();
  }

  // 健康检查
  if (req.method === 'GET' && (url === '/' || url === '/health' || url === '/api/uv/strategies')) {
    if (url === '/api/uv/strategies') {
      return send(res, 200, {
        ok: true,
        strategies: VALID_FORM3DS,
        total: VALID_FORM3DS.length,
      });
    }
    return send(res, 200, { ok: true, service: 'uv-bff', port: PORT });
  }

  if (req.method === 'POST' && url === '/api/uv/process') {
    try {
      const body = await readJson(req);
      return await handleProcess(req, res, body);
    } catch (e) {
      return send(res, 400, { ok: false, error: 'invalid JSON: ' + e.message });
    }
  }

  return send(res, 404, { ok: false, error: 'not found: ' + req.method + ' ' + url });
});

server.listen(PORT, () => {
  console.log('='.repeat(50));
  console.log('🟢 UV 预处理 BFF 已启动');
  console.log(`   POST http://localhost:${PORT}/api/uv/process`);
  console.log(`   GET  http://localhost:${PORT}/api/uv/strategies`);
  console.log(`   支持策略: ${VALID_FORM3DS.length} 种`);
  console.log('='.repeat(50));
});
