import { chromium } from 'playwright';
const browser = await chromium.launch({ channel: 'msedge', headless: true, args: ['--disable-remote-fonts'] });
const g = await browser.newContext({ viewport: { width: 1280, height: 900 } });
const p = await g.newPage();
await p.addInitScript(() => {
  Object.defineProperty(document, 'fonts', { get() { return { ready: Promise.resolve() }; } });
  localStorage.clear();
  localStorage.setItem('hasVisited', '1');
  localStorage.setItem('currentUser', JSON.stringify({ id: 1, username: 'testuser', email: 'test@example.com' }));
});
await p.goto('http://localhost:5173/#/settings?tab=profile', { waitUntil: 'domcontentloaded' });
await p.waitForTimeout(3500);
const r = await p.evaluate(() => ({
  wcu: typeof window.currentUser !== 'undefined' ? JSON.stringify(window.currentUser) : 'undef',
  wac: window.Auth ? (window.Auth.getCurrentUser ? JSON.stringify(window.Auth.getCurrentUser()) : 'no getCurrentUser') : 'no Auth',
  host: !!document.getElementById('__settings_host'),
  locked: !!document.querySelector('.sp-auth-locked'),
}));
console.log(JSON.stringify(r, null, 2));
await browser.close();
