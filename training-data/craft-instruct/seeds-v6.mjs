// ============================================================
// seeds-v6.mjs — v6 文创蒸馏种子生成器（T6b，全品类知识库 + 上下文贴题版）
// 维度设计（对标生产 prompt 的三要素：作品标题 / 文化主题 / 用户想法）：
//   A 核心主题贴题组：12 核心主题 × 56 条（标题形式 5 × 想法模板轮换）
//   B 泛称表达强化组：12 主题 × 15 泛称（v5 教训：周边/伴手礼/衍生品必须覆盖）
//   C 景区地标组：26 景区（除黑名单）标题无主题匹配 → prompt 无主题行分支
//   D 景点组：129 景点做标题（同 C 分支，标题形式更碎片化）
//   E 无标题组：title='' → prompt 无上下文行分支（离线/极端情形泛化）
// 防泄漏：LEAK_BLACKLIST 中的验收 OOD 主题严禁进入训练集（T8 验收用）
// 产出：seeds-v6.jsonl，每行 {artworkTitle, themeId, idea}
// 用法：node training-data/craft-instruct/seeds-v6.mjs
// ============================================================
import { writeFileSync } from 'node:fs';
import { CULTURE_THEMES } from '../../data/culture-knowledge.js';
import { SCENIC_AREAS } from '../../data/scenic-spots.js';

// —— 验收 OOD 主题黑名单（T8 craft_accept_v6.py 的 20 条验收主题词根；含用户报告案例秦淮河夫子庙）——
export const LEAK_BLACKLIST = [
  '秦淮河', '夫子庙', '大足石刻', '福建土楼', '京杭大运河', '都江堰', '乐山大佛',
  '布达拉宫', '避暑山庄', '曲阜', '殷墟', '良渚', '开平碉楼', '庐山', '武夷山',
  '三清山', '青城山', '峨眉山', '龙门石窟', '云台山'
];

// —— 热门产品（想法表达维度；全部在 data/craft-products.js 知识库内）——
const HOT = ['冰箱贴', '徽章', '书签', '明信片', '丝巾', '帆布包', '钥匙扣', '挂件', '盲盒', '笔记本', '手机壳', '茶具'];

// —— 标题形式（模拟真实用户作品标题的多样性）——
const TITLE_FORMS = [
  (kw) => kw,
  (kw) => `${kw}·夜话`,
  (kw) => `梦回${kw}`,
  (kw) => `${kw}印象`,
  (kw) => `${kw}（数字创作）`
];

// —— 想法模板（kw=主题关键词 / p=产品名；覆盖明确产品/泛称/风格/场景四类表达）——
const IDEA_TEMPLATES = [
  (kw, p) => `做一个${p}，把${kw}元素融进去`,
  (kw, p) => `想要${kw}主题的${p}，送朋友`,
  (kw, p) => `把这幅画做成${p}`,
  (kw, p) => `${p}形式的文创，重点突出${kw}`,
  (kw) => `想买点${kw}相关的周边，帮我设计一下`,
  (kw) => `做一个有${kw}特色的伴手礼`,
  (kw) => `设计一款${kw}主题衍生品`,
  (kw) => `来个${kw}纪念品方案，要有文化味`,
  (kw) => `国风一点，重点画${kw}`,
  (kw) => `赛博霓虹风格的${kw}文创`,
  (kw) => `水墨留白的感觉，主题围绕${kw}`,
  (kw) => `喜庆一点的${kw}文创，过年送人`,
  (kw) => `极简现代风，做${kw}的文创产品`,
  (kw) => `围绕${kw}做个文创，要适合日常用`
];

// —— 泛称表达（B 组强化：v5 教训，泛称类 OOD 输入曾致枚举混淆）——
const GENERIC_WORDS = ['周边', '伴手礼', '衍生品', '纪念品', '文创产品', '礼物', '手信', '小玩意', '收藏品', '摆件', '实用小物', '旅游纪念品', '展览周边', '博物馆文创', '联名款'];

// —— 景区/景点想法模板（无主题上下文分支）——
const SCENIC_IDEAS = [
  (t) => `把${t}做成文创`,
  (t) => `${t}主题的伴手礼`,
  (t) => `想去${t}玩，先做个纪念品`,
  (t) => `${t}的冰箱贴`,
  (t) => `${t}风格的周边`,
  (t) => `以${t}为灵感的衍生品`,
  (t) => `${t}明信片，要好看的`,
  (t) => `${t}元素的书签`
];

