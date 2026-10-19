const fs = require('fs');
let g = fs.readFileSync('js/gallery.js', 'utf8');

// 把 _setupSentinel 里无条件的 _showLoader() 移除，
// 改为 sentinel observer 回调里触发加载下一批时才 show
const old = `    this._showLoader();

    if (this.sentinelObserver) this.sentinelObserver.disconnect();
    this.sentinelObserver = new IntersectionObserver((entries) => {
      if (entries[0].isIntersecting && this.renderedCount < this.lightboxList.length) {
        this._renderBatch();
      } else if (this.renderedCount >= this.lightboxList.length) {
        this._hideLoader();
      }
    }, { rootMargin: '400px 0px' });
    this.sentinelObserver.observe(sentinel);
    // 兜底：如果首屏已渲染完全部作品，立即消除 loading 文案
    if (this.renderedCount >= this.lightboxList.length) { this._hideLoader(); }
  },`;

const nw = `    // 初始 setup 时先隐藏 loader（首屏渲染完不应显示 loading）
    this._hideLoader();

    if (this.sentinelObserver) this.sentinelObserver.disconnect();
    this.sentinelObserver = new IntersectionObserver((entries) => {
      if (entries[0].isIntersecting && this.renderedCount < this.lightboxList.length) {
        // 即将加载下一批，才显示 loading
        this._showLoader();
        this._renderBatch();
      } else if (this.renderedCount >= this.lightboxList.length) {
        this._hideLoader();
      }
    }, { rootMargin: '400px 0px' });
    this.sentinelObserver.observe(sentinel);
    if (this.renderedCount >= this.lightboxList.length) { this._hideLoader(); }
  },`;

if (g.includes(old)) {
  g = g.replace(old, nw);
  fs.writeFileSync('js/gallery.js', g);
  console.log('OK gallery.js');
} else {
  console.log('old block not found, searching...');
  const iShow = g.indexOf('    this._showLoader();\n\n    if (this.sentinelObserver)');
  console.log('showLoader context:', iShow);
}
