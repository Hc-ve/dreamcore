// ============================================================
// data/culture-badges.js — 文化探索足迹徽章定义
// 用途：culture-footprint.js 徽章墙渲染与分级判定
// 分级：铜（任一行为）/ 银（两种行为）/ 金（三种行为全解锁）
// 行为类型：view（浏览主题作品）/ craft（创作主题文创）/ scan（AI 识图识别）
// ============================================================

export const FOOTPRINT_ACTIONS = {
  view: { id: 'view', label: '浏览', icon: '👁', desc: '浏览该文化主题的作品详情' },
  craft: { id: 'craft', label: '创作', icon: '🎨', desc: '创作并保存该主题的文创作品' },
  scan: { id: 'scan', label: '识图', icon: '🔍', desc: 'AI 识图识别出该文化主题' }
};

/** 徽章等级判定 */
export function badgeLevel(actions) {
  const n = actions ? actions.length : 0;
  if (n >= 3) return { level: 'gold', label: '金', icon: '🥇', desc: '识·创·览 三重解锁' };
  if (n === 2) return { level: 'silver', label: '银', icon: '🥈', desc: '两种探索行为' };
  if (n === 1) return { level: 'bronze', label: '铜', icon: '🥉', desc: '初识此文化' };
  return { level: 'none', label: '未点亮', icon: '·', desc: '尚未探索' };
}

/** 徽章分组（文化版图分区展示；扩展组来自 EXTENDED_THEMES，方案 A） */
import { EXTENDED_THEMES } from './culture-knowledge.js';

export const BADGE_GROUPS = [
  { id: 'northwest', name: '西北 · 丝路遗珍', themeIds: ['dunhuang'] },
  { id: 'southwest', name: '西南 · 巴蜀苗岭', themeIds: ['sanxingdui', 'miaoyin'] },
  { id: 'central', name: '中原 · 秦汉唐韵', themeIds: ['bingmayong', 'tangsancai'] },
  { id: 'east', name: '江南 · 水墨匠心', themeIds: ['huipai', 'qinghua', 'suxiu', 'lanan'] },
  { id: 'capital', name: '京华 · 国粹风华', themeIds: ['gugong', 'jingju'] },
  { id: 'folk', name: '民间 · 指尖非遗', themeIds: ['piying'] },
  { id: 'frontier', name: '华夏 · 星罗棋布（联网讲解）', themeIds: EXTENDED_THEMES.map(t => t.themeId) }
];

/**
 * 主题发源地坐标（高德地图 JS API：[lng, lat]）
 * 用于 culture-footprint.js 文化版图标记（学生参赛非商用，免费额度）
 */
export const THEME_LOCATIONS = {
  dunhuang:    { lng: 94.661,  lat: 40.035, place: '甘肃敦煌·莫高窟' },
  sanxingdui:  { lng: 104.202, lat: 30.993, place: '四川广汉·三星堆' },
  huipai:      { lng: 118.438, lat: 29.872, place: '安徽歙县·徽州古城' },
  qinghua:     { lng: 117.215, lat: 29.270, place: '江西景德镇' },
  bingmayong:  { lng: 109.278, lat: 34.384, place: '陕西西安·秦始皇帝陵' },
  piying:      { lng: 109.502, lat: 34.512, place: '陕西渭南·华县' },
  miaoyin:     { lng: 108.077, lat: 26.379, place: '贵州黔东南·雷山' },
  jingju:      { lng: 116.437, lat: 39.960, place: '北京' },
  tangsancai:  { lng: 112.454, lat: 34.619, place: '河南洛阳' },
  gugong:      { lng: 116.397, lat: 39.918, place: '北京·故宫' },
  suxiu:       { lng: 120.352, lat: 31.300, place: '江苏苏州·镇湖' },
  lanan:       { lng: 120.865, lat: 32.016, place: '江苏南通' }
};

/** 每主题徽章定义（icon 用 emoji，正式版可替换为 SVG） */
export const CULTURE_BADGES = {
  dunhuang: { icon: '🪷', name: '飞天守护者', desc: '识读敦煌壁画里的千年飞天' },
  sanxingdui: { icon: '🎭', name: '古蜀探秘人', desc: '与纵目面具对视三千年' },
  huipai: { icon: '🏘', name: '徽州行旅者', desc: '走过粉墙黛瓦马头墙' },
  qinghua: { icon: '🏺', name: '青韵收藏家', desc: '读懂天青色等烟雨' },
  bingmayong: { icon: '⚔️', name: '秦阵见证者', desc: '面见地下军团的沉默' },
  piying: { icon: '🎬', name: '光影传灯人', desc: '看灯影里叙说千古事' },
  miaoyin: { icon: '🦋', name: '苗岭银匠友', desc: '听蝴蝶妈妈的传说' },
  jingju: { icon: '🎭', name: '梨园知音客', desc: '辨红忠白奸的油彩' },
  tangsancai: { icon: '🐪', name: '丝路驼铃伴', desc: '随三彩驼队入长安' },
  gugong: { icon: '🏯', name: '紫禁访古人', desc: '数尽九千九百九十九间半' },
  suxiu: { icon: '🧵', name: '针尖艺术家', desc: '看清劈成六十四分的丝线' },
  lanan: { icon: '🌀', name: '靛蓝调色师', desc: '等一缸靛蓝自然发酵' }
};
