import fs from 'node:fs';
const c = fs.readFileSync('data/craft-products.js', 'utf8');
// 搜 shouzhang 产品（category 里的不算）
const lines = c.split('\n');
const start = lines.findIndex(l => l.includes('key:') && l.includes('shouzhang') && !l.includes('stationery'));
console.log('shouzhang product lines:', start);
if (start >= 0) {
  const block = lines.slice(start, start + 15).join('\n');
  console.log(block);
  // 看后面有没有 customModel / glb / file 字段
  for (let i = start; i < Math.min(start + 30, lines.length); i++) {
    const l = lines[i];
    if (/glb|model|file|form3d|custom/i.test(l)) console.log('  L' + i + ':', l.trim().slice(0, 120));
    if (l.trim() === '},' || l.trim() === '};') { console.log('  (end of block)'); break; }
  }
}
