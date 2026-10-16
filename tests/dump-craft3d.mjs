import { chromium } from 'playwright';

const b = await chromium.launch({ channel: 'msedge', headless: true });
const c = await b.newContext({ viewport: { width: 1440, height: 900 } });
const p = await c.newPage();

await p.goto('http://localhost:5173/');
await p.waitForSelector('.artwork-card', { timeout: 20000 });
await p.evaluate(() => { window.currentUser = { id: 1, username: 'admin', isAdmin: true, role: 'superadmin' }; });
await p.goto('http://localhost:5173/#/craft');
await p.waitForTimeout(3000);
await p.getByRole('button', { name: /热门作品/ }).first().click({ timeout: 5000 });
await p.waitForTimeout(2000);
const gugong = p.getByText('故宫雪夜生成').first();
const parent = gugong.locator('xpath=ancestor::*[self::div or self::button or self::a][2]');
await parent.first().click({ force: true });
await p.waitForTimeout(2000);
await p.getByRole('button').filter({ hasText: /书签/ }).first().click({ force: true });
await p.waitForTimeout(800);
await p.getByRole('button', { name: /实物预览/ }).first().click();
await p.waitForTimeout(1500);
await p.getByText(/3D旋转/i).first().click({ force: true });
await p.waitForSelector('canvas', { timeout: 10000 });
await p.waitForTimeout(2500);

const dump = await p.evaluate(() => {
  const c3d = window.Craft3D;
  if (!c3d) return { error: 'no Craft3D' };
  
  const state = {};
  for (const k of Object.keys(c3d)) {
    const v = c3d[k];
    if (v && typeof v === 'object') {
      if (v.isCamera) state[k] = { type: 'Camera', pos: { x: +v.position?.x?.toFixed?.(3), y: +v.position?.y?.toFixed?.(3), z: +v.position?.z?.toFixed?.(3) } };
      else if (v.isScene) state[k] = { type: 'Scene', children: v.children?.length };
      else if (v.isRenderer) state[k] = { type: 'Renderer' };
      else if (v.target && typeof v.update === 'function') state[k] = { type: 'OrbitControls', target: { x: +v.target?.x?.toFixed?.(3), y: +v.target?.y?.toFixed?.(3), z: +v.target?.z?.toFixed?.(3) } };
      else state[k] = { type: typeof v, keys: Object.keys(v).slice(0, 10) };
    } else {
      state[k] = { type: typeof v, value: String(v).substring(0, 50) };
    }
  }
  
  const allCameras = Object.entries(window).filter(([,v]) => v && v.isCamera).map(([k,v]) => ({ key: k, pos: { x: +v.position?.x?.toFixed?.(3), y: +v.position?.y?.toFixed?.(3), z: +v.position?.z?.toFixed?.(3) }, fov: v.fov }));
  const threeObjs = Object.entries(window).filter(([,v]) => v && v.isScene).map(([k,v]) => ({ key: k, children: v.children?.length }));
  
  return { state, allCameras, threeObjs };
});

console.log(JSON.stringify(dump, null, 2));
await b.close();
