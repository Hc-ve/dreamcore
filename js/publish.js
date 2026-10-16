// ============================================================
// js/publish.js — 作品发布系统
// 功能: 拖拽/点击上传、实时预览、表单校验、base64 存储
//       M1接入：AI生成描述文案、上传完成异步触发AI评分定级
// 限制: 图片<5MB(JPG/PNG/WEBP)，视频<20MB(MP4/WebM)
// ============================================================

import { scoreImage, scoreArtwork, renderAestheticReport } from './ai-aesthetic.js';

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
  // prefill（可选）: { dataUrl, name } — 由 AI修图工作台「保存作品」流程传入，
  // 预先把修图结果填入上传预览，用户只需补标题/描述即可发布
  // ----------------------------------------------------------
  showPublishModal(prefill) {
    if (!window.currentUser) {
      if (window.Auth) Auth.requireLogin();
      return;
    }
    this.prefill = prefill || null;
    this._buildModal();
    if (typeof Sound !== 'undefined') Sound.playSound('pop');
    if (window.ModalScrollLock) ModalScrollLock.lock();
    requestAnimationFrame(() => this.modalEl.classList.add('open'));
    // M8: 修图结果预填充 — 直接进入预览态，跳过手动上传
    if (this.prefill && this.prefill.dataUrl) {
      this.currentFile = {
        file: { name: this.prefill.name || '修图作品.jpg', size: Math.round(this.prefill.dataUrl.length * 3 / 4) },
        dataUrl: this.prefill.dataUrl,
        type: 'image'
      };
      this._renderPreview();
      if (window.showToast) showToast('已带入修图结果，填写信息后即可发布', 'info');
    }
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
            <div class="pub-field-label" style="display:flex; align-items:center; justify-content:space-between; margin-bottom:8px;">
              <div style="display:flex; align-items:center; gap:8px;">
                <label style="margin-bottom:0;">介绍文案 <span class="req">*</span></label>
              </div>
              <button type="button" class="ai-suggest-btn" id="ai-desc-btn" aria-label="AI生成描述">
                <i class="fa-solid fa-wand-magic-sparkles"></i> AI生成描述✨
              </button>
            </div>
            <textarea id="pub-desc-input" placeholder="描述作品的灵感与故事…" rows="3" maxlength="300" required></textarea>
            <div class="ai-desc-panel" id="ai-desc-panel" style="display:none;"></div>
          </div>
          <div class="field">
            <label>分类</label>
            <div class="pub-categories" id="pub-categories">
              <button type="button" class="pub-cat active" data-cat="scenic-photo">文旅摄影</button>
              <button type="button" class="pub-cat" data-cat="heritage-craft">非遗文创</button>
              <button type="button" class="pub-cat" data-cat="guofeng-art">国风绘画</button>
              <button type="button" class="pub-cat" data-cat="ai-art">AI数字艺术</button>
              <button type="button" class="pub-cat" data-cat="museum-culture">博物文创</button>
              <button type="button" class="pub-cat" data-cat="creative-design">创意设计</button>
            </div>
          </div>
          <div class="pub-error" id="pub-error"></div>
          <button type="submit" class="btn-primary btn-block" id="pub-submit">
            <i class="fa-solid fa-paper-plane"></i> 发布作品
          </button>
          <div class="pub-draft-bar">
            <button type="button" class="btn-ghost pub-draft-save" id="pub-draft-save" title="暂存当前填写内容，稍后继续发布">
              <i class="fa-solid fa-box-archive"></i> 存入草稿箱
            </button>
            <button type="button" class="pub-draft-toggle" id="pub-draft-toggle">
              <i class="fa-solid fa-folder-open"></i> 草稿箱 <span id="pub-draft-count">0</span> 篇
            </button>
          </div>
          <div class="pub-draft-list" id="pub-draft-list" hidden></div>
        </form>
      </div>
    `;
    document.body.appendChild(overlay);
    this.modalEl = overlay;

    this._bindUpload();
    this._bindCategories();
    this._bindSubmit();
    this._bindAISuggest();
    this._bindAIDesc();
    this._bindDrafts();
    overlay.addEventListener('click', (e) => {
      if (e.target === overlay || e.target.closest('[data-close]')) this._close();
    });
  },

  // ----------------------------------------------------------
  // M8: 草稿箱 — 暂存/恢复/删除发布草稿（IndexedDB publish_drafts）
  // ----------------------------------------------------------
  _bindDrafts() {
    const saveBtn = this.modalEl.querySelector('#pub-draft-save');
    const toggleBtn = this.modalEl.querySelector('#pub-draft-toggle');

    // 存入草稿箱：暂存当前 标题/描述/分类/图片
    saveBtn.addEventListener('click', async () => {
      const user = window.currentUser;
      if (!user) return;
      const title = this.modalEl.querySelector('#pub-title-input').value.trim();
      const desc = this.modalEl.querySelector('#pub-desc-input').value.trim();
      const img = this.currentFile ? this.currentFile.dataUrl : '';
      if (!title && !desc && !img) {
        if (window.showToast) showToast('请先填写标题/描述或上传图片，再存入草稿箱', 'warn');
        return;
      }
      if (typeof Sound !== 'undefined') Sound.playSound('click');
      saveBtn.disabled = true;
      saveBtn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> 暂存中…';
      try {
        const activeCat = this.modalEl.querySelector('#pub-categories .pub-cat.active');
        await addPublishDraft({
          userId: user.id || user.username,
          title,
          description: desc,
          category: activeCat ? activeCat.dataset.cat || activeCat.textContent.trim() : null,
          imageData: img,
          mediaType: this.currentFile ? this.currentFile.type : 'image',
          sourceArtworkId: this.prefill && this.prefill.artworkId ? Number(this.prefill.artworkId) : null
        });
        if (window.showToast) showToast('已存入草稿箱，可稍后从草稿箱恢复继续发布', 'success');
        await this._refreshDraftCount(true);
      } catch (err) {
        console.error('[Publish] 存草稿失败:', err);
        if (window.showToast) showToast('存草稿失败：' + (err && err.message || '未知错误'), 'error');
      } finally {
        saveBtn.disabled = false;
        saveBtn.innerHTML = '<i class="fa-solid fa-box-archive"></i> 存入草稿箱';
      }
    });

    // 展开/收起草稿箱列表
    toggleBtn.addEventListener('click', () => {
      if (typeof Sound !== 'undefined') Sound.playSound('click');
      const list = this.modalEl.querySelector('#pub-draft-list');
      if (list.hidden) {
        list.hidden = false;
        this._renderDraftList();
      } else {
        list.hidden = true;
      }
    });

    this._refreshDraftCount(false);
  },

  // 刷新草稿计数（expandList=true 时同时刷新列表）
  async _refreshDraftCount(expandList) {
    const user = window.currentUser;
    if (!user) return;
    try {
      const drafts = await getPublishDrafts(user.id || user.username);
      const countEl = this.modalEl && this.modalEl.querySelector('#pub-draft-count');
      if (countEl) countEl.textContent = String(drafts.length);
      if (expandList && this.modalEl) {
        const list = this.modalEl.querySelector('#pub-draft-list');
        if (list && !list.hidden) this._renderDraftList();
      }
    } catch (_) { /* 静默 */ }
  },

  // 渲染草稿列表（恢复 / 删除）
  async _renderDraftList() {
    const user = window.currentUser;
    const list = this.modalEl.querySelector('#pub-draft-list');
    if (!user || !list) return;
    let drafts = [];
    try { drafts = await getPublishDrafts(user.id || user.username); }
    catch (_) { /* 静默 */ }

    if (!drafts.length) {
      list.innerHTML = '<div class="pub-draft-empty">草稿箱是空的 — 填写内容后点击「存入草稿箱」暂存</div>';
      return;
    }
    list.innerHTML = drafts.map(d => `
      <div class="pub-draft-item" data-id="${d.id}">
        ${d.imageData ? `<img class="pub-draft-thumb" src="${d.imageData}" alt="草稿缩略图" />` : '<div class="pub-draft-thumb pub-draft-thumb--empty"><i class="fa-regular fa-image"></i></div>'}
        <div class="pub-draft-info">
          <div class="pub-draft-title">${this._esc(d.title || '未命名草稿')}</div>
          <div class="pub-draft-meta">${this._esc((d.description || '暂无描述').slice(0, 40))}${(d.description || '').length > 40 ? '…' : ''}</div>
        </div>
        <div class="pub-draft-actions">
          <button type="button" class="pub-draft-restore" title="恢复到此草稿继续编辑"><i class="fa-solid fa-pen-to-square"></i> 恢复</button>
          <button type="button" class="pub-draft-delete" title="删除此草稿"><i class="fa-solid fa-trash"></i></button>
        </div>
      </div>
    `).join('');

    list.querySelectorAll('.pub-draft-item').forEach(item => {
      const id = Number(item.dataset.id);
      const draft = drafts.find(d => d.id === id);
      // 恢复草稿：回填表单 + 预览
      item.querySelector('.pub-draft-restore')?.addEventListener('click', () => {
        if (!draft) return;
        if (typeof Sound !== 'undefined') Sound.playSound('click');
        this.modalEl.querySelector('#pub-title-input').value = draft.title || '';
        this.modalEl.querySelector('#pub-desc-input').value = draft.description || '';
        if (draft.category) {
          this.modalEl.querySelectorAll('#pub-categories .pub-cat').forEach(b => {
            b.classList.toggle('active', (b.dataset.cat || b.textContent.trim()) === draft.category);
          });
        }
        if (draft.imageData) {
          this.currentFile = {
            file: { name: (draft.title || '草稿') + '.jpg', size: Math.round(draft.imageData.length * 3 / 4) },
            dataUrl: draft.imageData,
            type: draft.mediaType === 'video' ? 'video' : 'image'
          };
        } else {
          this.currentFile = null;
        }
        this._renderPreview();
        list.hidden = true;
        if (window.showToast) showToast(`已恢复草稿「${draft.title || '未命名'}」，继续完善后发布`, 'info');
      });
      // 删除草稿
      item.querySelector('.pub-draft-delete')?.addEventListener('click', async () => {
        if (!confirm('确认删除这篇草稿？此操作不可撤销')) return;
        if (typeof Sound !== 'undefined') Sound.playSound('click');
        try {
          await deletePublishDraft(id);
          await this._refreshDraftCount(true);
          if (window.showToast) showToast('草稿已删除', 'info');
        } catch (err) {
          if (window.showToast) showToast('删除草稿失败：' + (err && err.message || '未知错误'), 'error');
        }
      });
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

    // === Step 1: 先入库拿到 id ===
    const artwork = await addArtwork({
      title,
      description,
      author: user.username,
      category,
      imageUrl: file.dataUrl,
      type: file.type,
      userId: user.id
    });

    // === Step 2: 前台 AI 评分（不阻塞用户操作，但在 confirm 前必须完成）===
    const errEl = this.modalEl.querySelector('#pub-error');
    const submitBtn = this.modalEl.querySelector('#pub-submit');
    const isImage = file.type === 'image' || file.type === 'image/';
    let scoreResult = null;
    if (isImage) {
      try {
        scoreResult = await scoreArtwork(artwork.id, user.id);
      } catch (err) {
        console.warn('[Publish] 发布前评分失败:', err);
        // 评分失败不阻塞发布（降级到无评分状态）
      }
    }

    // === Step 3: 展示 confirm 面板（等级徽章 + 确认发布）===
    this._showConfirmPanel(artwork, scoreResult, file, user);
  },

  // ----------------------------------------------------------
  // 发布 confirm 面板：展示等级徽章 + AI评分简要 + 确认/取消
  // ----------------------------------------------------------
  _showConfirmPanel(artwork, scoreResult, file, user) {
    this._lastArtwork = artwork;
    const modal = this.modalEl;
    const form = modal.querySelector('#pub-form');
    const isImage = file.type === 'image' || file.type === 'image/';

    // 隐藏原表单内容
    form.style.display = 'none';

    // 评分结果
    const score = scoreResult || (artwork && artwork._latestScore) || null;
    const hasScore = !!score;
    // M6a-1 修复：mapGrade 返回 {key,...} 对象，需取 .key；兼容旧字符串
    const gradeKey = hasScore && score.grade ? String(score.grade.key || score.grade).toLowerCase() : null;
    // M6a-1 修复：五维分数在 scores 嵌套对象中（FALLBACK_SCORE 为平铺，做兼容）
    const sc = hasScore ? (score.scores || score) : null;

    // 六等级徽章样式（直接内联，避免改 css/style.css 大面积）
    const TIER_BADGE = {
      sss: { bg: 'linear-gradient(135deg, #fbbf24, #f59e0b, #fbbf24)', text: '顶级神作 SSS', border: '#fbbf24' },
      ss:  { bg: 'linear-gradient(135deg, #f97316, #ea580c)',         text: '大师级 SS',   border: '#f97316' },
      s:   { bg: 'linear-gradient(135deg, #f59e0b, #d97706)',         text: '优秀 S',      border: '#f59e0b' },
      a:   { bg: 'linear-gradient(135deg, #60a5fa, #3b82f6)',         text: '良好 A',      border: '#60a5fa' },
      b:   { bg: 'linear-gradient(135deg, #34d399, #10b981)',         text: '合格 B',      border: '#34d399' },
      c:   { bg: 'linear-gradient(135deg, #9ca3af, #6b7280)',         text: '待提升 C',    border: '#9ca3af' }
    };
    const meta = hasScore && TIER_BADGE[gradeKey]
      ? TIER_BADGE[gradeKey]
      : { bg: 'linear-gradient(135deg, #9ca3af, #6b7280)', text: '未评分', border: '#9ca3af' };

    const confirm = document.createElement('div');
    confirm.className = 'pub-confirm-panel';
    confirm.innerHTML = `
      <div class="pub-confirm-inner">
        <h3 style="margin:0 0 12px;font-size:1.15rem;"><i class="fa-solid fa-wand-magic-sparkles" style="color:var(--dream-violet)"></i> AI评分完成</h3>
        <div style="display:flex;align-items:center;gap:16px;margin-bottom:16px;">
          <img src="${file.dataUrl}" style="width:80px;height:80px;object-fit:cover;border-radius:10px;border:1px solid var(--border-color);" />
          <div style="flex:1;">
            <div style="font-weight:600;margin-bottom:4px;">${this._esc(artwork.title)}</div>
            <div style="display:inline-block;padding:6px 14px;border-radius:20px;color:#fff;font-weight:700;font-size:0.95rem;background:${meta.bg};border:1.5px solid ${meta.border};box-shadow:0 4px 16px rgba(0,0,0,.15);">
              ${meta.text}
              ${hasScore ? '<span style="margin-left:6px;font-weight:500;opacity:.9;">⭐ ' + Number(score.totalScore || 0).toFixed(1) + '</span>' : ''}
            </div>
          </div>
        </div>
        ${hasScore ? `
          <div style="background:var(--card-bg);border:1px solid var(--border-color);border-radius:10px;padding:12px;margin-bottom:16px;font-size:0.85rem;color:var(--text-secondary);">
            <strong>五维评分：</strong>
            构图 ${Number(sc.composition||0).toFixed(1)} ·
            光影 ${Number(sc.lighting||0).toFixed(1)} ·
            色彩 ${Number(sc.color||0).toFixed(1)} ·
            清晰度 ${Number(sc.clarity||0).toFixed(1)} ·
            主题 ${Number(sc.theme||0).toFixed(1)}
          </div>
          ${score.aiDescription ? '<div style="background:var(--card-bg);border:1px solid var(--border-color);border-radius:10px;padding:12px;margin-bottom:16px;font-size:0.85rem;color:var(--text-secondary);line-height:1.6;"><em>💭 ' + this._esc(score.aiDescription).replace(/AI辅助生成/, '').trim() + '</em></div>' : ''}
        ` : '<div style="background:var(--card-bg);border:1px solid var(--border-color);border-radius:10px;padding:12px;margin-bottom:16px;font-size:0.85rem;color:var(--text-secondary);">AI评分暂不可用，作品将以无评分状态发布。</div>'}
        <div style="display:flex;gap:10px;">
          <button type="button" class="btn-ghost" id="pub-confirm-cancel" style="flex:1;padding:12px;">取消发布</button>
          <button type="button" class="btn-primary" id="pub-confirm-ok" style="flex:2;padding:12px;">
            <i class="fa-solid fa-paper-plane"></i> 确认发布
          </button>
        </div>
      </div>
    `;
    form.parentNode.appendChild(confirm);

    // 确认按钮
    confirm.querySelector('#pub-confirm-ok').addEventListener('click', async () => {
      if (typeof Sound !== 'undefined') Sound.playSound('success');
      confirm.remove(); form.style.display = '';
      this._onPublishConfirmed();
    });
    // 取消按钮：删除刚创建的 artwork
    confirm.querySelector('#pub-confirm-cancel').addEventListener('click', async () => {
      if (typeof Sound !== 'undefined') Sound.playSound('close');
      try { await deleteArtwork(artwork.id); } catch (_) { /* ignore */ }
      confirm.remove(); form.style.display = '';
      errEl.textContent = '已取消发布';
      const submitBtn = form.querySelector('#pub-submit');
      submitBtn.disabled = false;
      submitBtn.innerHTML = '<i class="fa-solid fa-paper-plane"></i> 发布作品';
    });
  },

  // ----------------------------------------------------------
  // 用户确认发布 → success 动画 + 关窗 + 刷新画廊
  // ----------------------------------------------------------
  async _onPublishConfirmed() {
    try {
      const lastArt = this._lastArtwork || null;
      if (lastArt && lastArt.id && typeof updateArtwork === 'function') {
        await updateArtwork(lastArt.id, { aiScored: true });
      }
      // 方案B：作品发布即上云（最小双写同步）
      // fire-and-forget：云端断连/失败时静默降级，绝不阻塞发布与演示流程；
      // 未登录云端账号时自动跳过，稍后可手动 CloudMigrate.run() 补迁移。
      if (lastArt && lastArt.id && window.CloudMigrate && typeof window.CloudMigrate.syncArtworkToCloud === 'function') {
        Promise.resolve(window.CloudMigrate.syncArtworkToCloud(lastArt.id)).catch(() => { /* 静默 */ });
      }
    } catch (_) { /* ignore */ }
    this._successAnimation();
    setTimeout(() => this._close(), 900);
    if (window.Gallery) setTimeout(() => Gallery.refreshGallery(), 1000);
  },

  // ----------------------------------------------------------
  // [废弃] 异步触发评分 — 已由前台 confirm 面板覆盖
  // 保留空实现避免 _triggerAsyncAestheticScore 调用报错
  // ----------------------------------------------------------
  _triggerAsyncAestheticScore() { /* no-op */ },

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
  // AI生成描述：绑定触发按钮（M1附属能力，复用 scoreImage 的 aiDescription）
  // ----------------------------------------------------------
  _bindAIDesc() {
    const btn = this.modalEl.querySelector('#ai-desc-btn');
    if (!btn) return;
    btn.addEventListener('click', () => {
      if (typeof Sound !== 'undefined') Sound.playSound('click');
      this._generateAIDescription();
    });
  },

  // ----------------------------------------------------------
  // 调用 scoreImage 生成作品描述文案，填充到描述输入框并标注"AI辅助生成"
  // ----------------------------------------------------------
  async _generateAIDescription() {
    const btn = this.modalEl.querySelector('#ai-desc-btn');
    const panel = this.modalEl.querySelector('#ai-desc-panel');
    const descInput = this.modalEl.querySelector('#pub-desc-input');

    if (!this.currentFile) {
      if (panel) {
        panel.style.display = '';
        panel.innerHTML = '<div class="ai-suggest-desc" style="color:var(--dream-pink);">请先上传作品图片后再使用AI生成描述</div>';
      }
      return;
    }

    if (btn) {
      btn.disabled = true;
      btn.innerHTML = '<i class="fa-solid fa-spinner fa-spin" style="animation: fa-spin 1s linear infinite;"></i> AI生成中…';
    }
    if (panel) {
      panel.style.display = '';
      panel.innerHTML = '<div class="ai-suggest-title"><i class="fa-solid fa-spinner fa-spin"></i> AI正在理解作品并生成描述…</div>';
    }

    try {
      const artworkMeta = {
        title: this.modalEl.querySelector('#pub-title-input').value.trim() || '',
        description: '',
        tags: []
      };
      // 复用 scoreImage：一次调用同时产出评分与描述文案（M1附属入口）
      const result = await scoreImage(this.currentFile.dataUrl, artworkMeta, { timeout: 45000 });
      const aiDesc = result && result.aiDescription ? String(result.aiDescription).trim() : '';
      if (!aiDesc) {
        if (panel) panel.innerHTML = '<div class="ai-suggest-desc" style="color:var(--dream-pink);">AI未能生成描述，请重试或手动填写</div>';
        return;
      }
      descInput.value = aiDesc;
      if (panel) {
        panel.innerHTML = '<div class="ai-suggest-desc" style="display:flex; align-items:center; gap:6px; color:var(--dream-mint);"><i class="fa-solid fa-circle-check"></i> 已应用AI生成描述，可编辑后确认</div>';
      }
      if (typeof Sound !== 'undefined') Sound.playSound('success');
    } catch (err) {
      if (panel) panel.innerHTML = `<div class="ai-suggest-desc" style="color:var(--dream-pink);">${this._esc(err && err.message ? err.message : 'AI生成描述失败，请重试')}</div>`;
    } finally {
      if (btn) {
        btn.disabled = false;
        btn.innerHTML = '<i class="fa-solid fa-wand-magic-sparkles"></i> AI生成描述✨';
      }
    }
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
