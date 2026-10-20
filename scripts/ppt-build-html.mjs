// ============================================================
// ppt-build-html.mjs — Dreamcore 路演 PPT（HTML 版）
// 与 ppt-build-pptx.mjs 共用 ./ppt-content.mjs：内容完全一致
// 16:9 单文件演示：键盘导航 + 页码圆点 + base64 内嵌图片 + SVG/CSS 图表
// 输出：<root>/Dreamcore-路演PPT-v1.0.html
// ============================================================
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { DECK } from './ppt-content.mjs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..');
const ASSETS = path.join(ROOT, 'ppt-final-assets');
const OUT = path.join(ROOT, 'Dreamcore-路演PPT-v1.0.html');

// CSS 需要 # 前缀（PPTX 的 pptxgenjs 接受无前缀，HTML 不接受）
const T = Object.fromEntries(Object.entries(DECK.theme).map(([k, v]) => [k, '#' + v]));
const W = 1280, H = 720, M = 52;
const imgCache = {};
const b64 = (name) => {
  if (!imgCache[name]) {
    imgCache[name] = fs.readFileSync(path.join(ASSETS, name)).toString('base64');
  }
  return `data:image/jpeg;base64,${imgCache[name]}`;
};

// SVG 财务柱状图（与 PPTX 图表同一数据）
function financeSvg(c) {
  const cw = 700, ch = 430, pl = 62, pr = 20, pt = 26, pb = 48;
  const max = 50;
  const bw = 120, gap = (cw - pl - pr - bw * 3) / 2;
  const baseY = pt + (ch - pt - pb);
  const ys = [10, 20, 30, 40, 50];
  let grid = '', bars = '';
  ys.forEach((v) => {
    const y = baseY - (v / max) * (baseY - pt);
    grid += `<line x1="${pl}" y1="${y}" x2="${cw - pr}" y2="${y}" stroke="#3B2F66" stroke-width="1" stroke-dasharray="4 4"/><text x="${pl - 8}" y="${y + 5}" text-anchor="end" font-size="16" fill="#A79BC7">${v}万</text>`;
  });
  c.revenue.forEach((v, i) => {
    const hgt = (v / max) * (baseY - pt);
    const x = pl + i * (bw + gap);
    bars += `<rect x="${x}" y="${baseY - hgt}" width="${bw}" height="${hgt}" rx="10" fill="url(#gbar)"/>
      <text x="${x + bw / 2}" y="${baseY - hgt - 12}" text-anchor="middle" font-size="22" font-weight="700" fill="#F5C97B">${v} 万</text>
      <text x="${x + bw / 2}" y="${baseY + 32}" text-anchor="middle" font-size="18" fill="#A79BC7">${c.labels[i]}</text>`;
  });
  return `<svg viewBox="0 0 ${cw} ${ch}" class="chart"><defs><linearGradient id="gbar" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#A78BFA"/><stop offset="1" stop-color="#7C3AED"/></linearGradient></defs>${grid}<line x1="${pl}" y1="${baseY}" x2="${cw - pr}" y2="${baseY}" stroke="#3B2F66" stroke-width="1.5"/>${bars}</svg>`;
}

// 金字塔（与 PPTX P16 同一数据）
function funnelHtml(f) {
  const widths = ['100%', '72%', '46%'];
  const colors = ['#7C3AED', '#EC4899', '#4C3B8F'];
  return `<div class="funnel">${f.map((d, i) => `
    <div class="flevel" style="width:${widths[i]};background:${colors[i]}">
      <div class="fl-a">${d.label}</div>
      <div class="fl-b">${d.value}</div>
      <div class="fl-c">${d.note}</div>
    </div>`).join('')}</div>`;
}

// 降级链
function chainHtml(chain) {
  const colors = ['#7C3AED', '#D97706', '#0891B2', '#4C3B8F'];
  return `<div class="chain">${chain.map((c, i) => `<div class="chain-item" style="background:${colors[i]}">${c}</div>`).join('')}</div>`;
}

