// ============================================================
// js/particles.js — Three.js 3D 粒子背景（性能优化版 + 主题参数化）
// 主题: 默认 / 国风 / 非遗 / 极简
// 性能优化: 自适应粒子数、低帧率降质、页面不可见时暂停、
//           降低DPR、减少每帧计算、requestAnimationFrame
//           动态导入Three.js，按需加载
// ============================================================

/**
 * 粒子主题配置（适配 Three.js 3D 系统）
 * @typedef {Object} ParticleTheme
 * @property {string} label      主题中文名
 * @property {string} icon      FontAwesome 图标类
 * @property {string[]} cssVars  读取颜色的 CSS 变量名列表（从 :root 实时取值）
 * @property {number[]} fallbackColors  CSS 变量不可用时的兜底色板
 * @property {number} particleCountMultiplier 粒子数量乘数
 * @property {number} radiusMin 球形分布最小半径
 * @property {number} radiusRange 半径浮动范围
 * @property {number} speedFactor 旋转速度系数
 * @property {number} sizeMin    粒子最小尺寸
 * @property {number} sizeRange  尺寸浮动范围
 * @property {number} glowOpacity 远景星云光斑透明度
 * @property {number} fogDensity 雾密度
 */
const PARTICLE_THEMES = {
  default: {
    label: '宣纸',
    icon: 'fa-scroll',
    // 「墨韵丹青」默认氛围：墨青 / 朱砂 / 赭石 / 石绿
    // 通过 fallbackColors 直接给定国风色板，避免读取旧粉紫变量造成气质冲突
    cssVars: [],
    fallbackColors: [0x2d4a6b, 0xa8261f, 0xb8892a, 0x4a6b52],
    particleCountMultiplier: 0.62,
    radiusMin: 220,
    radiusRange: 760,
    speedFactor: 0.42,
    sizeMin: 1.0,
    sizeRange: 3.2,
    glowOpacity: 0.035,
    lightGlowOpacity: 0.05,
    fogDensity: 0.0007,
    lightFogDensity: 0.00028,
    lightSizeBoost: 1.4
  },
  guofeng: {
    label: '国风',
    icon: 'fa-paintbrush',
    cssVars: [], // 国风用自己的色板
    fallbackColors: [0xc0392b, 0xe67e22, 0xf39c12, 0xd4a574],
    particleCountMultiplier: 0.75,
    radiusMin: 180,
    radiusRange: 700,
    speedFactor: 0.6,
    sizeMin: 1.2,
    sizeRange: 3.5,
    glowOpacity: 0.06,
    lightGlowOpacity: 0.09,
    fogDensity: 0.0009,
    lightFogDensity: 0.0003,
    lightSizeBoost: 1.5
  },
  feiyi: {
    label: '非遗',
    icon: 'fa-pattern',
    cssVars: [],
    // 朱砂 · 石青 · 缃黄 · 月白 — 传统工艺四大矿物色
    fallbackColors: [0xa8261f, 0x2d4a6b, 0xb8892a, 0x7a9a8a],
    particleCountMultiplier: 1.25,
    radiusMin: 220,
    radiusRange: 900,
    speedFactor: 0.8,
    sizeMin: 0.8,
    sizeRange: 3.2,
    glowOpacity: 0.07,
    lightGlowOpacity: 0.1,
    fogDensity: 0.0007,
    lightFogDensity: 0.0003,
    lightSizeBoost: 1.6
  },
  minimal: {
    label: '极简',
    icon: 'fa-circle',
    cssVars: [],
    fallbackColors: [0x2c3e50, 0x95a5a6, 0xbdc3c7],
    particleCountMultiplier: 0.5,
    radiusMin: 200,
    radiusRange: 800,
    speedFactor: 0.4,
    sizeMin: 0.8,
    sizeRange: 2,
    glowOpacity: 0.03,
    lightGlowOpacity: 0.05,
    fogDensity: 0.001,
    lightFogDensity: 0.0004,
    lightSizeBoost: 1.5
  }
};

let currentTheme = 'default';

/**
 * 从 CSS 变量读取颜色值，转为 0xRRGGBB 数字
 * @param {string} varName 如 '--dream-pink'
 * @returns {number|null} 0xRRGGBB 或 null
 */
