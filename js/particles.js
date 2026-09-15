// ============================================================
// js/particles.js — Three.js 3D 粒子背景（性能优化版）
// 粒子颜色: 粉(#ffd1e8) / 紫(#c9b6ff) / 蓝(#a8d8ff)
// 性能优化: 自适应粒子数、低帧率降质、页面不可见时暂停、
//           降低DPR、减少每帧计算、requestAnimationFrame
//           动态导入Three.js，按需加载
// ============================================================

const Particles = {
  THREE: null,
  scene: null,
  camera: null,
  renderer: null,
  points: null,
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
  // 根据屏幕尺寸计算粒子数量（响应式自适应）
  // ----------------------------------------------------------
  _calculateParticleCount(width, height) {
    const area = width * height;
    const isMobile = width < 768;
    const isTablet = width >= 768 && width < 1024;
    const isDesktop = width >= 1024;
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

    this.isLowPerf = this._detectPerformance();
    this.currentWidth = window.innerWidth;
    this.currentHeight = window.innerHeight;

    const count = this._calculateParticleCount(this.currentWidth, this.currentHeight);

    this.scene = new this.THREE.Scene();
    this.scene.fog = new this.THREE.FogExp2(0x0a0612, 0.0008);

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
  // 创建粒子系统
  // ----------------------------------------------------------
  _createParticles(count) {
    const positions = new Float32Array(count * 3);
    const colors = new Float32Array(count * 3);
    const sizes = new Float32Array(count);

    // 三种 Dreamcore 颜色
    const palette = [
      new this.THREE.Color(0xffd1e8), // 粉
      new this.THREE.Color(0xc9b6ff), // 紫
      new this.THREE.Color(0xa8d8ff)  // 蓝
    ];

    for (let i = 0; i < count; i++) {
      const i3 = i * 3;
      // 在一个球形空间内随机分布，营造深度感
      const radius = 200 + Math.random() * 800;
      const theta = Math.random() * Math.PI * 2;
      const phi = Math.acos(2 * Math.random() - 1);
      positions[i3] = radius * Math.sin(phi) * Math.cos(theta);
      positions[i3 + 1] = radius * Math.sin(phi) * Math.sin(theta);
      positions[i3 + 2] = radius * Math.cos(phi);

      const c = palette[Math.floor(Math.random() * palette.length)];
      colors[i3] = c.r;
      colors[i3 + 1] = c.g;
      colors[i3 + 2] = c.b;

      sizes[i] = Math.random() * 3 + 0.8;
    }

    // 保存原始位置用于浮动
    this.basePositions = positions.slice();

    const geometry = new this.THREE.BufferGeometry();
    geometry.setAttribute('position', new this.THREE.BufferAttribute(positions, 3));
    geometry.setAttribute('color', new this.THREE.BufferAttribute(colors, 3));
    geometry.setAttribute('size', new this.THREE.BufferAttribute(sizes, 1));

    // 自定义着色器：圆形发光粒子
    const material = new this.THREE.ShaderMaterial({
      uniforms: {
        time: { value: 0 },
        pixelRatio: { value: Math.min(window.devicePixelRatio, 2) }
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
        void main() {
          // 圆形粒子，边缘柔和发光
          vec2 uv = gl_PointCoord - vec2(0.5);
          float d = length(uv);
          if (d > 0.5) discard;
          float alpha = smoothstep(0.5, 0.0, d);
          gl_FragColor = vec4(vColor, alpha * 0.9);
        }
      `,
      transparent: true,
      depthWrite: false,
      blending: this.THREE.AdditiveBlending
    });

    this.points = new this.THREE.Points(geometry, material);
    this.scene.add(this.points);

    // 额外：添加几束远景星云光斑（大半透明球）
    const glowGeo = new this.THREE.SphereGeometry(180, 16, 16);
    const glowMat1 = new this.THREE.MeshBasicMaterial({
      color: 0xc9b6ff, transparent: true, opacity: 0.05, depthWrite: false
    });
    const glow1 = new this.THREE.Mesh(glowGeo, glowMat1);
    glow1.position.set(-400, 200, -500);
    this.scene.add(glow1);
    const glowMat2 = new this.THREE.MeshBasicMaterial({
      color: 0xffd1e8, transparent: true, opacity: 0.05, depthWrite: false
    });
    const glow2 = new this.THREE.Mesh(glowGeo, glowMat2);
    glow2.position.set(450, -150, -600);
    this.scene.add(glow2);
  },

  // ----------------------------------------------------------
  // 动画循环（性能优化版）
  // - 页面不可见时跳过
  // - 低性能设备降低粒子浮动计算频率
  // - FPS检测动态降质
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

    this.targetX += (this.mouseX - this.targetX) * 0.04;
    this.targetY += (this.mouseY - this.targetY) * 0.04;

    if (this.points) {
      const mat = this.points.material;
      if (mat.uniforms) mat.uniforms.time.value = now * 0.001;

      this.points.rotation.y += 0.0004 + this.targetX * 0.0015;
      this.points.rotation.x += this.targetY * 0.0006;

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
    const countDiff = Math.abs(newCount - oldCount) / oldCount;

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

    // 创建新粒子系统
    this._createParticles(count);
  }
};

// 暴露为全局（向后兼容）
window.Particles = Particles;

// ES Module 导出
export default Particles;
export { Particles };
