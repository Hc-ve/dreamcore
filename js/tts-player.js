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
  let currentState = 'idle'; // idle | loading | playing | stopped | error
  let currentSource = '';    // 本次讲解发起的路由 hash（供「小梦」挂件点击返回讲解页）
  let gen = 0;               // 代际计数：stop() 自增，用于让在途的 speak 静默作废
  let abortCtrl = null;      // 取消在途 /api/ai/tts 请求
  let timeoutTimer = 0;      // 合成超时兜底
  let styleInjected = false;

  const DEFAULT_LABEL = '<i class="fa-solid fa-volume-high"></i> 语音讲解';

  // 合成超时兜底（仅用于拦截"请求彻底挂死"的极端情况，绝不掐断正常的长文本合成）
  // 实测 cosyvoice-v2 同步接口约 110ms/字（313 字 ≈ 34s），故按文本长度动态放宽：
  //   15s 基础（覆盖冷启动） + 150ms/字（约 40% 余量），下限 30s、上限 180s
  const SYNTH_TIMEOUT_BASE_MS = 15000;
  const SYNTH_TIMEOUT_PER_CHAR_MS = 150;
  const SYNTH_TIMEOUT_MIN_MS = 30000;
  const SYNTH_TIMEOUT_MAX_MS = 180000;
  function _synthTimeoutMs(text) {
    const n = String(text == null ? '' : text).length;
    const ms = SYNTH_TIMEOUT_BASE_MS + n * SYNTH_TIMEOUT_PER_CHAR_MS;
    return Math.min(SYNTH_TIMEOUT_MAX_MS, Math.max(SYNTH_TIMEOUT_MIN_MS, ms));
  }

  function _injectStyle() {
    if (styleInjected) return;
    styleInjected = true;
    const st = document.createElement('style');
    st.id = 'tts-player-style';
    st.textContent = `
      .tts-btn { cursor: pointer; }
      /* 加载态保持可点击：允许用户在「语音合成中…」阶段取消 */
      .tts-btn.tts-loading { opacity: .7; }
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
      document.dispatchEvent(new CustomEvent('tts-state', {
        detail: { state, text: String(text == null ? '' : text), hash: currentSource }
      }));
    } catch (_) { /* 广播失败不影响播放 */ }
  }

  /** 停止当前播放并复位按钮（对外：TTSPlayer.stop()）
   *  同时作废在途请求（gen 自增）与超时计时器。 */
  function stop() {
    const wasActive = !!(currentAudio || currentBtn || currentState === 'loading');
    const lastText = currentText;
    gen++; // 作废在途 speak：其后续步骤会因代际不符而静默退出
    if (timeoutTimer) { clearTimeout(timeoutTimer); timeoutTimer = 0; }
    if (abortCtrl) { try { abortCtrl.abort(); } catch (_) {} abortCtrl = null; }
    if (currentAudio) {
      try { currentAudio.pause(); } catch (e) { /* 已结束 */ }
      currentAudio = null;
    }
    // 按钮可能已随 modal 关闭而从 DOM 移除（悬空引用），操作前须判存活
    if (currentBtn && document.contains(currentBtn)) _resetBtn(currentBtn);
    currentBtn = null;
    currentText = '';
    if (wasActive) { currentState = 'stopped'; _broadcast('stopped', lastText); }
  }

  /**
   * 合成并播放一段讲解词
   * @param {string} text 讲解文本（≤2000 字符，超出云函数截断）
   * @param {HTMLElement|null} btn 触发按钮（用于状态回显；点击同按钮再播放=停止）
   * @param {object} [opts] { voice } 可选音色（默认 longxiaochun_v2 龙小淳）
   */
  async function speak(text, btn, opts) {
    _injectStyle();
    // 同一按钮再次点击（合成中或播放中）= 取消 / 停止
    if (btn && currentBtn === btn) { stop(); return; }
    stop();
    const myGen = gen; // stop() 已使 gen 自增，此处捕获本次调用的代际
    currentBtn = btn || null;
    currentText = String(text || '');
    currentSource = window.location.hash || '';
    if (currentBtn) {
      if (!currentBtn.dataset.ttsLabel) currentBtn.dataset.ttsLabel = currentBtn.innerHTML;
      currentBtn.classList.add('tts-loading');
      currentBtn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> 语音合成中…（点击取消）';
    }
    currentState = 'loading';
    _broadcast('loading', text); // 开始请求前
    const timeoutMs = _synthTimeoutMs(text);
    let timedOut = false; // 本次 abort 是否由超时兜底触发（用于区分"用户取消"与"超时"）
    abortCtrl = (typeof AbortController !== 'undefined') ? new AbortController() : null;
    timeoutTimer = setTimeout(() => {
      timedOut = true;
      try { abortCtrl && abortCtrl.abort(); } catch (_) {}
    }, timeoutMs);
    try {
      const r = await fetch('/api/ai/tts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text: String(text || ''), voice: opts && opts.voice }),
        signal: abortCtrl ? abortCtrl.signal : undefined
      });
      if (timeoutTimer) { clearTimeout(timeoutTimer); timeoutTimer = 0; }
      if (myGen !== gen) return; // 用户已取消/切走
      const d = await r.json().catch(() => ({}));
      if (!r.ok) throw new Error(d.error || ('HTTP ' + r.status));
      if (myGen !== gen || currentBtn !== btn) return; // 用户已切走
      const audio = new Audio(d.audioUrl);
      currentAudio = audio;
      if (currentBtn && document.contains(currentBtn)) {
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
      if (myGen === gen && currentAudio === audio) { currentState = 'playing'; _broadcast('playing', text); } // Audio 播放成功后
    } catch (e) {
      if (myGen !== gen) return; // 已被 stop()（用户主动取消）作废，静默退出
      if (timeoutTimer) { clearTimeout(timeoutTimer); timeoutTimer = 0; }
      // AbortError 只可能来自「超时兜底」或「用户取消」，而用户取消已被上方代际守卫拦下；
      // 故此处一律按超时处理，给用户可读文案（而非直出 "signal is aborted without reason"）
      const aborted = (e && e.name === 'AbortError') || /aborted/i.test(String((e && e.message) || ''));
      const msg = aborted
        ? `语音合成超时（文本较长，已等待 ${Math.round(timeoutMs / 1000)} 秒），请重试`
        : ((e && e.message) || '网络异常');
      console.warn('[TTSPlayer] 语音合成失败:', aborted ? 'timeout' : (e && e.message));
      stop();
      _broadcast('error', text); // 请求/合成失败
      if (window.showToast) showToast('语音合成失败：' + msg, 'error');
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

  window.TTSPlayer = {
    speak,
    stop,
    /** 当前讲解状态（供「小梦」挂件判断是否处于讲解中） */
    getState: () => currentState,
    /** 本次讲解发起的路由 hash（点击挂件可返回该页） */
    getSource: () => currentSource,
    /** 指定文本的合成超时兜底毫秒数（按文本长度放宽，供排查/回归断言） */
    getTimeoutMs: (text) => _synthTimeoutMs(text)
  };
})();
