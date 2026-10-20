// ppt-verify.mjs — 验证 HTML 版：页数 / 图片加载 / 元素溢出 / 关键页截图
import { chromium } from 'playwright';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..');
const FILE = 'file:///' + path.join(ROOT, 'Dreamcore-路演PPT-v1.0.html').replace(/\\/g, '/');
const SHOTS = path.join(ROOT, 'logs', 'ppt-verify');
fs.mkdirSync(SHOTS, { recursive: true });

let browser;
try { browser = await chromium.launch({ channel: 'msedge', headless: true }); }
catch { browser = await chromium.launch({ headless: true }); }

const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
await page.goto(FILE, { waitUntil: 'load', timeout: 60000 });
await page.waitForTimeout(800);
// 固定缩放 1:1
await page.evaluate(() => { document.getElementById('deck').style.transform = 'scale(1)'; });

const total = await page.evaluate(() => document.querySelectorAll('.slide').length);
console.log('页数:', total, total === 20 ? '✓' : '✗ 应为 20');

const imgFail = await page.evaluate(() => Array.from(document.querySelectorAll('img')).filter(i => !i.complete || i.naturalWidth === 0).length);
console.log('未加载图片:', imgFail, imgFail === 0 ? '✓' : '✗');

// 逐页激活 + 溢出检测 + 关键页截图
const KEY = { 1: '01-cover', 2: '02-pitch', 7: '07-demo1', 9: '09-demo3', 10: '10-demo4', 13: '13-model', 14: '14-eng', 17: '17-finance' };
let overflowCount = 0;
for (let i = 0; i < total; i++) {
  await page.evaluate((idx) => {
    const slides = Array.from(document.querySelectorAll('.slide'));
    slides.forEach((s, j) => s.classList.toggle('active', j === idx));
  }, i);
  await page.waitForTimeout(120);
  const ov = await page.evaluate(() => {
    const deck = document.getElementById('deck');
    const dr = deck.getBoundingClientRect();
    const bad = [];
    Array.from(deck.querySelectorAll('.active *')).forEach((el) => {
      const r = el.getBoundingClientRect();
      if (r.width === 0 && r.height === 0) return;
      if (r.right > dr.right + 2 || r.bottom > dr.bottom + 2 || r.left < dr.left - 2 || r.top < dr.top - 2) {
        const cls = (el.className && el.className.baseVal !== undefined) ? String(el.className.baseVal || el.className) : String(el.className || el.tagName);
        bad.push(`${el.tagName}.${cls.slice(0, 30)} → L${Math.round(r.left - dr.left)} T${Math.round(r.top - dr.top)} R${Math.round(r.right - dr.right)} B${Math.round(r.bottom - dr.bottom)}`);
      }
    });
    return bad.slice(0, 5);
  });
  if (ov.length) { overflowCount++; console.log(`页${i + 1}: 溢出警告`, ov); }
  if (KEY[i + 1]) await page.screenshot({ path: path.join(SHOTS, KEY[i + 1] + '.png') });
}
console.log('溢出页数:', overflowCount, overflowCount === 0 ? '✓' : '↑ 需检查');

await browser.close();
console.log('关键页截图已存至', SHOTS);