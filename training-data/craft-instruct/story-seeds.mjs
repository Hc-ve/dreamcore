// ============================================================
// story-seeds.mjs — v4 讲解任务蒸馏种子生成器
// 产出 story-seeds.jsonl，供 synthesize-story.mjs 消费。
// 种子设计原则：
//   ① 与生产 /api/ai/culture-story 两种 prompt 对齐：
//      - task=open   → buildStoryPromptOpen（扩展地标/泛主体，无事实卡）
//      - task=facts  → buildStoryPromptWithFacts（核心 12 主题事实卡注入）
//   ② 泛化覆盖：主体名/别名/景区口语化说法/带图片描述等多种用户表述
//   ③ 防测试泄漏：验收主题（黄山/泰山/武当山/龙门石窟）不进训练种子
// 用法：node training-data/craft-instruct/story-seeds.mjs
// ============================================================
import { writeFileSync } from 'node:fs';
import { EXTENDED_THEMES, CULTURE_THEMES } from '../../data/culture-knowledge.js';

// 模型验收专用主题（OOD 泛化测试，严禁加入训练种子）
const HOLDOUT = new Set(['huangshan', 'taishan', 'wudang', 'longmen']);

// —— 开放讲解主体池：非核心非扩展的文化名胜/文物/非遗（扩大泛化面）——
const EXTRA_SUBJECTS = [
  '黄鹤楼', '滕王阁', '岳阳楼', '蓬莱阁', '大足石刻', '麦积山石窟',
  '铜奔马', '曾侯乙编钟', '越王勾践剑', '金缕玉衣', '长信宫灯', '清明上河图',
  '千里江山图', '兰亭序', '后母戊鼎', '四羊方尊', '人面鱼纹彩陶盆', '击鼓说唱俑',
  '妈祖信俗', '侗族大歌', '蒙古族长调民歌', '杨柳青木版年画', '潍坊风筝', '宜兴紫砂壶',
  '龙泉青瓷', '德化白瓷', '景德镇传统瓷窑', '普洱茶制作技艺', '宣纸制作技艺', '徽墨制作技艺',
  '中国活字印刷术', '中国算盘', '二十四节气', '南京云锦', '蜀锦织造技艺', '苗族银饰锻制技艺',
  '唐卡', '中国桑蚕丝织技艺', '福州脱胎漆器', '北京兔儿爷'
];

// —— 开放讲解：每个扩展主题的表述变体（subject/description 参数组合）——
function openVariants(t) {
  const v = [
    { subject: t.name, description: '' },                                    // 裸主题名（scenic/atlas 主入口）
    { subject: t.aliases[0] || t.name, description: '' },                    // 别名说法
    { subject: t.name + '风景区', description: '' },                         // 口语化泛称
    { subject: t.name, description: `${t.name}的标志性景观，游客打卡照` },     // 识图带描述
    { subject: t.name, description: `一张${t.category}题材的照片` }           // 泛化图片描述
  ];
  return v.map(x => ({ task: 'open', themeId: t.themeId, ...x }));
}

const seeds = [];
// 扩展主题（剔除验收 HOLDOUT）× 5 变体
for (const t of EXTENDED_THEMES) {
  if (HOLDOUT.has(t.themeId)) continue;
  seeds.push(...openVariants(t));
}
// 额外文化主体 × 2 变体（裸名 + 带描述）
for (const s of EXTRA_SUBJECTS) {
  seeds.push({ task: 'open', themeId: null, subject: s, description: '' });
  seeds.push({ task: 'open', themeId: null, subject: s, description: `一张关于${s}的照片` });
}
// 事实卡注入：核心 12 主题 × 7 个采样变体（同 prompt 不同温度采样，教师忠实转述）
for (const t of CULTURE_THEMES) {
  for (let i = 0; i < 7; i++) {
    seeds.push({ task: 'facts', themeId: t.themeId, subject: t.name, description: '', sample: i });
  }
}

writeFileSync(new URL('./story-seeds.jsonl', import.meta.url), seeds.map(s => JSON.stringify(s)).join('\n') + '\n');
const open = seeds.filter(s => s.task === 'open').length;
const facts = seeds.filter(s => s.task === 'facts').length;
console.log(`种子生成完成：共 ${seeds.length} 条（开放讲解 ${open} + 事实卡注入 ${facts}）→ story-seeds.jsonl`);
console.log(`验收保留主题（未入训练）：${[...HOLDOUT].join('、')}`);
