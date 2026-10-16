// ============================================================
// js/tts-player.js — 云端 TTS 语音讲解播放器（通用组件）
// 语音引擎：DashScope CosyVoice（经 /api/ai/tts 云函数代理，密钥零前端暴露）
// 用法：任何模块只需插入按钮 HTML：
//   <button class="btn-ghost tts-btn" data-tts-text="讲解文本">🔊 语音讲解</button>
// 本模块通过全局事件委托接管 .tts-btn：
//   点击 → POST /api/ai/tts → 拿到 audioUrl → <Audio> 播放
//   再次点击同一按钮 → 停止；点击其他按钮 → 自动切歌
// 单例控制：同一时刻只播一段（页面切换 speak 前 stop）
// ============================================================

(function () {
  let currentAudio = null;
  let currentBtn = null;
  let currentText = ''; // 当前讲解文本（供 tts-state 状态广播）
  let styleInjected = false;

  const DEFAULT_LABEL = '<i class="fa-solid fa-volume-high"></i> 语音讲解';

  function _injectStyle() {
    if (styleInjected) return;
    styleInjected = true;
    const st = document.createElement('style');
    st.id = 'tts-player-style';
    st.textContent = `
      .tts-btn.tts-loading { opacity: .65; pointer-events: none; }
      .tts-btn.tts-playing { color: #fbbf24 !important; border-color: rgba(251,191,36,.5) !important; box-shadow: 0 0 12px rgba(251,191,36,.25); }
      .tts-btn.tts-playing i { animation: tts-pulse 1.2s ease-in-out infinite; }
      @keyframes tts-pulse { 0%,100% { opacity: 1; } 50% { opacity: .4; } }
    `;
    document.head.appendChild(st);
  }

  function _resetBtn(btn) {
    if (!btn) return;
    btn.classList.remove('tts-loading', 'tts-playing');
    btn.innerHTML = btn.dataset.ttsLabel || DEFAULT_LABEL;
    btn.disabled = false;
  }

  /** P1-3：向 document 广播 TTS 状态（数字人「小梦」等监听方消费，不改变任何播放行为）
   *  state: 'loading' | 'playing' | 'stopped' | 'error' */
  function _broadcast(state, text) {
    try {
      document.dispatchEvent(new CustomEvent('tts-state', { detail: { state, text: String(text == null ? '' : text) } }));
    } catch (_) { /* 广播失败不影响播放 */ }
  }

  /** 停止当前播放并复位按钮（对外：TTSPlayer.stop()） */
  function stop() {
    const wasActive = !!(currentAudio || currentBtn);
    const lastText = currentText;
    if (currentAudio) {
      try { currentAudio.pause(); } catch (e) { /* 已结束 */ }
      currentAudio = null;
    }
    if (currentBtn) { _resetBtn(currentBtn); currentBtn = null; }
    currentText = '';
    if (wasActive) _broadcast('stopped', lastText); // 播放结束/停止
  }

  /**
   * 合成并播放一段讲解词
   * @param {string} text 讲解文本（≤2000 字符，超出云函数截断）
   * @param {HTMLElement|null} btn 触发按钮（用于状态回显；点击同按钮再播放=停止）
   * @param {object} [opts] { voice } 可选音色（默认 longxiaochun_v2 龙小淳）
   */
  async function speak(text, btn, opts) {
    _injectStyle();
    // 同一按钮再次点击 = 停止
    if (btn && currentBtn === btn && currentAudio) { stop(); return; }
    stop();
    currentBtn = btn || null;
    currentText = String(text || '');
    if (currentBtn) {
      if (!currentBtn.dataset.ttsLabel) currentBtn.dataset.ttsLabel = currentBtn.innerHTML;
      currentBtn.classList.add('tts-loading');
      currentBtn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> 语音合成中…';
    }
    _broadcast('loading', text); // 开始请求前
    try {
      const r = await fetch('/api/ai/tts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text: String(text || ''), voice: opts && opts.voice })
      });
      const d = await r.json().catch(() => ({}));
      if (!r.ok) throw new Error(d.error || ('HTTP ' + r.status));
      if (currentBtn !== btn) return; // 用户已切走
      const audio = new Audio(d.audioUrl);
      currentAudio = audio;
      if (currentBtn) {
        currentBtn.classList.remove('tts-loading');
        currentBtn.classList.add('tts-playing');
        currentBtn.innerHTML = '<i class="fa-solid fa-circle-pause"></i> 播放中 · 点击停止';
      }
      audio.onended = () => stop();
      audio.onerror = () => {
        if (window.showToast) showToast('语音播放失败，请重试', 'error');
        stop();
      };
      await audio.play();
      if (currentAudio === audio) _broadcast('playing', text); // Audio 播放成功后
    } catch (e) {
      console.warn('[TTSPlayer] 语音合成失败:', e && e.message);
      stop();
      _broadcast('error', text); // 请求/合成失败
      if (window.showToast) showToast('语音合成失败：' + (e && e.message || '网络异常'), 'error');
    }
  }

  // 全局事件委托：接管页面中所有 .tts-btn[data-tts-text]
  document.addEventListener('click', (e) => {
    const btn = e.target.closest('.tts-btn');
    if (!btn || !btn.dataset.ttsText) return;
    e.preventDefault();
    e.stopPropagation();
    speak(btn.dataset.ttsText, btn);
  });

  // 页面 hash 切换时停止播放（避免跨页面残留声音）
  window.addEventListener('hashchange', () => stop());

  window.TTSPlayer = { speak, stop };
})();
