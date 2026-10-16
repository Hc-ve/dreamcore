// ============================================================
// make-accept-assets-v6.mjs — 导出验收枚举资产（craft_accept_v6.py 读取）
// 从生产数据模块同源导出，杜绝手抄漂移：
//   productNames（235 产品名全集）/ layoutTypeMap（14 版式→craftType）/ hotNames（生产 prompt 前 16 热门）
// 用法：node training-data/craft-instruct/make-accept-assets-v6.mjs
// ============================================================
import { writeFileSync } from 'node:fs';
import { CRAFT_PRODUCTS } from '../../data/craft-products.js';
import { LAYOUTS } from '../../js/craft-layout.js';

const assets = {
  productNames: CRAFT_PRODUCTS.map(p => p.name),
  hotNames: CRAFT_PRODUCTS.filter(p => p.hot).slice(0, 16).map(p => p.name),
  layoutTypeMap: Object.fromEntries(Object.keys(LAYOUTS).map(k => [k, LAYOUTS[k].craftTypes]))
};
writeFileSync(new URL('./accept-assets-v6.json', import.meta.url), JSON.stringify(assets, null, 1));
console.log(`accept-assets-v6.json：${assets.productNames.length} 产品 / ${Object.keys(assets.layoutTypeMap).length} 版式 / ${assets.hotNames.length} 热门`);
