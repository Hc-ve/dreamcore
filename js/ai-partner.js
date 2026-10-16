// ============================================================
// js/ai-partner.js — M6 合伙人申请模块
// 模块职责：
//   1. 景区/博物馆/非遗传承人/院校/其他 提交合作意向表单；
//   2. 表单数据持久化到 IndexedDB partner_applications 表；
//   3. 管理员后台审核流转（pending → approved/rejected）；
//   4. 路由 #/partner 自动开启申请页；
//   5. Admin Tab「合伙人审核」调用 renderAdminPanel 渲染列表。
// 设计原则：
//   - 不引入第三方库，纯原生 JS + DOM；
//   - 复用 .glass / .btn-primary / .btn-ghost / .btn-block；
//   - ES Module + JSDoc 注释；
//   - 资源清理：closePartner 完整解绑事件 + 移除 DOM + 重置状态；
//   - 表单验证：必填字段 + 手机/邮箱格式校验；
//   - 审核操作二次确认（通过/驳回前弹窗确认）。
// 依赖：
//   - ./db.js（addPartnerApplication / getPartnerApplicationsByStatus /
//     updatePartnerApplication / getPartnerApplication / deletePartnerApplication）
// ============================================================

import {
  addPartnerApplication,
  getPartnerApplicationsByStatus,
  updatePartnerApplication,
  getPartnerApplication,
  deletePartnerApplication
} from './db.js';

// ============================================================
// 常量定义
// ============================================================

/**
 * 机构类型字典
 * @typedef {Object} OrgType
 * @property {string} key  - 类型 key
 * @property {string} label - 中文标签
 * @property {string} icon - FontAwesome 图标类
 */
const ORG_TYPES = [
  { key: 'scenic',   label: '景区',         icon: 'fa-mountain' },
  { key: 'museum',   label: '博物馆',       icon: 'fa-landmark' },
  { key: 'heritage', label: '非遗传承人',   icon: 'fa-palette' },
  { key: 'school',   label: '院校',         icon: 'fa-school' },
  { key: 'other',    label: '其他',         icon: 'fa-building' }
];

/**
 * 申请状态字典
 * @typedef {Object} StatusMeta
 * @property {string} label - 中文标签
 * @property {string} color - 主题色
 * @property {string} icon  - FontAwesome 图标类
 */
const STATUS_LABELS = {
  pending:  { label: '待审核', color: '#f39c12', icon: 'fa-clock' },
  approved: { label: '已通过', color: '#27ae60', icon: 'fa-check' },
  rejected: { label: '已驳回', color: '#e74c3c', icon: 'fa-xmark' }
};

/** Admin 审核面板的状态筛选 Tab */
const ADMIN_FILTERS = [
  { key: 'pending',  label: '待审核' },
  { key: 'approved', label: '已通过' },
  { key: 'rejected', label: '已驳回' }
];

/** 手机号正则（中国大陆） */
const PHONE_RE = /^1[3-9]\d{9}$/;
/** 邮箱正则（基础校验） */
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

// ============================================================
// 模块状态
// ============================================================

const partnerState = {
  open: false,
  hostEl: null,
  pageEl: null,
  selectedOrgType: '',
  isSubmitting: false,
  // Admin 面板状态
  adminCurrentFilter: 'pending',
  adminContainer: null,
  adminListCache: []
};

// ============================================================
// 工具函数
// ============================================================

/**
 * HTML 转义，避免用户输入注入
 * @param {string} s
 * @returns {string}
 */
function esc(s) {
  return String(s == null ? '' : s).replace(/[&<>"']/g, c => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
  }[c]));
}

/**
 * 格式化时间戳为本地友好字符串
 * @param {string} iso
 * @returns {string}
 */
function fmtTime(iso) {
  if (!iso) return '—';
  const d = new Date(iso);
  if (isNaN(d.getTime())) return '—';
  return d.toLocaleString('zh-CN', { hour12: false });
}

/**
 * 机构类型 label 查找
 * @param {string} key
 * @returns {string}
 */
function orgTypeLabel(key) {
  const t = ORG_TYPES.find(o => o.key === key);
  return t ? t.label : key;
}

/**
 * 机构类型 icon 查找
 * @param {string} key
 * @returns {string}
 */
function orgTypeIcon(key) {
  const t = ORG_TYPES.find(o => o.key === key);
  return t ? t.icon : 'fa-building';
}

