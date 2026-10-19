import { chromium } from 'playwright';
const browser = await chromium.launch({ channel: 'msedge', headless: true, args: ['--disable-remote-fonts'] });
const ctx = await browser.newContext({ viewport: { width: 1280, height: 900 } });
const p = await ctx.newPage();
await p.addInitScript(() => {
  Object.defineProperty(document, 'fonts', { get() { return { ready: Promise.resolve(), addEventListener: () => {}, load: () => Promise.resolve() }; } });
  try { localStorage.clear(); localStorage.setItem('hasVisited', '1'); localStorage.setItem('currentUser', JSON.stringify({ id: 1, email: 't@t.com', nickname: '测试', name: '测试' })); } catch (_) {}
});
await p.goto('http://localhost:5173/#/settings', { waitUntil: 'domcontentloaded' });
await p.waitForTimeout(2500);
const r1 = await p.evaluate(() => ({ allTabs: [...document.querySelectorAll('.sp-tab')].map(b => b.dataset.tab) }));
console.log('On load tabs:', JSON.stringify(r1));
const pb = await p.$('.sp-tab[data-tab="profile"]');
if (pb) { await pb.click(); await p.waitForTimeout(600); }
const r = await p.evaluate(() => ({ profileVisible: !!document.querySelector('.sp-tab[data-tab="profile"]'), avatarPicker: !!document.querySelector('.avatar-picker'), nicknameInput: !!document.querySelector('#sp-nickname'), lockedCard: !!document.querySelector('.sp-auth-locked'), activeTab: document.querySelector('.sp-tab.active')?.dataset.tab }));
console.log('After click:', JSON.stringify(r));
console.log(r.profileVisible && r.avatarPicker && r.nicknameInput && !r.lockedCard ? 'PASS' : 'FAIL');
await browser.close();
