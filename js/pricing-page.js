// ============================================================
// js/pricing-page.js — P0-3 商业模式演示页
// 路由 #/pricing：三档会员卡（免费 / 创作会员 ¥259 / 景区定制 ¥5,980）
// + 每档「定制实物」mock 下单流（选规格 → 提交 → 成功态，纯前端状态机）
// + 底部成本测算卡（自研模型 0 边际成本 vs 行业参考 7.2 元/次）
// 模式：完全套用 ai-score-page.js overlay 模板（_injectStyle +
// modal-overlay + hashchange + 关闭清理）；本模块在 import 时自注册
// hashchange 监听，main.js 只需 import 即可纳入路由（无需额外绑定）。
// ============================================================

let overlayEl = null;      // 会员页主 overlay（单例）
let orderOverlayEl = null; // mock 下单弹窗 overlay（单例，可嵌套于主 overlay 之上）
let orderState = null;     // 下单状态机：{ tier, step: 'select'|'loading'|'success', size, material }

// 三档会员配置（对标稿定设计 259 / 598 档位体系）
const TIERS = [
  {
    key: 'free',
    name: '免费版',
    tag: '轻体验',
    price: '¥0',
    unit: '/永久',
    desc: '随时开始你的第一次文化创作',
    features: ['每日 3 次 AI 生成', '基础版式库', '标准清晰度导出', '文化图鉴浏览'],
    ctaLabel: '开始创作', ctaIcon: 'fa-wand-magic-sparkles'
  },
  {
    key: 'creator',
    name: '创作会员',
    tag: '最受欢迎',
    popular: true,
    price: '¥259',
    unit: '/年',
    desc: '为持续创作者准备的完整工作流',
    features: ['无限 AI 生成', '全部版式构图', '4K 高清导出', '实物预览与定制', '专属足迹徽章'],
    ctaLabel: '升级创作会员', ctaIcon: 'fa-crown'
  },
  {
    key: 'scenic',
    name: '景区定制',
    tag: 'B 端',
    price: '¥5,980',
    unit: '/年起',
    desc: '面向景区 / 博物馆 / 文旅机构',
    features: ['专属文化主题知识库', 'AI 讲解 API 接入', '运营数据看板', '联合文创活动支持'],
    dashboardLink: true,
    ctaLabel: '开通景区定制', ctaIcon: 'fa-box-open'
  }
];

// mock 下单可选规格（单选）
const ORDER_SIZES = [
  { key: 'a5', label: 'A5 · 明信片' },
  { key: 'a4', label: 'A4 · 标准海报' },
  { key: 'a3', label: 'A3 · 大幅装饰画' }
];
const ORDER_MATERIALS = [
  { key: 'matte', label: '哑光纸' },
  { key: 'art', label: '艺术纸' },
  { key: 'canvas', label: '帆布' }
];

