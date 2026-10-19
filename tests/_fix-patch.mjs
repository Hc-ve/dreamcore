import fs from 'fs';

// ============ 1. 修 main.js — nav-search Enter + 放大镜按钮 ============
let mainPath = 'js/main.js';
let s = fs.readFileSync(mainPath, 'utf8');

const oldBlock = `  // 顶部搜索框回车
  const navInput = document.getElementById('nav-search-input');
  if (navInput) {
    navInput.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') {
        const v = navInput.value.trim();
        if (v && window.Search) {
          Search.showSearchBar().then(() => {
            const inp = document.getElementById('search-input');
            if (inp) { inp.value = v; Search.handleSearch(v); }
          });
        }
      }
    });
  }`;

const newBlock = `  // 顶部搜索框回车 → 跳转 hash 搜索页（Router 接管）
  const navInput = document.getElementById('nav-search-input');
  if (navInput) {
    navInput.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') {
        const v = navInput.value.trim();
        if (v) {
          window.location.hash = '#/search?q=' + encodeURIComponent(v);
        }
      }
    });
  }

  // 放大镜按钮：搜索框有值→跳转hash，无值→打开搜索弹窗
  const btnSearchNav = document.getElementById('btn-search');
  if (btnSearchNav) {
    btnSearchNav.addEventListener('click', () => {
      const v = navInput ? navInput.value.trim() : '';
      if (v) {
        window.location.hash = '#/search?q=' + encodeURIComponent(v);
      } else if (window.Search) {
        Search.showSearchBar();
      }
    });
  }`;

if (s.includes(oldBlock)) {
  s = s.replace(oldBlock, newBlock);
  console.log('✅ main.js nav-search patched');
} else {
  console.log('❌ main.js: old block not found');
  // 尝试定位替换
  const lines = s.split('\n');
  let start = -1, end = -1;
  for (let i = 0; i < lines.length; i++) {
    if (lines[i].includes("顶部搜索框回车") || lines[i].includes("顶部搜索框")) {
      start = i;
      // 找闭合的 }
      let depth = 0, found = false;
      for (let j = i; j < Math.min(i + 25, lines.length); j++) {
        const t = lines[j].trim();
        if (t.includes('{')) depth++;
        if (t.includes('}')) depth--;
        if (t === '}' && depth <= 0) { end = j; found = true; break; }
      }
      if (!found) end = i + 12;
      break;
    }
  }
  if (start >= 0) {
    lines.splice(start, end - start + 1, ...newBlock.split('\n'));
    s = lines.join('\n');
    console.log('✅ main.js patched (fallback line-based)');
  }
}
fs.writeFileSync(mainPath, s);

// ============ 2. 修 gallery.js — 初始渲染完后主动 hideLoader ============
let galPath = 'js/gallery.js';
let g = fs.readFileSync(galPath, 'utf8');

// 找 _renderBatch 的初始 batch 完成处 — start >= end 时已经调了 _hideLoader()
// 但问题可能是 sentinel observer 的 else-if 没覆盖初始 12 张卡片渲染完的场景
// 让我找 Gallery.init() 里的初始渲染流程

// 先看看 init() 或 _setup 里调用 _renderBatch 的地方
const initIdx = g.indexOf('async init()');
if (initIdx > 0) {
  // 找 init 函数结束位置
  const fnSlice = g.slice(initIdx, initIdx + 2000);
  // 检查 _renderBatch() 调用后有没有立即 _hideLoader 的守卫
  const hasHideAfterRender = fnSlice.includes('_hideLoader');
  console.log(`gallery.js init() 里有 _hideLoader: ${hasHideAfterRender}`);
}

// 方案：在 Gallery.init() 的渲染完成处 + _renderBatch 首屏渲染完（end < total 但还有后续）后，
// 如果 rendererCount 已 >= initialRenderCount，就 hideLoader 避免"梦境加载中..."一直显示
// 
// 实际上 _setupSentinel 里设了 loader + sentinel observer，当 observer 判断 renderedCount >= total 才 hide
// 但如果数据只有 12 条全渲染了（lightboxList.length === 12），那应该触发 hideLoader 才对...
//
// 让我再看看 lightboxList 是怎么设的

// 更好的修法：在 _showLoader 后，立即用一次性检查兜底
// 或者在 init 的 _renderBatch 链尾主动 hideLoader

// 最简单的 patch — 在 init() 最后（Gallery 数据 load + 首屏 render 完）主动调用 _hideLoader
const initRenderEnd = g.indexOf('this._renderBatch();', g.indexOf('async init()'));
if (initRenderEnd > 0) {
  // 看看之后几行
  const after = g.slice(initRenderEnd, initRenderEnd + 300);
  console.log('gallery init render context:', after.split('\n').slice(0, 8).join(' | '));
}

// 直接 patch：在 _setupSentinel 函数的 _showLoader 调用后，
// 如果 renderedCount >= lightboxList.length，就 hideLoader
// （sentinel observer 已经有这个逻辑，但 observer 可能没及时触发）

// 最直接的 fix — 在 _renderBatch 的 start >= end 分支已经调用了 _hideLoader，
// 那问题可能是 _renderBatch 没有被完整调完？让我在 _setupSentinel 末尾加一次兜底 hide
const sentinelEndMark = '    }, { rootMargin: \'400px 0px\' });\n    this.sentinelObserver.observe(sentinel);\n  },';
const sentinelFix = `    }, { rootMargin: '400px 0px' });
    this.sentinelObserver.observe(sentinel);
    // 兜底：如果首屏已渲染完全部作品，立即消除 loading 文案
    if (this.renderedCount >= this.lightboxList.length) {
      this._hideLoader();
    }
  },`;

if (g.includes(sentinelEndMark)) {
  g = g.replace(sentinelEndMark, sentinelFix);
  console.log('✅ gallery.js sentinel fallback hideLoader patched');
} else {
  console.log('⚠️ gallery.js: sentinel mark not found, searching...');
  // 简单找 observe(sentinel) 后面加一行
  const observeIdx = g.indexOf('this.sentinelObserver.observe(sentinel);');
  if (observeIdx > 0) {
    const lineEnd = g.indexOf('\n', observeIdx);
    const insertAt = lineEnd + 1;
    const insertCode = `    // 兜底：首屏渲染完所有作品后立即消除 loading\n    if (this.renderedCount >= this.lightboxList.length) { this._hideLoader(); }\n`;
    g = g.slice(0, insertAt) + insertCode + g.slice(insertAt);
    console.log('✅ gallery.js fallback insert patched');
  } else {
    console.log('❌ gallery.js: could not patch');
  }
}

fs.writeFileSync(galPath, g);
console.log('\n=== All patches applied ===');
