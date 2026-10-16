// 临时验证脚本：DashScope qwen-image-3.0 同步模式（无 X-DashScope-Async 头）响应格式探测
import { readFileSync } from 'node:fs';
const env = readFileSync(new URL('../.env', import.meta.url), 'utf8');
const key = (env.match(/^DASHSCOPE_API_KEY=(.+)$/m) || [])[1]?.trim();
if (!key) { console.error('no key'); process.exit(1); }

const t0 = Date.now();
// 用真实作品图（public/images/artworks/gen-001.jpg）
const imgB64 = readFileSync(new URL('../public/images/artworks/gen-001.jpg', import.meta.url)).toString('base64');
const r = await fetch('https://dashscope.aliyuncs.com/api/v1/services/aigc/multimodal-generation/generation', {
  method: 'POST',
  headers: { Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' },
  body: JSON.stringify({
    model: 'qwen-image-3.0',
    input: { messages: [{ role: 'user', content: [
      { image: `data:image/jpeg;base64,${imgB64}` },
      { text: '国风工笔画，徽派建筑，圆形窗景' }
    ] }] }
  })
});
const d = await r.json().catch(() => ({}));
console.log('HTTP', r.status, 'elapsed', ((Date.now() - t0) / 1000).toFixed(1) + 's');
console.log(JSON.stringify(d, null, 2).slice(0, 1500));
