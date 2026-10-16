// js/craft-mockup.js — P0-1 文创实物场景预览
// 职责：
//   1. 将 buildCraftCanvas() 的结果画布合成到 5 种实物样机场景（纯 Canvas 2D 程序化绘制）
//   2. 场景：desk 明信片桌面 / frame 挂墙相框 / phone 手机壁纸 / album 收藏卡册 / social 社交分享
//   3. craftType → 默认场景映射 TYPE_SCENE_MAP（对齐 ai-craft.js CRAFT_TYPES 五类型）
// 设计原则：
//   1. 纯 Canvas 2D：禁 3D / 图片素材，全部程序化绘制（渐变 / 路径 / 贝塞尔 / 文本）
//   2. 纯函数：同一输入永远同一输出（种子伪随机，不用 Math.random / Date）
//   3. 设计语言：雾紫粉梦核（#ffd1e8 / #c9b6ff）+ 玻璃质感，文化功能点缀青绿 #34d399
// 挂载：window.CraftMockup = { buildMockupCanvas, SCENES, TYPE_SCENE_MAP }
// ============================================================

/** 样机输出尺寸（4:3，预览与导出共用） */
const OUT_W = 1200;
const OUT_H = 900;

/** 梦核设计令牌（与 css/style.css :root 对齐；Canvas 读不了 CSS 变量，取值固化） */
const PINK = '#ffd1e8';
const PURPLE = '#c9b6ff';
const TEAL = '#34d399';

/** 5 种实物场景（icon 为 FontAwesome 类名，供 ai-craft.js 面板 chips 复用） */
const SCENES = [
  { key: 'desk', label: '桌面明信片', icon: 'fa-envelope', hint: '原木桌面 · 手绘邮票 · 钢笔' },
  { key: 'frame', label: '挂墙相框', icon: 'fa-image', hint: '深色墙面 · 原木框 · 射灯光晕' },
  { key: 'phone', label: '手机壁纸', icon: 'fa-mobile-screen', hint: '深色背景 · 圆角手机样机' },
  { key: 'album', label: '收藏卡册', icon: 'fa-book-open', hint: '卡册内页 · 半透明卡套' },
  { key: 'social', label: '社交分享', icon: 'fa-share-nodes', hint: '浅色社交信息流样机' }
];

/** craftType → 默认场景（用户可任意切换） */
const TYPE_SCENE_MAP = {
  postcard: 'desk',
  poster: 'frame',
  wallpaper: 'phone',
  card: 'album',
  template: 'social'
};

// ------------------------------------------------------------
// 基础工具
// ------------------------------------------------------------

/** 种子伪随机（LCG）：保证场景绘制确定性 */
function makeRand(seed) {
  let s = (seed >>> 0) || 1;
  return () => {
    s = (s * 1664525 + 1013904223) >>> 0;
    return s / 4294967296;
  };
}

/** 圆角矩形路径（不填充，仅构造路径供 clip / fill / stroke） */
function roundRectPath(ctx, x, y, w, h, r) {
  r = Math.max(0, Math.min(r, w / 2, h / 2));
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.lineTo(x + w - r, y);
  ctx.arc(x + w - r, y + r, r, -Math.PI / 2, 0);
  ctx.lineTo(x + w, y + h - r);
  ctx.arc(x + w - r, y + h - r, r, 0, Math.PI / 2);
  ctx.lineTo(x + r, y + h);
  ctx.arc(x + r, y + h - r, r, Math.PI / 2, Math.PI);
  ctx.lineTo(x, y + r);
  ctx.arc(x + r, y + r, r, Math.PI, Math.PI * 1.5);
  ctx.closePath();
}

function fillRoundRect(ctx, x, y, w, h, r) {
  roundRectPath(ctx, x, y, w, h, r);
  ctx.fill();
}

function strokeRoundRect(ctx, x, y, w, h, r) {
  roundRectPath(ctx, x, y, w, h, r);
  ctx.stroke();
}

/**
 * 作品画布 contain 适配贴入目标区域（居中）
 * sourceCanvas 缺失 / 零尺寸时绘制雾紫粉占位渐变（保证纯函数永不报错）
 */
function drawArtwork(ctx, src, x, y, w, h) {
  if (src && src.width > 0 && src.height > 0) {
    const sr = src.width / src.height;
    const dr = w / h;
    let dw, dh;
    if (sr > dr) { dw = w; dh = w / sr; } else { dh = h; dw = h * sr; }
    try {
      ctx.drawImage(src, x + (w - dw) / 2, y + (h - dh) / 2, dw, dh);
      return;
    } catch (_) { /* 落入占位分支 */ }
  }
  const g = ctx.createLinearGradient(x, y, x + w, y + h);
  g.addColorStop(0, 'rgba(255,209,232,.9)');
  g.addColorStop(1, 'rgba(201,182,255,.9)');
  ctx.fillStyle = g;
  ctx.fillRect(x, y, w, h);
  // 占位角标
  ctx.fillStyle = 'rgba(122,90,160,.55)';
  ctx.font = '600 18px "Segoe UI", "Microsoft YaHei", system-ui, sans-serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText('DREAMCORE', x + w / 2, y + h / 2);
}

