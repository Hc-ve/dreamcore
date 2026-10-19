// ============================================================
// js/scenic-recommend.js — 智慧导览（热门景点模块 v2）
// 路由 #/scenic，三级交互（参考「文旅山应官」形态）：
//   ① 景区列表：搜索（景区/地区/景点名）+ 河南/全国筛选 + 当前景区徽标
//   ② 景区详情：景区讲解（知识库事实卡 / AI 联网讲解）+ 热门景点
//      + 主题路线（站点序列）+ 智能行程定制（纯规则引擎 P1-1）
//      + 游客攻略共创（IndexedDB 本地版 P1-5）+ 打卡进度
//      + 高德 mini 地图 + 创作引流
//   ③ 景点详情：AI 语音讲解（culture-story + TTS）+ 景点介绍 + 站内路线规划
//      （AMap.Walking 路网画线；山路无路网时降级直线示意路线）+ 游客点评
//      + 高德 URI 深链兜底 + 浏览即打卡（IndexedDB 幂等点亮）
//      + 分享打卡引流（SharePoster P0-4：打卡卡 Canvas → 海报）
// 数据源：data/scenic-spots.js（26 景区 × 4-6 景点）+ culture-knowledge.js
// ============================================================

import { getPublicArtworks, recordFootprint, getFootprintsByUser, addScenicGuide, getScenicGuidesByArea } from './db.js';
import { getThemeById, hasFactCard, matchArtworksByTheme } from '../data/culture-knowledge.js';
import { THEME_LOCATIONS, CULTURE_BADGES } from '../data/culture-badges.js';
import { SCENIC_AREAS, SCENIC_AREA_COUNT, SCENIC_SPOT_COUNT, getAreaById } from '../data/scenic-spots.js';
import { getScenicCraft } from '../data/scenic-craft-map.js';

const AMAP_KEY = '7c8b5ee16ce9957aae0b45c664bbd74b';
const CURRENT_AREA_KEY = 'scenic-current-area';

let overlayEl = null;
let currentAreaId = null;    // 当前视图景区
let currentSpotId = null;    // 当前视图景点（null = 非景点详情）
let currentStory = null;     // 景区/景点 AI 讲解缓存（供创作引流）
let lastAreaId = null;       // 最近浏览过的景区（列表「当前」徽标内存兜底）
let visitedSet = new Set();  // 已打卡景点 id 集合
let visitedLoaded = false;
let mapInstance = null;
let mapKey = null;           // 当前地图实例绑定的视图 key
const filters = { q: '', region: 'all' }; // region: all | henan | national