// —— 黑名单扫描（任一黑名单词出现在标题或想法中即丢弃）——
function hitsBlacklist(text) {
  return LEAK_BLACKLIST.some(w => text.includes(w));
}

const seeds = [];
let filtered = 0;
function push(artworkTitle, themeId, idea) {
  if (hitsBlacklist(artworkTitle) || hitsBlacklist(idea)) { filtered++; return; }
  seeds.push({ artworkTitle, themeId: themeId || '', idea });
}

// A 核心主题贴题组：12 主题 × 5 标题形式 × 12 模板（kw/p 轮换）≈ 56-60 条/主题
for (const theme of CULTURE_THEMES) {
  const kws = theme.keywords.slice(0, 3); // 每主题取前 3 个关键词做 kw 轮换
  TITLE_FORMS.forEach((tf, fi) => {
    IDEA_TEMPLATES.forEach((tpl, ti) => {
      const kw = kws[(fi + ti) % kws.length];
      const p = HOT[(fi * 3 + ti) % HOT.length];
      push(tf(kw), theme.themeId, tpl(kw, p));
    });
  });
  // B 泛称组：15 泛称 × 该主题（标题形式轮换）
  GENERIC_WORDS.forEach((g, gi) => {
    const kw = kws[gi % kws.length];
    push(TITLE_FORMS[gi % TITLE_FORMS.length](kw), theme.themeId, `做一个${kw}的${g}，能体现文化底蕴`);
  });
}

// C 景区地标组 + D 景点组（themeId=''，matchThemeByText 不命中 → 无主题行）
for (const area of SCENIC_AREAS) {
  SCENIC_IDEAS.forEach((tpl, i) => {
    const kw = area.name;
    push(kw, '', tpl(i % 3 === 0 ? `${kw}风景` : kw));
  });
  // D 景点：每景区取前 5 个景点名各 1 条
  for (const spot of (area.spots || []).slice(0, 5)) {
    push(spot.name, '', `把${spot.name}做成文创纪念品`);
  }
}

// E 无标题组（title='' → prompt 无任何上下文行）
IDEA_TEMPLATES.forEach((tpl, i) => {
  const kw = CULTURE_THEMES[i % CULTURE_THEMES.length].keywords[0];
  push('', '', tpl(kw, HOT[i % HOT.length]));
});

// F 扩展表达组（T6c 补蒸馏：新标题形式 × 新想法模板，关键词/产品轮换错开 A/B 组降重复）
const EXTRA_TITLE_FORMS = [
  (kw) => `${kw}四季`,
  (kw) => `${kw}小记`,
  (kw) => `一梦${kw}`,
  (kw) => `${kw}拾光`
];
const EXTRA_IDEA_TEMPLATES = [
  (kw, p) => `${p}上印${kw}纹样，古典一点`,
  (kw, p) => `帮我把${kw}做成${p}，适合收藏`,
  (kw, p) => `${kw}元素${p}，要有辨识度`,
  (kw, p) => `做${p}，画面讲${kw}的故事`,
  (kw) => `${kw}主题的小众设计，不落俗套`,
  (kw) => `把${kw}的色彩感觉做成文创`,
  (kw) => `${kw}文创，质感和寓意都要好`,
  (kw) => `以${kw}为核，做年轻人会喜欢的文创`
];
for (const theme of CULTURE_THEMES) {
  const kws = theme.keywords.slice(0, 4);
  EXTRA_TITLE_FORMS.forEach((tf, fi) => {
    EXTRA_IDEA_TEMPLATES.forEach((tpl, ti) => {
      const kw = kws[(fi + ti + 1) % kws.length];
      const p = HOT[(fi * 5 + ti + 4) % HOT.length];
      push(tf(kw), theme.themeId, tpl(kw, p));
    });
  });
}

// —— 产出与统计 ——
const out = new URL('./seeds-v6.jsonl', import.meta.url);
writeFileSync(out, seeds.map(s => JSON.stringify(s)).join('\n') + '\n');
const core = seeds.filter(s => s.themeId).length;
const noTheme = seeds.filter(s => !s.themeId && s.artworkTitle).length;
const noTitle = seeds.filter(s => !s.artworkTitle).length;
console.log(`种子总数 ${seeds.length} 条（核心主题 ${core} / 地标无主题 ${noTheme} / 无标题 ${noTitle}），黑名单过滤丢弃 ${filtered} 条`);
console.log(`→ seeds-v6.jsonl`);