function _injectStyle() {
  if (document.getElementById('pricing-page-style')) return;
  const st = document.createElement('style');
  st.id = 'pricing-page-style';
  st.textContent = `
    .pricing-page-box { max-width: 980px; width: 94%; max-height: 90vh; overflow-y: auto; padding: 30px 28px; }
    .pp-title { margin: 0 0 6px; font-size: 1.5rem; font-weight: 800; color: var(--text-primary); }
    .pp-title-grad { background: linear-gradient(120deg, var(--dream-purple), var(--dream-pink)); -webkit-background-clip: text; background-clip: text; -webkit-text-fill-color: transparent; }
    .pp-sub { margin: 0 0 22px; font-size: .9rem; color: var(--text-secondary); }

    /* ---- 三档会员卡 ---- */
    .pp-grid { display: grid; grid-template-columns: repeat(3, 1fr); gap: 14px; margin-bottom: 20px; }
    .pp-card { position: relative; display: flex; flex-direction: column; gap: 10px; padding: 20px 18px;
      border-radius: var(--radius); border: 1.5px solid var(--glass-border); background: var(--glass-bg);
      backdrop-filter: blur(12px); transition: transform .25s, box-shadow .25s; }
    .pp-card:hover { transform: translateY(-4px); box-shadow: 0 14px 34px rgba(201,182,255,.22); }
    .pp-card.popular { border: 2px solid var(--dream-purple); box-shadow: 0 0 0 4px rgba(201,182,255,.16), 0 14px 34px rgba(201,182,255,.25); }
    .pp-pop-badge { position: absolute; top: -12px; left: 50%; transform: translateX(-50%); white-space: nowrap;
      padding: 4px 14px; border-radius: 999px; font-size: .74rem; font-weight: 800; letter-spacing: 1px; color: #fff;
      background: linear-gradient(120deg, var(--dream-purple), var(--dream-pink)); box-shadow: 0 4px 14px rgba(201,182,255,.5); }
    .pp-card-tag { display: inline-flex; align-self: flex-start; padding: 2px 10px; border-radius: 999px;
      font-size: .72rem; color: var(--text-secondary); border: 1px solid var(--glass-border); }
    .pp-card.popular .pp-card-tag { display: none; }
    .pp-name { margin: 0; font-size: 1.06rem; font-weight: 800; color: var(--text-primary); }
    .pp-price-row { display: flex; align-items: baseline; gap: 4px; }
    .pp-price { font-size: 1.7rem; font-weight: 800; color: var(--text-primary); }
    .pp-unit { font-size: .8rem; color: var(--text-secondary); }
    .pp-desc { margin: 0; font-size: .8rem; color: var(--text-secondary); }
    .pp-features { list-style: none; margin: 4px 0 6px; padding: 0; flex: 1; display: flex; flex-direction: column; gap: 7px; }
    .pp-features li { display: flex; align-items: flex-start; gap: 8px; font-size: .84rem; color: var(--text-primary); line-height: 1.45; }
    .pp-features i { color: #34d399; font-size: .8rem; margin-top: 3px; flex: none; }
    .pp-card.popular .pp-features i { color: var(--dream-purple); }
    .pp-dashboard-link { display: inline-flex; align-items: center; gap: 6px; font-size: .82rem; font-weight: 600;
      color: #34d399; text-decoration: none; padding: 6px 0; }
    .pp-dashboard-link:hover { text-decoration: underline; }
    .pp-order-btn { width: 100%; justify-content: center; }

    /* ---- 成本测算卡 ---- */
    .pp-cost { border-radius: var(--radius); border: 1.5px solid var(--glass-border); background: var(--glass-bg);
      backdrop-filter: blur(12px); padding: 18px 20px; }
    .pp-cost-title { margin: 0 0 12px; font-size: .98rem; font-weight: 800; color: var(--text-primary); }
    .pp-cost-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 12px; }
    .pp-cost-col { border-radius: var(--radius-sm, 12px); padding: 14px 16px; border: 1px solid var(--glass-border); }
    .pp-cost-col.ours { background: linear-gradient(135deg, rgba(52,211,153,.12), rgba(184,240,212,.08)); }
    .pp-cost-col.industry { background: rgba(251,191,36,.08); }
    .pp-cost-label { display: inline-block; margin-bottom: 6px; padding: 2px 10px; border-radius: 999px;
      font-size: .72rem; font-weight: 700; color: #fff; }
    .pp-cost-col.ours .pp-cost-label { background: #34d399; }
    .pp-cost-col.industry .pp-cost-label { background: #fbbf24; }
    .pp-cost-num { font-size: 1.3rem; font-weight: 800; color: var(--text-primary); }
    .pp-cost-num em { font-style: normal; font-size: .78rem; font-weight: 600; color: var(--text-secondary); }
    .pp-cost-note { margin: 4px 0 0; font-size: .78rem; color: var(--text-secondary); line-height: 1.5; }

    /* ---- mock 下单弹窗（叠加于主 overlay 之上） ---- */
    .pp-order-overlay { z-index: 1100; }
    .pp-order-box { max-width: 420px; width: 92%; max-height: 86vh; overflow-y: auto; padding: 26px 24px;
      border-radius: var(--radius); background: var(--glass-bg); backdrop-filter: blur(28px) saturate(160%);
      box-shadow: 0 30px 80px rgba(0,0,0,.35), 0 0 0 1px var(--glass-border); }
    .pp-order-title { margin: 0 0 4px; font-size: 1.12rem; font-weight: 800; color: var(--text-primary); }
    .pp-order-sub { margin: 0 0 16px; font-size: .8rem; color: var(--text-secondary); }
    .pp-group-label { margin: 12px 0 8px; font-size: .84rem; font-weight: 700; color: var(--text-primary); }
    .pp-opts { display: flex; flex-wrap: wrap; gap: 8px; }
    .pp-opt { padding: 8px 14px; border-radius: 999px; border: 1.5px solid var(--glass-border);
      background: transparent; color: var(--text-secondary); font-size: .82rem; cursor: pointer; transition: all .2s; }
    .pp-opt:hover { border-color: var(--dream-purple); color: var(--text-primary); }
    .pp-opt.sel { border-color: var(--dream-purple); background: rgba(201,182,255,.18); color: var(--text-primary); font-weight: 700; }
    .pp-order-summary { margin: 14px 0 4px; font-size: .8rem; color: var(--text-secondary); }
    .pp-order-loading { text-align: center; padding: 30px 0 22px; font-size: .92rem; color: var(--text-primary); }
    .pp-order-success { text-align: center; padding: 18px 0 6px; }
    .pp-order-success .pp-ok-icon { display: inline-flex; align-items: center; justify-content: center;
      width: 54px; height: 54px; border-radius: 50%; font-size: 1.5rem; color: #fff; background: #34d399;
      box-shadow: 0 6px 20px rgba(52,211,153,.45); }
    .pp-order-no { margin: 14px 0 2px; font-size: 1.14rem; font-weight: 800; color: var(--text-primary); letter-spacing: .5px; }
    .pp-order-done { margin: 4px 0 0; font-size: .76rem; color: var(--text-secondary); opacity: .8; }

    /* ---- 响应式：窄屏纵排 ---- */
    @media (max-width: 900px) {
      .pricing-page-box { padding: 24px 16px; }
      .pp-grid { grid-template-columns: 1fr; gap: 18px; }
      .pp-card.popular { order: -1; }
      .pp-cost-grid { grid-template-columns: 1fr; }
    }
  `;
  document.head.appendChild(st);
}

