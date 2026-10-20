// ============================================================
// ppt-build-pptx.mjs — Dreamcore 路演 PPT（PPTX 版）
// 内容模型：./ppt-content.mjs（单一事实源）
// 视觉系统：jingmei-ppt「咨询研报 × 东方文化」——深色底 + 紫粉品牌 + 结论式标题
// 输出：<root>/Dreamcore-路演PPT-v1.0.pptx
// ============================================================
import PptxGenJS from 'pptxgenjs';
import path from 'node:path';
import fs from 'node:fs';
import { fileURLToPath } from 'node:url';
import { DECK } from './ppt-content.mjs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..');
const ASSETS = path.join(ROOT, 'ppt-final-assets');
const OUT = path.join(ROOT, 'Dreamcore-路演PPT-v1.0.pptx');

const T = DECK.theme;
const F = DECK.font.cn;
const PW = 13.333, PH = 7.5;          // 16:9
const M = 0.55;                        // 外边距
const CW = PW - M * 2;                 // 内容宽

const pptx = new PptxGenJS();
pptx.defineLayout({ name: 'WIDE', width: PW, height: PH });
pptx.layout = 'WIDE';
pptx.author = 'Dreamcore 项目组';
pptx.title = 'Dreamcore · AI+文旅文创艺术共创社区 路演演示';
pptx.subject = '校长杯创新创业大赛 路演PPT';
pptx.company = 'Dreamcore';
pptx.lang = 'zh-CN';

const img = (name) => path.join(ASSETS, name);

// ─────────── 原语 ───────────
function rect(slide, x, y, w, h, { fill = T.surface, line = T.line, radius = 0.08, lw = 0.75, shadow = false } = {}) {
  const o = { x, y, w, h, fill: { color: fill }, line: { color: line, width: lw } };
  if (radius > 0) { o.rectRadius = radius; o.shape = pptx.ShapeType.roundRect; } else { o.shape = pptx.ShapeType.rect; }
  if (shadow) o.shadow = { type: 'outer', color: '0E0A20', blur: 6, angle: 90, distance: 2, opacity: 0.45 };
  slide.addShape(o.shape, o);
}

function text(slide, str, x, y, w, h, o = {}) {
  slide.addText(str, {
    x, y, w, h,
    fontFace: o.fontFace || F, fontSize: o.fontSize || 12, color: o.color || T.ink,
    bold: o.bold || false, align: o.align || 'left', valign: o.valign || 'top',
    lineSpacingMultiple: o.lsm || 1.15, margin: o.margin ?? 0.03, breakLine: o.breakLine || false,
    ...(o.wrap === false ? { wrap: false } : {}),
  });
}

function chip(slide, str, x, y, w, h, { fill = T.accent2Deep, color = 'FFFFFF' } = {}) {
  slide.addShape(pptx.ShapeType.roundRect, { x, y, w, h, rectRadius: h / 2, fill: { color: fill }, line: { color: fill, width: 0 } });
  text(slide, str, x + 0.06, y, w - 0.12, h, { fontSize: 10.5, bold: true, color, align: 'center', valign: 'middle', margin: 0.02, wrap: false });
}

function kicker(slide, str, x = M, y = 0.30) {
  text(slide, str.toUpperCase(), x, y, CW, 0.26, { fontSize: 10.5, color: T.accent, bold: true, charSpacing: 1.5 });
}

function claim(slide, str, y = 0.62, fontSize = 23) {
  text(slide, str, M, y, CW, 0.62, { fontSize, bold: true, color: T.ink, lsm: 1.05 });
}

// 渐变感标题条（品牌紫粉）
function gradBar(slide, x, y, w, h = 0.06) {
  slide.addShape(pptx.ShapeType.rect, { x, y, w, h, fill: { color: T.accent } });
  slide.addShape(pptx.ShapeType.rect, { x: x + w * 0.55, y, w: w * 0.45, h, fill: { color: T.accent2 } });
}

function footer(slide, num) {
  text(slide, 'DREAMCORE', M, 7.12, 2.5, 0.22, { fontSize: 8.5, color: T.page, bold: true });
  text(slide, `AI+文旅文创艺术共创社区 · 路演演示`, 2.2, 7.12, 6.5, 0.22, { fontSize: 8.5, color: T.page, align: 'center' });
  text(slide, String(num).padStart(2, '0') + ' / 20', PW - M - 1.2, 7.12, 1.2, 0.22, { fontSize: 8.5, color: T.page, align: 'right' });
}

// 标题 + 页码
function header(slide, { no, k, title, fs = 23 }) {
  kicker(slide, k);
  claim(slide, title, 0.62, fs);
  gradBar(slide, M, 1.16, 0.85, 0.045);
  footer(slide, no);
}

