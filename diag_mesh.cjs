const { chromium } = require('playwright');
(async () => {
  const b = await chromium.launch({ headless: true });
  const p = await b.newPage({ viewport: { width: 1280, height: 800 } });
  await p.goto('http://localhost:5173/#/craft', { waitUntil: 'networkidle' });
  await p.waitForTimeout(2000);

  const cards = await p.locator('.artwork-card').all();
  if (cards.length > 0) await cards[0].click();
  await p.waitForTimeout(1500);

  const bookmark = p.locator('.craft-product-btn:has-text("书签")');
  await bookmark.click();
  await p.waitForTimeout(800);

  const realBtn = p.locator('button:has-text("实物预览")').first();
  await realBtn.click();
  await p.waitForTimeout(2000);

  const rotateTab = p.locator('.tab-3d, button:has-text("3D")').first();
  await rotateTab.click();
  await p.waitForTimeout(2500);

  const diag = await p.evaluate(() => {
    const c3d = window.Craft3D;
    const cam = c3d?._camera;
    let scene = null;
    let p = cam;
    for (let i = 0; i < 10 && p; i++) {
      if (p.isScene) { scene = p; break; }
      p = p.parent;
    }
    const meshes = [];
    const walk = (o) => {
      if (!o || typeof o !== 'object') return;
      if (o.isMesh) {
        const mats = Array.isArray(o.material) ? o.material : [o.material];
        mats.forEach((m, idx) => {
          const uv = o.geometry?.attributes?.uv;
          let uvR = 'NO_UV';
          if (uv) {
            let mnU=2,mxU=-1,mnV=2,mxV=-1;
            for (let i=0;i<uv.count;i++) {
              const u=uv.getX(i),v=uv.getY(i);
              if(u<mnU)mnU=u; if(u>mxU)mxU=u;
              if(v<mnV)mnV=v; if(v>mxV)mxV=v;
            }
            uvR = 'U[' + mnU.toFixed(2) + ',' + mxU.toFixed(2) + '] V[' + mnV.toFixed(2) + ',' + mxV.toFixed(2) + ']';
          }
          meshes.push({
            mesh: o.name, matIdx: idx,
            matType: m?.type,
            matSide: m?.side === 0 ? 'Front' : m?.side === 1 ? 'Back' : m?.side === 2 ? 'Double' : String(m?.side),
            hasMap: !!m?.map,
            uvRange: uvR,
          });
        });
      }
      o.children?.forEach?.(walk);
    };
    walk(scene);
    return meshes;
  });
  console.log(JSON.stringify(diag, null, 2));
  await b.close();
})();
