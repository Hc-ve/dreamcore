import fs from "fs";
let s = fs.readFileSync("css/style.css", "utf8");

// 找到 L1063 那条 .user-avatar-btn（覆盖之前那条的版本），加 width/height
const oldRule = `.user-avatar-btn {
  border: none; background: none; padding: 0; border-radius: 50%;
  cursor: pointer; transition: transform 0.3s;
}`;
const newRule = `.user-avatar-btn {
  width: 30px; height: 30px;
  border: none; background: none; padding: 0; border-radius: 50%;
  cursor: pointer; transition: transform 0.3s; overflow: hidden;
}`;
if (s.includes(oldRule)) {
  s = s.replace(oldRule, newRule);
  console.log("✅ .user-avatar-btn +width/height 30x30 +overflow:hidden");
} else {
  // CRLF 兼容
  const oldCRLF = oldRule.replace(/\n/g, "\r\n");
  const newCRLF = newRule.replace(/\n/g, "\r\n");
  if (s.includes(oldCRLF)) {
    s = s.replace(oldCRLF, newCRLF);
    console.log("✅ patched (CRLF)");
  } else {
    console.log("❌ old rule not found, searching...");
    const i = s.lastIndexOf(".user-avatar-btn {");
    console.log(`  last occurrence at: ${i}`);
  }
}

// 追加 .lg 变体
s += `

/* 下拉菜单里的大头像按钮 — 44x44 */
.user-avatar-btn.lg { width: 44px; height: 44px; }
`;

fs.writeFileSync("css/style.css", s);
console.log("✅ .user-avatar-btn.lg +44x44 appended");