// 图片卡（圆角面板 + 图 + 细边框）
function imageCard(slide, imgPath, x, y, w, h, { caption = '', capH = 0.34 } = {}) {
  rect(slide, x, y, w, h, { fill: T.surface, radius: 0.06, shadow: true });
  const pad = 0.07;
  const iw = w - pad * 2, ih = h - pad * 2 - (caption ? capH : 0);
  slide.addImage({ path: imgPath, x: x + pad, y: y + pad, w: iw, h: ih, sizing: { type: 'contain', w: iw, h: ih } });
  if (caption) text(slide, caption, x + 0.1, y + h - capH + 0.03, w - 0.2, capH - 0.06, { fontSize: 8.5, color: T.muted, align: 'center', valign: 'middle' });
}

// 要点块（编号 + 标题 + 描述）
function pointList(slide, points, x, y, w, h, opts = {}) {
  const n = points.length;
  const gap = opts.gap ?? 0.16;
  const ph = (h - gap * (n - 1)) / n;
  points.forEach((p, i) => {
    const yy = y + i * (ph + gap);
    rect(slide, x, yy, w, ph, { fill: T.surface, radius: 0.06 });
    slide.addShape(pptx.ShapeType.rect, { x, y: yy, w: 0.045, h: ph, fill: { color: T.accent } });
    text(slide, String(i + 1).padStart(2, '0'), x + 0.14, yy + 0.1, 0.5, ph - 0.2, { fontSize: 12, bold: true, color: T.accent });
    text(slide, p.t, x + 0.62, yy + 0.09, w - 0.8, 0.3, { fontSize: 12.5, bold: true, color: T.ink });
    text(slide, p.d, x + 0.62, yy + 0.38, w - 0.8, ph - 0.46, { fontSize: 10, color: T.muted, lsm: 1.1 });
  });
}

// 大数字卡
function statCard(slide, v, l, s, x, y, w, h, big = 24) {
  rect(slide, x, y, w, h, { fill: T.surface, radius: 0.06 });
  text(slide, v, x + 0.12, y + 0.1, w - 0.24, h * 0.5, { fontSize: big, bold: true, color: T.gold, fontFace: F });
  text(slide, l, x + 0.12, y + h * 0.55, w - 0.24, 0.28, { fontSize: 11.5, bold: true, color: T.ink });
  text(slide, s, x + 0.12, y + h * 0.55 + 0.27, w - 0.24, 0.24, { fontSize: 9, color: T.muted });
}

// 页脚注
function noteLine(slide, s, x = M, y = 6.82) {
  text(slide, s, x, y, CW, 0.24, { fontSize: 9, color: T.muted, align: 'left' });
}

// ─────────── 页面组装 ───────────
function buildCover(s, d) {
  s.background = { color: T.bgDeep };
  // 装饰：紫粉渐变光圈
  s.addShape(pptx.ShapeType.ellipse, { x: 8.6, y: -1.8, w: 6.2, h: 6.2, fill: { color: T.accentDeep, transparency: 38 }, line: { color: T.accentDeep, width: 0 } });
  s.addShape(pptx.ShapeType.ellipse, { x: 10.2, y: -0.6, w: 4.0, h: 4.0, fill: { color: T.accent2Deep, transparency: 52 }, line: { color: T.accent2Deep, width: 0 } });
  s.addShape(pptx.ShapeType.ellipse, { x: -1.6, y: 5.0, w: 4.6, h: 4.6, fill: { color: T.accentDeep, transparency: 55 }, line: { color: T.accentDeep, width: 0 } });

  kicker(s, d.kicker, M, 0.85);

  text(s, d.title, M, 2.25, CW, 1.5, { fontSize: 66, bold: true, color: 'FFFFFF', align: 'center' });
  gradBar(s, PW / 2 - 1.6, 3.92, 3.2, 0.055);
  text(s, d.subtitle, M, 4.18, CW, 0.5, { fontSize: 23, bold: true, color: T.accent, align: 'center', charSpacing: 1 });
  text(s, d.slogan, M, 4.78, CW, 0.36, { fontSize: 13, color: T.muted, align: 'center' });

  chip(s, 'AI 一键生成文创', PW / 2 - 3.55, 5.35, 2.2, 0.4, { fill: T.accentDeep });
  chip(s, '领域微调模型自持', PW / 2 - 1.2, 5.35, 2.2, 0.4, { fill: T.accent2Deep });
  chip(s, '3D 实物定制交付', PW / 2 + 1.15, 5.35, 2.2, 0.4, { fill: '4C3B8F' });

  text(s, d.credits, M, 6.35, CW, 0.3, { fontSize: 12.5, color: T.ink, align: 'center' });
  text(s, d.footer, M, 6.9, CW, 0.26, { fontSize: 9.5, color: T.page, align: 'center' });
}