// ------------------------------------------------------------
// 主页面：三档会员卡 + 成本测算
// ------------------------------------------------------------
function openPricing() {
  if (overlayEl) return;
  _injectStyle();
  const overlay = document.createElement('div');
  overlay.className = 'modal-overlay';
  overlay.id = 'pricing-page';
  overlay.innerHTML = `
    <div class="modal-box pricing-page-box glass">
      <button class="modal-close" data-close aria-label="关闭"><i class="fa-solid fa-xmark"></i></button>
      <h2 class="pp-title"><span class="pp-title-grad">Dreamcore 会员权益</span></h2>
      <p class="pp-sub">让每一份传统文化灵感，都被看见、被创作、被带进生活</p>
      <div class="pp-grid">
        ${TIERS.map(t => `
        <div class="pp-card${t.popular ? ' popular' : ''}" data-tier="${t.key}">
          ${t.popular ? '<span class="pp-pop-badge"><i class="fa-solid fa-crown"></i> 最受欢迎</span>' : ''}
          <span class="pp-card-tag">${t.tag}</span>
          <h3 class="pp-name">${t.name}</h3>
          <div class="pp-price-row"><span class="pp-price">${t.price}</span><span class="pp-unit">${t.unit}</span></div>
          <p class="pp-desc">${t.desc}</p>
          <ul class="pp-features">
            ${t.features.map(f => `<li><i class="fa-solid fa-circle-check"></i><span>${f}</span></li>`).join('')}
          </ul>
          ${t.dashboardLink ? '<a class="pp-dashboard-link" href="#/dashboard"><i class="fa-solid fa-chart-pie"></i> 查看运营看板演示</a>' : ''}
          <button type="button" class="${t.popular ? 'btn-primary' : 'btn-ghost'} pp-order-btn" data-order="${t.key}">
            <i class="fa-solid ${t.ctaIcon}"></i> ${t.ctaLabel}
          </button>
        </div>`).join('')}
      </div>
      <div class="pp-cost">
        <h4 class="pp-cost-title"><i class="fa-solid fa-scale-balanced" style="color:#34d399;margin-right:6px;"></i>成本测算 · 为什么我们可以做到更低价格</h4>
        <div class="pp-cost-grid">
          <div class="pp-cost-col ours">
            <span class="pp-cost-label">自研模型本地推理</span>
            <div class="pp-cost-num">0 元/次<em> 边际成本</em></div>
            <p class="pp-cost-note">DreamCraft-1.5B 本地部署，生成不依赖按次计费的云端 API，规模扩展无边际成本压力。</p>
          </div>
          <div class="pp-cost-col industry">
            <span class="pp-cost-label">行业参考</span>
            <div class="pp-cost-num">约 7.2 元/次<em> AI 人工讲解</em></div>
            <p class="pp-cost-note">驴迹科技公开数据：景区 AI 人工讲解单次成本约 7.2 元，我们以本地推理将其降至趋近于零。</p>
          </div>
        </div>
      </div>
    </div>
  `;
  document.body.appendChild(overlay);
  overlayEl = overlay;
  if (window.ModalScrollLock) ModalScrollLock.lock();
  requestAnimationFrame(() => overlay.classList.add('open'));

  overlay.addEventListener('click', (e) => {
    if (e.target === overlay || e.target.closest('[data-close]')) _closeFromButton();
    const orderBtn = e.target.closest('[data-order]');
    if (orderBtn) {
      const tier = TIERS.find(t => t.key === orderBtn.dataset.order);
      if (!tier) return;
      // 免费版 CTA：直达创作工坊开始首次创作（转化主路径，不走下单流）
      if (tier.key === 'free') {
        _closeFromButton();
        window.location.hash = '#/craft';
        return;
      }
      openOrderModal(tier);
    }
  });
}