// ------------------------------------------------------------
// 场景 1：desk 明信片桌面（暖色桌面 + 卡片 -4° 微旋转投影 + 手绘邮票 + 钢笔剪影）
// ------------------------------------------------------------

function sceneDesk(ctx, src) {
  const W = OUT_W, H = OUT_H;
  const rand = makeRand(20250927);

  // 1. 暖色渐变桌面
  const bg = ctx.createLinearGradient(0, 0, 0, H);
  bg.addColorStop(0, '#eed3ae');
  bg.addColorStop(0.55, '#dcbb8c');
  bg.addColorStop(1, '#c69a68');
  ctx.fillStyle = bg;
  ctx.fillRect(0, 0, W, H);

  // 木纹：起伏细线
  ctx.strokeStyle = 'rgba(122,79,42,.10)';
  ctx.lineWidth = 1.6;
  for (let i = 0; i < 14; i++) {
    const y = 34 + i * 64 + rand() * 22;
    ctx.beginPath();
    ctx.moveTo(-20, y);
    for (let x = 0; x < W + 160; x += 160) {
      ctx.quadraticCurveTo(x + 80, y + (rand() - 0.5) * 26, x + 160, y + (rand() - 0.5) * 10);
    }
    ctx.stroke();
  }
  // 桌面暗角
  const vg = ctx.createRadialGradient(W / 2, H / 2, H * 0.32, W / 2, H / 2, H * 0.86);
  vg.addColorStop(0, 'rgba(90,50,20,0)');
  vg.addColorStop(1, 'rgba(90,50,20,.22)');
  ctx.fillStyle = vg;
  ctx.fillRect(0, 0, W, H);

  // 2. 明信片卡片（-4° 微旋转 + 投影）
  const cw = 680, ch = 480;
  const cx = W / 2 - 36, cy = H / 2 + 12;
  ctx.save();
  ctx.translate(cx, cy);
  ctx.rotate(-4 * Math.PI / 180);
  // 投影
  ctx.save();
  ctx.shadowColor = 'rgba(70,35,10,.38)';
  ctx.shadowBlur = 42;
  ctx.shadowOffsetX = 14;
  ctx.shadowOffsetY = 26;
  ctx.fillStyle = '#fdfaf4';
  fillRoundRect(ctx, -cw / 2, -ch / 2, cw, ch, 12);
  ctx.restore();
  ctx.strokeStyle = 'rgba(160,110,60,.25)';
  ctx.lineWidth = 1;
  strokeRoundRect(ctx, -cw / 2, -ch / 2, cw, ch, 12);

  // 贴图区（左侧 62%，圆角裁剪）
  const pad = 26;
  const imgX = -cw / 2 + pad;
  const imgY = -ch / 2 + pad;
  const imgW = (cw - pad * 3) * 0.62;
  const imgH = ch - pad * 2;
  ctx.save();
  roundRectPath(ctx, imgX, imgY, imgW, imgH, 6);
  ctx.clip();
  drawArtwork(ctx, src, imgX, imgY, imgW, imgH);
  ctx.restore();

  // 中缝竖线 + 书写区横线（明信片质感）
  const midX = imgX + imgW + pad / 2;
  ctx.strokeStyle = 'rgba(150,120,90,.28)';
  ctx.lineWidth = 1.4;
  ctx.beginPath();
  ctx.moveTo(midX, imgY);
  ctx.lineTo(midX, -ch / 2 + ch - pad);
  ctx.stroke();
  const lineX = midX + 20;
  const rw = cw / 2 - pad - 20; // 书写区右侧可用宽（相对卡片中线）
  ctx.strokeStyle = 'rgba(150,120,90,.35)';
  for (let i = 0; i < 4; i++) {
    const ly = -ch / 2 + 128 + i * 78;
    ctx.beginPath();
    ctx.moveTo(lineX, ly);
    ctx.lineTo(lineX + rw, ly);
    ctx.stroke();
  }
  ctx.fillStyle = 'rgba(150,120,90,.55)';
  ctx.font = '500 15px "Segoe UI", "Microsoft YaHei", system-ui, sans-serif';
  ctx.textAlign = 'left';
  ctx.textBaseline = 'alphabetic';
  ctx.fillText('DREAMCORE · 来自梦核文创', lineX, -ch / 2 + 84);

  // 手绘风邮票（右上角，微旋转）
  drawStamp(ctx, cw / 2 - 128, -ch / 2 + 30, 100, 118);
  ctx.restore();

  // 3. 钢笔剪影（右下角桌面）
  drawPen(ctx, W - 300, H - 190, 300, 30);
}

