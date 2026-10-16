/**
 * P0-A 风格主题修复冒烟验证
 * 验证 localStorage 设置 dreamcore-particle-theme='guofeng' 后：
 *   STEP1 (HEAD 脚本阶段) 与 STEP2 (Settings.init 后) 的 data-style、--bg-dark、--accent
 *
 * 关键断言：
 *   style    = "guofeng"
 *   bg-dark  = "#f7f1e5"   （国风浅色，而非默认墨韵丹青 #faf6ee）
 *   accent   = "#c23e2b"   （国风朱砂）
 */
import { chromium } from 'playwright';

const EDGE = 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe';

const browser = await chromium.launch({
  executablePath: EDGE,
  channel: 'msedge',
  headless: true,
});

// 用 storageState 在上下文创建时就注入 localStorage，这样 HEAD 脚本首次读取就能拿到
const ctx = await browser.newContext({
  viewport: { width: 1280, height: 800 },
  storageState: {
    cookies: [],
    origins: [
      {
        origin: 'http://localhost:5173',
        localStorage: [
          { name: 'dreamcore-particle-theme', value: 'guofeng' },
        ],
      },
    ],
  },
});

const page = await ctx.newPage();

// 收集 console.log 输出
const logs = [];
page.on('console', msg => {
  const text = msg.text();
  logs.push(text);
  console.log('[BROWSER]', text);
});

// 导航到页面 —— HEAD 脚本会立即读取 localStorage 的 guofeng
await page.goto('http://localhost:5173/', { waitUntil: 'domcontentloaded', timeout: 30000 });

// STEP1：页面刚加载完（domcontentloaded），此时 HEAD 脚本已执行，Settings.init 可能还未完成
const step1 = await page.evaluate(() => {
  const styleAttr = document.documentElement.getAttribute('data-style');
  const bgDark = getComputedStyle(document.documentElement).getPropertyValue('--bg-dark').trim();
  const accent = getComputedStyle(document.documentElement).getPropertyValue('--accent').trim();
  return { styleAttr, bgDark, accent };
});
console.log('STEP1 style=', step1.styleAttr, 'bg-dark=', step1.bgDark, 'accent=', step1.accent);

// STEP2：等 2s 让 Settings.init 完成
await page.waitForTimeout(2000);
const step2 = await page.evaluate(() => {
  const s2 = document.documentElement.getAttribute('data-style');
  const b2 = getComputedStyle(document.documentElement).getPropertyValue('--bg-dark').trim();
  const a2 = getComputedStyle(document.documentElement).getPropertyValue('--accent').trim();
  return { styleAttr: s2, bgDark: b2, accent: a2 };
});
console.log('STEP2 style=', step2.styleAttr, 'bg-dark=', step2.bgDark, 'accent=', step2.accent);

// 关键断言检查
const EXPECTED = {
  style: 'guofeng',
  bgDark: '#f7f1e5',
  accent: '#c23e2b',
};

function check(label, actual, expected) {
  const ok = actual === expected;
  console.log(`${ok ? '✅' : '❌'} ${label}: actual="${actual}" expected="${expected}"`);
  return ok;
}

console.log('\n=== 断言检查 ===');
const results = [
  check('STEP1.style', step1.styleAttr, EXPECTED.style),
  check('STEP1.bg-dark', step1.bgDark, EXPECTED.bgDark),
  check('STEP1.accent', step1.accent, EXPECTED.accent),
  check('STEP2.style', step2.styleAttr, EXPECTED.style),
  check('STEP2.bg-dark', step2.bgDark, EXPECTED.bgDark),
  check('STEP2.accent', step2.accent, EXPECTED.accent),
];

const allPassed = results.every(Boolean);
console.log(allPassed ? '\n🎉 P0-A 冒烟验证全部通过' : '\n⚠️  存在失败项，需要修复');

await browser.close();
process.exit(allPassed ? 0 : 1);