// ============================================================
// 入口：构建表单页 DOM → 绑定事件
// ============================================================

/**
 * 打开合伙人申请页
 * @param {Object} [opts] - 预留扩展（如预选机构类型）
 * @param {string} [opts.orgType]
 */
function openPartner(opts) {
  if (partnerState.open) {
    if (opts && opts.orgType) {
      partnerState.selectedOrgType = opts.orgType;
      _reflectOrgTypeUI();
    }
    return;
  }
  partnerState.open = true;
  partnerState.selectedOrgType = (opts && opts.orgType) || '';
  _buildDOM();
  _bindFormEvents();
  document.documentElement.classList.add('partner-lock');
  document.body.classList.add('partner-lock');
}

/**
 * 关闭合伙人申请页（完整清理）
 */
function closePartner() {
  if (!partnerState.open) return;
  _unbindFormEvents();
  if (partnerState.hostEl && partnerState.hostEl.parentNode) {
    partnerState.hostEl.parentNode.removeChild(partnerState.hostEl);
  }
  partnerState.hostEl = null;
  partnerState.pageEl = null;
  partnerState.open = false;
  partnerState.selectedOrgType = '';
  partnerState.isSubmitting = false;
  document.documentElement.classList.remove('partner-lock');
  document.body.classList.remove('partner-lock');
}

/**
 * 从 hash 解析参数并打开（#/partner?orgType=scenic）
 */
function openFromHash() {
  const hash = window.location.hash || '';
  const qs = hash.split('?')[1] || '';
  const params = {};
  qs.split('&').forEach(pair => {
    const [k, v] = pair.split('=');
    if (k) params[decodeURIComponent(k)] = decodeURIComponent(v || '');
  });
  openPartner({ orgType: params.orgType });
}

// ============================================================
// DOM 构建
// ============================================================

function _buildDOM() {
  const host = document.createElement('div');
  host.className = 'partner-host';
  host.id = 'partner-host';
  host.innerHTML = `
    <div class="partner-page glass" id="partner-page" role="dialog" aria-modal="true" aria-labelledby="partner-title">
      <div class="partner-header">
        <div class="partner-title-row">
          <h2 id="partner-title"><i class="fa-solid fa-handshake"></i> 合伙人申请</h2>
          <button class="btn-ghost partner-close-btn" id="partner-close" aria-label="关闭">
            <i class="fa-solid fa-xmark"></i> 关闭
          </button>
        </div>
        <p class="partner-subtitle">景区 / 博物馆 / 非遗传承人合作意向</p>
      </div>
      <div class="partner-body">
        <form class="partner-form" id="partner-form" novalidate>
          <div class="form-group">
            <label class="form-label"><i class="fa-solid fa-tag"></i> 机构类型 <span class="req">*</span></label>
            <div class="org-type-grid" id="org-type-grid" role="radiogroup" aria-label="机构类型">
              ${ORG_TYPES.map(o => `
                <button type="button" class="org-type-btn" data-org="${o.key}" role="radio" aria-checked="false">
                  <i class="fa-solid ${o.icon}"></i>
                  <span>${o.label}</span>
                </button>
              `).join('')}
            </div>
            <div class="form-hint" id="org-type-hint">请选择机构类型</div>
          </div>

          <div class="form-group">
            <label class="form-label" for="partner-org-name"><i class="fa-solid fa-building"></i> 机构名称 <span class="req">*</span></label>
            <input type="text" id="partner-org-name" name="organizationName" maxlength="80" required
                   placeholder="如：苏州博物馆 / 杭州西湖风景名胜区" />
          </div>

          <div class="form-row">
            <div class="form-group">
              <label class="form-label" for="partner-contact-name"><i class="fa-solid fa-user"></i> 联系人 <span class="req">*</span></label>
              <input type="text" id="partner-contact-name" name="contactName" maxlength="30" required
                     placeholder="真实姓名" />
            </div>
            <div class="form-group">
              <label class="form-label" for="partner-contact-phone"><i class="fa-solid fa-phone"></i> 联系电话 <span class="req">*</span></label>
              <input type="tel" id="partner-contact-phone" name="contactPhone" maxlength="11" required
                     placeholder="11 位手机号" inputmode="numeric" />
            </div>
          </div>

          <div class="form-group">
            <label class="form-label" for="partner-contact-email"><i class="fa-solid fa-envelope"></i> 联系邮箱</label>
            <input type="email" id="partner-contact-email" name="contactEmail" maxlength="120"
                   placeholder="可选，建议填写以便后续沟通" />
          </div>

          <div class="form-group">
            <label class="form-label" for="partner-intent"><i class="fa-solid fa-comment-dots"></i> 合作意向 <span class="req">*</span></label>
            <textarea id="partner-intent" name="cooperationIntent" rows="5" maxlength="600" required
                      placeholder="请简要描述合作方向：如联合文创开发、主题展馆共建、非遗素材授权、研学课程合作等…"></textarea>
            <div class="form-hint count-hint" id="intent-count">0 / 600</div>
          </div>

          <div class="form-actions">
            <button type="button" class="btn-ghost" id="partner-reset">
              <i class="fa-solid fa-rotate-left"></i> 重置
            </button>
            <button type="submit" class="btn-primary btn-block" id="partner-submit">
              <i class="fa-solid fa-paper-plane"></i> 提交申请
            </button>
          </div>

          <p class="partner-foot-tip">
            <i class="fa-solid fa-shield-halved"></i>
            申请信息仅管理员可见，审核结果将通过电话或邮箱反馈。
          </p>
        </form>
      </div>
    </div>
  `;
  document.body.appendChild(host);
  partnerState.hostEl = host;
  partnerState.pageEl = host.querySelector('#partner-page');
  _reflectOrgTypeUI();
}

