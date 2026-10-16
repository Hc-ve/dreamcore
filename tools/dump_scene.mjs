import { chromium } from 'playwright';

const b = await chromium.launch({ channel: 'msedge', headless: true });
const c = await b.newContext({ viewport: { width: 1440, height: 900 } });
const p = await c.newPage();

await p.goto('http://localhost:5173/');
await p.waitForSelector('.artwork-card', { timeout: 20000 });
await p.evaluate(() => { window.currentUser = { id: 1, username: 'admin', isAdmin: true, role: 'superadmin' }; });

// 重新上传修复模型
await p.goto('http://localhost:5173/#/admin');
await p.waitForSelector('#admin-modal', { timeout: 10000 });
await p.getByText('3D模型管理').click();
await p.waitForSelector('#c3d-product', { timeout: 5000 });
await p.selectOption('#c3d-product', 'shuqian');
await p.fill('#c3d-name', '书签_debug_v4');
await p.setInputFiles('#c3d-file', '书签_fixed.glb');
const uploadBtn = p.locator('#admin-modal button').filter({ hasText: /上传并绑定/ }).first();
await uploadBtn.click({ timeout: 10000 });
await p.waitForTimeout(2500);
await p.keyboard.press('Escape');
await p.waitForTimeout(500);

// 进 craft 选作品
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
await p.waitForTimeout(3000);

// Dump 材质状态
const dump = await p.evaluate(() => {
  const c3d = window.Craft3D;
  const scene = c3d?._scene || c3d?.scene;
  
  let meshCount = 0;
  const meshInfo = [];
  
  const walk = (obj) => {
    if (!obj || typeof obj !== 'object') return;
    if (obj.isMesh) {
      meshCount++;
      const geom = obj.geometry;
      const mats = Array.isArray(obj.material) ? obj.material : [obj.material];
      meshInfo.push({
        name: obj.name,
        vertices: geom.attributes?.position?.count,
        indices: geom.index?.count || null,
        groups: geom.groups?.length || 0,
        matCount: mats.length,
        mats: mats.map(m => ({
          type: m?.type,
          hasMap: !!m?.map,
          mapSize: m?.map?.image ? `${m.map.image.width}x${m.map.image.height}` : null,
          side: m?.side,
          color: m?.color?.getHexString?.() || null,
          roughness: m?.roughness,
          metalness: m?.metalness
        })),
        uvRange: (() => {
          const uv = geom.attributes?.uv;
          if (!uv) return 'NO_UV';
          let mnU=2,mxU=-1,mnV=2,mxV=-1;
          for (let i=0;i<uv.count;i++) {
            const u=uv.getX(i),v=uv.getY(i);
            if(u<mnU)mnU=u; if(u>mxU)mxU=u;
            if(v<mnV)mnV=v; if(v>mxV)mxV=v;
          }
          return `U[${mnU.toFixed(2)},${mxU.toFixed(2)}] V[${mnV.toFixed(2)},${mxV.toFixed(2)}]`;
        })(),
        posSample: (() => {
          const pos = geom.attributes?.position;
          if (!pos) return null;
          let mnx=2,mxx=-2,mny=2,mxy=-2,mnz=2,mxz=-2;
          for (let i=0;i<pos.count;i++) {
            const x=pos.getX(i),y=pos.getY(i),z=pos.getZ(i);
            if(x<mnx)mnx=x; if(x>mxx)mxx=x;
            if(y<mny)mny=y; if(y>mxy)mxy=y;
            if(z<mnz)mnz=z; if(z>mxz)mxz=z;
          }
          return `X[${mnx.toFixed(2)},${mxx.toFixed(2)}] Y[${mny.toFixed(2)},${mxy.toFixed(2)}] Z[${mnz.toFixed(2)},${mxz.toFixed(2)}]`;
        })()
      });
    }
    obj.children?.forEach?.(walk);
  };
  
  walk(scene);
  
  const canvas = document.querySelector('#craft-preview-canvas, .craft-preview-canvas, canvas');
  return {
    meshCount,
    meshInfo,
    craft3dKeys: Object.keys(c3d || {}),
    canvasSize: canvas ? `${canvas.width}x${canvas.height}` : 'no canvas',
    canvasCssSize: canvas ? `${canvas.style.width}x${canvas.style.height}` : null
  };
});

console.log(JSON.stringify(dump, null, 2));
await b.close();