function buildPitch(s, d) {
  s.background = { color: T.bg };
  header(s, { no: 2, k: 'Elevator Pitch', title: d.claim, fs: 25 });
  pointList(s, d.points, M, 1.55, 7.4, 3.4, { gap: 0.14 });
  const sy = 5.15, sh = 1.42, sw1 = 2.35, sg = 0.17;
  d.stats.forEach((st, i) => statCard(s, st.v, st.l, st.s, M + i * (sw1 + sg), sy, sw1, sh, 20));
  imageCard(s, img(d.image), 8.25, 1.55, 4.53, 5.05, { caption: 'Dreamcore 首页 · 暗色主界面' });
}

function buildProblem(s, d) {
  s.background = { color: T.bg };
  header(s, { no: 3, k: '背景与市场机会', title: d.claim });
  d.market.forEach((mt, i) => statCard(s, mt.v, mt.l, mt.s, M, 1.62 + i * 1.52, 4.4, 1.4, 22));
  // 痛点
  const px = 5.35, pw = CW - px + M;
  d.pains.forEach((p, i) => {
    const y = 1.62 + i * 1.18;
    rect(s, px, y, pw, 1.04, { fill: T.surface, radius: 0.06 });
    chip(s, p.who, px + 0.14, y + 0.13, 1.9, 0.34, { fill: T.accentDeep });
    text(s, p.pain, px + 2.2, y + 0.1, pw - 2.4, 0.86, { fontSize: 11.5, color: T.ink, valign: 'middle', lsm: 1.2 });
  });
  rect(s, M, 6.30, CW, 0.45, { fill: T.surface2, radius: 0.06 });
  text(s, '★ ' + d.takeaway, M + 0.16, 6.30, CW - 0.3, 0.45, { fontSize: 12, bold: true, color: T.gold, valign: 'middle' });
  noteLine(s, DECK.footnote, M, 6.78);
}

function buildSolution(s, d) {
  s.background = { color: T.bg };
  header(s, { no: 4, k: '解决方案总览', title: d.claim });
  const cols = 2, rows = 2, gx = 0.22, gy = 0.2;
  const qw = (CW - gx) / cols, qh = (4.62 - gy) / rows;
  d.quadrants.forEach((q, i) => {
    const cx = M + (i % cols) * (qw + gx), cy = 1.62 + Math.floor(i / cols) * (qh + gy);
    rect(s, cx, cy, qw, qh, { fill: T.surface, radius: 0.08 });
    // 大字
    text(s, q.key, cx + 0.22, cy + 0.14, 1.3, 1.0, { fontSize: 44, bold: true, color: T.accent });
    text(s, q.t, cx + 1.45, cy + 0.2, qw - 1.6, 0.4, { fontSize: 15.5, bold: true, color: T.ink });
    text(s, q.d, cx + 0.24, cy + 0.92, qw - 0.48, qh - 1.0, { fontSize: 10.5, color: T.muted, lsm: 1.2 });
  });
  // 底部四大板块
  const bw = (CW - 0.2 * 3) / 4;
  d.boards.forEach((b, i) => chip(s, b, M + i * (bw + 0.2), 6.38, bw, 0.4, { fill: i % 2 ? T.accent2Deep : T.accentDeep }));
  noteLine(s, '闭环路径：识文化 → 学文化 → 创文创 → 享社区，每一环由 AI 能力增强', M, 6.86);
}

function buildFlow(s, d) {
  s.background = { color: T.bg };
  header(s, { no: 5, k: '产品核心链路', title: d.claim });
  // 指标条
  d.metrics.forEach((mt, i) => statCard(s, mt.v, mt.l, '', M + i * 2.62, 1.5, 2.48, 0.66, 15));
  // 泳道
  const lx = M, ly = 2.42, lw = 7.15;
  const laneColors = ['7C3AED', '0891B2', 'B45309'];
  d.lanes.forEach((lane, li) => {
    const y = ly + li * 1.44;
    rect(s, lx, y, lw, 1.3, { fill: T.surface, radius: 0.06 });
    chip(s, lane.lane, lx + 0.12, y + 0.1, 1.35, 0.32, { fill: laneColors[li] });
    const n = lane.steps.length;
    const sx = lx + 1.7, sw = lw - 1.95, stepW = sw / n;
    lane.steps.forEach((st, si) => {
      const xx = sx + si * stepW;
      s.addShape(pptx.ShapeType.chevron, { x: xx + 0.01, y: y + 0.55, w: stepW - 0.09, h: 0.58, fill: { color: T.surface2 }, line: { color: T.line, width: 0.75 } });
      text(s, st, xx + 0.1, y + 0.55, stepW - 0.19, 0.58, { fontSize: 10.5, bold: true, color: T.ink, align: 'center', valign: 'middle', wrap: true });
    });
  });
  imageCard(s, img(d.image), 8.05, 2.42, 4.73, 3.9, { caption: d.imageCaption });
  text(s, d.metrics.map(m => `${m.v} ${m.l}`).join('   ·   '), M, 6.65, CW, 0.3, { fontSize: 11, color: T.gold, bold: true, align: 'center' });
}