/**
 * 同步机构类型按钮选中态
 */
function _reflectOrgTypeUI() {
  if (!partnerState.hostEl) return;
  partnerState.hostEl.querySelectorAll('.org-type-btn').forEach(btn => {
    const selected = btn.dataset.org === partnerState.selectedOrgType;
    btn.classList.toggle('active', selected);
    btn.setAttribute('aria-checked', selected ? 'true' : 'false');
  });
}

// ============================================================
// 事件绑定
// ============================================================

function _bindFormEvents() {
  const host = partnerState.hostEl;
  if (!host) return;

  // 关闭按钮
  host.querySelector('#partner-close').addEventListener('click', _onClose);

  // 点击遮罩关闭
  host.addEventListener('click', _onHostClick);

  // 机构类型选择
  host.querySelectorAll('.org-type-btn').forEach(btn => {
    btn.addEventListener('click', _onOrgTypeClick);
  });

  // 手机号仅数字
  const phoneInput = host.querySelector('#partner-contact-phone');
  phoneInput.addEventListener('input', _onPhoneInput);

  // 字数统计
  const intentInput = host.querySelector('#partner-intent');
  intentInput.addEventListener('input', _onIntentInput);

  // 重置
  host.querySelector('#partner-reset').addEventListener('click', _onReset);

  // 表单提交
  host.querySelector('#partner-form').addEventListener('submit', _onSubmit);

  // ESC 关闭
  document.addEventListener('keydown', _onKeydown);
}

function _unbindFormEvents() {
  document.removeEventListener('keydown', _onKeydown);
}

function _onClose() {
  if (window.Sound && typeof Sound.playSound === 'function') Sound.playSound('close');
  // 回到首页 hash（触发 closePartner）
  if (window.location.hash && /^#\/partner/.test(window.location.hash)) {
    window.location.hash = '';
  } else {
    closePartner();
  }
}

function _onHostClick(e) {
  if (e.target === partnerState.hostEl) _onClose();
}

function _onKeydown(e) {
  if (e.key === 'Escape' && partnerState.open) {
    const ae = document.activeElement;
    if (ae && (ae.tagName === 'INPUT' || ae.tagName === 'TEXTAREA')) {
      return; // 输入框内 ESC 不关闭
    }
    _onClose();
  }
}

function _onOrgTypeClick(e) {
  const btn = e.currentTarget;
  partnerState.selectedOrgType = btn.dataset.org;
  _reflectOrgTypeUI();
  if (window.Sound && typeof Sound.playSound === 'function') Sound.playSound('click');
  // 清除提示
  const hint = partnerState.hostEl.querySelector('#org-type-hint');
  if (hint) hint.classList.remove('error');
}

function _onPhoneInput(e) {
  e.target.value = e.target.value.replace(/\D/g, '').slice(0, 11);
}

