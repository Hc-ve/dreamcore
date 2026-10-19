import { chromium } from 'playwright';
const browser = await chromium.launch({ channel: 'msedge', headless: true, args: ['--disable-remote-fonts'] });
const g = await browser.newContext({ viewport: { width: 1280, height: 900 } });
const p = await g.newPage();
await p.addInitScript(() => {
  Object.defineProperty(document, 'fonts', { get() { return { ready: Promise.resolve() }; } });
});
await p.goto('http://localhost:5173/', { waitUntil: 'domcontentloaded' });
await p.waitForTimeout(3000);
const r = await p.evaluate(async () => {
  // 直接 import auth 模块看 supabaseEnabled
  let supabaseEnabled = false;
  try {
    const mod = await import('./js/api/supabase-client.js');
    supabaseEnabled = mod.supabaseEnabled;
  } catch(e) {}
  return {
    supabaseEnabled,
    Auth_exists: !!window.Auth,
    wac: window.Auth ? JSON.stringify(window.Auth.getCurrentUser?.()) : 'no Auth',
    ls_cu: localStorage.getItem('currentUser'),
  };
});
console.log(JSON.stringify(r, null, 2));
await browser.close();