function buildMatrix(s, d) {
  s.background = { color: T.bg };
  header(s, { no: 6, k: '核心功能矩阵', title: d.claim });
  const cols = 4, rows = 2, gx = 0.18, gy = 0.18;
  const tw = (CW - gx * (cols - 1)) / cols, th = (4.42 - gy) / rows;
  d.tiles.forEach((t, i) => {
    const x = M + (i % cols) * (tw + gx), y = 1.55 + Math.floor(i / cols) * (th + gy);
    rect(s, x, y, tw, th, { fill: T.surface, radius: 0.07 });
    text(s, t.v, x + 0.14, y + 0.12, tw - 0.28, 0.78, { fontSize: 27, bold: true, color: T.accent });
    text(s, t.l, x + 0.14, y + 0.94, tw - 0.28, 0.32, { fontSize: 12, bold: true, color: T.ink });
    text(s, t.d, x + 0.14, y + 1.28, tw - 0.28, th - 1.38, { fontSize: 9, color: T.muted, lsm: 1.15 });
  });
  rect(s, M, 6.30, CW, 0.45, { fill: T.surface2, radius: 0.06 });
  text(s, '★ ' + d.takeaway, M + 0.16, 6.30, CW - 0.3, 0.45, { fontSize: 12, bold: true, color: T.gold, valign: 'middle' });
}

function buildDemo1(s, d) { demoLayout(s, d, 7, 'Demo ① · AI 一键生成文创方案'); }
function buildDemo2(s, d) { demoLayout(s, d, 8, 'Demo ② · AI 图生图重绘分镜'); }
function buildDemo3(s, d) {
  s.background = { color: T.bg };
  header(s, { no: 9, k: 'Demo ③ · 3D 文创定制', title: d.claim });
  imageCard(s, img(d.image), M, 1.55, 6.0, 4.55, { caption: '手账本 · 3D 旋转预览（GLB 50016 面）' });
  imageCard(s, img(d.image2), 6.75, 1.55, 2.95, 2.75, { caption: '书签 · GLB 5004 面' });
  pointList(s, d.points, 9.85, 1.55, 2.93, 4.55, { gap: 0.12 });
  noteLine(s, '本地 BFF（node:http 零依赖）承担 GLB UV 预处理 · 76 种策略自动展开贴图', M, 6.3);
  noteLine(s, d.footnote, M, 6.68);
}
function demoLayout(s, d, no, k) {
  s.background = { color: T.bg };
  header(s, { no, k, title: d.claim });
  imageCard(s, img(d.image), M, 1.55, 7.55, 5.05, { caption: '' });
  pointList(s, d.points, 8.42, 1.55, 4.36, 5.05, { gap: 0.22 });
  if (d.note) noteLine(s, d.note, M, 6.78);
  else noteLine(s, d.footnote, M, 6.78);
}

function buildDemo4(s, d) {
  s.background = { color: T.bg };
  header(s, { no: 10, k: 'Demo ④ · 文化体验四件套', title: d.claim });
  const cols = 2, g = 0.2, cw = (CW - g) / 2, ch = (4.35 - g) / 2;
  d.grid.forEach((g1, i) => {
    const x = M + (i % cols) * (cw + g), y = 1.55 + Math.floor(i / cols) * (ch + g);
    imageCard(s, img(g1.img), x, y, cw, ch, { caption: `${g1.label}｜${g1.d}` });
  });
  noteLine(s, d.footnote, M, 6.72);
}

function buildDemo5(s, d) {
  s.background = { color: T.bg };
  header(s, { no: 11, k: 'Demo ⑤ · 社区与画廊', title: d.claim });
  imageCard(s, img(d.image), M, 1.55, 7.3, 5.0, { caption: '文旅画廊 · 瀑布流 + 粒子背景' });
  imageCard(s, img(d.image2), 8.15, 1.55, 4.6, 2.3, { caption: '创作者排行榜' });
  pointList(s, d.points, 8.15, 4.05, 4.6, 2.5, { gap: 0.12 });
  noteLine(s, d.note, M, 6.78);
}