/** 手绘风邮票：锯齿边 + 虚线内框 + 迷你山水票面 */
function drawStamp(ctx, x, y, w, h) {
  ctx.save();
  ctx.translate(x + w / 2, y + h / 2);
  ctx.rotate(5 * Math.PI / 180);
  ctx.translate(-w / 2, -h / 2);

  // 票体
  ctx.fillStyle = '#fff9ef';
  ctx.fillRect(0, 0, w, h);
  // 锯齿边（打半圆孔）
  const hole = 7, step = 15;
  ctx.fillStyle = '#fdfaf4';
  for (let px = step / 2; px < w; px += step) {
    ctx.beginPath(); ctx.arc(px, 0, hole / 2, 0, Math.PI * 2); ctx.fill();
    ctx.beginPath(); ctx.arc(px, h, hole / 2, 0, Math.PI * 2); ctx.fill();
  }
  for (let py = step / 2; py < h; py += step) {
    ctx.beginPath(); ctx.arc(0, py, hole / 2, 0, Math.PI * 2); ctx.fill();
    ctx.beginPath(); ctx.arc(w, py, hole / 2, 0, Math.PI * 2); ctx.fill();
  }
  // 手绘感虚线内框
  ctx.strokeStyle = PURPLE;
  ctx.lineWidth = 1.6;
  ctx.setLineDash([7, 5]);
  ctx.strokeRect(11, 11, w - 22, h - 22);
  ctx.setLineDash([]);

  // 票面：迷你山水（青绿 + 雾粉点缀）
  const ix = 17, iy = 17, iw = w - 34, ih = h - 34 - 18;
  const g = ctx.createLinearGradient(ix, iy, ix, iy + ih);
  g.addColorStop(0, '#eaf8f1');
  g.addColorStop(1, '#d3efe3');
  ctx.fillStyle = g;
  ctx.fillRect(ix, iy, iw, ih);
  // 太阳
  ctx.fillStyle = PINK;
  ctx.beginPath();
  ctx.arc(ix + iw * 0.70, iy + ih * 0.28, 9, 0, Math.PI * 2);
  ctx.fill();
  // 远山（雾蓝）
  ctx.fillStyle = 'rgba(91,130,190,.45)';
  ctx.beginPath();
  ctx.moveTo(ix, iy + ih * 0.72);
  ctx.lineTo(ix + iw * 0.38, iy + ih * 0.30);
  ctx.lineTo(ix + iw * 0.66, iy + ih * 0.72);
  ctx.closePath();
  ctx.fill();
  // 近山（青绿）
  ctx.fillStyle = 'rgba(52,211,153,.75)';
  ctx.beginPath();
  ctx.moveTo(ix + iw * 0.30, iy + ih * 0.86);
  ctx.lineTo(ix + iw * 0.58, iy + ih * 0.42);
  ctx.lineTo(ix + iw * 0.86, iy + ih * 0.86);
  ctx.closePath();
  ctx.fill();
  // 水波线
  ctx.strokeStyle = TEAL;
  ctx.lineWidth = 1.8;
  ctx.beginPath();
  ctx.moveTo(ix + 6, iy + ih * 0.94);
  ctx.quadraticCurveTo(ix + iw * 0.3, iy + ih * 0.90, ix + iw * 0.5, iy + ih * 0.94);
  ctx.quadraticCurveTo(ix + iw * 0.72, iy + ih * 0.98, ix + iw - 6, iy + ih * 0.94);
  ctx.stroke();
  // 面值
  ctx.fillStyle = '#7a6a8f';
  ctx.font = '600 13px "Segoe UI", "Microsoft YaHei", system-ui, sans-serif';
  ctx.textAlign = 'right';
  ctx.textBaseline = 'alphabetic';
  ctx.fillText('梦核 · 1.20', w - 15, h - 8);
  ctx.restore();
}

/** 钢笔剪影：深色笔杆 + 黄铜笔尖 + 笔夹（silhouette 风格） */
function drawPen(ctx, x, y, len, thick) {
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(24 * Math.PI / 180);
  // 桌面投影
  ctx.fillStyle = 'rgba(70,35,10,.20)';
  fillRoundRect(ctx, 12, thick * 0.55, len * 0.9, thick * 0.6, thick * 0.3);
  // 笔杆
  const g = ctx.createLinearGradient(0, 0, 0, thick);
  g.addColorStop(0, '#3a3350');
  g.addColorStop(0.5, '#241f38');
  g.addColorStop(1, '#151023');
  ctx.fillStyle = g;
  fillRoundRect(ctx, 0, 0, len * 0.72, thick, thick / 2);
  // 杆身高光
  ctx.fillStyle = 'rgba(255,255,255,.15)';
  fillRoundRect(ctx, 10, 3, len * 0.56, 4, 2);
  // 笔帽环（雾紫点缀）
  ctx.fillStyle = 'rgba(201,182,255,.55)';
  ctx.fillRect(len * 0.64, 0, 6, thick);
  // 笔尖（黄铜剪影）
  ctx.fillStyle = '#9a7440';
  ctx.beginPath();
  ctx.moveTo(len * 0.72, 0);
  ctx.lineTo(len * 0.92, thick * 0.36);
  ctx.lineTo(len, thick * 0.5);
  ctx.lineTo(len * 0.92, thick * 0.64);
  ctx.lineTo(len * 0.72, thick);
  ctx.closePath();
  ctx.fill();
  // 笔尖中缝
  ctx.strokeStyle = 'rgba(255,244,222,.6)';
  ctx.lineWidth = 1.4;
  ctx.beginPath();
  ctx.moveTo(len * 0.74, thick * 0.5);
  ctx.lineTo(len * 0.97, thick * 0.5);
  ctx.stroke();
  // 笔夹
  ctx.fillStyle = 'rgba(255,255,255,.25)';
  fillRoundRect(ctx, len * 0.26, -9, 6, thick + 9, 3);
  ctx.restore();
}

