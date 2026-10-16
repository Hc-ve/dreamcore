// ============================================================
// seeds.mjs — 生成文创灵感"用户想法"种子集（离线，零 API 消耗）
// 组合规则：8 风格主题词库 × 5 品类 → 每组合多个自然语言想法
// 产出 seeds.jsonl：{"idea": "..."}，供 synthesize.mjs 蒸馏
// ============================================================
import { writeFileSync } from 'node:fs';

// 风格主题词库（与 js/ai-craft.js CRAFT_STYLES 8 个 key 一一对应）
const THEME_BANK = {
  guofeng: ['国风山水意境', '宋韵点茶雅集', '江南烟雨庭园', '昆曲水磨腔', '屏风水墨长卷'],
  feiyi: ['苗银锻造技艺', '扎染蓝白纹样', '侗族鼓楼纹样', '云锦织造龙纹', '羌绣羊角花'],
  minimal: ['城市文创极简logo', '美术馆导视设计', '现代艺术画册', '北欧风旅行手账', '极简城市明信片'],
  qinghua: ['青花瓷缠枝莲', '景德镇窑变釉色', '青花海水江崖纹', '江南水乡青花小景', '青花缠枝茶器'],
  dunhuang: ['敦煌飞天反弹琵琶', '莫高窟藻井纹样', '大漠丝路驼铃', '敦煌壁画九色鹿', '月牙泉鸣沙山夜色'],
  ink: ['水墨写意山水', '禅意留白书法', '烟雨江南水墨小景', '泼墨云山图', '墨竹风骨册页'],
  neon: ['赛博朋克夜游灯光节', '未来都市国潮霓虹', '数字敦煌光影展', '机械朋克龙舞', '全息投影庙会'],
  festive: ['春节庙会年味', '元宵灯会龙灯', '端午龙舟竞渡', '中秋玉兔灯彩', '新年国潮醒狮']
};

// 品类自然语言引导词（与 CRAFT_TYPES 5 个 key 一一对应）
const TYPE_HINT = {
  wallpaper: '桌面壁纸',
  poster: '宣传海报',
  card: '收藏卡牌',
  postcard: '邮寄明信片',
  template: '社交分享模板'
};

// 想法句式模板（模拟真实用户输入多样性）
const PATTERNS = [
  (theme, type) => `${theme}主题的${type}`,
  (theme, type) => `做一个${theme}风格的${type}`,
  (theme, type) => `${theme}，做成${type}送给朋友`,
  (theme, type) => `我想把${theme}做成${type}`,
  (theme, type) => `以${theme}为灵感的${type}，要有东方韵味`,
  (theme, type) => `${theme}元素${type}，适合文旅纪念品`
];

// 泛称类句式（真实用户常用"周边/衍生品/伴手礼"等泛称而非具体品类，
// 2026-09-24 验收发现此类表述为分布外输入导致 craftType 枚举混淆，故增补）
const GENERIC_PATTERNS = [
  (theme) => `${theme}文创周边`,
  (theme) => `${theme}主题的文创衍生品`,
  (theme) => `${theme}伴手礼`
];

const seeds = [];
const styles = Object.keys(THEME_BANK);
const types = Object.keys(TYPE_HINT);
for (const style of styles) {
  for (const type of types) {
    for (let i = 0; i < PATTERNS.length; i++) {
      const theme = THEME_BANK[style][i % THEME_BANK[style].length];
      seeds.push({ idea: PATTERNS[i](theme, TYPE_HINT[type]), style, type });
    }
  }
}
// 泛称类种子：每风格取 1 个主题 × 3 句式（无具体品类，让教师模型自行匹配 craftType）
for (const style of styles) {
  const theme = THEME_BANK[style][3 % THEME_BANK[style].length];
  for (const gp of GENERIC_PATTERNS) {
    seeds.push({ idea: gp(theme), style, type: '' });
  }
}
// 打乱顺序（训练时洗牌由训练框架负责，这里仅避免相邻同风格）
for (let i = seeds.length - 1; i > 0; i--) {
  const j = (i * 7 + 13) % (i + 1);
  [seeds[i], seeds[j]] = [seeds[j], seeds[i]];
}

writeFileSync(new URL('./seeds.jsonl', import.meta.url), seeds.map(s => JSON.stringify(s)).join('\n') + '\n');
console.log(`已生成 ${seeds.length} 条种子想法 → seeds.jsonl（8 风格 × 5 品类 × 6 句式 + 泛称类 24 条）`);