function buildArch(s, d) {
  s.background = { color: T.bg };
  header(s, { no: 12, k: '技术与系统架构', title: d.claim });
  const ly = 1.5, lh = 1.0, gap = 0.18;
  const layerCols = ['7C3AED', 'EC4899', '0891B2', 'B45309'];
  d.layers.forEach((L, i) => {
    const y = ly + i * (lh + gap);
    rect(s, M, y, CW, lh, { fill: T.surface, radius: 0.06 });
    chip(s, L.name, M + 0.12, y + 0.3, 1.6, 0.4, { fill: layerCols[i] });
    const n = L.items.length;
    const ix = M + 1.95, iw = CW - 2.15, cellW = (iw - (n - 1) * 0.14) / n;
    L.items.forEach((it, j) => {
      rect(s, ix + j * (cellW + 0.14), y + 0.12, cellW, lh - 0.24, { fill: T.surface2, radius: 0.05 });
      text(s, it, ix + j * (cellW + 0.14) + 0.04, y + 0.12, cellW - 0.08, lh - 0.24, { fontSize: 10.5, bold: true, color: T.ink, align: 'center', valign: 'middle', wrap: true });
    });
  });
  d.points.forEach((p, i) => noteLine(s, '◆ ' + p, M, 6.34 + i * 0.28));
}

function buildModel(s, d) {
  s.background = { color: T.bg };
  header(s, { no: 13, k: '自研模型全链路 · 技术亮点', title: d.claim });
  // 训练链路 5 步
  const n = d.pipeline.length, g = 0.16, sy = 1.5, sh = 1.55;
  const stepW = (CW - g * (n - 1)) / n;
  d.pipeline.forEach((p, i) => {
    const x = M + i * (stepW + g);
    rect(s, x, sy, stepW, sh, { fill: T.surface, radius: 0.07 });
    slide_pipe(s, i, n, x, stepW, sy);
    text(s, String(i + 1), x + 0.14, sy + 0.12, 0.4, 0.34, { fontSize: 15, bold: true, color: T.accent });
    text(s, p.t, x + 0.14, sy + 0.5, stepW - 0.28, 0.32, { fontSize: 12.5, bold: true, color: T.ink });
    text(s, p.d, x + 0.14, sy + 0.86, stepW - 0.28, sh - 0.94, { fontSize: 8.8, color: T.muted, lsm: 1.1 });
  });
  // 对比表 + 案例图
  const ty = 3.28, tableW = 8.3;
  const rows = d.compare.map((r, ri) => r.map((c, ci) => ({
    text: c,
    options: ri === 0
      ? { fill: { color: T.accentDeep }, bold: true, color: 'FFFFFF', align: 'center' }
      : { fill: { color: ri % 2 ? T.surface2 : T.surface }, color: ci === 2 ? T.ink : (ci === 0 ? T.gold : T.muted), bold: ci === 2 || ci === 0, align: ci === 0 ? 'left' : 'center' },
  })));
  s.addTable(rows, {
    x: M, y: ty, w: tableW, colW: [1.15, 3.55, 3.6], rowH: 0.46,
    fontFace: F, fontSize: 10, valign: 'middle', margin: 0.08,
    border: { type: 'solid', color: T.line, pt: 0.75 },
  });
  imageCard(s, img(d.image), M + tableW + 0.25, ty, CW - tableW - 0.25, 3.3, { caption: '自研模型输出案例 · 凤凰古城 #13' });
  rect(s, M, 6.72, CW, 0.4, { fill: T.surface2, radius: 0.06 });
  text(s, d.fallback, M + 0.14, 6.72, CW - 0.28, 0.4, { fontSize: 10.5, bold: true, color: T.positive, valign: 'middle' });
}
function slide_pipe(s, i, n, x, w, y) {
  if (i < n - 1) {
    s.addShape(pptx.ShapeType.chevron, { x: x + w - 0.055, y: y + 0.66, w: 0.3, h: 0.24, fill: { color: i % 2 ? T.accent2 : T.accent }, line: { color: i % 2 ? T.accent2 : T.accent, width: 0 } });
  }
}