// ------------------------------------------------------------
// 场景 2：frame 挂墙相框（深色墙面 + 原木框 + 顶部射灯锥形光晕）
// ------------------------------------------------------------

function sceneFrame(ctx, src) {
  const W = OUT_W, H = OUT_H;
  const rand = makeRand(30303030);

  // 1. 深色墙面
  const bg = ctx.createLinearGradient(0, 0, 0, H);
  bg.addColorStop(0, '#282038');
  bg.addColorStop(0.6, '#1d1730');
  bg.addColorStop(1, '#130f1e');
  ctx.fillStyle = bg;
  ctx.fillRect(0, 0, W, H);
  // 墙面细噪点
  ctx.fillStyle = 'rgba(255,255,255,.028)';
  for (let i = 0; i < 180; i++) {
    ctx.fillRect(rand() * W, rand() * H, 1.6, 1.6);
  }

  // 2. 射灯锥形光晕（径向渐变，从顶部打向画框）
  const spot = ctx.createRadialGradient(W / 2, -140, 60, W / 2, -140, 980);
  spot.addColorStop(0, 'rgba(255,240,214,.55)');
  spot.addColorStop(0.45, 'rgba(255,236,205,.16)');
  spot.addColorStop(1, 'rgba(255,236,205,0)');
  ctx.fillStyle = spot;
  ctx.fillRect(0, 0, W, H);
  // 光锥（加强锥形感）
  ctx.save();
  ctx.globalAlpha = 0.45;
  const cone = ctx.createLinearGradient(0, 0, 0, H);
  cone.addColorStop(0, 'rgba(255,240,214,.30)');
  cone.addColorStop(1, 'rgba(255,240,214,0)');
  ctx.fillStyle = cone;
  ctx.beginPath();
  ctx.moveTo(W / 2 - 70, 0);
  ctx.lineTo(W / 2 + 70, 0);
  ctx.lineTo(W / 2 + 400, H);
  ctx.lineTo(W / 2 - 400, H);
  ctx.closePath();
  ctx.fill();
  ctx.restore();

  // 3. 原木相框
  const fw = 560, fh = 690;
  const fx = W / 2 - fw / 2, fy = 104;
  ctx.save();
  ctx.shadowColor = 'rgba(0,0,0,.55)';
  ctx.shadowBlur = 60;
  ctx.shadowOffsetY = 28;
  const wood = ctx.createLinearGradient(fx, fy, fx + fw, fy + fh);
  wood.addColorStop(0, '#a4713f');
  wood.addColorStop(0.5, '#8a5a2e');
  wood.addColorStop(1, '#6f4622');
  ctx.fillStyle = wood;
  fillRoundRect(ctx, fx, fy, fw, fh, 8);
  ctx.restore();
  // 外沿高光 + 内边框描边（画框内沿）
  ctx.strokeStyle = 'rgba(255,225,180,.35)';
  ctx.lineWidth = 2;
  strokeRoundRect(ctx, fx + 2, fy + 2, fw - 4, fh - 4, 7);
  ctx.strokeStyle = 'rgba(255,225,180,.55)';
  ctx.lineWidth = 3;
  strokeRoundRect(ctx, fx + 27, fy + 27, fw - 54, fh - 54, 4);

  // 4. 卡纸 passe-partout + 画框落影
  ctx.fillStyle = '#f3ecdd';
  ctx.fillRect(fx + 30, fy + 30, fw - 60, fh - 60);
  const win = { x: fx + 66, y: fy + 66, w: fw - 132, h: fh - 132 };
  ctx.save();
  ctx.shadowColor = 'rgba(0,0,0,.4)';
  ctx.shadowBlur = 14;
  ctx.shadowOffsetY = 7;
  ctx.fillStyle = '#ffffff';
  ctx.fillRect(win.x, win.y, win.w, win.h);
  ctx.restore();

  // 5. 作品（contain 贴入画框窗口）
  drawArtwork(ctx, src, win.x + 4, win.y + 4, win.w - 8, win.h - 8);

  // 6. 顶部射灯灯具
  ctx.fillStyle = '#0c0a12';
  ctx.beginPath();
  ctx.moveTo(W / 2 - 34, 0);
  ctx.lineTo(W / 2 + 34, 0);
  ctx.lineTo(W / 2 + 22, 26);
  ctx.lineTo(W / 2 - 22, 26);
  ctx.closePath();
  ctx.fill();
  ctx.fillStyle = 'rgba(255,240,214,.9)';
  ctx.fillRect(W / 2 - 13, 23, 26, 5);
}

