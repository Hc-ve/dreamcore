/* Main-agent 确定性后处理：把 partials/components.css 注入各页占位符 */
const fs = require('fs');
const path = require('path');
const root = __dirname;
const css = fs.readFileSync(path.join(root, 'partials', 'components.css'), 'utf8');
const pagesDir = path.join(root, 'pages');
const files = fs.readdirSync(pagesDir).filter(f => f.endsWith('.html'));
let n = 0;
for (const f of files) {
  const p = path.join(pagesDir, f);
  let s = fs.readFileSync(p, 'utf8');
  if (s.includes('/*__COMPONENTS__*/')) {
    s = s.replace('/*__COMPONENTS__*/', () => css);
    fs.writeFileSync(p, s, 'utf8');
    n++;
    console.log('injected:', f);
  } else {
    console.log('skip (no placeholder):', f);
  }
}
console.log('TOTAL', n);
