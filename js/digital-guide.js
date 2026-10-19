// ============================================================
// js/digital-guide.js — P1-3 数字人讲解员「小梦」浮动挂件
// 依赖：js/tts-player.js 在状态流转处向 document 广播的
//   CustomEvent('tts-state', { detail: { state, text } })
//   state ∈ loading | playing | stopped | error
// 三形态（纯 CSS keyframes 驱动，无 JS 动画库）：
//   .dg-loading —— 淡入上滑出现；外圈青绿光环呼吸脉冲；声波条交替跳动
//   .dg-playing —— 嘴部椭圆 scaleY 开合（.5s infinite alternate）；头部微摆 ±3°；声波条全跳
//   .dg-stopped / .dg-error —— 标签回落「小梦」，1.2s 后淡出隐藏
// 挂件 fixed 于屏幕左下角（避开右下角 ai-fab），z-index 9500
//   （高于文化 overlay .modal-overlay:1000 与创作工作台 9000）
// 自初始化：被 import 即顶层 init 挂载（默认 display:none 隐藏态）；
//   window 标记 + DOM id 双保险，重复 import 幂等（单例）。
// ============================================================
(function () {
  'use strict';
  if (window.__DREAM_DIGITAL_GUIDE__) return; // 重复 import 幂等（单例）
  window.__DREAM_DIGITAL_GUIDE__ = true;

  var LABEL_ACTIVE = '小梦 · AI 讲解中';
  var LABEL_IDLE = '小梦';
  var VALID_STATES = ['loading', 'playing', 'stopped', 'error'];

  var el = null;       // #digital-guide 挂件根节点
  var labelEl = null;  // .dg-label 文字标签
  var hideTimer = 0;   // stopped/error 的 1.2s 延时句柄
  var outTimer = 0;    // 淡出动画后的收尾句柄
  var sourceHash = ''; // 本次讲解发起的路由（tts-state 事件携带），供点击返回讲解页

  // ---------------- 内联 SVG 拟人形象（纯代码绘制，不引外部图） ----------------
  // 圆脸 + 齐刘海 + 侧边青绿飘带（敦煌飞天）+ 眯眯眼 + 腮红 + 头顶发饰；
  // 外圈虚线光环 .dg-halo（loading 呼吸）；头部编组 .dg-head（playing 微摆）；
  // 嘴部椭圆 .dg-mouth（playing 开合）。
  var AVATAR_SVG = ''
    + '<svg class="dg-avatar" viewBox="0 0 96 96" aria-hidden="true" focusable="false">'
    +   '<defs>'
    +     '<linearGradient id="dgTealGrad" x1="0" y1="0" x2="1" y2="1">'
    +       '<stop offset="0" stop-color="#6ee7b7"/><stop offset="1" stop-color="#34d399"/>'
    +     '</linearGradient>'
    +     '<linearGradient id="dgHairGrad" x1="0" y1="0" x2="0" y2="1">'
    +       '<stop offset="0" stop-color="#7c6ad0"/><stop offset="1" stop-color="#584a9e"/>'
    +     '</linearGradient>'
    +   '</defs>'
    +   '<circle class="dg-halo" cx="48" cy="48" r="45" fill="none" stroke="#34d399" stroke-width="1.6" stroke-dasharray="3 9" stroke-linecap="round" opacity=".55"/>'
    +   '<circle cx="48" cy="48" r="41" fill="rgba(13,10,28,.58)"/>'
    +   '<path d="M 27 44 C 17 38 13 27 5 21" fill="none" stroke="url(#dgTealGrad)" stroke-width="3" stroke-linecap="round" opacity=".9"/>'
    +   '<path d="M 69 44 C 79 38 83 27 91 21" fill="none" stroke="#c9b6ff" stroke-width="2.4" stroke-linecap="round" opacity=".75"/>'
    +   '<g class="dg-head">'
    +     '<circle cx="48" cy="50" r="26" fill="url(#dgHairGrad)"/>'
    +     '<circle cx="48" cy="53" r="21.5" fill="#ffedd6"/>'
    +     '<path d="M 26.5 53 A 21.5 21.5 0 0 1 69.5 53 L 69.5 48 Q 48 53.5 26.5 48 Z" fill="url(#dgHairGrad)"/>'
    +     '<circle cx="48" cy="24.5" r="2.6" fill="#34d399"/>'
    +     '<path d="M 36 57 Q 39.5 53.6 43 57" fill="none" stroke="#4a3b63" stroke-width="2" stroke-linecap="round"/>'
    +     '<path d="M 53 57 Q 56.5 53.6 60 57" fill="none" stroke="#4a3b63" stroke-width="2" stroke-linecap="round"/>'
    +     '<ellipse cx="33" cy="62.5" rx="4.4" ry="2.4" fill="#ffb3c1" opacity=".8"/>'
    +     '<ellipse cx="63" cy="62.5" rx="4.4" ry="2.4" fill="#ffb3c1" opacity=".8"/>'
    +     '<ellipse class="dg-mouth" cx="48" cy="65" rx="4" ry="2.4" fill="#e2556d"/>'
    +   '</g>'
    + '</svg>';

  // ---------------- 样式注入（<style id="digital-guide-style">） ----------------
  function injectStyle() {
    if (document.getElementById('digital-guide-style')) return;
    var st = document.createElement('style');
    st.id = 'digital-guide-style';
    st.textContent = ''
      + '#digital-guide { position: fixed; left: 20px; bottom: calc(88px + env(safe-area-inset-bottom)); z-index: 9500; width: 96px;'
      +   ' display: none; flex-direction: column; align-items: center; gap: 4px;'
      +   ' pointer-events: none; user-select: none; }'
      + '@media (max-width: 768px) { #digital-guide { bottom: calc(150px + env(safe-area-inset-bottom)); left: 12px; width: 80px; } .dg-chip { width: 60px; height: 60px; } }'
      + '#digital-guide.dg-show { display: flex; animation: dg-in .45s ease both; }'
      + '#digital-guide.dg-out { animation: dg-out .45s ease forwards; }'
      + '@keyframes dg-in { from { opacity: 0; transform: translateY(16px); } to { opacity: 1; transform: translateY(0); } }'
      + '@keyframes dg-out { from { opacity: 1; } to { opacity: 0; transform: translateY(10px); } }'
      + '.dg-body { display: flex; align-items: center; gap: 5px; pointer-events: auto; cursor: pointer; transition: transform .2s ease; }'
      + '.dg-body:hover { transform: scale(1.05); }'
      + '.dg-label { pointer-events: auto; cursor: pointer; }'
      + '.dg-chip { width: 72px; height: 72px; border-radius: 50%;'
      +   ' background: radial-gradient(circle at 50% 30%, rgba(52,211,153,.16), rgba(14,11,30,.62) 72%);'
      +   ' border: 1px solid rgba(52,211,153,.3);'
      +   ' box-shadow: 0 6px 22px rgba(52,211,153,.18), inset 0 0 14px rgba(201,182,255,.1);'
      +   ' display: flex; align-items: center; justify-content: center; }'
      + '.dg-avatar { width: 70px; height: 70px; display: block; }'
      + '#digital-guide .dg-halo { transform-box: fill-box; transform-origin: center; }'
      + '#digital-guide .dg-head { transform-box: fill-box; transform-origin: 50% 92%; }'
      + '#digital-guide .dg-mouth { transform-box: fill-box; transform-origin: center; }'
      + '.dg-bars { display: flex; align-items: center; gap: 3px; height: 30px; }'
      + '.dg-bars i { width: 3.5px; height: 17px; border-radius: 2px;'
      +   ' background: linear-gradient(180deg, #6ee7b7, #34d399); transform-origin: center; }'
      + '.dg-label { font-size: 11px; letter-spacing: .5px; color: #bdf4dc; white-space: nowrap;'
      +   ' background: rgba(14,11,30,.6); border: 1px solid rgba(52,211,153,.32); border-radius: 999px;'
      +   ' padding: 2px 10px; text-shadow: 0 0 8px rgba(52,211,153,.45); }'
      // —— loading：光环呼吸脉冲 + 声波条交替跳动 ——
      + '#digital-guide.dg-loading .dg-halo { animation: dg-halo 1.8s ease-in-out infinite; }'
      + '#digital-guide.dg-loading .dg-bars i { animation: dg-wave 1.15s ease-in-out infinite; }'
      + '#digital-guide.dg-loading .dg-bars i:nth-child(2) { animation-delay: .28s; }'
      + '#digital-guide.dg-loading .dg-bars i:nth-child(3) { animation-delay: .56s; }'
      // —— playing：嘴部 scaleY 开合 + 头部微摆 ±3° + 声波条全跳 ——
      + '#digital-guide.dg-playing .dg-mouth { animation: dg-talk .5s ease-in-out infinite alternate; }'
      + '#digital-guide.dg-playing .dg-head { animation: dg-sway 2.2s ease-in-out infinite; }'
      + '#digital-guide.dg-playing .dg-bars i { animation: dg-wave .55s ease-in-out infinite; }'
      // —— stopped / error：动效收敛，待 1.2s 后由 JS 淡出 ——
      + '#digital-guide.dg-stopped .dg-bars i, #digital-guide.dg-error .dg-bars i'
      +   ' { animation: none; transform: scaleY(.35); opacity: .4; }'
      + '#digital-guide.dg-stopped .dg-avatar, #digital-guide.dg-error .dg-avatar { opacity: .8; }'
      + '#digital-guide.dg-error .dg-label { color: #fecaca; border-color: rgba(248,113,113,.4); }'
      + '@keyframes dg-halo { 0%,100% { transform: scale(1); opacity: .45; } 50% { transform: scale(1.08); opacity: .9; } }'
      + '@keyframes dg-wave { 0%,100% { transform: scaleY(.3); opacity: .55; } 50% { transform: scaleY(1); opacity: 1; } }'
      + '@keyframes dg-talk { from { transform: scaleY(.15); } to { transform: scaleY(1.7); } }'
      + '@keyframes dg-sway { 0%,100% { transform: rotate(-3deg); } 50% { transform: rotate(3deg); } }';
    document.head.appendChild(st);
  }

  // ---------------- 单例挂载（DOM id 双保险） ----------------
  function mount() {
    if (document.getElementById('digital-guide')) {
      el = document.getElementById('digital-guide');
      labelEl = el.querySelector('.dg-label');
      return;
    }
    injectStyle();
    el = document.createElement('div');
    el.id = 'digital-guide';
    el.setAttribute('role', 'status');
    el.setAttribute('aria-label', 'AI 讲解员小梦');
    el.innerHTML = ''
      + '<div class="dg-body">'
      +   '<div class="dg-chip">' + AVATAR_SVG + '</div>'
      +   '<div class="dg-bars" aria-hidden="true"><i></i><i></i><i></i></div>'
      + '</div>'
      + '<div class="dg-label">' + LABEL_IDLE + '</div>';
    document.body.appendChild(el);
    labelEl = el.querySelector('.dg-label');
    // 点击挂件：停止讲解；若讲解发起于其他路由，则返回该讲解页
    el.addEventListener('click', function (e) {
      e.preventDefault();
      e.stopPropagation();
      if (!isActive()) return; // 非讲解中不响应
      try { window.TTSPlayer && window.TTSPlayer.stop && window.TTSPlayer.stop(); } catch (_) {}
      if (sourceHash && window.location.hash !== sourceHash) {
        window.location.hash = sourceHash; // 触发 hashchange → 目标路由 openFromHash 重新打开讲解页
      }
      if (window.showToast) window.showToast('已停止语音讲解', 'success');
    });
  }

  // 是否处于「讲解中」（loading / playing）
  function isActive() {
    return !!el && (el.classList.contains('dg-loading') || el.classList.contains('dg-playing'));
  }

  // ---------------- 状态机：tts-state → CSS 类切换 ----------------
  function setState(state) {
    if (!el) return;
    clearTimeout(hideTimer);
    clearTimeout(outTimer);
    el.classList.remove('dg-loading', 'dg-playing', 'dg-stopped', 'dg-error', 'dg-out');
    var active = (state === 'loading' || state === 'playing');
    el.classList.add('dg-show', 'dg-' + state);
    labelEl.textContent = active ? LABEL_ACTIVE : LABEL_IDLE;
    el.title = active ? '点击停止语音讲解' : ''; // 提示挂件可交互
    if (!active) {
      // 停止/出错：停留 1.2s → 淡出 .45s → 回归 display:none
      hideTimer = setTimeout(function () {
        el.classList.add('dg-out');
        outTimer = setTimeout(function () {
          el.classList.remove('dg-show', 'dg-out');
        }, 500);
      }, 1200);
    }
  }

  document.addEventListener('tts-state', function (e) {
    var state = e && e.detail && e.detail.state;
    if (VALID_STATES.indexOf(state) === -1) return;
    if (e.detail && typeof e.detail.hash === 'string') sourceHash = e.detail.hash; // 记录讲解发起路由
    mount(); // 防御：若尚未挂载（如动态 import 早于 body）则补挂
    setState(state);
  });

  // ---------------- 自初始化：被 import 即挂载（隐藏态，事件到达再现身） ----------------
  function init() {
    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', mount);
    } else {
      mount();
    }
  }
  init();
})();
