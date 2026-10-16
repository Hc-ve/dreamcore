import { execFileSync } from 'node:child_process';
const EDGE = 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe';
const out = 'e:/a/6a578b50553ee2fa56364236/.tmp-shot/shots/craft-top.png';
execFileSync(EDGE, [
  '--headless=new','--disable-gpu','--no-sandbox','--hide-scrollbars',
  '--force-device-scale-factor=1.5',
  `--screenshot=${out}`, '--window-size=1440,900',
  '--virtual-time-budget=6000',
  'file:///e:/a/6a578b50553ee2fa56364236/scenic-recommend-design/pages/craft-match.html'
], { stdio: 'inherit' });
