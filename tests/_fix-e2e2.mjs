import fs from 'fs';
const p = 'E:/a/6a578b50553ee2fa56364236/tests/_e2e-full.mjs';
let c = fs.readFileSync(p, 'utf8');
// L294 broken: `t`tabs=...`` → proper template
c = c.replace(
  "logStep('settings', 'Tab ≥ 4', settingsInfo.tabs >= 4, `t`tabs=${settingsInfo.tabs}``, 'medium');",
  "logStep('settings', 'Tab ≥ 4', settingsInfo.tabs >= 4, `tabs=${settingsInfo.tabs}`, 'medium');"
);
fs.writeFileSync(p, c, 'utf8');
console.log('Fixed');
