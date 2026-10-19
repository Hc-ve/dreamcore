import { chromium } from "playwright";
const browser = await chromium.launch({ channel: "msedge", headless: true });
const page = await browser.newPage({ viewport: { width: 1400, height: 900 } });

// 收集控制台
const logs = []; page.on("console", m => logs.push(`[${m.type()}] ${m.text().slice(0, 120)}`));

await page.goto("http://localhost:5173/", { waitUntil: "load" });
await page.waitForTimeout(3500);

// Mock Supabase off（localStorage 模式）
await page.route("**/supabase-client.js", route => route.fulfill({
  status: 200, contentType: "application/javascript",
  body: `export const supabaseEnabled = false; export const supabase = null;`
}));
await page.reload({ waitUntil: "load" });
await page.waitForTimeout(3000);

// ===== 步骤 1: 确认画廊初始数据 =====
const before = await page.evaluate(async () => {
  const all = await window.getAllArtworks();
  return { total: all.length, has绿野: all.some(a => a.title?.includes('绿野')), titles: all.slice(0, 3).map(a => a.title) };
});
console.log("① 初始画廊:", before.total, "件, 含绿野?", before.has绿野);

// ===== 步骤 2: 发布"绿野"作品 =====
const publish = await page.evaluate(async () => {
  // 找最大 id + 1
  const all = await window.getAllArtworks();
  const maxId = Math.max(0, ...all.map(a => a.id || 0));
  const nextId = maxId + 1;

  // 生成 "绿野" 数据
  const c = document.createElement("canvas");
  c.width = 400; c.height = 400;
  const ctx = c.getContext("2d");
  const g = ctx.createLinearGradient(0, 0, 0, 400);
  g.addColorStop(0, "#2d5a3d"); g.addColorStop(1, "#88c9a1");
  ctx.fillStyle = g; ctx.fillRect(0, 0, 400, 400);
  const bigArt = c.toDataURL("image/png");

  const art = {
    id: nextId,
    title: "绿野",
    author: "admin",
    description: "绿野仙踪 梦幻森林 数字艺术",
    category: "fine-art",
    tags: ["绿野", "森林", "自然", "梦幻"],
    imageUrl: bigArt,
    likes: 0,
    views: 0,
    createdAt: Date.now(),
    status: "published",
  };
  const ok = await window.addArtwork(art);
  const verify = await window.getArtworkById(nextId);
  return { ok, id: nextId, verifyTitle: verify?.title, verifyAuthor: verify?.author };
});
console.log("② 发布 '绿野':", JSON.stringify(publish));

// ===== 步骤 3: 画廊应能看到 =====
const galleryNow = await page.evaluate(async () => {
  const all = await window.getAllArtworks();
  const ly = all.find(a => a.title === "绿野");
  return { total: all.length, has绿野: !!ly, lyAuthor: ly?.author, lyTags: ly?.tags };
});
console.log("③ 画廊刷新后:", galleryNow.total, "件, 绿野?", galleryNow.has绿野);

// ===== 步骤 4: 打开搜索面板搜 "绿野" =====
await page.evaluate(async () => {
  if (!window.Search?.allArtworks || window.Search.allArtworks.length === 0) {
    await window.Search.showSearchBar();
  }
});
await page.waitForTimeout(400);

const searchResult = await page.evaluate(async () => {
  // 强制刷新（走新代码路径）
  await window.Search.showSearchBar();
  await new Promise(r => setTimeout(r, 100));

  // 看 Search.allArtworks 最新
  const artworks = window.Search.allArtworks;
  const hasInCache = artworks.some(a => a.title === "绿野");

  // 跑搜索
  window.Search._doSearch("绿野");
  await new Promise(r => setTimeout(r, 200));

  const resultCount = window.Search.currentResults?.length;
  const resultTitles = (window.Search.currentResults || []).map(a => a.title);

  // 看 DOM
  const grid = document.getElementById("search-grid");
  const domCards = grid?.querySelectorAll(".search-card").length;
  const emptyState = document.querySelector("#search-results .empty-state")?.textContent?.trim();

  return { hasInCache, resultCount, resultTitles, domCards, emptyState };
});

console.log("\n④ 搜索 '绿野':");
console.log("   Search.allArtworks 含绿野?", searchResult.hasInCache);
console.log("   搜索结果数:", searchResult.resultCount);
console.log("   结果标题:", searchResult.resultTitles?.slice(0, 5));
console.log("   DOM 卡片数:", searchResult.domCards);
if (searchResult.emptyState) console.log("   ⚠️ 空状态:", searchResult.emptyState);

// ===== 步骤 5: 搜 "admin"（作者） =====
const authorResult = await page.evaluate(async () => {
  window.Search._doSearch("admin");
  await new Promise(r => setTimeout(r, 200));
  const titles = (window.Search.currentResults || []).map(a => a.title);
  const has绿野 = window.Search.currentResults?.some(a => a.title === "绿野");
  return { count: window.Search.currentResults?.length, has绿野, titles: titles.slice(0, 8) };
});
console.log("\n⑤ 搜作者 'admin':");
console.log("   命中 admin 的作品:", authorResult.count, "件");
console.log("   含绿野?", authorResult.has绿野);

const allOk = searchResult.hasInCache && searchResult.resultCount >= 1 && searchResult.has绿野 !== false;
console.log(`\n========== ${allOk ? "🎉 全部通过" : "❌ 仍有问题"} ==========`);
await browser.close();