// ------------------------------------------------------------
// 样式注入（青绿主色，参考图配色）
// ------------------------------------------------------------
function _injectStyle() {
  if (document.getElementById('scenic-recommend-style')) return;
  const st = document.createElement('style');
  st.id = 'scenic-recommend-style';
  st.textContent = `
    .scenic-page-box { max-width: 1080px; width: 94%; max-height: 88vh; overflow-y: auto; padding: 28px; }
    .sn-head { display: flex; align-items: flex-start; justify-content: space-between; gap: 12px; flex-wrap: wrap; }
    .sn-title { margin: 0 0 4px; font-size: 1.45rem; }
    .sn-sub { margin: 0; font-size: .88rem; opacity: .75; }
    .sn-toolbar { display: flex; gap: 10px; align-items: center; margin: 16px 0 14px; flex-wrap: wrap; }
    .sn-search { flex: 1; min-width: 220px; display: flex; align-items: center; gap: 8px; padding: 8px 14px; border-radius: 12px; border: 1px solid var(--border-color, rgba(255,255,255,.18)); background: var(--card-bg, rgba(255,255,255,.05)); }
    .sn-search input { flex: 1; background: transparent; border: none; outline: none; color: inherit; font-size: .9rem; min-width: 0; }
    .sn-search i { opacity: .55; }
    .sn-chips { display: flex; gap: 8px; flex-wrap: wrap; }
    .sn-chip { padding: 6px 16px; border-radius: 16px; font-size: .82rem; cursor: pointer; border: 1px solid var(--border-color, rgba(255,255,255,.18)); background: transparent; color: var(--text, #eee); transition: all .18s; }
    .sn-chip:hover { border-color: #34d399; }
    .sn-chip.active { background: rgba(52,211,153,.2); border-color: rgba(52,211,153,.6); color: #6ee7b7; }
    .sn-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(240px, 1fr)); gap: 14px; }
    .sn-card { position: relative; cursor: pointer; border-radius: 14px; padding: 16px 16px 14px; background: var(--card-bg, rgba(255,255,255,.06)); border: 1px solid var(--border-color, rgba(255,255,255,.1)); transition: transform .2s, border-color .2s, box-shadow .2s; }
    .sn-card:hover { transform: translateY(-3px); border-color: rgba(52,211,153,.55); box-shadow: 0 8px 24px rgba(52,211,153,.16); }
    .sn-card.current { border-color: rgba(52,211,153,.65); background: rgba(52,211,153,.08); }
    .sn-card-icon { font-size: 1.6rem; margin-bottom: 8px; }
    .sn-card-name { font-size: 1.02rem; font-weight: 800; margin-bottom: 4px; padding-right: 44px; }
    .sn-card-region { font-size: .78rem; opacity: .7; margin-bottom: 6px; }
    .sn-card-slogan { font-size: .8rem; opacity: .85; margin-bottom: 8px; line-height: 1.5; }
    .sn-card-tags { display: flex; gap: 6px; flex-wrap: wrap; }
    .sn-tag { font-size: .7rem; padding: 2px 9px; border-radius: 10px; background: rgba(52,211,153,.14); border: 1px solid rgba(52,211,153,.32); }
    .sn-card-spots { font-size: .74rem; opacity: .75; margin-top: 8px; display: flex; gap: 10px; flex-wrap: wrap; }
    .sn-card-spots b { color: #6ee7b7; }
    .sn-cur-badge { position: absolute; top: 12px; right: 12px; font-size: .68rem; padding: 3px 10px; border-radius: 12px; color: #6ee7b7; background: rgba(52,211,153,.16); border: 1px solid rgba(52,211,153,.45); }
    .sn-empty { grid-column: 1 / -1; text-align: center; padding: 40px 0; opacity: .65; font-size: .9rem; }
    /* 景区详情 */
    .sn-back { margin-bottom: 14px; }
    .sn-detail-head { display: flex; align-items: center; gap: 14px; flex-wrap: wrap; }
    .sn-detail-icon { font-size: 2.4rem; }
    .sn-detail-name { margin: 0; font-size: 1.5rem; font-weight: 800; }
    .sn-meta { margin: 10px 0 0; font-size: .84rem; opacity: .8; display: flex; gap: 14px; flex-wrap: wrap; }
    .sn-meta span i { margin-right: 4px; }
    .sn-switch-btn { margin-left: auto; }
    .sn-checkin-bar { display: flex; align-items: center; gap: 12px; margin-top: 16px; padding: 12px 16px; border-radius: 12px; background: rgba(52,211,153,.08); border: 1px solid rgba(52,211,153,.28); font-size: .86rem; flex-wrap: wrap; }
    .sn-checkin-bar b { color: #6ee7b7; font-size: 1rem; }
    .sn-progress { flex: 1; min-width: 120px; height: 8px; border-radius: 4px; background: rgba(255,255,255,.1); overflow: hidden; }
    .sn-progress-bar { height: 100%; border-radius: 4px; background: linear-gradient(90deg, #10b981, #6ee7b7); transition: width .4s; }
    .sn-section { margin-top: 20px; }
    .sn-section-title { font-size: 1rem; font-weight: 800; margin: 0 0 10px; display: flex; align-items: center; gap: 8px; }
    .sn-fact { display: flex; gap: 10px; margin-bottom: 10px; font-size: .9rem; line-height: 1.75; }
    .sn-fact i { color: #34d399; margin-top: 5px; flex-shrink: 0; }
    .sn-legend { margin: 12px 0 0; padding: 12px 14px; border-radius: 10px; background: rgba(251,191,36,.08); border-left: 3px solid #fbbf24; font-size: .88rem; line-height: 1.75; }
    .sn-tip { margin-top: 12px; padding: 12px 14px; border-radius: 10px; background: rgba(52,211,153,.08); border-left: 3px solid #34d399; font-size: .86rem; line-height: 1.7; }
    .sn-tts-row { margin-top: 16px; }
    .sn-source-badge { display: inline-flex; align-items: center; gap: 6px; font-size: .78rem; padding: 4px 12px; border-radius: 12px; margin-top: 14px; }
    .sn-source-badge.kb { color: #34d399; background: rgba(52,211,153,.1); border: 1px solid rgba(52,211,153,.35); }
    .sn-source-badge.ai { color: #fbbf24; background: rgba(251,191,36,.1); border: 1px solid rgba(251,191,36,.35); }
    /* B1 讲解溯源卡片：核心主题=蓝色系「平台知识库」，扩展/无 facts=橙色系「AI 联网生成」 */
    .trace-card { margin-top: 14px; padding: 12px 14px; border-radius: 12px; font-size: .84rem; }
    .trace-card.kb { background: rgba(96,165,250,.09); border: 1px solid rgba(96,165,250,.35); }
    .trace-card.ai { background: rgba(251,191,36,.08); border: 1px solid rgba(251,191,36,.35); }
    .trace-head { display: flex; align-items: center; justify-content: space-between; gap: 8px; flex-wrap: wrap; }
    .trace-badge { display: inline-flex; align-items: center; gap: 6px; font-size: .76rem; font-weight: 700; padding: 3px 10px; border-radius: 10px; }
    .trace-card.kb .trace-badge { color: #60a5fa; background: rgba(96,165,250,.14); border: 1px solid rgba(96,165,250,.4); }
    .trace-card.ai .trace-badge { color: #fbbf24; background: rgba(251,191,36,.12); border: 1px solid rgba(251,191,36,.4); }
    .trace-link { font-size: .78rem; font-weight: 700; text-decoration: none; }
    .trace-card.kb .trace-link { color: #60a5fa; }
    .trace-card.ai .trace-link { color: #fbbf24; }
    .trace-link:hover { text-decoration: underline; }
    .trace-theme { margin-top: 8px; font-size: .95rem; font-weight: 800; }
    .trace-chips { display: flex; gap: 6px; flex-wrap: wrap; margin-top: 6px; }
    .trace-chip { display: inline-flex; align-items: center; gap: 5px; max-width: 100%; padding: 2px 10px; border-radius: 10px; font-size: .72rem; opacity: .92; background: rgba(255,255,255,.06); border: 1px solid rgba(255,255,255,.14); }
    .trace-chip em { font-style: normal; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; max-width: 220px; }
    .trace-facts { margin: 8px 0 0; padding-left: 16px; font-size: .78rem; line-height: 1.65; opacity: .88; }
    .trace-facts li { margin-bottom: 3px; }
    .trace-note { margin: 8px 0 0; font-size: .72rem; color: #fbbf24; opacity: .92; }
    /* 景点卡片（景区详情内） */
    .sn-spots-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(215px, 1fr)); gap: 14px; }
    .sn-spot-card { position: relative; cursor: pointer; border-radius: 14px; overflow: hidden; background: var(--card-bg, rgba(255,255,255,.06)); border: 1px solid var(--border-color, rgba(255,255,255,.1)); transition: transform .2s, border-color .2s, box-shadow .2s; }
    .sn-spot-card:hover { transform: translateY(-3px); border-color: rgba(52,211,153,.55); box-shadow: 0 8px 24px rgba(52,211,153,.16); }
    .sn-spot-card.visited { border-color: rgba(52,211,153,.55); }
    .sn-spot-visual { height: 86px; display: flex; align-items: center; justify-content: center; font-size: 2.2rem; background: linear-gradient(135deg, rgba(16,185,129,.28), rgba(45,212,191,.12) 55%, rgba(251,191,36,.1)); }
    .sn-spot-body { padding: 12px 14px 14px; }
    .sn-spot-name { font-size: .98rem; font-weight: 800; display: flex; align-items: center; gap: 8px; flex-wrap: wrap; }
    .sn-spot-rating { color: #fbbf24; font-size: .82rem; font-weight: 700; white-space: nowrap; }
    .sn-spot-desc { font-size: .8rem; opacity: .8; line-height: 1.6; margin: 6px 0 8px; display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical; overflow: hidden; }
    .sn-spot-tags { display: flex; gap: 6px; flex-wrap: wrap; }
    .sn-spot-tags .sn-tag { background: rgba(52,211,153,.12); border-color: rgba(52,211,153,.3); }
    .sn-free-pill { font-size: .68rem; padding: 2px 8px; border-radius: 10px; color: #6ee7b7; background: rgba(52,211,153,.14); border: 1px solid rgba(52,211,153,.4); }
    .sn-visited-pill { position: absolute; top: 10px; right: 10px; font-size: .68rem; padding: 3px 10px; border-radius: 12px; color: #052e1f; background: linear-gradient(90deg, #34d399, #6ee7b7); font-weight: 700; }
    /* 主题路线 */
    .sn-route-card { padding: 14px 16px; border-radius: 14px; background: var(--card-bg, rgba(255,255,255,.06)); border: 1px solid var(--border-color, rgba(255,255,255,.1)); margin-bottom: 12px; }
    .sn-route-head { display: flex; align-items: center; gap: 10px; flex-wrap: wrap; }
    .sn-route-name { font-weight: 800; font-size: .96rem; }
    .sn-route-meta { font-size: .76rem; padding: 3px 10px; border-radius: 10px; color: #6ee7b7; background: rgba(52,211,153,.12); border: 1px solid rgba(52,211,153,.32); }
    .sn-route-nav { margin-left: auto; font-size: .8rem; color: #6ee7b7; text-decoration: none; border: 1px solid rgba(52,211,153,.4); padding: 4px 12px; border-radius: 12px; transition: background .18s; }
    .sn-route-nav:hover { background: rgba(52,211,153,.14); }
    .sn-route-stops { display: flex; align-items: center; gap: 6px; flex-wrap: wrap; margin-top: 10px; }
    .sn-stop-chip { cursor: pointer; font-size: .78rem; padding: 4px 12px; border-radius: 12px; background: rgba(255,255,255,.07); border: 1px solid var(--border-color, rgba(255,255,255,.16)); transition: border-color .18s; }
    .sn-stop-chip:hover { border-color: rgba(52,211,153,.55); }
    .sn-stop-chip.visited { color: #6ee7b7; border-color: rgba(52,211,153,.5); }
    .sn-stop-arrow { opacity: .5; font-size: .72rem; }
    /* 地图 / 骨架 / 错误 */
    .sn-cta-row { display: flex; gap: 10px; margin-top: 18px; flex-wrap: wrap; }
    .sn-cta-row .btn-primary { flex: 1; min-width: 220px; }
    .sn-map-box { margin-top: 20px; border-radius: 12px; overflow: hidden; border: 1px solid var(--border-color, rgba(255,255,255,.12)); }
    .sn-map-box #sn-map { height: 230px; width: 100%; }
    .sn-map-fallback { padding: 14px 16px; font-size: .84rem; opacity: .75; }
    .sn-skeleton { padding: 6px 0; }
    .sn-skeleton .sk { height: 14px; border-radius: 7px; margin-bottom: 12px; background: linear-gradient(90deg, rgba(255,255,255,.06) 25%, rgba(255,255,255,.14) 50%, rgba(255,255,255,.06) 75%); background-size: 200% 100%; animation: sn-shimmer 1.4s infinite; }
    @keyframes sn-shimmer { 0% { background-position: 200% 0; } 100% { background-position: -200% 0; } }
    .sn-error-box { margin-top: 14px; padding: 14px; border-radius: 10px; background: rgba(248,113,113,.08); border-left: 3px solid #f87171; font-size: .86rem; }
    /* 景点详情（三级页） */
    .sn-spot-page-head { display: flex; align-items: flex-start; gap: 16px; flex-wrap: wrap; }
    .sn-spot-page-icon { width: 64px; height: 64px; border-radius: 16px; display: flex; align-items: center; justify-content: center; font-size: 2rem; background: linear-gradient(135deg, rgba(16,185,129,.3), rgba(45,212,191,.14)); flex-shrink: 0; }
    .sn-spot-page-name { margin: 0; font-size: 1.4rem; font-weight: 800; }
    .sn-spot-page-sub { margin-top: 6px; font-size: .84rem; opacity: .8; display: flex; align-items: center; gap: 12px; flex-wrap: wrap; }
    .sn-stars { color: #fbbf24; letter-spacing: 2px; font-size: .9rem; }
    .sn-spot-page-tags { display: flex; gap: 8px; margin-top: 14px; flex-wrap: wrap; }
    .sn-voice-card { margin-top: 18px; padding: 18px 20px; border-radius: 16px; background: linear-gradient(135deg, rgba(16,185,129,.32), rgba(5,150,105,.16)); border: 1px solid rgba(52,211,153,.4); display: flex; align-items: center; gap: 14px; flex-wrap: wrap; }
    .sn-voice-btn { flex: 1; min-width: 230px; display: flex; align-items: center; justify-content: center; gap: 10px; padding: 14px 20px; border: none; border-radius: 14px; cursor: pointer; font-size: 1rem; font-weight: 800; color: #04301f; background: linear-gradient(90deg, #34d399, #6ee7b7); box-shadow: 0 6px 18px rgba(52,211,153,.3); transition: transform .18s, box-shadow .18s; }
    .sn-voice-btn:hover { transform: translateY(-2px); box-shadow: 0 10px 24px rgba(52,211,153,.4); }
    .sn-voice-btn .fa-circle-play { font-size: 1.5rem; }
    .sn-voice-note { font-size: .74rem; color: #fbbf24; background: rgba(251,191,36,.1); border: 1px solid rgba(251,191,36,.35); padding: 4px 12px; border-radius: 12px; }
    .sn-walk-box { margin-top: 14px; padding: 12px 14px; border-radius: 10px; background: rgba(96,165,250,.08); border-left: 3px solid #60a5fa; font-size: .86rem; line-height: 1.7; }
    .sn-review { display: flex; gap: 10px; padding: 12px 0; border-bottom: 1px dashed var(--border-color, rgba(255,255,255,.1)); }
    .sn-review:last-child { border-bottom: none; }
    .sn-review-avatar { width: 34px; height: 34px; border-radius: 50%; display: flex; align-items: center; justify-content: center; font-size: .95rem; background: rgba(251,191,36,.16); flex-shrink: 0; }
    .sn-review-name { font-size: .82rem; font-weight: 700; }
    .sn-review-stars { color: #fbbf24; font-size: .74rem; margin-left: 8px; }
    .sn-review-text { font-size: .84rem; opacity: .85; line-height: 1.65; margin-top: 3px; }
    .sn-spot-cta { display: flex; gap: 12px; margin-top: 22px; flex-wrap: wrap; }
    .sn-spot-cta .tts-btn, .sn-spot-cta .sn-nav-btn { flex: 1; min-width: 200px; display: flex; align-items: center; justify-content: center; gap: 8px; padding: 13px 18px; border-radius: 14px; font-size: .95rem; font-weight: 800; cursor: pointer; text-decoration: none; transition: transform .18s; }
    .sn-spot-cta .tts-btn { border: none; color: #04301f; background: linear-gradient(90deg, #34d399, #6ee7b7); }
    .sn-spot-cta .sn-nav-btn { color: #6ee7b7; background: transparent; border: 1.5px solid rgba(52,211,153,.55); }
    .sn-spot-cta .sn-nav-btn:hover, .sn-spot-cta .tts-btn:hover { transform: translateY(-2px); }
    /* 站内路线规划（AMap.Walking 画线 + 分步指引） */
    .sn-plan-row { display: flex; flex-wrap: wrap; gap: 8px; align-items: center; margin-bottom: 12px; font-size: .8rem; }
    .sn-plan-endpoint { padding: 4px 10px; border-radius: 10px; background: rgba(46,139,87,.12); border: 1px solid rgba(110,231,183,.25); }
    .sn-plan-map { width: 100%; height: 240px; border-radius: 12px; overflow: hidden; border: 1px solid var(--border-color, rgba(255,255,255,.12)); }
    .sn-plan-summary { margin: 10px 0 8px; font-size: .86rem; line-height: 1.6; }
    .sn-plan-summary b { color: #6ee7b7; }
    .sn-plan-steps-list { margin: 0; padding: 0; list-style: none; }
    .sn-plan-steps-list li { display: flex; gap: 8px; align-items: flex-start; padding: 7px 10px; border-radius: 10px; background: var(--card-bg, rgba(255,255,255,.05)); margin-bottom: 6px; font-size: .82rem; line-height: 1.55; }
    .sn-step-no { flex: none; width: 20px; height: 20px; border-radius: 50%; background: rgba(46,139,87,.85); color: #fff; font-size: .72rem; display: flex; align-items: center; justify-content: center; margin-top: 1px; }
    .sn-step-dist { margin-left: auto; flex: none; padding-left: 8px; opacity: .6; font-size: .74rem; }
    .sn-plan-error { padding: 10px 12px; border-radius: 10px; background: rgba(251,191,36,.08); border: 1px solid rgba(251,191,36,.3); font-size: .82rem; line-height: 1.6; }
    .sn-plan-btn-row { margin-top: 10px; }
    .sn-checkin-toast { position: sticky; bottom: 12px; margin-top: 18px; display: flex; align-items: center; gap: 10px; padding: 12px 18px; border-radius: 14px; background: linear-gradient(90deg, rgba(16,185,129,.3), rgba(52,211,153,.18)); border: 1px solid rgba(52,211,153,.5); font-size: .88rem; flex-wrap: wrap; }
    .sn-checkin-toast i { color: #6ee7b7; font-size: 1.1rem; }
    /* P0-4 分享打卡 / P1-1 智能行程 / P1-5 攻略共创 */
    .sn-share-btn { margin-left: auto; display: inline-flex; align-items: center; gap: 6px; padding: 7px 16px; border-radius: 12px; font-size: .8rem; font-weight: 700; cursor: pointer; color: #6ee7b7; background: rgba(52,211,153,.14); border: 1px solid rgba(52,211,153,.5); transition: background .18s, transform .18s; }
    .sn-share-btn:hover { background: rgba(52,211,153,.26); transform: translateY(-1px); }
    .sn-share-btn.sn-craft-cta { margin-left: 0; background: linear-gradient(135deg, #ffd1e8, #c9b6ff); color: #3b2a5d; border: none; }
    .sn-share-btn.sn-craft-cta:hover { filter: brightness(1.06); }
    .sn-trip-panel { padding: 16px 18px; border-radius: var(--radius, 14px); border: 1px solid var(--glass-border, rgba(255,255,255,.14)); background: var(--glass-bg, rgba(255,255,255,.05)); }
    .sn-trip-row { display: flex; align-items: flex-start; gap: 10px; margin-bottom: 12px; flex-wrap: wrap; }
    .sn-trip-label { font-size: .84rem; font-weight: 800; opacity: .85; padding-top: 5px; white-space: nowrap; }
    .sn-trip-actions { display: flex; align-items: center; gap: 12px; flex-wrap: wrap; margin-top: 4px; }
    .sn-trip-hint { font-size: .74rem; opacity: .6; }
    .sn-trip-plan { margin-top: 16px; padding: 16px 18px; border-radius: var(--radius, 14px); background: linear-gradient(135deg, rgba(255,209,232,.14), rgba(201,182,255,.14)); border: 1px solid rgba(201,182,255,.4); }
    .sn-trip-plan-head { font-size: .88rem; font-weight: 800; line-height: 1.6; }
    .sn-trip-note { font-size: .76rem; color: #fbbf24; margin-top: 6px; line-height: 1.6; }
    .sn-trip-timeline { list-style: none; margin: 14px 0 0; padding: 0; }
    .sn-trip-item { display: flex; gap: 12px; align-items: flex-start; padding: 10px 12px; border-radius: 12px; background: var(--glass-bg, rgba(255,255,255,.06)); border: 1px solid var(--glass-border, rgba(255,255,255,.12)); margin-bottom: 8px; }
    .sn-trip-time { flex: none; min-width: 96px; font-size: .78rem; font-weight: 800; color: #6ee7b7; font-variant-numeric: tabular-nums; padding-top: 2px; }
    .sn-trip-item.lunch .sn-trip-time { color: #fbbf24; }
    .sn-trip-stop { flex: 1; min-width: 0; }
    .sn-trip-stop b { font-size: .9rem; }
    .sn-trip-highlight { display: block; font-size: .76rem; opacity: .75; line-height: 1.55; margin-top: 3px; }
    .sn-trip-dur { flex: none; font-size: .72rem; opacity: .6; padding-top: 3px; }
    .sn-trip-start-row { margin-top: 14px; }
    .sn-trip-empty { padding: 18px 0; text-align: center; opacity: .65; font-size: .86rem; }
    .sn-guide-list { display: grid; gap: 10px; }
    .sn-guide-item { padding: 12px 14px; border-radius: 12px; background: var(--glass-bg, rgba(255,255,255,.05)); border: 1px solid var(--glass-border, rgba(255,255,255,.12)); }
    .sn-guide-item-head { display: flex; align-items: center; gap: 8px; flex-wrap: wrap; }
    .sn-guide-item-title { font-size: .92rem; font-weight: 800; }
    .sn-guide-pending { flex: none; font-size: .68rem; padding: 2px 9px; border-radius: 10px; color: #fbbf24; background: rgba(251,191,36,.12); border: 1px solid rgba(251,191,36,.4); }
    .sn-guide-item-content { font-size: .84rem; opacity: .85; line-height: 1.65; margin-top: 6px; word-break: break-word; }
    .sn-guide-item-meta { font-size: .74rem; opacity: .6; margin-top: 6px; }
    .sn-guide-empty { padding: 20px 0; text-align: center; opacity: .65; font-size: .86rem; }
    .sn-guide-form { margin-top: 14px; padding: 16px 18px; border-radius: var(--radius, 14px); background: linear-gradient(135deg, rgba(255,209,232,.1), rgba(201,182,255,.1)); border: 1px solid rgba(201,182,255,.35); }
    .sn-guide-form-title { font-size: .92rem; font-weight: 800; margin-bottom: 10px; }
    .sn-guide-form input, .sn-guide-form textarea { width: 100%; padding: 10px 14px; border-radius: 12px; border: 1px solid var(--glass-border, rgba(255,255,255,.18)); background: var(--glass-bg, rgba(255,255,255,.05)); color: inherit; font-size: .88rem; font-family: inherit; outline: none; margin-bottom: 10px; }
    .sn-guide-form textarea { resize: vertical; min-height: 74px; }
    .sn-guide-form input:focus, .sn-guide-form textarea:focus { border-color: rgba(52,211,153,.55); }
    .sn-guide-form-foot { display: flex; align-items: center; justify-content: space-between; gap: 10px; flex-wrap: wrap; }
    .sn-guide-hint { font-size: .74rem; opacity: .6; }
    @media (max-width: 640px) {
      .scenic-page-box { padding: 18px 14px; }
      .sn-grid, .sn-spots-grid { grid-template-columns: 1fr 1fr; }
      .sn-spot-page-name { font-size: 1.2rem; }
      .sn-switch-btn { margin-left: 0; }
      .sn-spot-cta .tts-btn, .sn-spot-cta .sn-nav-btn { min-width: 100%; }
    }
    @media (max-width: 420px) {
      .sn-grid, .sn-spots-grid { grid-template-columns: 1fr; }
    }
  `;
  document.head.appendChild(st);
}

