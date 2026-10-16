// 在浏览器 Console 里跑这个，快速验证每个 tab 函数会不会抛错
const res = {};
['tabProfile','tabAppearance','tabGeneral','tabNotify','tabPrivacy','tabAbout'].forEach(fn => {
  try {
    const s = eval(fn + '()');
    res[fn] = `✅ OK (${s.length} chars)`;
  } catch (e) {
    res[fn] = `❌ ERROR: ${e.message}`;
  }
});
console.table(res);
