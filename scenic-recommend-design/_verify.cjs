const fs = require('fs');
const path = require('path');
const http = require('http');
const root = __dirname;
const pages = ['entry-nav','entry-hero','entry-cta','entry-result','entry-profile','scenic-list','scenic-feed','scenic-detail','craft-match','share-poster','design-spec'];

const compCss = fs.readFileSync(path.join(root,'partials/components.css'),'utf8');
const defined = new Set();
for (const m of compCss.matchAll(/\.([a-zA-Z][a-zA-Z0-9_-]*)/g)) defined.add(m[1]);
const tokenCss = fs.readFileSync(path.join(root,'colors_and_type.css'),'utf8');
for (const m of tokenCss.matchAll(/\.([a-zA-Z][a-zA-Z0-9_-]*)/g)) defined.add(m[1]);

function get(url){return new Promise(res=>{http.get(url,r=>{let d='';r.on('data',c=>d+=c);r.on('end',()=>res({code:r.statusCode}));}).on('error',e=>res({code:0,err:String(e)}));});}

(async()=>{
  for(const name of pages){
    const file = path.join(root,'pages',name+'.html');
    const html = fs.readFileSync(file,'utf8');
    const r = await get('http://127.0.0.1:8899/pages/'+name+'.html');
    const used = new Set();
    for (const m of html.matchAll(/class="([^"]+)"/g)) m[1].split(/\s+/).forEach(c=>c&&used.add(c));
    const missing = [...used].filter(c=>!defined.has(c));
    const imgs = [...html.matchAll(/\.\.\/assets\/([a-zA-Z0-9_.-]+)/g)].map(m=>m[1]);
    const imgMissing = [...new Set(imgs)].filter(f=>!fs.existsSync(path.join(root,'assets',f)));
    const doms = [...html.matchAll(/data-dom-id="([^"]+)"/g)].map(m=>m[1]);
    const hasTokens = html.includes('--sn-primary:');
    const hasFA = html.includes('fontawesome');
    console.log(`[${name}] http=${r.code} bytes=${Buffer.byteLength(html)} classUsed=${used.size} classMissingCss=${missing.length} tokens=${hasTokens} fa=${hasFA}`);
    if(missing.length) console.log('   UNDEFINED-CLASS: '+missing.join(', '));
    if(imgMissing.length) console.log('   MISSING-IMG: '+imgMissing.join(', '));
    if(doms.length) console.log('   domIds: '+doms.join(', '));
  }
})();
