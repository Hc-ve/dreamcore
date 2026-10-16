// ============================================================
// js/ai-disclosure-page.js — P1-4 内容合规声明页
// 路由 #/ai-disclosure：三级内容标注体系说明
//   ① 人工校对事实卡（青绿）— 核心知识库，公认史实 + 人工校对溯源
//   ② AI 联网生成·仅供参考（黄）— 扩展讲解由 AI 联网搜索生成
//   ③ AI 图像创作（雾紫）— 生成式模型产出的图像作品
// + 各级在产品内的出现位置对照 + 底部版权与使用范围说明。
// 模式：套用 ai-score-page.js overlay 模板；模块在 import 时自注册
// hashchange 监听，main.js 接线时仅需 import 即可纳入路由。
// ============================================================

let overlayEl = null;

// 三级标注体系配置（accent 对应产品内各级标色）
const LEVELS = [
  {
    key: 'fact',
    no: '①',
    name: '人工校对事实卡',
    accent: '#34d399',
    icon: 'fa-book-open-reader',
    desc: '12 核心文化主题知识库，facts 均为公认史实，人工校对溯源。每条事实可回溯至知识库条目，不经过大模型改写。',
    spots: ['文化图鉴核心主题详情', 'AI 识图讲解']
  },
  {
    key: 'web',
    no: '②',
    name: 'AI 联网生成 · 仅供参考',
    accent: '#fbbf24',
    icon: 'fa-satellite-dish',
    desc: '扩展文化地标 / 景区 / 景点讲解由 AI 联网搜索生成，可能存在误差。请以景区官方介绍与权威史料为准。',
    spots: ['图鉴扩展主题', '智慧导览讲解区（黄标）']
  },
  {
    key: 'image',
    no: '③',
    name: 'AI 图像创作',
    accent: 'var(--dream-purple)',
    icon: 'fa-wand-magic-sparkles',
    desc: 'AI 文创 / 修图 / 重绘作品由生成式模型产出，受 prompt 与模型能力影响，不代表对文化原貌的复原。',
    spots: ['AI 文创结果页', 'AI 修图工作台']
  }
];

// B2 双备案路径配置（①青绿=深度合成算法备案 ②雾紫=生成式 AI 服务备案）
const FILING_STEPS = [
  {
    no: '①',
    name: '深度合成服务算法备案',
    accent: '#34d399',
    icon: 'fa-file-shield',
    desc: '依据《互联网信息服务深度合成管理规定》，向网信部门履行深度合成服务算法备案手续，自服务上线之日起 10 个工作日内完成申报。规划于产品正式商用上线时同步完成。',
    spots: ['法规：深度合成管理规定', '受理：网信部门', '时限：上线后 10 个工作日']
  },
  {
    no: '②',
    name: '生成式人工智能服务备案',
    accent: 'var(--dream-purple)',
    icon: 'fa-building-shield',
    desc: '依据《生成式人工智能服务管理暂行办法》，在面向公众提供生成式 AI 服务前完成备案。责任边界：本产品自研文创模型为服务提供方；识图 / 讲解调用的大模型能力由阿里云百炼提供并已履行其备案义务，双方按各自服务环节承担相应合规责任。',
    spots: ['法规：生成式 AI 暂行办法', '受理：网信部门', '时点：面向公众提供服务前']
  }
];