function _esc(s) {
  return String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', '\'': '&#39;' }[c]));
}

function _userId() {
  return (window.currentUser && window.currentUser.id) != null ? window.currentUser.id : 0;
}

/** 主题图标：徽章 icon → 景区自带 icon → 📍 */
function _icon(t) {
  const badge = CULTURE_BADGES[t.themeId] || {};
  return badge.icon || t.icon || '📍';
}

/** 景区坐标：优先 THEME_LOCATIONS（核心主题），否则景区自带 lng/lat */
function _loc(area) {
  return THEME_LOCATIONS[area.themeId] || (area.lng != null ? { lng: area.lng, lat: area.lat, place: area.name } : null);
}

/** 景点导航坐标 = 景区中心 + 确定性小偏移（不编造精确坐标） */
function _spotLoc(area, index) {
  const base = _loc(area) || { lng: 0, lat: 0 };
  return {
    lng: base.lng + ((index % 5) - 2) * 0.0016,
    lat: base.lat + (((index * 2) % 5) - 2) * 0.0013
  };
}

/** 高德 URI 深链：步行导航至坐标（新窗口跳高德网页版，无 key 也可用） */
function _navUrl(lng, lat, name) {
  return `https://uri.amap.com/navigation?to=${lng.toFixed(6)},${lat.toFixed(6)},${encodeURIComponent(name)}&mode=walk&coordinate=gaode&callnative=0`;
}

/** 静态演示点评（确定性选取，参考图「游客点评」形态） */
const REVIEW_POOL = [
  { avatar: '🧑', name: '游客小张', stars: 5, text: '这里很壮观，建筑保存完好，跟着 AI 讲解逛收获很大！' },
  { avatar: '👩', name: '旅行家阿琳', stars: 5, text: 'AI 语音讲解非常详细，像带了个私人导游，推荐！' },
  { avatar: '🧔', name: '背包客老周', stars: 4, text: '历史感很强，值得一来，步行指引很清楚。' },
  { avatar: '👧', name: '亲子游朵朵', stars: 5, text: '孩子听讲解听得入迷，回家还复述了典故，涨知识！' },
  { avatar: '📸', name: '摄影爱好者', stars: 4, text: '随手一拍都是机位，光线好的时候更出片。' },
  { avatar: '🧑‍🌾', name: '本地通', stars: 5, text: '打卡成功！按路线走不走回头路，规划很省心。' }
];
function _reviewsFor(spotId) {
  let h = 0;
  for (let i = 0; i < spotId.length; i++) h = (h * 31 + spotId.charCodeAt(i)) | 0;
  const start = Math.abs(h) % REVIEW_POOL.length;
  return [0, 1, 2].map(k => REVIEW_POOL[(start + k) % REVIEW_POOL.length]);
}

// ------------------------------------------------------------
// 打卡（复用 culture_footprints 表：themeId='spot:xx' + action='visit'）
// ------------------------------------------------------------
async function _loadVisited() {
  try {
    const list = await getFootprintsByUser(_userId());
    visitedSet = new Set(
      list.filter(r => r.action === 'visit' && String(r.themeId || '').startsWith('spot:'))
        .map(r => String(r.themeId).slice(5))
    );
  } catch (e) {
    console.warn('[ScenicGuide] 打卡记录读取失败:', e && e.message);
    visitedSet = new Set();
  }
  visitedLoaded = true;
}

async function _checkInSpot(area, spot) {
  const isNew = await recordFootprint(_userId(), 'spot:' + spot.id, 'visit', { meta: { via: 'scenic-guide', area: area.areaId } });
  visitedSet.add(spot.id);
  if (isNew && window.showToast) {
    showToast(`📍 已打卡「${spot.name}」，${area.name}探索进度 ${visitedCountOf(area)}/${area.spots.length}`, 'success');
  }
  window.dispatchEvent(new CustomEvent('culture:footprint', { detail: { themeId: 'spot:' + spot.id, action: 'visit', level: isNew ? 'new' : 'old' } }));
}

function visitedCountOf(area) {
  return area.spots.filter(s => visitedSet.has(s.id)).length;
}

function _currentAreaId() {
  try { return localStorage.getItem(CURRENT_AREA_KEY); } catch (e) { return null; }
}

// ------------------------------------------------------------
// P0-4 分享打卡引流：Canvas 打卡卡（梦核渐变底 #ffd1e8→#c9b6ff + 景点名大字
// + 景区名 + 打卡进度）→ SharePoster.downloadPoster 合成海报
// （景点库无图片字段，Canvas 兜底保证分享链路永远可用；模块缺失 toast 兜底）
// ------------------------------------------------------------
function _drawCheckinCard(area, spot) {
  const W = 750, H = 1000;
  const canvas = document.createElement('canvas');
  canvas.width = W; canvas.height = H;
  const ctx = canvas.getContext('2d');
  // 雾紫粉梦核渐变底
  const g = ctx.createLinearGradient(0, 0, W, H);
  g.addColorStop(0, '#ffd1e8');
  g.addColorStop(1, '#c9b6ff');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, W, H);
  // 梦核装饰光斑
  ctx.fillStyle = 'rgba(255,255,255,.3)';
  ctx.beginPath(); ctx.arc(W * .82, H * .17, 140, 0, Math.PI * 2); ctx.fill();
  ctx.beginPath(); ctx.arc(W * .12, H * .88, 180, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = 'rgba(52,211,153,.16)';
  ctx.beginPath(); ctx.arc(W * .2, H * .1, 90, 0, Math.PI * 2); ctx.fill();
  ctx.textAlign = 'center';
  // 顶部徽章由 SharePoster badge 参数统一绘制（右上角 pill），
  // 画布内不再重复画「智慧导览打卡」，避免海报出现双重徽章
  // 景点大 icon
  ctx.font = '140px serif';
  ctx.fillText(spot.icon || '📍', W / 2, 280);
  // 景点名大字（超宽自动换行，最多两行）
  ctx.font = '800 64px "PingFang SC", "Microsoft YaHei", sans-serif';
  ctx.fillStyle = '#46326e';
  const name = String(spot.name || '未知景点');
  const lines = [];
  let line = '';
  for (const ch of name) {
    if (ctx.measureText(line + ch).width > 620 && line) { lines.push(line); line = ch; }
    else line += ch;
  }
  if (line) lines.push(line);
  lines.slice(0, 2).forEach((l, i) => ctx.fillText(l, W / 2, 430 + i * 84));
  // 景区名 · 地区
  ctx.font = '500 34px "PingFang SC", "Microsoft YaHei", sans-serif';
  ctx.fillStyle = 'rgba(74,47,107,.9)';
  ctx.fillText(`${area.name} · ${area.region}`, W / 2, 640);
  // 打卡进度胶囊
  const progress = `已打卡 ${visitedCountOf(area)} / ${area.spots.length} 个景点`;
  ctx.font = '600 30px "PingFang SC", "Microsoft YaHei", sans-serif';
  const pw = ctx.measureText(progress).width + 72;
  const px = (W - pw) / 2, py = 690, ph = 62, pr = ph / 2;
  ctx.fillStyle = 'rgba(255,255,255,.55)';
  ctx.beginPath();
  ctx.moveTo(px + pr, py);
  ctx.arcTo(px + pw, py, px + pw, py + ph, pr);
  ctx.arcTo(px + pw, py + ph, px, py + ph, pr);
  ctx.arcTo(px, py + ph, px, py, pr);
  ctx.arcTo(px, py, px + pw, py, pr);
  ctx.closePath(); ctx.fill();
  ctx.fillStyle = '#0f7a5c';
  ctx.fillText(progress, W / 2, py + 42);
  // 底部品牌
  ctx.font = '500 26px "PingFang SC", "Microsoft YaHei", sans-serif';
  ctx.fillStyle = 'rgba(74,47,107,.75)';
  ctx.fillText('Dreamcore · AI + 文旅文创艺术共创社区', W / 2, H - 60);
  return canvas;
}