function _onIntentInput(e) {
  const v = e.target.value;
  const counter = partnerState.hostEl.querySelector('#intent-count');
  if (counter) counter.textContent = `${v.length} / 600`;
}

function _onReset() {
  if (!partnerState.hostEl) return;
  if (window.Sound && typeof Sound.playSound === 'function') Sound.playSound('click');
  partnerState.hostEl.querySelector('#partner-form').reset();
  partnerState.selectedOrgType = '';
  _reflectOrgTypeUI();
  const counter = partnerState.hostEl.querySelector('#intent-count');
  if (counter) counter.textContent = '0 / 600';
  _clearAllErrors();
}

function _clearAllErrors() {
  partnerState.hostEl.querySelectorAll('.form-error').forEach(el => el.classList.remove('form-error'));
  partnerState.hostEl.querySelectorAll('.form-hint.error').forEach(el => el.classList.remove('error'));
}

/**
 * 表单提交处理
 * @param {Event} e
 */
async function _onSubmit(e) {
  e.preventDefault();
  if (partnerState.isSubmitting) return;
  _clearAllErrors();

  const host = partnerState.hostEl;
  const formData = _collectFormData();
  const errors = _validate(formData);

  if (errors.length) {
    errors.forEach(err => _showFieldError(err.field, err.message));
    if (window.showToast) showToast(errors[0].message, 'warn');
    return;
  }

  const submitBtn = host.querySelector('#partner-submit');
  submitBtn.disabled = true;
  partnerState.isSubmitting = true;
  submitBtn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> 提交中…';

  try {
    await submitApplication(formData);
    if (window.showToast) showToast('✨ 申请已提交，我们将在 3 个工作日内联系您', 'success');
    if (window.Sound && typeof Sound.playSound === 'function') Sound.playSound('success');
    // 延迟关闭，让用户看到提示
    setTimeout(() => {
      _onClose();
    }, 1200);
  } catch (err) {
    console.error('[AIPartner] 提交失败:', err);
    if (window.showToast) showToast('提交失败：' + (err && err.message || '未知错误'), 'error');
    submitBtn.disabled = false;
    partnerState.isSubmitting = false;
    submitBtn.innerHTML = '<i class="fa-solid fa-paper-plane"></i> 提交申请';
  }
}

/**
 * 收集表单数据
 * @returns {Object}
 */
function _collectFormData() {
  const host = partnerState.hostEl;
  return {
    organizationType: partnerState.selectedOrgType,
    organizationName: host.querySelector('#partner-org-name').value.trim(),
    contactName:      host.querySelector('#partner-contact-name').value.trim(),
    contactPhone:     host.querySelector('#partner-contact-phone').value.trim(),
    contactEmail:     host.querySelector('#partner-contact-email').value.trim(),
    cooperationIntent: host.querySelector('#partner-intent').value.trim()
  };
}

/**
 * 表单校验
 * @param {Object} d
 * @returns {Array<{field:string,message:string}>}
 */
function _validate(d) {
  const errors = [];
  if (!d.organizationType) {
    errors.push({ field: 'org-type', message: '请选择机构类型' });
  }
  if (!d.organizationName) {
    errors.push({ field: 'partner-org-name', message: '请填写机构名称' });
  } else if (d.organizationName.length < 2) {
    errors.push({ field: 'partner-org-name', message: '机构名称至少 2 个字' });
  }
  if (!d.contactName) {
    errors.push({ field: 'partner-contact-name', message: '请填写联系人姓名' });
  }
  if (!d.contactPhone) {
    errors.push({ field: 'partner-contact-phone', message: '请填写联系电话' });
  } else if (!PHONE_RE.test(d.contactPhone)) {
    errors.push({ field: 'partner-contact-phone', message: '请输入正确的 11 位手机号' });
  }
  if (d.contactEmail && !EMAIL_RE.test(d.contactEmail)) {
    errors.push({ field: 'partner-contact-email', message: '邮箱格式不正确' });
  }
  if (!d.cooperationIntent) {
    errors.push({ field: 'partner-intent', message: '请填写合作意向' });
  } else if (d.cooperationIntent.length < 10) {
    errors.push({ field: 'partner-intent', message: '合作意向至少 10 个字' });
  }
  return errors;
}

/**
 * 显示字段错误
 * @param {string} field
 * @param {string} message
 */
