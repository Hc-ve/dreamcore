// ============================================================
// 手势像素交互 — 主应用 (v2)
// 触屏支持 · 小屏适配 · 纯Canvas HUD
// ============================================================

const CONTENT_SETS = [
  { text: 'I Love You', color: '#ff2d7b', glowColor: '#ff2d7b66', hasHeart: true, heartColor: '#ff2d7b' },
  { text: 'Hello',      color: '#00ffc8', glowColor: '#00ffc866', hasHeart: false },
  { text: '蔡豆',        color: '#ffd700', glowColor: '#ffd70066', hasHeart: false }
];

class GestureApp {
  constructor(canvas) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d');
    this._resize();

    this.engine = new PixelEngine(this.canvas);
    this.tracker = null;

    this.currentSet = 0;
    this.particles = [];
    this.heartParticles = [];
    this.interactionCount = 0;
    this.phase = 'loading';
    this.handData = null;
    this.cameraReady = false;

    this.prevIsOpen = null;
    this.handFrameCount = 0;

    this.stars = [];
    this.balloons = [];
    this.statusText = '初始化中...';

    this.startTime = Date.now();
    this.transitionStart = 0;
    this.endingStart = 0;
    this._rafId = null;

    // ── 鼠标输入 ──
    this.pointerX = this.canvas.width / 2;
    this.pointerY = this.canvas.height / 2;
    this.pointerDown = false;

    this.canvas.addEventListener('mousemove', e => {
      this.pointerX = e.clientX;
      this.pointerY = e.clientY;
    });
    this.canvas.addEventListener('mousedown', () => this.pointerDown = true);
    this.canvas.addEventListener('mouseup',   () => this.pointerDown = false);

    // ── 触屏输入（优化2）──
    this.canvas.addEventListener('touchstart', e => {
      e.preventDefault();
      this.pointerDown = true;
      const t = e.touches[0];
      this.pointerX = t.clientX;
      this.pointerY = t.clientY;
    }, { passive: false });

    this.canvas.addEventListener('touchmove', e => {
      e.preventDefault();
      const t = e.touches[0];
      this.pointerX = t.clientX;
      this.pointerY = t.clientY;
    }, { passive: false });

    this.canvas.addEventListener('touchend', e => {
      e.preventDefault();
      this.pointerDown = false;
    }, { passive: false });

