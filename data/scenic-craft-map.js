// ============================================================
// data/scenic-craft-map.js — 景区 ↔ 文创风格/品类建议映射层
// 用途：把景区文化主题「智能」映射到 AI 文创工作台的风格模板与品类，
//       支撑「热门景区 → 一键生成 IP 文创」的主动生成链路（对接 js/scenic-recommend.js 创作引流）。
// 设计原则：
//   - key = scenic-spots.js 的 areaId（每景区唯一；themeId 可能缺失，故用 areaId 兜底）
//   - style   = js/ai-craft.js CRAFT_STYLES 的 key（guofeng/feiyi/minimal/qinghua/dunhuang/ink/neon/festive）
//   - category = data/craft-products.js CRAFT_CATEGORIES 的 key（stationery/office/.../home 等 10 类）
//   - 未收录的景区走 getScenicCraft 返回 null，工作台保持默认（guofeng / stationery）
// 依据：景区文化气质 → 视觉风格映射（石刻/禅宗 → 水墨；宋市井 → 国风节庆；青铜 → 国风）。
// ============================================================

export const SCENIC_CRAFT_MAP = {
  // 河南（首期 5 个头部景区）
  longmen:          { style: 'ink',     category: 'home' },  // 龙门石窟：石刻古拙 → 水墨丹青，装饰画/挂轴
  shaolin:          { style: 'ink',     category: 'life' },  // 嵩山少林寺：禅宗 → 禅意水墨，马克杯/保温杯
  yinxu:            { style: 'guofeng', category: 'home' },  // 殷墟：青铜/甲骨 → 国风厚重，家居陈设
  qingmingshanghe:  { style: 'festive', category: 'home' },  // 清明上河园：宋市井 → 节庆国潮，家居陈设
  laojunshan:       { style: 'ink',     category: 'home' },  // 老君山：道教云海 → 水墨写意，家居陈设
};

/**
 * 按 areaId 获取景区文创建议（无命中返回 null）
 * @param {string} areaId - 景区 areaId
 * @returns {{ style: string, category: string }|null}
 */
export function getScenicCraft(areaId) {
  if (!areaId) return null;
  return SCENIC_CRAFT_MAP[areaId] || null;
}