function _showFieldError(field, message) {
  const host = partnerState.hostEl;
  if (!host) return;
  if (field === 'org-type') {
    const hint = host.querySelector('#org-type-hint');
    if (hint) {
      hint.textContent = message;
      hint.classList.add('error');
    }
    return;
  }
  const el = host.querySelector('#' + field);
  if (el) {
    el.classList.add('form-error');
    el.focus();
  }
}

/**
 * 提交申请到数据库
 * @param {Object} formData
 * @returns {Promise<Object>}
 */
async function submitApplication(formData) {
  const record = {
    organizationType:   formData.organizationType,
    organizationName:   formData.organizationName,
    contactName:        formData.contactName,
    contactPhone:       formData.contactPhone,
    contactEmail:       formData.contactEmail,
    cooperationIntent:  formData.cooperationIntent,
    status: 'pending'
  };
  return await addPartnerApplication(record);
}

// ============================================================
// Admin 审核面板（供 admin.js 调用）
// ============================================================

/**
 * 渲染合伙人审核面板到指定容器
 * @param {HTMLElement} container
 */
async function renderAdminPanel(container) {
  if (!container) return;
  partnerState.adminContainer = container;

  container.innerHTML = `
    <div class="partner-admin-panel">
      <div class="partner-admin-head">
        <div>
          <h3><i class="fa-solid fa-handshake"></i> 合伙人审核</h3>
          <p class="admin-sub">景区 / 博物馆 / 非遗传承人等合作意向审批流转</p>
        </div>
        <div class="partner-admin-filters" id="partner-admin-filters">
          ${ADMIN_FILTERS.map(f => `
            <button class="partner-filter-btn ${f.key === partnerState.adminCurrentFilter ? 'active' : ''}" data-filter="${f.key}">
              ${f.label} <span class="partner-filter-count" data-count="${f.key}">0</span>
            </button>
          `).join('')}
        </div>
      </div>
      <div class="partner-admin-list" id="partner-admin-list">
        <div class="partner-admin-loading">
          <i class="fa-solid fa-spinner fa-spin"></i> 加载中…
        </div>
      </div>
    </div>
  `;

  // 绑定筛选切换
  container.querySelectorAll('.partner-filter-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      if (window.Sound && typeof Sound.playSound === 'function') Sound.playSound('click');
      partnerState.adminCurrentFilter = btn.dataset.filter;
      container.querySelectorAll('.partner-filter-btn').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      _renderAdminList();
    });
  });

  await _refreshAdminCounts();
  await _renderAdminList();
}

/**
 * 刷新各状态数量统计
 */
async function _refreshAdminCounts() {
  const container = partnerState.adminContainer;
  if (!container) return;
  try {
    const counts = { pending: 0, approved: 0, rejected: 0 };
    const [pending, approved, rejected] = await Promise.all([
      getPartnerApplicationsByStatus('pending'),
      getPartnerApplicationsByStatus('approved'),
      getPartnerApplicationsByStatus('rejected')
    ]);
    counts.pending = pending.length;
    counts.approved = approved.length;
    counts.rejected = rejected.length;
    container.querySelectorAll('[data-count]').forEach(el => {
      const k = el.dataset.count;
      el.textContent = counts[k] != null ? counts[k] : 0;
    });
  } catch (e) {
    console.warn('[AIPartner] 刷新统计失败:', e);
  }
}

/**
 * 渲染当前筛选状态下的列表
 */
async function _renderAdminList() {
  const container = partnerState.adminContainer;
  if (!container) return;
  const listEl = container.querySelector('#partner-admin-list');
  if (!listEl) return;

  listEl.innerHTML = '<div class="partner-admin-loading"><i class="fa-solid fa-spinner fa-spin"></i> 加载中…</div>';

  try {
    const list = await getPartnerApplicationsByStatus(partnerState.adminCurrentFilter);
    partnerState.adminListCache = list;

    if (!list.length) {
      listEl.innerHTML = `
        <div class="partner-admin-empty">
          <i class="fa-solid fa-inbox"></i>
          <p>暂无「${STATUS_LABELS[partnerState.adminCurrentFilter].label}」申请</p>
        </div>
      `;
      return;
    }

    listEl.innerHTML = list.map(app => _renderApplicationCard(app)).join('');
    _bindCardActions(listEl);
  } catch (e) {
    console.error('[AIPartner] 加载列表失败:', e);
    listEl.innerHTML = `<div class="partner-admin-empty"><i class="fa-solid fa-triangle-exclamation"></i><p>加载失败：${esc(e.message || '未知错误')}</p></div>`;
  }
}