// ------------------------------------------------------------
// mock 下单弹窗：三步状态机（select → loading(1s) → success）
// ------------------------------------------------------------
function openOrderModal(tier) {
  if (orderOverlayEl) return;
  if (typeof Sound !== 'undefined') Sound.playSound('click');
  orderState = { tier, step: 'select', size: 'a4', material: 'art' };
  const ov = document.createElement('div');
  ov.className = 'modal-overlay pp-order-overlay';
  ov.id = 'pp-order-modal';
  ov.innerHTML = '<div class="modal-box pp-order-box"></div>';
  document.body.appendChild(ov);
  orderOverlayEl = ov;
  if (window.ModalScrollLock) ModalScrollLock.lock();
  requestAnimationFrame(() => ov.classList.add('open'));
  ov.addEventListener('click', (e) => {
    if (e.target === ov || e.target.closest('[data-close]')) closeOrderModal();
    const opt = e.target.closest('.pp-opt');
    if (opt && orderState && orderState.step === 'select') {
      orderState[opt.dataset.group] = opt.dataset.value;
      _renderOrderStep();
    }
    if (e.target.closest('#pp-submit-btn') && orderState && orderState.step === 'select') _submitOrder();
    if (e.target.closest('#pp-done-btn')) closeOrderModal();
  });
  _renderOrderStep();
}