function _shareCheckin(area, spot) {
  if (!window.SharePoster || typeof window.SharePoster.downloadPoster !== 'function') {
    if (window.showToast) showToast('分享海报模块加载中，请稍后再试', 'warn');
    return;
  }
  try {
    const p = window.SharePoster.downloadPoster({
      image: _drawCheckinCard(area, spot),
      title: spot.name,
      themeTag: area.name,
      badge: '智慧导览打卡',
      footerCta: '来 Dreamcore 和我一起云游文化中国'
    });
    if (p && typeof p.catch === 'function') p.catch(() => { /* downloadPoster 内部已 toast */ });
  } catch (e) {
    console.warn('[ScenicGuide] 分享打卡生成失败:', e && e.message);
    if (window.showToast) showToast('分享打卡生成失败，请重试', 'error');
  }
}

// ------------------------------------------------------------
// P1-1 智能行程定制（纯前端规则引擎，确定性，零 AI 调用）：
// 偏好命中 routes.theme 加权 → 命中路线 stops 展开（未命中的作余量补齐）
// → 时长预算截断（每站 45-60 分钟 + 一日跨午插 1h 午餐）→ 时间轴行程单
// ------------------------------------------------------------
function _fmtClock(min) {
  const m = ((min % 1440) + 1440) % 1440;
  return `${String(Math.floor(m / 60)).padStart(2, '0')}:${String(m % 60).padStart(2, '0')}`;
}

/** 一句话亮点：desc 首句（超 40 字截断） */
function _firstSentence(desc) {
  const s = String(desc || '').split(/[。！？!?\n]/)[0] || '';
  return s.length > 40 ? s.slice(0, 40) + '…' : s;
}

function _buildItinerary(area, prefs, hours) {
  const routes = area.routes || [];
  const matched = routes.filter(r => prefs.includes(r.theme));
  const chosen = matched.length ? matched : routes.slice(0, 1); // 无匹配 → 景区第一条 route 兜底
  const pool = [];
  const seen = new Set();
  const pushRoute = (r) => (r.stops || []).forEach((sid) => {
    if (seen.has(sid)) return;
    seen.add(sid);
    const sp = area.spots.find(s => s.id === sid);
    if (sp) pool.push(sp);
  });
  chosen.forEach(pushRoute);
  routes.filter(r => !chosen.includes(r)).forEach(pushRoute); // 预算有余时其余路线景点补齐
  if (!pool.length) area.spots.forEach(s => { seen.add(s.id); pool.push(s); });

  const start = 9 * 60;      // 09:00 出发
  const budget = hours * 60; // 180（半日 3h）/ 360（一日 6h）分钟
  const items = [];
  let clock = start, lunchAdded = false, exhausted = true; // exhausted=推荐池全部纳入仍有余量
  for (const sp of pool) {
    const dur = 45 + (sp.rating >= 4.8 ? 15 : 0); // 常规 45 分钟，必打卡（★≥4.8）60 分钟
    // 一日行程跨午：在跨过 12:00 的站点前插入 1 小时午餐
    if (!lunchAdded && budget > 180 && (clock >= 12 * 60 || clock + dur > 12 * 60)) {
      items.push({ type: 'lunch', start: clock, end: clock + 60 });
      clock += 60;
      lunchAdded = true;
    }
    if (clock + dur - start > budget) { exhausted = false; break; } // 时长预算截断
    items.push({ type: 'spot', spot: sp, start: clock, end: clock + dur, dur });
    clock += dur;
  }
  return { items, matched: matched.length > 0, prefs: prefs.slice(), exhausted };
}

function _renderTripPlan(area, prefs, hours) {
  const box = overlayEl && overlayEl.querySelector('#sn-trip-result');
  if (!box) return;
  const plan = _buildItinerary(area, prefs, hours);
  const spots = plan.items.filter(i => i.type === 'spot');
  if (!spots.length) {
    box.innerHTML = '<div class="sn-trip-empty">该时长内暂排不下行程，换个更长的时长试试吧</div>';
    return;
  }
  const end = plan.items[plan.items.length - 1].end;
  const totalH = Math.round(((end - 9 * 60) / 60) * 10) / 10;
  const firstRoute = (area.routes || [])[0];
  const head = plan.matched
    ? `已按偏好「${prefs.join('、')}」为你定制`
    : (prefs.length ? '未命中偏好，已推荐经典路线' : '已推荐景区经典路线');
  const note = plan.matched ? '' : `<div class="sn-trip-note"><i class="fa-solid fa-circle-info"></i> 当前偏好暂无匹配的主题路线，为你保留景区经典玩法${firstRoute ? `「${_esc(firstRoute.name)}」` : ''}</div>`;
  // 推荐景点全部纳入后时长仍有富余（如选 6h 仅排出约 5h）：显式说明，避免"少排了"误解
  const budget = hours * 60;
  const spareNote = plan.exhausted && budget - (end - 9 * 60) >= 30
    ? '<div class="sn-trip-note"><i class="fa-solid fa-circle-info"></i> 推荐景点已全部纳入行程，剩余时间可自由探索或回到最爱的站点再看一眼</div>'
    : '';
  const items = plan.items.map(it => it.type === 'lunch'
    ? `<li class="sn-trip-item lunch"><span class="sn-trip-time">${_fmtClock(it.start)}–${_fmtClock(it.end)}</span><div class="sn-trip-stop"><b>🍜 午餐休整</b><span class="sn-trip-highlight">跨午行程已预留 1 小时，在景区美食街补给后继续</span></div></li>`
    : `<li class="sn-trip-item"><span class="sn-trip-time">${_fmtClock(it.start)}–${_fmtClock(it.end)}</span><div class="sn-trip-stop"><b>${it.spot.icon || '📍'} ${_esc(it.spot.name)}</b><span class="sn-trip-highlight">${_esc(_firstSentence(it.spot.desc))}</span></div><span class="sn-trip-dur">${it.dur} 分钟</span></li>`
  ).join('');
  const first = spots[0].spot;
  box.innerHTML = `
    <div class="sn-trip-plan">
      <div class="sn-trip-plan-head">🧭 ${head} · 共 ${spots.length} 站 · 约 ${totalH} 小时</div>
      ${note}${spareNote}
      <ol class="sn-trip-timeline">${items}</ol>
      <div class="sn-trip-start-row">
        <button type="button" class="btn-primary" id="sn-trip-start-btn" data-spot="${_esc(first.id)}"><i class="fa-solid fa-play"></i> 从第一站「${_esc(first.name)}」开始导览</button>
      </div>
    </div>`;
  box.querySelector('#sn-trip-start-btn').addEventListener('click', (e) => {
    const sid = e.currentTarget.dataset.spot;
    if (sid) _openSpot(area.areaId, sid); // 复用现有景点跳转逻辑
  });
}