/**
 * 渲染单个申请卡片
 * @param {Object} app
 * @returns {string}
 */
function _renderApplicationCard(app) {
  const status = STATUS_LABELS[app.status] || STATUS_LABELS.pending;
  const orgIcon = orgTypeIcon(app.organizationType);
  const orgLabel = orgTypeLabel(app.organizationType);
  const reviewedInfo = app.reviewedAt
    ? `<div class="app-card-meta"><i class="fa-solid fa-gavel"></i> 审核时间：${fmtTime(app.reviewedAt)}</div>`
    : '';

  return `
    <div class="application-card" data-id="${app.id}">
      <div class="app-card-head">
        <div class="app-card-title">
          <i class="fa-solid ${orgIcon}"></i>
          <span class="app-card-org">${esc(app.organizationName)}</span>
          <span class="app-card-org-type">${esc(orgLabel)}</span>
        </div>
        <span class="app-card-status" style="color:${status.color};border-color:${status.color}">
          <i class="fa-solid ${status.icon}"></i> ${status.label}
        </span>
      </div>
      <div class="app-card-body">
        <div class="app-card-meta"><i class="fa-solid fa-user"></i> ${esc(app.contactName)}</div>
        <div class="app-card-meta"><i class="fa-solid fa-phone"></i> ${esc(app.contactPhone)}</div>
        ${app.contactEmail ? `<div class="app-card-meta"><i class="fa-solid fa-envelope"></i> ${esc(app.contactEmail)}</div>` : ''}
        <div class="app-card-intent">
          <i class="fa-solid fa-comment-dots"></i>
          <span>${esc(app.cooperationIntent)}</span>
        </div>
        <div class="app-card-meta"><i class="fa-solid fa-clock"></i> 提交时间：${fmtTime(app.createdAt)}</div>
        ${reviewedInfo}
      </div>
      ${app.status === 'pending' ? `
        <div class="app-card-actions">
          <button class="btn-ghost" data-reject="${app.id}">
            <i class="fa-solid fa-xmark"></i> 驳回
          </button>
          <button class="btn-primary" data-approve="${app.id}">
            <i class="fa-solid fa-check"></i> 通过
          </button>
        </div>
      ` : `
        <div class="app-card-actions">
          <button class="btn-ghost" data-delete="${app.id}">
            <i class="fa-solid fa-trash"></i> 删除记录
          </button>
        </div>
      `}
    </div>
  `;
}

/**
 * 绑定卡片操作按钮
 * @param {HTMLElement} listEl
 */
function _bindCardActions(listEl) {
  listEl.querySelectorAll('[data-approve]').forEach(btn => {
    btn.addEventListener('click', () => _confirmApprove(Number(btn.dataset.approve)));
  });
  listEl.querySelectorAll('[data-reject]').forEach(btn => {
    btn.addEventListener('click', () => _confirmReject(Number(btn.dataset.reject)));
  });
  listEl.querySelectorAll('[data-delete]').forEach(btn => {
    btn.addEventListener('click', () => _confirmDelete(Number(btn.dataset.delete)));
  });
}

/**
 * 通过申请（二次确认）
 * @param {number} id
 */
async function _confirmApprove(id) {
  _showConfirmDialog({
    title: '确认通过申请',
    icon: 'fa-circle-check',
    tone: 'success',
    message: '确定通过该合伙人申请吗？通过后将进入合作对接流程。',
    confirmText: '确认通过',
    onConfirm: async () => {
      try {
        await approveApplication(id);
        if (window.showToast) showToast('✓ 已通过申请', 'success');
        if (window.Sound && typeof Sound.playSound === 'function') Sound.playSound('success');
        await _refreshAdminCounts();
        await _renderAdminList();
      } catch (e) {
        if (window.showToast) showToast('操作失败：' + (e.message || '未知错误'), 'error');
      }
    }
  });
}

/**
 * 驳回申请（二次确认）
 * @param {number} id
 */
