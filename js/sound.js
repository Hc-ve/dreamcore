// ============================================================
// js/sound.js — Web Audio API 音效系统
// 纯前端合成音效，不依赖外部音频文件
// 音效类型: click(点击"叮") / hover(悬停"嗡") / pop(弹窗上下滑音)
//           like(点赞上扬) / success(成功)
// 开关存储: localStorage 'soundEnabled'
// ============================================================

const Sound = {
  // 音频上下文（首次播放时延迟创建，避免浏览器自动播放限制）
  ctx: null,
  // 是否启用音效
  enabled: true,

  // ----------------------------------------------------------
  // 初始化：读取开关状态，并自动绑定全站交互元素
  // ----------------------------------------------------------
  init() {
    const saved = localStorage.getItem('soundEnabled');
    // 默认开启，仅当显式存为 'false' 时关闭
    this.enabled = saved !== 'false';
    this.bindGlobal();
  },

  // ----------------------------------------------------------
  // 创建音频上下文（用户交互后才能正常发声）
  // ----------------------------------------------------------
  ensureContext() {
    if (!this.ctx) {
      try {
        const AC = window.AudioContext || window.webkitAudioContext;
        if (!AC) return null;
        this.ctx = new AC();
      } catch (e) {
        return null;
      }
    }
    // 若处于挂起状态（浏览器策略），尝试恢复
    if (this.ctx.state === 'suspended') {
      this.ctx.resume().catch(() => {});
    }
    return this.ctx;
  },

  // ----------------------------------------------------------
  // 设置开关
  // ----------------------------------------------------------
  setEnabled(on) {
    this.enabled = on;
    localStorage.setItem('soundEnabled', on ? 'true' : 'false');
  },

  // ----------------------------------------------------------
  // 播放音效
  // type: click / hover / pop / like / success
  // ----------------------------------------------------------
  playSound(type) {
    if (!this.enabled) return;
    const ctx = this.ensureContext();
    if (!ctx) return;

    const now = ctx.currentTime;
    const master = ctx.createGain();
    master.connect(ctx.destination);

    switch (type) {
      case 'click': {
        // 短促"叮"：高频正弦快速衰减
        this._tone(ctx, master, 1320, 0.18, 0.0001, now, 'sine', 0.18);
        this._tone(ctx, master, 1980, 0.10, 0.0001, now + 0.01, 'sine', 0.06);
        break;
      }
      case 'hover': {
        // 轻柔"嗡"：低频短促，音量小
        this._tone(ctx, master, 620, 0.12, 0.0001, now, 'sine', 0.05);
        break;
      }
      case 'pop': {
        // 上下滑音：频率从低到高再到低
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = 'sine';
        osc.frequency.setValueAtTime(420, now);
        osc.frequency.exponentialRampToValueAtTime(1400, now + 0.12);
        osc.frequency.exponentialRampToValueAtTime(680, now + 0.28);
        gain.gain.setValueAtTime(0.0001, now);
        gain.gain.exponentialRampToValueAtTime(0.14, now + 0.04);
        gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.32);
        osc.connect(gain).connect(master);
        osc.start(now);
        osc.stop(now + 0.34);
        break;
      }
      case 'like': {
        // 点赞上扬：两个上行音
        this._tone(ctx, master, 720, 0.14, 0.0001, now, 'triangle', 0.12);
        this._tone(ctx, master, 1080, 0.16, 0.0001, now + 0.08, 'triangle', 0.12);
        break;
      }
      case 'success': {
        // 成功：和弦上行
        [523, 659, 784, 1047].forEach((f, i) => {
          this._tone(ctx, master, f, 0.22, 0.0001, now + i * 0.07, 'sine', 0.10);
        });
        break;
      }
      case 'close': {
        // 关闭：下行短音
        this._tone(ctx, master, 880, 0.12, 0.0001, now, 'sine', 0.10);
        this._tone(ctx, master, 440, 0.14, 0.0001, now + 0.06, 'sine', 0.08);
        break;
      }
    }
  },

  // ----------------------------------------------------------
  // 内部：生成一个带 ADSR 的单音
  // ----------------------------------------------------------
  _tone(ctx, dest, freq, peak, floor, startAt, type = 'sine', level = 0.12) {
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(freq, startAt);
    gain.gain.setValueAtTime(floor, startAt);
    gain.gain.exponentialRampToValueAtTime(level, startAt + 0.012);
    gain.gain.exponentialRampToValueAtTime(floor, startAt + 0.16);
    osc.connect(gain).connect(dest);
    osc.start(startAt);
    osc.stop(startAt + 0.2);
  },

  // ----------------------------------------------------------
  // 全站交互元素自动绑定音效
  // 使用事件委托，动态生成元素也能生效
  // ----------------------------------------------------------
  bindGlobal() {
    // 点击：所有按钮、带 role=button、可点击卡片
    document.addEventListener('pointerdown', (e) => {
      const el = e.target.closest('button, a, [role="button"], .clickable, .artwork-card, .nav-item, .filter-chip');
      if (el) this.playSound('click');
    }, true);

    // 悬停：导航/按钮类元素
    document.addEventListener('pointerover', (e) => {
      const el = e.target.closest('button, a, .nav-item, .filter-chip, .artwork-card, .ai-fab, .icon-btn');
      if (el) this.playSound('hover');
    }, true);
  }
};

// 暴露为全局
window.Sound = Sound;

// ES Module export
export default Sound;
export { Sound };