// ------------------------------------------------------------
// P1-5 游客攻略共创 · 降级版（IndexedDB scenic_guides）：
// 提交即展示 + 「待审核」黄角标，无审核流；按 createdAt 倒序最多 10 条
// ------------------------------------------------------------
function _fmtDateTime(iso) {
  const d = new Date(iso);
  if (isNaN(d.getTime())) return String(iso || '');
  const p = (n) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())} ${p(d.getHours())}:${p(d.getMinutes())}`;
}

async function _renderGuides(areaId) {
  const box = () => overlayEl && currentAreaId === areaId && !currentSpotId ? overlayEl.querySelector('#sn-guide-list-box') : null;
  const el = box();
  if (!el) return;
  let list = [];
  try {
    list = await getScenicGuidesByArea(areaId, 10);
  } catch (e) {
    console.warn('[ScenicGuide] 攻略列表读取失败:', e && e.message);
  }
  const cur = box();
  if (!cur) return; // 视图已切走
  if (!list.length) {
    cur.innerHTML = '<div class="sn-guide-empty">还没有攻略，来做第一个分享的旅人吧 ✍️</div>';
    return;
  }
  cur.innerHTML = `<div class="sn-guide-list">${list.map(g => `
    <div class="sn-guide-item">
      <div class="sn-guide-item-head">
        <span class="sn-guide-item-title">${_esc(g.title)}</span>
        <span class="sn-guide-pending"><i class="fa-solid fa-hourglass-half"></i> 待审核</span>
      </div>
      <div class="sn-guide-item-content">${_esc(g.content)}</div>
      <div class="sn-guide-item-meta">${_esc(g.username || '游客')} · ${_fmtDateTime(g.createdAt)}</div>
    </div>`).join('')}</div>`;
}

async function _submitGuide(area) {
  const section = overlayEl && overlayEl.querySelector('#sn-guides-section');
  if (!section) return;
  const titleEl = section.querySelector('#sn-guide-title');
  const contentEl = section.querySelector('#sn-guide-content');
  const btn = section.querySelector('#sn-guide-submit-btn');
  const title = String(titleEl.value || '').trim();
  const content = String(contentEl.value || '').trim();
  if (!title) {
    if (window.showToast) showToast('请先填写攻略标题', 'warn');
    titleEl.focus();
    return;
  }
  if (content.length < 10) {
    if (window.showToast) showToast('攻略正文至少写 10 字，再补充一点心得吧', 'warn');
    contentEl.focus();
    return;
  }
  const username = (window.currentUser && window.currentUser.username) || '游客';
  btn.disabled = true;
  try {
    await addScenicGuide({ areaId: area.areaId, username, title, content });
    titleEl.value = '';
    contentEl.value = '';
    if (window.showToast) showToast('攻略发布成功，已带「待审核」角标展示', 'success');
    await _renderGuides(area.areaId); // 提交即出现在列表
  } catch (e) {
    console.warn('[ScenicGuide] 攻略保存失败:', e && e.message);
    if (window.showToast) showToast('攻略保存失败，请重试', 'error');
  } finally {
    btn.disabled = false;
  }
}

// ------------------------------------------------------------
// 打开 / 关闭
// ------------------------------------------------------------
async function openScenic() {
  if (overlayEl) return;
  _injectStyle();
  const overlay = document.createElement('div');
  overlay.className = 'modal-overlay';
  overlay.id = 'scenic-recommend-page';
  overlay.innerHTML = `
    <div class="modal-box scenic-page-box glass">
      <button class="modal-close" data-close aria-label="关闭"><i class="fa-solid fa-xmark"></i></button>
      <div class="sn-head">
        <div>
          <h2 class="sn-title"><i class="fa-solid fa-compass"></i> 智慧导览 · 热门景点</h2>
          <p class="sn-sub">精选 ${SCENIC_AREA_COUNT} 大名胜景区 · ${SCENIC_SPOT_COUNT} 个景点 · AI 语音讲解 / 路线导航 / 景区打卡</p>
        </div>
      </div>
      <div id="sn-body"></div>
    </div>
  `;
  document.body.appendChild(overlay);
  overlayEl = overlay;
  if (window.ModalScrollLock) ModalScrollLock.lock();
  requestAnimationFrame(() => overlay.classList.add('open'));

  overlay.addEventListener('click', (e) => {
    if (e.target === overlay || e.target.closest('[data-close]')) closeScenic();
  });

  if (!visitedLoaded) await _loadVisited();
  _renderGrid();
}

function closeScenic() {
  if (!overlayEl) return;
  const el = overlayEl;
  overlayEl = null;
  currentAreaId = null;
  currentSpotId = null;
  currentStory = null;
  _destroyMap();
  el.classList.remove('open');
  if (window.ModalScrollLock) ModalScrollLock.unlock();
  if (typeof Sound !== 'undefined') Sound.playSound('close');
  setTimeout(() => el.remove(), 260);
}

// ------------------------------------------------------------
// 视图一：景区列表（搜索 + 地区筛选 + 当前徽标）
// ------------------------------------------------------------
function _areaCardHtml(a) {
  // 当前徽标：localStorage 优先，内存兜底（刚浏览过详情的景区，防偶发读取时序抖动）
  const isCurrent = a.areaId === (_currentAreaId() || lastAreaId);
  const visited = visitedCountOf(a);
  const tags = (a.tags || []).slice(0, 2).map(k => `<span class="sn-tag">${_esc(k)}</span>`).join('');
  return `<div class="sn-card ${isCurrent ? 'current' : ''}" data-area="${_esc(a.areaId)}" role="button" tabindex="0" aria-label="${_esc(a.name)}">
    ${isCurrent ? '<span class="sn-cur-badge"><i class="fa-solid fa-check"></i> 当前</span>' : ''}
    <div class="sn-card-icon">${_icon(a)}</div>
    <div class="sn-card-name">${_esc(a.name)}</div>
    <div class="sn-card-region"><i class="fa-solid fa-location-dot"></i> ${_esc(a.region)}</div>
    <div class="sn-card-slogan">${_esc(a.slogan || '')}</div>
    <div class="sn-card-tags">${tags}</div>
    <div class="sn-card-spots"><span><i class="fa-solid fa-map-pin"></i> ${a.spots.length} 个景点</span>${visited > 0 ? `<span>✅ 已打卡 <b>${visited}/${a.spots.length}</b></span>` : ''}</div>
  </div>`;
}

function _filteredAreas() {
  const q = filters.q.trim().toLowerCase();
  return SCENIC_AREAS.filter(a => {
    const isHenan = a.region.includes('河南');
    if (filters.region === 'henan' && !isHenan) return false;
    if (filters.region === 'national' && isHenan) return false;
    if (!q) return true;
    const hay = [a.name, a.region, a.slogan, ...(a.tags || []), ...a.spots.map(s => s.name)].join(' ').toLowerCase();
    return hay.includes(q);
  });
}

function _renderGrid() {
  const body = overlayEl && overlayEl.querySelector('#sn-body');
  if (!body) return;
  currentAreaId = null;
  currentSpotId = null;
  currentStory = null;
  _destroyMap();

  const henanCount = SCENIC_AREAS.filter(a => a.region.includes('河南')).length;
  const list = _filteredAreas();
  const cards = list.map(_areaCardHtml).join('');

  body.innerHTML = `
    <div class="sn-toolbar">
      <div class="sn-search">
        <i class="fa-solid fa-magnifying-glass"></i>
        <input id="sn-search-input" type="text" placeholder="搜索景区 / 城市 / 景点，如：洛阳、迎客松、龙门石窟…" value="${_esc(filters.q)}" />
      </div>
      <div class="sn-chips">
        <button type="button" class="sn-chip ${filters.region === 'all' ? 'active' : ''}" data-region="all">全部 ${SCENIC_AREA_COUNT}</button>
        <button type="button" class="sn-chip ${filters.region === 'henan' ? 'active' : ''}" data-region="henan">河南 ${henanCount}</button>
        <button type="button" class="sn-chip ${filters.region === 'national' ? 'active' : ''}" data-region="national">全国 ${SCENIC_AREA_COUNT - henanCount}</button>
      </div>
    </div>
    <div class="sn-grid">${cards || '<div class="sn-empty"><i class="fa-solid fa-magnifying-glass"></i> 没有匹配的景区，换个关键词试试</div>'}</div>
  `;

  const input = body.querySelector('#sn-search-input');
  input.addEventListener('input', (e) => {
    filters.q = e.target.value;
    const grid = body.querySelector('.sn-grid');
    grid.innerHTML = _filteredAreas().map(_areaCardHtml).join('')
      || '<div class="sn-empty"><i class="fa-solid fa-magnifying-glass"></i> 没有匹配的景区，换个关键词试试</div>';
  });

  body.querySelectorAll('.sn-chip').forEach(chip => {
    chip.addEventListener('click', () => {
      filters.region = chip.dataset.region;
      _renderGrid();
    });
  });

  const grid = body.querySelector('.sn-grid');
  grid.addEventListener('click', (e) => {
    const card = e.target.closest('.sn-card');
    if (card) _openArea(card.dataset.area);
  });
  grid.addEventListener('keydown', (e) => {
    if (e.key !== 'Enter' && e.key !== ' ') return;
    const card = e.target.closest('.sn-card');
    if (card) { e.preventDefault(); _openArea(card.dataset.area); }
  });
}

function _openArea(areaId) {
  const h = '#/scenic?area=' + areaId;
  if ((window.location.hash || '') !== h) location.hash = h;
  else _renderArea(areaId);
}

// ------------------------------------------------------------
// 视图二：景区详情（讲解 + 景点 + 路线 + 打卡 + 地图）
// ------------------------------------------------------------
function _renderArea(areaId) {
  const area = getAreaById(areaId);
  const body = overlayEl && overlayEl.querySelector('#sn-body');
  if (!area || !body) return;
  currentAreaId = areaId;
  currentSpotId = null;
  currentStory = null;
  lastAreaId = areaId;
  _destroyMap();
  try { localStorage.setItem(CURRENT_AREA_KEY, areaId); } catch (e) { /* ignore */ }

  const theme = area.themeId ? getThemeById(area.themeId) : null;
  const visited = visitedCountOf(area);
  const pct = Math.round(visited / area.spots.length * 100);
  // P1-1：出行偏好 chips 数据源（routes.theme 聚合去重，以实际数据为准）
  const tripThemes = [...new Set((area.routes || []).map(r => r.theme).filter(Boolean))];
  const spotCards = area.spots.map((s, i) => {
    const isVisited = visitedSet.has(s.id);
    return `<div class="sn-spot-card ${isVisited ? 'visited' : ''}" data-spot="${_esc(s.id)}" data-index="${i}" role="button" tabindex="0" aria-label="${_esc(s.name)}">
      ${isVisited ? '<span class="sn-visited-pill">✓ 已打卡</span>' : ''}
      <div class="sn-spot-visual">${s.icon || '📍'}</div>
      <div class="sn-spot-body">
        <div class="sn-spot-name">${_esc(s.name)} <span class="sn-spot-rating">★ ${s.rating}</span></div>
        <div class="sn-spot-desc">${_esc(s.desc)}</div>
        <div class="sn-spot-tags">
          ${(s.tags || []).slice(0, 2).map(t => `<span class="sn-tag">${_esc(t)}</span>`).join('')}
          ${s.free ? '<span class="sn-free-pill">免费开放</span>' : ''}
        </div>
      </div>
    </div>`;
  }).join('');

  const routeCards = (area.routes || []).map(r => {
    const stops = r.stops.map((sid, i) => {
      const sp = area.spots.find(s => s.id === sid);
      if (!sp) return '';
      const arrow = i < r.stops.length - 1 ? '<span class="sn-stop-arrow"><i class="fa-solid fa-arrow-right"></i></span>' : '';
      return `<span class="sn-stop-chip ${visitedSet.has(sid) ? 'visited' : ''}" data-spot="${_esc(sid)}" role="button" tabindex="0">${sp.icon} ${_esc(sp.name)}</span>${arrow}`;
    }).join('');
    const first = area.spots.find(s => s.id === r.stops[0]);
    const firstIdx = first ? area.spots.indexOf(first) : 0;
    const loc = first ? _spotLoc(area, firstIdx) : _loc(area);
    const navUrl = first ? _navUrl(loc.lng, loc.lat, area.name + first.name) : '#';
    return `<div class="sn-route-card">
      <div class="sn-route-head">
        <span class="sn-route-name"><i class="fa-solid fa-route" style="color:#6ee7b7;"></i> ${_esc(r.name)}</span>
        <span class="sn-route-meta">⏱ ${_esc(r.duration)}</span>
        <span class="sn-route-meta">${_esc(r.theme)}</span>
        <a class="sn-route-nav" href="${navUrl}" target="_blank" rel="noopener"><i class="fa-solid fa-diamond-turn-right"></i> 开始导航</a>
      </div>
      <div class="sn-route-stops">${stops}</div>
    </div>`;
  }).join('');

  body.innerHTML = `
    <button type="button" class="btn-ghost sn-back" id="sn-back-btn"><i class="fa-solid fa-arrow-left"></i> 返回景区列表</button>
    <div class="sn-detail-head">
      <div class="sn-detail-icon">${_icon(area)}</div>
      <div>
        <h3 class="sn-detail-name">${_esc(area.name)}</h3>
        <div class="sn-meta">
          <span><i class="fa-solid fa-location-dot"></i>${_esc(area.region)}</span>
          <span><i class="fa-solid fa-quote-left"></i>${_esc(area.slogan || '')}</span>
        </div>
      </div>
      <button type="button" class="btn-ghost sn-switch-btn" id="sn-switch-btn"><i class="fa-solid fa-right-left"></i> 切换景区</button>
    </div>
    <div class="sn-checkin-bar">
      <span><i class="fa-solid fa-footprints" style="color:#6ee7b7;"></i> 已打卡 <b>${visited}</b> / ${area.spots.length} 个景点</span>
      <div class="sn-progress"><div class="sn-progress-bar" style="width:${pct}%"></div></div>
      <span>${pct}%</span>
    </div>
    <div id="sn-story"></div>
    <div class="sn-section">
      <h4 class="sn-section-title"><i class="fa-solid fa-map-pin" style="color:#6ee7b7;"></i> 热门景点（点击查看 AI 讲解与导航）</h4>
      <div class="sn-spots-grid">${spotCards}</div>
    </div>
    ${routeCards ? `<div class="sn-section"><h4 class="sn-section-title"><i class="fa-solid fa-route" style="color:#6ee7b7;"></i> 主题路线</h4>${routeCards}</div>` : ''}
    <div class="sn-section" id="sn-trip-section">
      <h4 class="sn-section-title"><i class="fa-solid fa-wand-magic-sparkles" style="color:#6ee7b7;"></i> 智能行程定制</h4>
      <div class="sn-trip-panel">
        ${tripThemes.length ? `<div class="sn-trip-row">
          <span class="sn-trip-label">🧭 出行偏好</span>
          <div class="sn-chips" id="sn-trip-theme-chips">${tripThemes.map(t => `<button type="button" class="sn-chip" data-theme="${_esc(t)}">${_esc(t)}</button>`).join('')}</div>
        </div>` : ''}
        <div class="sn-trip-row">
          <span class="sn-trip-label">⏱ 游玩时长</span>
          <div class="sn-chips" id="sn-trip-hour-chips">
            <button type="button" class="sn-chip active" data-hours="3">半日 · 3小时</button>
            <button type="button" class="sn-chip" data-hours="6">一日 · 6小时</button>
          </div>
        </div>
        <div class="sn-trip-actions">
          <button type="button" class="btn-primary" id="sn-trip-generate-btn"><i class="fa-solid fa-route"></i> 生成行程</button>
          <span class="sn-trip-hint">本地规则引擎秒级定制 · 无需等待</span>
        </div>
        <div id="sn-trip-result"></div>
      </div>
    </div>
    <div class="sn-section" id="sn-guides-section">
      <h4 class="sn-section-title"><i class="fa-solid fa-pen-nib" style="color:#fbbf24;"></i> 游客攻略共创</h4>
      <div id="sn-guide-list-box"><div class="sn-guide-empty">攻略加载中…</div></div>
      <div class="sn-guide-form">
        <div class="sn-guide-form-title">✍️ 写下你的攻略</div>
        <input id="sn-guide-title" type="text" maxlength="30" placeholder="攻略标题，如：${_esc(area.name)}半日精华游" />
        <textarea id="sn-guide-content" rows="3" maxlength="500" placeholder="分享你的独家路线、玩法或避坑心得（正文至少 10 字）"></textarea>
        <div class="sn-guide-form-foot">
          <span class="sn-guide-hint">提交即展示 · 署名「${_esc((window.currentUser && window.currentUser.username) || '游客')}」</span>
          <button type="button" class="btn-primary" id="sn-guide-submit-btn"><i class="fa-solid fa-paper-plane"></i> 提交攻略</button>
        </div>
      </div>
    </div>
    <div class="sn-map-box" id="sn-map-box"></div>
    <div id="sn-cta-slot"></div>
  `;

  body.querySelector('#sn-back-btn').addEventListener('click', () => {
    if ((window.location.hash || '') !== '#/scenic') location.hash = '#/scenic';
    else _renderGrid();
  });
  body.querySelector('#sn-switch-btn').addEventListener('click', () => {
    if ((window.location.hash || '') !== '#/scenic') location.hash = '#/scenic';
    else _renderGrid();
  });

  const spotsGrid = body.querySelector('.sn-spots-grid');
  spotsGrid.addEventListener('click', (e) => {
    const card = e.target.closest('.sn-spot-card');
    if (card) _openSpot(areaId, card.dataset.spot);
  });
  spotsGrid.addEventListener('keydown', (e) => {
    if (e.key !== 'Enter' && e.key !== ' ') return;
    const card = e.target.closest('.sn-spot-card');
    if (card) { e.preventDefault(); _openSpot(areaId, card.dataset.spot); }
  });
  body.querySelectorAll('.sn-stop-chip').forEach(chip => {
    chip.addEventListener('click', () => _openSpot(areaId, chip.dataset.spot));
  });

  // P1-1 智能行程定制：偏好多选 + 时长单选 → 规则引擎 → 时间轴行程单
  const tripState = { prefs: new Set(), hours: 3 };
  const themeChipsBox = body.querySelector('#sn-trip-theme-chips');
  if (themeChipsBox) themeChipsBox.addEventListener('click', (e) => {
    const chip = e.target.closest('.sn-chip');
    if (!chip) return;
    const t = chip.dataset.theme;
    if (tripState.prefs.has(t)) { tripState.prefs.delete(t); chip.classList.remove('active'); }
    else { tripState.prefs.add(t); chip.classList.add('active'); }
  });
  const hourChipsBox = body.querySelector('#sn-trip-hour-chips');
  hourChipsBox.addEventListener('click', (e) => {
    const chip = e.target.closest('.sn-chip');
    if (!chip) return;
    tripState.hours = Number(chip.dataset.hours) || 3;
    hourChipsBox.querySelectorAll('.sn-chip').forEach(c => c.classList.toggle('active', c === chip));
  });
  body.querySelector('#sn-trip-generate-btn').addEventListener('click', () => {
    _renderTripPlan(area, [...tripState.prefs], tripState.hours);
  });

  // P1-5 游客攻略共创（降级版）：列表 + 提交表单
  body.querySelector('#sn-guide-submit-btn').addEventListener('click', () => _submitGuide(area));
  _renderGuides(areaId);

  // 景区讲解：核心主题 → 本地事实卡；扩展/无主题 → AI 联网讲解
  if (theme && hasFactCard(theme)) _renderCoreStory(theme, area);
  else _fetchAreaStory(area);

  _renderMiniMap(area, _loc(area));
  _renderCta(area, theme);
}

function _renderCoreStory(theme, area) {
  const box = overlayEl && overlayEl.querySelector('#sn-story');
  if (!box) return;
  const facts = (theme.facts || []).map(f => `<div class="sn-fact"><i class="fa-solid fa-circle-check"></i><div>${_esc(f)}</div></div>`).join('');
  const legends = (theme.legends || []).map(l => `<div class="sn-legend">${_esc(l)}</div>`).join('');
  const ttsText = `${theme.name}，位于${theme.region}。${(theme.facts || []).join(' ')} 典故：${(theme.legends || []).join(' ')}`;

  box.innerHTML = `
    <div class="sn-section">
      <h4 class="sn-section-title"><i class="fa-solid fa-landmark" style="color:#6ee7b7;"></i> 景区讲解</h4>
      ${facts}
    </div>
    ${legends ? `<div class="sn-section"><h4 class="sn-section-title"><i class="fa-solid fa-book-open" style="color:#fbbf24;"></i> 历史典故</h4>${legends}</div>` : ''}
    <div class="sn-tts-row"><button type="button" class="btn-ghost tts-btn" data-tts-text="${_esc(ttsText)}"><i class="fa-solid fa-volume-high"></i> 语音讲解</button></div>
    <span class="sn-source-badge kb"><i class="fa-solid fa-database"></i> 平台知识库 · 人工校对</span>
  `;
}

async function _fetchAreaStory(area, retry) {
  const key = 'area:' + area.areaId;
  const target = () => overlayEl && currentAreaId === area.areaId && !currentSpotId ? overlayEl.querySelector(retry ? '#sn-story-retry' : '#sn-story') : null;
  const box = target();
  if (!box) return;
  box.innerHTML = `
    <div class="sn-section">
      <h4 class="sn-section-title"><i class="fa-solid fa-wand-magic-sparkles" style="color:#fbbf24;"></i> AI 联网讲解</h4>
      <div class="sn-skeleton">
        <div class="sk" style="width:92%;"></div><div class="sk" style="width:100%;"></div>
        <div class="sk" style="width:96%;"></div><div class="sk" style="width:60%;"></div>
      </div>
    </div>
  `;
  try {
    const r = await fetch('/api/ai/culture-story', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ subject: area.name, description: `${area.region}，${area.slogan || ''}` })
    });
    const story = await r.json();
    if (!r.ok || !story || !story.name) throw new Error((story && story.error) || `HTTP ${r.status}`);
    const cur = target();
    if (!cur) return;
    currentStory = story;
    const paras = String(story.connotation || '').split(/\n+/).filter(Boolean)
      .map(p => `<div class="sn-fact"><i class="fa-solid fa-feather"></i><div>${_esc(p)}</div></div>`).join('');
    const ttsText = `${story.name}，${String(story.connotation || '').replace(/\n+/g, ' ')}`;
    cur.innerHTML = `
      <div class="sn-section">
        <h4 class="sn-section-title"><i class="fa-solid fa-wand-magic-sparkles" style="color:#fbbf24;"></i> 景区讲解</h4>
        ${paras}
      </div>
      ${story.legend ? `<div class="sn-section"><h4 class="sn-section-title"><i class="fa-solid fa-book-open" style="color:#fbbf24;"></i> 历史典故</h4><div class="sn-legend">${_esc(story.legend)}</div></div>` : ''}
      <div class="sn-tts-row"><button type="button" class="btn-ghost tts-btn" data-tts-text="${_esc(ttsText)}"><i class="fa-solid fa-volume-high"></i> 语音讲解</button></div>
      <span class="sn-source-badge ai"><i class="fa-solid fa-robot"></i> AI 联网搜索生成，仅供参考</span>
    `;
  } catch (e) {
    console.warn('[ScenicGuide] 景区联网讲解失败:', e && e.message);
    const cur = target();
    if (!cur) return;
    cur.innerHTML = `
      <div class="sn-error-box">
        <i class="fa-solid fa-triangle-exclamation"></i> 联网讲解生成失败（${_esc(e.message || '网络异常')}）
        <button type="button" class="btn-ghost" id="sn-retry-btn" style="margin-left:10px;padding:3px 12px;font-size:.78rem;"><i class="fa-solid fa-rotate"></i> 重试</button>
      </div>
    `;
    const btn = cur.querySelector('#sn-retry-btn');
    if (btn) btn.addEventListener('click', () => {
      const slot = cur.parentNode;
      cur.remove();
      const nb = document.createElement('div');
      nb.id = 'sn-story-retry';
      slot.appendChild(nb);
      _fetchAreaStory(area, true);
    });
  }
}

/** 创作引流 / 文创 CTA / 图鉴 CTA（有主题 OR 有景区文创映射时显示） */
function _renderCta(area, theme) {
  const slot = overlayEl && overlayEl.querySelector('#sn-cta-slot');
  if (!slot) return;
  const scenicCraft = getScenicCraft(area.areaId);
  if (!theme && !scenicCraft) {
    slot.innerHTML = '';
    return;
  }
  // 景区文创按钮文案：有 theme 用 theme.name，无 theme 用 area.name 兜底
  const craftLabel = theme ? theme.name : area.name;
  slot.innerHTML = `<div class="sn-cta-row">
    <button type="button" class="btn-primary" id="sn-craft-btn"><i class="fa-solid fa-feather-pointed"></i> 用「${_esc(craftLabel)}」创作文创</button>
    ${theme ? `<button type="button" class="btn-ghost" id="sn-atlas-btn"><i class="fa-solid fa-book-atlas"></i> 去图鉴深入了解</button>` : ''}
  </div>`;
  const craftBtn = slot.querySelector('#sn-craft-btn');
  const atlasBtn = slot.querySelector('#sn-atlas-btn');
  if (craftBtn) craftBtn.addEventListener('click', () => _goCraft(theme, currentStory, area));
  if (atlasBtn) atlasBtn.addEventListener('click', () => {
    closeScenic();
    location.hash = '#/atlas?theme=' + theme.themeId;
  });
}

async function _goCraft(theme, story, area) {
  let artworkId = null;
  let all = [];
  try {
    // 对外展示：仅从公开可见作品中选文创底图（下架/逻辑删除/待审核不参与）
    all = await getPublicArtworks();
    if (theme) {
      const matched = matchArtworksByTheme(all, theme.themeId);
      if (matched.length > 0) {
        matched.sort((a, b) => (b.views || 0) - (a.views || 0));
        artworkId = matched[0].id;
      }
    }
  } catch (e) { /* 匹配失败不阻塞跳转 */ }

  // 降级兜底：主题作品匹配不到时，用作品库第一幅（view 最高）兜底
  if (artworkId == null && all.length > 0) {
    all.sort((a, b) => (b.views || 0) - (a.views || 0));
    artworkId = all[0].id;
    if (window.showToast) window.showToast('画廊中暂无匹配主题作品，已为您推荐热门作品继续创作', 'info');
  }

  if (artworkId == null) {
    if (window.showToast) showToast('画廊暂无作品，请先上传作品后再试', 'warn');
    closeScenic();
    location.hash = '#gallery';
    return;
  }

  const idea = (story && story.creationTip) || (theme && theme.creationTip)
    || ('以' + (theme ? theme.name : (area ? area.name : '景区')) + '为主题，设计一款融合传统元素与现代审美的文创衍生品');

  closeScenic();
  // 景区 → 文创风格/品类智能预置（技术亮点：AI 风格与景区文化气质强绑定）
  const areaId = area && area.areaId ? area.areaId : currentAreaId;
  const craft = areaId ? getScenicCraft(areaId) : null;
  const extra = craft
    ? `&scenic=${encodeURIComponent(areaId)}&style=${encodeURIComponent(craft.style)}&category=${encodeURIComponent(craft.category)}`
    : (areaId ? `&scenic=${encodeURIComponent(areaId)}` : '');
  location.hash = '#/craft?artworkId=' + artworkId + extra;
  let tries = 0;
  const timer = setInterval(() => {
    tries++;
    const el = document.getElementById('craft-idea-input');
    if (el) { el.value = idea; clearInterval(timer); el.focus(); }
    else if (tries > 30) clearInterval(timer);
  }, 300);
}

// ------------------------------------------------------------
// 视图三：景点详情（AI 语音讲解 + 介绍 + 点评 + 导航 + 打卡）
// ------------------------------------------------------------
function _openSpot(areaId, spotId) {
  const h = `#/scenic?area=${areaId}&spot=${spotId}`;
  if ((window.location.hash || '') !== h) location.hash = h;
  else _renderSpot(areaId, spotId);
}