function _injectStyle() {
  if (document.getElementById('ai-disclosure-page-style')) return;
  const st = document.createElement('style');
  st.id = 'ai-disclosure-page-style';
  st.textContent = `
    .ad-page-box { max-width: 780px; width: 92%; max-height: 90vh; overflow-y: auto; padding: 30px 28px; }
    .ad-title { margin: 0 0 6px; font-size: 1.4rem; font-weight: 800; color: var(--text-primary); }
    .ad-sub { margin: 0 0 20px; font-size: .88rem; color: var(--text-secondary); }

    /* ---- 三级标注卡 ---- */
    .ad-grid { display: flex; flex-direction: column; gap: 12px; margin-bottom: 20px; }
    .ad-card { display: flex; gap: 14px; padding: 16px 18px; border-radius: var(--radius);
      border: 1.5px solid var(--glass-border); border-left: 4px solid var(--card-accent, #34d399);
      background: var(--glass-bg); backdrop-filter: blur(12px); transition: transform .25s, box-shadow .25s; }
    .ad-card:hover { transform: translateY(-3px); box-shadow: 0 12px 28px rgba(201,182,255,.16); }
    .ad-icon { flex: none; display: inline-flex; align-items: center; justify-content: center;
      width: 46px; height: 46px; border-radius: 14px; font-size: 1.15rem; color: var(--card-accent, #34d399);
      background: color-mix(in srgb, var(--card-accent, #34d399) 14%, transparent);
      border: 1px solid color-mix(in srgb, var(--card-accent, #34d399) 35%, transparent); }
    .ad-body { flex: 1; min-width: 0; }
    .ad-name-row { display: flex; align-items: center; gap: 8px; flex-wrap: wrap; margin-bottom: 6px; }
    .ad-no { display: inline-flex; align-items: center; justify-content: center; padding: 1px 9px;
      border-radius: 999px; font-size: .74rem; font-weight: 800; color: #fff;
      background: var(--card-accent, #34d399); }
    .ad-name { margin: 0; font-size: 1rem; font-weight: 800; color: var(--text-primary); }
    .ad-desc { margin: 0 0 8px; font-size: .84rem; line-height: 1.6; color: var(--text-secondary); }
    .ad-spots-row { display: flex; align-items: center; gap: 6px; flex-wrap: wrap; }
    .ad-spots-label { font-size: .76rem; font-weight: 700; color: var(--text-secondary); }
    .ad-spot { display: inline-flex; align-items: center; gap: 5px; padding: 3px 10px; border-radius: 999px;
      font-size: .74rem; color: var(--text-primary); border: 1px solid var(--glass-border);
      background: color-mix(in srgb, var(--card-accent, #34d399) 8%, transparent); }
    .ad-spot i { font-size: .64rem; color: var(--card-accent, #34d399); }

    /* ---- 版权与使用范围 ---- */
    .ad-license { border-radius: var(--radius); border: 1.5px solid var(--glass-border);
      background: var(--glass-bg); backdrop-filter: blur(12px); padding: 18px 20px; }
    .ad-license-title { margin: 0 0 10px; font-size: .98rem; font-weight: 800; color: var(--text-primary); }
    .ad-license ul { list-style: none; margin: 0; padding: 0; display: flex; flex-direction: column; gap: 8px; }
    .ad-license li { display: flex; align-items: flex-start; gap: 8px; font-size: .82rem;
      line-height: 1.6; color: var(--text-secondary); }
    .ad-license li i { color: #34d399; font-size: .78rem; margin-top: 4px; flex: none; }

    /* ---- B2 算法备案与合规规划（沿用三级标注卡排版语言） ---- */
    .ad-filing { border-radius: var(--radius); border: 1.5px solid var(--glass-border);
      background: var(--glass-bg); backdrop-filter: blur(12px); padding: 18px 20px; }
    .ad-filing-title { margin: 0 0 12px; font-size: .98rem; font-weight: 800; color: var(--text-primary); }
    .ad-filing-steps { display: grid; grid-template-columns: 1fr 1fr; gap: 12px; margin-bottom: 12px; }
    .ad-filing-step { display: flex; gap: 12px; padding: 14px 16px; border-radius: var(--radius-sm, 12px);
      border: 1px solid var(--glass-border); border-left: 4px solid var(--card-accent, #34d399);
      background: color-mix(in srgb, var(--card-accent, #34d399) 6%, transparent); }
    .ad-filing-step .ad-body { flex: 1; min-width: 0; }
    .ad-filing-bench { display: flex; align-items: flex-start; gap: 8px; margin: 0 0 8px; font-size: .8rem;
      line-height: 1.6; color: var(--text-secondary); }
    .ad-filing-bench i { color: #fbbf24; font-size: .78rem; margin-top: 4px; flex: none; }
    .ad-filing-note { display: flex; align-items: flex-start; gap: 8px; margin: 0; font-size: .8rem;
      line-height: 1.6; color: var(--text-secondary); }
    .ad-filing-note i { color: #34d399; font-size: .78rem; margin-top: 4px; flex: none; }

    @media (max-width: 640px) {
      .ad-page-box { padding: 24px 16px; }
      .ad-card { flex-direction: column; gap: 10px; }
      .ad-filing-steps { grid-template-columns: 1fr; }
    }
  `;
  document.head.appendChild(st);
}