// ------------------------------------------------------------
// 场景 3：phone 手机壁纸（深色背景 + 圆角机身裁剪贴图 + 状态栏白字）
// ------------------------------------------------------------

function scenePhone(ctx, src) {
  const W = OUT_W, H = OUT_H;

  // 1. 深色梦核背景 + 雾紫粉氛围光
  const bg = ctx.createLinearGradient(0, 0, W, H);
  bg.addColorStop(0, '#1b1428');
  bg.addColorStop(1, '#241a33');
  ctx.fillStyle = bg;
  ctx.fillRect(0, 0, W, H);
  let glow = ctx.createRadialGradient(W * 0.24, H * 0.22, 40, W * 0.24, H * 0.22, 460);
  glow.addColorStop(0, 'rgba(201,182,255,.22)');
  glow.addColorStop(1, 'rgba(201,182,255,0)');
  ctx.fillStyle = glow;
  ctx.fillRect(0, 0, W, H);
  glow = ctx.createRadialGradient(W * 0.82, H * 0.84, 40, W * 0.82, H * 0.84, 520);
  glow.addColorStop(0, 'rgba(255,209,232,.15)');
  glow.addColorStop(1, 'rgba(255,209,232,0)');
  ctx.fillStyle = glow;
  ctx.fillRect(0, 0, W, H);

  // 2. 手机机身
  const pw = 396, ph = 800;
  const px = W / 2 - pw / 2, py = 50;
  ctx.save();
  ctx.shadowColor = 'rgba(0,0,0,.55)';
  ctx.shadowBlur = 70;
  ctx.shadowOffsetY = 30;
  const body = ctx.createLinearGradient(px, 0, px + pw, 0);
  body.addColorStop(0, '#131019');
  body.addColorStop(0.5, '#211a2b');
  body.addColorStop(1, '#131019');
  ctx.fillStyle = body;
  fillRoundRect(ctx, px, py, pw, ph, 58);
  ctx.restore();
  // 机身边缘高光
  ctx.strokeStyle = 'rgba(255,255,255,.10)';
  ctx.lineWidth = 2;
  strokeRoundRect(ctx, px + 1.5, py + 1.5, pw - 3, ph - 3, 57);

  // 3. 屏幕（圆角裁剪 + 贴图）
  const bezel = 16;
  const sx = px + bezel, sy = py + bezel;
  const sw = pw - bezel * 2, sh = ph - bezel * 2;
  ctx.save();
  roundRectPath(ctx, sx, sy, sw, sh, 44);
  ctx.clip();
  ctx.fillStyle = '#050508';
  ctx.fillRect(sx, sy, sw, sh);
  drawArtwork(ctx, src, sx, sy, sw, sh);

  // 状态栏：时间残留白字 + 右侧图标（营造真实感）
  ctx.fillStyle = 'rgba(255,255,255,.94)';
  ctx.font = '600 30px "Segoe UI", system-ui, sans-serif';
  ctx.textAlign = 'left';
  ctx.textBaseline = 'top';
  ctx.fillText('9:41', sx + 34, sy + 20);
  drawSignalBars(ctx, sx + sw - 158, sy + 34);
  drawWifiArcs(ctx, sx + sw - 100, sy + 44);
  drawBattery(ctx, sx + sw - 52, sy + 30);

  // 底部 home indicator
  ctx.fillStyle = 'rgba(255,255,255,.85)';
  fillRoundRect(ctx, sx + sw / 2 - 64, sy + sh - 18, 128, 6, 3);
  ctx.restore();

  // 4. 灵动岛（顶部挖孔）
  ctx.fillStyle = '#0a0810';
  fillRoundRect(ctx, W / 2 - 52, py + 24, 104, 30, 15);
}

function drawSignalBars(ctx, x, y) {
  ctx.fillStyle = 'rgba(255,255,255,.92)';
  for (let i = 0; i < 4; i++) {
    const bh = 6 + i * 5;
    fillRoundRect(ctx, x + i * 9, y + 18 - bh, 5, bh, 1.5);
  }
}

function drawWifiArcs(ctx, cx, cy) {
  ctx.strokeStyle = 'rgba(255,255,255,.92)';
  ctx.lineWidth = 3.4;
  ctx.lineCap = 'round';
  for (let r = 6; r <= 16; r += 5) {
    ctx.beginPath();
    ctx.arc(cx, cy, r, Math.PI * 1.25, Math.PI * 1.75);
    ctx.stroke();
  }
  ctx.fillStyle = 'rgba(255,255,255,.92)';
  ctx.beginPath();
  ctx.arc(cx, cy, 2.2, 0, Math.PI * 2);
  ctx.fill();
}

function drawBattery(ctx, x, y) {
  ctx.strokeStyle = 'rgba(255,255,255,.85)';
  ctx.lineWidth = 2.4;
  strokeRoundRect(ctx, x, y, 34, 17, 4);
  ctx.fillStyle = 'rgba(255,255,255,.85)';
  fillRoundRect(ctx, x + 36, y + 5, 4, 7, 2);
  ctx.fillStyle = 'rgba(255,255,255,.95)';
  fillRoundRect(ctx, x + 3.5, y + 3.5, 22, 10, 2);
}

