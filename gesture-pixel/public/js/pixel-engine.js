/**
 * PixelEngine — 像素粒子渲染引擎 (v2 性能优化版)
 * 粒子发光 · 空间哈希连线 · 脉冲呼吸 · 心形线
 */

class PixelParticle {
  constructor(x, y, color, size = 3) {
    this.x = x;  this.y = y;
    this.targetX = x;  this.targetY = y;
    this.vx = 0;  this.vy = 0;
    this.color = color;
    this.alpha = 1;
    this.baseAlpha = 1;
    this.size = size;
    this.stiffness = 0.04;
    this.damping = 0.82;
    this.phase = Math.random() * Math.PI * 2;
  }
}

// ── 空间哈希网格（Spatial Hash Grid）────────────────────────
class SpatialGrid {
  constructor(cellSize) {
    this.cellSize = cellSize;
    this.invCellSize = 1 / cellSize;
    this.cells = new Map();
  }

  clear() {
    this.cells.clear();
  }

  _key(cx, cy) {
    return (cx * 73856093) ^ (cy * 19349663); // hash
  }

  insert(particle, index) {
    const cx = (particle.x * this.invCellSize) | 0;
    const cy = (particle.y * this.invCellSize) | 0;
    const key = this._key(cx, cy);
    let cell = this.cells.get(key);
    if (!cell) { cell = []; this.cells.set(key, cell); }
    cell.push(index);
  }

  // 遍历粒子及其所有邻居（同一格 + 相邻8格）
  forEachNeighbor(particles, callback) {
    const cs = this.cellSize;
    const inv = this.invCellSize;
    // 先插入所有粒子
    this.clear();
    for (let i = 0; i < particles.length; i++) {
      this.insert(particles[i], i);
    }
    // 再遍历邻居
    const visited = new Set();
    for (let i = 0; i < particles.length; i++) {
      const a = particles[i];
      const cx = (a.x * inv) | 0;
      const cy = (a.y * inv) | 0;
      for (let dx = -1; dx <= 1; dx++) {
        for (let dy = -1; dy <= 1; dy++) {
          const key = this._key(cx + dx, cy + dy);
          const cell = this.cells.get(key);
          if (!cell) continue;
          for (const j of cell) {
            if (j <= i) continue; // 避免重复
            const pairKey = i * 100000 + j;
            if (visited.has(pairKey)) continue;
            visited.add(pairKey);
            callback(a, particles[j], i, j);
          }
        }
      }
    }
  }
}

// ── PixelEngine ─────────────────────────────────────────────
class PixelEngine {
  constructor(canvas) {
    this.canvas = canvas;
    this.time = 0;
    this.grid = new SpatialGrid(35); // 35px 网格单元
  }

  // ── 文字 → 粒子 ──────────────────────────────────────────
  textToParticles(text, opts = {}) {
    const color     = opts.color     || '#ff2d7b';
    const fontSize  = opts.fontSize  || 120;
    const fontFamily = opts.fontFamily || '"PingFang SC","Microsoft YaHei",sans-serif';
    const step      = opts.pixelStep || 3;

    const off = document.createElement('canvas');
    const oc  = off.getContext('2d');
    oc.font = `900 ${fontSize}px ${fontFamily}`;
    oc.textAlign = 'center';
    oc.textBaseline = 'middle';

    const m = oc.measureText(text);
    const tw = Math.ceil(m.width) + 40;
    const th = fontSize + 40;
    off.width = tw;  off.height = th;

    oc.font = `900 ${fontSize}px ${fontFamily}`;
    oc.textAlign = 'center';
    oc.textBaseline = 'middle';
    oc.fillStyle = '#fff';
    oc.fillText(text, tw / 2, th / 2);

    const img = oc.getImageData(0, 0, tw, th).data;
    const cx = opts.x ?? this.canvas.width  / 2;
    const cy = opts.y ?? this.canvas.height / 2;
    const ox = cx - tw / 2;
    const oy = cy - th / 2;

    const particles = [];
    for (let r = 0; r < th; r += step) {
      for (let c = 0; c < tw; c += step) {
        if (img[(r * tw + c) * 4 + 3] > 100) {
          const p = new PixelParticle(ox + c, oy + r, color, step);
          p.targetX = p.x;
          p.targetY = p.y;
          particles.push(p);
        }
      }
    }
    return particles;
  }

  // ── 心形粒子 ──────────────────────────────────────────────
  heartToParticles(cx, cy, scale, color) {
    const pts = [];
    for (let t = 0; t < Math.PI * 2; t += 0.06) {
      const s = Math.sin(t), c = Math.cos(t);
      const hx = 16 * s * s * s;
      const hy = -(13 * c - 5 * Math.cos(2*t) - 2 * Math.cos(3*t) - Math.cos(4*t));
      pts.push({ x: cx + hx * scale, y: cy + hy * scale });
    }
    const r = 18 * scale;
    for (let y = cy - r; y < cy + r; y += 3) {
      for (let x = cx - r; x < cx + r; x += 3) {
        const nx = (x - cx) / scale / 16;
        const ny = -(y - cy) / scale / 16;
        const a = nx*nx + ny*ny - 1;
        if (a*a*a - nx*nx*ny*ny*ny < 0) pts.push({ x, y });
      }
    }
    return pts.map(pt => {
      const p = new PixelParticle(pt.x, pt.y, color, 3);
      p.targetX = pt.x;  p.targetY = pt.y;
      return p;
    });
  }