function _renderOrderStep() {
  if (!orderOverlayEl || !orderState) return;
  const box = orderOverlayEl.querySelector('.pp-order-box');
  if (!box) return;
  const { tier, step } = orderState;
  const head = `
    <button class="modal-close" data-close aria-label="关闭"><i class="fa-solid fa-xmark"></i></button>
    <h3 class="pp-order-title">${tier.ctaLabel}</h3>
    <p class="pp-order-sub">${tier.name} · ${tier.price}${tier.unit} · 将你的文创作品变成实物</p>`;
  if (step === 'select') {
    box.innerHTML = head + `
      <div class="pp-step-select">
        <div class="pp-group-label">尺寸</div>
        <div class="pp-opts">
          ${ORDER_SIZES.map(s => `<button type="button" class="pp-opt${orderState.size === s.key ? ' sel' : ''}" data-group="size" data-value="${s.key}">${s.label}</button>`).join('')}
        </div>
        <div class="pp-group-label">材质</div>
        <div class="pp-opts">
          ${ORDER_MATERIALS.map(m => `<button type="button" class="pp-opt${orderState.material === m.key ? ' sel' : ''}" data-group="material" data-value="${m.key}">${m.label}</button>`).join('')}
        </div>
        <p class="pp-order-summary">当前选择：${_selLabel(ORDER_SIZES, orderState.size)} · ${_selLabel(ORDER_MATERIALS, orderState.material)}</p>
        <button type="button" class="btn-primary btn-block" id="pp-submit-btn">
          <i class="fa-solid fa-paper-plane"></i> 提交订单</button>
      </div>`;
  } else if (step === 'loading') {
    box.innerHTML = head + `
      <div class="pp-order-loading"><i class="fa-solid fa-spinner fa-spin" style="font-size:1.5rem;color:var(--dream-purple);"></i>
        <p style="margin:12px 0 0;">订单提交中，正在为你预留制作档期…</p></div>`;
  } else if (step === 'success') {
    if (typeof Sound !== 'undefined') Sound.playSound('success');
    box.innerHTML = head + `
      <div class="pp-order-success">
        <span class="pp-ok-icon"><i class="fa-solid fa-check"></i></span>
        <p class="pp-order-no">订单号：${orderState.orderNo}</p>
        <p class="pp-order-summary">${_selLabel(ORDER_SIZES, orderState.size)} · ${_selLabel(ORDER_MATERIALS, orderState.material)} · 预计 7 个工作日发货</p>
        <p class="pp-order-done">演示环境·不产生真实订单</p>
        <button type="button" class="btn-primary btn-block" id="pp-done-btn" style="margin-top:14px;">
          <i class="fa-solid fa-circle-check"></i> 完成</button>
      </div>`;
  }
}

function _selLabel(list, key) {
  const it = list.find(x => x.key === key);
  return it ? it.label : '';
}

function _submitOrder() {
  if (!orderState || orderState.step !== 'select') return;
  orderState.step = 'loading';
  _renderOrderStep();
  // 模拟 1s 提交延迟后进入成功态（纯前端，不产生任何请求）
  setTimeout(() => {
    if (!orderState || orderState.step !== 'loading') return;
    orderState.step = 'success';
    orderState.orderNo = 'DC-2026-' + String(Math.floor(1000 + Math.random() * 9000));
    _renderOrderStep();
  }, 1000);
}

function closeOrderModal() {
  if (!orderOverlayEl) return;
  const el = orderOverlayEl;
  orderOverlayEl = null;
  orderState = null;
  el.classList.remove('open');
  if (window.ModalScrollLock) ModalScrollLock.unlock();
  if (typeof Sound !== 'undefined') Sound.playSound('close');
  setTimeout(() => el.remove(), 260);
}

// ------------------------------------------------------------
// 关闭与路由
// ------------------------------------------------------------
function closePricing() {
  if (!overlayEl) return;
  closeOrderModal(); // 同步关闭可能存在的下单弹窗
  const el = overlayEl;
  overlayEl = null;
  el.classList.remove('open');
  if (window.ModalScrollLock) ModalScrollLock.unlock();
  if (typeof Sound !== 'undefined') Sound.playSound('close');
  setTimeout(() => el.remove(), 260);
}

// 关闭按钮 / 遮罩点击：清除 hash 返回上一页（hashchange 触发 closePricing）
function _closeFromButton() {
  if (window.location.hash && /^#\/pricing/.test(window.location.hash)) {
    window.location.hash = '';
  } else {
    closePricing();
  }
}

function isPricingHash() {
  return /^#\/pricing(?:\?.*)?$/.test(window.location.hash || '');
}

function openFromHash() {
  if (isPricingHash()) openPricing();
  else closePricing();
}

window.PricingPage = { openPricing, closePricing, openFromHash };

// 模块自注册路由监听：import 即生效（main.js 接线时仅需 import，无需重复绑定）。
// ES Module 单例保证重复 import 只注册一次；openPricing/closePricing 幂等。
window.addEventListener('hashchange', openFromHash);
// 覆盖 import 时 hash 已就位的场景（如测试先导航后 import、深链刷新）
openFromHash();

export { openPricing, closePricing, openFromHash, isPricingHash };