    window.addEventListener('resize', () => this._resize());
  }

  _resize() {
    this.canvas.width  = window.innerWidth;
    this.canvas.height = window.innerHeight;
  }

  // ----------------------------------------------------------
  // 启动
  // ----------------------------------------------------------
  async init() {
    this.initStars(200);
    this.loadContentSet(0);
    this.startAnimationLoop();
    this.phase = 'playing';
    this.statusText = '正在初始化摄像头...';

    try {
      await this._initCamera();
      this.cameraReady = true;
      this.statusText = '张开手掌开始互动';
    } catch (err) {
      console.warn('摄像头初始化失败:', err.message);
      this.cameraReady = false;
      this.statusText = '用手指/鼠标互动（按住=张开）';
    }
  }

  async _initCamera() {
    const video = document.getElementById('video');
    if (!video) throw new Error('video 元素不存在');
    if (typeof Hands === 'undefined' || typeof Camera === 'undefined') {
      throw new Error('MediaPipe 未加载');
    }

    this.tracker = new HandTracker(video);
    this.tracker.onHandDetected(data => {
      this.handData = data;
      if (!this.cameraReady) {
        this.cameraReady = true;
        this.statusText = '已检测到手部 — 张开手掌开始互动';
      }
    });
    await this.tracker.start();

    const previewVideo = document.getElementById('cam-preview-video');
    if (previewVideo && video.srcObject) {
      previewVideo.srcObject = video.srcObject;
    }
  }

  // ----------------------------------------------------------
  // 内容加载（优化3：小屏文字适配）
  // ----------------------------------------------------------
  loadContentSet(index) {
    const set = CONTENT_SETS[index];
    this.currentSet = index;

    // 小屏适配：最小36px，最大120px
    const fontSize = Math.max(36, Math.min(120, this.canvas.width / 5));

    this.particles = this.engine.textToParticles(set.text, {
      color: set.color,
      x: this.canvas.width / 2,
      y: this.canvas.height / 2,
      fontSize: fontSize,
      pixelStep: this.canvas.width < 500 ? 2 : 3 // 小屏用更细的粒子
    });

    if (set.hasHeart) {
      const heartScale = Math.max(2, Math.min(4, this.canvas.width / 300));
      this.heartParticles = this.engine.heartToParticles(
        this.canvas.width / 2,
        this.canvas.height * 0.62,
        heartScale,
        set.heartColor
      );
    } else {
      this.heartParticles = [];
    }

    this.interactionCount = 0;
    this.prevIsOpen = null;
    this.handFrameCount = 0;
  }

  // ----------------------------------------------------------
  // 动画循环
  // ----------------------------------------------------------
  startAnimationLoop() {
    const loop = () => {
      this._rafId = requestAnimationFrame(loop);
      this._render();
    };
    loop();
  }

  _render() {
    const ctx = this.ctx;
    const w = this.canvas.width;
    const h = this.canvas.height;
    const elapsed = (Date.now() - this.startTime) / 1000;

    // 拖尾残影
    ctx.fillStyle = 'rgba(10,10,20,0.12)';
    ctx.fillRect(0, 0, w, h);

    // 背景
    this._drawGrid(ctx, w, h, elapsed);
    this.drawStars(ctx, elapsed);

    // 手势
    const hand = this._getEffectiveHand();

    if (this.phase === 'playing') {
      const set = CONTENT_SETS[this.currentSet];
      this.engine.update(this.particles, hand);
      this.engine.render(ctx, this.particles, set.color, set.glowColor);
      if (set.hasHeart && this.heartParticles.length > 0) {
        this.engine.update(this.heartParticles, hand);
        this.engine.render(ctx, this.heartParticles, set.heartColor, set.heartColor + '66');
      }
      this.checkInteractionCycle(hand);
      if (this.interactionCount >= 2) {
        if (this.currentSet < CONTENT_SETS.length - 1) {
          this.phase = 'transitioning';
          this.transitionStart = Date.now();
        } else {
          this.startEnding();
        }
      }
    }

    if (this.phase === 'transitioning') {
      const dt = (Date.now() - this.transitionStart) / 1000;
      this._scatterParticles(this.particles, dt);
      if (this.heartParticles.length > 0) this._scatterParticles(this.heartParticles, dt);
      const set = CONTENT_SETS[this.currentSet];
      this.engine.render(ctx, this.particles, set.color, set.glowColor);
      if (set.hasHeart) this.engine.render(ctx, this.heartParticles, set.heartColor, set.heartColor + '66');
      if (dt >= 1.5) {
        this.loadContentSet(this.currentSet + 1);
        this.phase = 'playing';
      }
    }

    if (this.phase === 'ending') {
      const dt = (Date.now() - this.endingStart) / 1000;
      this._updateBalloons();
      this._drawBalloons(ctx);
      this.engine.update(this.particles, hand);
      this.engine.render(ctx, this.particles, '#ff2d7b', '#ff2d7b66');
      if (dt >= 6) this.reset();
    }

    // 纯Canvas HUD（优化5：移除DOM依赖）
    this._drawHUD(ctx);
  }

  // ----------------------------------------------------------
  // 手势数据：摄像头优先，指针回退（鼠标+触屏）
  // ----------------------------------------------------------
  _getEffectiveHand() {
    if (this.handData) return this.handData;
    return {
      landmarks: null,
      isOpen: this.pointerDown,
      palmCenter: {
        x: this.pointerX / this.canvas.width,
        y: this.pointerY / this.canvas.height
      }
    };
  }

  // ----------------------------------------------------------
  // 交互计数
  // ----------------------------------------------------------
  checkInteractionCycle(hand) {
    if (!hand) return;
    this.handFrameCount++;
    const isOpen = hand.isOpen;
    if (this.handFrameCount < 30) { this.prevIsOpen = isOpen; return; }
    if (this.prevIsOpen === true && isOpen === false) this.interactionCount++;
    this.prevIsOpen = isOpen;
  }

  // ----------------------------------------------------------
  // 星空
  // ----------------------------------------------------------
  initStars(count) {
    this.stars = [];
    for (let i = 0; i < count; i++) {
      this.stars.push({
        x: Math.random() * this.canvas.width,
        y: Math.random() * this.canvas.height,
        size: 0.5 + Math.random() * 1.5,
        alpha: 0.15 + Math.random() * 0.35,
        speed: 0.3 + Math.random() * 2
      });
    }
  }

  drawStars(ctx, time) {
    for (const s of this.stars) {
      const a = Math.max(0.05, s.alpha + Math.sin(time * s.speed + s.x) * 0.2);
      ctx.beginPath();
      ctx.arc(s.x, s.y, s.size, 0, Math.PI * 2);
      ctx.fillStyle = `rgba(255,255,255,${a})`;
      ctx.fill();
    }
  }

  // ----------------------------------------------------------
  // 收尾
  // ----------------------------------------------------------
  startEnding() {
    this.phase = 'ending';
    this.endingStart = Date.now();
    this.balloons = this.engine.generateBalloons(30, this.canvas.width, this.canvas.height);
    const fontSize = Math.max(36, Math.min(120, this.canvas.width / 5));
    this.particles = this.engine.textToParticles('I Love You', {
      color: '#ff2d7b', x: this.canvas.width / 2, y: this.canvas.height / 2,
      fontSize: fontSize, pixelStep: this.canvas.width < 500 ? 2 : 3
    });
    this.statusText = '💕';
  }

  reset() {
    this.currentSet = 0;
    this.interactionCount = 0;
    this.particles = [];
    this.heartParticles = [];
    this.balloons = [];
    this.prevIsOpen = null;
    this.handFrameCount = 0;
    this.handData = null;
    this.phase = 'playing';
    this.loadContentSet(0);
    this.statusText = this.cameraReady ? '已重置 — 张开手掌开始互动' : '已重置 — 用手指/鼠标互动';
  }

  // ----------------------------------------------------------
  // 粒子散射
  // ----------------------------------------------------------
  _scatterParticles(particles, dt) {
    for (const p of particles) {
      if (!p._scatterAngle) p._scatterAngle = Math.random() * Math.PI * 2;
      p.x += Math.cos(p._scatterAngle) * 8 * (1 + dt * 3);
      p.y += Math.sin(p._scatterAngle) * 8 * (1 + dt * 3);
      p.alpha = Math.max(0, 1 - dt * 0.8);
    }
  }

  // ----------------------------------------------------------
  // 气球
  // ----------------------------------------------------------
  _updateBalloons() {
    for (const b of this.balloons) {
      b.y -= (b.speed || 1.5) * 0.8;
      b.x += Math.sin(Date.now() * 0.001 * (b.wobble || 1) + (b.phase || 0)) * 0.5;
    }
  }

  _drawBalloons(ctx) {
    for (const b of this.balloons) {
      if (b.y < -50) continue;
      ctx.save();
      ctx.globalAlpha = b.alpha || 0.8;
      ctx.beginPath();
      ctx.ellipse(b.x, b.y, (b.w || 20) / 2, (b.h || 28) / 2, 0, 0, Math.PI * 2);
      ctx.fillStyle = b.color || '#ff6b9d';
      ctx.fill();
      ctx.beginPath();
      ctx.moveTo(b.x, b.y + (b.h || 28) / 2);
      ctx.lineTo(b.x, b.y + (b.h || 28) / 2 + 12);
      ctx.strokeStyle = 'rgba(255,255,255,0.25)';
      ctx.lineWidth = 1;
      ctx.stroke();
      ctx.restore();
    }
  }

  // ----------------------------------------------------------
  // 背景网格（赛博朋克）
  // ----------------------------------------------------------
  _drawGrid(ctx, w, h, t) {
    ctx.save();
    ctx.strokeStyle = 'rgba(0,255,200,0.03)';
    ctx.lineWidth = 0.5;
    const gs = 60;
    const ox = (t * 8) % gs;
    const oy = (t * 5) % gs;
    for (let x = -gs + ox; x < w + gs; x += gs) {
      ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, h); ctx.stroke();
    }
    for (let y = -gs + oy; y < h + gs; y += gs) {
      ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(w, y); ctx.stroke();
    }
    const cx = w / 2, cy = h / 2;
    ctx.strokeStyle = 'rgba(0,255,200,0.06)';
    ctx.lineWidth = 1;
    ctx.beginPath(); ctx.moveTo(cx - 20, cy); ctx.lineTo(cx + 20, cy); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(cx, cy - 20); ctx.lineTo(cx, cy + 20); ctx.stroke();
    ctx.restore();
  }

  // ----------------------------------------------------------
  // 纯Canvas HUD（优化5：统一状态文字）
  // ----------------------------------------------------------
  _drawHUD(ctx) {
    const w = this.canvas.width;
    const fontSize = w < 500 ? 12 : 15;
    const font = `${fontSize}px "PingFang SC","Microsoft YaHei",sans-serif`;

    // 左上：状态
    ctx.save();
    ctx.font = font;
    ctx.fillStyle = 'rgba(255,255,255,0.55)';
    ctx.textAlign = 'left';
    ctx.fillText(this.statusText, 20, 32);
    ctx.restore();

    // 右上：进度
    if (this.phase === 'playing' || this.phase === 'transitioning') {
      ctx.save();
      ctx.font = font;
      ctx.fillStyle = 'rgba(255,255,255,0.35)';
      ctx.textAlign = 'right';
      ctx.fillText(`${this.currentSet + 1} / ${CONTENT_SETS.length}`, w - 20, 32);
      ctx.restore();
    }

    // 底部：操作提示
    if (this.phase === 'playing') {
      ctx.save();
      ctx.font = `${fontSize - 2}px "PingFang SC","Microsoft YaHei",sans-serif`;
      ctx.fillStyle = 'rgba(255,255,255,0.2)';
      ctx.textAlign = 'center';
      const hint = this.cameraReady ? '张开手掌 → 握拳' : (w < 500 ? '按住屏幕 = 张开' : '鼠标点击 = 张开，松开 = 握拳');
      ctx.fillText(hint, w / 2, this.canvas.height - 24);
      ctx.restore();
    }
  }
}

window.GestureApp = GestureApp;

// ============================================================
// 启动
// ============================================================
document.addEventListener('DOMContentLoaded', async () => {
  const canvas = document.getElementById('main-canvas');
  if (!canvas) { console.error('找不到 #main-canvas'); return; }
  const app = new GestureApp(canvas);
  await app.init();
});