function _renderSpot(areaId, spotId) {
  const area = getAreaById(areaId);
  const body = overlayEl && overlayEl.querySelector('#sn-body');
  if (!area || !body) return;
  const idx = area.spots.findIndex(s => s.id === spotId);
  if (idx < 0) { _renderArea(areaId); return; }
  const spot = area.spots[idx];
  currentAreaId = areaId;
  currentSpotId = spotId;
  currentStory = null;
  _destroyMap();

  const loc = _spotLoc(area, idx);
  const navUrl = _navUrl(loc.lng, loc.lat, spot.name);
  const baseTts = `${area.name}${spot.name}。${spot.desc} 游览指引：${spot.walk}`;
  // P0-4 导览→创作转化：景区关联文化主题时，打卡条提供「创作文创」入口
  const spotTheme = area.themeId ? getThemeById(area.themeId) : null;
  const reviews = _reviewsFor(spotId).map(r => `
    <div class="sn-review">
      <div class="sn-review-avatar">${r.avatar}</div>
      <div>
        <span class="sn-review-name">${_esc(r.name)}</span><span class="sn-review-stars">${'★'.repeat(r.stars)}</span>
        <div class="sn-review-text">${_esc(r.text)}</div>
      </div>
    </div>`).join('');

  body.innerHTML = `
    <button type="button" class="btn-ghost sn-back" id="sn-back-btn"><i class="fa-solid fa-arrow-left"></i> 返回${_esc(area.name)}</button>
    <div class="sn-spot-page-head">
      <div class="sn-spot-page-icon">${spot.icon || '📍'}</div>
      <div>
        <h3 class="sn-spot-page-name">${_esc(spot.name)}</h3>
        <div class="sn-spot-page-sub">
          <span><i class="fa-solid fa-location-dot"></i> ${_esc(area.name)} · ${_esc(area.region)}</span>
          <span class="sn-stars">★ ${spot.rating}</span>
        </div>
      </div>
    </div>
    <div class="sn-spot-page-tags">
      ${(spot.tags || []).map(t => `<span class="sn-tag">${_esc(t)}</span>`).join('')}
      <span class="sn-free-pill">${spot.free ? '免费开放' : '需景区门票'}</span>
      <span class="sn-tag">🚶 景区内步行可达</span>
    </div>
    <div class="sn-voice-card">
      <button type="button" class="sn-voice-btn tts-btn" data-tts-text="${_esc(baseTts)}" id="sn-voice-btn">
        <i class="fa-solid fa-circle-play"></i> AI 语音讲解 · 语音播报
      </button>
      <span class="sn-voice-note"><i class="fa-solid fa-wand-magic-sparkles"></i> 本讲解由 AI 生成</span>
    </div>
    <div class="sn-section">
      <h4 class="sn-section-title"><i class="fa-solid fa-book-open" style="color:#6ee7b7;"></i> 景点介绍</h4>
      <div class="sn-fact"><i class="fa-solid fa-feather"></i><div>${_esc(spot.desc)}</div></div>
      <div id="sn-spot-story"></div>
      <div class="sn-walk-box"><i class="fa-solid fa-person-walking"></i> <b>步行指引：</b>${_esc(spot.walk)}</div>
    </div>
    <div class="sn-section">
      <h4 class="sn-section-title"><i class="fa-solid fa-comments" style="color:#fbbf24;"></i> 游客点评</h4>
      ${reviews}
    </div>
    <div class="sn-section" id="sn-plan-section">
      <h4 class="sn-section-title"><i class="fa-solid fa-route" style="color:#6ee7b7;"></i> 最佳路线规划（站内）</h4>
      <div class="sn-plan-row">
        <span class="sn-plan-endpoint">🧭 起点 · ${_esc(area.name)}中心区</span>
        <span class="sn-plan-endpoint">📍 终点 · ${_esc(spot.name)}</span>
      </div>
      <div id="sn-plan-result"></div>
      <div class="sn-plan-btn-row">
        <button type="button" class="btn-ghost" id="sn-plan-btn"><i class="fa-solid fa-diamond-turn-right"></i> 规划步行路线</button>
      </div>
    </div>
    <div class="sn-spot-cta">
      <button type="button" class="tts-btn" data-tts-text="${_esc(baseTts)}"><i class="fa-solid fa-volume-high"></i> 语音讲解</button>
      <button type="button" class="sn-nav-btn" id="sn-plan-cta"><i class="fa-solid fa-diamond-turn-right"></i> 站内路线规划</button>
      <a class="sn-nav-btn" id="sn-nav-btn" href="${navUrl}" target="_blank" rel="noopener" title="跳转高德网页版导航"><i class="fa-solid fa-arrow-up-right-from-square"></i> 高德地图打开</a>
    </div>
    <div class="sn-checkin-toast" id="sn-checkin-toast">
      <i class="fa-solid fa-circle-check"></i>
      <span id="sn-checkin-text">浏览即打卡 · 本景点${visitedSet.has(spotId) ? '已点亮' : '打卡中'}（${area.name}进度 ${visitedCountOf(area)}/${area.spots.length}）</span>
      <button type="button" class="sn-share-btn" id="sn-share-checkin-btn" title="生成打卡分享卡"><i class="fa-solid fa-share-nodes"></i> 分享打卡</button>
      ${(spotTheme || getScenicCraft(areaId)) ? `<button type="button" class="sn-share-btn sn-craft-cta" id="sn-craft-checkin-btn" title="用本景区文化主题一键创作文创"><i class="fa-solid fa-feather-pointed"></i> 用「${_esc((spotTheme && spotTheme.name) || area.name)}」创作文创</button>` : ''}
    </div>
  `;

  body.querySelector('#sn-back-btn').addEventListener('click', () => {
    const h = '#/scenic?area=' + areaId;
    if ((window.location.hash || '') !== h) location.hash = h;
    else _renderArea(areaId);
  });

  // 站内路线规划：区块按钮直接规划；底部 CTA 滚动到规划区并触发
  body.querySelector('#sn-plan-btn').addEventListener('click', () => _planRoute(area, spot, idx));
  body.querySelector('#sn-plan-cta').addEventListener('click', () => {
    const sec = body.querySelector('#sn-plan-section');
    if (sec && sec.scrollIntoView) sec.scrollIntoView({ behavior: 'smooth', block: 'center' });
    _planRoute(area, spot, idx);
  });

  // P0-4 分享打卡：打卡条内按钮 → Canvas 打卡卡 + SharePoster 海报
  body.querySelector('#sn-share-checkin-btn').addEventListener('click', () => _shareCheckin(area, spot));
  // P0-4 导览→创作转化：打卡条「创作文创」→ 复用景区级 _goCraft（预填主题+灵感）
  const craftCta = body.querySelector('#sn-craft-checkin-btn');
  if (craftCta) craftCta.addEventListener('click', () => _goCraft(spotTheme, currentStory, area));

  // 浏览即打卡（幂等）+ 更新底部提示（只改文案节点，保留分享按钮）
  _checkInSpot(area, spot).then(() => {
    const text = overlayEl && overlayEl.querySelector('#sn-checkin-text');
    if (text) text.textContent = `✅ 打卡成功 · ${area.name}进度 ${visitedCountOf(area)}/${area.spots.length}`;
  }).catch(() => { /* 打卡写库失败不阻塞浏览 */ });

  _fetchSpotStory(area, spot);
}

