// ============================================================
// js/icons.js — Dreamcore 文化图标体系（P1-2 2026-10-16）
// 12 枚内联 SVG 图标，stroke=currentColor 跟随父元素着色
// 替换 emoji 在画廊评级 / AI评分 / 图鉴卡片中的跨平台不一致问题
// ============================================================

const _SVG = (inner) =>
  `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" focusable="false">${inner}</svg>`;

export const icons = {
  // —— 笔墨纸砚 ——
  brush: _SVG(`<path d="M3 21c2-1 4-3 5-5s3-5 4-7"/><path d="M12 9l4-4 2 2-4 4"/><path d="M15 6l3 3"/>`),
  ink:   _SVG(`<path d="M7 4h8a2 2 0 0 1 2 2v2H5V6a2 2 0 0 1 2-2z"/><path d="M5 8v10a2 2 0 0 0 2 2h8a2 2 0 0 0 2-2V8"/><circle cx="9" cy="13" r="1.2"/><path d="M9 14.2V18"/>`),
  paper: _SVG(`<path d="M6 3h9l4 4v13a1 1 0 0 1-1 1H6a1 1 0 0 1-1-1V4a1 1 0 0 1 1-1z"/><path d="M14 3v4h4"/><path d="M9 12h7M9 16h5"/>`),
  inkstone: _SVG(`<ellipse cx="12" cy="13" rx="8" ry="4"/><path d="M4 13c0 2 2 4 8 4s8-2 8-4"/><ellipse cx="12" cy="12" rx="4" ry="1.6"/>`),

  // —— 山水云纹 ——
  mountain: _SVG(`<path d="M3 19l5-8 4 5 3-4 6 7"/><path d="M3 19h18"/>`),
  cloud: _SVG(`<path d="M7 17a4 4 0 0 1 .5-7.9A5 5 0 0 1 17 12a3 3 0 0 1 0 6H7z"/>`),
  wave: _SVG(`<path d="M3 12c2-1 4-1 6 0s4 1 6 0 4-1 6 0"/><path d="M3 17c2-1 4-1 6 0s4 1 6 0 4-1 6 0"/>`),

  // —— 印章瓦当 ——
  seal:  _SVG(`<rect x="4" y="4" width="16" height="16" rx="2"/><path d="M9 9h6v6H9z"/><path d="M9 9l6 6"/>`),
  tile:  _SVG(`<circle cx="12" cy="12" r="8"/><path d="M4 12h16M12 4v16"/><path d="M6 6l12 12M18 6L6 18"/>`),

  // —— 丝竹 ——
  silk:  _SVG(`<path d="M4 7c4-2 12-2 16 0"/><path d="M4 12c4-2 12-2 16 0"/><path d="M4 17c4-2 12-2 16 0"/><path d="M4 7v10M20 7v10"/>`),
  bamboo:_SVG(`<path d="M7 3v18M17 3v18"/><path d="M5 8h4M15 8h4M5 14h4M15 14h4"/><path d="M7 3c4 0 10 0 10 0"/>`),

  // —— 锦绣 ——
  brocade: _SVG(`<path d="M3 7l3-4 3 4 3-4 3 4 3-4 3 4"/><path d="M3 12l3-4 3 4 3-4 3 4 3-4 3 4"/><path d="M3 17l3-4 3 4 3-4 3 4 3-4 3 4"/><path d="M3 17h18"/>`),

  // —— 窑火 ——
  kiln: _SVG(`<path d="M12 3c2 3 3 4 3 6a3 3 0 1 1-6 0c0-1 1-2 2-3s1-2 1-3z"/><path d="M7 18h10"/>`),

  // —— 榫卯 ——
  joinery: _SVG(`<rect x="3" y="9" width="10" height="6" rx="1"/><rect x="11" y="7" width="10" height="10" rx="1"/><path d="M7 9v6M15 7v10"/>`),

  // —— 茶盏 ——
  tea: _SVG(`<path d="M5 8h11v5a4 4 0 0 1-4 4H9a4 4 0 0 1-4-4V8z"/><path d="M16 10h3a2 2 0 0 1 0 4h-3"/><path d="M8 4c0 1 .5 2 1 2M12 4c0 1 .5 2 1 2"/>`),

  // —— 团扇 ——
  fan: _SVG(`<circle cx="12" cy="10" r="7"/><path d="M12 17v4"/><path d="M7 10h10M12 5v10"/>`),

  // —— 铜镜 ——
  mirror: _SVG(`<circle cx="12" cy="12" r="7"/><circle cx="12" cy="12" r="3"/><path d="M12 3v2M12 19v2M3 12h2M19 12h2"/>`),

  // —— 纹样（如意云头 / 回纹）——
  pattern: _SVG(`<path d="M4 8h6v4H4zM10 12h4v4h-4zM14 8h6v4h-6z"/><path d="M6 6c0-1 1-2 2-2s2 1 2 2"/>`),

  // —— 评级专用（与文化主题独立）——
  crown:  _SVG(`<path d="M3 18h18"/><path d="M4 18l2-9 4 4 2-6 2 6 4-4 2 9"/>`),
  trophy: _SVG(`<path d="M8 4h8v4a4 4 0 0 1-8 0V4z"/><path d="M5 6H3v2a3 3 0 0 0 3 3"/><path d="M19 6h2v2a3 3 0 0 1-3 3"/><path d="M9 14h6v3H9zM11 17v3h2v-3"/>`),
  sparkle:_SVG(`<path d="M12 3v18M3 12h18"/><path d="M6 6l12 12M18 6L6 18"/>`),
  star:   _SVG(`<path d="M12 3l2.8 5.7 6.2.9-4.5 4.4 1 6.2L12 17l-5.5 3.2 1-6.2L3 9.6l6.2-.9z"/>`),
  target: _SVG(`<circle cx="12" cy="12" r="8"/><circle cx="12" cy="12" r="4"/><circle cx="12" cy="12" r="1.5"/>`),
  leaf:   _SVG(`<path d="M4 20c0-8 6-14 16-16-2 10-8 16-16 16z"/><path d="M4 20L20 4"/>`),
  sprout: _SVG(`<path d="M12 20V10"/><path d="M12 10c-3 0-5-2-5-5 3 0 5 2 5 5z"/><path d="M12 12c3 0 5-2 5-5-3 0-5 2-5 5z"/>`),

  // —— 奖牌（leaderboard 印章已改为汉字"一/二/三"，此处备用于徽章体系）——
  medalGold:   _SVG(`<circle cx="12" cy="9" r="5"/><path d="M8 13l-2 8 6-3 6 3-2-8"/><path d="M10 9l1 1 3-3"/>`),
  medalSilver: _SVG(`<circle cx="12" cy="9" r="5"/><path d="M8 13l-2 8 6-3 6 3-2-8"/>`),
  medalBronze: _SVG(`<circle cx="12" cy="9" r="5"/><path d="M8 13l-2 8 6-3 6 3-2-8"/>`)
};