function openDisclosure() {
  if (overlayEl) return;
  _injectStyle();
  const overlay = document.createElement('div');
  overlay.className = 'modal-overlay';
  overlay.id = 'ai-disclosure-page';
  overlay.innerHTML = `
    <div class="modal-box ad-page-box glass">
      <button class="modal-close" data-close aria-label="关闭"><i class="fa-solid fa-xmark"></i></button>
      <h2 class="ad-title">AI 内容说明与合规声明</h2>
      <p class="ad-sub">三级内容标注体系 · 让每一次 AI 参与都清晰可辨</p>
      <div class="ad-grid">
        ${LEVELS.map(l => `
        <div class="ad-card" data-level="${l.key}" style="--card-accent:${l.accent};">
          <span class="ad-icon"><i class="fa-solid ${l.icon}"></i></span>
          <div class="ad-body">
            <div class="ad-name-row">
              <span class="ad-no">${l.no}</span>
              <h3 class="ad-name">${l.name}</h3>
            </div>
            <p class="ad-desc">${l.desc}</p>
            <div class="ad-spots-row">
              <span class="ad-spots-label">出现位置</span>
              ${l.spots.map(s => `<span class="ad-spot"><i class="fa-solid fa-location-dot"></i>${s}</span>`).join('')}
            </div>
          </div>
        </div>`).join('')}
      </div>
      <div class="ad-filing">
        <h4 class="ad-filing-title"><i class="fa-solid fa-file-shield" style="color:#34d399;margin-right:6px;"></i>算法备案与合规规划</h4>
        <div class="ad-filing-steps">
          ${FILING_STEPS.map(f => `
          <div class="ad-filing-step" style="--card-accent:${f.accent};">
            <span class="ad-icon"><i class="fa-solid ${f.icon}"></i></span>
            <div class="ad-body">
              <div class="ad-name-row">
                <span class="ad-no">${f.no}</span>
                <h3 class="ad-name">${f.name}</h3>
              </div>
              <p class="ad-desc">${f.desc}</p>
              <div class="ad-spots-row">
                ${f.spots.map(s => `<span class="ad-spot"><i class="fa-solid fa-location-dot"></i>${s}</span>`).join('')}
              </div>
            </div>
          </div>`).join('')}
        </div>
        <p class="ad-filing-bench"><i class="fa-solid fa-medal"></i><span>对标先例：同程旅行「程心 AI」为业内首家同时完成算法备案与大模型双备案的旅行助手产品，验证了「双备案」是 AI 产品商用的合规通行证。</span></p>
        <p class="ad-filing-note"><i class="fa-solid fa-circle-info"></i><span>本项目当前为校园竞赛演示阶段，所有生成内容均带 AI 标识；正式商用前将按上述路径完成双备案。</span></p>
      </div>
      <div class="ad-license">
        <h4 class="ad-license-title"><i class="fa-solid fa-scale-balanced" style="color:#34d399;margin-right:6px;"></i>版权与使用范围</h4>
        <ul>
          <li><i class="fa-solid fa-circle-check"></i><span>用户作品版权归原作者所有，平台仅在作者授权范围内进行展示与传播，任何商业使用需另行取得作者同意。</span></li>
          <li><i class="fa-solid fa-circle-check"></i><span>AI 生成内容均按三级标注体系明确标识；依据《生成式人工智能服务管理暂行办法》，AI 生成内容转载时请保留相应标注，不得移除或遮盖。</span></li>
          <li><i class="fa-solid fa-circle-check"></i><span>本站为竞赛演示环境，部分数据为演示数据，页面功能与价格体系不构成商业要约。</span></li>
        </ul>
      </div>
    </div>
  `;
  document.body.appendChild(overlay);
  overlayEl = overlay;
  if (window.ModalScrollLock) ModalScrollLock.lock();
  requestAnimationFrame(() => overlay.classList.add('open'));

  overlay.addEventListener('click', (e) => {
    if (e.target === overlay || e.target.closest('[data-close]')) _closeFromButton();
  });
}

function closeDisclosure() {
  if (!overlayEl) return;
  const el = overlayEl;
  overlayEl = null;
  el.classList.remove('open');
  if (window.ModalScrollLock) ModalScrollLock.unlock();
  if (typeof Sound !== 'undefined') Sound.playSound('close');
  setTimeout(() => el.remove(), 260);
}

// 关闭按钮 / 遮罩点击：清除 hash 返回上一页（hashchange 触发 closeDisclosure）
function _closeFromButton() {
  if (window.location.hash && /^#\/ai-disclosure/.test(window.location.hash)) {
    window.location.hash = '';
  } else {
    closeDisclosure();
  }
}

function isDisclosureHash() {
  return /^#\/ai-disclosure(?:\?.*)?$/.test(window.location.hash || '');
}

function openFromHash() {
  if (isDisclosureHash()) openDisclosure();
  else closeDisclosure();
}

window.AIDisclosurePage = { openDisclosure, closeDisclosure, openFromHash };

// 模块自注册路由监听：import 即生效（ES Module 单例，重复 import 幂等）
window.addEventListener('hashchange', openFromHash);
// 覆盖 import 时 hash 已就位的场景（如测试先导航后 import、深链刷新）
openFromHash();

export { openDisclosure, closeDisclosure, openFromHash, isDisclosureHash };