function buildEng(s, d) {
  s.background = { color: T.bg };
  header(s, { no: 14, k: '工程化与创新点', title: d.claim });
  // 降级链
  const chainY = 1.5, cw1 = 1.95, gap = 0.12, cx = M;
  d.chain.forEach((c, i) => {
    s.addShape(pptx.ShapeType.chevron, { x: cx + i * (cw1 + gap), y: chainY, w: cw1 + 0.06, h: 0.5, fill: { color: ['7C3AED', 'D97706', '0891B2', '4C3B8F'][i] }, line: { color: ['7C3AED', 'D97706', '0891B2', '4C3B8F'][i], width: 0 } });
    text(s, c, cx + i * (cw1 + gap) + 0.12, chainY, cw1 - 0.1, 0.5, { fontSize: 10.5, bold: true, color: 'FFFFFF', align: 'center', valign: 'middle' });
  });
  text(s, '四级降级链 · 单点故障不影响可用性', M + 5 * (cw1 + gap) - gap, chainY, 3.3, 0.5, { fontSize: 10.5, color: T.muted, valign: 'middle' });
  // 6 卡片 3x2
  const cardsX = M, cardsY = 2.3, cw2 = 2.38, chh = 1.28, cgx = 0.15, cgy = 0.14;
  d.cards.forEach((c, i) => {
    const x = cardsX + (i % 3) * (cw2 + cgx), y = cardsY + Math.floor(i / 3) * (chh + cgy);
    rect(s, x, y, cw2, chh, { fill: T.surface, radius: 0.06 });
    text(s, c.v, x + 0.12, y + 0.08, cw2 - 0.24, 0.44, { fontSize: 16, bold: true, color: T.accent });
    text(s, c.l, x + 0.12, y + 0.5, cw2 - 0.24, 0.3, { fontSize: 10.5, bold: true, color: T.ink });
    text(s, c.d, x + 0.12, y + 0.78, cw2 - 0.24, 0.44, { fontSize: 8.5, color: T.muted, lsm: 1.05 });
  });
  imageCard(s, img(d.image), 8.42, 2.3, 4.36, 2.84, { caption: '管理后台 · 数据看板（10 模块 · 审计日志）' });
  noteLine(s, '创新点：四级降级链 · BFF UV 预处理 · AIGC 合规标识 · Sentry 生产监控', M, 5.42);
  noteLine(s, '管理后台统一权限矩阵 + 操作全程留痕（_log 审计日志），逻辑/物理删除双模式', M, 5.7);
}

function buildBusiness(s, d) {
  s.background = { color: T.bg };
  header(s, { no: 15, k: '商业模式', title: d.claim });
  // free 条
  rect(s, M, 1.5, CW, 0.62, { fill: T.surface, radius: 0.06 });
  text(s, d.free.t, M + 0.2, 1.5, 1.9, 0.62, { fontSize: 13, bold: true, color: T.muted, valign: 'middle' });
  text(s, d.free.d, M + 2.2, 1.5, CW - 2.5, 0.62, { fontSize: 10.5, color: T.muted, valign: 'middle' });
  // 双轮
  const ww = (CW - 0.3) / 2;
  d.wheels.forEach((w, i) => {
    const x = M + i * (ww + 0.3), y = 2.36, h1 = 3.1;
    rect(s, x, y, ww, h1, { fill: T.surface, radius: 0.08 });
    text(s, w.key, x + 0.2, y + 0.16, 0.8, 0.8, { fontSize: 34, bold: true, color: i ? T.accent2 : T.accent });
    text(s, w.t, x + 1.0, y + 0.24, ww - 1.2, 0.36, { fontSize: 15, bold: true, color: T.ink });
    text(s, w.price, x + 1.0, y + 0.6, ww - 1.2, 0.5, { fontSize: 22, bold: true, color: T.gold });
    w.items.forEach((it, j) => {
      const iy = y + 1.3 + j * 0.44;
      text(s, '·  ' + it, x + 0.28, iy, ww - 0.56, 0.4, { fontSize: 11, color: T.ink });
    });
  });
  rect(s, M, 5.78, CW, 0.62, { fill: T.surface2, radius: 0.06 });
  text(s, '★ ' + d.takeaway, M + 0.2, 5.78, CW - 0.4, 0.62, { fontSize: 13, bold: true, color: T.gold, valign: 'middle' });
  noteLine(s, '对标稿定设计 259/598 档位体系；B 端含专属知识库与 AI 讲解 API 接入能力', M, 6.62);
}

