// ============================================================
// seed-samples.mjs — 人工撰写的高质量种子样本（16 条，覆盖全部 8 风格）
// 展开为与生产 prompt 完全一致的 instruction-output 训练样本，
// 产出 seed-samples.jsonl，可直接并入 train.jsonl
// ============================================================
import { writeFileSync } from 'node:fs';

const CRAFT_TYPE_KEYS = 'wallpaper/poster/card/postcard/template';
const CRAFT_STYLE_KEYS = 'guofeng/feiyi/minimal/qinghua/dunhuang/ink/neon/festive';
function buildIdeaPrompt(idea) {
  return [
    '你是"AI+文旅文创"平台的文创设计顾问，为用户想法定制文创衍生品方案。',
    '用户想法：「' + idea + '」。',
    '请严格输出一个 JSON 对象（禁止 markdown 代码块、禁止任何多余文字），字段如下：',
    'title：文创标题，8-16 个汉字，有文旅美感；',
    'subtitle：副标题文案，10-20 个汉字；',
    'craftType：从 [' + CRAFT_TYPE_KEYS + '] 中选最匹配的一项；',
    'style：从 [' + CRAFT_STYLE_KEYS + '] 中选最匹配的一项；',
    'stickers：0-3 个契合主题的 emoji 装饰，JSON 字符串数组。'
  ].join('\n');
}

// 紧凑定义：[想法, 标题, 副标题, craftType, style, 贴纸]
const SAMPLES = [
  ['敦煌飞天反弹琵琶主题的桌面壁纸', '飞天神韵·大漠华章', '反弹琵琶舞千年，壁上飞天落人间', 'wallpaper', 'dunhuang', ['🕌', '🏮']],
  ['把敦煌壁画九色鹿做成邮寄明信片', '九色鹿踪·丝路信笺', '一纸寄月牙泉畔，沙海驼铃入梦来', 'postcard', 'dunhuang', ['🐪', '📜']],
  ['宋韵点茶雅集的宣传海报', '宋韵雅集·点茶成画', '执一盏茶烟入画，赴一场宋韵之约', 'poster', 'guofeng', ['🍵', '🏮']],
  ['把江南烟雨庭园做成社交分享模板', '烟雨江南·水墨手账', '一页烟雨藏江南，半幅留白待君题', 'template', 'guofeng', ['🌸', '☔']],
  ['苗银锻造技艺的收藏卡牌', '苗银流光·锦绣卡藏', '錾花银纹凝指尖，苗岭风华藏方寸', 'card', 'feiyi', ['🦚', '🧿']],
  ['扎染蓝白纹样桌面壁纸', '扎染青白·蓝沁屏间', '一缸蓝染千年艺，青白纹样入屏来', 'wallpaper', 'feiyi', ['🪷', '🍂']],
  ['美术馆导视设计的明信片', '留白之城·艺旅明信', '线条勾勒城市轮廓，留白安放旅途回忆', 'postcard', 'minimal', ['🎫', '⛩️']],
  ['现代艺术画册的社交分享模板', '极简美学·艺术分享', '少即是多的城市诗意，分享你的艺术瞬间', 'template', 'minimal', ['👾', '🗼']],
  ['青花瓷缠枝莲的收藏卡牌', '青花缠枝·瓷韵卡藏', '缠枝莲绕千年窑火，青花瓷映东方雅韵', 'card', 'qinghua', ['🫖', '🌸']],
  ['青花海水江崖纹的明信片', '青花水乡·烟波信札', '窑火淬炼青白韵，一笔水墨寄江南', 'postcard', 'qinghua', ['🌊', '🐦']],
  ['泼墨云山图桌面壁纸', '泼墨云山·案头千里', '墨分五色写云山，一屏烟雨养禅心', 'wallpaper', 'ink', ['🎑', '🍂']],
  ['水墨写意山水的宣传海报', '墨竹风骨·虚静长卷', '笔有枯荣见风骨，墨含浓淡写虚静', 'poster', 'ink', ['🎋', '🌫️']],
  ['数字敦煌光影展的宣传海报', '数字敦煌·霓虹夜游', '石窟壁画遇上赛博光影，千年美学点亮夜空', 'poster', 'neon', ['🕌', '⚡']],
  ['未来都市国潮霓虹的社交模板', '国潮霓虹·醒狮电音', '机械狮首踩电音节拍，国潮赛博燃动全场', 'template', 'neon', ['🐉', '🎧']],
  ['新年国潮醒狮的收藏卡牌', '醒狮贺岁·瑞卡迎春', '狮头一点金光起，瑞兽衔福入卡来', 'card', 'festive', ['🦁', '🧧']],
  ['元宵灯会龙灯的桌面壁纸', '玉兔灯彩·月满屏春', '一盏花灯照团圆，满屏年味伴岁时', 'wallpaper', 'festive', ['🐰', '🏮']]
];

const lines = SAMPLES.map(([idea, title, subtitle, craftType, style, stickers]) =>
  JSON.stringify({ instruction: buildIdeaPrompt(idea), output: JSON.stringify({ title, subtitle, craftType, style, stickers }) })
);
writeFileSync(new URL('./seed-samples.jsonl', import.meta.url), lines.join('\n') + '\n');
console.log(`已生成 ${lines.length} 条人工种子样本 → seed-samples.jsonl`);