/** 站内步行路线规划：景区中心 → 景点（AMap.Walking 插件，路线画在站内地图 + 分步指引）
 *  失败降级：地图/路线服务异常 → 提示改用「高德地图打开」外链（原 v1 深链保留） */
async function _planRoute(area, spot, idx) {
  const resultBox = () => overlayEl && currentAreaId === area.areaId && currentSpotId === spot.id
    ? overlayEl.querySelector('#sn-plan-result') : null;
  const box = resultBox();
  if (!box) return;
  const btn = overlayEl.querySelector('#sn-plan-btn');
  if (btn) { btn.disabled = true; btn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> 规划中…'; }
  box.innerHTML = '<div class="sn-skeleton"><div class="sk" style="width:90%;"></div><div class="sk" style="width:96%;"></div></div>';

  const origin = _loc(area);
  const dest = _spotLoc(area, idx);
  const restoreBtn = (text) => { if (btn) { btn.disabled = false; btn.innerHTML = `<i class="fa-solid fa-diamond-turn-right"></i> ${text}`; } };

  try {
    const AMap = await _loadAMap();
    const box2 = resultBox();
    if (!box2) return;
    box2.innerHTML = '<div id="sn-plan-map" class="sn-plan-map"></div><div id="sn-plan-steps"></div>';
    const map = new AMap.Map('sn-plan-map', {
      center: [origin.lng, origin.lat], zoom: 14, mapStyle: 'amap://styles/dark', viewMode: '2D'
    });
    map.add(new AMap.Marker({
      position: [origin.lng, origin.lat], anchor: 'bottom-center',
      content: '<div style="padding:3px 9px;border-radius:10px;background:rgba(59,130,246,.92);color:#fff;font-size:12px;white-space:nowrap;">🧭 起点</div>'
    }));
    map.add(new AMap.Marker({
      position: [dest.lng, dest.lat], anchor: 'bottom-center',
      content: `<div style="padding:3px 9px;border-radius:10px;background:rgba(16,185,129,.92);color:#fff;font-size:12px;white-space:nowrap;">${_esc(spot.icon || '📍')} ${_esc(spot.name)}</div>`
    }));

    const renderSteps = (status, res) => {
      const stepsBox = resultBox() && resultBox().querySelector('#sn-plan-steps');
      if (!stepsBox) return;
      const route = res && res.routes && res.routes[0];
      // JS API 2.0 回调 status 大小写随版本有差异，统一小写比较
      if (String(status || '').toLowerCase() === 'complete' && route) {
        const mins = Math.max(1, Math.round((route.time || 0) / 60));
        const items = (route.steps || []).map((s, i) =>
          `<li><span class="sn-step-no">${i + 1}</span><span>${_esc(s.instruction || '沿路线前行')}</span>${s.distance ? `<span class="sn-step-dist">${s.distance}m</span>` : ''}</li>`
        ).join('');
        stepsBox.innerHTML = `
          <div class="sn-plan-summary"><i class="fa-solid fa-person-walking"></i> 步行约 <b>${Math.round(route.distance || 0)}</b> 米 · 约 <b>${mins}</b> 分钟 · ${_esc(area.name)}中心区 → ${_esc(spot.name)}，全程路线已标注在上方地图</div>
          <ol class="sn-plan-steps-list">${items}</ol>`;
        restoreBtn('重新规划');
      } else {
        // 路网无结果（景区内部山路不在高德步行路网）→ 站内直线示意路线兜底
        _renderFallbackRoute(AMap, map, area, spot, origin, dest, stepsBox);
        restoreBtn('重新规划');
      }
    };

    if (typeof AMap.plugin === 'function') {
      AMap.plugin('AMap.Walking', () => {
        try {
          const walking = new AMap.Walking({ map, autoFitView: true });
          walking.search([origin.lng, origin.lat], [dest.lng, dest.lat], renderSteps);
        } catch (e) {
          renderSteps('Error', null);
        }
      });
    } else {
      renderSteps('Error', null);
    }
  } catch (e) {
    const box3 = resultBox();
    if (box3) box3.innerHTML = `<div class="sn-plan-error"><i class="fa-solid fa-triangle-exclamation"></i> 地图服务加载失败（${_esc(e && e.message || '网络异常')}），请点底部「高德地图打开」使用官方导航</div>`;
    restoreBtn('重试站内规划');
  }
}

/** 路网无结果时的站内兜底：直线示意路线（虚线画线 + 直线测距 + 方位分步指引）
 *  景区内部山路不在高德步行路网属常态，示意路线保证站内始终可规划 */
function _renderFallbackRoute(AMap, map, area, spot, origin, dest, stepsBox) {
  try {
    const rad = d => d * Math.PI / 180;
    const dLat = rad(dest.lat - origin.lat), dLng = rad(dest.lng - origin.lng);
    const a = Math.sin(dLat / 2) ** 2 + Math.cos(rad(origin.lat)) * Math.cos(rad(dest.lat)) * Math.sin(dLng / 2) ** 2;
    const dist = Math.max(30, Math.round(6371000 * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a))));
    const mins = Math.max(1, Math.round(dist / 80)); // 常规步速约 80m/分钟
    // 方位角 → 八方位名（北为 0°）
    const dx = (dest.lng - origin.lng) * Math.cos(rad((origin.lat + dest.lat) / 2));
    const dy = dest.lat - origin.lat;
    const ang = (Math.atan2(dx, dy) * 180 / Math.PI + 360) % 360;
    const dir = ['北', '东北', '东', '东南', '南', '西南', '西', '西北'][Math.round(ang / 45) % 8];
    // 站内地图画虚线示意路线
    if (AMap.Polyline) {
      map.add(new AMap.Polyline({
        path: [[origin.lng, origin.lat], [dest.lng, dest.lat]],
        strokeColor: '#6ee7b7', strokeWeight: 4, strokeOpacity: .9,
        strokeStyle: 'dashed', strokeDasharray: [10, 6], showDir: true, lineJoin: 'round'
      }));
    }
    if (typeof map.setFitView === 'function') map.setFitView();
    const leg1 = Math.round(dist * 0.6), leg2 = dist - leg1;
    stepsBox.innerHTML = `
      <div class="sn-plan-summary"><i class="fa-solid fa-person-walking"></i> 景区内部示意路线 · 直线约 <b>${dist}</b> 米 · 步行约 <b>${mins}</b> 分钟 · ${_esc(area.name)}中心区 → ${_esc(spot.name)}（虚线已标注在上方地图）</div>
      <ol class="sn-plan-steps-list">
        <li><span class="sn-step-no">1</span><span>从${_esc(area.name)}中心区出发，沿景区主游览步道向${dir}方向前行约${leg1}米</span><span class="sn-step-dist">${leg1}m</span></li>
        <li><span class="sn-step-no">2</span><span>继续沿景区指示牌方向前行约${leg2}米，即到达${_esc(spot.icon || '📍')} ${_esc(spot.name)}</span><span class="sn-step-dist">${leg2}m</span></li>
      </ol>`;
  } catch (_) {
    stepsBox.innerHTML = `<div class="sn-plan-error"><i class="fa-solid fa-triangle-exclamation"></i> 路线渲染失败，可点底部「高德地图打开」使用官方导航</div>`;
  }
}