function _readCSSColor(varName) {
  try {
    const raw = getComputedStyle(document.documentElement).getPropertyValue(varName).trim();
    if (!raw) return null;
    // 支持 #rgb / #rrggbb / rgb(r,g,b)
    if (raw.startsWith('#')) {
      let hex = raw.slice(1);
      if (hex.length === 3) hex = hex.split('').map(c => c + c).join('');
      if (hex.length === 6) return parseInt(hex, 16);
    }
    const m = raw.match(/rgb\(\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)/);
    if (m) {
      return ((+m[1] << 16) | (+m[2] << 8) | (+m[3])) >>> 0;
    }
  } catch (_) { /* ignore */ }
  return null;
}

/**
 * 从 CSS 变量批量读取色板，失败则用 fallbackColors
 */
function _resolvePalette(theme) {
  if (theme.cssVars && theme.cssVars.length) {
    const colors = theme.cssVars.map(v => _readCSSColor(v)).filter(c => c !== null);
    if (colors.length) return colors;
  }
  return theme.fallbackColors;
}

/**
 * 检测当前 UI 明暗主题
 */
function _isUILight() {
  const attr = document.documentElement.getAttribute('data-theme');
  if (attr === 'dark') return false;
  if (attr === 'light') return true;
  return !window.matchMedia('(prefers-color-scheme: dark)').matches;
}

/**
 * 生成主题参数（颜色从 CSS 变量读取，明暗只调整混合/尺寸/雾）
 */
function _resolveThemeParams(theme) {
  const isLight = _isUILight();
  const palette = _resolvePalette(theme);
  // 雾色从 --bg-dark 读取（亮暗不同：亮色 #f5f3fa / 暗色 #0a0612）
  const fogColor = _readCSSColor('--bg-dark') || 0x0a0612;
  const fogDensity = isLight ? (theme.lightFogDensity || theme.fogDensity) : theme.fogDensity;
  // 亮色模式下粒子放大 + NormalBlending 保证亮底可见
  const sizeMul = isLight ? (theme.lightSizeBoost || 1) : 1;
  const glowOpacity = isLight ? (theme.lightGlowOpacity || theme.glowOpacity) : theme.glowOpacity;
  const blending = isLight ? 'normal' : 'additive';
  const alphaMul = isLight ? 1.0 : 0.9;
  return { isLight, palette, fogColor, fogDensity, sizeMul, glowOpacity, blending, alphaMul };
}

/**
 * M2-1：同步风格主题到 <html data-style="...">
 * default 移除 data-style（回落到 :root 默认变量组），
 * 其余主题挂对应 style.css 变量组（guofeng / feiyi / minimal）
 * 注意：明暗主题由 settings.js applyTheme() 控制 data-theme="light|dark"，
 *       particles.js 只读取 data-theme 判断明暗，不再写入！
 */
function _syncUiTheme(key) {
  try {
    if (key && key !== 'default') {
      document.documentElement.setAttribute('data-style', key);
    } else {
      document.documentElement.removeAttribute('data-style');
    }
  } catch (e) { /* ignore */ }
}

