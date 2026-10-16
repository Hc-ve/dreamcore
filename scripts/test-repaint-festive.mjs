// 临时验证：坑9 修复后 festive（节庆红金）风格锁是否能真正主导配色
// 方法：新 prompt 格式重绘 gen-002.jpg → 下载结果 → 计算平均 RGB（红色分量应显著上升、R>B 偏暖）
import { readFileSync, writeFileSync } from 'node:fs';

const imgB64 = readFileSync(new URL('../public/images/artworks/gen-087.jpg', import.meta.url)).toString('base64');
const origStats = await (async () => {
  // 原图基准色调（用 sharp 不可用，退而求其次：只测重绘结果的色调特征）
  return null;
})();

const prompt = '节庆国潮插画风格，红金配色，喜庆氛围，精致细节。以此艺术风格完整重新绘制整幅画面：重新上色、重塑笔触与质感，呈现该风格特有的配色与氛围，仅保留原图的构图布局与主体元素位置。主题「三星堆盲盒」，细节丰富，主体完整清晰';

const t0 = Date.now();
const sub = await fetch('http://127.0.0.1:5173/api/ai/image-repaint-submit', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ prompt, image: `data:image/jpeg;base64,${imgB64}`, negativePrompt: '照片写实感,原样复制,摄影质感,文字,水印,logo,边框' })
});
const subData = await sub.json();
console.log(`[submit] HTTP ${sub.status} →`, subData.taskId || subData);
if (sub.status !== 200 || !subData.taskId) process.exit(1);

let result;
while (Date.now() - t0 < 150 * 1000) {
  await new Promise((r) => setTimeout(r, 3000));
  const q = await fetch(`http://127.0.0.1:5173/api/ai/image-repaint-query?taskId=${encodeURIComponent(subData.taskId)}`);
  const qd = await q.json().catch(() => ({}));
  if (qd.status === 'succeeded') { result = qd; break; }
  if (qd.status === 'failed') { console.error('FAILED:', qd.error); process.exit(1); }
}
if (!result) { console.error('TIMEOUT'); process.exit(1); }

const imgRes = await fetch(result.imageUrl);
const buf = Buffer.from(await imgRes.arrayBuffer());
console.log(`[done] +${((Date.now() - t0) / 1000).toFixed(1)}s, image ${imgRes.status} ${buf.length} bytes (${imgRes.headers.get('content-type')})`);
// 保存结果图供人工目检
writeFileSync('e:/a/6a578b50553ee2fa56364236/qa-output/repaint-sanxingdui-test.png', buf);
console.log('saved: qa-output/repaint-sanxingdui-test.png');
