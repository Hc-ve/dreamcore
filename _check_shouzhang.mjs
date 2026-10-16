import fs from 'node:fs';
const c = fs.readFileSync('data/craft-products.js', 'utf8');
// 找 shouzhang 产品定义块
const re = /\{[\s\S]*?key:\s*'shouzhang'[\s\S]*?\n\}/;
const m = c.match(re);
if (m) {
  console.log('=== shouzhang product definition ===');
  console.log(m[0].slice(0, 1000));
} else {
  console.log('NOT FOUND — trying key: "shouzhang" with double quotes');
  const re2 = /\{[\s\S]*?key:\s*"shouzhang"[\s\S]*?\n\}/;
  const m2 = c.match(re2);
  console.log(m2 ? m2[0].slice(0, 1000) : 'STILL NOT FOUND');
}