/**
 * B1 讲解溯源卡片：把 culture-story 返回的 knowledgeBase/themeId/themeName 显性化
 * - 核心主题（themeId 命中 CULTURE_THEMES 且有 facts）→ 蓝色系「📋 平台知识库」卡
 * - 扩展主题 / 无 facts → 橙色系「🌐 AI 联网生成」卡（复用黄标样式规范）
 * - 响应缺 themeId → 返回空串（优雅降级，不渲染卡片）
 * 摘要 2 条：核心主题取知识库 facts 前 2 条；扩展主题无 facts，取讲解正文前 2 段
 */
function _traceCardHtml(story) {
  if (!story || !story.themeId) return '';
  const theme = getThemeById(story.themeId);
  const isCore = !!(theme && Array.isArray(theme.facts) && theme.facts.length > 0);
  const name = story.themeName || (theme && theme.name) || '';
  if (!name) return '';
  const era = (theme && theme.era) || story.era || '';
  const region = (theme && theme.region) || '';
  const facts = isCore
    ? theme.facts.slice(0, 2)
    : String(story.connotation || '').split(/\n+/).filter(Boolean).slice(0, 2);
  const chips = [
    era ? `<span class="trace-chip"><i class="fa-regular fa-clock"></i> <em title="${_esc(era)}">${_esc(era)}</em></span>` : '',
    region ? `<span class="trace-chip"><i class="fa-solid fa-location-dot"></i> <em title="${_esc(region)}">${_esc(region)}</em></span>` : ''
  ].join('');
  const factList = facts.map(f => `<li>${_esc(f)}</li>`).join('');
  return `
    <div class="trace-card ${isCore ? 'kb' : 'ai'}">
      <div class="trace-head">
        ${isCore
          ? '<span class="trace-badge"><i class="fa-solid fa-database"></i> 📋 平台知识库</span>'
          : '<span class="trace-badge"><i class="fa-solid fa-globe"></i> 🌐 AI 联网生成</span>'}
        <a class="trace-link" href="#/atlas?theme=${_esc(story.themeId)}">查看完整知识卡 →</a>
      </div>
      <div class="trace-theme">${_esc(name)}</div>
      ${chips ? `<div class="trace-chips">${chips}</div>` : ''}
      ${factList ? `<ul class="trace-facts">${factList}</ul>` : ''}
      ${isCore ? '' : '<p class="trace-note"><i class="fa-solid fa-triangle-exclamation"></i> 本卡内容为 AI 联网搜索生成，仅供参考</p>'}
    </div>`;
}

/** 景点 AI 深度讲解：culture-story（骨架屏 → 渲染 + 补全语音文本；失败静默保留基础介绍） */
async function _fetchSpotStory(area, spot) {
  const target = () => overlayEl && currentAreaId === area.areaId && currentSpotId === spot.id ? overlayEl.querySelector('#sn-spot-story') : null;
  const box = target();
  if (!box) return;
  box.innerHTML = `
    <div class="sn-skeleton">
      <div class="sk" style="width:94%;"></div><div class="sk" style="width:100%;"></div>
      <div class="sk" style="width:88%;"></div>
    </div>
  `;
  try {
    const r = await fetch('/api/ai/culture-story', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ subject: `${area.name}·${spot.name}`, description: spot.desc })
    });
    const story = await r.json();
    if (!r.ok || !story || !story.name) throw new Error((story && story.error) || `HTTP ${r.status}`);
    const cur = target();
    if (!cur) return;
    currentStory = story;
    const paras = String(story.connotation || '').split(/\n+/).filter(Boolean)
      .map(p => `<div class="sn-fact"><i class="fa-solid fa-landmark"></i><div>${_esc(p)}</div></div>`).join('');
    cur.innerHTML = `
      ${paras}
      ${story.legend ? `<div class="sn-legend">${_esc(story.legend)}</div>` : ''}
      ${_traceCardHtml(story)}
      <span class="sn-source-badge ai"><i class="fa-solid fa-robot"></i> AI 生成，仅供参考</span>
    `;
    // 补全语音讲解文本（基础介绍 + AI 深度讲解）
    const full = `${area.name}${spot.name}。${spot.desc} ${String(story.connotation || '').replace(/\n+/g, ' ')} 典故：${story.legend || ''} 游览指引：${spot.walk}`;
    overlayEl.querySelectorAll('.tts-btn[data-tts-text]').forEach(btn => btn.setAttribute('data-tts-text', full));
  } catch (e) {
    console.warn('[ScenicGuide] 景点讲解生成失败，保留基础介绍:', e && e.message);
    const cur = target();
    if (cur) cur.innerHTML = '';
  }
}

// ------------------------------------------------------------
// mini 定位地图（高德，失败静默降级文字位置）
// ------------------------------------------------------------
async function _renderMiniMap(area, loc) {
  const boxEl = overlayEl && currentAreaId === area.areaId && !currentSpotId ? overlayEl.querySelector('#sn-map-box') : null;
  if (!boxEl) return;
  if (!loc) { boxEl.innerHTML = `<div class="sn-map-fallback"><i class="fa-solid fa-location-dot"></i> ${_esc(area.region)}</div>`; return; }
  if (!AMAP_KEY) { boxEl.innerHTML = `<div class="sn-map-fallback"><i class="fa-solid fa-location-dot"></i> ${_esc(loc.place || area.region)}</div>`; return; }
  try {
    const AMap = await _loadAMap();
    const box2 = overlayEl && currentAreaId === area.areaId && !currentSpotId ? overlayEl.querySelector('#sn-map-box') : null;
    if (!box2) return;
    box2.innerHTML = '<div id="sn-map"></div>';
    _destroyMap();
    mapKey = area.areaId;
    mapInstance = new AMap.Map('sn-map', {
      center: [loc.lng, loc.lat],
      zoom: 11,
      mapStyle: 'amap://styles/dark',
      viewMode: '2D'
    });
    mapInstance.add(new AMap.Marker({
      position: [loc.lng, loc.lat],
      anchor: 'bottom-center',
      content: `<div style="padding:4px 10px;border-radius:12px;background:rgba(16,185,129,.92);color:#fff;font-size:12px;white-space:nowrap;">${_icon(area)} ${_esc(area.name)}</div>`
    }));
  } catch (e) {
    console.warn('[ScenicGuide] mini 地图加载失败，降级文字位置:', e && e.message);
    const box3 = overlayEl && currentAreaId === area.areaId && !currentSpotId ? overlayEl.querySelector('#sn-map-box') : null;
    if (box3) box3.innerHTML = `<div class="sn-map-fallback"><i class="fa-solid fa-location-dot"></i> ${_esc(loc.place || area.region)}（地图加载失败）</div>`;
  }
}

function _destroyMap() {
  if (mapInstance) {
    try { mapInstance.destroy(); } catch (e) { /* ignore */ }
    mapInstance = null;
  }
  mapKey = null;
}

/** 动态加载高德 JS API 2.0（与足迹页共享单例 Promise） */
function _loadAMap() {
  if (window.AMap) return Promise.resolve(window.AMap);
  if (window._amapLoading) return window._amapLoading;
  window._amapLoading = new Promise((resolve, reject) => {
    const s = document.createElement('script');
    s.src = `https://webapi.amap.com/maps?v=2.0&key=${AMAP_KEY}`;
    s.onload = () => window.AMap ? resolve(window.AMap) : reject(new Error('AMap 未挂载'));
    s.onerror = () => reject(new Error('高德脚本加载失败'));
    document.head.appendChild(s);
    setTimeout(() => reject(new Error('高德脚本加载超时')), 10000);
  });
  return window._amapLoading;
}

// ------------------------------------------------------------
// 路由（#/scenic / #/scenic?area=xx / #/scenic?area=xx&spot=yy）
// ------------------------------------------------------------
function isScenicHash() {
  return /^#\/scenic(?:\?.*)?$/.test(window.location.hash || '');
}

function _parseHash() {
  const h = window.location.hash || '';
  const area = h.match(/[?&]area=([\w-]+)/);
  const spot = h.match(/[?&]spot=([\w-]+)/);
  const theme = h.match(/[?&]theme=([\w-]+)/); // 旧版深链兼容：theme → 对应景区
  let areaId = area ? area[1] : null;
  if (!areaId && theme) {
    const hit = SCENIC_AREAS.find(a => a.themeId === theme[1]);
    if (hit) areaId = hit.areaId;
  }
  return { areaId, spotId: spot ? spot[1] : null };
}

async function openFromHash() {
  if (!isScenicHash()) { closeScenic(); return; }
  const { areaId, spotId } = _parseHash();
  if (!overlayEl) {
    await openScenic();
    if (!overlayEl) return;
  }
  if (areaId && spotId) {
    if (areaId !== currentAreaId || spotId !== currentSpotId) _renderSpot(areaId, spotId);
    return;
  }
  if (areaId) {
    if (areaId !== currentAreaId || currentSpotId) _renderArea(areaId);
    return;
  }
  if (currentAreaId) _renderGrid(); // 从详情返回列表
}

window.ScenicRecommend = { openScenic, closeScenic, openFromHash };

export { openScenic, closeScenic, openFromHash, isScenicHash };
