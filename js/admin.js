// ============================================================
// js/admin.js — 管理员后台（M4 增强版）
// 模块: 数据看板 / 作品管理(含审核) / 用户管理 / 管理员与权限
//       系统设置 / 操作日志 / AI策展 / 合伙人审核
// 权限: superadmin 全部；admin 除"管理员与权限"外全部
// 数据: IndexedDB 为主数据源，云端 profiles 只读合并展示
// 日志: 所有写操作记录 admin_logs 表
// ============================================================

import { supabase, supabaseEnabled } from './api/supabase-client.js';
// fflate：3D 模型备份打包/解包（GLB 已是二进制，用 ZIP level 0 直接存储，
// 避免 JSON+base64 带来 33% 体积膨胀，便于跨设备拷贝演示）
import { zipSync, unzipSync, strToU8, strFromU8 } from 'fflate';

const Admin = {
  modalEl: null,
  currentTab: 'dashboard',
  artworksCache: [],
  usersCache: [],
  logsCache: [],
  artStatusFilter: 'all',

  // Tab 定义（顺序即展示顺序）
  TABS: [
    { id: 'dashboard', icon: 'fa-chart-pie', label: '数据看板' },
    { id: 'orders', icon: 'fa-box', label: '订单管理' },
    { id: 'artworks', icon: 'fa-images', label: '作品管理' },
    { id: 'users', icon: 'fa-users', label: '用户管理' },
    { id: 'admins', icon: 'fa-shield-halved', label: '管理员与权限' },
    { id: 'settings', icon: 'fa-gear', label: '系统设置' },
    { id: 'logs', icon: 'fa-clipboard-list', label: '操作日志' },
    { id: 'curate', icon: 'fa-wand-magic-sparkles', label: 'AI策展' },
    { id: 'partner', icon: 'fa-handshake', label: '合伙人审核' },
    { id: 'custom3d', icon: 'fa-cube', label: '3D模型管理' }
  ],

  // ----------------------------------------------------------
  // 当前登录管理员角色
  // ----------------------------------------------------------
  _myRole() {
    const u = window.currentUser;
    if (!u) return 'user';
    if (u.role === 'superadmin') return 'superadmin';
    if (u.role === 'admin' || u.isAdmin) return 'admin';
    return 'user';
  },

  _roleLabel(r) {
    return r === 'superadmin' ? '超级管理员' : r === 'admin' ? '管理员' : '用户';
  },

  // 权限矩阵：admin 不可见"管理员与权限"
  _can(tab) {
    const role = this._myRole();
    if (role === 'superadmin') return true;
    if (role === 'admin') return tab !== 'admins';
    return false;
  },

  // ----------------------------------------------------------
  // 显示管理面板（需管理员）
  // ----------------------------------------------------------
  showAdminPanel() {
    const user = window.currentUser;
    if (!user) {
      if (window.Auth) Auth.requireLogin();
      return;
    }
    if (!user.isAdmin) {
      if (window.showToast) showToast('仅管理员可访问后台', 'warn');
      return;
    }
    this.currentTab = 'dashboard';
    this._build();
    if (typeof Sound !== 'undefined') Sound.playSound('pop');
    if (window.ModalScrollLock) ModalScrollLock.lock();
    requestAnimationFrame(() => this.modalEl.classList.add('open'));
    this._loadContent();
  },

  // ----------------------------------------------------------
  // 构建弹窗骨架（按权限渲染 Tab）
  // ----------------------------------------------------------
  _build() {
    if (this.modalEl) this.modalEl.remove();
    const u = window.currentUser || {};
    const role = this._myRole();
    const tabsHtml = this.TABS.filter(t => this._can(t.id)).map(t =>
      `<button class="admin-tab${t.id === this.currentTab ? ' active' : ''}" data-tab="${t.id}"><i class="fa-solid ${t.icon}"></i> ${t.label}</button>`
    ).join('');
    const overlay = document.createElement('div');
    overlay.className = 'modal-overlay admin-modal';
    overlay.id = 'admin-modal';
    overlay.innerHTML = `
      <div class="modal-box admin-box glass">
        <button class="modal-close" data-close aria-label="关闭"><i class="fa-solid fa-xmark"></i></button>
        <div class="admin-head">
          <h2><i class="fa-solid fa-shield-halved"></i> 管理后台</h2>
          <p class="admin-sub">当前管理员：${this._esc(u.username || '')} <span class="role-badge role-${role}">${this._roleLabel(role)}</span></p>
        </div>
        <div class="admin-tabs">${tabsHtml}</div>
        <div class="admin-content" id="admin-content"></div>
      </div>
    `;
    document.body.appendChild(overlay);
    this.modalEl = overlay;

    overlay.addEventListener('click', (e) => {
      if (e.target === overlay || e.target.closest('[data-close]')) this._close();
    });
    overlay.querySelectorAll('.admin-tab').forEach(tab => {
      tab.addEventListener('click', () => {
        if (typeof Sound !== 'undefined') Sound.playSound('click');
        overlay.querySelectorAll('.admin-tab').forEach(t => t.classList.remove('active'));
        tab.classList.add('active');
        this.currentTab = tab.dataset.tab;
        this._loadContent();
      });
    });
  },

  // ----------------------------------------------------------
  // 加载当前 Tab 内容
  // ----------------------------------------------------------
  async _loadContent() {
    const content = this.modalEl.querySelector('#admin-content');
    content.innerHTML = '<div class="admin-empty"><i class="fa-solid fa-spinner fa-spin"></i> 加载中…</div>';
    try {
      if (this.currentTab === 'dashboard') {
        if (window.AIDashboard && typeof AIDashboard.renderPanel === 'function') {
          await AIDashboard.renderPanel(content);
        } else {
          content.innerHTML = '<div class="admin-empty">数据看板模块未加载</div>';
        }
      } else if (this.currentTab === 'orders') {
        await this._renderOrders(content);
      } else if (this.currentTab === 'artworks') {
        this.artworksCache = await getAllArtworks();
        this._renderArtworks(content);
      } else if (this.currentTab === 'users') {
        await this._mergeUsers();
        this._renderUsers(content);
      } else if (this.currentTab === 'admins') {
        await this._mergeUsers();
        this._renderAdmins(content);
      } else if (this.currentTab === 'settings') {
        await this._renderSettings(content);
      } else if (this.currentTab === 'logs') {
        this.logsCache = await getAdminLogs(100);
        this._renderLogs(content);
      } else if (this.currentTab === 'curate') {
        this._renderCuratePanel(content);
      } else if (this.currentTab === 'partner') {
        if (window.AIPartner && typeof AIPartner.renderAdminPanel === 'function') {
          await AIPartner.renderAdminPanel(content);
        } else {
          content.innerHTML = '<div class="admin-empty">合伙人审核模块未加载</div>';
        }
      } else if (this.currentTab === 'custom3d') {
        await this._renderCustom3d(content);
      }
    } catch (err) {
      // 分级错误：数据库版本过低 vs 其他加载失败
      const msg = err && err.message || '未知错误';
      const isDbErr = /object stores was not found|数据库版本过低|custom_3d_models.*表尚未就绪/.test(msg);
      if (isDbErr) {
        content.innerHTML = `
<div class="admin-empty" style="padding:40px 20px;text-align:center;">
  <i class="fa-solid fa-database" style="font-size:2.4rem;color:#ef4444;margin-bottom:12px;display:block"></i>
  <h4 style="margin:0 0 8px;color:#ef4444">数据库版本过低</h4>
  <p style="color:var(--text-secondary);font-size:.82rem;margin:0 0 12px">${this._esc(msg)}</p>
  <p style="color:var(--text-secondary);font-size:.78rem;margin:0 0 16px">请刷新页面自动升级到 v11，3D 模型管理即可正常使用</p>
  <button class="btn-primary" onclick="location.reload()">
    <i class="fa-solid fa-arrows-rotate"></i> 立即刷新升级
  </button>
</div>
`;
      } else {
        content.innerHTML = '<div class="admin-empty">加载失败：' + this._esc(msg) + '</div>';
      }
    }
  },

  // ----------------------------------------------------------
  // 操作日志（所有写操作调用）
  // ----------------------------------------------------------
  async _log(action, targetType, targetId, detail) {
    try {
      const u = window.currentUser || {};
      if (window.addAdminLog) {
        await addAdminLog({
          adminId: u.id == null ? null : u.id,
          adminName: u.username || 'unknown',
          action, targetType,
          targetId: targetId == null ? '' : String(targetId),
          detail: detail || ''
        });
      }
    } catch (e) { /* 日志失败不阻塞业务 */ }
  },

  // ==========================================================
  // 作品管理（增删改查 + 内容审核）
  // ==========================================================
  _renderArtworks(content) {
    const total = this.artworksCache.length;
    const pendingCount = this.artworksCache.filter(a => a.status === 'pending').length;
    content.innerHTML = `
      <div class="admin-toolbar">
        <div class="admin-chips" id="admin-art-status-chips">
          <button class="admin-chip${this.artStatusFilter === 'all' ? ' active' : ''}" data-st="all">全部 ${total}</button>
          <button class="admin-chip${this.artStatusFilter === 'published' ? ' active' : ''}" data-st="published">已发布</button>
          <button class="admin-chip${this.artStatusFilter === 'pending' ? ' active' : ''}" data-st="pending">待审核${pendingCount ? ' ' + pendingCount : ''}</button>
          <button class="admin-chip${this.artStatusFilter === 'rejected' ? ' active' : ''}" data-st="rejected">已下架</button>
        </div>
        <div style="flex:1"></div>
        <div class="admin-search-mini" style="margin-right:8px;">
          <input type="text" id="admin-art-filter" placeholder="筛选作品名/作者…" />
        </div>
        <button class="admin-btn primary" id="admin-art-create" title="新建作品"><i class="fa-solid fa-plus"></i> 新建作品</button>
        <button class="admin-btn ghost" id="admin-art-export" title="导出当前筛选结果为 CSV"><i class="fa-solid fa-file-export"></i> 导出</button>
      </div>
      <div class="admin-batch-bar" id="admin-art-batch-bar" style="display:none;">
        <span id="admin-art-batch-count">已选 0 项</span>
        <button class="admin-btn warn" id="admin-art-batch-publish">批量上架</button>
        <button class="admin-btn del" id="admin-art-batch-delete">批量删除</button>
        <button class="admin-btn ghost" id="admin-art-batch-clear">取消选择</button>
      </div>
      <div class="admin-table-wrap">
        <table class="admin-table">
          <thead>
            <tr>
              <th style="width:36px;"><input type="checkbox" id="admin-art-select-all" /></th>
              <th>#</th><th>缩略</th><th>标题</th><th>作者</th><th>分类</th><th>状态</th><th>点赞</th><th>操作</th>
            </tr>
          </thead>
          <tbody id="admin-art-tbody"></tbody>
        </table>
      </div>
    `;
    this._fillArtRows(this._filterArtworks(''));
    content.querySelector('#admin-art-create')?.addEventListener('click', () => this._createArtwork());
    content.querySelector('#admin-art-select-all')?.addEventListener('change', (e) => {
      const checked = e.target.checked;
      content.querySelectorAll('#admin-art-tbody input[type="checkbox"]').forEach(cb => cb.checked = checked);
      this._updateArtBatchBar();
    });
    content.querySelector('#admin-art-batch-clear')?.addEventListener('click', () => {
      content.querySelectorAll('#admin-art-tbody input[type="checkbox"]').forEach(cb => cb.checked = false);
      const sel = content.querySelector('#admin-art-select-all'); if (sel) sel.checked = false;
      this._updateArtBatchBar();
    });
    content.querySelector('#admin-art-batch-publish')?.addEventListener('click', () => this._batchSetArtStatus('published'));
    content.querySelector('#admin-art-batch-delete')?.addEventListener('click', () => this._batchDeleteArtworks());
    content.querySelectorAll('#admin-art-status-chips .admin-chip').forEach(chip => {
      chip.addEventListener('click', () => {
        this.artStatusFilter = chip.dataset.st;
        this._resetPage('artworks');
        content.querySelectorAll('#admin-art-status-chips .admin-chip').forEach(c => c.classList.remove('active'));
        chip.classList.add('active');
        const kw = (content.querySelector('#admin-art-filter') || {}).value || '';
        this._fillArtRows(this._filterArtworks(kw.trim().toLowerCase()));
      });
    });
    const filter = content.querySelector('#admin-art-filter');
    if (filter) {
      filter.addEventListener('input', (e) => {
        this._resetPage('artworks');
        this._fillArtRows(this._filterArtworks(e.target.value.trim().toLowerCase()));
      });
    }
    content.querySelector('#admin-art-export')?.addEventListener('click', () => {
      const kw = (content.querySelector('#admin-art-filter') || {}).value || '';
      const rows = this._filterArtworks(kw.trim().toLowerCase());
      this._exportCSV(rows, [
        { key: 'id', label: 'ID' }, { key: 'title', label: '标题' },
        { key: 'author', label: '作者' }, { key: 'category', label: '分类' },
        { key: 'status', label: '状态' }, { key: 'likes', label: '点赞' },
        { key: 'createdAt', label: '创建时间' }
      ], `artworks_${Date.now()}.csv`);
    });
  },

  _filterArtworks(kw) {
    let list = this.artworksCache;
    if (this.artStatusFilter !== 'all') {
      const st = this.artStatusFilter;
      list = list.filter(a => (a.status || 'published') === st);
    }
    if (kw) {
      list = list.filter(a =>
        (a.title || '').toLowerCase().includes(kw) ||
        (a.author || '').toLowerCase().includes(kw)
      );
    }
    return list;
  },

  _fillArtRows(list) {
    const tbody = this.modalEl.querySelector('#admin-art-tbody');
    if (!tbody) return;
    const wrap = tbody.closest('.admin-table-wrap');
    if (wrap) wrap.querySelectorAll('.admin-pager').forEach(n => n.remove());

    if (!list.length) {
      tbody.innerHTML = '<tr><td colspan="9" class="admin-empty">无匹配作品</td></tr>';
      return;
    }
    const { offset, limit } = this._getPage('artworks', list.length);
    const pageRows = list.slice(offset, offset + limit);
    tbody.innerHTML = pageRows.map(a => {
      const st = a.status || 'published';
      return `
      <tr data-id="${a.id}">
        <td><input type="checkbox" class="art-row-cb" value="${a.id}" /></td>
        <td class="col-id">${a.id}</td>
        <td class="col-thumb"><img loading="lazy" src="${this._esc(a.imageUrl)}" alt="" /></td>
        <td class="col-title">${this._esc(a.title)}</td>
        <td>${this._esc(a.author)}</td>
        <td>${this._catLabel(a.category)}</td>
        <td><span class="admin-status ${st}">${this._statusLabel(st)}</span></td>
        <td>${this._fmtNum(a.likes)}</td>
        <td class="col-actions">
          ${st !== 'published' ? `<button class="admin-btn ok" data-publish="${a.id}" title="审核通过并上架"><i class="fa-solid fa-circle-check"></i></button>` : ''}
          ${st !== 'rejected' ? `<button class="admin-btn warn" data-reject="${a.id}" title="下架"><i class="fa-solid fa-ban"></i></button>` : ''}
          <button class="admin-btn edit" data-edit="${a.id}" title="编辑"><i class="fa-solid fa-pen"></i></button>
          <button class="admin-btn del" data-del="${a.id}" title="删除"><i class="fa-solid fa-trash"></i></button>
        </td>
      </tr>`;
    }).join('');

    tbody.querySelectorAll('[data-publish]').forEach(btn => {
      btn.addEventListener('click', () => this._setArtStatus(Number(btn.dataset.publish), 'published'));
    });
    tbody.querySelectorAll('[data-reject]').forEach(btn => {
      btn.addEventListener('click', () => this._setArtStatus(Number(btn.dataset.reject), 'rejected'));
    });
    tbody.querySelectorAll('[data-edit]').forEach(btn => {
      btn.addEventListener('click', () => this._editArtwork(Number(btn.dataset.edit)));
    });
    tbody.querySelectorAll('[data-del]').forEach(btn => {
      btn.addEventListener('click', () => this._deleteArtwork(Number(btn.dataset.del)));
    });
    tbody.querySelectorAll('.art-row-cb').forEach(cb => {
      cb.addEventListener('change', () => this._updateArtBatchBar());
    });
    // 渲染分页器
    this._renderPager('artworks', list.length, wrap, () => this._fillArtRows(this._filterArtworks(
      (this.modalEl.querySelector('#admin-art-filter') || {}).value || ''
    ).trim()));
  },

  _updateArtBatchBar() {
    const tbody = this.modalEl.querySelector('#admin-art-tbody');
    if (!tbody) return;
    const checked = [...tbody.querySelectorAll('.art-row-cb:checked')];
    const bar = this.modalEl.querySelector('#admin-art-batch-bar');
    const count = this.modalEl.querySelector('#admin-art-batch-count');
    const selectAll = this.modalEl.querySelector('#admin-art-select-all');
    if (!bar) return;
    if (checked.length > 0) {
      bar.style.display = 'flex';
      if (count) count.textContent = `已选 ${checked.length} 项`;
      if (selectAll) selectAll.checked = checked.length === tbody.querySelectorAll('.art-row-cb').length;
    } else {
      bar.style.display = 'none';
      if (selectAll) selectAll.checked = false;
    }
  },

  _getSelectedArtIds() {
    const tbody = this.modalEl.querySelector('#admin-art-tbody');
    if (!tbody) return [];
    return [...tbody.querySelectorAll('.art-row-cb:checked')].map(cb => Number(cb.value));
  },

  // 批量改状态
  async _batchSetArtStatus(status) {
    const ids = this._getSelectedArtIds();
    if (!ids.length) return;
    const label = status === 'published' ? '上架' : '下架';
    const ok = await this._confirm(`确认将选中的 ${ids.length} 个作品批量${label}？`);
    if (!ok) return;
    let done = 0, fail = 0;
    for (const id of ids) {
      try { await updateArtwork(id, { status }); done++; } catch { fail++; }
    }
    await this._log(`artwork.batch.${status === 'published' ? 'publish' : 'reject'}`, 'artwork', ids.join(','),
      `批量${label} ${done} 个作品（失败 ${fail} 个）`);
    if (window.showToast) showToast(`${label}完成：成功 ${done} 个${fail ? '，失败 ' + fail + ' 个' : ''}`, fail ? 'warn' : 'success');
    await this._loadContent();
  },

  // 批量删除
  async _batchDeleteArtworks() {
    const ids = this._getSelectedArtIds();
    if (!ids.length) return;
    const overlay = document.createElement('div');
    overlay.className = 'modal-overlay confirm-modal';
    overlay.innerHTML = `
      <div class="modal-box confirm-box glass">
        <h3><i class="fa-solid fa-triangle-exclamation"></i> 批量删除 ${ids.length} 个作品</h3>
        <p>请选择批量删除方式：</p>
        <div class="confirm-actions">
          <button class="btn-ghost" data-cancel>取消</button>
          <button class="btn-primary warn" data-soft><i class="fa-solid fa-archive"></i> 全部逻辑删除</button>
          <button class="btn-primary danger" data-hard><i class="fa-solid fa-trash"></i> 全部物理删除</button>
        </div>
      </div>
    `;
    document.body.appendChild(overlay);
    requestAnimationFrame(() => overlay.classList.add('open'));
    overlay.addEventListener('click', async (e) => {
      if (e.target === overlay || e.target.closest('[data-cancel]')) {
        overlay.classList.remove('open'); setTimeout(() => overlay.remove(), 300); return;
      }
      const isSoft = !!e.target.closest('[data-soft]');
      const isHard = !!e.target.closest('[data-hard]');
      if (!isSoft && !isHard) return;
      let done = 0, fail = 0, names = [];
      for (const id of ids) {
        const art = this.artworksCache.find(a => a.id === id);
        if (art) names.push(art.title);
        try { await deleteArtwork(id, { soft: isSoft }); done++; } catch { fail++; }
      }
      await this._log(`artwork.batch.${isSoft ? 'archive' : 'delete'}`, 'artwork', ids.join(','),
        `批量${isSoft ? '归档' : '删除'} ${done} 个作品${fail ? `（失败 ${fail} 个）` : ''}`);
      if (window.showToast) showToast(`${isSoft ? '已归档' : '已删除'} ${done} 个${fail ? '，失败 ' + fail + ' 个' : ''}`, fail ? 'warn' : 'success');
      overlay.classList.remove('open'); setTimeout(() => overlay.remove(), 300);
      await this._loadContent();
    });
  },

  // 新建作品
  async _createArtwork() {
    const cats = ['scenic-photo', 'heritage-craft', 'guofeng-art', 'ai-art', 'museum-culture', 'creative-design'];
    const catOpts = cats.map(c => `<button class="pub-cat${c === cats[0] ? ' active' : ''}" data-cat="${c}">${this._catLabel(c)}</button>`).join('');
    const overlay = document.createElement('div');
    overlay.className = 'modal-overlay confirm-modal';
    overlay.innerHTML = `
      <div class="modal-box confirm-box glass" style="max-width:540px;">
        <h3><i class="fa-solid fa-plus"></i> 新建作品</h3>
        <div class="admin-form" style="margin-top:14px;">
          <div style="display:grid;grid-template-columns:3fr 1fr;gap:10px;">
            <label>标题<input type="text" id="ac-title" placeholder="如：龙门石窟·卢舍那" /></label>
            <label>作者<input type="text" id="ac-author" placeholder="作者名" value="管理员" /></label>
          </div>
          <label>分类
            <div class="admin-cat-picker" id="ac-cat-picker" style="margin:4px 0 0;">${catOpts}</div>
          </label>
          <label>图片文件（存 /images/artworks/ 下）
            <input type="text" id="ac-image" placeholder="文件名，如 gen-001.jpg" />
            <span style="font-size:11px;color:#888;">只填文件名即可，系统自动拼接路径前缀</span>
          </label>
          <label>标签（逗号分隔）<input type="text" id="ac-tags" placeholder="如：龙门石窟, 石刻艺术" /></label>
          <label>描述<textarea id="ac-desc" rows="3" placeholder="作品简介…"></textarea></label>
          <div style="display:grid;grid-template-columns:1fr 1fr;gap:10px;">
            <label>初始状态
              <select id="ac-status">
                <option value="pending" selected>待审核（需手动过审）</option>
                <option value="published">已发布（直接上架）</option>
              </select>
            </label>
          </div>
        </div>
        <div class="confirm-actions">
          <button class="btn-ghost" data-cancel>取消</button>
          <button class="btn-primary" data-ok><span>创建</span></button>
        </div>
      </div>
    `;
    document.body.appendChild(overlay);
    requestAnimationFrame(() => overlay.classList.add('open'));
    let selectedCat = cats[0];
    overlay.querySelectorAll('[data-cat]').forEach(b => {
      b.addEventListener('click', () => {
        overlay.querySelectorAll('[data-cat]').forEach(x => x.classList.remove('active'));
        b.classList.add('active');
        selectedCat = b.dataset.cat;
      });
    });
    overlay.addEventListener('click', async (e) => {
      if (e.target === overlay || e.target.closest('[data-cancel]')) {
        overlay.classList.remove('open');
        setTimeout(() => overlay.remove(), 300);
      }
      if (e.target.closest('[data-ok]')) {
        const btn = e.target.closest('[data-ok]');
        const title = overlay.querySelector('#ac-title').value.trim();
        const author = overlay.querySelector('#ac-author').value.trim() || '管理员';
        const imageRaw = overlay.querySelector('#ac-image').value.trim();
        const desc = overlay.querySelector('#ac-desc').value.trim();
        const tagsStr = overlay.querySelector('#ac-tags').value.trim();
        const status = overlay.querySelector('#ac-status').value;
        // 校验
        if (!title) { if (window.showToast) showToast('标题不能为空', 'warn'); return; }
        // 重复检测
        const dup = this.artworksCache.find(a => (a.title || '').trim() === title);
        if (dup) { if (window.showToast) showToast(`标题「${title}」已存在（#${dup.id}）`, 'warn'); return; }
        // 构造作品
        const newId = (this.artworksCache.reduce((m, a) => Math.max(m, a.id || 0), 0) + 1);
        const now = new Date().toISOString().slice(0, 10);
        const art = {
          id: newId,
          title,
          description: desc,
          author,
          category: selectedCat,
          tags: tagsStr ? tagsStr.split(/[,，]/).map(s => s.trim()).filter(Boolean) : [],
          imageUrl: imageRaw.startsWith('/') ? imageRaw : `/images/artworks/${imageRaw || 'gen-001.jpg'}`,
          grade: 'a',
          totalScore: 7.5,
          likes: 0,
          views: 0,
          status,
          createdAt: now
        };
        // Loading
        btn.disabled = true;
        btn.querySelector('span').textContent = '创建中…';
        try {
          await addArtwork(art);
          await this._log('artwork.create', 'artwork', newId, `新建作品「${title}」（${this._catLabel(selectedCat)} / ${this._statusLabel(status)}）`);
          if (window.showToast) showToast(`作品「${title}」已创建（#${newId}）`, 'success');
          if (typeof Sound !== 'undefined') Sound.playSound('success');
          overlay.classList.remove('open');
          setTimeout(() => overlay.remove(), 300);
          await this._loadContent();
          if (window.Gallery) Gallery.refreshGallery();
        } catch (err) {
          if (window.showToast) showToast('创建失败：' + (err && err.message || '未知错误'), 'error');
          btn.disabled = false;
          btn.querySelector('span').textContent = '创建';
        }
      }
    });
  },

  _statusLabel(st) {
    return st === 'pending' ? '待审核' : st === 'rejected' ? '已下架' : '已发布';
  },

  // 快捷审核：上架 / 下架
  async _setArtStatus(artworkId, status) {
    const art = this.artworksCache.find(a => a.id === artworkId);
    if (!art) return;
    try {
      await updateArtwork(artworkId, { status });
      await this._log('artwork.review', 'artwork', artworkId,
        `「${art.title}」${status === 'published' ? '审核通过并上架' : '下架'}`);
      if (window.showToast) showToast(status === 'published' ? '已审核通过并上架' : '作品已下架', 'success');
      if (typeof Sound !== 'undefined') Sound.playSound('success');
      await this._loadContent();
      if (window.Gallery) Gallery.refreshGallery();
    } catch (err) {
      if (window.showToast) showToast('操作失败：' + (err && err.message || '未知错误'), 'error');
    }
  },

  // 编辑作品（标题/分类/状态/描述）
  _editArtwork(artworkId) {
    const art = this.artworksCache.find(a => a.id === artworkId);
    if (!art) return;
    // M6b-1 文旅文创六分类
    const cats = ['scenic-photo', 'heritage-craft', 'guofeng-art', 'ai-art', 'museum-culture', 'creative-design'];
    const st = art.status || 'published';
    const overlay = document.createElement('div');
    overlay.className = 'modal-overlay confirm-modal';
    overlay.innerHTML = `
      <div class="modal-box confirm-box glass">
        <h3>编辑作品</h3>
        <div class="admin-form" style="margin-top:12px;">
          <label>标题<input type="text" id="ae-title" value="${this._esc(art.title)}" /></label>
          <label>分类<div class="admin-cat-picker">${cats.map(c => `<button class="pub-cat ${c === art.category ? 'active' : ''}" data-cat="${c}">${this._catLabel(c)}</button>`).join('')}</div></label>
          <label>审核状态
            <select id="ae-status">
              <option value="published" ${st === 'published' ? 'selected' : ''}>已发布</option>
              <option value="pending" ${st === 'pending' ? 'selected' : ''}>待审核</option>
              <option value="rejected" ${st === 'rejected' ? 'selected' : ''}>已下架</option>
            </select>
          </label>
          <label>描述<textarea id="ae-desc">${this._esc(art.description || '')}</textarea></label>
        </div>
        <div class="confirm-actions">
          <button class="btn-ghost" data-cancel>取消</button>
          <button class="btn-primary" data-ok>保存</button>
        </div>
      </div>
    `;
    document.body.appendChild(overlay);
    requestAnimationFrame(() => overlay.classList.add('open'));
    let selected = art.category;
    overlay.querySelectorAll('[data-cat]').forEach(b => {
      b.addEventListener('click', () => {
        overlay.querySelectorAll('[data-cat]').forEach(x => x.classList.remove('active'));
        b.classList.add('active');
        selected = b.dataset.cat;
      });
    });
    overlay.addEventListener('click', async (e) => {
      if (e.target === overlay || e.target.closest('[data-cancel]')) {
        overlay.classList.remove('open');
        setTimeout(() => overlay.remove(), 300);
      }
      if (e.target.closest('[data-ok]')) {
        const title = overlay.querySelector('#ae-title').value.trim();
        if (!title) { if (window.showToast) showToast('标题不能为空', 'warn'); return; }
        const data = {
          title,
          category: selected,
          status: overlay.querySelector('#ae-status').value,
          description: overlay.querySelector('#ae-desc').value.trim()
        };
        try {
          await updateArtwork(artworkId, data);
          await this._log('artwork.update', 'artwork', artworkId, `编辑「${title}」（分类 ${this._catLabel(selected)} / 状态 ${this._statusLabel(data.status)}）`);
          if (window.showToast) showToast('作品已更新', 'success');
          if (typeof Sound !== 'undefined') Sound.playSound('success');
          overlay.classList.remove('open');
          setTimeout(() => overlay.remove(), 300);
          await this._loadContent();
          if (window.Gallery) Gallery.refreshGallery();
        } catch (err) {
          if (window.showToast) showToast('保存失败：' + (err && err.message || '未知错误'), 'error');
        }
      }
    });
  },

  // 删除作品
  _deleteArtwork(artworkId) {
    const art = this.artworksCache.find(a => a.id === artworkId);
    if (!art) return;
    const overlay = document.createElement('div');
    overlay.className = 'modal-overlay confirm-modal';
    overlay.innerHTML = `
      <div class="modal-box confirm-box glass">
        <h3><i class="fa-solid fa-triangle-exclamation"></i> 删除作品</h3>
        <p>确定删除「${this._esc(art.title)}」？请选择删除方式：</p>
        <div class="confirm-actions">
          <button class="btn-ghost" data-cancel>取消</button>
          <button class="btn-primary warn" data-soft><i class="fa-solid fa-archive"></i> 逻辑删除（隐藏，可恢复）</button>
          <button class="btn-primary danger" data-hard><i class="fa-solid fa-trash"></i> 物理删除（级联清理，不可恢复）</button>
        </div>
      </div>
    `;
    document.body.appendChild(overlay);
    requestAnimationFrame(() => overlay.classList.add('open'));
    overlay.addEventListener('click', async (e) => {
      if (e.target === overlay || e.target.closest('[data-cancel]')) {
        overlay.classList.remove('open'); setTimeout(() => overlay.remove(), 300);
        return;
      }
      const isSoft = !!e.target.closest('[data-soft]');
      const isHard = !!e.target.closest('[data-hard]');
      if (!isSoft && !isHard) return;
      try {
        await deleteArtwork(artworkId, { soft: isSoft });
        await this._log(`artwork.${isSoft ? 'archive' : 'delete'}`, 'artwork', artworkId,
          `${isSoft ? '逻辑删除（归档）' : '物理删除（级联清理）'}「${art.title}」`);
        if (window.showToast) showToast(isSoft ? '已归档，可恢复' : '已彻底删除', 'success');
        if (typeof Sound !== 'undefined') Sound.playSound('close');
        overlay.classList.remove('open'); setTimeout(() => overlay.remove(), 300);
        await this._loadContent();
        if (window.Gallery) Gallery.refreshGallery();
      } catch (err) {
        if (window.showToast) showToast('删除失败：' + (err && err.message || '未知错误'), 'error');
      }
    });
  },

  // ==========================================================
  // 用户管理（本地 CRUD + 云端只读合并）
  // ==========================================================
  async _mergeUsers() {
    const local = await getAllUsers();
    const merged = local.map(u => ({
      ...u,
      source: 'local',
      role: u.role || (u.isAdmin ? 'admin' : 'user')
    }));
    const localNames = new Set(merged.map(u => (u.username || '').toLowerCase()));
    if (supabaseEnabled && supabase) {
      try {
        const { data } = await supabase.from('profiles').select('id,username,role,created_at');
        (data || []).forEach(c => {
          const uname = (c.username || '').toLowerCase();
          if (localNames.has(uname)) {
            const m = merged.find(x => (x.username || '').toLowerCase() === uname);
            if (m) m.cloudId = c.id;
          } else {
            merged.push({
              id: c.id, username: c.username, email: '',
              role: c.role || 'user', source: 'cloud',
              createdAt: c.created_at, cloudId: c.id
            });
          }
        });
      } catch (e) { /* 云端拉取失败不影响本地列表 */ }
    }
    this.usersCache = merged;
    return merged;
  },

  _renderUsers(content) {
    const total = this.usersCache.length;
    content.innerHTML = `
      <div class="admin-toolbar">
        <div class="admin-count">共 <strong>${total}</strong> 位用户</div>
        <div style="display:flex;gap:10px;align-items:center;flex-wrap:wrap;">
          <div class="admin-search-mini">
            <input type="text" id="admin-user-filter" placeholder="筛选用户名/邮箱…" />
          </div>
          <button class="btn-primary" id="admin-user-add" style="padding:8px 16px;font-size:13px;"><i class="fa-solid fa-user-plus"></i> 新增用户</button>
          <button class="admin-btn ghost" id="admin-user-export" title="导出用户 CSV"><i class="fa-solid fa-file-export"></i> 导出</button>
        </div>
      </div>
      <div class="admin-table-wrap">
        <table class="admin-table">
          <thead>
            <tr><th>ID</th><th>头像</th><th>用户名</th><th>邮箱</th><th>角色</th><th>来源</th><th>注册时间</th><th>操作</th></tr>
          </thead>
          <tbody id="admin-user-tbody"></tbody>
        </table>
      </div>
    `;
    this._fillUserRows(this.usersCache);
    const filter = content.querySelector('#admin-user-filter');
    if (filter) {
      filter.addEventListener('input', (e) => {
        this._resetPage('users');
        this._userKw = e.target.value.trim().toLowerCase();
        this._fillUserRows(this.usersCache.filter(u =>
          (u.username || '').toLowerCase().includes(this._userKw) ||
          (u.email || '').toLowerCase().includes(this._userKw)
        ));
      });
    }
    content.querySelector('#admin-user-add')?.addEventListener('click', () => this._addUserModal());
    content.querySelector('#admin-user-export')?.addEventListener('click', () => {
      const kw = (content.querySelector('#admin-user-filter') || {}).value || '';
      const rows = this.usersCache.filter(u =>
        !kw || (u.username || '').toLowerCase().includes(kw.toLowerCase()) || (u.email || '').toLowerCase().includes(kw.toLowerCase())
      );
      this._exportCSV(rows, [
        { key: 'id', label: 'ID' }, { key: 'username', label: '用户名' },
        { key: 'email', label: '邮箱' }, { key: 'role', label: '角色' },
        { key: 'source', label: '来源' }, { key: 'createdAt', label: '注册时间' }
      ], `users_${Date.now()}.csv`);
    });
  },

  _fillUserRows(list) {
    const tbody = this.modalEl.querySelector('#admin-user-tbody');
    if (!tbody) return;
    const wrap = tbody.closest('.admin-table-wrap');
    if (wrap) wrap.querySelectorAll('.admin-pager').forEach(n => n.remove());
    if (!list.length) {
      tbody.innerHTML = '<tr><td colspan="8" class="admin-empty">无匹配用户</td></tr>';
      return;
    }
    const { offset, limit } = this._getPage('users', list.length);
    const pageRows = list.slice(offset, offset + limit);
    tbody.innerHTML = pageRows.map(u => {
      const initial = (u.username || '?').charAt(0).toUpperCase();
      // 头像统一走 Settings.renderAvatarHtml（按账户自定义头像生效）
      const avatarHtml = (window.Settings && typeof window.Settings.renderAvatarHtml === 'function')
        ? window.Settings.renderAvatarHtml(u, { sizeClass: 'sm' })
        : `<span class="avatar-circle sm">${initial}</span>`;
      const reg = u.createdAt ? new Date(u.createdAt).toLocaleDateString('zh-CN') : '—';
      const idShort = String(u.id).length > 12 ? String(u.id).slice(0, 8) + '…' : u.id;
      return `
        <tr data-id="${this._esc(String(u.id))}">
          <td class="col-id" title="${this._esc(String(u.id))}">${this._esc(idShort)}</td>
          <td>${avatarHtml}</td>
          <td>${this._esc(u.username)}</td>
          <td class="col-email">${this._esc(u.email || '—')}</td>
          <td><span class="role-badge role-${u.role}">${this._roleLabel(u.role)}</span></td>
          <td><span class="src-badge ${u.source === 'cloud' ? 'src-cloud' : 'src-local'}">${u.source === 'cloud' ? '云端' : '本地'}</span></td>
          <td>${reg}</td>
          <td class="col-actions">
            <button class="admin-btn edit" data-uedit="${this._esc(String(u.id))}" title="编辑"><i class="fa-solid fa-pen"></i></button>
            <button class="admin-btn edit" data-ureset="${this._esc(String(u.id))}" title="重置密码"><i class="fa-solid fa-key"></i></button>
            <button class="admin-btn del" data-udel="${this._esc(String(u.id))}" title="删除"><i class="fa-solid fa-trash"></i></button>
          </td>
        </tr>`;
    }).join('');
    tbody.querySelectorAll('[data-uedit]').forEach(btn => {
      btn.addEventListener('click', () => {
        const u = this.usersCache.find(x => String(x.id) === btn.dataset.uedit);
        if (u) this._editUser(u);
      });
    });
    tbody.querySelectorAll('[data-udel]').forEach(btn => {
      btn.addEventListener('click', () => {
        const u = this.usersCache.find(x => String(x.id) === btn.dataset.udel);
        if (u) this._deleteUser(u);
      });
    });
    tbody.querySelectorAll('[data-ureset]').forEach(btn => {
      btn.addEventListener('click', () => {
        const u = this.usersCache.find(x => String(x.id) === btn.dataset.ureset);
        if (u) this._resetPwdModal(u);
      });
    });
    // 分页器
    this._renderPager('users', list.length, wrap, () => this._fillUserRows(this.usersCache.filter(u =>
      !this._userKw || (u.username || '').toLowerCase().includes(this._userKw) || (u.email || '').toLowerCase().includes(this._userKw)
    )));
  },

  // 重置用户密码（云端走 admin-reset 云函数；本地走 updateUser + hashPassword）
  _resetPwdModal(u) {
    const isCloud = u.source === 'cloud';
    const hasCloudId = isCloud || !!u.cloudId;
    const overlay = document.createElement('div');
    overlay.className = 'modal-overlay confirm-modal';
    overlay.innerHTML = `
      <div class="modal-box confirm-box glass">
        <h3><i class="fa-solid fa-key"></i> 重置密码 — ${this._esc(u.username)}</h3>
        <p style="margin-top:8px;font-size:13px;color:var(--text-sub, #999);">
          ${isCloud ? '云端账户：将通过服务端安全通道重置 Supabase 认证密码。' : hasCloudId ? '该用户已关联云端账户，将同时重置云端与本地密码。' : '本地账户：直接更新本地密码哈希。'}
        </p>
        <div class="admin-form" style="margin-top:12px;">
          <label>新密码<input type="password" id="rp-password" placeholder="6 位以上" autocomplete="new-password" /></label>
        </div>
        <div class="confirm-actions">
          <button class="btn-ghost" data-cancel>取消</button>
          <button class="btn-primary" data-ok>确认重置</button>
        </div>
      </div>
    `;
    document.body.appendChild(overlay);
    requestAnimationFrame(() => overlay.classList.add('open'));
    overlay.addEventListener('click', async (e) => {
      if (e.target === overlay || e.target.closest('[data-cancel]')) {
        overlay.classList.remove('open');
        setTimeout(() => overlay.remove(), 300);
      }
      if (e.target.closest('[data-ok]')) {
        const pwd = overlay.querySelector('#rp-password').value;
        if (!pwd || pwd.length < 6) { if (window.showToast) showToast('新密码至少 6 位', 'warn'); return; }
        try {
          if (hasCloudId) {
            // 云端重置：携带当前管理员会话 token，由云函数校验管理员身份后改密
            const { data: sessionData } = await supabase.auth.getSession();
            const token = sessionData && sessionData.session && sessionData.session.access_token;
            if (!token) {
              if (window.showToast) showToast('请先以管理员身份登录云端账户后再执行云端密码重置', 'warn');
              return;
            }
            const resp = await fetch('/api/auth', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                action: 'admin-reset',
                token,
                targetUserId: u.cloudId || u.id,
                newPassword: pwd
              })
            });
            const out = await resp.json().catch(() => ({}));
            if (!resp.ok) throw new Error(out.error || ('HTTP ' + resp.status));
            // 若本地也有记录（source=local 且关联云端），同步本地密码哈希保持一致
            if (!isCloud && window.hashPassword) {
              try { await updateUser(u.id, { passwordHash: await hashPassword(pwd) }); } catch (e2) { /* 本地同步失败不阻塞 */ }
            }
            await this._log('user.password.reset', 'user', u.id, `云端重置用户「${u.username}」密码`);
            if (window.showToast) showToast(`用户「${u.username}」云端密码已重置`, 'success');
          } else {
            if (!window.hashPassword) throw new Error('密码模块未加载');
            await updateUser(u.id, { passwordHash: await hashPassword(pwd) });
            await this._log('user.password.reset', 'user', u.id, `本地重置用户「${u.username}」密码`);
            if (window.showToast) showToast(`用户「${u.username}」密码已重置`, 'success');
          }
          if (typeof Sound !== 'undefined') Sound.playSound('success');
          overlay.classList.remove('open');
          setTimeout(() => overlay.remove(), 300);
        } catch (err) {
          if (window.showToast) showToast('重置失败：' + (err && err.message || '未知错误'), 'error');
        }
      }
    });
  },

  // 编辑用户（本地全量；云端尝试 RLS 内更新）
  _editUser(u) {
    const myRole = this._myRole();
    const isCloud = u.source === 'cloud';
    const roleOptions = myRole === 'superadmin'
      ? ['user', 'admin', 'superadmin']
      : ['user', 'admin'];
    const overlay = document.createElement('div');
    overlay.className = 'modal-overlay confirm-modal';
    overlay.innerHTML = `
      <div class="modal-box confirm-box glass">
        <h3>编辑用户 ${this._esc(u.username)}${isCloud ? ' <span class="src-badge src-cloud">云端账户</span>' : ''}</h3>
        <div class="admin-form" style="margin-top:12px;">
          <label>用户名<input type="text" id="au-username" value="${this._esc(u.username || '')}" /></label>
          <label>邮箱<input type="text" id="au-email" value="${this._esc(u.email || '')}" /></label>
          <label>简介<textarea id="au-bio">${this._esc(u.bio || '')}</textarea></label>
          <label>角色
            <select id="au-role" ${myRole !== 'superadmin' ? 'disabled title="仅超级管理员可修改角色"' : ''}>
              ${roleOptions.map(r => `<option value="${r}" ${u.role === r ? 'selected' : ''}>${this._roleLabel(r)}</option>`).join('')}
            </select>
          </label>
        </div>
        <div class="confirm-actions">
          <button class="btn-ghost" data-cancel>取消</button>
          <button class="btn-primary" data-ok>保存</button>
        </div>
      </div>
    `;
    document.body.appendChild(overlay);
    requestAnimationFrame(() => overlay.classList.add('open'));
    overlay.addEventListener('click', async (e) => {
      if (e.target === overlay || e.target.closest('[data-cancel]')) {
        overlay.classList.remove('open');
        setTimeout(() => overlay.remove(), 300);
      }
      if (e.target.closest('[data-ok]')) {
        const username = overlay.querySelector('#au-username').value.trim();
        if (!username) { if (window.showToast) showToast('用户名不能为空', 'warn'); return; }
        const data = {
          username,
          email: overlay.querySelector('#au-email').value.trim(),
          bio: overlay.querySelector('#au-bio').value.trim()
        };
        if (myRole === 'superadmin') data.role = overlay.querySelector('#au-role').value;
        try {
          if (isCloud) {
            // 云端账户：尝试 supabase profiles 更新（RLS 仅允许本人行，他人行会被静默拦截）
            const patch = { username: data.username, bio: data.bio };
            if (data.role) patch.role = data.role === 'superadmin' ? 'admin' : data.role;
            const { data: rows, error } = await supabase.from('profiles').update(patch).eq('id', u.id).select();
            if (error || !rows || !rows.length) {
              if (window.showToast) showToast('云端账户受 RLS 策略保护，演示环境仅本人资料可改（本地记录已更新展示缓存）', 'warn');
              await this._log('user.update.denied', 'user', u.id, `云端用户「${u.username}」更新被 RLS 拦截`);
            } else {
              if (window.showToast) showToast('云端用户已更新', 'success');
              await this._log('user.update', 'user', u.id, `云端用户「${username}」资料更新`);
            }
          } else {
            await updateUser(u.id, data);
            if (window.showToast) showToast('用户已更新', 'success');
            await this._log('user.update', 'user', u.id, `本地用户「${username}」资料更新${data.role ? '（角色→' + this._roleLabel(data.role) + '）' : ''}`);
          }
          if (typeof Sound !== 'undefined') Sound.playSound('success');
          overlay.classList.remove('open');
          setTimeout(() => overlay.remove(), 300);
          await this._loadContent();
        } catch (err) {
          if (window.showToast) showToast('保存失败：' + (err && err.message || '未知错误'), 'error');
        }
      }
    });
  },

  // 新增用户（本地注册，可直接指定角色）
  _addUserModal() {
    const myRole = this._myRole();
    const overlay = document.createElement('div');
    overlay.className = 'modal-overlay confirm-modal';
    overlay.innerHTML = `
      <div class="modal-box confirm-box glass">
        <h3>新增用户（本地账户）</h3>
        <div class="admin-form" style="margin-top:12px;">
          <label>用户名<input type="text" id="an-username" placeholder="2 字符以上" /></label>
          <label>邮箱<input type="text" id="an-email" placeholder="选填" /></label>
          <label>密码<input type="text" id="an-password" placeholder="6 位以上" /></label>
          <label>角色
            <select id="an-role">
              <option value="user">用户</option>
              <option value="admin">管理员</option>
              ${myRole === 'superadmin' ? '<option value="superadmin">超级管理员</option>' : ''}
            </select>
          </label>
        </div>
        <div class="confirm-actions">
          <button class="btn-ghost" data-cancel>取消</button>
          <button class="btn-primary" data-ok>创建</button>
        </div>
      </div>
    `;
    document.body.appendChild(overlay);
    requestAnimationFrame(() => overlay.classList.add('open'));
    overlay.addEventListener('click', async (e) => {
      if (e.target === overlay || e.target.closest('[data-cancel]')) {
        overlay.classList.remove('open');
        setTimeout(() => overlay.remove(), 300);
      }
      if (e.target.closest('[data-ok]')) {
        const username = overlay.querySelector('#an-username').value.trim();
        const password = overlay.querySelector('#an-password').value;
        const email = overlay.querySelector('#an-email').value.trim();
        const role = overlay.querySelector('#an-role').value;
        if (!username || username.length < 2) { if (window.showToast) showToast('用户名至少 2 个字符', 'warn'); return; }
        if (!password || password.length < 6) { if (window.showToast) showToast('密码至少 6 位', 'warn'); return; }
        try {
          const created = await registerUser({ username, password, email });
          if (role !== 'user') {
            await updateUser(created.id, { role, isAdmin: role !== 'user' });
          }
          await this._log('user.create', 'user', created.id, `新增本地用户「${username}」（角色 ${this._roleLabel(role)}）`);
          if (window.showToast) showToast(`用户「${username}」已创建`, 'success');
          if (typeof Sound !== 'undefined') Sound.playSound('success');
          overlay.classList.remove('open');
          setTimeout(() => overlay.remove(), 300);
          await this._loadContent();
        } catch (err) {
          if (window.showToast) showToast('创建失败：' + (err && err.message || '未知错误'), 'error');
        }
      }
    });
  },

  // 删除用户（本地级联删除；云端只读提示）
  _deleteUser(u) {
    const isCloud = u.source === 'cloud';
    const overlay = document.createElement('div');
    overlay.className = 'modal-overlay confirm-modal';
    overlay.innerHTML = `
      <div class="modal-box confirm-box glass">
        <h3><i class="fa-solid fa-triangle-exclamation"></i> 删除用户</h3>
        <p>确定删除用户「${this._esc(u.username)}」吗？${isCloud ? '（云端账户，需数据库管理员策略）' : '其全部作品、评论、点赞、收藏、关注数据将级联删除，不可撤销。'}</p>
        <div class="confirm-actions">
          <button class="btn-ghost" data-cancel>取消</button>
          <button class="btn-primary danger" data-ok>确认删除</button>
        </div>
      </div>
    `;
    document.body.appendChild(overlay);
    requestAnimationFrame(() => overlay.classList.add('open'));
    overlay.addEventListener('click', async (e) => {
      if (e.target === overlay || e.target.closest('[data-cancel]')) {
        overlay.classList.remove('open');
        setTimeout(() => overlay.remove(), 300);
      }
      if (e.target.closest('[data-ok]')) {
        try {
          if (isCloud) {
            const { data: rows, error } = await supabase.from('profiles').delete().eq('id', u.id).select();
            if (error || !rows || !rows.length) {
              if (window.showToast) showToast('云端账户删除需要 Service Role 权限（演示环境只读）', 'warn');
              await this._log('user.delete.denied', 'user', u.id, `云端用户「${u.username}」删除被 RLS 拦截`);
            } else {
              if (window.showToast) showToast('云端用户已删除', 'success');
              await this._log('user.delete', 'user', u.id, `云端用户「${u.username}」删除`);
            }
          } else {
            if (u.username === 'admin') {
              if (window.showToast) showToast('内置超级管理员账户不可删除', 'warn');
              return;
            }
            await deleteUserCascade(u.id);
            await this._log('user.delete', 'user', u.id, `本地用户「${u.username}」及关联数据级联删除`);
            if (window.showToast) showToast('用户及关联数据已删除', 'success');
            if (typeof Sound !== 'undefined') Sound.playSound('close');
          }
          overlay.classList.remove('open');
          setTimeout(() => overlay.remove(), 300);
          await this._loadContent();
          if (window.Gallery) Gallery.refreshGallery();
        } catch (err) {
          if (window.showToast) showToast('删除失败：' + (err && err.message || '未知错误'), 'error');
        }
      }
    });
  },

  // ==========================================================
  // 管理员与权限（仅 superadmin）
  // ==========================================================
  _renderAdmins(content) {
    const admins = this.usersCache.filter(u => u.role === 'admin' || u.role === 'superadmin');
    content.innerHTML = `
      <div class="admin-curate-panel">
        <div class="admin-curate-head">
          <div>
            <h3><i class="fa-solid fa-shield-halved"></i> 管理员账户</h3>
            <p class="admin-sub">现有 ${admins.length} 位管理员。新增管理员将创建云端账户，登录后立即拥有管理权限。</p>
          </div>
        </div>
        <div class="admin-table-wrap" style="margin-bottom:20px;">
          <table class="admin-table">
            <thead><tr><th>ID</th><th>用户名</th><th>角色</th><th>来源</th><th>注册时间</th><th>操作</th></tr></thead>
            <tbody>
              ${admins.map(a => {
                const isSuper = a.role === 'superadmin';
                const isSelf = String(a.id) === String((window.currentUser || {}).id);
                const isBuiltin = a.username === 'admin';
                const canOperate = !isBuiltin && !isSelf;
                return `
                <tr data-id="${a.id}">
                  <td class="col-id">${this._esc(String(a.id).slice(0, 8))}${String(a.id).length > 8 ? '…' : ''}</td>
                  <td>${this._esc(a.username)}${isSelf ? ' <span style="font-size:11px;color:#888;">（当前）</span>' : ''}${isBuiltin ? ' <span style="font-size:11px;color:#b45309;">（内置）</span>' : ''}</td>
                  <td><span class="role-badge role-${a.role}">${this._roleLabel(a.role)}</span></td>
                  <td><span class="src-badge ${a.source === 'cloud' ? 'src-cloud' : 'src-local'}">${a.source === 'cloud' ? '云端' : '本地'}</span></td>
                  <td>${a.createdAt ? new Date(a.createdAt).toLocaleDateString('zh-CN') : '—'}</td>
                  <td>
                    ${canOperate ? `
                      ${isSuper ? `<button class="admin-btn warn" data-demote="${a.id}" title="降级为普通用户"><i class="fa-solid fa-arrow-down"></i></button>` : `
                        <button class="admin-btn edit" data-promote="${a.id}" title="升级为超级管理员"><i class="fa-solid fa-arrow-up"></i></button>
                        <button class="admin-btn warn" data-demote="${a.id}" title="降级为普通用户"><i class="fa-solid fa-arrow-down"></i></button>
                      `}
                      <button class="admin-btn del" data-del="${a.id}" title="删除账户"><i class="fa-solid fa-trash"></i></button>
                    ` : '<span style="font-size:11px;color:#aaa;">—</span>'}
                  </td>
                </tr>`;
              }).join('')}
            </tbody>
          </table>
        </div>

        <h3 style="margin:8px 0 12px;"><i class="fa-solid fa-user-shield"></i> 新增管理员（云端账户）</h3>
        <div class="admin-form" id="admin-add-admin-form">
          <label>用户名<input type="text" id="aa-username" placeholder="登录用户名（2 字符以上）" /></label>
          <label>邮箱<input type="text" id="aa-email" placeholder="选填" /></label>
          <label>密码<input type="text" id="aa-password" placeholder="6 位以上" /></label>
          <label>权限级别
            <select id="aa-role">
              <option value="admin">管理员（内容审核 / 用户管理 / 数据统计 / 系统设置 / 日志）</option>
              <option value="superadmin">超级管理员（全部权限，含管理员管理）</option>
            </select>
          </label>
          <button class="btn-primary" id="aa-create" style="align-self:flex-start;"><i class="fa-solid fa-user-shield"></i> 创建管理员</button>
        </div>

        <h3 style="margin:24px 0 12px;"><i class="fa-solid fa-table-columns"></i> 权限矩阵</h3>
        <div class="admin-table-wrap">
          <table class="admin-table admin-perm-matrix">
            <thead><tr><th>功能模块</th><th>管理员</th><th>超级管理员</th></tr></thead>
            <tbody>
              <tr><td>数据看板</td><td class="perm-yes">✓</td><td class="perm-yes">✓</td></tr>
              <tr><td>作品管理与内容审核</td><td class="perm-yes">✓</td><td class="perm-yes">✓</td></tr>
              <tr><td>用户管理</td><td class="perm-yes">✓</td><td class="perm-yes">✓</td></tr>
              <tr><td>修改用户角色</td><td class="perm-no">✗</td><td class="perm-yes">✓</td></tr>
              <tr><td>管理员与权限管理</td><td class="perm-no">✗</td><td class="perm-yes">✓</td></tr>
              <tr><td>系统设置</td><td class="perm-yes">✓</td><td class="perm-yes">✓</td></tr>
              <tr><td>操作日志（清空）</td><td class="perm-no">✗</td><td class="perm-yes">✓</td></tr>
              <tr><td>AI 策展 / 合伙人审核</td><td class="perm-yes">✓</td><td class="perm-yes">✓</td></tr>
            </tbody>
          </table>
        </div>
      </div>
    `;
    content.querySelector('#aa-create')?.addEventListener('click', async () => {
      const username = content.querySelector('#aa-username').value.trim();
      const password = content.querySelector('#aa-password').value;
      const email = content.querySelector('#aa-email').value.trim();
      const role = content.querySelector('#aa-role').value;
      if (!username || username.length < 2) { if (window.showToast) showToast('用户名至少 2 个字符', 'warn'); return; }
      if (!password || password.length < 6) { if (window.showToast) showToast('密码至少 6 位', 'warn'); return; }
      const btn = content.querySelector('#aa-create');
      btn.disabled = true;
      btn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> 创建中…';
      try {
        await this._createCloudAdmin(username, password, email, role);
        await this._log('admin.create', 'user', username, `新增${role === 'superadmin' ? '超级' : ''}管理员「${username}」（云端账户）`);
        if (window.showToast) showToast(`管理员「${username}」已创建，可直接登录后台`, 'success');
        if (typeof Sound !== 'undefined') Sound.playSound('success');
        await this._loadContent();
      } catch (err) {
        if (window.showToast) showToast('创建失败：' + (err && err.message || '未知错误'), 'error');
      } finally {
        btn.disabled = false;
        btn.innerHTML = '<i class="fa-solid fa-user-shield"></i> 创建管理员';
      }
    });
    // 管理员操作按钮
    content.querySelectorAll('[data-promote]').forEach(btn => {
      btn.addEventListener('click', () => this._promoteAdmin(Number(btn.dataset.promote)));
    });
    content.querySelectorAll('[data-demote]').forEach(btn => {
      btn.addEventListener('click', () => this._demoteAdmin(Number(btn.dataset.demote)));
    });
    content.querySelectorAll('[data-del]').forEach(btn => {
      btn.addEventListener('click', () => this._deleteAdmin(Number(btn.dataset.del)));
    });
  },

  // 升级 / 降级管理员角色（superadmin 专属）
  async _promoteAdmin(userId) {
    const u = this.usersCache.find(x => x.id === userId);
    if (!u) return;
    if (u.username === 'admin') { if (window.showToast) showToast('内置账户不可修改', 'warn'); return; }
    const ok = await this._confirm(`确认将「${u.username}」升级为超级管理员？\n升级后该账户将拥有全部后台权限，包括管理员管理与操作日志清空。`);
    if (!ok) return;
    try {
      await updateUser(userId, { role: 'superadmin', isAdmin: true });
      await this._log('admin.promote', 'user', userId, `升级「${u.username}」为超级管理员`);
      if (window.showToast) showToast(`「${u.username}」已升级为超级管理员`, 'success');
      await this._loadContent();
    } catch (err) {
      if (window.showToast) showToast('操作失败：' + (err && err.message || '未知错误'), 'error');
    }
  },
  async _demoteAdmin(userId) {
    const u = this.usersCache.find(x => x.id === userId);
    if (!u) return;
    if (u.username === 'admin') { if (window.showToast) showToast('内置超级管理员不可降级', 'warn'); return; }
    const targetRole = u.role === 'superadmin' ? 'admin' : 'user';
    const label = targetRole === 'admin' ? '普通管理员' : '普通用户';
    const ok = await this._confirm(`确认将「${u.username}」降级为${label}？\n降级后该账户将失去对应管理权限${targetRole === 'user' ? '，作品/评论/点赞数据保留' : ''}。`);
    if (!ok) return;
    try {
      await updateUser(userId, { role: targetRole, isAdmin: targetRole !== 'user' });
      await this._log('admin.demote', 'user', userId, `降级「${u.username}」为${label}`);
      if (window.showToast) showToast(`「${u.username}」已降级为${label}`, 'success');
      await this._loadContent();
    } catch (err) {
      if (window.showToast) showToast('操作失败：' + (err && err.message || '未知错误'), 'error');
    }
  },
  async _deleteAdmin(userId) {
    const u = this.usersCache.find(x => x.id === userId);
    if (!u) return;
    if (u.username === 'admin') { if (window.showToast) showToast('内置超级管理员不可删除', 'warn'); return; }
    const isSelf = String(userId) === String((window.currentUser || {}).id);
    const isCloud = u.source === 'cloud';
    if (isSelf) { if (window.showToast) showToast('不能删除自己的账户', 'warn'); return; }
    const ok = await this._confirm(`确认永久删除管理员「${u.username}」？\n${isCloud ? '云端账户需数据库 Service Role 权限，演示环境可能只读拒绝' : '其全部作品、评论、点赞、收藏等数据将级联清理，不可恢复。'}`);
    if (!ok) return;
    try {
      if (isCloud) {
        const { data: rows, error } = await supabase.from('profiles').delete().eq('id', userId).select();
        if (error || !rows || !rows.length) {
          if (window.showToast) showToast('云端账户删除需要 Service Role 权限（演示环境只读）', 'warn');
          await this._log('admin.delete.denied', 'user', userId, `云端管理员「${u.username}」删除被 RLS 拦截`);
        } else {
          await this._log('admin.delete', 'user', userId, `删除云端管理员「${u.username}」`);
          if (window.showToast) showToast('管理员已删除', 'success');
        }
      } else {
        await deleteUserCascade(userId);
        await this._log('admin.delete', 'user', userId, `删除本地管理员「${u.username}」及关联数据`);
        if (window.showToast) showToast('管理员及关联数据已删除', 'success');
      }
      await this._loadContent();
    } catch (err) {
      if (window.showToast) showToast('删除失败：' + (err && err.message || '未知错误'), 'error');
    }
  },

  // 通过 Supabase REST signup 创建云端管理员（metadata 携带角色，不影响当前会话）
  async _createCloudAdmin(username, password, email, role) {
    if (!supabaseEnabled) throw new Error('云端未配置（检查 .env 的 VITE_SUPABASE_*）');
    const uname = String(username || '').trim().toLowerCase();
    const authEmail = email && email.includes('@') ? email : (uname.replace(/[^a-z0-9_.-]/g, '') + '@dreamcore.app');
    const url = (import.meta.env.VITE_SUPABASE_URL || '') + '/auth/v1/signup';
    const key = import.meta.env.VITE_SUPABASE_ANON_KEY || '';
    const resp = await fetch(url, {
      method: 'POST',
      headers: { 'apikey': key, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email: authEmail,
        password,
        data: {
          username,
          email,
          avatar: '',
          bio: 'Dreamcore 平台管理员',
          isAdmin: true,
          role: role || 'admin'
        }
      })
    });
    const result = await resp.json().catch(() => ({}));
    if (!resp.ok) {
      const msg = (result && result.msg) || (result && result.error_description) || '';
      if (/already registered|already exists/i.test(msg)) throw new Error('该用户名已被注册');
      throw new Error(msg || '云端注册失败');
    }
    return result;
  },

  // ==========================================================
  // 系统设置
  // ==========================================================
  async _renderSettings(content) {
    let settings = {};
    try { settings = await getAllSiteSettings(); } catch (e) { settings = {}; }
    content.innerHTML = `
      <div class="admin-curate-panel">
        <div class="admin-curate-head">
          <div>
            <h3><i class="fa-solid fa-gear"></i> 系统设置</h3>
            <p class="admin-sub">站点基础参数配置，保存后立即生效并写入数据库</p>
          </div>
          <button class="btn-primary" id="as-save"><i class="fa-solid fa-floppy-disk"></i> 保存设置</button>
        </div>
        <div class="admin-form">
          <label>站点名称<input type="text" id="as-site-name" value="${this._esc(settings.site_name || '')}" placeholder="Dreamcore" /></label>
          <label>站点公告（顶部横幅，留空不显示）<textarea id="as-announcement" placeholder="例如：欢迎来到 Dreamcore，AI 与非遗共创的梦境世界">${this._esc(settings.announcement || '')}</textarea></label>
          <div class="admin-setting-row">
            <div>
              <strong style="font-size:14px;">开放新用户注册</strong>
              <p class="admin-sub" style="margin:4px 0 0;">关闭后注册入口将拒绝新用户注册</p>
            </div>
            <label class="admin-switch"><input type="checkbox" id="as-allow-reg" ${settings.allow_registration !== false ? 'checked' : ''} /><span class="slider"></span></label>
          </div>
          <div class="admin-setting-row">
            <div>
              <strong style="font-size:14px;">AI 评分定级功能</strong>
              <p class="admin-sub" style="margin:4px 0 0;">关闭后新发布作品不再触发 AI 实时评级</p>
            </div>
            <label class="admin-switch"><input type="checkbox" id="as-ai-score" ${settings.ai_score_enabled !== false ? 'checked' : ''} /><span class="slider"></span></label>
          </div>
        </div>
      </div>
    `;
    content.querySelector('#as-save')?.addEventListener('click', async () => {
      const btn = content.querySelector('#as-save');
      btn.disabled = true;
      try {
        const newSettings = {
          site_name: content.querySelector('#as-site-name').value.trim(),
          announcement: content.querySelector('#as-announcement').value.trim(),
          allow_registration: content.querySelector('#as-allow-reg').checked,
          ai_score_enabled: content.querySelector('#as-ai-score').checked
        };
        for (const k of Object.keys(newSettings)) {
          await setSiteSetting(k, newSettings[k]);
        }
        await this._log('settings.update', 'settings', 'site', '更新系统设置：' + Object.keys(newSettings).map(k => k + '=' + newSettings[k]).join(', '));
        this.applySiteSettings(newSettings);
        if (window.showToast) showToast('设置已保存并生效', 'success');
        if (typeof Sound !== 'undefined') Sound.playSound('success');
      } catch (err) {
        if (window.showToast) showToast('保存失败：' + (err && err.message || '未知错误'), 'error');
      } finally {
        btn.disabled = false;
      }
    });
  },

  // 应用站点设置（main.js 启动时也会调用）
  applySiteSettings(s) {
    if (!s) return;
    try {
      if (s.site_name) {
        document.title = s.site_name + ' · AI+文旅文创艺术共创社区';
        const brand = document.querySelector('.logo-text');
        if (brand) brand.textContent = s.site_name;
      }
      const ann = String(s.announcement || '').trim();
      const existing = document.getElementById('site-announcement');
      if (ann && !sessionStorage.getItem('ann-dismissed')) {
        if (!existing) {
          const bar = document.createElement('div');
          bar.id = 'site-announcement';
          bar.className = 'site-announcement';
          bar.innerHTML = '<i class="fa-solid fa-bullhorn"></i> <span></span><button class="ann-close" aria-label="关闭公告"><i class="fa-solid fa-xmark"></i></button>';
          bar.querySelector('span').textContent = ann;
          document.body.insertAdjacentElement('afterbegin', bar);
          bar.querySelector('.ann-close').addEventListener('click', () => {
            sessionStorage.setItem('ann-dismissed', '1');
            bar.remove();
          });
        } else {
          existing.querySelector('span').textContent = ann;
        }
      } else if (existing && (!ann || sessionStorage.getItem('ann-dismissed'))) {
        existing.remove();
      }
    } catch (e) { /* 应用失败不阻塞 */ }
  },

  // ==========================================================
  // 操作日志
  // ==========================================================
  _renderLogs(content) {
    const myRole = this._myRole();
    const logs = this.logsCache;
    content.innerHTML = `
      <div class="admin-toolbar">
        <div class="admin-count">最近 <strong>${logs.length}</strong> 条管理操作</div>
        ${myRole === 'superadmin' ? '<button class="btn-primary danger" id="al-clear" style="padding:8px 16px;font-size:13px;"><i class="fa-solid fa-trash"></i> 清空日志</button>' : ''}
      </div>
      <div class="admin-table-wrap">
        <table class="admin-table">
          <thead><tr><th>#</th><th>时间</th><th>管理员</th><th>操作</th><th>对象</th><th>详情</th></tr></thead>
          <tbody>
            ${logs.length ? logs.map(l => `
              <tr>
                <td class="col-id">${l.id}</td>
                <td style="white-space:nowrap;">${l.createdAt ? new Date(l.createdAt).toLocaleString('zh-CN') : '—'}</td>
                <td>${this._esc(l.adminName)}</td>
                <td><span class="admin-log-action">${this._esc(l.action)}</span></td>
                <td>${this._esc(l.targetType)}${l.targetId ? ' #' + this._esc(String(l.targetId).slice(0, 8)) : ''}</td>
                <td class="col-title" style="max-width:260px;">${this._esc(l.detail)}</td>
              </tr>`).join('') : '<tr><td colspan="6" class="admin-empty">暂无操作日志</td></tr>'}
          </tbody>
        </table>
      </div>
    `;
    content.querySelector('#al-clear')?.addEventListener('click', async () => {
      try {
        await clearAdminLogs();
        await this._log('logs.clear', 'admin_logs', 'all', '清空操作日志');
        if (window.showToast) showToast('日志已清空', 'success');
        await this._loadContent();
      } catch (err) {
        if (window.showToast) showToast('清空失败：' + (err && err.message || '未知错误'), 'error');
      }
    });
  },

  // ----------------------------------------------------------
  // AI 策展面板：生成草案 → 预览 → 发布
  // ----------------------------------------------------------
  _renderCuratePanel(content) {
    content.innerHTML = `
      <div class="admin-curate-panel">
        <div class="admin-curate-head">
          <div>
            <h3><i class="fa-solid fa-wand-magic-sparkles"></i> AI 智能策展</h3>
            <p class="admin-sub">按非遗/地域/季节光影主题聚类作品生成 3-5 个展馆，支持草稿/发布状态管理</p>
          </div>
          <button class="btn-primary" id="admin-curate-generate"><i class="fa-solid fa-wand-magic-sparkles"></i> 生成展馆草案</button>
        </div>
        <div class="admin-curate-hint">
          <i class="fa-solid fa-circle-info"></i>
          点击「生成展馆草案」由 AI 自动聚类作品生成主题展馆，生成后可在
          <a href="#/curate" id="admin-curate-open">AI智能策展页面</a> 中预览与发布。
        </div>
      </div>
    `;
    const genBtn = content.querySelector('#admin-curate-generate');
    genBtn?.addEventListener('click', async () => {
      if (typeof Sound !== 'undefined') Sound.playSound('click');
      const user = window.currentUser;
      if (!user) { if (window.Auth) Auth.requireLogin(); return; }
      genBtn.disabled = true;
      genBtn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> AI 策展中…';
      try {
        const halls = await window.AICurate.generateHalls({ count: 3, userId: user.id || user.username });
        await this._log('curate.generate', 'curated_halls', '', `AI 生成 ${halls.length} 个展馆草案`);
        if (window.showToast) showToast(`✨ AI 已生成 ${halls.length} 个主题展馆草案`, 'success');
      } catch (err) {
        if (window.showToast) showToast('生成失败：' + (err && err.message || '未知错误'), 'error');
      } finally {
        genBtn.disabled = false;
        genBtn.innerHTML = '<i class="fa-solid fa-wand-magic-sparkles"></i> 生成展馆草案';
      }
    });
    content.querySelector('#admin-curate-open')?.addEventListener('click', () => {
      if (typeof Sound !== 'undefined') Sound.playSound('click');
      this._close();
    });
  },

  // ==========================================================
  // v11 新增：3D 模型管理（运营上传 glb 绑定品类 → 前端优先加载）
  // ==========================================================

  async _renderCustom3d(content) {
    // 懒加载 craft-products 获取品类列表
    let products = [];
    try {
      const mod = await import('../data/craft-products.js');
      products = mod.default || mod.CRAFT_PRODUCTS || mod.products || [];
    } catch (_) { /* ignore */ }
    const productOptions = products
      .map(p => `<option value="${this._esc(p.key)}">${this._esc(p.name)}（${this._esc(p.category || '')}）</option>`)
      .join('');

    const v = window.CUSTOM_3D_VALIDATION || { MAX_SIZE: 100*1024*1024, MAX_TRI: 100000, ALLOWED_FORMATS: ['glb','fbx','usdz'] };

    content.innerHTML = `
<div class="admin-c3d-panel">
  <div class="admin-c3d-head">
    <div>
      <h3><i class="fa-solid fa-cube"></i> 3D 模型管理</h3>
      <p class="admin-sub">为文创品类上传自定义 3D 模型（glb/fbx/usdz），前端自动优先加载；未绑定品类 fallback 到通用模板。</p>
    </div>
    <div class="admin-c3d-quota">
      <span><i class="fa-solid fa-file-lines"></i> ≤ ${(v.MAX_SIZE/1024/1024).toFixed(0)}MB</span>
      <span><i class="fa-solid fa-triangle"></i> ≤ ${v.MAX_TRI} 面</span>
      <span><i class="fa-solid fa-circle-check"></i> 推荐 glb</span>
    </div>
  </div>

  <div class="admin-c3d-upload" id="admin-c3d-upload">
    <h4><i class="fa-solid fa-cloud-arrow-up"></i> 上传新模型</h4>
    <div class="admin-c3d-row">
      <label>
        <span>模型文件</span>
        <input type="file" id="c3d-file" accept=".glb,.gltf,.fbx,.usdz" required />
      </label>
      <label>
        <span>自定义名称（可选）</span>
        <input type="text" id="c3d-name" placeholder="默认用文件名" />
      </label>
      <label>
        <span>绑定品类 <i class="fa-solid fa-asterisk" style="color:#ef4444;font-size:.6rem"></i></span>
        <input type="text" id="c3d-product-search" class="admin-c3d-cat-search" placeholder="搜索品类名称…" autocomplete="off" />
        <select id="c3d-product" required>
          <option value="">-- 请选择要替换的品类 --</option>
          ${productOptions}
        </select>
      </label>
      <button type="button" class="btn-primary" id="c3d-submit" disabled>
        <i class="fa-solid fa-upload"></i> 上传并绑定
      </button>
    </div>
    <div class="admin-c3d-msg" id="c3d-msg"></div>
    <div id="c3d-preview-wrap" style="display:none;margin-top:12px;">
      <div style="display:flex;gap:12px;align-items:flex-start;">
        <canvas id="c3d-preview" width="200" height="200" style="border-radius:8px;background:var(--bg-surface);width:200px;height:200px;"></canvas>
        <div id="c3d-info" style="flex:1;font-size:.78rem;color:var(--text-secondary);line-height:1.7;"></div>
      </div>
    </div>
  </div>

  <div class="admin-c3d-listhead">
    <h4 style="margin:0;"><i class="fa-solid fa-layer-group"></i> 已上传模型（${v.ALLOWED_FORMATS.length}种格式）</h4>
    <div class="admin-c3d-io">
      <button type="button" id="c3d-export" class="admin-c3d-io-btn" title="把所有已上传模型打包为 zip 备份，用于跨设备/跨浏览器恢复">
        <i class="fa-solid fa-file-export"></i> 导出全部
      </button>
      <button type="button" id="c3d-import-btn" class="admin-c3d-io-btn" title="从备份 zip 恢复模型（同一条记录会跳过，不会产生重复）">
        <i class="fa-solid fa-file-import"></i> 导入恢复
      </button>
      <input type="file" id="c3d-import" accept=".zip,application/zip" style="display:none" />
      <span id="c3d-io-msg"></span>
    </div>
  </div>
  <div id="admin-c3d-status" class="admin-c3d-status" style="display:none;margin-bottom:10px;padding:8px 12px;border-radius:8px;background:var(--bg-surface,white);border:1px solid var(--border,#e5e7eb);font-size:.78rem;align-items:center;gap:10px;flex-wrap:wrap;">
    <span id="c3d-status-text" style="color:var(--text-secondary,#6b7280)"></span>
    <button type="button" id="c3d-backfill-btn" style="padding:4px 10px;border-radius:6px;border:1px solid var(--border,#d1d5db);background:transparent;cursor:pointer;font-size:.76rem;">
      <i class="fa-solid fa-wand-magic-sparkles"></i> 立即补齐缩略图
    </button>
    <span id="c3d-progress" style="color:#d97706;font-size:.74rem;display:none"></span>
  </div>
  <div class="admin-c3d-grid" id="admin-c3d-grid">
    <div class="admin-empty"><i class="fa-solid fa-spinner fa-spin"></i> 加载中…</div>
  </div>
</div>
`;

    // 注入样式（幂等）——全部使用 CSS 变量，暗色/亮色自动适配
    if (!document.getElementById('admin-c3d-style')) {
      const style = document.createElement('style');
      style.id = 'admin-c3d-style';
      style.textContent = `
.admin-c3d-panel{display:flex;flex-direction:column;gap:14px}
.admin-c3d-head{display:flex;justify-content:space-between;align-items:flex-start;gap:16px}
.admin-c3d-head h3{margin:0;font-size:1rem}
.admin-c3d-quota{display:flex;gap:10px;font-size:.72rem;color:var(--text-secondary);margin-top:4px}
.admin-c3d-quota span{background:var(--bg-surface);padding:3px 9px;border-radius:999px;border:1px solid var(--glass-border);color:var(--text-secondary)}
.admin-c3d-upload{background:var(--bg-surface);border:1px solid var(--glass-border);border-radius:10px;padding:14px}
.admin-c3d-upload h4{margin:0 0 10px;font-size:.85rem;color:var(--text-primary)}
.admin-c3d-row{display:grid;grid-template-columns:1.4fr 1fr 1.4fr auto;gap:10px;align-items:end}
.admin-c3d-row label{display:flex;flex-direction:column;gap:4px;font-size:.74rem;color:var(--text-secondary)}
.admin-c3d-row input,.admin-c3d-row select{padding:6px 9px;border:1px solid var(--glass-border);border-radius:6px;font-size:.82rem;background:var(--bg-surface);color:var(--text-primary)}
.admin-c3d-row select option{background:var(--bg-dark);color:var(--text-primary)}
.admin-c3d-card{background:var(--bg-surface);border:1px solid var(--glass-border);border-radius:10px;overflow:hidden;display:flex;flex-direction:column}
.admin-c3d-card-thumb{width:100%;aspect-ratio:1;background:var(--bg-surface);display:flex;align-items:center;justify-content:center;font-size:.8rem;color:var(--text-secondary)}
.admin-c3d-card-thumb img{width:100%;height:100%;object-fit:cover}
.admin-c3d-card-body{padding:10px 12px;font-size:.78rem;display:flex;flex-direction:column;gap:4px}
.admin-c3d-card-name{font-weight:600;color:var(--text-primary);font-size:.82rem;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.admin-c3d-card-meta{display:flex;justify-content:space-between;color:var(--text-secondary);font-size:.72rem}
.admin-c3d-card-pill{display:inline-flex;align-items:center;gap:3px;background:rgba(96,165,250,.16);color:#3b82f6;padding:1px 8px;border-radius:999px;font-size:.68rem;font-weight:600}
.admin-c3d-card-pill.ok{background:rgba(52,211,153,.22);color:#159a6b}
.admin-c3d-card-pill.warn{background:rgba(245,158,11,.16);color:#d97706}
.admin-c3d-card-actions{display:flex;gap:6px;margin-top:6px}
.admin-c3d-card-actions button{flex:1;padding:5px 0;border:1px solid var(--glass-border);border-radius:6px;background:var(--bg-surface);font-size:.72rem;cursor:pointer;color:var(--text-primary)}
.admin-c3d-card-actions button.danger{background:rgba(239,68,68,.08);color:#ef4444;border-color:rgba(239,68,68,.2)}
.admin-c3d-cat-search{padding:6px 9px;border:1px solid var(--glass-border);border-radius:6px;font-size:.82rem;background:var(--bg-surface);color:var(--text-primary);width:100%;outline:none}
.admin-c3d-cat-search:focus{border-color:rgba(201,182,255,0.6);box-shadow:0 0 0 2px rgba(201,182,255,0.16)}
.admin-c3d-cat-filtered select{background:var(--bg-surface)}
.admin-c3d-cat-filtered select option{background:var(--bg-dark);color:var(--text-primary)}
.admin-c3d-msg{font-size:.78rem;margin-top:8px;min-height:18px}
.admin-c3d-msg.err{color:#ef4444}
.admin-c3d-msg.ok{color:#159a6b}
.admin-c3d-grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(220px,1fr));gap:12px}
.admin-c3d-listhead{display:flex;justify-content:space-between;align-items:center;gap:12px;margin:20px 0 10px;flex-wrap:wrap}
.admin-c3d-io{display:flex;align-items:center;gap:8px;flex-wrap:wrap}
.admin-c3d-io-btn{padding:5px 12px;border:1px solid var(--glass-border);border-radius:6px;background:var(--bg-surface);color:var(--text-primary);font-size:.76rem;cursor:pointer;display:inline-flex;align-items:center;gap:5px}
.admin-c3d-io-btn:hover{border-color:rgba(201,182,255,.6);background:rgba(201,182,255,.08)}
.admin-c3d-io-btn:disabled{opacity:.55;cursor:not-allowed}
#c3d-io-msg{font-size:.74rem;color:var(--text-secondary);min-height:16px}
#c3d-io-msg.err{color:#ef4444}
#c3d-io-msg.ok{color:#159a6b}
      `;
      document.head.appendChild(style);
    }

    // 上传文件处理
    const fileInput = content.querySelector('#c3d-file');
    const nameInput = content.querySelector('#c3d-name');
    const productSel = content.querySelector('#c3d-product');
    const productSearch = content.querySelector('#c3d-product-search');
    const submitBtn = content.querySelector('#c3d-submit');
    const msg = content.querySelector('#c3d-msg');
    const previewWrap = content.querySelector('#c3d-preview-wrap');
    const previewCanvas = content.querySelector('#c3d-preview');
    const infoDiv = content.querySelector('#c3d-info');

    // 品类搜索过滤（名称 + key 模糊匹配）
    productSearch?.addEventListener('input', () => {
      const kw = productSearch.value.trim().toLowerCase();
      if (!kw) {
        [...productSel.options].forEach(o => o.hidden = false);
        return;
      }
      [...productSel.options].forEach(o => {
        if (!o.value) { o.hidden = false; return; }
        const text = (o.textContent || '').toLowerCase();
        const val = (o.value || '').toLowerCase();
        o.hidden = !text.includes(kw) && !val.includes(kw);
      });
    });

    let pendingFile = null;
    let pendingFormat = null;
    let pendingTriCount = 0;
    let pendingPreviewDataURL = null;

    const ALLOWED = v.ALLOWED_FORMATS;

    fileInput?.addEventListener('change', async () => {
      msg.className = 'admin-c3d-msg'; msg.textContent = '';
      previewWrap.style.display = 'none';
      pendingFile = null; pendingFormat = null; pendingTriCount = 0; pendingPreviewDataURL = null;
      submitBtn.disabled = true;

      const f = fileInput.files?.[0];
      if (!f) return;
      const ext = f.name.split('.').pop().toLowerCase();
      if (!ALLOWED.includes(ext)) {
        msg.className = 'admin-c3d-msg err';
        msg.textContent = `格式不支持：.${ext}，仅允许 ${ALLOWED.join(' / ')}（推荐 glb）`;
        fileInput.value = ''; return;
      }
      if (f.size > v.MAX_SIZE) {
        msg.className = 'admin-c3d-msg err';
        msg.textContent = `文件过大：${(f.size/1024/1024).toFixed(2)}MB，上限 ${(v.MAX_SIZE/1024/1024).toFixed(0)}MB`;
        fileInput.value = ''; return;
      }

      // 粗校验通过，解析 glb 面数（需要 three.js）
      msg.textContent = '解析模型面数…';
      try {
        const ab = await f.arrayBuffer();

        // ── 内部辅助：渲染预览缩略图（glb/fbx 通用，失败静默降级） ──
        const renderThumb = async (group, modelName) => {
          try {
            const THREE = await import('three');
            const renderer = new THREE.WebGLRenderer({
              canvas: previewCanvas, antialias: true, alpha: false,
              preserveDrawingBuffer: true
            });
            renderer.setPixelRatio(1); renderer.setSize(200, 200, false);
            renderer.setClearColor(0xf5f2ec, 1);
            renderer.outputColorSpace = THREE.SRGBColorSpace;
            renderer.toneMapping = THREE.ACESFilmicToneMapping;
            const pmrem = new THREE.PMREMGenerator(renderer);
            const envMod = await import('three/addons/environments/RoomEnvironment.js');
            const envTex = pmrem.fromScene(new envMod.RoomEnvironment(), 0.04).texture;
            const scene = new THREE.Scene();
            const box = new THREE.Box3().setFromObject(group);
            const size = box.getSize(new THREE.Vector3());
            const maxDim = Math.max(size.x, size.y, size.z) || 1;
            group.scale.setScalar(1.2 / maxDim);
            const box2 = new THREE.Box3().setFromObject(group);
            group.position.sub(box2.getCenter(new THREE.Vector3()));
            scene.add(group);
            scene.add(new THREE.AmbientLight(0xffffff, .88));
            const key = new THREE.DirectionalLight(0xfff8f0, 1.0);
            key.position.set(2, 3, 2); scene.add(key);
            scene.environment = envTex;
            const camera = new THREE.PerspectiveCamera(38, 1, .05, 60);
            camera.position.set(2, 1.5, 2.5); camera.lookAt(0, 0, 0);
            renderer.render(scene, camera);
            const dataURL = previewCanvas.toDataURL('image/png');

            // 完整释放 GPU 资源
            scene.traverse(o => {
              if (o.geometry) o.geometry.dispose();
              if (o.material) {
                const ms = Array.isArray(o.material) ? o.material : [o.material];
                ms.forEach(m => {
                  if (!m) return;
                  for (const k of Object.keys(m)) { const v = m[k]; if (v && v.isTexture) v.dispose(); }
                  m.dispose();
                });
              }
            });
            envTex.dispose(); pmrem.dispose();
            renderer.dispose(); renderer.forceContextLoss?.();

            console.log('[Admin C3D] 缩略图渲染成功：' + modelName + '（' + Math.round(dataURL.length / 1024) + 'KB）');
            previewWrap.style.display = 'block';
            infoDiv.innerHTML = `<b>${modelName}</b><br>大小：${(f.size/1024).toFixed(1)}KB<br>格式：${ext.toUpperCase()}`;
            return dataURL;
          } catch (e) {
            console.warn('[Admin C3D] 缩略图渲染降级：' + modelName, e?.message);
            previewWrap.style.display = 'none';
            return null;
          }
        };

        // ── 分支处理不同格式 ──────────────────────────────────────
        if (ext === 'glb') {
          // glb：完整解析（面数 + 缩略图）
          const Craft3D = await import('../js/craft-3d.js');
          const THREE = await import('three');
          const gltfMod = await import('three/addons/loaders/GLTFLoader.js');
          const dracoMod = await import('three/addons/loaders/DRACOLoader.js');
          const draco = new dracoMod.DRACOLoader();
          draco.setDecoderPath('/draco/');
          const loader = new gltfMod.GLTFLoader();
          loader.setDRACOLoader(draco);
          const gltf = await new Promise((res, rej) => {
            loader.parse(ab, '', (g) => res(g), (e) => rej(e));
          });
          const group = gltf.scene || gltf.scenes[0];
          const tri = Craft3D.countTriangles(group);
          if (tri > v.MAX_TRI) {
            msg.className = 'admin-c3d-msg err';
            msg.textContent = `面数过多：${tri}，上限 ${v.MAX_TRI}（建议使用低面数模型保证 WebGL 流畅）`;
            fileInput.value = ''; return;
          }
          pendingFile = ab; pendingFormat = 'glb'; pendingTriCount = tri;
          pendingPreviewDataURL = await renderThumb(group, f.name);
          msg.className = 'admin-c3d-msg ok';
          msg.textContent = `解析成功，面数 ${tri}（上限 ${v.MAX_TRI}），可上传`;

        } else if (ext === 'fbx') {
          // fbx：用 FBXLoader 解析 + 缩略图渲染，面数暂不统计
          try {
            const THREE = await import('three');
            const fbxMod = await import('three/addons/loaders/FBXLoader.js');
            const loader = new fbxMod.FBXLoader();
            const group = loader.parse(ab, '');
            pendingFile = ab; pendingFormat = 'fbx'; pendingTriCount = 0;
            pendingPreviewDataURL = await renderThumb(group, f.name);
            msg.className = 'admin-c3d-msg ok';
            msg.textContent = `${f.name} · ${(f.size/1024).toFixed(1)}KB · FBX 解析成功（面数未统计）`;
          } catch (fbxErr) {
            // FBX 解析失败仍允许上传，降级为无面数/无缩略图
            console.warn('[Admin C3D] FBX 解析失败（降级上传）：', fbxErr?.message);
            pendingFile = ab; pendingFormat = 'fbx'; pendingTriCount = 0;
            pendingPreviewDataURL = null;
            msg.className = 'admin-c3d-msg ok';
            msg.textContent = `${f.name} · ${(f.size/1024).toFixed(1)}KB · FBX 解析失败（仍可上传）`;
          }

        } else {
          // usdz 等其他：暂不支持实时解析，提示但允许上传
          pendingFile = ab; pendingFormat = ext; pendingTriCount = 0;
          pendingPreviewDataURL = null;
          msg.className = 'admin-c3d-msg ok';
          msg.textContent = `${f.name} · ${(f.size/1024).toFixed(1)}KB · 面数暂无法自动统计`;
        }
      } catch (err) {
        msg.className = 'admin-c3d-msg err';
        msg.textContent = '解析失败：' + (err && err.message || String(err));
        fileInput.value = ''; return;
      }

      submitBtn.disabled = false;
    });

    // 提交上传
    submitBtn?.addEventListener('click', async () => {
      const productKey = productSel.value;
      if (!pendingFile || !productKey) {
        msg.className = 'admin-c3d-msg err';
        msg.textContent = '请先选择文件并绑定品类'; return;
      }
      const name = nameInput.value.trim() || fileInput.files?.[0]?.name.replace(/\.[^.]+$/, '') || '自定义模型';
      submitBtn.disabled = true;
      submitBtn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> 上传中…';
      msg.className = 'admin-c3d-msg'; msg.textContent = '';

      try {
        const user = window.currentUser || {};
        const rec = await window.addCustom3dModel({
          name, file: pendingFile, size: pendingFile.byteLength,
          format: pendingFormat, triCount: pendingTriCount,
          productKey, uploadedBy: user.username || 'admin',
          previewImage: pendingPreviewDataURL || ''
        });
        await this._log('custom3d.upload', 'custom_3d_models', rec.id, `${pendingFormat} · ${pendingTriCount}面 · 绑定 ${productKey}`);
        // 刷新内存 cache
        if (window.Craft3D && Craft3D.clearCustomModelCache) Craft3D.clearCustomModelCache();
        await this._refreshList(content);
        msg.className = 'admin-c3d-msg ok';
        msg.textContent = `✅ 上传成功：${name} 已绑定到 ${productKey}`;
        fileInput.value = ''; nameInput.value = ''; productSel.value = '';
        pendingFile = null; pendingFormat = null; pendingTriCount = 0; pendingPreviewDataURL = null;
        submitBtn.disabled = true; submitBtn.innerHTML = '<i class="fa-solid fa-upload"></i> 上传并绑定';
        previewWrap.style.display = 'none';
        if (window.showToast) showToast('✅ 3D 模型上传成功', 'success');
      } catch (err) {
        msg.className = 'admin-c3d-msg err';
        msg.textContent = '上传失败：' + (err && err.message || String(err));
        submitBtn.disabled = false;
        submitBtn.innerHTML = '<i class="fa-solid fa-upload"></i> 上传并绑定';
      }
    });

    // ── 导出全部 / 导入恢复（跨设备演示数据备份）──────────────
    const exportBtn = content.querySelector('#c3d-export');
    const importBtn = content.querySelector('#c3d-import-btn');
    const importFile = content.querySelector('#c3d-import');
    const ioMsg = content.querySelector('#c3d-io-msg');

    exportBtn?.addEventListener('click', () => this._exportCustom3d(exportBtn, ioMsg));
    importBtn?.addEventListener('click', () => importFile?.click());
    importFile?.addEventListener('change', () => {
      const f = importFile.files?.[0];
      if (f) this._importCustom3d(f, content, importFile, ioMsg);
    });

    await this._refreshList(content);
  },

  // ----------------------------------------------------------
  // 导出全部：把所有已上传 3D 模型打包为 zip
  //   结构：manifest.json + models/<i>.<ext>（二进制独立条目）
  //   manifest: { kind:'dreamcore-c3d-backup', version:1, exportedAt, count, models:[...] }
  //   previewImage（dataURL）体积小，内联在 manifest，方便导入后直接还原缩略图
  // ----------------------------------------------------------
  async _exportCustom3d(btn, ioMsg) {
    const setMsg = (text, cls = '') => { if (ioMsg) { ioMsg.className = cls; ioMsg.textContent = text; } };
    const oldHtml = btn ? btn.innerHTML : '';
    if (btn) { btn.disabled = true; btn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> 导出中…'; }
    let objUrl = '';
    try {
      const list = (await window.getAllCustom3dModels?.()) || [];
      if (!list.length) { setMsg('当前没有可导出的模型', 'err'); return; }

      const files = {};
      const models = [];
      list.forEach((m, i) => {
        const src = m.file;
        if (!(src instanceof ArrayBuffer)) return;       // 缺二进制则跳过（异常记录）
        const ext = String(m.format || 'glb').toLowerCase();
        const entry = `models/${i}.${ext}`;              // 条目名不含用户输入，避免非法字符
        files[entry] = new Uint8Array(src);
        models.push({
          entry, name: m.name || `模型${i}`, format: ext,
          size: Number(m.size) || src.byteLength,
          triCount: Number(m.triCount) || 0,
          productKey: String(m.productKey || ''),
          uploadedBy: String(m.uploadedBy || 'admin'),
          previewImage: String(m.previewImage || ''),
          createdAt: String(m.createdAt || new Date().toISOString())
        });
      });
      if (!models.length) { setMsg('模型数据缺少二进制内容，无法导出', 'err'); return; }

      files['manifest.json'] = strToU8(JSON.stringify({
        kind: 'dreamcore-c3d-backup', version: 1,
        exportedAt: new Date().toISOString(),
        count: models.length, models
      }));

      // level 0（store）：GLB 已是压缩二进制，再压缩收益低；直接存储导出/导入更快、体积不膨胀
      const zip = zipSync(files, { level: 0 });
      const blob = new Blob([zip], { type: 'application/zip' });
      const d = new Date();
      const pad = (n) => String(n).padStart(2, '0');
      const stamp = `${d.getFullYear()}${pad(d.getMonth() + 1)}${pad(d.getDate())}-${pad(d.getHours())}${pad(d.getMinutes())}`;
      objUrl = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = objUrl;
      a.download = `dreamcore-c3d-backup-${stamp}.zip`;
      document.body.appendChild(a); a.click(); a.remove();

      const mb = (zip.byteLength / 1024 / 1024).toFixed(2);
      await this._log('custom3d.export', 'custom_3d_models', '-', `导出 ${models.length} 个模型（${mb}MB）`);
      setMsg(`✅ 已导出 ${models.length} 个模型（${mb}MB）`, 'ok');
      if (window.showToast) showToast(`✅ 已导出 ${models.length} 个模型`, 'success');
    } catch (err) {
      console.error('[Admin C3D] 导出失败：', err);
      setMsg('导出失败：' + (err && err.message || String(err)), 'err');
    } finally {
      if (objUrl) setTimeout(() => URL.revokeObjectURL(objUrl), 4000);
      if (btn) { btn.disabled = false; btn.innerHTML = oldHtml; }
    }
  },

  // ----------------------------------------------------------
  // 导入恢复：解析备份 zip → 组装 records → 批量写入 IndexedDB
  //   已存在记录（createdAt|name|size）由 db 层自动跳过，重复导入不产生副本
  // ----------------------------------------------------------
  async _importCustom3d(file, content, inputEl, ioMsg) {
    const setMsg = (text, cls = '') => { if (ioMsg) { ioMsg.className = cls; ioMsg.textContent = text; } };
    try {
      if (!/\.zip$/i.test(file.name)) { setMsg('请选择 .zip 备份文件', 'err'); return; }
      setMsg('解析备份…');
      const buf = await file.arrayBuffer();
      let entries;
      try { entries = unzipSync(new Uint8Array(buf)); }
      catch { setMsg('备份文件已损坏或不是有效 zip', 'err'); return; }

      if (!entries['manifest.json']) { setMsg('备份缺少 manifest.json，可能不是本站备份文件', 'err'); return; }
      let manifest;
      try { manifest = JSON.parse(strFromU8(entries['manifest.json'])); }
      catch { setMsg('manifest.json 解析失败', 'err'); return; }
      if (manifest.kind !== 'dreamcore-c3d-backup') { setMsg('备份类型不匹配（kind 非法）', 'err'); return; }
      const models = Array.isArray(manifest.models) ? manifest.models : [];
      if (!models.length) { setMsg('备份中没有模型记录', 'err'); return; }

      const records = [];
      for (const m of models) {
        const bytes = entries[m.entry];
        if (!bytes) continue;
        // 从 zip 条目复制出独立 ArrayBuffer（避免共享底层 buffer 造成越界读取）
        const ab = bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength);
        records.push({
          name: m.name, file: ab, size: ab.byteLength,
          format: m.format, triCount: m.triCount,
          productKey: m.productKey, uploadedBy: m.uploadedBy,
          previewImage: m.previewImage, createdAt: m.createdAt
        });
      }
      if (!records.length) { setMsg('备份中没有可用的模型文件', 'err'); return; }

      setMsg(`正在导入 ${records.length} 个模型…`);
      const res = await (window.importCustom3dModels?.(records) || Promise.reject(new Error('导入接口不可用')));
      if (window.Craft3D?.clearCustomModelCache) window.Craft3D.clearCustomModelCache();
      await this._log('custom3d.import', 'custom_3d_models', '-', `导入备份：新增 ${res.added} · 跳过 ${res.skipped} · 无效 ${res.invalid}`);
      await this._refreshList(content);

      const parts = [`新增 ${res.added}`];
      if (res.skipped) parts.push(`跳过重复 ${res.skipped}`);
      if (res.invalid) parts.push(`无效 ${res.invalid}`);
      setMsg(`✅ 导入完成：${parts.join(' · ')}`, 'ok');
      if (window.showToast) showToast(`✅ 导入完成（${parts.join('，')}）`, 'success');
    } catch (err) {
      console.error('[Admin C3D] 导入失败：', err);
      setMsg('导入失败：' + (err && err.message || String(err)), 'err');
    } finally {
      if (inputEl) inputEl.value = '';
    }
  },

  // 辅助：刷新模型列表（自身 try-catch，不向上冒泡让整个后台崩）
  async _refreshList(content) {
    const grid = content.querySelector('#admin-c3d-grid');
    if (!grid) return;
    grid.innerHTML = '<div class="admin-empty"><i class="fa-solid fa-spinner fa-spin"></i> 加载中…</div>';

    let list = [];
    try {
      list = await window.getCustom3dModelsMeta?.() || [];
    } catch (err) {
      // 列表读取失败（表不存在/upgrade 竞争）—— 静默降级为空列表，不崩整个后台
      console.warn('[Admin C3D] 模型列表加载失败（已静默降级）：', err && err.message);
      grid.innerHTML = '<div class="admin-empty" style="grid-column:1/-1;color:#d97706"><i class="fa-solid fa-triangle-exclamation"></i> 模型数据暂不可用，刷新页面后重试</div>';
      return;
    }
    if (list.length === 0) {
      grid.innerHTML = '<div class="admin-empty" style="grid-column:1/-1">尚无自定义 3D 模型，使用顶部表单上传</div>';
      return;
    }

    grid.innerHTML = list.map(m => {
      const sizeKB = (m.size / 1024).toFixed(1);
      const time = m.createdAt ? new Date(m.createdAt).toLocaleString('zh-CN', { month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' }) : '';
      const fmt = (m.format || 'glb').toUpperCase();
      const boundPill = m.productKey
        ? `<span class="admin-c3d-card-pill ok" data-edit="${m.id}">已绑定 ${this._esc(m.productKey)} <i class="fa-solid fa-pen" style="margin-left:3px"></i></span>`
        : `<span class="admin-c3d-card-pill warn">未绑定</span>`;
      const thumb = m.previewImage
        ? `<img src="${m.previewImage}" alt="预览" />`
        : `<i class="fa-solid fa-cube" style="font-size:2rem;opacity:.4"></i>`;
      return `
<div class="admin-c3d-card" data-id="${m.id}">
  <div class="admin-c3d-card-thumb">${thumb}</div>
  <div class="admin-c3d-card-body">
    <div class="admin-c3d-card-name" title="${this._esc(m.name)}">${this._esc(m.name)}</div>
    <div class="admin-c3d-card-meta">
      <span>${fmt} · ${sizeKB}KB</span>
      <span>${m.triCount || '?'} 面</span>
    </div>
    ${boundPill}
    <div class="admin-c3d-card-meta" style="color:#aaa;font-size:.68rem">${time}</div>
    <div class="admin-c3d-card-actions">
      <button data-del="${m.id}" class="danger"><i class="fa-solid fa-trash"></i> 删除</button>
    </div>
  </div>
</div>`;
    }).join('');

    // 删除事件
    grid.querySelectorAll('[data-del]').forEach(btn => {
      btn.addEventListener('click', async (e) => {
        e.stopPropagation();
        const id = Number(btn.dataset.del);
        if (!confirm('确认删除此自定义 3D 模型？该品类将回退到通用模板')) return;
        try {
          await window.deleteCustom3dModel(id);
          await this._log('custom3d.delete', 'custom_3d_models', id, '删除自定义 3D 模型');
          if (window.Craft3D && Craft3D.clearCustomModelCache) Craft3D.clearCustomModelCache();
          await this._refreshList(content);
          if (window.showToast) showToast('已删除', 'success');
        } catch (err) {
          if (window.showToast) showToast('删除失败：' + (err && err.message || err), 'error');
        }
      });
    });

    // 编辑绑定事件
    grid.querySelectorAll('[data-edit]').forEach(btn => {
      btn.addEventListener('click', async (e) => {
        e.stopPropagation();
        const id = Number(btn.dataset.edit);
        try {
          const mod = await import('../data/craft-products.js');
          const products = mod.default || mod.CRAFT_PRODUCTS || mod.products || [];
          const newKey = prompt('修改绑定品类（输入品类 key）\n\n可选：\n' + products.map(p => `  · ${p.key} — ${p.name}`).join('\n'));
          if (!newKey) return;
          const valid = products.find(p => p.key === newKey.trim());
          if (!valid) { alert('无效的品类 key'); return; }
          await window.updateCustom3dModel(id, { productKey: newKey.trim() });
          await this._log('custom3d.bind', 'custom_3d_models', id, `重新绑定 → ${newKey}`);
          if (window.Craft3D && Craft3D.clearCustomModelCache) Craft3D.clearCustomModelCache();
          await this._refreshList(content);
        } catch (err) {
          if (window.showToast) showToast('绑定失败：' + (err && err.message || err), 'error');
        }
      });
    });

    // ── 状态条：显示缩略图统计 + 手动补齐入口 ──────────────
    const missingIds = list.filter(m => !m.previewImage).map(m => m.id);
    const hasIds = list.filter(m => !!m.previewImage).length;
    const statusBar = content.querySelector('#admin-c3d-status');
    const statusText = content.querySelector('#c3d-status-text');
    const backfillBtn = content.querySelector('#c3d-backfill-btn');
    const progressEl = content.querySelector('#c3d-progress');
    if (statusBar) {
      if (missingIds.length > 0) {
        statusBar.style.display = 'flex';
        statusText.textContent = `共 ${list.length} 个模型 · 已有缩略图 ${hasIds} · 缺失 ${missingIds.length}`;
      } else {
        statusBar.style.display = 'flex';
        statusText.textContent = `✓ 全部 ${list.length} 个模型已有缩略图`;
        if (backfillBtn) backfillBtn.style.display = 'none';
      }
      // 手动补齐按钮
      // 修复「点击无反应」：旧实现在自动补齐占用标志位时是「静默 return」，
      // 用户看不到任何变化。此处改为始终给出可见反馈。
      if (backfillBtn && missingIds.length > 0) {
        backfillBtn.style.display = '';
        backfillBtn.onclick = async () => {
          if (this._c3dBackfillRunning) {
            progressEl.style.display = 'inline';
            progressEl.textContent = '补齐进行中，请稍候…';
            return;
          }
          this._c3dBackfillRunning = true;
          backfillBtn.disabled = true;
          backfillBtn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> 补齐中…';
          progressEl.style.display = 'inline';
          progressEl.textContent = `开始补齐 ${missingIds.length} 个缺失模型…`;
          try {
            const res = await this._backfillMissingThumbnails(missingIds, content, (msg) => {
              progressEl.textContent = msg;
            });
            progressEl.textContent = res && res.fail > 0
              ? `补齐完成：成功 ${res.ok} · 失败 ${res.fail}（失败原因见控制台 [Admin C3D] 日志）`
              : `补齐完成：成功 ${res?.ok ?? 0}`;
          } catch (err) {
            progressEl.textContent = '补齐异常：' + (err?.message || err);
          } finally {
            this._c3dBackfillRunning = false;
            backfillBtn.disabled = false;
            backfillBtn.innerHTML = '<i class="fa-solid fa-wand-magic-sparkles"></i> 立即补齐缩略图';
            setTimeout(() => { progressEl.style.display = 'none'; }, 6000);
          }
        };
      }
    }
  },

  // 异步补齐缺失的 3D 模型缩略图（存量记录用）
  // 关键：单 renderer / 单 canvas / 单 PMREM 复用，避免多 WebGL context 累积导致后续模型渲染失败
  async _backfillMissingThumbnails(missingIds, content, onProgress) {
    const progress = (msg) => { console.log('[Admin C3D] ' + msg); try { onProgress?.(msg); } catch(_) {} };
    const toStrSet = (arr) => new Set(arr.map(x => String(x)));

    let renderer = null, pmrem = null, envTex = null, draco = null, sharedCanvas = null;
    let contextLost = false;
    // 流程结束标志：forceContextLoss() 触发的 webglcontextlost 是异步派发的，
    // 若不加守卫，会在流程成功结束后用「context 丢失」覆盖掉「补齐完成：成功 x / 失败 y」提示。
    let flowDone = false;
    // 结果计数（提前 return 时也返回 0），供按钮展示成功/失败数
    let anyOk = false, okCount = 0, failCount = 0;
    try {
      progress(`进入补齐流程，参数 missingIds=${JSON.stringify(missingIds)}`);
      const all = await window.getAllCustom3dModels?.();
      progress(`getAllCustom3dModels 返回 ${all?.length || 0} 条`);
      if (!all?.length) { progress('数据库无记录，提前退出'); return { ok: 0, fail: 0 }; }

      const idSet = toStrSet(missingIds);
      const toFix = all.filter(r => idSet.has(String(r.id)) && r.file);
      progress(`匹配到 ${toFix.length} 条待补齐（其中 ${all.filter(r => idSet.has(String(r.id))).length - toFix.length} 条无 file 数据，跳过）`);
      if (!toFix.length) { progress('没有可处理的记录，提前退出'); return { ok: 0, fail: 0 }; }

      progress('开始动态 import three.js 及其加载器…');
      const THREE = await import('three');
      const gltfMod = await import('three/addons/loaders/GLTFLoader.js');
      const dracoMod = await import('three/addons/loaders/DRACOLoader.js');
      const envMod = await import('three/addons/environments/RoomEnvironment.js');
      progress('three.js import 完成');

      draco = new dracoMod.DRACOLoader();
      draco.setDecoderPath('/draco/');

      // ── 循环外：创建一次共享渲染资源 ──────────────────────────
      sharedCanvas = document.createElement('canvas');
      sharedCanvas.width = 200; sharedCanvas.height = 200;
      renderer = new THREE.WebGLRenderer({
        canvas: sharedCanvas, antialias: true, alpha: false,
        preserveDrawingBuffer: true // 保证离屏渲染后 toDataURL 稳定取帧
      });
      sharedCanvas.addEventListener('webglcontextlost', (e) => {
        e.preventDefault();
        contextLost = true;
        // 仅流程进行中才上报；流程结束后的主动释放不再覆盖最终结果提示
        if (!flowDone) progress('WebGL context 丢失，后续缩略图补齐中止');
      });
      renderer.setPixelRatio(1);
      renderer.setSize(200, 200, false);
      renderer.setClearColor(0xf5f2ec, 1);
      renderer.outputColorSpace = THREE.SRGBColorSpace;
      renderer.toneMapping = THREE.ACESFilmicToneMapping;

      pmrem = new THREE.PMREMGenerator(renderer);
      envTex = pmrem.fromScene(new envMod.RoomEnvironment(), 0.04).texture;

      // 灯光与相机只建一次
      const ambient = new THREE.AmbientLight(0xffffff, .88);
      const keyLight = new THREE.DirectionalLight(0xfff8f0, 1.0);
      keyLight.position.set(2, 3, 2);
      const camera = new THREE.PerspectiveCamera(38, 1, .05, 60);
      camera.position.set(2, 1.5, 2.5);
      camera.lookAt(0, 0, 0);

      // 释放单个模型的 GPU 资源（geometry + material 的全部纹理）
      const disposeModel = (group) => {
        group.traverse(o => {
          if (o.geometry) o.geometry.dispose();
          if (o.material) {
            const ms = Array.isArray(o.material) ? o.material : [o.material];
            ms.forEach(m => {
              if (!m) return;
              // 遍历材质上所有可能的纹理贴图并释放
              for (const k of Object.keys(m)) {
                const v = m[k];
                if (v && v.isTexture) v.dispose();
              }
              m.dispose();
            });
          }
        });
      };

      // 单模型解析超时保护（大 GLB + Draco 解码兜底，默认 45s）
      const withTimeout = (p, ms, label) => Promise.race([
        p,
        new Promise((_, rej) => setTimeout(() => rej(new Error(label + ' 超时(' + ms + 'ms)')), ms))
      ]);

      for (let idx = 0; idx < toFix.length; idx++) {
        const rec = toFix[idx];
        if (contextLost) { progress('context 已丢失，跳出剩余模型'); break; }
        let group = null;
        try {
          const fmt = String(rec.format || 'glb').toLowerCase();
          progress(`[${idx+1}/${toFix.length}] 开始处理 ${rec.name}（id=${rec.id}, format=${fmt}, file=${(rec.file?.byteLength||0)/1024/1024}MB）`);
          if (fmt === 'fbx') {
            // FBX 分支：旧实现只用 GLTFLoader，导致 FBX 模型补齐一律失败。
            // 与上传预览路径保持一致，改用 FBXLoader 解析。
            const fbxMod = await import('three/addons/loaders/FBXLoader.js');
            group = new fbxMod.FBXLoader().parse(rec.file, '');
            if (!group) throw new Error('FBX 解析返回空对象');
          } else {
            const loader = new gltfMod.GLTFLoader();
            loader.setDRACOLoader(draco);
            const gltf = await withTimeout(
              new Promise((res, rej) => loader.parse(rec.file, '', g => res(g), e => rej(e))),
              45000, '模型解析'
            );
            group = gltf.scene || gltf.scenes[0];
          }

          // 归一化：缩放到 1.2 单位 + 居中
          const box = new THREE.Box3().setFromObject(group);
          const size = box.getSize(new THREE.Vector3());
          const maxDim = Math.max(size.x, size.y, size.z) || 1;
          group.scale.setScalar(1.2 / maxDim);
          const box2 = new THREE.Box3().setFromObject(group);
          group.position.sub(box2.getCenter(new THREE.Vector3()));

          // 每轮新建轻量 scene（灯光/环境复用）
          const scene = new THREE.Scene();
          scene.add(group, ambient, keyLight);
          scene.environment = envTex;

          renderer.render(scene, camera);

          const dataURL = sharedCanvas.toDataURL('image/png');
          if (!dataURL || dataURL.length < 100) {
            throw new Error('渲染输出为空（dataURL 长度异常：' + (dataURL ? dataURL.length : 0) + '）');
          }

          await window.updateCustom3dModel(rec.id, { previewImage: dataURL });
          anyOk = true; okCount++;
          progress(`✓ ${rec.name} 补齐成功（${Math.round(dataURL.length / 1024)}KB）`);
        } catch (e) {
          failCount++;
          progress(`✗ ${rec.name} 补齐失败：${e?.message || e}`);
          console.warn('[Admin C3D] 详细错误：', e);
        } finally {
          if (group) disposeModel(group);
        }
      }

      progress(`补齐完成：成功 ${okCount} / 失败 ${failCount}`);
      // 有任一成功 → 刷新列表显示新图（content 必须是 Admin 面板实际 DOM）
      if (anyOk && content?.querySelector?.('#admin-c3d-grid')) {
        progress('刷新列表…');
        await this._refreshList(content);
      } else if (anyOk) {
        progress('已写回数据库，请在 Admin 面板内 F5 刷新查看');
      }
      return { ok: okCount, fail: failCount };
    } catch (err) {
      progress('补齐主流程异常：' + (err?.message || err));
      console.warn('[Admin C3D] 缩略图批量补齐失败：', err);
      return { ok: okCount, fail: failCount, error: err?.message || String(err) };
    } finally {
      // 统一释放共享资源，并强制归还 WebGL context
      flowDone = true; // 先置位：避免下方主动释放触发的 contextlost 覆盖结果提示
      try { envTex?.dispose(); } catch (_) {}
      try { pmrem?.dispose(); } catch (_) {}
      try { draco?.dispose?.(); } catch (_) {}
      try { renderer?.dispose(); renderer?.forceContextLoss?.(); } catch (_) {}
      sharedCanvas = null;
      progress('补齐流程结束，资源已释放');
    }
  },

  // ----------------------------------------------------------

  _close() {
    if (!this.modalEl) return;
    this.modalEl.classList.remove('open');
    if (window.ModalScrollLock) ModalScrollLock.unlock();
    if (typeof Sound !== 'undefined') Sound.playSound('close');
    setTimeout(() => { if (this.modalEl) { this.modalEl.remove(); this.modalEl = null; } }, 300);
  },

  // ----------------------------------------------------------
  // 订单管理（v11 新增 Tab）：列表查看 + 物流状态推进
  // ----------------------------------------------------------
  _orderStatusLabel(st) {
    const labels = (window.ORDER_STATE_LABELS) || { paid: '已支付', producing: '制作中', shipped: '已发货', in_transit: '运输中', delivered: '已签收' };
    return labels[st] || st || '—';
  },

  async _renderOrders(content) {
    const orders = await getAllOrders();
    const states = (window.ORDER_STATE_LABELS) || { paid: '已支付', producing: '制作中', shipped: '已发货', in_transit: '运输中', delivered: '已签收', cancelled: '已取消' };
    const stateList = Object.keys(states);
    content.innerHTML = `
      <div class="admin-toolbar">
        <div class="admin-chips" id="admin-order-chips">
          <button class="admin-chip active" data-st="all">全部 ${orders.length}</button>
          ${stateList.map(s => `<button class="admin-chip" data-st="${s}">${states[s]} ${orders.filter(o => o.status === s).length}</button>`).join('')}
        </div>
        <div style="flex:1"></div>
        <div class="admin-search-mini" style="margin-right:8px;">
          <input type="text" id="admin-order-filter" placeholder="订单号/用户/收货人…" />
        </div>
        <button class="admin-btn ghost" id="admin-order-export" title="导出当前筛选结果"><i class="fa-solid fa-file-export"></i> 导出</button>
      </div>
      <div class="admin-batch-bar" id="admin-order-batch-bar" style="display:none;">
        <span id="admin-order-batch-count">已选 0 项</span>
        <select id="admin-order-batch-target"><option value="paid">→ 已支付</option><option value="producing">→ 制作中</option><option value="shipped">→ 已发货</option><option value="in_transit">→ 运输中</option><option value="delivered">→ 已签收</option><option value="cancelled">→ 已取消</option></select>
        <button class="admin-btn ok" id="admin-order-batch-apply">应用</button>
        <button class="admin-btn ghost" id="admin-order-batch-clear">取消</button>
      </div>
      <div class="admin-table-wrap">
        <table class="admin-table">
          <thead>
            <tr>
              <th style="width:36px;"><input type="checkbox" id="admin-order-select-all" /></th>
              <th>订单号</th><th>用户</th><th>商品</th><th>规格</th><th>价格</th><th>状态</th><th>收货信息</th><th>操作</th>
            </tr>
          </thead>
          <tbody id="admin-order-tbody"></tbody>
        </table>
      </div>
    `;
    const self = this;
    this._orderStateFilter = this._orderStateFilter || 'all';
    this._orderKw = '';
    const render = () => {
      let list = orders;
      if (this._orderStateFilter !== 'all') list = list.filter(o => o.status === this._orderStateFilter);
      if (this._orderKw) {
        const kw = this._orderKw.toLowerCase();
        list = list.filter(o =>
          (o.orderNo || '').toLowerCase().includes(kw) ||
          String(o.userId || '').includes(kw) ||
          (o.receiver || '').toLowerCase().includes(kw)
        );
      }
      this._fillOrderRows(content, list);
    };
    render();
    content.querySelectorAll('#admin-order-chips .admin-chip').forEach(chip => {
      chip.addEventListener('click', () => {
        this._orderStateFilter = chip.dataset.st;
        this._resetPage('orders');
        content.querySelectorAll('#admin-order-chips .admin-chip').forEach(c => c.classList.remove('active'));
        chip.classList.add('active');
        render();
      });
    });
    content.querySelector('#admin-order-filter')?.addEventListener('input', (e) => {
      this._orderKw = e.target.value.trim();
      this._resetPage('orders');
      render();
    });
    content.querySelector('#admin-order-export')?.addEventListener('click', () => {
      let list = orders;
      if (this._orderStateFilter !== 'all') list = list.filter(o => o.status === this._orderStateFilter);
      if (this._orderKw) {
        const kw = this._orderKw.toLowerCase();
        list = list.filter(o =>
          (o.orderNo || '').toLowerCase().includes(kw) ||
          String(o.userId || '').includes(kw) ||
          (o.receiver || '').toLowerCase().includes(kw)
        );
      }
      this._exportCSV(list, [
        { key: 'orderNo', label: '订单号' }, { key: 'userId', label: '用户ID' },
        { key: 'product', label: '商品' }, { key: 'price', label: '价格' },
        { key: 'status', label: '状态' }, { key: 'receiver', label: '收货人' },
        { key: 'phone', label: '电话' }, { key: 'trackingNo', label: '物流单号' },
        { key: 'createdAt', label: '下单时间' }
      ], `orders_${Date.now()}.csv`);
    });
    // 批量
    content.querySelector('#admin-order-select-all')?.addEventListener('change', (e) => {
      const checked = e.target.checked;
      content.querySelectorAll('#admin-order-tbody .order-row-cb').forEach(cb => cb.checked = checked);
      this._updateOrderBatchBar();
    });
    content.querySelector('#admin-order-batch-clear')?.addEventListener('click', () => {
      content.querySelectorAll('#admin-order-tbody .order-row-cb').forEach(cb => cb.checked = false);
      this._updateOrderBatchBar();
    });
    content.querySelector('#admin-order-batch-apply')?.addEventListener('click', async () => {
      const ids = [...content.querySelectorAll('#admin-order-tbody .order-row-cb:checked')].map(cb => Number(cb.value));
      const target = content.querySelector('#admin-order-batch-target').value;
      if (!ids.length) return;
      const ok = await this._confirm(`确认将选中的 ${ids.length} 个订单批量变更为「${states[target]}」？`);
      if (!ok) return;
      let done = 0, fail = 0, names = [];
      for (const id of ids) {
        const o = orders.find(x => x.id === id);
        if (o) names.push(o.orderNo || `#${id}`);
        try { await updateOrderStatus(id, { status: target }); done++; } catch { fail++; }
      }
      await this._log(`order.batch.status.${target}`, 'order', ids.join(','),
        `批量变更 ${done} 个订单为「${states[target]}」${fail ? `（失败 ${fail} 个）` : ''}`);
      if (window.showToast) showToast(`已变更 ${done} 个订单${fail ? '（失败 ' + fail + ' 个）' : ''}`, fail ? 'warn' : 'success');
      await this._renderOrders(content);
    });
  },

  _updateOrderBatchBar() {
    const tbody = this.modalEl.querySelector('#admin-order-tbody');
    if (!tbody) return;
    const checked = [...tbody.querySelectorAll('.order-row-cb:checked')];
    const bar = this.modalEl.querySelector('#admin-order-batch-bar');
    const count = this.modalEl.querySelector('#admin-order-batch-count');
    const sel = this.modalEl.querySelector('#admin-order-select-all');
    if (!bar) return;
    if (checked.length > 0) {
      bar.style.display = 'flex';
      if (count) count.textContent = `已选 ${checked.length} 项`;
      if (sel) sel.checked = checked.length === tbody.querySelectorAll('.order-row-cb').length;
    } else {
      bar.style.display = 'none';
      if (sel) sel.checked = false;
    }
  },

  _fillOrderRows(content, orders) {
    const tbody = content.querySelector('#admin-order-tbody');
    if (!tbody) return;
    const wrap = tbody.closest('.admin-table-wrap');
    if (wrap) wrap.querySelectorAll('.admin-pager').forEach(n => n.remove());
    const states = (window.ORDER_STATE_LABELS) || { paid: '已支付', producing: '制作中', shipped: '已发货', in_transit: '运输中', delivered: '已签收', cancelled: '已取消' };
    const stateList = Object.keys(states);
    if (!orders.length) {
      tbody.innerHTML = '<tr><td colspan="9" class="admin-empty">暂无订单</td></tr>';
      return;
    }
    const { offset, limit } = this._getPage('orders', orders.length);
    const pageRows = orders.slice(offset, offset + limit);
    tbody.innerHTML = pageRows.map(o => {
      const spec = [o.material, o.size].filter(Boolean).join(' · ') || (o.craftType || '—');
      const receiver = [o.receiver, o.phone].filter(Boolean).join(' / ') || '—';
      return `
      <tr data-id="${o.id}">
        <td><input type="checkbox" class="order-row-cb" value="${o.id}" /></td>
        <td><div class="admin-order-no">${this._esc(o.orderNo || '—')}</div>${o.trackingNo ? `<div class="admin-order-track">${this._esc(o.trackingNo)}</div>` : ''}</td>
        <td>${this._esc(o.userId == null ? '—' : String(o.userId))}</td>
        <td>${this._esc(o.product || o.craftType || '—')}</td>
        <td>${this._esc(spec)}</td>
        <td>¥${Number(o.price) || 0}</td>
        <td>
          <select class="admin-order-status-st st-${this._esc(o.status)}" data-status="${o.id}" style="padding:2px 6px;font-size:12px;min-width:80px;">
            ${stateList.map(s => `<option value="${s}" ${s === o.status ? 'selected' : ''}>${states[s]}</option>`).join('')}
          </select>
        </td>
        <td><div>${this._esc(receiver)}</div><div class="admin-order-addr">${this._esc(o.address || '—')}</div></td>
        <td class="col-actions">
          <button class="admin-btn edit" data-edit-addr="${o.id}" title="编辑收货/物流单号"><i class="fa-solid fa-pen"></i></button>
        </td>
      </tr>`;
    }).join('');

    tbody.querySelectorAll('.order-row-cb').forEach(cb => cb.addEventListener('change', () => this._updateOrderBatchBar()));
    tbody.querySelectorAll('[data-status]').forEach(sel => {
      sel.addEventListener('change', async () => {
        const id = Number(sel.dataset.status);
        const target = sel.value;
        sel.disabled = true;
        try {
          await updateOrderStatus(id, { status: target });
          await this._log('order.status.change', 'order', id, `订单 #${id} 状态变更为「${states[target]}」`);
          if (window.showToast) showToast(`订单 #${id} 已变更为「${states[target]}」`, 'success');
          sel.className = `admin-order-status-st st-${target}`;
        } catch (err) {
          if (window.showToast) showToast('变更失败：' + (err && err.message || '未知错误'), 'error');
        } finally {
          sel.disabled = false;
        }
      });
    });
    tbody.querySelectorAll('[data-edit-addr]').forEach(btn => {
      btn.addEventListener('click', () => this._editOrderAddr(Number(btn.dataset.editAddr)));
    });
    // 渲染分页器
    this._renderPager('orders', orders.length, wrap, () => {
      // 重新筛选 + 渲染
      (async () => {
        const fresh = await getAllOrders();
        this._renderOrders(this.modalEl.querySelector('.admin-tab-panel.active') || this.modalEl);
        // 重新应用筛选
        const panel = this.modalEl.querySelector('.admin-tab-panel.active');
        if (panel && this.currentTab === 'orders') {
          const kw = (panel.querySelector('#admin-order-filter') || {}).value || '';
          let list = fresh;
          if (this._orderStateFilter && this._orderStateFilter !== 'all') list = list.filter(o => o.status === this._orderStateFilter);
          if (kw) {
            const k = kw.toLowerCase();
            list = list.filter(o => (o.orderNo || '').toLowerCase().includes(k) || String(o.userId || '').includes(k) || (o.receiver || '').toLowerCase().includes(k));
          }
          this._fillOrderRows(panel, list);
        }
      })();
    });
  },

  // 编辑收货信息 / 物流单号
  async _editOrderAddr(orderId) {
    const all = await getAllOrders();
    const o = all.find(x => x.id === orderId);
    if (!o) return;
    const overlay = document.createElement('div');
    overlay.className = 'modal-overlay confirm-modal';
    overlay.innerHTML = `
      <div class="modal-box confirm-box glass">
        <h3>编辑订单 #${orderId} 收货信息</h3>
        <div class="admin-form" style="margin-top:12px;">
          <label>收货人<input type="text" id="oa-receiver" value="${this._esc(o.receiver || '')}" /></label>
          <label>联系电话<input type="text" id="oa-phone" value="${this._esc(o.phone || '')}" /></label>
          <label>收货地址<input type="text" id="oa-address" value="${this._esc(o.address || '')}" /></label>
          <label>物流单号<input type="text" id="oa-tracking" value="${this._esc(o.trackingNo || '')}" placeholder="选填" /></label>
        </div>
        <div class="confirm-actions">
          <button class="btn-ghost" data-cancel>取消</button>
          <button class="btn-primary" data-ok>保存</button>
        </div>
      </div>
    `;
    document.body.appendChild(overlay);
    requestAnimationFrame(() => overlay.classList.add('open'));
    overlay.addEventListener('click', async (e) => {
      if (e.target === overlay || e.target.closest('[data-cancel]')) { overlay.classList.remove('open'); setTimeout(() => overlay.remove(), 300); return; }
      if (e.target.closest('[data-ok]')) {
        const data = {
          receiver: overlay.querySelector('#oa-receiver').value.trim(),
          phone: overlay.querySelector('#oa-phone').value.trim(),
          address: overlay.querySelector('#oa-address').value.trim(),
          trackingNo: overlay.querySelector('#oa-tracking').value.trim()
        };
        try {
          await updateOrderAddr(orderId, data);
          await this._log('order.addr.update', 'order', orderId, `更新收货信息：${data.receiver || '—'} / ${data.phone || '—'}${data.trackingNo ? ` / 物流 ${data.trackingNo}` : ''}`);
          if (window.showToast) showToast('收货信息已更新', 'success');
          overlay.classList.remove('open'); setTimeout(() => overlay.remove(), 300);
          // 找到当前激活的 tab 面板重渲 orders
          const panel = document.querySelector('.admin-tab-panel.active') || document.querySelector('.admin-modal .admin-tab-panel');
          if (panel && this.currentTab === 'orders') await this._renderOrders(panel);
        } catch (err) {
          if (window.showToast) showToast('保存失败：' + (err && err.message || '未知错误'), 'error');
        }
      }
    });
  },

  _catLabel(c) {
    const map = { 'scenic-photo': '文旅摄影', 'heritage-craft': '非遗文创', 'guofeng-art': '国风绘画', 'ai-art': 'AI数字艺术', 'museum-culture': '博物文创', 'creative-design': '创意设计', 'digital-art': 'AI数字艺术', 'photography': '文旅摄影', 'illustration': '国风绘画', 'abstract': 'AI数字艺术', '3d-art': '创意设计' };
    return map[c] || c;
  },
  _fmtNum(n) {
    n = Number(n) || 0;
    if (n >= 10000) return (n / 10000).toFixed(1) + 'w';
    if (n >= 1000) return (n / 1000).toFixed(1) + 'k';
    return n;
  },
  _esc(s) {
    return String(s == null ? '' : s).replace(/[&<>"']/g, c => ({
      '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
    }[c]));
  },

  // 分页状态容器（key 对应 tab 名）
  _page: {},
  _pageSize: 20,

  // 获取当前分页 offset / 重置到第一页
  _getPage(key, total) {
    if (!this._page[key] || this._page[key] < 1) this._page[key] = 1;
    const totalPages = Math.max(1, Math.ceil(total / this._pageSize));
    if (this._page[key] > totalPages) this._page[key] = totalPages;
    const offset = (this._page[key] - 1) * this._pageSize;
    return { page: this._page[key], totalPages, total, offset, limit: this._pageSize };
  },
  _resetPage(key) { this._page[key] = 1; },
  _setPage(key, n) { this._page[key] = Math.max(1, n); },

  // 渲染分页器（放到 tbody 外层最后面）
  // key: tab 名；total: 过滤后总数；container: 要插入分页器的 DOM 容器
  // onPageChange: 翻页后的回调（重渲当前 tab）
  _renderPager(key, total, container, onPageChange) {
    const { page, totalPages } = this._getPage(key, total);
    if (total <= this._pageSize) return; // 不足一页不渲染
    // 构造页码数组：前1 + 省略 + 当前±2 + 省略 + 后1
    const pages = [];
    const push = p => { if (!pages.includes(p)) pages.push(p); };
    push(1);
    for (let i = Math.max(2, page - 2); i <= Math.min(totalPages - 1, page + 2); i++) push(i);
    if (totalPages > 1) push(totalPages);

    const html = `
      <div class="admin-pager" style="display:flex;align-items:center;gap:6px;padding:8px 0;border-top:1px solid var(--border);margin-top:8px;">
        <span style="color:var(--text-secondary);font-size:12px;margin-right:auto;">共 ${total} 条 · 每页 ${this._pageSize}</span>
        <button class="admin-pg-btn" ${page <= 1 ? 'disabled' : ''} data-pg-prev><i class="fa-solid fa-chevron-left"></i></button>
        ${pages.map((p, i) => `
          ${i > 0 && pages[i-1] !== p - 1 ? '<span style="color:var(--text-secondary);padding:0 4px;">…</span>' : ''}
          <button class="admin-pg-btn ${p === page ? 'active' : ''}" data-pg="${p}">${p}</button>
        `).join('')}
        <button class="admin-pg-btn" ${page >= totalPages ? 'disabled' : ''} data-pg-next><i class="fa-solid fa-chevron-right"></i></button>
      </div>
    `;
    const el = document.createElement('div');
    el.innerHTML = html;
    container.appendChild(el.firstElementChild);
    // 绑定事件
    el.querySelectorAll('.admin-pg-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        if (btn.disabled) return;
        let target;
        if (btn.dataset.pg) target = Number(btn.dataset.pg);
        else if (btn.dataset.pgPrev) target = page - 1;
        else if (btn.dataset.pgNext) target = page + 1;
        if (target) { this._setPage(key, target); onPageChange && onPageChange(); }
      });
    });
  },

  // 通用 CSV 导出
  // columns: [{ key, label }] 列定义；rows: 对象数组；filename: 下载文件名
  _exportCSV(rows, columns, filename) {
    if (!rows.length) { if (window.showToast) showToast('无数据可导出', 'warn'); return; }
    const esc = v => {
      const s = v == null ? '' : String(v);
      if (/[",\n]/.test(s)) return '"' + s.replace(/"/g, '""') + '"';
      return s;
    };
    const head = columns.map(c => esc(c.label)).join(',');
    const body = rows.map(r => columns.map(c => esc(r[c.key])).join(',')).join('\n');
    const bom = '\uFEFF'; // Excel 中文兼容
    const blob = new Blob([bom + head + '\n' + body], { type: 'text/csv;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = filename || 'export.csv';
    document.body.appendChild(a); a.click();
    setTimeout(() => { URL.revokeObjectURL(url); a.remove(); }, 1000);
    if (window.showToast) showToast(`已导出 ${rows.length} 条记录`, 'success');
  },

  // 通用确认弹窗（返回 Promise<boolean>）
  _confirm(message, title) {
    return new Promise(resolve => {
      const overlay = document.createElement('div');
      overlay.className = 'modal-overlay confirm-modal';
      overlay.innerHTML = `
        <div class="modal-box confirm-box glass" style="max-width:400px;">
          <h3>${title || '<i class="fa-solid fa-circle-question"></i> 确认操作'}</h3>
          <div style="margin:16px 0;white-space:pre-line;color:var(--text-secondary);line-height:1.6;">${this._esc(message)}</div>
          <div class="confirm-actions">
            <button class="btn-ghost" data-cancel>取消</button>
            <button class="btn-primary" data-ok>确定</button>
          </div>
        </div>
      `;
      document.body.appendChild(overlay);
      requestAnimationFrame(() => overlay.classList.add('open'));
      const cleanup = (result) => {
        overlay.classList.remove('open');
        setTimeout(() => overlay.remove(), 300);
        resolve(result);
      };
      overlay.addEventListener('click', (e) => {
        if (e.target === overlay || e.target.closest('[data-cancel]')) cleanup(false);
        if (e.target.closest('[data-ok]')) cleanup(true);
      });
    });
  }
};

// hash 路由自注册：#/admin 或 #admin 直达管理后台
function openFromHash() {
  const hash = window.location.hash || '';
  if (!/^#\/?admin(?:\?.*)?$/.test(hash)) return false;
  if (window.showAdminPanel) window.showAdminPanel();
  return true;
}
window.addEventListener('hashchange', openFromHash);
if (/^#\/?admin(?:\?.*)?$/.test(window.location.hash || '')) {
  setTimeout(() => openFromHash(), 800);
}

// 订单管理表格样式（幂等注入）
(function _injectAdminOrderStyle() {
  if (document.getElementById('admin-order-style')) return;
  const style = document.createElement('style');
  style.id = 'admin-order-style';
  style.textContent = `
    .admin-order-no { font-weight: 600; color: var(--text-primary); }
    .admin-order-track { font-size: .72rem; color: var(--text-secondary); margin-top: 2px; }
    .admin-order-addr { font-size: .74rem; color: var(--text-secondary); margin-top: 2px; white-space: normal; min-width: 140px; }
    .admin-order-status { padding: 3px 10px; border-radius: 999px; font-size: .74rem; font-weight: 600; white-space: nowrap; }
    .st-paid { background: rgba(52,211,153,.16); color: #2bb58a; }
    .st-producing { background: rgba(245,158,11,.16); color: #d97706; }
    .st-shipped { background: rgba(96,165,250,.16); color: #3b82f6; }
    .st-in_transit { background: rgba(168,85,247,.16); color: #9333ea; }
    .st-delivered { background: rgba(52,211,153,.22); color: #159a6b; }
    .admin-order-done { font-size: .78rem; color: var(--text-secondary); font-weight: 600; }
  `;
  document.head.appendChild(style);
})();

// 暴露为全局
window.Admin = Admin;
window.showAdminPanel = () => Admin.showAdminPanel();
window.openAdminFromHash = openFromHash;

// 诊断工具：在浏览器控制台运行 __c3dDiag() 查看 3D 模型缩略图状态
window.__c3dDiag = async function() {
  console.log('═══ Dreamcore 3D 模型缩略图诊断 ═══');
  try {
    const all = await window.getAllCustom3dModels?.();
    if (!all?.length) {
      console.log('❌ getAllCustom3dModels 返回空（数据库可能未就绪）');
      return;
    }
    console.log(`📦 共 ${all.length} 条 custom_3d_models 记录`);
    let hasImg = 0, noImg = 0, noImgNoFile = 0;
    const rows = all.map(r => {
      const hasPrev = !!r.previewImage;
      const hasFile = !!r.file;
      if (hasPrev) hasImg++; else noImg++;
      if (!hasPrev && !hasFile) noImgNoFile++;
      return {
        id: r.id,
        name: r.name,
        previewLen: r.previewImage ? r.previewImage.length : 0,
        fileMB: r.file ? (r.file.byteLength / 1024 / 1024).toFixed(2) : 0,
        format: r.format,
        productKey: r.productKey,
        缩略图: hasPrev ? '✅' : '❌',
        文件: hasFile ? '✅' : '❌'
      };
    });
    console.table(rows);
    console.log(`📊 统计：有缩略图 ${hasImg} · 无缩略图 ${noImg}（其中 ${noImgNoFile} 条连模型文件都没有）`);
    // 触发补齐
    const missingIds = rows.filter(r => !r.缩略图.includes('✅')).map(r => r.id);
    if (missingIds.length > 0) {
      console.log(`\n🛠️ 正在触发补齐（${missingIds.length} 个模型）…`);
      // 尝试找到 Admin 实例
      const admin = window.Admin;
      if (admin && admin._backfillMissingThumbnails) {
        await admin._backfillMissingThumbnails(missingIds, document.body, (msg) => console.log('📡', msg));
      } else {
        console.log('⚠️ Admin 实例不可用，请先打开管理后台页面');
      }
    } else {
      console.log('\n🎉 全部模型已有缩略图！');
    }
  } catch (e) {
    console.error('诊断异常：', e);
  }
};

// ES Module export
export default Admin;
export { Admin, openFromHash };
const showAdminPanel = window.showAdminPanel;
export { showAdminPanel };
