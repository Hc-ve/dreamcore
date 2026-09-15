// ============================================================
// js/share.js — 作品分享功能
// 功能: 复制链接 / 微信分享(二维码) / 微博 / Twitter / Facebook / Web Share API
// ============================================================

const Share = {
  currentMenu: null,
  qrcodeModal: null,
  QRCode: null,

  getShareUrl(artwork) {
    const base = window.location.origin + window.location.pathname;
    return `${base}#artwork-${artwork.id}?utm_source=dreamcore&utm_medium=share`;
  },

  getShareText(artwork) {
    return `${artwork.title} - ${artwork.author} | Dreamcore 梦境数字艺术`;
  },

  showShareMenu(artwork, anchorEl) {
    this._closeExistingMenu();

    const menu = document.createElement('div');
    menu.className = 'share-menu glass';
    menu.id = 'share-menu';

    const shareUrl = this.getShareUrl(artwork);
    const shareText = this.getShareText(artwork);
    const encodedUrl = encodeURIComponent(shareUrl);
    const encodedText = encodeURIComponent(shareText);

    const canNativeShare = !!(navigator.share);

    menu.innerHTML = `
      <div class="share-menu-item highlight" data-action="copy">
        <i class="fa-solid fa-link"></i>
        <span>复制链接</span>
      </div>
      <div class="share-menu-divider"></div>
      <div class="share-menu-item" data-action="wechat">
        <i class="fa-brands fa-weixin"></i>
        <span>微信</span>
      </div>
      <div class="share-menu-item" data-action="weibo">
        <i class="fa-brands fa-weibo"></i>
        <span>微博</span>
      </div>
      <div class="share-menu-item" data-action="twitter">
        <i class="fa-brands fa-x-twitter"></i>
        <span>Twitter/X</span>
      </div>
      <div class="share-menu-item" data-action="facebook">
        <i class="fa-brands fa-facebook"></i>
        <span>Facebook</span>
      </div>
      ${canNativeShare ? `
      <div class="share-menu-item" data-action="more">
        <i class="fa-solid fa-ellipsis"></i>
        <span>更多…</span>
      </div>` : ''}
    `;

    document.body.appendChild(menu);

    const rect = anchorEl.getBoundingClientRect();
    const menuRect = menu.getBoundingClientRect();

    let left = rect.left + rect.width / 2 - menuRect.width / 2;
    let top = rect.bottom + 10;

    if (left < 16) left = 16;
    if (left + menuRect.width > window.innerWidth - 16) {
      left = window.innerWidth - menuRect.width - 16;
    }
    if (top + menuRect.height > window.innerHeight - 16) {
      top = rect.top - menuRect.height - 10;
    }

    menu.style.position = 'fixed';
    menu.style.left = left + 'px';
    menu.style.top = top + 'px';

    menu.classList.add('open');
    this.currentMenu = menu;

    menu.querySelectorAll('.share-menu-item').forEach(item => {
      item.addEventListener('click', async (e) => {
        e.stopPropagation();
        const action = item.dataset.action;
        await this._handleShare(action, artwork, shareUrl, shareText);
        if (action !== 'wechat') this._closeExistingMenu();
      });
    });

    setTimeout(() => {
      this._outsideClickListener = (e) => {
        if (!e.target.closest('.share-menu') && !e.target.closest('#lb-share-btn')) {
          this._closeExistingMenu();
        }
      };
      document.addEventListener('click', this._outsideClickListener);
    }, 0);
  },

  async _handleShare(action, artwork, url, text) {
    switch (action) {
      case 'copy':
        await this._copyToClipboard(url);
        if (window.showToast) showToast('链接已复制！', 'success');
        break;
      case 'wechat':
        await this._showWechatQRCode(url, artwork);
        break;
      case 'weibo':
        window.open(`https://service.weibo.com/share/share.php?url=${encodeURIComponent(url)}&title=${encodeURIComponent(text)}`, '_blank', 'width=600,height=500');
        break;
      case 'twitter':
        window.open(`https://twitter.com/intent/tweet?url=${encodeURIComponent(url)}&text=${encodeURIComponent(text)}`, '_blank', 'width=600,height=400');
        break;
      case 'facebook':
        window.open(`https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(url)}`, '_blank', 'width=600,height=400');
        break;
      case 'more':
        if (navigator.share) {
          try {
            await navigator.share({
              title: artwork.title,
              text: text,
              url: url
            });
          } catch (err) {
            if (err.name !== 'AbortError') {
              console.error('分享失败:', err);
            }
          }
        }
        break;
    }
    if (typeof Sound !== 'undefined') Sound.playSound('click');
  },

  async _showWechatQRCode(url, artwork) {
    this._closeExistingMenu();

    if (!this.QRCode) {
      try {
        this.QRCode = await import('qrcode');
      } catch (err) {
        console.error('加载二维码库失败:', err);
        if (window.showToast) showToast('二维码功能暂不可用，请复制链接分享', 'warn');
        return;
      }
    }

    const modal = document.createElement('div');
    modal.className = 'modal-overlay wechat-qrcode-modal';
    modal.innerHTML = `
      <div class="modal-box glass">
        <button class="modal-close" data-close aria-label="关闭"><i class="fa-solid fa-xmark"></i></button>
        <div class="qrcode-header">
          <h3>微信扫码分享</h3>
          <p>扫码后点击右上角分享给好友</p>
        </div>
        <div class="qrcode-container">
          <canvas id="qrcode-canvas"></canvas>
        </div>
        <div class="qrcode-artwork-info">
          <div class="qrcode-artwork-title">${this._esc(artwork.title)}</div>
          <div class="qrcode-artwork-author">by ${this._esc(artwork.author)}</div>
        </div>
      </div>
    `;
    document.body.appendChild(modal);
    this.qrcodeModal = modal;

    setTimeout(async () => {
      modal.classList.add('open');
      const canvas = modal.querySelector('#qrcode-canvas');
      try {
        await this.QRCode.toCanvas(canvas, url, {
          width: 180,
          margin: 2,
          color: {
            dark: '#1a1a2e',
            light: '#ffffff'
          }
        });
      } catch (err) {
        console.error('生成二维码失败:', err);
        canvas.parentNode.innerHTML = '<p class="qrcode-error">无法生成二维码，请复制链接分享</p>';
      }
    }, 50);

    modal.addEventListener('click', (e) => {
      if (e.target === modal || e.target.closest('[data-close]')) {
        this._closeQRCodeModal();
      }
    });
  },

  _closeQRCodeModal() {
    if (!this.qrcodeModal) return;
    this.qrcodeModal.classList.remove('open');
    const modal = this.qrcodeModal;
    setTimeout(() => modal.remove(), 300);
    this.qrcodeModal = null;
  },

  async _copyToClipboard(text) {
    if (navigator.clipboard && navigator.clipboard.writeText) {
      try {
        await navigator.clipboard.writeText(text);
        return true;
      } catch {
        return this._fallbackCopy(text);
      }
    }
    return this._fallbackCopy(text);
  },

  _fallbackCopy(text) {
    const textarea = document.createElement('textarea');
    textarea.value = text;
    textarea.style.position = 'fixed';
    textarea.style.left = '-9999px';
    textarea.style.top = '-9999px';
    document.body.appendChild(textarea);
    textarea.select();
    try {
      document.execCommand('copy');
      document.body.removeChild(textarea);
      return true;
    } catch {
      document.body.removeChild(textarea);
      return false;
    }
  },

  _closeExistingMenu() {
    if (this.currentMenu) {
      this.currentMenu.classList.remove('open');
      const menu = this.currentMenu;
      setTimeout(() => menu.remove(), 250);
      this.currentMenu = null;
    }
    if (this._outsideClickListener) {
      document.removeEventListener('click', this._outsideClickListener);
      this._outsideClickListener = null;
    }
  },

  _esc(s) {
    return String(s || '').replace(/[&<>"']/g, c => ({
      '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
    }[c]));
  }
};

window.Share = Share;

// ES Module export
export default Share;
export { Share };
