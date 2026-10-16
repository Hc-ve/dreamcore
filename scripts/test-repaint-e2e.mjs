// 临时端到端验证：图生图 提交/轮询 新契约（同步后台 promise 模式）
import { readFileSync } from 'node:fs';

const imgB64 = readFileSync(new URL('../public/images/artworks/gen-002.jpg', import.meta.url)).toString('base64');

const t0 = Date.now();
const sub = await fetch('http://127.0.0.1:5173/api/ai/image-repaint-submit', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    prompt: '国风工笔画，徽派建筑，圆形窗景构图',
    image: `data:image/jpeg;base64,${imgB64}`,
    negativePrompt: '文字,水印'
  })
});
const subData = await sub.json();
console.log(`[submit] HTTP ${sub.status} +${((Date.now() - t0) / 1000).toFixed(1)}s →`, JSON.stringify(subData));
if (sub.status !== 200 || !subData.taskId) { console.error('SUBMIT FAILED'); process.exit(1); }

let result;
let polls = 0;
while (Date.now() - t0 < 150 * 1000) {
  await new Promise((r) => setTimeout(r, 3000));
  polls++;
  const q = await fetch(`http://127.0.0.1:5173/api/ai/image-repaint-query?taskId=${encodeURIComponent(subData.taskId)}`);
  const qd = await q.json().catch(() => ({}));
  if (qd.status === 'succeeded') { result = qd; break; }
  if (qd.status === 'failed') { console.error(`[query#${polls}] FAILED:`, qd.error); process.exit(1); }
  process.stdout.write(`[query#${polls}] running +${((Date.now() - t0) / 1000).toFixed(0)}s\r`);
}
if (!result) { console.error('TIMEOUT 150s'); process.exit(1); }
console.log(`\n[succeed] +${((Date.now() - t0) / 1000).toFixed(1)}s, ${polls} polls`);
console.log('imageUrl:', (result.imageUrl || '').slice(0, 100) + '...');

// 验证图片 URL 可下载
const img = await fetch(result.imageUrl);
console.log('image download:', img.status, img.headers.get('content-type'));
process.exit(0);