function buildMarket(s, d) {
  s.background = { color: T.bg };
  header(s, { no: 16, k: '市场与竞争', title: d.claim });
  // 金字塔
  const px = M, py = 1.55, pw = 4.15;
  const layers = [ { w: pw, h: 1.05, c: T.accentDeep }, { w: pw * 0.72, h: 1.05, c: T.accent2Deep }, { w: pw * 0.46, h: 1.05, c: '4C3B8F' } ];
  d.funnel.forEach((f, i) => {
    const y = py + i * 1.2;
    const lw = layers[i].w, lx = px + (pw - lw) / 2;
    s.addShape(pptx.ShapeType.rect, { x: lx, y, w: lw, h: layers[i].h, fill: { color: layers[i].c }, line: { color: layers[i].c, width: 0 } });
    text(s, f.label, lx + 0.1, y + 0.1, lw - 0.2, 0.32, { fontSize: 10.5, bold: true, color: 'FFFFFF' });
    text(s, f.value, lx + 0.1, y + 0.4, lw - 0.2, 0.42, { fontSize: 19, bold: true, color: 'FFFFFF' });
    text(s, f.note, lx + 0.1, y + 0.82, lw - 0.2, 0.22, { fontSize: 8.5, color: 'E9E4FF' });
  });
  // 对比表
  const tx = 5.05, tw2 = CW - pw - 0.35;
  const rows = d.compare.map((r, ri) => r.map((c, ci) => ({
    text: c,
    options: ri === 0
      ? { fill: { color: T.accentDeep }, bold: true, color: 'FFFFFF', align: 'center' }
      : { fill: { color: ri % 2 ? T.surface2 : T.surface }, bold: ci === 3 || ci === 0, color: ci === 3 ? T.accent : (ci === 0 ? T.gold : T.muted), align: ci === 0 ? 'left' : 'center' },
  })));
  s.addTable(rows, {
    x: tx, y: py, w: 7.52, colW: [1.22, 2.06, 2.06, 2.18], rowH: 0.55,
    fontFace: F, fontSize: 9.5, valign: 'middle', margin: 0.07,
    border: { type: 'solid', color: T.line, pt: 0.75 },
  });
  rect(s, M, 5.72, CW, 0.58, { fill: T.surface2, radius: 0.06 });
  text(s, '★ ' + d.takeaway, M + 0.2, 5.72, CW - 0.4, 0.58, { fontSize: 11.5, bold: true, color: T.gold, valign: 'middle' });
  noteLine(s, 'TAM 为公开数据；SAM / SOM 为推演口径', M, 6.5);
}

function buildFinance(s, d) {
  s.background = { color: T.bg };
  header(s, { no: 17, k: '财务预测与盈亏平衡', title: d.claim });
  text(s, '毛利率 75% → 85% → 88%（自研推理零边际成本支撑）', M, 1.32, 7.6, 0.26, { fontSize: 10.5, color: T.gold, bold: true });
  s.addChart(pptx.ChartType.bar, [
    { name: '收入（万元）', labels: d.chart.labels, values: d.chart.revenue },
  ], {
    x: M, y: 1.6, w: 7.6, h: 4.9,
    barDir: 'col', barGapWidthPct: 60, chartColors: [T.accent, T.gold],
    showLegend: true, legendPos: 'b', legendColor: T.muted, legendFontFace: F, legendFontSize: 10,
    showValue: true, dataLabelColor: T.ink, dataLabelFontFace: F, dataLabelFontSize: 9.5,
    catAxisLabelColor: T.muted, catAxisLabelFontFace: F, catAxisLabelFontSize: 10,
    valAxisLabelColor: T.muted, valAxisLabelFontFace: F, valAxisLabelFontSize: 9,
    valGridLine: { color: T.line, style: 'dash', size: 0.5 },
    catAxisLineShow: false, catAxisHidden: false, valAxisLineShow: false,
    chartColorsOpacity: 92,
  });
  pointList(s, d.points, 8.55, 1.6, 4.23, 4.9, { gap: 0.24 });
  noteLine(s, d.footnote, M, 6.68);
}

function buildTeam(s, d) {
  s.background = { color: T.bg };
  header(s, { no: 18, k: '团队与指导教师', title: d.claim });
  const tw2 = (CW - 0.36) / 3;
  d.members.forEach((m, i) => {
    const x = M + i * (tw2 + 0.18), y = 1.55, h1 = 4.35;
    rect(s, x, y, tw2, h1, { fill: T.surface, radius: 0.08, shadow: true });
    // 头像圈（首字）
    s.addShape(pptx.ShapeType.ellipse, { x: x + tw2 / 2 - 0.55, y: y + 0.32, w: 1.1, h: 1.1, fill: { color: i === 2 ? '4C3B8F' : (i === 0 ? T.accentDeep : T.accent2Deep) }, line: { color: T.line, width: 1 } });
    text(s, m.name.charAt(0), x + tw2 / 2 - 0.55, y + 0.32, 1.1, 1.1, { fontSize: 34, bold: true, color: 'FFFFFF', align: 'center', valign: 'middle' });
    text(s, m.name, x, y + 1.6, tw2, 0.42, { fontSize: 17, bold: true, color: T.ink, align: 'center' });
    chip(s, m.role, x + tw2 / 2 - 0.95, y + 2.14, 1.9, 0.36, { fill: i === 2 ? '4C3B8F' : (i === 0 ? T.accentDeep : T.accent2Deep) });
    m.items.forEach((it, j) => {
      text(s, '·  ' + it, x + 0.3, y + 2.72 + j * 0.4, tw2 - 0.6, 0.36, { fontSize: 10, color: T.ink, lsm: 1 });
    });
  });
  rect(s, M, 6.18, CW, 0.62, { fill: T.surface2, radius: 0.06 });
  text(s, '★ ' + d.takeaway, M + 0.2, 6.18, CW - 0.4, 0.62, { fontSize: 12.5, bold: true, color: T.gold, valign: 'middle', lsm: 1.1 });
}