// ------------------------------------------------------------
// 场景 4：album 藏品卡收藏册（内页 + 装订环 + 半透明卡套高光斜条）
// ------------------------------------------------------------

function sceneAlbum(ctx, src) {
  const W = OUT_W, H = OUT_H;
  const rand = makeRand(40404040);

  // 1. 卡册内页
  const bg = ctx.createLinearGradient(0, 0, W, H);
  bg.addColorStop(0, '#f7f2fb');
  bg.addColorStop(1, '#e9dcf4');
  ctx.fillStyle = bg;
  ctx.fillRect(0, 0, W, H);
  // 页面纹理噪点
  ctx.fillStyle = 'rgba(150,110,200,.05)';
  for (let i = 0; i < 150; i++) {
    ctx.fillRect(rand() * W, rand() * H, 2, 2);
  }
  // 左侧装订边（内页弧度阴影）
  const bind = ctx.createLinearGradient(0, 0, 100, 0);
  bind.addColorStop(0, 'rgba(90,60,130,.28)');
  bind.addColorStop(1, 'rgba(90,60,130,0)');
  ctx.fillStyle = bind;
  ctx.fillRect(0, 0, 100, H);
  // 装订环孔（3 个）
  for (let i = 0; i < 3; i++) {
    const cy = 190 + i * 260;
    ctx.fillStyle = '#d4c4e4';
    ctx.beginPath();
    ctx.arc(52, cy, 26, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = 'rgba(120,90,160,.4)';
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.arc(52, cy, 26, 0, Math.PI * 2);
    ctx.stroke();
    ctx.fillStyle = '#f7f2fb';
    ctx.beginPath();
    ctx.arc(52, cy, 16, 0, Math.PI * 2);
    ctx.fill();
  }

  // 2. 半透明卡套（居中偏右，避开装订边）
  const slvW = 560, slvH = 690;
  const slvX = W / 2 - slvW / 2 + 52, slvY = 105;
  ctx.save();
  roundRectPath(ctx, slvX, slvY, slvW, slvH, 18);
  ctx.clip();
  ctx.fillStyle = 'rgba(255,255,255,.32)';
  ctx.fillRect(slvX, slvY, slvW, slvH);
  // 高光斜条（两道，斜切反射）
  ctx.save();
  ctx.translate(slvX + slvW / 2, slvY + slvH / 2);
  ctx.rotate(-24 * Math.PI / 180);
  ctx.fillStyle = 'rgba(255,255,255,.30)';
  ctx.fillRect(-slvW, -slvH * 0.34, slvW * 2, 46);
  ctx.fillStyle = 'rgba(255,255,255,.15)';
  ctx.fillRect(-slvW, -slvH * 0.20, slvW * 2, 20);
  ctx.restore();
  ctx.restore();
  // 卡套描边 + 顶部开口缝隙
  ctx.strokeStyle = 'rgba(255,255,255,.78)';
  ctx.lineWidth = 2;
  strokeRoundRect(ctx, slvX, slvY, slvW, slvH, 18);
  ctx.strokeStyle = 'rgba(180,150,220,.35)';
  ctx.lineWidth = 1.5;
  strokeRoundRect(ctx, slvX + 3, slvY + 3, slvW - 6, slvH - 6, 15);
  ctx.fillStyle = 'rgba(120,90,160,.18)';
  fillRoundRect(ctx, slvX + 8, slvY + 5, slvW - 16, 14, 7);

  // 3. 藏品卡（居中 + 白色衬底 + 雾紫细描边）
  const pad2 = 46;
  const cardX = slvX + pad2, cardY = slvY + pad2 + 16;
  const cardW = slvW - pad2 * 2, cardH = slvH - pad2 * 2 - 62;
  ctx.save();
  ctx.shadowColor = 'rgba(90,60,140,.28)';
  ctx.shadowBlur = 24;
  ctx.shadowOffsetY = 12;
  ctx.fillStyle = '#ffffff';
  fillRoundRect(ctx, cardX - 6, cardY - 6, cardW + 12, cardH + 12, 10);
  ctx.restore();
  ctx.save();
  roundRectPath(ctx, cardX, cardY, cardW, cardH, 6);
  ctx.clip();
  drawArtwork(ctx, src, cardX, cardY, cardW, cardH);
  ctx.restore();
  ctx.strokeStyle = 'rgba(201,182,255,.7)';
  ctx.lineWidth = 1.5;
  strokeRoundRect(ctx, cardX - 0.75, cardY - 0.75, cardW + 1.5, cardH + 1.5, 6);

  // 4. 底部标注（青绿点缀：藏品编号）
  ctx.fillStyle = TEAL;
  ctx.font = '700 19px "Segoe UI", "Microsoft YaHei", system-ui, sans-serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText('DREAMCORE · 藏品卡 COLLECTION No.001', slvX + slvW / 2, slvY + slvH - 30);
}

// ------------------------------------------------------------
// 场景 5：social 社交分享样机（浅色背景 + 导航条 + 主体图 + 点赞/评论 icon 排）
// ------------------------------------------------------------

function sceneSocial(ctx, src) {
  const W = OUT_W, H = OUT_H;

  // 1. 浅色背景 + 雾紫粉氛围光斑
  const bg = ctx.createLinearGradient(0, 0, 0, H);
  bg.addColorStop(0, '#f6f0fb');
  bg.addColorStop(1, '#ebdff6');
  ctx.fillStyle = bg;
  ctx.fillRect(0, 0, W, H);
  let glow = ctx.createRadialGradient(W * 0.14, H * 0.1, 30, W * 0.14, H * 0.1, 320);
  glow.addColorStop(0, 'rgba(255,209,232,.55)');
  glow.addColorStop(1, 'rgba(255,209,232,0)');
  ctx.fillStyle = glow;
  ctx.fillRect(0, 0, W, H);
  glow = ctx.createRadialGradient(W * 0.9, H * 0.16, 30, W * 0.9, H * 0.16, 340);
  glow.addColorStop(0, 'rgba(201,182,255,.4)');
  glow.addColorStop(1, 'rgba(201,182,255,0)');
  ctx.fillStyle = glow;
  ctx.fillRect(0, 0, W, H);

  // 2. 顶部导航条
  const nx = 70, ny = 46, nw = W - 140, nh = 96;
  ctx.save();
  ctx.shadowColor = 'rgba(120,90,160,.18)';
  ctx.shadowBlur = 30;
  ctx.shadowOffsetY = 12;
  ctx.fillStyle = 'rgba(255,255,255,.93)';
  fillRoundRect(ctx, nx, ny, nw, nh, 26);
  ctx.restore();
  // 返回箭头
  ctx.strokeStyle = '#8a7fa0';
  ctx.lineWidth = 4.5;
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
  ctx.beginPath();
  ctx.moveTo(nx + 66, ny + 26);
  ctx.lineTo(nx + 40, ny + nh / 2);
  ctx.lineTo(nx + 66, ny + nh - 26);
  ctx.stroke();
  // 头像（雾紫粉渐变圆 + 首字）
  const ax = nx + 118, ay = ny + nh / 2;
  const ag = ctx.createLinearGradient(ax - 30, ay - 30, ax + 30, ay + 30);
  ag.addColorStop(0, PINK);
  ag.addColorStop(1, PURPLE);
  ctx.fillStyle = ag;
  ctx.beginPath();
  ctx.arc(ax, ay, 30, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = '#ffffff';
  ctx.font = '700 26px "Segoe UI", "Microsoft YaHei", system-ui, sans-serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText('梦', ax, ay + 1);
  // 用户名 + 副信息
  ctx.fillStyle = '#2c2440';
  ctx.font = '700 26px "Segoe UI", "Microsoft YaHei", system-ui, sans-serif';
  ctx.textAlign = 'left';
  ctx.fillText('梦核创作者', nx + 176, ny + 36);
  ctx.fillStyle = '#9a8fb5';
  ctx.font = '400 18px "Segoe UI", "Microsoft YaHei", system-ui, sans-serif';
  ctx.fillText('刚刚 · 来自 DreamCore AI 文创', nx + 176, ny + 68);
  // 右侧「···」
  ctx.fillStyle = '#8a7fa0';
  for (let i = 0; i < 3; i++) {
    ctx.beginPath();
    ctx.arc(nx + nw - 74 + i * 16, ny + nh / 2, 4.5, 0, Math.PI * 2);
    ctx.fill();
  }

  // 3. 主体图卡
  const ix = nx, iy = ny + nh + 26, iw = nw, ih = 548;
  ctx.save();
  ctx.shadowColor = 'rgba(120,90,160,.24)';
  ctx.shadowBlur = 36;
  ctx.shadowOffsetY = 16;
  ctx.fillStyle = '#ffffff';
  fillRoundRect(ctx, ix, iy, iw, ih, 26);
  ctx.restore();
  ctx.save();
  roundRectPath(ctx, ix + 18, iy + 18, iw - 36, ih - 36, 12);
  ctx.clip();
  drawArtwork(ctx, src, ix + 18, iy + 18, iw - 36, ih - 36);
  ctx.restore();

  // 4. 点赞/评论/分享 icon 排（简化几何绘制）
  const rowY = iy + ih + 58;
  const iconX0 = ix + 40;
  drawHeart(ctx, iconX0 + 18, rowY, 30, '#f2688f');
  ctx.fillStyle = '#7d7294';
  ctx.font = '500 20px "Segoe UI", "Microsoft YaHei", system-ui, sans-serif';
  ctx.textAlign = 'left';
  ctx.textBaseline = 'middle';
  ctx.fillText('1.2k', iconX0 + 52, rowY + 10);
  drawCommentBubble(ctx, iconX0 + 208, rowY, '#7d7294');
  drawSharePlane(ctx, iconX0 + 330, rowY, '#7d7294');
  drawBookmark(ctx, ix + iw - 44, rowY, '#7d7294');

  // 5. 底部引流条（青绿点缀）
  const ctaY = H - 104;
  ctx.fillStyle = 'rgba(52,211,153,.12)';
  fillRoundRect(ctx, nx, ctaY, nw, 58, 29);
  ctx.strokeStyle = 'rgba(52,211,153,.45)';
  ctx.lineWidth = 1.5;
  strokeRoundRect(ctx, nx, ctaY, nw, 58, 29);
  ctx.fillStyle = '#1fae83';
  ctx.font = '600 21px "Segoe UI", "Microsoft YaHei", system-ui, sans-serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText('用同款文化主题 · AI 一键生成你的文化文创', W / 2, ctaY + 30);
}

function drawHeart(ctx, cx, cy, size, color) {
  const s = size;
  ctx.save();
  ctx.fillStyle = color;
  ctx.beginPath();
  ctx.moveTo(cx, cy + s * 0.34);
  ctx.bezierCurveTo(cx - s * 0.62, cy - s * 0.16, cx - s * 0.36, cy - s * 0.62, cx, cy - s * 0.24);
  ctx.bezierCurveTo(cx + s * 0.36, cy - s * 0.62, cx + s * 0.62, cy - s * 0.16, cx, cy + s * 0.34);
  ctx.closePath();
  ctx.fill();
  ctx.restore();
}

function drawCommentBubble(ctx, cx, cy, color) {
  ctx.save();
  ctx.fillStyle = color;
  fillRoundRect(ctx, cx - 20, cy - 18, 40, 26, 9);
  ctx.beginPath();
  ctx.moveTo(cx - 9, cy + 8);
  ctx.lineTo(cx - 3, cy + 19);
  ctx.lineTo(cx + 5, cy + 8);
  ctx.closePath();
  ctx.fill();
  ctx.fillStyle = '#f6f0fb';
  for (let i = 0; i < 2; i++) {
    ctx.beginPath();
    ctx.arc(cx - 8 + i * 11, cy - 5, 2.6, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.restore();
}

function drawSharePlane(ctx, cx, cy, color) {
  ctx.save();
  ctx.fillStyle = color;
  ctx.beginPath();
  ctx.moveTo(cx - 24, cy - 10);
  ctx.lineTo(cx + 24, cy - 18);
  ctx.lineTo(cx + 6, cy + 16);
  ctx.closePath();
  ctx.fill();
  ctx.beginPath();
  ctx.moveTo(cx - 24, cy - 10);
  ctx.lineTo(cx + 6, cy + 16);
  ctx.lineTo(cx - 15, cy + 14);
  ctx.closePath();
  ctx.fill();
  ctx.restore();
}

function drawBookmark(ctx, cx, cy, color) {
  ctx.save();
  ctx.fillStyle = color;
  ctx.beginPath();
  ctx.moveTo(cx - 11, cy - 19);
  ctx.lineTo(cx + 11, cy - 19);
  ctx.lineTo(cx + 11, cy + 19);
  ctx.lineTo(cx, cy + 8);
  ctx.lineTo(cx - 11, cy + 19);
  ctx.closePath();
  ctx.fill();
  ctx.restore();
}

// ------------------------------------------------------------
// 主入口：buildMockupCanvas(sourceCanvas, sceneKey) → HTMLCanvasElement
// ------------------------------------------------------------

const SCENE_PAINTERS = {
  desk: sceneDesk,
  frame: sceneFrame,
  phone: scenePhone,
  album: sceneAlbum,
  social: sceneSocial
};

/**
 * 将文创结果画布合成到实物样机场景（纯函数，1200×900）
 * @param {HTMLCanvasElement} [sourceCanvas] - buildCraftCanvas 输出画布（缺失时绘制占位）
 * @param {string} sceneKey                 - SCENES key（desk/frame/phone/album/social，未知回退 desk）
 * @returns {HTMLCanvasElement} 1200×900 样机画布
 */
function buildMockupCanvas(sourceCanvas, sceneKey) {
  const out = document.createElement('canvas');
  out.width = OUT_W;
  out.height = OUT_H;
  const ctx = out.getContext('2d');
  if (!ctx) return out;
  const painter = SCENE_PAINTERS[sceneKey] || sceneDesk;
  try {
    painter(ctx, sourceCanvas);
  } catch (err) {
    // 兜底：场景绘制异常时给一块可辨识的渐变底（不抛错，调用方无需 try/catch）
    const g = ctx.createLinearGradient(0, 0, OUT_W, OUT_H);
    g.addColorStop(0, 'rgba(255,209,232,.9)');
    g.addColorStop(1, 'rgba(201,182,255,.9)');
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, OUT_W, OUT_H);
    if (typeof console !== 'undefined') {
      console.warn('[CraftMockup] 场景绘制失败:', err && err.message);
    }
  }
  return out;
}

// ------------------------------------------------------------
// 导出（ES Module + window.CraftMockup 双挂载）
// ------------------------------------------------------------

export { buildMockupCanvas, SCENES, TYPE_SCENE_MAP, OUT_W, OUT_H };

if (typeof window !== 'undefined') {
  window.CraftMockup = { buildMockupCanvas, SCENES, TYPE_SCENE_MAP, OUT_W, OUT_H };
}