async function _confirmReject(id) {
  _showConfirmDialog({
    title: '确认驳回申请',
    icon: 'fa-triangle-exclamation',
    tone: 'danger',
    message: '确定驳回该合伙人申请吗？驳回后将无法恢复为待审核状态。',
    confirmText: '确认驳回',
    onConfirm: async () => {
      try {
        await rejectApplication(id);
        if (window.showToast) showToast('已驳回申请', 'info');
        if (window.Sound && typeof Sound.playSound === 'function') Sound.playSound('close');
        await _refreshAdminCounts();
        await _renderAdminList();
      } catch (e) {
        if (window.showToast) showToast('操作失败：' + (e.message || '未知错误'), 'error');
      }
    }
  });
}

/**
 * 删除申请记录（二次确认）
 * @param {number} id
 */
async function _confirmDelete(id) {
  _showConfirmDialog({
    title: '删除申请记录',
    icon: 'fa-trash',
    tone: 'danger',
    message: '确定删除该申请记录吗？此操作不可撤销。',
    confirmText: '确认删除',
    onConfirm: async () => {
      try {
        await deletePartnerApplication(id);
        if (window.showToast) showToast('记录已删除', 'success');
        if (window.Sound && typeof Sound.playSound === 'function') Sound.playSound('close');
        await _refreshAdminCounts();
        await _renderAdminList();
      } catch (e) {
        if (window.showToast) showToast('删除失败：' + (e.message || '未知错误'), 'error');
      }
    }
  });
}

/**
 * 通用确认弹窗
 * @param {Object} opts
 * @param {string} opts.title
 * @param {string} opts.icon
 * @param {string} opts.tone - success / danger
 * @param {string} opts.message
 * @param {string} opts.confirmText
 * @param {Function} opts.onConfirm
 */
function _showConfirmDialog(opts) {
  const overlay = document.createElement('div');
  overlay.className = 'modal-overlay confirm-modal';
  overlay.innerHTML = `
    <div class="modal-box confirm-box glass">
      <h3><i class="fa-solid ${opts.icon}"></i> ${esc(opts.title)}</h3>
      <p>${esc(opts.message)}</p>
      <div class="confirm-actions">
        <button class="btn-ghost" data-cancel>取消</button>
        <button class="btn-primary ${opts.tone === 'danger' ? 'danger' : ''}" data-ok>${esc(opts.confirmText)}</button>
      </div>
    </div>
  `;
  document.body.appendChild(overlay);
  requestAnimationFrame(() => overlay.classList.add('open'));
  if (window.ModalScrollLock) ModalScrollLock.lock();

  const close = () => {
    overlay.classList.remove('open');
    if (window.ModalScrollLock) ModalScrollLock.unlock();
    setTimeout(() => { if (overlay.parentNode) overlay.remove(); }, 300);
  };

  overlay.addEventListener('click', async (e) => {
    if (e.target === overlay || e.target.closest('[data-cancel]')) {
      close();
    }
    if (e.target.closest('[data-ok]')) {
      const okBtn = overlay.querySelector('[data-ok]');
      okBtn.disabled = true;
      okBtn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> 处理中…';
      try {
        if (typeof opts.onConfirm === 'function') await opts.onConfirm();
      } finally {
        close();
      }
    }
  });
}

/**
 * 通过申请：状态流转 pending → approved
 * @param {number} id
 * @returns {Promise<Object>}
 */
async function approveApplication(id) {
  const user = (window.Auth && Auth.currentUser) ? Auth.currentUser : null;
  return await updatePartnerApplication(id, {
    status: 'approved',
    reviewedBy: user ? (user.id || user.username || null) : null
  });
}

/**
 * 驳回申请：状态流转 pending → rejected
 * @param {number} id
 * @returns {Promise<Object>}
 */
async function rejectApplication(id) {
  const user = (window.Auth && Auth.currentUser) ? Auth.currentUser : null;
  return await updatePartnerApplication(id, {
    status: 'rejected',
    reviewedBy: user ? (user.id || user.username || null) : null
  });
}

// ============================================================
// 导出
// ============================================================

window.AIPartner = {
  openPartner,
  closePartner,
  openFromHash,
  renderAdminPanel,
  ORG_TYPES,
  STATUS_LABELS
};

export default {
  openPartner,
  closePartner,
  openFromHash,
  renderAdminPanel,
  ORG_TYPES,
  STATUS_LABELS
};

export {
  openPartner,
  closePartner,
  openFromHash,
  renderAdminPanel,
  ORG_TYPES,
  STATUS_LABELS
};