function buildRoadmap(s, d) {
  s.background = { color: T.bg };
  header(s, { no: 19, k: '发展规划与社会价值', title: d.claim });
  // 时间轴
  const n = d.timeline.length, tw3 = (CW - 0.3 * (n - 1)) / n, ty = 1.6, th1 = 3.4;
  s.addShape(pptx.ShapeType.rect, { x: M + 0.2, y: ty + 0.3, w: CW - 0.4, h: 0.02, fill: { color: T.line } });
  d.timeline.forEach((t, i) => {
    const x = M + i * (tw3 + 0.3);
    s.addShape(pptx.ShapeType.ellipse, { x: x + 0.14, y: ty + 0.16, w: 0.3, h: 0.3, fill: { color: i === 0 ? T.accent2 : T.accent }, line: { color: T.bg, width: 2 } });
    text(s, t.t, x + 0.1, ty + 0.62, tw3 - 0.2, 0.62, { fontSize: 11.5, bold: true, color: T.ink, align: 'left', wrap: true });
    t.items.forEach((it, j) => {
      text(s, '·  ' + it, x + 0.12, ty + 1.35 + j * 0.5, tw3 - 0.2, 0.46, { fontSize: 9.5, color: T.muted, lsm: 1.05 });
    });
  });
  // 社会价值 3 卡
  d.values.forEach((v, i) => {
    const x = M + i * ((CW - 0.36) / 3 + 0.18), y = 5.35, w4 = (CW - 0.36) / 3;
    rect(s, x, y, w4, 1.2, { fill: T.surface, radius: 0.07 });
    text(s, v.t, x + 0.16, y + 0.12, w4 - 0.32, 0.3, { fontSize: 12, bold: true, color: T.accent2 });
    text(s, v.d, x + 0.16, y + 0.44, w4 - 0.32, 0.7, { fontSize: 9.8, color: T.ink, lsm: 1.15 });
  });
}

function buildClosing(s, d) {
  s.background = { color: T.bgDeep };
  s.addShape(pptx.ShapeType.ellipse, { x: 8.6, y: -1.8, w: 6.2, h: 6.2, fill: { color: T.accentDeep, transparency: 38 }, line: { color: T.accentDeep, width: 0 } });
  s.addShape(pptx.ShapeType.ellipse, { x: -1.6, y: 5.0, w: 4.6, h: 4.6, fill: { color: T.accent2Deep, transparency: 55 }, line: { color: T.accent2Deep, width: 0 } });
  text(s, d.claim, M, 2.3, CW, 1.0, { fontSize: 38, bold: true, color: 'FFFFFF', align: 'center' });
  gradBar(s, PW / 2 - 1.6, 3.62, 3.2, 0.055);
  text(s, d.thanks, M, 4.05, CW, 0.4, { fontSize: 14, color: T.muted, align: 'center' });
  text(s, d.sub, M, 5.05, CW, 0.3, { fontSize: 11.5, color: T.accent, align: 'center' });
  text(s, d.credits, M, 6.0, CW, 0.3, { fontSize: 11, color: T.muted, align: 'center' });
  footer(s, 20);
}

// ─────────── 组装 ───────────
const builders = {
  cover: buildCover, pitch: buildPitch, problem: buildProblem, solution: buildSolution,
  flow: buildFlow, matrix: buildMatrix, demo1: buildDemo1, demo2: buildDemo2, demo3: buildDemo3,
  demo4: buildDemo4, demo5: buildDemo5, arch: buildArch, model: buildModel,
  engineering: buildEng, business: buildBusiness, market: buildMarket, finance: buildFinance,
  team: buildTeam, roadmap: buildRoadmap, closing: buildClosing,
};

for (const d of DECK.slides) {
  const s = pptx.addSlide();
  const fn = builders[d.id];
  if (!fn) throw new Error('未注册的页面构建器: ' + d.id);
  fn(s, d);
}

await pptx.writeFile({ fileName: OUT });
const kb = Math.round(fs.statSync(OUT).size / 1024);
console.log(`PPTX 已生成: ${OUT} (${(kb / 1024).toFixed(2)} MB, 20 页)`);