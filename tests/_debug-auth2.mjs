import { chromium } from 'playwright';
const browser = await chromium.launch({ channel: 'msedge', headless: true, args: ['--disable-remote-fonts'] });
const g = await browser.newContext({ viewport: { width: 1280, height: 900 } });
const p = await g.newPage();
await p.addInitScript(() => {
  Object.defineProperty(document, 'fonts', { get() { return { ready: Promise.resolve() }; } });
  localStorage.clear();
  localStorage.setItem('hasVisited', '1');
  localStorage.setItem('currentUser', JSON.stringify({ id: 1, username: 'testuser', email: 'test@example.com' }));
  console.log('INITSCRIPT currentUser:', localStorage.getItem('currentUser'));
});
// 等待 main.js 执行后再看
await p.goto('http://localhost:5173/', { waitUntil: 'domcontentloaded' });
await p.waitForTimeout(3500);
const r = await p.evaluate(() => ({
  ls_cu: localStorage.getItem('currentUser'),
  ls_all: Object.keys(localStorage).reduce((a,k)=>{a[k]=localStorage.getItem(k);return a;},{}),
  wcu: typeof window.currentUser !== 'undefined' ? JSON.stringify(window.currentUser) : 'undef',
  wac: window.Auth ? (window.Auth.getCurrentUser ? JSON.stringify(window.Auth.getCurrentUser()) : 'no getCurrentUser') : 'no Auth',
}));
console.log(JSON.stringify(r, null, 2));
await browser.close();
