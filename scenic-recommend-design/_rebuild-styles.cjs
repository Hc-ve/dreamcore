/* 幂等重建：把 令牌层(colors_and_type.css) + 组件层(components.css) 合并写入每页 <style id="prototype-components"> */
const fs = require('fs');
const path = require('path');
const root = __dirname;
const tokens = fs.readFileSync(path.join(root, 'colors_and_type.css'), 'utf8');
const components = fs.readFileSync(path.join(root, 'partials', 'components.css'), 'utf8');
const merged = `/* ===== design tokens (1:1 from product) ===== */\n${tokens}\n/* ===== shared component library ===== */\n${components}`;
const pagesDir = path.join(root, 'pages');
let n = 0;
for (const f of fs.readdirSync(pagesDir).filter(f => f.endsWith('.html'))) {
  const p = path.join(pagesDir, f);
  let s = fs.readFileSync(p, 'utf8');
  const re = /<style id="prototype-components">[\s\S]*?<\/style>/;
  if (re.test(s)) {
    s = s.replace(re, () => `<style id="prototype-components">\n${merged}\n</style>`);
    fs.writeFileSync(p, s, 'utf8');
    n++;
    console.log('rebuilt:', f);
  } else {
    console.log('!! style block missing:', f);
  }
}
console.log('TOTAL', n);
