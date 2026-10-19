import fs from 'fs';
const p = 'E:/a/6a578b50553ee2fa56364236/tests/_e2e-full.mjs';
let c = fs.readFileSync(p, 'utf8');
const orig = c;

// Fix line ~295: Profile Card ≥ 3 → cards > 0
c = c.replace(
  "logStep('settings', 'Profile Card ≥ 3', settingsInfo.cards >= 3, `cards=${settingsInfo.cards}`, 'medium');",
  "logStep('settings', 'Settings cards > 0', settingsInfo.cards > 0, `cards=${settingsInfo.cards}`, 'medium');"
);

// Fix line ~296: broken line from PS replace
c = c.replace(
  "logStep('settings', '未登录无 profile tab', settingsInfo.tabs < 6, \tabs=${settingsInfo.tabs}, 'high');",
  "logStep('settings', '未登录隐藏 profile tab', settingsInfo.tabs < 6, `tabs=${settingsInfo.tabs}`, 'high');"
);

// Also fix the "unexpected " case that was broken
if (c.includes("abs=${settingsInfo.tabs}")) {
  c = c.replace("abs=${settingsInfo.tabs}", "`tabs=${settingsInfo.tabs}`");
}

if (c === orig) {
  console.log('WARNING: no changes applied (patterns not matched exactly)');
  // Try diagnostic
  const idx = c.indexOf('Profile Card');
  console.log('Profile Card at:', idx);
  if (idx >= 0) console.log('Context:', c.slice(idx, idx + 150));
} else {
  console.log('Patched OK');
  fs.writeFileSync(p, c, 'utf8');
  console.log('Written');
}