const Particles = {
  THREE: null,
  scene: null,
  camera: null,
  renderer: null,
  points: null,
  glows: [],
  basePositions: null,
  mouseX: 0,
  mouseY: 0,
  targetX: 0,
  targetY: 0,
  rafId: null,
  canvas: null,
  isPaused: false,
  isLowPerf: false,
  frameCount: 0,
  lastFpsTime: 0,
  fps: 60,
  resizeTimer: null,
  resizeObserver: null,
  currentWidth: 0,
  currentHeight: 0,
  themeSwitcherInited: false,
  _themeObserver: null,
  _uIThemeRecreatePending: false,

  // ----------------------------------------------------------
  // 检测设备性能等级
  // ----------------------------------------------------------
  _detectPerformance() {
    const cores = navigator.hardwareConcurrency || 4;
    const memory = navigator.deviceMemory || 4;
    const isMobile = window.innerWidth < 768;
    const isLowEnd = cores <= 4 || memory <= 4 || isMobile;
    return isLowEnd;
  },

  // ----------------------------------------------------------
  // 根据屏幕尺寸计算粒子数量（响应式自适应 + 主题乘数）
  // ----------------------------------------------------------
  _calculateParticleCount(width, height) {
    const area = width * height;
    const isMobile = width < 768;
    const isTablet = width >= 768 && width < 1024;
    const isLargeDesktop = width >= 1440;

    let baseCount;
    if (isMobile) {
      baseCount = Math.min(800 + (area / 5000), 1200);
    } else if (isTablet) {
      baseCount = Math.min(1200 + (area / 6000), 1800);
    } else if (isLargeDesktop) {
      baseCount = Math.min(2200 + (area / 8000), 3200);
    } else {
      baseCount = Math.min(1800 + (area / 7000), 2500);
    }

    if (this.isLowPerf) baseCount = Math.floor(baseCount * 0.6);

    const theme = PARTICLE_THEMES[currentTheme] || PARTICLE_THEMES.default;
    baseCount = Math.floor(baseCount * theme.particleCountMultiplier);

    return Math.floor(baseCount);
  },

  // ----------------------------------------------------------
  // 初始化
  // ----------------------------------------------------------
  async init() {
    this.canvas = document.getElementById('particle-canvas');
    if (!this.canvas) return;

    try {
      this.THREE = await import('three');
    } catch (e) {
      console.warn('[Particles] Three.js load failed:', e);
      return;
    }

    // 从 localStorage 恢复主题（默认为 'default'）
    const savedRaw = localStorage.getItem('dreamcore-particle-theme');
    const savedTheme = savedRaw ? String(savedRaw).replace(/^"|"$/g, '') : null;
    if (savedTheme && PARTICLE_THEMES[savedTheme]) {
      currentTheme = savedTheme;
    }
    _syncUiTheme(currentTheme);

    this.isLowPerf = this._detectPerformance();
    this.currentWidth = window.innerWidth;
    this.currentHeight = window.innerHeight;

    const count = this._calculateParticleCount(this.currentWidth, this.currentHeight);

    this.scene = new this.THREE.Scene();
    const theme = PARTICLE_THEMES[currentTheme];
    const p = _resolveThemeParams(theme);
    this.scene.fog = new this.THREE.FogExp2(p.fogColor, p.fogDensity);

    this.camera = new this.THREE.PerspectiveCamera(
      70, this.currentWidth / this.currentHeight, 1, 2000
    );
    this.camera.position.z = 600;

    const dpr = this.isLowPerf
      ? Math.min(window.devicePixelRatio, 1)
      : Math.min(window.devicePixelRatio, 1.5);

    this.renderer = new this.THREE.WebGLRenderer({
      canvas: this.canvas,
      alpha: true,
      antialias: !this.isLowPerf,
      powerPreference: 'high-performance'
    });
    this.renderer.setPixelRatio(dpr);
    this.renderer.setSize(this.currentWidth, this.currentHeight);

    this._createParticles(count);

    // 鼠标移动监听（节流）
    let mouseThrottle = 0;
    window.addEventListener('mousemove', (e) => {
      const now = Date.now();
      if (now - mouseThrottle < 16) return;
      mouseThrottle = now;
      this.mouseX = (e.clientX / this.currentWidth) * 2 - 1;
      this.mouseY = -(e.clientY / this.currentHeight) * 2 + 1;
    }, { passive: true });

    // 窗口大小变化（防抖300ms）
    window.addEventListener('resize', () => {
      clearTimeout(this.resizeTimer);
      this.resizeTimer = setTimeout(() => this._onResize(), 300);
    });

    // 使用 ResizeObserver 监听 canvas 容器变化（处理布局变化、全屏切换等）
    if ('ResizeObserver' in window) {
      this.resizeObserver = new ResizeObserver(() => {
        clearTimeout(this.resizeTimer);
        this.resizeTimer = setTimeout(() => this._onResize(), 300);
      });
      this.resizeObserver.observe(document.body);
    }

    // 页面可见性变化：隐藏时暂停动画
    document.addEventListener('visibilitychange', () => {
      if (document.hidden) {
        this._pause();
      } else {
        this._resume();
      }
    });

    this._animate();

    // 监听 UI 明暗主题切换（data-theme 属性变化）
    try {
      this._themeObserver = new MutationObserver(() => {
        if (!this._uIThemeRecreatePending) {
          this._uIThemeRecreatePending = true;
          // 加微任务延迟避免连续切换时过度重建
          setTimeout(() => {
            this._uIThemeRecreatePending = false;
            this._applyTheme();
          }, 120);
        }
      });
      this._themeObserver.observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme'] });
      // 系统主题变化（无显式 data-theme 时）
      window.matchMedia('(prefers-color-scheme: dark)').addEventListener?.('change', () => {
        if (!localStorage.getItem('dreamcore-theme')) {
          this._applyTheme();
        }
      });
    } catch (_) { /* ignore */ }

    // 主题切换 UI（等 DOM 完全就绪后挂载）
    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', () => this._initThemeSwitcher());
    } else {
      this._initThemeSwitcher();
    }
  },

  // ----------------------------------------------------------
  // 暂停动画
  // ----------------------------------------------------------
  _pause() {
    this.isPaused = true;
  },

  // ----------------------------------------------------------
  // 恢复动画
  // ----------------------------------------------------------
  _resume() {
    this.isPaused = false;
    this.lastFpsTime = performance.now();
  },

  // ----------------------------------------------------------
  // 创建粒子系统（主题化 + 明暗自适应）
  // ----------------------------------------------------------
  _createParticles(count) {
    const theme = PARTICLE_THEMES[currentTheme] || PARTICLE_THEMES.default;
    const p = _resolveThemeParams(theme);
    const positions = new Float32Array(count * 3);
    const colors = new Float32Array(count * 3);
    const sizes = new Float32Array(count);

    const palette = p.palette.map(c => new this.THREE.Color(c));

    for (let i = 0; i < count; i++) {
      const i3 = i * 3;
      // 在一个球形空间内随机分布，营造深度感
      const radius = theme.radiusMin + Math.random() * theme.radiusRange;
      const theta = Math.random() * Math.PI * 2;
      const phi = Math.acos(2 * Math.random() - 1);
      positions[i3] = radius * Math.sin(phi) * Math.cos(theta);
      positions[i3 + 1] = radius * Math.sin(phi) * Math.sin(theta);
      positions[i3 + 2] = radius * Math.cos(phi);

      const c = palette[Math.floor(Math.random() * palette.length)];
      colors[i3] = c.r;
      colors[i3 + 1] = c.g;
      colors[i3 + 2] = c.b;

      sizes[i] = (Math.random() * theme.sizeRange + theme.sizeMin) * p.sizeMul;
    }

    // 保存原始位置用于浮动
    this.basePositions = positions.slice();

    const geometry = new this.THREE.BufferGeometry();
    geometry.setAttribute('position', new this.THREE.BufferAttribute(positions, 3));
    geometry.setAttribute('color', new this.THREE.BufferAttribute(colors, 3));
    geometry.setAttribute('size', new this.THREE.BufferAttribute(sizes, 1));

    // 自定义着色器：圆形发光粒子（亮色模式增强 alpha）
    const blendMode = p.blending === 'normal'
      ? this.THREE.NormalBlending
      : this.THREE.AdditiveBlending;

    const material = new this.THREE.ShaderMaterial({
      uniforms: {
        time: { value: 0 },
        pixelRatio: { value: Math.min(window.devicePixelRatio, 2) },
        alphaMul: { value: p.alphaMul }
      },
      vertexShader: `
        attribute float size;
        attribute vec3 color;
        varying vec3 vColor;
        uniform float time;
        uniform float pixelRatio;
        void main() {
          vColor = color;
          vec3 pos = position;
          // 轻微呼吸缩放
          float pulse = sin(time * 0.8 + position.x * 0.01) * 6.0;
          pos.z += pulse;
          vec4 mvPosition = modelViewMatrix * vec4(pos, 1.0);
          gl_PointSize = size * pixelRatio * (300.0 / -mvPosition.z);
          gl_Position = projectionMatrix * mvPosition;
        }
      `,
      fragmentShader: `
        varying vec3 vColor;
        uniform float alphaMul;
        void main() {
          vec2 uv = gl_PointCoord - vec2(0.5);
          float d = length(uv);
          if (d > 0.5) discard;
          float alpha = smoothstep(0.5, 0.0, d);
          gl_FragColor = vec4(vColor, alpha * alphaMul);
        }
      `,
      transparent: true,
      depthWrite: false,
      blending: blendMode
    });

    this.points = new this.THREE.Points(geometry, material);
    this.scene.add(this.points);

    // 远景星云光斑（色板首两色，与粒子同源）
    const glowGeo = new this.THREE.SphereGeometry(180, 16, 16);
    const glowMat1 = new this.THREE.MeshBasicMaterial({
      color: palette[0], transparent: true, opacity: p.glowOpacity, depthWrite: false
    });
    const glow1 = new this.THREE.Mesh(glowGeo, glowMat1);
    glow1.position.set(-400, 200, -500);
    this.scene.add(glow1);
    this.glows.push(glow1);
    const glowMat2 = new this.THREE.MeshBasicMaterial({
      color: palette[palette.length - 1],
      transparent: true, opacity: p.glowOpacity, depthWrite: false
    });
    const glow2 = new this.THREE.Mesh(glowGeo, glowMat2);
    glow2.position.set(450, -150, -600);
    this.scene.add(glow2);
    this.glows.push(glow2);
  },

  // ----------------------------------------------------------
  // 动画循环（性能优化版 + 主题速度系数）
  // ----------------------------------------------------------
  _animate() {
    this.rafId = requestAnimationFrame(() => this._animate());

    if (this.isPaused) return;

    const now = performance.now();
    this.frameCount++;

    if (now - this.lastFpsTime >= 1000) {
      this.fps = this.frameCount;
      this.frameCount = 0;
      this.lastFpsTime = now;

      if (this.fps < 30 && !this.isLowPerf) {
        this.isLowPerf = true;
      }
    }

    const theme = PARTICLE_THEMES[currentTheme] || PARTICLE_THEMES.default;
    const sf = theme.speedFactor;

    this.targetX += (this.mouseX - this.targetX) * 0.04;
    this.targetY += (this.mouseY - this.targetY) * 0.04;

    if (this.points) {
      const mat = this.points.material;
      if (mat.uniforms) mat.uniforms.time.value = now * 0.001;

      this.points.rotation.y += (0.0004 + this.targetX * 0.0015) * sf;
      this.points.rotation.x += this.targetY * 0.0006 * sf;

      const skipFrames = this.isLowPerf ? 3 : 1;
      if (this.frameCount % skipFrames === 0) {
        const pos = this.points.geometry.attributes.position;
        const base = this.basePositions;
        const t = now * 0.0002;
        const step = this.isLowPerf ? 2 : 1;
        for (let i = 0; i < pos.count; i += step) {
          const i3 = i * 3;
          pos.array[i3 + 1] = base[i3 + 1] + Math.sin(t * 3 + i * 0.1) * 3;
        }
        pos.needsUpdate = true;
      }
    }

    this.camera.position.x += (this.targetX * 50 - this.camera.position.x) * 0.025;
    this.camera.position.y += (this.targetY * 35 - this.camera.position.y) * 0.025;
    this.camera.lookAt(this.scene.position);

    this.renderer.render(this.scene, this.camera);
  },

  // ----------------------------------------------------------
  // 响应式：窗口大小变化（完整适配）
  // ----------------------------------------------------------
  _onResize() {
    if (!this.camera || !this.renderer) return;

    const newWidth = window.innerWidth;
    const newHeight = window.innerHeight;

    // 忽略微小变化（小于1%）
    const widthDiff = Math.abs(newWidth - this.currentWidth) / this.currentWidth;
    const heightDiff = Math.abs(newHeight - this.currentHeight) / this.currentHeight;
    if (widthDiff < 0.01 && heightDiff < 0.01) return;

    this.currentWidth = newWidth;
    this.currentHeight = newHeight;

    // 更新相机宽高比
    this.camera.aspect = newWidth / newHeight;
    this.camera.updateProjectionMatrix();

    // 更新渲染器尺寸
    this.renderer.setSize(newWidth, newHeight);

    // 更新着色器中的 pixelRatio 均匀变量
    if (this.points && this.points.material && this.points.material.uniforms) {
      this.points.material.uniforms.pixelRatio.value = Math.min(window.devicePixelRatio, 2);
    }

    // 响应式调整粒子数量（跨断点时重新创建粒子系统）
    const oldCount = this.points ? this.points.geometry.attributes.position.count : 0;
    const newCount = this._calculateParticleCount(newWidth, newHeight);
    const countDiff = oldCount > 0 ? Math.abs(newCount - oldCount) / oldCount : 1;

    // 当粒子数量变化超过20%或跨断点时，重新创建粒子系统
    if (countDiff > 0.2 && oldCount > 0) {
      this._recreateParticles(newCount);
    }
  },

  // ----------------------------------------------------------
  // 重新创建粒子系统（响应式调整数量时调用）
  // ----------------------------------------------------------
  _recreateParticles(count) {
    if (!this.scene || !this.points) return;

    // 移除旧粒子系统
    this.scene.remove(this.points);
    this.points.geometry.dispose();
    if (this.points.material) {
      this.points.material.dispose();
    }
    this.points = null;

    // 移除旧光斑
    this.glows.forEach(g => {
      this.scene.remove(g);
      if (g.geometry) g.geometry.dispose();
      if (g.material) g.material.dispose();
    });
    this.glows = [];

    // 创建新粒子系统
    this._createParticles(count);
  },

  // ----------------------------------------------------------
  // 应用当前主题（重建粒子系统与光斑）
  // ----------------------------------------------------------
  _applyTheme() {
    if (!this.scene || !this.THREE) return;

    const theme = PARTICLE_THEMES[currentTheme] || PARTICLE_THEMES.default;
    const p = _resolveThemeParams(theme);

    // 更新 fog（跟随明暗模式）
    if (this.scene.fog) {
      this.scene.fog.color.setHex(p.fogColor);
      this.scene.fog.density = p.fogDensity;
    }

    // 移除旧光斑
    this.glows.forEach(g => {
      this.scene.remove(g);
      if (g.geometry) g.geometry.dispose();
      if (g.material) g.material.dispose();
    });
    this.glows = [];

    // 移除旧粒子系统
    if (this.points) {
      this.scene.remove(this.points);
      if (this.points.geometry) this.points.geometry.dispose();
      if (this.points.material) this.points.material.dispose();
      this.points = null;
    }

    // 重建
    const count = this._calculateParticleCount(this.currentWidth, this.currentHeight);
    this._createParticles(count);
  },

  // ----------------------------------------------------------
  // 切换主题
  // @param {string} themeKey 主题键
  // @returns {boolean} 是否切换成功
  // ----------------------------------------------------------
  setTheme(themeKey) {
    if (!PARTICLE_THEMES[themeKey]) return false;

    const changed = currentTheme !== themeKey;
    currentTheme = themeKey;
    try {
      localStorage.setItem('dreamcore-particle-theme', themeKey);
    } catch (e) { /* ignore */ }

    _syncUiTheme(themeKey);                       // ★ 无条件同步 data-style（修复早退盲区）

    // 同步 UI 高亮
    document.querySelectorAll('.particle-theme-switcher .theme-chip').forEach(btn => {
      btn.classList.toggle('active', btn.dataset.theme === themeKey);
    });

    if (changed) this._applyTheme();              // 仅主题变化时重建粒子
    return true;
  },

  // ----------------------------------------------------------
  // 返回可用主题列表
  // @returns {Array<{key:string,label:string,icon:string}>}
  // ----------------------------------------------------------
  getThemes() {
    return Object.entries(PARTICLE_THEMES).map(([key, t]) => ({
      key, label: t.label, icon: t.icon
    }));
  },

  // ----------------------------------------------------------
  // 初始化主题切换 UI
  // - 若 HTML 中已存在 #particle-theme-switcher 则直接绑定
  // - 否则在 navbar 内动态创建（复用 .glass / .btn-ghost 风格）
  // ----------------------------------------------------------
  _initThemeSwitcher() {
    if (this.themeSwitcherInited) return;
    this.themeSwitcherInited = true;

    // 设置模块接管了风格主题切换：不在 navbar 创建 switcher，只在全局暴露 API
    // Settings 外观 Tab 会通过 Particles.setTheme() 调用
    try {
      const navbar = document.getElementById('particle-theme-switcher');
      if (navbar) { navbar.style.display = 'none'; }
    } catch {}
    // 仍然绑定已存在的（如果 HTML 里有），但不主动创建
  }
};

// 暴露为全局（向后兼容）
window.Particles = Particles;

// ES Module 导出
export default Particles;
export { Particles, PARTICLE_THEMES };
/**
 * 切换粒子主题
 * @param {string} themeKey 主题键（default/guofeng/feiyi/minimal）
 * @returns {boolean} 是否切换成功
 */
export function setTheme(themeKey) {
  return Particles.setTheme(themeKey);
}
/**
 * 获取可用主题列表
 * @returns {Array<{key:string,label:string,icon:string}>}
 */
export function getThemes() {
  return Particles.getThemes();
}
/**
 * 当前主题键
 * @returns {string}
 */
export function currentThemeKey() {
  return currentTheme;
}
