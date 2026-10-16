import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { join } from 'node:path';

const PAGES_DIR = 'e:/a/6a578b50553ee2fa56364236/scenic-recommend-design/pages';
const SHOT_DIR = 'e:/a/6a578b50553ee2fa56364236/.tmp-shot/shots';
const EDGE = 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe';

const pages = [
  'entry-nav','entry-hero','entry-cta','entry-result','entry-profile',
  'scenic-list','scenic-feed','scenic-detail','craft-match','share-poster','design-spec'
];
const tall = new Set(['scenic-list','scenic-feed','scenic-detail','craft-match']);

const MARK = '.note-line { font-size: 12.5px; color: var(--sn-text-tertiary); margin: 6px 0 0; }';
const ADD = '\n.list-hero { padding: 6px 0 2px; }\n.pill-btn.xs { padding: 5px 12px; font-size: 12px; gap: 5px; box-shadow: 0 3px 10px rgba(52,211,153,.3); }';

mkdirSync(SHOT_DIR, { recursive: true });

for (const name of pages) {
  const fp = join(PAGES_DIR, name + '.html');
  let html = readFileSync(fp, 'utf8');
  if (!html.includes('.list-hero {')) {
    if (!html.includes(MARK)) throw new Error('mark not found in ' + name);
    html = html.replace(MARK, MARK + ADD);
    writeFileSync(fp, html, 'utf8');
    console.log('patched', name);
  } else {
    console.log('skip-patch', name);
  }

  const out = join(SHOT_DIR, name + '.png');
  if (existsSync(out)) { console.log('shot exists', name); continue; }
  const h = tall.has(name) ? 5200 : (name === 'share-poster' ? 1000 : 950);
  const url = 'file:///' + fp.replace(/\\/g, '/');
  execFileSync(EDGE, [
    '--headless=new','--disable-gpu','--no-sandbox','--hide-scrollbars',
    '--force-device-scale-factor=1',
    `--screenshot=${out}`, `--window-size=1440,${h}`,
    '--virtual-time-budget=6000', url
  ], { stdio: 'ignore', timeout: 60000 });
  console.log('shot', name, existsSync(out) ? 'OK' : 'FAIL');
}