const esc = (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

// —— 页面模板 ——
function chrome(no, k, title, extra = '') {
  return `<header><div class="kicker">${esc(k)}</div><h2 class="claim">${esc(title)}</h2><div class="gradbar"></div></header>${extra}<footer><span class="f-brand">DREAMCORE</span><span class="f-mid">AI+文旅文创艺术共创社区 · 路演演示</span><span class="f-page">${String(no).padStart(2, '0')} / 20</span></footer>`;
}
function note(s, cls = '') { return s ? `<div class="note ${cls}">${esc(s)}</div>` : ''; }
function imgCard(src, caption = '', cls = '') {
  return `<figure class="imgcard ${cls}"><img src="${b64(src)}" alt=""><figcaption>${esc(caption)}</figcaption></figure>`;
}
function points(points, cls = '') {
  return `<div class="points ${cls}">${points.map((p, i) => `
    <div class="pt"><div class="pt-num">${String(i + 1).padStart(2, '0')}</div><div class="pt-body"><div class="pt-t">${esc(p.t)}</div><div class="pt-d">${esc(p.d)}</div></div></div>`).join('')}</div>`;
}
function statCard(v, l, s = '', cls = '') {
  return `<div class="stat ${cls}"><div class="stat-v">${esc(v)}</div><div class="stat-l">${esc(l)}</div>${s ? `<div class="stat-s">${esc(s)}</div>` : ''}</div>`;
}
function take(s) { return `<div class="take">★ ${esc(s)}</div>`; }

const P = {
  cover(d) {
    return `<section class="slide role-cover"><div class="glow g1"></div><div class="glow g2"></div><div class="glow g3"></div>
      <div class="cover-inner">
        <div class="kicker">${esc(d.kicker)}</div>
        <h1 class="cover-title">${esc(d.title)}</h1>
        <div class="gradbar big"></div>
        <div class="cover-sub">${esc(d.subtitle)}</div>
        <div class="cover-slogan">${esc(d.slogan)}</div>
        <div class="chips"><span class="chip">AI 一键生成文创</span><span class="chip">领域微调模型自持</span><span class="chip">3D 实物定制交付</span></div>
        <div class="cover-credits">${esc(d.credits)}</div>
        <div class="cover-footer">${esc(d.footer)}</div>
      </div></section>`;
  },
  pitch(d) {
    return `<section class="slide">${chrome(2, 'ELEVATOR PITCH', d.claim)}
      <div class="pitch-body">
        <div class="pitch-left"><div class="points tall">${d.points.map((p, i) => `
          <div class="pt"><div class="pt-num">${String(i + 1).padStart(2, '0')}</div><div class="pt-body"><div class="pt-t">${esc(p.t)}</div><div class="pt-d">${esc(p.d)}</div></div></div>`).join('')}</div>
          <div class="stats">${d.stats.map(st => statCard(st.v, st.l, st.s)).join('')}</div>
        </div>
        <div class="pitch-right">${imgCard(d.image, 'Dreamcore 首页 · 暗色主界面', 'tall')}</div>
      </div></section>`;
  },
  problem(d) {
    return `<section class="slide">${chrome(3, '背景与市场机会', d.claim)}
      <div class="grid-2">
        <div class="col stats-col">${d.market.map(m => statCard(m.v, m.l, m.s, 'big')).join('')}</div>
        <div class="col pains">${d.pains.map(p => `
          <div class="pain"><span class="pain-who">${esc(p.who)}</span><span class="pain-d">${esc(p.pain)}</span></div>`).join('')}</div>
      </div>
      ${take(d.takeaway)}
      ${note(DECK.footnote, 'as-foot')}</section>`;
  },
  solution(d) {
    return `<section class="slide">${chrome(4, '解决方案总览', d.claim)}
      <div class="quads">${d.quadrants.map(q => `
        <div class="quad"><div class="q-key">${esc(q.key)}</div><div class="q-body"><div class="q-t">${esc(q.t)}</div><div class="q-d">${esc(q.d)}</div></div></div>`).join('')}</div>
      <div class="boards">${d.boards.map((b, i) => `<span class="board ${i % 2 ? 'b2' : 'b1'}">${esc(b)}</span>`).join('')}</div>
      ${note('闭环路径：识文化 → 学文化 → 创文创 → 享社区，每一环由 AI 能力增强', 'as-foot')}</section>`;
  },
  flow(d) {
    return `<section class="slide">${chrome(5, '产品核心链路', d.claim)}
      <div class="flow-metrics">${d.metrics.map(m => statCard(m.v, m.l)).join('')}</div>
      <div class="lanes">${d.lanes.map((lane, li) => `
        <div class="lane"><span class="lane-tag l${li}">${esc(lane.lane)}</span>
          <div class="lane-steps">${lane.steps.map(st => `<div class="step">${esc(st)}</div>`).join('')}</div>
        </div>`).join('')}</div>
      <div class="flow-img">${imgCard(d.image, d.imageCaption)}</div>
      <div class="flow-sum">${d.metrics.map(m => `${m.v} ${m.l}`).join('　·　')}</div></section>`;
  },
  matrix(d) {
    return `<section class="slide">${chrome(6, '核心功能矩阵', d.claim)}
      <div class="tiles">${d.tiles.map(t => `
        <div class="tile"><div class="tile-v">${esc(t.v)}</div><div class="tile-l">${esc(t.l)}</div><div class="tile-d">${esc(t.d)}</div></div>`).join('')}</div>
      ${take(d.takeaway)}</section>`;
  },
  demo(d, no, k) {
    return `<section class="slide">${chrome(no, k, d.claim)}
      <div class="demo-body"><div class="demo-img">${imgCard(d.image)}</div>
      <div class="demo-side">${points(d.points)}</div></div>
      ${note(d.note || d.footnote, 'as-foot')}</section>`;
  },
  demo3(d) {
    return `<section class="slide">${chrome(9, 'DEMO ③ · 3D 文创定制', d.claim)}
      <div class="demo3-body">
        <div class="d3-main">${imgCard(d.image, '手账本 · 3D 旋转预览（GLB 50016 面）')}</div>
        <div class="d3-sub">${imgCard(d.image2, '书签 · GLB 5004 面', 'small')}</div>
        <div class="d3-side">${points(d.points)}</div>
      </div>
      ${note('本地 BFF（node:http 零依赖）承担 GLB UV 预处理 · 76 种策略自动展开贴图', 'as-foot')}
      ${note(d.footnote, 'as-foot')}</section>`;
  },
  demo4(d) {
    return `<section class="slide">${chrome(10, 'DEMO ④ · 文化体验四件套', d.claim)}
      <div class="demo4-grid">${d.grid.map(g => imgCard(g.img, `${g.label}｜${g.d}`)).join('')}</div>
      ${note(d.footnote, 'as-foot')}</section>`;
  },
  demo5(d) {
    return `<section class="slide">${chrome(11, 'DEMO ⑤ · 社区与画廊', d.claim)}
      <div class="demo5-body">
        <div class="d5-main">${imgCard(d.image, '文旅画廊 · 瀑布流 + 粒子背景')}</div>
        <div class="d5-right"><div class="d5-r1">${imgCard(d.image2, '创作者排行榜', 'small')}</div>${points(d.points)}</div>
      </div>
      ${note(d.note, 'as-foot')}</section>`;
  },
  arch(d) {
    const colors = ['#7C3AED', '#EC4899', '#0891B2', '#B45309'];
    return `<section class="slide">${chrome(12, '技术与系统架构', d.claim)}
      <div class="arch">${d.layers.map((L, i) => `
        <div class="alayer"><span class="aname" style="background:${colors[i]}">${esc(L.name)}</span>
          <div class="aitems">${L.items.map(it => `<span class="aitem">${esc(it)}</span>`).join('')}</div>
        </div>`).join('')}</div>
      <div class="arch-notes">${d.points.map(p => `<div class="anote">◆ ${esc(p)}</div>`).join('')}</div></section>`;
  },
  model(d) {
    return `<section class="slide">${chrome(13, '自研模型全链路 · 技术亮点', d.claim)}
      <div class="pipeline">${d.pipeline.map((p, i) => `
        <div class="pstep"><div class="p-num">${i + 1}</div><div class="p-t">${esc(p.t)}</div><div class="p-d">${esc(p.d)}</div></div>`).join('')}</div>
      <div class="model-bottom">
        <table class="cmp"><thead><tr>${d.compare[0].map(c => `<th>${esc(c)}</th>`).join('')}</tr></thead>
          <tbody>${d.compare.slice(1).map(r => `<tr>${r.map((c, ci) => `<td class="${ci === 2 ? 'win' : ci === 0 ? 'dim' : ''}">${esc(c)}</td>`).join('')}</tr>`).join('')}</tbody></table>
        <div class="model-img">${imgCard(d.image, '自研模型输出案例 · 凤凰古城 #13')}</div>
      </div>
      <div class="fallback">${esc(d.fallback)}</div></section>`;
  },
  engineering(d) {
    return `<section class="slide">${chrome(14, '工程化与创新点', d.claim)}
      <div class="eng-top">${chainHtml(d.chain)}<span class="chain-note">四级降级链 · 单点故障不影响可用性</span></div>
      <div class="eng-body">
        <div class="eng-cards">${d.cards.map(c => `<div class="ecard"><div class="ec-v">${esc(c.v)}</div><div class="ec-l">${esc(c.l)}</div><div class="ec-d">${esc(c.d)}</div></div>`).join('')}</div>
        <div class="eng-img">${imgCard(d.image, '管理后台 · 数据看板（10 模块 · 审计日志）')}</div>
      </div>
      ${note('创新点：四级降级链 · BFF UV 预处理 · AIGC 合规标识 · Sentry 生产监控', 'as-foot')}
      ${note('管理后台统一权限矩阵 + 操作全程留痕（_log 审计日志），逻辑/物理删除双模式', 'as-foot')}</section>`;
  },
  business(d) {
    return `<section class="slide">${chrome(15, '商业模式', d.claim)}
      <div class="freebar"><span class="fb-t">${esc(d.free.t)}</span><span class="fb-d">${esc(d.free.d)}</span></div>
      <div class="wheels">${d.wheels.map((w, i) => `
        <div class="wheel"><div class="w-key" style="color:${i ? T.accent2 : T.accent}">${esc(w.key)}</div>
          <div><div class="w-t">${esc(w.t)}</div><div class="w-price">${esc(w.price)}</div></div>
          <ul>${w.items.map(it => `<li>${esc(it)}</li>`).join('')}</ul>
        </div>`).join('')}</div>
      ${take(d.takeaway)}
      ${note('对标稿定设计 259/598 档位体系；B 端含专属知识库与 AI 讲解 API 接入能力', 'as-foot')}</section>`;
  },
  market(d) {
    return `<section class="slide">${chrome(16, '市场与竞争', d.claim)}
      <div class="mkt-grid">
        <div class="mkt-funnel">${funnelHtml(d.funnel)}</div>
        <table class="mcmp"><thead><tr>${d.compare[0].map(c => `<th>${esc(c)}</th>`).join('')}</tr></thead>
          <tbody>${d.compare.slice(1).map(r => `<tr>${r.map((c, ci) => `<td class="${ci === 3 ? 'win' : ci === 0 ? 'dim' : ''}">${esc(c)}</td>`).join('')}</tr>`).join('')}</tbody></table>
      </div>
      ${take(d.takeaway)}
      ${note('TAM 为公开数据；SAM / SOM 为推演口径', 'as-foot')}</section>`;
  },
  finance(d) {
    return `<section class="slide">${chrome(17, '财务预测与盈亏平衡', d.claim)}
      <div class="fin-label">毛利率 75% → 85% → 88%（自研推理零边际成本支撑）</div>
      <div class="fin-body"><div class="fin-chart">${financeSvg(d.chart)}</div><div class="fin-side">${points(d.points)}</div></div>
      ${note(d.footnote, 'as-foot')}</section>`;
  },
  team(d) {
    const colors = [T.accentDeep, T.accent2Deep, '#4C3B8F'];
    return `<section class="slide">${chrome(18, '团队与指导教师', d.claim)}
      <div class="members">${d.members.map((m, i) => `
        <div class="member"><div class="avatar" style="background:${colors[i]}">${esc(m.name.charAt(0))}</div>
          <div class="m-name">${esc(m.name)}</div><span class="m-role" style="background:${colors[i]}">${esc(m.role)}</span>
          <ul>${m.items.map(it => `<li>${esc(it)}</li>`).join('')}</ul>
        </div>`).join('')}</div>
      ${take(d.takeaway)}</section>`;
  },
  roadmap(d) {
    return `<section class="slide">${chrome(19, '发展规划与社会价值', d.claim)}
      <div class="timeline">${d.timeline.map((t, i) => `
        <div class="tnode"><div class="t-dot ${i === 0 ? 'hot' : ''}"></div><div class="t-t">${esc(t.t)}</div>
          <ul>${t.items.map(it => `<li>${esc(it)}</li>`).join('')}</ul></div>`).join('')}</div>
      <div class="values">${d.values.map(v => `<div class="value"><div class="v-t">${esc(v.t)}</div><div class="v-d">${esc(v.d)}</div></div>`).join('')}</div></section>`;
  },
  closing(d) {
    return `<section class="slide role-cover"><div class="glow g1"></div><div class="glow g4"></div>
      <div class="cover-inner">
        <div class="close-claim">${esc(d.claim)}</div>
        <div class="gradbar big"></div>
        <div class="close-thanks">${esc(d.thanks)}</div>
        <div class="cover-sub">${esc(d.sub)}</div>
        <div class="cover-credits">${esc(d.credits)}</div>
      </div>
      <footer><span class="f-brand">DREAMCORE</span><span class="f-mid">AI+文旅文创艺术共创社区 · 路演演示</span><span class="f-page">20 / 20</span></footer></section>`;
  },
};

const slideHtml = DECK.slides.map((d) => {
  if (d.id === 'demo1') return P.demo(d, 7, 'DEMO ① · AI 一键生成文创方案');
  if (d.id === 'demo2') return P.demo(d, 8, 'DEMO ② · AI 图生图重绘分镜');
  const fn = P[d.id];
  if (!fn) throw new Error('未注册模板: ' + d.id);
  return fn(d);
}).join('\n');

const css = `
*{box-sizing:border-box;margin:0;padding:0}
html,body{height:100%;background:#050310;overflow:hidden;font-family:'Microsoft YaHei','PingFang SC','Segoe UI',sans-serif}
.stage{position:fixed;inset:0;display:flex;align-items:center;justify-content:center;background:#050310}
.deck{position:relative;width:1280px;height:720px;background:${T.bg};overflow:hidden;transform-origin:center center;box-shadow:0 30px 90px rgba(0,0,0,.6)}
.slide{position:absolute;inset:0;display:none;color:${T.ink};padding:${M}px;background:${T.bg};overflow:hidden}
.slide.active{display:block}
.role-cover{background:${T.bgDeep}}
.glow{position:absolute;border-radius:50%;filter:blur(2px)}
.g1{width:600px;height:600px;right:-170px;top:-190px;background:rgba(124,58,237,.34)}
.g2{width:400px;height:400px;right:40px;top:-40px;background:rgba(236,72,153,.32)}
.g3{width:460px;height:460px;left:-160px;bottom:-180px;background:rgba(124,58,237,.28)}
.g4{width:460px;height:460px;left:-150px;bottom:-200px;background:rgba(236,72,153,.3)}
.cover-inner{position:relative;height:100%;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:16px}
.cover-inner .kicker{font-size:15px;letter-spacing:2px;color:${T.muted}}
.cover-title{font-size:92px;font-weight:800;color:#fff;letter-spacing:2px}
.cover-sub{font-size:30px;font-weight:700;color:${T.accent};letter-spacing:2px;margin-top:6px}
.cover-slogan{font-size:17px;color:${T.muted}}
.chips{display:flex;gap:14px;margin-top:10px}
.chip{background:${T.accentDeep};color:#fff;padding:8px 20px;border-radius:20px;font-size:14px;font-weight:600}
.chips .chip:nth-child(2){background:${T.accent2Deep}}
.chips .chip:nth-child(3){background:#4C3B8F}
.cover-credits{margin-top:26px;font-size:16px;color:${T.ink}}
.cover-footer{position:absolute;bottom:34px;font-size:12px;color:${T.page}}
.close-claim{font-size:44px;color:#fff;font-weight:800;text-align:center;padding:0 40px}
.close-thanks{font-size:17px;color:${T.muted};margin-top:26px}
header{padding-bottom:10px}
.kicker{font-size:12.5px;color:${T.accent};font-weight:700;letter-spacing:1.5px}
.claim{font-size:30px;font-weight:800;margin-top:6px;line-height:1.25}
.gradbar{width:120px;height:5px;margin-top:10px;background:linear-gradient(90deg,${T.accent},${T.accent2});border-radius:3px}
.gradbar.big{width:180px;height:6px;margin:0}
footer{position:absolute;left:${M}px;right:${M}px;bottom:22px;display:flex;align-items:center;font-size:11px;color:${T.page}}
.f-brand{font-weight:700;letter-spacing:1px}
.f-mid{margin:0 auto}
.f-page{font-weight:600}
.note{margin-top:12px;font-size:13.5px;color:${T.muted}}
.note.as-foot{position:absolute;left:${M}px;right:${M}px;bottom:${M}px;margin:0;font-size:12.5px}
.take{margin-top:16px;background:${T.surface2};border-radius:10px;padding:14px 18px;font-size:16.5px;font-weight:700;color:${T.gold}}
.points{display:flex;flex-direction:column;gap:14px}
.pt{display:flex;gap:14px;background:${T.surface};border-radius:10px;padding:14px 16px;border-left:4px solid ${T.accent}}
.pt-num{color:${T.accent};font-weight:800;font-size:15px;padding-top:1px}
.pt-t{font-size:16px;font-weight:700}
.pt-d{font-size:12.5px;color:${T.muted};margin-top:5px;line-height:1.5}
.imgcard{background:${T.surface};border-radius:12px;padding:8px;box-shadow:0 12px 30px rgba(0,0,0,.35)}
.imgcard img{width:100%;height:100%;object-fit:contain;border-radius:6px;display:block}
.imgcard figcaption{font-size:11.5px;color:${T.muted};text-align:center;padding:8px 4px 2px}
.imgcard.small{max-height:none}
.stat{background:${T.surface};border-radius:12px;padding:16px 18px}
.stat-v{font-size:26px;font-weight:800;color:${T.gold}}
.stat-l{font-size:14px;font-weight:700;margin-top:4px}
.stat-s{font-size:11px;color:${T.muted};margin-top:4px}
.pitch-body{display:grid;grid-template-columns:800px 1fr;gap:26px;margin-top:26px;height:540px}
.pitch-left{display:flex;flex-direction:column;gap:18px}
.points.tall{flex:1}
.points.tall .pt{padding:18px}
.points.tall .pt-t{font-size:17px}
.points.tall .pt-d{font-size:13px}
.stats{display:grid;grid-template-columns:repeat(3,1fr);gap:14px}
.pitch-right .imgcard{height:540px}
.pitch-right .imgcard img{object-fit:contain;height:100%}
.grid-2{display:grid;grid-template-columns:400px 1fr;gap:24px;margin-top:26px}
.stats-col{display:flex;flex-direction:column;gap:16px}
.stat.big .stat-v{font-size:31px}
.pains{display:flex;flex-direction:column;gap:13px}
.pain{display:flex;align-items:center;gap:16px;background:${T.surface};border-radius:12px;padding:17px 18px}
.pain-who{flex:0 0 190px;background:${T.accentDeep};color:#fff;font-weight:700;font-size:14.5px;text-align:center;padding:7px 0;border-radius:18px}
.pain-d{font-size:15.5px;line-height:1.5}
.quads{display:grid;grid-template-columns:1fr 1fr;gap:18px;margin-top:24px}
.quad{display:flex;gap:18px;background:${T.surface};border-radius:14px;padding:20px}
.q-key{font-size:46px;font-weight:800;color:${T.accent};line-height:1}
.q-t{font-size:18px;font-weight:800}
.q-d{font-size:12.5px;color:${T.muted};margin-top:8px;line-height:1.55}
.boards{display:flex;gap:14px;margin-top:20px;position:absolute;bottom:76px;left:${M}px;right:${M}px}
.board{flex:1;text-align:center;padding:10px 0;border-radius:22px;color:#fff;font-weight:700;font-size:14.5px}
.b1{background:${T.accentDeep}}.b2{background:${T.accent2Deep}}
.flow-metrics{display:grid;grid-template-columns:repeat(3,1fr);gap:14px;margin-top:20px;width:430px}
.flow-metrics .stat{padding:10px 14px}
.flow-metrics .stat-v{font-size:19px}
.lanes{display:flex;flex-direction:column;gap:14px;margin-top:22px;width:675px}
.lane{display:flex;align-items:center;gap:14px;background:${T.surface};border-radius:12px;padding:10px 14px}
.lane-tag{flex:0 0 84px;color:#fff;font-weight:700;font-size:13.5px;text-align:center;padding:8px 0;border-radius:16px}
.lane-tag.l0{background:#7C3AED}.lane-tag.l1{background:#0891B2}.lane-tag.l2{background:#B45309}
.lane-steps{display:flex;flex:1}
.step{flex:1;background:${T.surface2};border:1px solid ${T.line};margin-left:-1px;text-align:center;font-size:12.5px;font-weight:700;padding:11px 2px;clip-path:polygon(0 0,calc(100% - 12px) 0,100% 50%,calc(100% - 12px) 100%,0 100%,12px 50%);position:relative;color:${T.ink}}
.flow-img{position:absolute;right:${M}px;top:${M + 40}px;width:470px}
.flow-sum{position:absolute;left:${M}px;right:${M}px;bottom:84px;text-align:center;color:${T.gold};font-weight:700;font-size:14.5px}
.tiles{display:grid;grid-template-columns:repeat(4,1fr);gap:16px;margin-top:26px}
.tile{background:${T.surface};border-radius:12px;padding:18px 16px;min-height:190px}
.tile-v{font-size:26px;font-weight:800;color:${T.accent}}
.tile-l{font-size:14.5px;font-weight:700;margin-top:10px}
.tile-d{font-size:11.5px;color:${T.muted};margin-top:8px;line-height:1.55}
.demo-body{display:grid;grid-template-columns:755px 1fr;gap:26px;margin-top:26px;height:505px}
.demo-img .imgcard{height:505px}
.demo-img .imgcard img{height:100%}
.demo-side{overflow:auto}
.demo-body .pt{padding:17px 18px}
.demo-body .pt-t{font-size:17px}
.demo-body .pt-d{font-size:13px}
.demo3-body{display:grid;grid-template-columns:576px 300px 1fr;gap:20px;margin-top:26px;height:455px}
.d3-main .imgcard{height:455px}
.d3-sub .imgcard{height:275px}
.d3-side .pt{padding:12px 14px;gap:10px}
.d3-side .pt-t{font-size:14.5px}
.d3-side .pt-d{font-size:11.5px}
.demo4-grid{display:grid;grid-template-columns:repeat(2,1fr);gap:16px;margin-top:26px}
.demo4-grid .imgcard{height:205px}
.demo4-grid figcaption{font-size:13px}
.demo5-body{display:grid;grid-template-columns:720px 1fr;gap:24px;margin-top:26px;height:505px}
.d5-main .imgcard{height:505px}
.d5-right{display:flex;flex-direction:column;gap:16px}
.d5-r1 .imgcard{height:230px}
.arch{display:flex;flex-direction:column;gap:15px;margin-top:26px}
.alayer{display:flex;align-items:center;gap:16px;background:${T.surface};border-radius:12px;padding:13px 16px}
.aname{flex:0 0 150px;color:#fff;font-weight:800;font-size:14.5px;text-align:center;padding:12px 0;border-radius:20px}
.aitems{display:flex;gap:10px;flex:1}
.aitem{flex:1;background:${T.surface2};border-radius:8px;text-align:center;font-size:12.5px;font-weight:700;padding:14px 4px}
.arch-notes{display:flex;gap:26px;position:absolute;left:${M}px;right:${M}px;bottom:60px;font-size:12.5px;color:${T.muted}}
.pipeline{display:grid;grid-template-columns:repeat(5,1fr);gap:14px;margin-top:26px}
.pstep{background:${T.surface};border-radius:12px;padding:15px 14px;min-height:150px;position:relative}
.p-num{color:${T.accent};font-weight:800;font-size:16px}
.p-t{font-weight:800;font-size:15px;margin-top:8px}
.p-d{font-size:10.5px;color:${T.muted};margin-top:7px;line-height:1.5}
.model-bottom{display:grid;grid-template-columns:1fr 250px;gap:20px;margin-top:20px}
.cmp{width:100%;border-collapse:collapse;font-size:13px}
.cmp th{background:${T.accentDeep};color:#fff;padding:11px 10px;font-weight:700}
.cmp td{padding:11px 10px;border-bottom:1px solid ${T.line};text-align:center}
.cmp td:first-child{text-align:left;color:${T.gold};font-weight:700}
.cmp tr:nth-child(even) td{background:${T.surface2}}tr:nth-child(odd) td{background:${T.surface}}
.cmp td.win{color:${T.ink};font-weight:700}
.cmp td.dim{color:${T.muted}}
.model-img .imgcard{height:238px}
.fallback{margin-top:16px;background:${T.surface2};border-radius:10px;padding:14px 18px;font-size:14.5px;font-weight:700;color:${T.positive}}
.eng-top{display:flex;align-items:center;gap:20px;margin-top:24px}
.chain{display:flex}
.chain-item{color:#fff;font-weight:700;font-size:13.5px;padding:12px 22px;clip-path:polygon(0 0,calc(100% - 14px) 0,100% 50%,calc(100% - 14px) 100%,0 100%,14px 50%);margin-left:-7px}
.chain-item:first-child{margin-left:0;clip-path:polygon(0 0,calc(100% - 14px) 0,100% 50%,calc(100% - 14px) 100%,0 100%)}
.chain-note{font-size:13px;color:${T.muted}}
.eng-body{display:grid;grid-template-columns:810px 1fr;gap:20px;margin-top:22px}
.eng-cards{display:grid;grid-template-columns:repeat(3,1fr);gap:12px}
.ecard{background:${T.surface};border-radius:10px;padding:13px 14px}
.ec-v{font-size:18px;font-weight:800;color:${T.accent}}
.ec-l{font-size:13px;font-weight:700;margin-top:5px}
.ec-d{font-size:10.5px;color:${T.muted};margin-top:5px;line-height:1.4}
.eng-img .imgcard{height:290px}
.freebar{display:flex;align-items:center;gap:20px;background:${T.surface};border-radius:12px;padding:15px 20px;margin-top:24px}
.fb-t{font-size:15.5px;font-weight:700;color:${T.muted};flex:0 0 120px}
.fb-d{font-size:13.5px;color:${T.muted}}
.wheels{display:grid;grid-template-columns:1fr 1fr;gap:22px;margin-top:20px}
.wheel{background:${T.surface};border-radius:14px;padding:22px;display:flex;gap:16px;position:relative}
.w-key{font-size:42px;font-weight:800;line-height:1}
.w-t{font-size:18px;font-weight:800}
.w-price{font-size:28px;font-weight:800;color:${T.gold};margin-top:6px}
.wheel ul{position:absolute;left:78px;top:130px;right:22px;list-style:none}
.wheel li{font-size:13.5px;padding:7px 0;border-bottom:1px dashed ${T.line}}
.mkt-grid{display:grid;grid-template-columns:400px 1fr;gap:24px;margin-top:26px}
.funnel{display:flex;flex-direction:column;align-items:center;gap:14px}
.flevel{border-radius:12px;padding:15px 20px;color:#fff;text-align:center}
.fl-a{font-size:13.5px;font-weight:700;opacity:.92}
.fl-b{font-size:26px;font-weight:800;margin-top:5px}
.fl-c{font-size:11px;opacity:.85;margin-top:4px}
.mcmp{width:100%;border-collapse:collapse;font-size:12.5px}
.mcmp th{background:${T.accentDeep};color:#fff;padding:12px 8px;font-weight:700;font-size:13px}
.mcmp td{padding:12px 8px;border-bottom:1px solid ${T.line};text-align:center}
.mcmp td:first-child{text-align:left;color:${T.gold};font-weight:700}
.mcmp tr:nth-child(even) td{background:${T.surface2}}tr:nth-child(odd) td{background:${T.surface}}
.mcmp td.win{color:${T.accent};font-weight:800}
.mcmp td.dim{color:${T.muted}}
.fin-label{color:${T.gold};font-weight:700;font-size:14px;margin-top:-6px}
.fin-body{display:grid;grid-template-columns:740px 1fr;gap:24px;margin-top:14px}
.fin-chart{background:${T.surface};border-radius:14px;padding:14px}
.chart{width:100%;display:block}
.fin-side .pt{padding:14px 16px}
.members{display:grid;grid-template-columns:repeat(3,1fr);gap:20px;margin-top:30px}
.member{background:${T.surface};border-radius:16px;padding:26px 22px;text-align:center;box-shadow:0 14px 30px rgba(0,0,0,.3)}
.avatar{width:84px;height:84px;border-radius:50%;margin:0 auto;color:#fff;font-size:38px;font-weight:800;display:flex;align-items:center;justify-content:center;border:2px solid ${T.line}}
.m-name{font-size:22px;font-weight:800;margin-top:16px}
.m-role{display:inline-block;color:#fff;font-size:13px;font-weight:700;padding:6px 18px;border-radius:16px;margin-top:10px}
.member ul{list-style:none;margin-top:16px;text-align:left}
.member li{font-size:13px;color:${T.ink};padding:6px 0;border-bottom:1px dashed ${T.line}}
.timeline{display:grid;grid-template-columns:repeat(4,1fr);gap:18px;margin-top:34px;position:relative}
.timeline::before{content:'';position:absolute;left:26px;right:26px;top:8px;height:2px;background:${T.line}}
.tnode{position:relative;padding-top:30px}
.t-dot{position:absolute;top:0;left:0;width:16px;height:16px;border-radius:50%;background:${T.accent};border:3px solid ${T.bg}}
.t-dot.hot{background:${T.accent2}}
.t-t{font-size:14px;font-weight:800;line-height:1.4}
.tnode ul{list-style:none;margin-top:10px}
.tnode li{font-size:11.5px;color:${T.muted};padding:4.5px 0;border-bottom:1px dashed ${T.line}}
.values{display:grid;grid-template-columns:repeat(3,1fr);gap:18px;margin-top:30px}
.value{background:${T.surface};border-radius:12px;padding:20px}
.v-t{font-size:16px;font-weight:800;color:${T.accent2}}
.v-d{font-size:12.5px;color:${T.ink};margin-top:10px;line-height:1.6}
.ctrl{position:fixed;left:50%;bottom:18px;transform:translateX(-50%);display:flex;align-items:center;gap:14px;background:rgba(20,17,43,.85);border:1px solid ${T.line};border-radius:28px;padding:8px 18px;z-index:50}
.ctrl button{background:none;border:none;color:${T.muted};font-size:16px;cursor:pointer;padding:4px 10px}
.ctrl button:hover{color:#fff}
.dots{display:flex;gap:6px}
.dot{width:8px;height:8px;border-radius:50%;background:${T.line};cursor:pointer;transition:.2s}
.dot.active{background:${T.accent2};transform:scale(1.35)}
`;

const html = `<!DOCTYPE html>
<html lang="zh-CN">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>Dreamcore · AI+文旅文创艺术共创社区 路演演示</title>
<style>${css}</style>
</head>
<body>
<div class="stage">
  <div class="deck" id="deck">${slideHtml}</div>
</div>
<div class="ctrl">
  <button id="prev" aria-label="上一页">◀</button>
  <div class="dots" id="dots"></div>
  <button id="next" aria-label="下一页">▶</button>
</div>
<script>
(function(){
  var deck=document.getElementById('deck');
  var slides=Array.prototype.slice.call(deck.querySelectorAll('.slide'));
  var dotsBox=document.getElementById('dots');
  var cur=0;
  slides.forEach(function(_,i){ if(i>0) return; });
  var dots=[];
  slides.forEach(function(s,i){
    var d=document.createElement('div'); d.className='dot'+(i===0?' active':''); d.title=(i+1)+' / '+slides.length;
    d.addEventListener('click',function(){ go(i); });
    dotsBox.appendChild(d); dots.push(d);
  });
  function go(i){
    i=Math.max(0,Math.min(slides.length-1,i));
    slides[cur].classList.remove('active'); dots[cur].classList.remove('active');
    cur=i;
    slides[cur].classList.add('active'); dots[cur].classList.add('active');
  }
  function scale(){
    var s=Math.min(window.innerWidth/1280,window.innerHeight/720);
    deck.style.transform='scale('+s+')';
  }
  window.addEventListener('resize',scale);
  document.getElementById('next').addEventListener('click',function(){go(cur+1);});
  document.getElementById('prev').addEventListener('click',function(){go(cur-1);});
  document.addEventListener('keydown',function(e){
    if(e.key==='ArrowRight'||e.key===' '||e.key==='PageDown'){e.preventDefault();go(cur+1);}
    else if(e.key==='ArrowLeft'||e.key==='PageUp'){e.preventDefault();go(cur-1);}
    else if(e.key==='Home'){go(0);} else if(e.key==='End'){go(slides.length-1);}
    else if(e.key==='f'||e.key==='F'){toggleFull();}
  });
  function toggleFull(){ if(!document.fullscreenElement){document.documentElement.requestFullscreen&&document.documentElement.requestFullscreen();} else {document.exitFullscreen&&document.exitFullscreen();} }
  scale();
})();
</script>
</body>
</html>`;

fs.writeFileSync(OUT, html, 'utf8');
const kb = Math.round(fs.statSync(OUT).size / 1024);
console.log(`HTML 已生成: ${OUT} (${(kb / 1024).toFixed(2)} MB, 20 页)`);