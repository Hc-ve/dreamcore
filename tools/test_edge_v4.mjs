import { chromium } from 'playwright';

const EDGE = 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe';
const OUT = 'e:/a/6a578b50553ee2fa56364236/test-screenshots';
const b = await chromium.launch({ executablePath: EDGE, headless: false });
const p = await b.newPage();
const allLogs = [];
p.on('console', m => {
  const t = m.text().substring(0, 500);
  allLogs.push({ type: m.type(), text: t });
  if (t.includes('Craft3D') || t.includes('shuqian') || t.includes('FORM_PBR') || t.includes('✅') || t.includes('❌') || t.includes('renderCustom') || t.includes('PBR') || t.includes('金属')) {
    console.log(`[${m.type()}] ${t}`);
  }
});
p.on('pageerror', e => console.log('[PAGEERR]', e.message));

console.log('=== Goto #/craft?artworkId=1 (skip picker) ===');
await p.goto('http://localhost:5173/#/craft?artworkId=1', { waitUntil: 'networkidle' });
await p.waitForTimeout(5000);

await p.screenshot({ path: OUT + '/01-craft-workspace.png', fullPage: true });
console.log('Screenshot saved');

// 检查 workspace
const ws = await p.evaluate(() => {
  const r = {
    ws: !!document.querySelector('#craft-workspace, .craft-workspace'),
    modals: [...document.querySelectorAll('[class*="modal-overlay"]')].filter(el => {
      const cr = el.getBoundingClientRect(); return cr.width > 0;
    }).map(el => el.className.substring(0, 80)),
    // 品类按钮
    cats: [...document.querySelectorAll('[data-product-key], .craft-chip, .product-chip, [class*="craft-item"]')].slice(0, 30).map(el => ({
      k: el.dataset.productKey || '',
      text: el.innerText?.trim().substring(0, 30),
      cls: el.className.substring(0, 60),
      visible: el.getBoundingClientRect().width > 0
    }))
  };
  return r;
});
console.log('Workspace info:', JSON.stringify(ws, null, 2));

// 如果 workspace 没打开，手动关 welcome modal 再重新触发
if (!ws.ws) {
  console.log('No workspace yet, killing welcome modal and retrying...');
  await p.evaluate(() => {
    document.querySelectorAll('.welcome-modal').forEach(m => m.remove());
    const hash = window.location.hash;
    // 手动触发 hashchange
    window.dispatchEvent(new Event('hashchange'));
  });
  await p.waitForTimeout(3000);
}

// 重新检查 workspace
const ws2 = await p.evaluate(() => {
  const r = {
    ws: !!document.querySelector('#craft-workspace, .craft-workspace'),
    panel: document.querySelector('#craft-workspace, .craft-workspace')?.className || 'none',
    panelVisible: (() => { const el = document.querySelector('#craft-workspace, .craft-workspace'); if (!el) return false; const cr = el.getBoundingClientRect(); return cr.width > 0; })()
  };
  return r;
});
console.log('Workspace retry:', JSON.stringify(ws2, null, 2));

// 找品类选择器（书签）
console.log('\n=== Looking for 书签 category ===');
const bookmarkResult = await p.evaluate(() => {
  // 找所有带文本的可见按钮/div
  const all = [...document.querySelectorAll('button, .chip, [role="tab"], [class*="item"], [class*="card"], [class*="product"], [class*="craft"]')].filter(el => {
    const cr = el.getBoundingClientRect();
    return cr.width > 0 && cr.height > 0;
  });
  const hits = all.filter(el => el.innerText?.includes('书签') || el.dataset?.productKey === 'shuqian');
  return {
    total: all.length,
    bookmarkHits: hits.map(el => ({
      tag: el.tagName,
      cls: el.className.substring(0, 80),
      key: el.dataset.productKey || '',
      text: el.innerText?.trim().substring(0, 40)
    })),
    allProductRelated: all.filter(el => el.dataset?.productKey).map(el => ({ k: el.dataset.productKey, t: el.innerText?.trim().substring(0, 20) }))
  };
});
console.log('Bookmark search:', JSON.stringify(bookmarkResult, null, 2));

// 如果找到书签，点击它
if (bookmarkResult.bookmarkHits.length > 0) {
  console.log('Clicking bookmark category...');
  const bookmarkBtn = p.locator('[data-product-key="shuqian"], button:has-text("书签"), .chip:has-text("书签"), [class*="chip"]:has-text("书签")').first();
  await bookmarkBtn.click();
  await p.waitForTimeout(4000);
  await p.screenshot({ path: OUT + '/02-bookmark-selected.png', fullPage: true });
  console.log('Bookmark selected!');
} else {
  console.log('No bookmark button found. Let me look at ALL visible text on page...');
  const allText = await p.evaluate(() => {
    return [...document.querySelectorAll('body *')].filter(el => {
      const cr = el.getBoundingClientRect();
      return cr.width > 50 && cr.height > 15 && cr.top > 50 && cr.top < window.innerHeight;
    }).map(el => el.innerText?.trim()).filter(t => t && t.length > 0 && t.length < 40).slice(0, 80);
  });
  console.log('Visible texts:', [...new Set(allText)].slice(0, 50));
}

// 等 3D 渲染
await p.waitForTimeout(3000);
await p.screenshot({ path: OUT + '/03-after-wait.png', fullPage: true });

// Console 报告
console.log('\n=== Craft3D / PBR Related Console ===');
const relevant = allLogs.filter(l => 
  l.text.includes('Craft3D') || l.text.includes('shuqian') || 
  l.text.includes('FORM_PBR') || l.text.includes('✅') || 
  l.text.includes('❌') || l.text.includes('PBR') || 
  l.text.includes('metalness') || l.text.includes('roughness') ||
  l.text.includes('金属') || l.text.includes('renderCustom')
);
relevant.forEach(l => console.log(`  [${l.type}] ${l.text}`));

const errors = allLogs.filter(l => l.type === 'error' && !l.text.includes('ERR_ABORTED'));
if (errors.length > 0) {
  console.log(`\n❌ CONSOLE ERRORS (${errors.length}):`);
  errors.forEach(l => console.log(`  ${l.text.substring(0, 200)}`));
} else {
  console.log('\n✅ 无 console errors');
}

await b.close();