  // ── 物理更新 ──────────────────────────────────────────────
  update(particles, handData) {
    this.time += 0.016;
    const hasPalm = handData?.palmCenter;
    const px = hasPalm ? handData.palmCenter.x * this.canvas.width  : -9999;
    const py = hasPalm ? handData.palmCenter.y * this.canvas.height : -9999;
    const isOpen = handData ? !!handData.isOpen : false;

    for (const p of particles) {
      let k = p.stiffness, d = p.damping;
      if (hasPalm && !isOpen) { k = 0.1; d = 0.88; }

      p.vx += (p.targetX - p.x) * k;
      p.vy += (p.targetY - p.y) * k;
      p.vx *= d;  p.vy *= d;

      if (hasPalm) {
        const rx = p.x - px, ry = p.y - py;
        const dist = Math.sqrt(rx*rx + ry*ry);
        if (dist < 180 && dist > 0.1) {
          const rep = 300 / dist;
          p.vx += (rx / dist) * rep;
          p.vy += (ry / dist) * rep;
        }
        if (dist < 120) {
          p.alpha = Math.max(p.alpha * 0.92, 0.1);
        } else {
          p.alpha = Math.min(p.alpha + 0.03, p.baseAlpha);
        }
        if (isOpen && dist < 180) {
          p.vx += (Math.random() - 0.5) * 12;
          p.vy += (Math.random() - 0.5) * 12;
        }
      } else {
        p.alpha = Math.min(p.alpha + 0.02, p.baseAlpha);
      }

      p.alpha = Math.max(0.05, p.alpha + Math.sin(this.time * 2 + p.phase) * 0.05);
      p.x += p.vx;  p.y += p.vy;
    }
  }

  // ── 渲染（空间哈希连线 + 三层光晕）─────────────────────────────
  render(ctx, particles, color, glowColor) {
    ctx.save();
    const gColor = glowColor || color;

    // ── 空间哈希连线 ──
    ctx.strokeStyle = gColor;
    ctx.lineWidth = 0.5;
    let lineCount = 0;
    const maxLines = 600;
    const maxDistSq = 1225; // 35px²

    this.grid.forEachNeighbor(particles, (a, b) => {
      if (lineCount >= maxLines) return;
      const dx = a.x - b.x, dy = a.y - b.y;
      if (dx*dx + dy*dy < maxDistSq) {
        ctx.globalAlpha = Math.min(a.alpha, b.alpha) * 0.15;
        ctx.beginPath();
        ctx.moveTo(a.x + a.size/2, a.y + a.size/2);
        ctx.lineTo(b.x + b.size/2, b.y + b.size/2);
        ctx.stroke();
        lineCount++;
      }
    });

    // ── 批量渲染粒子（减少 fillStyle 切换）──
    // 先画所有外层光晕
    ctx.fillStyle = gColor;
    for (const p of particles) {
      ctx.globalAlpha = p.alpha * 0.1;
      const r = p.size * 2.5;
      ctx.beginPath();
      ctx.arc(p.x + p.size/2, p.y + p.size/2, r, 0, Math.PI * 2);
      ctx.fill();
    }
    // 再画所有中层光晕
    for (const p of particles) {
      ctx.globalAlpha = p.alpha * 0.25;
      ctx.beginPath();
      ctx.arc(p.x + p.size/2, p.y + p.size/2, p.size * 1.2, 0, Math.PI * 2);
      ctx.fill();
    }
    // 最后画所有核心方块
    ctx.fillStyle = color || gColor;
    for (const p of particles) {
      ctx.globalAlpha = p.alpha;
      ctx.fillRect(p.x, p.y, p.size, p.size);
    }

    ctx.restore();
  }

  // ── 爆炸散开 ──────────────────────────────────────────────
  scatterParticles(particles, cx, cy, force) {
    for (const p of particles) {
      const dx = p.x - cx, dy = p.y - cy;
      const dist = Math.sqrt(dx*dx + dy*dy) || 1;
      const s = force / dist;
      p.vx += (dx / dist) * s * (0.7 + Math.random() * 0.6);
      p.vy += (dy / dist) * s * (0.7 + Math.random() * 0.6);
    }
  }

  // ── 收聚 ──────────────────────────────────────────────────
  gatherParticles(particles) {
    for (const p of particles) {
      p.stiffness = 0.1;  p.damping = 0.9;  p.alpha = 1;
    }
  }

  // ── 气球生成 ──────────────────────────────────────────────
  generateBalloons(n, w, h) {
    const colors = ['#ff2d7b','#ff6b35','#ffd700','#00e5ff','#7c4dff','#ff4081','#69f0ae','#40c4ff'];
    const bs = [];
    for (let i = 0; i < n; i++) {
      bs.push({
        x: Math.random() * w,
        y: h + Math.random() * 300,
        speed: 1.5 + Math.random() * 2.5,
        wobble: 0.5 + Math.random() * 2,
        phase: Math.random() * Math.PI * 2,
        color: colors[Math.floor(Math.random() * colors.length)],
        w: 18 + Math.random() * 16,
        h: 24 + Math.random() * 18,
        alpha: 0.7 + Math.random() * 0.3
      });
    }
    return bs;
  }
}

window.PixelEngine = PixelEngine;
window.PixelParticle = PixelParticle;
