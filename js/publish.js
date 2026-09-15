// ============================================================
// js/publish.js — 作品发布系统
// 功能: 拖拽/点击上传、实时预览、表单校验、base64 存储
// 限制: 图片<5MB(JPG/PNG/WEBP)，视频<20MB(MP4/WebM)
// ============================================================

const Publish = {
  modalEl: null,
  // 当前选中的文件信息
  currentFile: null,   // { file, dataUrl, type }
  // 文件大小限制
  MAX_IMG: 5 * 1024 * 1024,
  MAX_VIDEO: 20 * 1024 * 1024,
  // AI推荐标题状态
  aiLoading: false,
  aiResult: null,          // { titles: [], description: "" }
  aiSelectedIndex: -1,     // 当前选中的候选标题索引

  // ----------------------------------------------------------
  // 显示发布弹窗（需登录）
  // ----------------------------------------------------------
  showPublishModal() {
    if (!window.currentUser) {
      if (window.Auth) Auth.requireLogin();
      return;
    }
    this._buildModal();
    if (typeof Sound !== 'undefined') Sound.playSound('pop');
    if (window.ModalScrollLock) ModalScrollLock.lock();
    requestAnimationFrame(() => this.modalEl.classList.add('open'));
  },

  // ----------------------------------------------------------
  // 构建弹窗
  // ----------------------------------------------------------
  _buildModal() {
    if (this.modalEl) this.modalEl.remove();
    const overlay = document.createElement('div');
    overlay.className = 'modal-overlay publish-modal';
    overlay.id = 'publish-modal';
    overlay.innerHTML = `
      <div class="modal-box publish-box glass">
        <button class="modal-close" data-close aria-label="关闭"><i class="fa-solid fa-xmark"></i></button>
        <h2 class="pub-title">发布作品</h2>
        <p class="pub-sub">把你的梦境分享给世界</p>

        <div class="pub-dropzone" id="pub-dropzone">
          <input type="file" id="pub-file" accept="image/jpeg,image/png,image/webp,video/mp4,video/webm" hidden />
          <div class="pub-dropzone-inner" id="pub-dropzone-inner">
            <div class="pub-upload-icon"><i class="fa-solid fa-cloud-arrow-up"></i></div>
            <p class="pub-drop-text">拖拽文件到此处，或<span class="pub-link">点击上传</span></p>
            <p class="pub-drop-hint">支持 JPG / PNG / WEBP（&lt;5MB）、MP4 / WebM（&lt;20MB）</p>
          </div>
          <div class="pub-preview" id="pub-preview" style="display:none;"></div>
        </div>

        <form id="pub-form" class="pub-form">
          <div class="field">
            <div class="pub-field-label" style="display:flex; align-items:center; justify-content:space-between; margin-bottom:8px;">
              <label style="margin-bottom:0;">作品标题 <span class="req">*</span></label>
              <button type="button" class="ai-suggest-btn" id="ai-suggest-btn" aria-label="AI推荐标题">
                <i class="fa-solid fa-wand-magic-sparkles"></i> AI推荐标题✨
              </button>
            </div>
            <input type="text" id="pub-title-input" placeholder="给你的作品起个名字…" maxlength="60" required />
            <div class="ai-suggest-panel" id="ai-suggest-panel" style="display:none;"></div>
          </div>
          <div class="field">
            <label>介绍文案 <span class="req">*</span></label>
            <textarea id="pub-desc-input" placeholder="描述作品的灵感与故事…" rows="3" maxlength="300" required></textarea>
          </div>
          <div class="field">
            <label>分类</label>
            <div class="pub-categories" id="pub-categories">
              <button type="button" class="pub-cat active" data-cat="digital-art">数字艺术</button>
              <button type="button" class="pub-cat" data-cat="photography">摄影</button>
              <button type="button" class="pub-cat" data-cat="illustration">插画</button>
              <button type="button" class="pub-cat" data-cat="abstract">抽象</button>
              <button type="button" class="pub-cat" data-cat="3d-art">3D艺术</button>
            </div>
          </div>
          <div class="pub-error" id="pub-error"></div>
          <button type="submit" class="btn-primary btn-block" id="pub-submit">
            <i class="fa-solid fa-paper-plane"></i> 发布作品
          </button>
        </form>
      </div>
    `;
    document.body.appendChild(overlay);
    this.modalEl = overlay;

    this._bindUpload();
    this._bindCategories();
    this._bindSubmit();
    this._bindAISuggest();
    overlay.addEventListener('click', (e) => {
      if (e.target === overlay || e.target.closest('[data-close]')) this._close();
    });
  },

  // ----------------------------------------------------------
  // 绑定上传交互（点击 + 拖拽）
  // ----------------------------------------------------------
  _bindUpload() {
    const dz = this.modalEl.querySelector('#pub-dropzone');
    const fileInput = this.modalEl.querySelector('#pub-file');
    const inner = this.modalEl.querySelector('#pub-dropzone-inner');

    inner.addEventListener('click', () => fileInput.click());

    fileInput.addEventListener('change', (e) => {
      if (e.target.files[0]) this._handleFile(e.target.files[0]);
    });

    ['dragenter', 'dragover'].forEach(ev => {
      dz.addEventListener(ev, (e) => {
        e.preventDefault();
        dz.classList.add('dragging');
      });
    });
    ['dragleave', 'drop'].forEach(ev => {
      dz.addEventListener(ev, (e) => {
        e.preventDefault();
        dz.classList.remove('dragging');
      });
    });
    dz.addEventListener('drop', (e) => {
      e.preventDefault();
      const file = e.dataTransfer.files[0];
      if (file) this._handleFile(file);
    });
  },

  // ----------------------------------------------------------
  // 处理文件：校验类型与大小，生成预览
  // ----------------------------------------------------------
  _handleFile(file) {
    const errEl = this.modalEl.querySelector('#pub-error');
    errEl.textContent = '';
    const isImg = /^image\/(jpeg|png|webp)$/.test(file.type);
    const isVideo = /^video\/(mp4|webm)$/.test(file.type);

    if (!isImg && !isVideo) {
      errEl.textContent = '不支持的文件格式，请上传图片或视频';
      if (typeof Sound !== 'undefined') Sound.playSound('close');
      return;
    }
    if (isImg && file.size > this.MAX_IMG) {
      errEl.textContent = '图片不能超过 5MB';
      if (typeof Sound !== 'undefined') Sound.playSound('close');
      return;
    }
    if (isVideo && file.size > this.MAX_VIDEO) {
      errEl.textContent = '视频不能超过 20MB';
      if (typeof Sound !== 'undefined') Sound.playSound('close');
      return;
    }

    const reader = new FileReader();
    reader.onload = (e) => {
      this.currentFile = {
        file,
        dataUrl: e.target.result,
        type: isVideo ? 'video' : 'image'
      };
      this._renderPreview();
      if (typeof Sound !== 'undefined') Sound.playSound('click');
    };
    reader.onerror = () => {
      errEl.textContent = '文件读取失败，请重试';
    };
    reader.readAsDataURL(file);
  },

  // ----------------------------------------------------------
  // 渲染预览
  // ----------------------------------------------------------
  _renderPreview() {
    const preview = this.modalEl.querySelector('#pub-preview');
    const inner = this.modalEl.querySelector('#pub-dropzone-inner');
    if (!this.currentFile) {
      preview.style.display = 'none';
      inner.style.display = '';
      return;
    }
    inner.style.display = 'none';
    preview.style.display = '';
    const f = this.currentFile;
    preview.innerHTML = `
      <div class="pub-preview-media">
        ${f.type === 'video'
          ? `<video src="${f.dataUrl}" controls muted></video>`
          : `<img src="${f.dataUrl}" alt="预览" />`
        }
      </div>
      <div class="pub-preview-info">
        <div class="pub-preview-name"><i class="fa-solid fa-file"></i> ${this._esc(f.file.name)}</div>
        <div class="pub-preview-size">${this._fmtSize(f.file.size)} · ${f.type === 'video' ? '视频' : '图片'}</div>
        <button type="button" class="pub-remove" id="pub-remove"><i class="fa-solid fa-trash"></i> 移除</button>
      </div>
    `;
    this.modalEl.querySelector('#pub-remove').addEventListener('click', () => {
      this.currentFile = null;
      this._renderPreview();
      this.modalEl.querySelector('#pub-file').value = '';
    });
  },

  // ----------------------------------------------------------
  // 绑定分类选择
  // ----------------------------------------------------------
  _bindCategories() {
    const cats = this.modalEl.querySelector('#pub-categories');
    cats.querySelectorAll('.pub-cat').forEach(btn => {
      btn.addEventListener('click', () => {
        if (typeof Sound !== 'undefined') Sound.playSound('click');
        cats.querySelectorAll('.pub-cat').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
      });
    });
  },

  // ----------------------------------------------------------
  // 绑定表单提交
  // ----------------------------------------------------------
  _bindSubmit() {
    const form = this.modalEl.querySelector('#pub-form');
    form.addEventListener('submit', async (e) => {
      e.preventDefault();
      const errEl = this.modalEl.querySelector('#pub-error');
      errEl.textContent = '';

      const title = this.modalEl.querySelector('#pub-title-input').value.trim();
      const description = this.modalEl.querySelector('#pub-desc-input').value.trim();
      const category = this.modalEl.querySelector('.pub-cat.active').dataset.cat;

      if (!this.currentFile) {
        errEl.textContent = '请先上传作品文件';
        return;
      }
      if (!title) { errEl.textContent = '请填写作品标题'; return; }
      if (!description) { errEl.textContent = '请填写介绍文案'; return; }

      const submitBtn = this.modalEl.querySelector('#pub-submit');
      submitBtn.disabled = true;
      submitBtn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> 发布中…';

      try {
        await this.handlePublish(this.currentFile, title, description, category);
      } catch (err) {
        errEl.textContent = err.message || '发布失败，请重试';
        submitBtn.disabled = false;
        submitBtn.innerHTML = '<i class="fa-solid fa-paper-plane"></i> 发布作品';
      }
    });
  },

  // ----------------------------------------------------------
  // 处理发布：写入 IndexedDB + 刷新画廊 + 成功动画
  // ----------------------------------------------------------
  async handlePublish(file, title, description, category) {
    const user = window.currentUser;
    if (window.Sentry) Sentry.addBreadcrumb({ category: 'publish', message: 'Artwork publish attempt', data: { title, category, fileType: file.type, fileName: file.file.name } });
    const artwork = await addArtwork({
      title,
      description,
      author: user.username,
      category,
      imageUrl: file.dataUrl,
      type: file.type,
      userId: user.id
    });

    // 成功提示动画
    this._successAnimation();

    // 关闭弹窗
    setTimeout(() => this._close(), 900);

    // 刷新画廊
    if (window.Gallery) {
      setTimeout(() => Gallery.refreshGallery(), 1000);
    }
    if (typeof Sound !== 'undefined') Sound.playSound('success');
  },

  // ----------------------------------------------------------
  // 成功动画：覆盖层 + 勾选
  // ----------------------------------------------------------
  _successAnimation() {
    const overlay = document.createElement('div');
    overlay.className = 'pub-success-overlay';
    overlay.innerHTML = `
      <div class="pub-success-card glass">
        <div class="pub-success-check"><i class="fa-solid fa-check"></i></div>
        <p>作品已发布到梦境</p>
      </div>
    `;
    document.body.appendChild(overlay);
    requestAnimationFrame(() => overlay.classList.add('show'));
    setTimeout(() => {
      overlay.classList.remove('show');
      setTimeout(() => overlay.remove(), 400);
    }, 1200);
  },

  _close() {
    if (!this.modalEl) return;
    this.modalEl.classList.remove('open');
    if (window.ModalScrollLock) ModalScrollLock.unlock();
    if (typeof Sound !== 'undefined') Sound.playSound('close');
    setTimeout(() => {
      if (this.modalEl) {
        this.modalEl.remove();
        this.modalEl = null;
        this.currentFile = null;
        this.aiLoading = false;
        this.aiResult = null;
        this.aiSelectedIndex = -1;
      }
    }, 300);
  },

  // ----------------------------------------------------------
  // AI推荐标题：绑定触发按钮
  // ----------------------------------------------------------
  _bindAISuggest() {
    const btn = this.modalEl.querySelector('#ai-suggest-btn');
    if (!btn) return;
    btn.addEventListener('click', () => {
      if (typeof Sound !== 'undefined') Sound.playSound('click');
      this._generateAITitles();
    });
  },

  // ----------------------------------------------------------
  // 获取作品描述：优先用户输入的文案，其次文件名
  // ----------------------------------------------------------
  _getImageDescription() {
    const desc = this.modalEl.querySelector('#pub-desc-input').value.trim();
    if (desc) return desc;
    if (this.currentFile && this.currentFile.file) {
      // 去掉扩展名作为描述
      return this.currentFile.file.name.replace(/\.[^.]+$/, '');
    }
    return '';
  },

  // ----------------------------------------------------------
  // 获取当前选中的分类
  // ----------------------------------------------------------
  _getCurrentCategory() {
    const active = this.modalEl.querySelector('.pub-cat.active');
    return active ? active.dataset.cat : 'digital-art';
  },

  // ----------------------------------------------------------
  // 调用AI生成推荐标题（含加载态与错误处理）
  // ----------------------------------------------------------
  async _generateAITitles() {
    const btn = this.modalEl.querySelector('#ai-suggest-btn');
    const panel = this.modalEl.querySelector('#ai-suggest-panel');

    // 校验AI是否可用
    if (!window.AI || typeof AI.generateTitleSuggestions !== 'function') {
      this._showAIPanelError('AI助手暂不可用，请稍后再试');
      return;
    }
    // 校验已上传文件
    if (!this.currentFile) {
      this._showAIPanelError('请先上传作品图片后再使用AI推荐');
      return;
    }

    this.aiLoading = true;
    this.aiSelectedIndex = -1;
    if (btn) {
      btn.disabled = true;
      btn.innerHTML = '<i class="fa-solid fa-spinner fa-spin" style="animation: fa-spin 1s linear infinite;"></i> AI生成中…';
    }
    panel.style.display = '';
    panel.innerHTML = '<div class="ai-suggest-title"><i class="fa-solid fa-spinner fa-spin"></i> 小梦正在为你构思创意…</div>';

    try {
      const imageDescription = this._getImageDescription();
      const category = this._getCurrentCategory();
      const result = await AI.generateTitleSuggestions(imageDescription, category);
      this._renderAISuggestPanel(result);
    } catch (err) {
      this._showAIPanelError(err && err.message ? err.message : 'AI推荐生成失败，请重试');
    } finally {
      this.aiLoading = false;
      if (btn) {
        btn.disabled = false;
        btn.innerHTML = '<i class="fa-solid fa-wand-magic-sparkles"></i> AI推荐标题✨';
      }
    }
  },

  // ----------------------------------------------------------
  // 渲染推荐结果面板：3个候选标题 + 文案 + 操作按钮
  // ----------------------------------------------------------
  _renderAISuggestPanel(result) {
    const panel = this.modalEl.querySelector('#ai-suggest-panel');
    if (!result || !result.titles || !result.titles.length) {
      this._showAIPanelError('AI未能生成推荐，请重试');
      return;
    }
    this.aiResult = result;
    this.aiSelectedIndex = -1;
    const titlesHtml = result.titles.map((t, i) => `
      <div class="ai-suggest-item" data-idx="${i}">
        <span class="ai-suggest-text">${this._esc(t)}</span>
        <button type="button" class="ai-apply-btn">应用</button>
      </div>
    `).join('');
    panel.style.display = '';
    panel.innerHTML = `
      <div class="ai-suggest-title">✨ 小梦为你推荐以下标题（点击选择，可一键应用）</div>
      ${titlesHtml}
      <div class="ai-suggest-desc">${this._esc(result.description || '')}</div>
      <div class="ai-suggest-actions" style="display:flex; gap:8px; margin-top:10px;">
        <button type="button" class="ai-suggest-btn" id="ai-regen-btn">
          <i class="fa-solid fa-rotate"></i> 重新生成
        </button>
        <button type="button" class="ai-suggest-btn" id="ai-apply-all-btn" style="border-color:var(--dream-mint); color:var(--dream-mint);" disabled>
          <i class="fa-solid fa-check"></i> 一键应用
        </button>
      </div>
    `;
    this._bindAISuggestItems();
  },

  // ----------------------------------------------------------
  // 绑定推荐项交互：选择 / 单项应用 / 重新生成 / 一键应用
  // ----------------------------------------------------------
  _bindAISuggestItems() {
    const panel = this.modalEl.querySelector('#ai-suggest-panel');
    if (!panel) return;
    const items = panel.querySelectorAll('.ai-suggest-item');
    const applyAllBtn = panel.querySelector('#ai-apply-all-btn');
    const regenBtn = panel.querySelector('#ai-regen-btn');

    items.forEach(item => {
      item.addEventListener('click', (e) => {
        // 点击单项"应用"按钮：直接应用该标题 + 文案
        if (e.target.closest('.ai-apply-btn')) {
          e.stopPropagation();
          const idx = parseInt(item.dataset.idx, 10);
          this._applyAIResult(idx);
          return;
        }
        // 否则切换为选中态
        if (typeof Sound !== 'undefined') Sound.playSound('click');
        items.forEach(it => {
          it.style.borderColor = '';
          it.style.background = '';
        });
        item.style.borderColor = 'rgba(201,182,255,0.6)';
        item.style.background = 'rgba(201,182,255,0.12)';
        this.aiSelectedIndex = parseInt(item.dataset.idx, 10);
        if (applyAllBtn) applyAllBtn.disabled = false;
      });
    });

    if (regenBtn) {
      regenBtn.addEventListener('click', () => {
        if (typeof Sound !== 'undefined') Sound.playSound('click');
        this._generateAITitles();
      });
    }

    if (applyAllBtn) {
      applyAllBtn.addEventListener('click', () => {
        if (this.aiSelectedIndex < 0) return;
        if (typeof Sound !== 'undefined') Sound.playSound('click');
        this._applyAIResult(this.aiSelectedIndex);
      });
    }
  },

  // ----------------------------------------------------------
  // 应用选中的标题与文案到输入框
  // ----------------------------------------------------------
  _applyAIResult(idx) {
    if (!this.aiResult || !this.aiResult.titles[idx]) return;
    const title = this.aiResult.titles[idx];
    const description = this.aiResult.description || '';
    this.modalEl.querySelector('#pub-title-input').value = title;
    this.modalEl.querySelector('#pub-desc-input').value = description;
    if (typeof Sound !== 'undefined') Sound.playSound('success');
    // 应用后收起面板
    const panel = this.modalEl.querySelector('#ai-suggest-panel');
    panel.style.display = 'none';
    panel.innerHTML = '';
    this.aiSelectedIndex = -1;
  },

  // ----------------------------------------------------------
  // 在推荐面板中显示错误信息
  // ----------------------------------------------------------
  _showAIPanelError(msg) {
    const panel = this.modalEl.querySelector('#ai-suggest-panel');
    if (!panel) return;
    panel.style.display = '';
    panel.innerHTML = `<div class="ai-suggest-desc" style="color:var(--dream-pink);">${this._esc(msg)}</div>`;
  },

  // ----------------------------------------------------------
  // 工具
  // ----------------------------------------------------------
  _fmtSize(bytes) {
    if (bytes < 1024) return bytes + ' B';
    if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
    return (bytes / 1024 / 1024).toFixed(1) + ' MB';
  },
  _esc(s) {
    return String(s == null ? '' : s).replace(/[&<>"']/g, c => ({
      '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
    }[c]));
  }
};

// 暴露为全局
window.Publish = Publish;
window.showPublishModal = () => Publish.showPublishModal();

// ES Module export
export default Publish;
export { Publish };
const showPublishModal = window.showPublishModal;
export { showPublishModal };