/**
 * 取图标 SVG 字符串
 * @param {string} name - icons 键名，如 'seal' / 'brush' / 'mountain'
 * @returns {string} 内联 SVG；找不到时返回空串
 */
export function getIcon(name) {
  if (!name) return '';
  return icons[name] || '';
}

/**
 * 将旧 emoji 字符映射到文化图标键（供渲染层替换 data 文件里的 emoji 字段）
 * @param {string} emoji - 原 emoji 字符
 * @returns {string} 图标键名，未命中则回传原值
 */
const EMOJI_MAP = {
  '🗿': 'mountain',
  '🌸': 'pattern',
  '🌿': 'leaf',
  '🎨': 'brush',
  '💎': 'sparkle',
  '✨': 'sparkle',
  '🏆': 'trophy',
  '👑': 'crown',
  '🥇': 'medalGold',
  '🥈': 'medalSilver',
  '🥉': 'medalBronze',
  '📜': 'paper',
  '📍': 'mirror',
  '⚖️': 'joinery'
};

export function fromEmoji(emoji) {
  return (emoji && EMOJI_MAP[emoji]) ? EMOJI_MAP[emoji] : emoji;
}

/**
 * 直接返回替换后的 HTML（字符串里已包含 SVG）
 * 用法：把原来 `<span class="icon">${badge.icon}</span>` 改为
 *       `<span class="icon" style="color:inherit">${iconHtml(badge.icon)}</span>`
 */
export function iconHtml(raw) {
  if (!raw) return '';
  const key = EMOJI_MAP[raw];
  if (key) return icons[key] || raw;
  // 已经是键名（非 emoji）
  if (icons[raw]) return icons[raw];
  return raw;
}
