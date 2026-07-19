import{_ as S}from"./ai-group-OwmSI6Zi.js";const f={allArtworks:[],currentCategory:"all",currentSort:"latest",currentTag:null,renderedCount:0,pageSize:24,initialRenderCount:20,lightboxIndex:0,lightboxList:[],lightboxImageIndex:0,imgObserver:null,sentinelObserver:null,cardObserver:null,CATEGORY_LABELS:{all:"全部","digital-art":"数字艺术",photography:"摄影",illustration:"插画",abstract:"抽象","3d-art":"3D艺术"},IMAGE_CONFIG:{webpEnabled:null,cdnEnabled:!0,cdnProvider:"cloudflare",cdnOptions:{cloudflare:{accountHash:"ACCOUNT_HASH",baseUrl:"https://imagedelivery.net"},aliyun:{bucket:"dreamcore",region:"oss-cn-beijing",baseUrl:"https://dreamcore.oss-cn-beijing.aliyuncs.com"}},sizes:[{w:400,h:300,descriptor:"400w"},{w:600,h:450,descriptor:"600w"},{w:800,h:600,descriptor:"800w"},{w:1200,h:900,descriptor:"1200w"}],fallbacks:{"digital-art":"/images/fallback/digital-art.svg",photography:"/images/fallback/photography.svg",illustration:"/images/fallback/illustration.svg",abstract:"/images/fallback/abstract.svg","3d-art":"/images/fallback/3d-art.svg",all:"/images/fallback/all.svg"}},_detectWebP(){if(this.IMAGE_CONFIG.webpEnabled!==null)return this.IMAGE_CONFIG.webpEnabled;const e=document.createElement("canvas");return e.width=1,e.height=1,this.IMAGE_CONFIG.webpEnabled=e.toDataURL("image/webp").indexOf("data:image/webp")===0,this.IMAGE_CONFIG.webpEnabled},_getCategoryFallback(e){return this.IMAGE_CONFIG.fallbacks[e]||this.IMAGE_CONFIG.fallbacks.all},_buildImageUrl(e,t,s,i={}){if(!e)return"";if(e.startsWith("data:")||e.startsWith("/"))return e;const a=window.devicePixelRatio||1,n=Math.round(t*a),r=i.webp||this._detectWebP()?"webp":"jpeg";if(this.IMAGE_CONFIG.cdnEnabled&&this.IMAGE_CONFIG.cdnProvider==="cloudflare"){const l=this.IMAGE_CONFIG.cdnOptions.cloudflare,c=e.match(/picsum\.photos\/seed\/([^/]+)/),u=c?c[1]:"default";return`${l.baseUrl}/${l.accountHash}/${u}/w=${n},format=${r},q=80`}if(this.IMAGE_CONFIG.cdnEnabled&&this.IMAGE_CONFIG.cdnProvider==="aliyun"){const l=this.IMAGE_CONFIG.cdnOptions.aliyun,c=e.match(/picsum\.photos\/seed\/([^/]+)/),u=c?c[1]:"default";return`${l.baseUrl}/artworks/${u}.jpg?x-oss-process=image/resize,w_${n}/format,${r}/quality,q_80`}if(e.includes("picsum.photos/seed/")){const l=e.replace(/\/\d+\/\d+$/,""),c=i.webp?".webp":"";return`${l}/${n}/${Math.round(s*a)}${c}`}return e},SORT_LABELS:{latest:"最新",popular:"热门",recommended:"推荐"},async init(){this._bindFilters(),this._bindSort(),this._bindTagFilterClear(),await this.loadArtworks("all"),this._checkHashRoute(),window.addEventListener("hashchange",()=>this._checkHashRoute())},_checkHashRoute(){const e=window.location.hash,t=e&&e.match(/^#artwork-(\d+)$/);if(t){const s=t[1];this.openLightbox(s).catch(i=>console.warn("[Gallery] hash路由打开灯箱失败:",i))}},_bindFilters(){const e=document.getElementById("filter-bar");if(!e)return;const t=e.querySelectorAll(".filter-chip"),s=i=>{typeof Sound<"u"&&Sound.playSound("click"),t.forEach(a=>{a.classList.remove("active"),a.setAttribute("aria-selected","false"),a.setAttribute("tabindex","-1")}),i.classList.add("active"),i.setAttribute("aria-selected","true"),i.setAttribute("tabindex","0"),i.focus(),this.currentTag=null,this.loadArtworks(i.dataset.category)};t.forEach((i,a)=>{i.addEventListener("click",()=>s(i)),i.addEventListener("keydown",n=>{let r=a;if(n.key==="ArrowRight"||n.key==="ArrowDown")n.preventDefault(),r=(a+1)%t.length;else if(n.key==="ArrowLeft"||n.key==="ArrowUp")n.preventDefault(),r=(a-1+t.length)%t.length;else if(n.key==="Enter"||n.key===" "){n.preventDefault(),s(i);return}else n.key==="Home"?(n.preventDefault(),r=0):n.key==="End"&&(n.preventDefault(),r=t.length-1);r!==a&&(t[a].setAttribute("tabindex","-1"),t[r].setAttribute("tabindex","0"),t[r].focus())})})},_bindSort(){const e=document.getElementById("sort-select");e&&e.addEventListener("change",()=>{typeof Sound<"u"&&Sound.playSound("click"),this.currentSort=e.value,this._applySortAndFilter()})},_bindTagFilterClear(){const e=document.getElementById("clear-tag-btn");e&&e.addEventListener("click",()=>{typeof Sound<"u"&&Sound.playSound("click"),this.clearTagFilter()})},async loadArtworks(e="all",t=1){this.currentCategory=e,this.allArtworks=await getAllArtworks(),this._applySortAndFilter()},_calculateRenderCounts(){const e=window.innerHeight,t=document.getElementById("gallery")?.getBoundingClientRect().top||0,s=e-t,i=window.innerWidth<480?1:window.innerWidth<640||window.innerWidth<768?2:window.innerWidth<1024?3:4,n=Math.ceil(s/380)+2;this.initialRenderCount=Math.max(12,Math.min(30,n*i)),this.pageSize=Math.max(8,Math.min(24,Math.ceil(n*i*.8)))},_applySortAndFilter(){let e=[...this.allArtworks];this.currentCategory!=="all"&&(e=e.filter(i=>i.category===this.currentCategory)),this.currentTag&&(e=e.filter(i=>i.tags&&i.tags.includes(this.currentTag))),e=this._sortArtworks(e,this.currentSort),this.lightboxList=e,this._calculateRenderCounts(),this.renderedCount=0;const t=document.getElementById("gallery-grid");t&&(t.innerHTML=""),this.cardObserver&&(this.cardObserver.disconnect(),this.cardObserver=null),this._renderBatch();const s=document.getElementById("gallery-count");s&&(s.textContent=this.lightboxList.length),this._updateTagFilterDisplay(),this._updateStructuredData()},_updateStructuredData(){const e="https://dreamcore.art",t=this.allArtworks.slice(0,100).map(n=>({"@type":"ImageObject",contentUrl:n.imageUrl||n.images?.[0]||"",name:n.title||"未命名作品",description:this._getAltText(n),thumbnail:n.imageUrl||n.images?.[0]||""})),s={"@context":"https://schema.org","@type":"ImageGallery",name:"梦境画廊",description:`共${this.allArtworks.length}件梦幻艺术作品`,image:t},i=this.lightboxList.slice(0,50).map((n,r)=>({"@type":"ListItem",position:r+1,item:{"@type":"ImageObject",name:n.title||"未命名作品",description:this._getAltText(n),contentUrl:n.imageUrl||n.images?.[0]||"",url:`${e}/#artwork-${n.id}`}})),a={"@context":"https://schema.org","@type":"ItemList",name:this.currentCategory==="all"?"全部作品":this.CATEGORY_LABELS[this.currentCategory]||"作品列表",description:`共${this.lightboxList.length}件${this.currentCategory==="all"?"":this.CATEGORY_LABELS[this.currentCategory]}作品`,itemListElement:i};this._setJsonLd("gallery-json-ld",s),this._setJsonLd("gallery-itemlist-json-ld",a)},_setJsonLd(e,t){let s=document.getElementById(e);s||(s=document.createElement("script"),s.id=e,s.type="application/ld+json",document.head.appendChild(s)),s.textContent=JSON.stringify(t)},_sortArtworks(e,t){const s=[...e];switch(t){case"popular":s.sort((i,a)=>(a.likes||0)-(i.likes||0));break;case"recommended":s.sort((i,a)=>{const n=(i.likes||0)*.5+(i.views||0)*.003+Math.random()*20;return(a.likes||0)*.5+(a.views||0)*.003+Math.random()*20-n});break;case"latest":default:s.sort((i,a)=>{const n=new Date(i.createdAt||0).getTime(),r=new Date(a.createdAt||0).getTime();return r!==n?r-n:(a.id||0)-(i.id||0)});break}return s},_updateTagFilterDisplay(){const e=document.getElementById("tag-filter-bar");if(e)if(this.currentTag){e.style.display="flex";const t=e.querySelector("#current-tag-name");t&&(t.textContent=this.currentTag)}else e.style.display="none"},async filterByTag(e){this.currentTag=e,this.currentCategory="all";const t=document.getElementById("filter-bar");if(t){t.querySelectorAll(".filter-chip").forEach(a=>a.classList.remove("active"));const i=t.querySelector('[data-category="all"]');i&&i.classList.add("active")}const s=document.getElementById("gallery");s&&s.scrollIntoView({behavior:"smooth"}),this.allArtworks.length===0&&(this.allArtworks=await getAllArtworks()),this._applySortAndFilter()},clearTagFilter(){this.currentTag=null,this._applySortAndFilter()},_renderBatch(){const e=document.getElementById("gallery-grid");if(!e)return;const t=this.renderedCount,s=t===0?this.initialRenderCount:this.pageSize,i=Math.min(t+s,this.lightboxList.length);if(t>=i){this._hideLoader(),this.lightboxList.length===0&&(e.innerHTML=`<div class="gallery-empty">
          <i class="fa-regular fa-image"></i>
          <p>${this.currentTag?`没有找到「${this.currentTag}」标签的作品`:"暂无作品"}</p>
        </div>`);return}this._ensureImgObserver(),this._ensureCardObserver();for(let a=t;a<i;a++){const n=this.renderArtworkCard(this.lightboxList[a],a);n.classList.remove("card-enter","animated"),e.appendChild(n),this.cardObserver.observe(n)}this.renderedCount=i,e.querySelectorAll("img[data-src]:not([src])").forEach(a=>{this.imgObserver.observe(a)}),this._setupSentinel(),i<this.lightboxList.length&&document.body.scrollHeight<=window.innerHeight+200&&this._renderBatch()},_ensureCardObserver(){if(this.cardObserver)return;const e=this;this.cardObserver=new IntersectionObserver(t=>{t.forEach(s=>{if(s.isIntersecting){const i=s.target;if(!i.classList.contains("animated")){i.classList.add("animated"),i.classList.add("card-enter");const a=parseInt(i.dataset.index)||0;i.style.animationDelay=`${a%8*.06}s`}e.cardObserver.unobserve(i)}})},{rootMargin:"100px 0px",threshold:.1})},renderArtworkCard(e,t){const s=document.createElement("article");s.className="artwork-card",s.dataset.id=e.id,s.dataset.index=t,s.setAttribute("role","article"),s.setAttribute("aria-label",this._esc(e.title));const i=this.CATEGORY_LABELS[e.category]||e.category,a=e.type==="video",r=(e.images||[e.imageUrl]).length>1,l=this._getThumbUrl(e.imageUrl),c=this._getSrcset(e.imageUrl),u=this._getAltText(e),o=this._getCategoryFallback(e.category);s.dataset.likes=e.likes||0,s.innerHTML=`
      <div class="card-media">
        <div class="skeleton img-skeleton" aria-hidden="true"></div>
        ${a?`<video class="card-video" muted loop playsinline data-src="${this._esc(e.imageUrl)}" preload="none" poster="${this._esc(l)}" title="${this._esc(u)}"></video>`:`<img
              class="card-img"
              alt="${this._esc(u)}"
              data-src="${this._esc(e.imageUrl)}"
              data-srcset="${this._esc(c)}"
              data-thumb="${this._esc(l)}"
              data-fallback="${this._esc(o)}"
              data-category="${this._esc(e.category)}"
              sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 33vw"
              loading="lazy"
              decoding="async"
            />`}
        ${r?'<div class="card-multi-icon" aria-hidden="true"><i class="fa-regular fa-clone"></i></div>':""}
        <div class="card-overlay">
          <div class="card-cat">${i}</div>
          <button class="card-view" aria-label="查看 ${this._esc(e.title)} 的详情">
            <i class="fa-regular fa-eye" aria-hidden="true"></i>
          </button>
        </div>
      </div>
      <div class="card-info">
        <h3 class="card-title">${this._esc(e.title)}</h3>
        <div class="card-meta">
          <span class="card-author"><i class="fa-regular fa-user"></i> ${this._esc(e.author)}</span>
        </div>
        ${e.tags&&e.tags.length>0?`
          <div class="card-tags">
            ${e.tags.slice(0,2).map(m=>`<span class="card-tag">${this._esc(m)}</span>`).join("")}
          </div>
        `:""}
        <div class="card-stats">
          <span class="card-likes"><i class="fa-solid fa-heart"></i> ${this._fmtNum(e.likes)}</span>
          <span class="card-art-no">#${e.id}</span>
        </div>
      </div>
    `,s.addEventListener("click",()=>{typeof Sound<"u"&&Sound.playSound("pop"),this.openLightbox(e.id)});const h=s.querySelector(".card-author");return h&&h.addEventListener("click",m=>{m.stopPropagation(),typeof Sound<"u"&&Sound.playSound("click"),window.Artist&&(e.userId?Artist.openByUserId(e.userId):Artist.openByAuthorName(e.author))}),s.querySelectorAll(".card-tag").forEach(m=>{m.addEventListener("click",p=>{p.stopPropagation(),typeof Sound<"u"&&Sound.playSound("click"),this.filterByTag(m.textContent)})}),s},_getThumbUrl(e){return e?e.includes("picsum.photos/seed/")?e.replace(/\/\d+\/\d+$/,"/400/300"):e.includes("picsum.photos")?e.replace(/\d+\/\d+$/,"400/300"):e:""},_getSrcset(e,t={}){if(!e)return"";const s=this.IMAGE_CONFIG.sizes,i=t.webp!==!1&&this._detectWebP();if(e.includes("picsum.photos/seed/")){const a=e.replace(/\/\d+\/\d+$/,"");return s.map(n=>{const r=i?".webp":"";return`${a}/${n.w}/${n.h}${r} ${n.descriptor}`}).join(", ")}return e.includes("picsum.photos")?s.map(a=>e.replace(/\d+\/\d+$/,`${a.w}/${a.h}`)+` ${a.descriptor}`).join(", "):`${e} 1x`},_getThumbUrl(e){if(!e)return"";if(e.includes("picsum.photos/seed/")){const t=e.replace(/\/\d+\/\d+$/,""),s=this._detectWebP()?".webp":"";return`${t}/40/30${s}?blur=2`}return e.includes("picsum.photos")?e.replace(/\d+\/\d+$/,"40/30?blur=2"):e},_getHighResUrl(e){if(!e)return"";if(e.includes("picsum.photos/seed/")){const t=e.replace(/\/\d+\/\d+$/,""),s=this._detectWebP()?".webp":"";return`${t}/1200/900${s}`}return e.includes("picsum.photos")?e.replace(/\d+\/\d+$/,"1200/900"):e},_getAltText(e){const t=e.title||"未命名作品",s=e.category||"艺术",i=e.tags||[],a=["水彩","油画","数字艺术","3D渲染","抽象","赛博朋克","梦幻","霓虹","唯美","极简","复古","未来主义","超现实","插画"],n=i.find(u=>a.some(o=>u.includes(o)))||"",l={digital:"数字艺术",illustration:"插画",photography:"摄影",abstract:"抽象艺术","3d":"3D艺术",painting:"绘画",mixed:"混合媒介"}[s]||s,c=n?`${n}风格`:`${l}`;return`${t} - ${c}作品${i.length>0?"，标签："+i.slice(0,3).join("、"):""}`},_ensureImgObserver(){if(this.imgObserver)return;const e=this;this.imgObserver=new IntersectionObserver(t=>{t.forEach(s=>{if(s.isIntersecting){const i=s.target,a=i.dataset.src,n=i.dataset.srcset,r=i.dataset.thumb,l=i.dataset.fallback,c=i.parentElement?.querySelector(".img-skeleton");a&&(i.tagName==="IMG"?(i.style.opacity="0",i.style.filter="blur(12px)",i.style.transform="scale(1.03)",i.style.transition="opacity 0.5s ease, filter 0.5s ease, transform 0.5s ease",requestAnimationFrame(()=>{if(r){const h=new Image;h.onload=()=>{i.src=r,i.style.opacity="0.6"},h.onerror=()=>{},h.src=r}const o=new Image;o.onload=()=>{c&&(c.style.opacity="0"),n&&(i.srcset=n),i.src=a,i.classList.add("loaded"),i.style.opacity="1",i.style.filter="blur(0px)",i.style.transform="scale(1)",i.removeAttribute("data-src"),i.removeAttribute("data-srcset"),i.removeAttribute("data-thumb"),i.removeAttribute("data-fallback")},o.onerror=()=>{i.classList.add("error"),c&&(c.style.opacity="0"),i.src=l||e._getPlaceholderSvg(),i.style.opacity="1",i.style.filter="none",i.style.transform="none",i.removeAttribute("data-src"),i.removeAttribute("data-srcset"),i.removeAttribute("data-thumb"),i.removeAttribute("data-fallback")},o.src=a})):i.tagName==="VIDEO"&&(i.src=a,i.addEventListener("loadeddata",()=>{i.classList.add("loaded"),c&&(c.style.opacity="0")},{once:!0}),i.addEventListener("error",()=>{i.classList.add("error"),c&&(c.style.opacity="0")},{once:!0}),i.removeAttribute("data-src"))),e.imgObserver.unobserve(i)}})},{rootMargin:"400px 0px",threshold:.01})},_getPlaceholderSvg(){return"data:image/svg+xml;base64,"+btoa(unescape(encodeURIComponent(`<svg xmlns="http://www.w3.org/2000/svg" width="400" height="300" viewBox="0 0 400 300">
      <rect fill="rgba(201,182,255,0.1)" width="400" height="300"/>
      <text x="50%" y="50%" dominant-baseline="middle" text-anchor="middle" fill="rgba(255,255,255,0.3)" font-family="sans-serif" font-size="14">图片加载失败</text>
    </svg>`)))},_setupSentinel(){let e=document.getElementById("gallery-sentinel");if(!e){e=document.createElement("div"),e.id="gallery-sentinel",e.className="gallery-sentinel";const t=document.getElementById("gallery-grid");t.parentNode.insertBefore(e,t.nextSibling)}this._showLoader(),this.sentinelObserver&&this.sentinelObserver.disconnect(),this.sentinelObserver=new IntersectionObserver(t=>{t[0].isIntersecting&&this.renderedCount<this.lightboxList.length?this._renderBatch():this.renderedCount>=this.lightboxList.length&&this._hideLoader()},{rootMargin:"400px 0px"}),this.sentinelObserver.observe(e)},_showLoader(){let e=document.getElementById("gallery-loader");e||(e=document.createElement("div"),e.id="gallery-loader",e.className="gallery-loader",e.innerHTML='<div class="loader-orb"></div><span>梦境加载中…</span>');const t=document.getElementById("gallery-sentinel");t&&t.parentNode&&!document.getElementById("gallery-loader")&&t.parentNode.appendChild(e)},_hideLoader(){const e=document.getElementById("gallery-loader");e&&(e.style.display="none")},async openLightbox(e){if(this.lightboxList.findIndex(s=>s.id===Number(e))===-1){const s=await getAllArtworks();this.lightboxList=s}this.lightboxIndex=this.lightboxList.findIndex(s=>s.id===Number(e)),this.lightboxImageIndex=0,await this._renderLightbox()},async _renderLightbox(){const e=this.lightboxList[this.lightboxIndex];if(!e)return;if(window.location.hash!==`#artwork-${e.id}`&&history.replaceState(null,"",`#artwork-${e.id}`),!e._viewCounted)try{await updateArtwork(e.id,{views:(e.views||0)+1}),e.views=(e.views||0)+1,e._viewCounted=!0}catch{}const t=this.CATEGORY_LABELS[e.category]||e.category,s=e.type==="video",i=window.currentUser,a=e.images&&e.images.length>0?e.images:[e.imageUrl];this.lightboxImageIndex=Math.min(this.lightboxImageIndex,a.length-1);const n=a[this.lightboxImageIndex],[r,l,c,u]=await Promise.all([getLikes(e.id).catch(()=>e.likes||0),i?hasUserLiked(e.id,i.id).catch(()=>!1):!1,i?hasUserFavorited(e.id,i.id).catch(()=>!1):!1,getComments(e.id).catch(()=>[])]);let o=document.getElementById("lightbox-modal");o||(o=document.createElement("div"),o.className="modal-overlay lightbox-modal",o.id="lightbox-modal",document.body.appendChild(o));const h=s?"":this._getHighResUrl(n),d=s?"":this._getCategoryFallback(e.category);if(o.innerHTML=`
      <button class="lb-nav lb-prev" aria-label="上一件"><i class="fa-solid fa-chevron-left"></i></button>
      <button class="lb-nav lb-next" aria-label="下一件"><i class="fa-solid fa-chevron-right"></i></button>
      <div class="lightbox-box glass" id="lightbox-box">
        <button class="modal-close" data-lb-close aria-label="关闭"><i class="fa-solid fa-xmark"></i></button>
        <div class="lb-content">
          <div class="lb-media" id="lb-media-container">
            ${s?`<video src="${this._esc(e.imageUrl)}" controls autoplay loop playsinline></video>`:`<img class="lb-main-image" id="lb-main-img" src="${this._esc(n)}" alt="${this._esc(e.title)}" data-highres="${this._esc(h)}" data-fallback="${this._esc(d)}" />
                 <div class="lb-spinner" id="lb-spinner" aria-hidden="true"><div class="lb-spinner-ring"></div></div>`}
            ${!s&&a.length>1?`
              <button class="lb-img-prev" aria-label="上一张"><i class="fa-solid fa-chevron-left"></i></button>
              <button class="lb-img-next" aria-label="下一张"><i class="fa-solid fa-chevron-right"></i></button>
              <div class="lb-image-dots">
                ${a.map((m,p)=>`<span class="lb-dot ${p===this.lightboxImageIndex?"active":""}" data-idx="${p}"></span>`).join("")}
              </div>
            `:""}
            <div class="lb-art-no">作品号 #${e.id} ${a.length>1?` · ${this.lightboxImageIndex+1}/${a.length}`:""}</div>
          </div>
          <div class="lb-side">
            <div class="lb-cat">${t}</div>
            <h2 class="lb-title">${this._esc(e.title)}</h2>
            <div class="lb-author" data-author="${this._esc(e.author)}" data-userid="${e.userId||""}">
              <span class="avatar-circle sm">${this._esc(e.author.charAt(0))}</span>
              <div>
                <div class="lb-author-name">${this._esc(e.author)}</div>
                <div class="lb-date">${this._esc(e.createdAt||"")}</div>
              </div>
              <i class="fa-solid fa-chevron-right lb-author-arrow"></i>
            </div>
            <p class="lb-desc">${this._esc(e.description)}</p>
            ${e.tags&&e.tags.length>0?`
              <div class="lb-tags">
                ${e.tags.map(m=>`<span class="lb-tag" data-tag="${this._esc(m)}">${this._esc(m)}</span>`).join("")}
              </div>
            `:""}
            <div class="lb-actions">
              <button class="lb-action ${l?"active":""}" id="lb-like-btn" data-id="${e.id}">
                <i class="fa-${l?"solid":"regular"} fa-heart"></i>
                <span class="lb-like-count">${this._fmtNum(r)}</span>
                <span class="lb-action-label">点赞</span>
              </button>
              <button class="lb-action ${c?"active":""}" id="lb-fav-btn" data-id="${e.id}">
                <i class="fa-${c?"solid":"regular"} fa-bookmark"></i>
                <span class="lb-action-label">${c?"已收藏":"收藏"}</span>
              </button>
              <button class="lb-action" id="lb-share-btn" data-id="${e.id}">
                <i class="fa-solid fa-share-nodes"></i>
                <span class="lb-action-label">分享</span>
              </button>
              <div class="lb-views"><i class="fa-regular fa-eye"></i> ${this._fmtNum(e.views||0)}</div>
            </div>
            <div class="lb-comments">
              <h3 class="lb-comments-title"><i class="fa-regular fa-comments"></i> 评论 <span id="lb-comment-count">${u.length}</span></h3>
              <div class="lb-comment-list" id="lb-comment-list"></div>
              <div class="lb-comment-input">
                <textarea id="lb-comment-text" placeholder="${i?"写下你的梦境感言…":"登录后发表评论"}" rows="2" ${i?"":"disabled"}></textarea>
                <button class="btn-primary btn-sm" id="lb-comment-submit" data-id="${e.id}">
                  <i class="fa-solid fa-paper-plane"></i> 发送
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    `,requestAnimationFrame(()=>{o.classList.add("open"),window.FocusTrap&&(window.FocusTrap.saveFocus(),window.FocusTrap.trapFocus(o))}),o.dataset.scrollLocked||(window.ModalScrollLock&&ModalScrollLock.lock(),o.dataset.scrollLocked="1"),!s){const m=document.getElementById("lb-main-img"),p=document.getElementById("lb-spinner");if(m&&h&&h!==n){const g=new Image;g.onload=()=>{m.src=h,m.style.opacity="1",p&&(p.style.display="none")},g.onerror=()=>{p&&(p.style.display="none")},g.src=h}else p&&(p.style.display="none")}this._renderCommentList(u),this._bindLightboxEvents(o,e)},_renderCommentList(e){const t=document.getElementById("lb-comment-list");if(!t)return;if(!e||e.length===0){t.innerHTML='<div class="lb-no-comment">还没有评论，成为第一个发声的人吧</div>';return}t.innerHTML=e.map(i=>`
      <div class="comment-item">
        <span class="avatar-circle sm">${this._esc((i.username||"?").charAt(0))}</span>
        <div class="comment-body">
          <div class="comment-head">
            <span class="comment-user">${this._esc(i.username)}</span>
            <span class="comment-time">${this._fmtTime(i.createdAt)}</span>
          </div>
          <p class="comment-text">${this._esc(i.content)}</p>
        </div>
      </div>
    `).join("");const s=document.getElementById("lb-comment-count");s&&(s.textContent=e.length)},_bindLightboxEvents(e,t){e.addEventListener("click",d=>{(d.target===e||d.target.closest("[data-lb-close]"))&&this.closeLightbox()}),e.querySelector(".lb-prev").addEventListener("click",()=>this._navLightbox(-1)),e.querySelector(".lb-next").addEventListener("click",()=>this._navLightbox(1));const s=e.querySelector(".lb-img-prev"),i=e.querySelector(".lb-img-next");s&&s.addEventListener("click",d=>{d.stopPropagation(),this._navImage(-1)}),i&&i.addEventListener("click",d=>{d.stopPropagation(),this._navImage(1)}),e.querySelectorAll(".lb-dot").forEach(d=>{d.addEventListener("click",m=>{m.stopPropagation();const p=parseInt(d.dataset.idx,10);this._goToImage(p)})});const n=e.querySelector(".lb-author");n&&n.addEventListener("click",()=>{typeof Sound<"u"&&Sound.playSound("click");const d=n.dataset.userid,m=n.dataset.author;window.Artist&&(this.closeLightbox(),d?Artist.openByUserId(Number(d)):Artist.openByAuthorName(m))}),e.querySelectorAll(".lb-tag").forEach(d=>{d.addEventListener("click",()=>{typeof Sound<"u"&&Sound.playSound("click");const m=d.dataset.tag;this.closeLightbox(),this.filterByTag(m)})});const l=e.querySelector("#lb-like-btn");l&&l.addEventListener("click",()=>{typeof handleLike=="function"&&handleLike(t.id,l)});const c=e.querySelector("#lb-fav-btn");c&&c.addEventListener("click",()=>{typeof handleFavorite=="function"&&handleFavorite(t.id,c)});const u=e.querySelector("#lb-share-btn");u&&u.addEventListener("click",d=>{d.stopPropagation(),window.Share&&Share.showShareMenu(t,u)});const o=e.querySelector("#lb-comment-submit"),h=e.querySelector("#lb-comment-text");o&&o.addEventListener("click",async()=>{const d=h.value.trim();if(d&&typeof handleComment=="function"){await handleComment(t.id,d),h.value="";const m=await getComments(t.id);this._renderCommentList(m)}})},_navLightbox(e){typeof Sound<"u"&&Sound.playSound("click"),this.lightboxIndex=(this.lightboxIndex+e+this.lightboxList.length)%this.lightboxList.length,this.lightboxImageIndex=0,this._renderLightbox()},_navImage(e){const t=this.lightboxList[this.lightboxIndex];if(!t)return;const s=t.images||[t.imageUrl];s.length<=1||(this.lightboxImageIndex=(this.lightboxImageIndex+e+s.length)%s.length,this._updateLightboxImage())},_goToImage(e){const t=this.lightboxList[this.lightboxIndex];if(!t)return;const s=t.images||[t.imageUrl];e<0||e>=s.length||(this.lightboxImageIndex=e,this._updateLightboxImage())},_updateLightboxImage(){const e=this.lightboxList[this.lightboxIndex];if(!e)return;const t=e.images||[e.imageUrl],s=t[this.lightboxImageIndex],i=document.querySelector(".lb-main-image");i&&(i.style.opacity="0",i.style.transform="scale(0.98)",setTimeout(()=>{i.src=s,i.onload=()=>{i.style.opacity="1",i.style.transform="scale(1)"}},150)),document.querySelectorAll(".lb-dot").forEach((r,l)=>{r.classList.toggle("active",l===this.lightboxImageIndex)});const n=document.querySelector(".lb-art-no");n&&(n.textContent=`作品号 #${e.id} · ${this.lightboxImageIndex+1}/${t.length}`),typeof Sound<"u"&&Sound.playSound("click")},closeLightbox(){const e=document.getElementById("lightbox-modal");e&&(window.FocusTrap&&window.FocusTrap.releaseFocus(e),e.classList.remove("open"),e.dataset.scrollLocked&&(window.ModalScrollLock&&ModalScrollLock.unlock(),delete e.dataset.scrollLocked),window.location.hash&&window.location.hash.match(/^#artwork-\d+$/)&&history.replaceState(null,"",window.location.pathname+window.location.search),typeof Sound<"u"&&Sound.playSound("close"),setTimeout(()=>{e&&(e.innerHTML="")},300))},refreshGallery(){return this.loadArtworks(this.currentCategory)},_fmtNum(e){return e=Number(e)||0,e>=1e4?(e/1e4).toFixed(1)+"w":e>=1e3?(e/1e3).toFixed(1)+"k":e},_fmtTime(e){if(!e)return"";const t=new Date(e),s=Date.now()-t.getTime(),i=60*1e3,a=60*i,n=24*a;return s<i?"刚刚":s<a?Math.floor(s/i)+"分钟前":s<n?Math.floor(s/a)+"小时前":s<30*n?Math.floor(s/n)+"天前":t.toLocaleDateString("zh-CN")},_esc(e){return String(e??"").replace(/[&<>"']/g,t=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"})[t])}};document.addEventListener("keydown",e=>{const t=document.getElementById("lightbox-modal");if(!t||!t.classList.contains("open"))return;const s=document.activeElement;s&&(s.tagName==="INPUT"||s.tagName==="TEXTAREA")||(e.key==="ArrowLeft"&&(e.shiftKey?f._navImage(-1):f._navLightbox(-1)),e.key==="ArrowRight"&&(e.shiftKey?f._navImage(1):f._navLightbox(1)),e.key==="Escape"&&f.closeLightbox())});window.Gallery=f;const y={modalEl:null,currentArtist:null,currentArtworks:[],async openByAuthorName(e){const t=await getArtworksByAuthorName(e),s=t.reduce((i,a)=>i+(a.likes||0),0);this.currentArtist={name:e,bio:"梦境艺术家，专注于创造独特的视觉体验。",worksCount:t.length,totalLikes:s,followersCount:Math.floor(Math.random()*5e3)+100,followingCount:Math.floor(Math.random()*200)+10,isVirtual:!0},this.currentArtworks=t,this._build(),this._show()},async openByUserId(e){const t=await getUserById(e);if(!t)return;const s=await getUserArtworks(e),i=await getUserTotalLikes(e);this.currentArtist={id:t.id,name:t.username,email:t.email,bio:t.bio||"这个人很懒，什么都没留下…",worksCount:t.worksCount||s.length,totalLikes:i,followersCount:t.followersCount||0,followingCount:t.followingCount||0,isVirtual:!1,user:t},this.currentArtworks=s,this._build(),this._show()},_build(){this.modalEl&&this.modalEl.remove();const e=this.currentArtist,t=(e.name||"?").charAt(0).toUpperCase(),s=window.currentUser,i=s&&!e.isVirtual&&s.id===e.id,a=document.createElement("div");a.className="modal-overlay artist-modal",a.id="artist-modal",a.innerHTML=`
      <div class="modal-box artist-box glass">
        <button class="modal-close" data-close aria-label="关闭"><i class="fa-solid fa-xmark"></i></button>

        <div class="artist-head">
          <div class="artist-avatar-wrap">
            <span class="avatar-circle xl artist-avatar">${t}</span>
            <div class="artist-avatar-glow"></div>
          </div>
          <div class="artist-info">
            <h2 class="artist-name">${this._esc(e.name)}
              ${e.isVirtual?'<span class="artist-badge">梦境艺术家</span>':""}
            </h2>
            <p class="artist-bio">${this._esc(e.bio)}</p>
            <div class="artist-actions">
              ${i?'<button class="btn-ghost btn-sm" id="artist-edit-btn"><i class="fa-regular fa-pen-to-square"></i> 编辑资料</button>':`<button class="btn-primary btn-sm" id="artist-follow-btn">
                     <i class="fa-solid fa-user-plus"></i>
                     <span id="artist-follow-text">关注</span>
                   </button>`}
            </div>
          </div>
        </div>

        <div class="artist-stats">
          <div class="stat-card"><div class="stat-num" id="artist-stat-works">${this._fmtNum(e.worksCount)}</div><div class="stat-label">作品</div></div>
          <div class="stat-card"><div class="stat-num" id="artist-stat-likes">${this._fmtNum(e.totalLikes)}</div><div class="stat-label">获赞</div></div>
          <div class="stat-card"><div class="stat-num" id="artist-stat-followers">${this._fmtNum(e.followersCount)}</div><div class="stat-label">粉丝</div></div>
          <div class="stat-card"><div class="stat-num" id="artist-stat-following">${this._fmtNum(e.followingCount)}</div><div class="stat-label">关注</div></div>
        </div>

        <div class="artist-tabs">
          <button class="artist-tab active" data-tab="works"><i class="fa-regular fa-images"></i> 作品</button>
        </div>

        <div class="artist-content" id="artist-content">
          <div class="artist-grid"></div>
        </div>
      </div>
    `,document.body.appendChild(a),this.modalEl=a,a.addEventListener("click",n=>{(n.target===a||n.target.closest("[data-close]"))&&this._close()}),this._renderWorks(),i||this._bindFollowButton()},async _bindFollowButton(){const e=this.modalEl.querySelector("#artist-follow-btn");if(!e)return;const t=window.currentUser,s=this.currentArtist;if(s.isVirtual){e.addEventListener("click",()=>{window.showToast&&showToast("登录后可以关注注册艺术家哦","info")});return}let i=!1;if(t)try{i=await isFollowing(t.id,s.id)}catch{}this._updateFollowButton(i),e.addEventListener("click",async()=>{if(!window.currentUser){window.Auth&&Auth.requireLogin();return}try{const a=await toggleFollow(window.currentUser.id,s.id);this._updateFollowButton(a);const n=await getFollowersCount(s.id),r=this.modalEl.querySelector("#artist-stat-followers");if(r&&(r.textContent=this._fmtNum(n)),window.Auth&&window.currentUser){const l=await getFollowingCount(window.currentUser.id);window.currentUser.followingCount=l}typeof Sound<"u"&&Sound.playSound(a?"like":"click"),window.showToast&&showToast(a?"关注成功":"已取消关注",a?"success":"info")}catch(a){console.error("关注操作失败:",a),window.showToast&&showToast("操作失败，请重试","warn")}})},_updateFollowButton(e){const t=this.modalEl.querySelector("#artist-follow-btn"),s=this.modalEl.querySelector("#artist-follow-text"),i=t.querySelector("i");e?(t.classList.remove("btn-primary"),t.classList.add("btn-ghost"),i.className="fa-solid fa-check",s&&(s.textContent="已关注")):(t.classList.add("btn-primary"),t.classList.remove("btn-ghost"),i.className="fa-solid fa-user-plus",s&&(s.textContent="关注"))},_renderWorks(){const e=this.modalEl.querySelector("#artist-content .artist-grid");if(!e)return;const t=this.currentArtworks;if(!t||t.length===0){e.innerHTML=`
        <div class="artist-empty">
          <i class="fa-regular fa-image"></i>
          <p>还没有发布作品</p>
        </div>`;return}e.innerHTML="",t.forEach(s=>{const i=window.Gallery&&Gallery.CATEGORY_LABELS[s.category]||s.category,a=document.createElement("div");a.className="artist-card",a.innerHTML=`
        <div class="artist-card-media">
          <img loading="lazy" src="${this._esc(s.imageUrl)}" alt="${this._esc(s.title)}" />
          <span class="artist-cat">${i}</span>
        </div>
        <div class="artist-card-info">
          <h4>${this._esc(s.title)}</h4>
          <div class="artist-card-stats">
            <span><i class="fa-solid fa-heart"></i> ${this._fmtNum(s.likes)}</span>
            <span class="artist-no">#${s.id}</span>
          </div>
        </div>
      `,a.addEventListener("click",()=>{typeof Sound<"u"&&Sound.playSound("click"),this._close(),window.Gallery&&Gallery.openLightbox(s.id)}),e.appendChild(a)})},_show(){typeof Sound<"u"&&Sound.playSound("pop"),window.ModalScrollLock&&ModalScrollLock.lock(),requestAnimationFrame(()=>this.modalEl.classList.add("open"))},_close(){this.modalEl&&(this.modalEl.classList.remove("open"),window.ModalScrollLock&&ModalScrollLock.unlock(),typeof Sound<"u"&&Sound.playSound("close"),setTimeout(()=>{this.modalEl&&(this.modalEl.remove(),this.modalEl=null)},300))},_fmtNum(e){return e=Number(e)||0,e>=1e4?(e/1e4).toFixed(1)+"w":e>=1e3?(e/1e3).toFixed(1)+"k":e},_esc(e){return String(e??"").replace(/[&<>"']/g,t=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"})[t])}};window.Artist=y;window.openArtistPage=e=>{typeof e=="number"?y.openByUserId(e):y.openByAuthorName(e)};async function L(e,t){if(!window.currentUser){window.Auth&&Auth.requireLogin();return}const s=window.currentUser;try{const i=await toggleLike(e,s.id);if(typeof Sound<"u"&&Sound.playSound("like"),t){t.classList.toggle("active",i);const a=t.querySelector("i");a&&(a.className=i?"fa-solid fa-heart":"fa-regular fa-heart");const n=t.querySelector(".lb-like-count");if(n){const r=await getLikes(e);n.textContent=v(r)}i&&I(t)}$(e,i)}catch(i){console.error("点赞失败:",i)}}async function E(e,t){if(!window.currentUser){window.Auth&&Auth.requireLogin();return}const s=window.currentUser;try{const i=await toggleFavorite(e,s.id);if(typeof Sound<"u"&&Sound.playSound(i?"like":"click"),t){t.classList.toggle("active",i);const a=t.querySelector("i");a&&(a.className=i?"fa-solid fa-bookmark":"fa-regular fa-bookmark");const n=t.querySelector(".lb-action-label");n&&(n.textContent=i?"已收藏":"收藏"),i&&A(t)}window.showToast&&showToast(i?"已加入收藏":"已取消收藏",i?"success":"info")}catch(i){console.error("收藏失败:",i)}}async function x(e,t){if(!window.currentUser)return window.Auth&&Auth.requireLogin(),!1;const s=window.currentUser;if(t=(t||"").trim(),!t)return!1;if(t.length>500)return window.showToast&&showToast("评论不能超过 500 字","warn"),!1;try{return await addComment(e,s.id,s.username,t),typeof Sound<"u"&&Sound.playSound("success"),window.showToast&&showToast("评论已发布","success"),!0}catch(i){return console.error("评论失败:",i),window.showToast&&showToast("评论发布失败","warn"),!1}}function k(e){return getComments(e).then(t=>{const s=document.getElementById("lb-comment-list");if(!s)return t;!t||t.length===0?s.innerHTML='<div class="lb-no-comment">还没有评论，成为第一个发声的人吧</div>':s.innerHTML=t.map(a=>`
        <div class="comment-item">
          <span class="avatar-circle sm">${b((a.username||"?").charAt(0))}</span>
          <div class="comment-body">
            <div class="comment-head">
              <span class="comment-user">${b(a.username)}</span>
              <span class="comment-time">${C(a.createdAt)}</span>
            </div>
            <p class="comment-text">${b(a.content)}</p>
          </div>
        </div>
      `).join("");const i=document.getElementById("lb-comment-count");return i&&(i.textContent=t.length),t})}function I(e){const t=e.getBoundingClientRect(),s=t.left+t.width/2,i=t.top+t.height/2,a=["#ffd1e8","#c9b6ff","#a8d8ff","#b8f0d4","#fff4c2"],n=14;for(let r=0;r<n;r++){const l=document.createElement("div");l.className="like-particle",l.style.left=s+"px",l.style.top=i+"px",l.style.background=a[r%a.length],document.body.appendChild(l);const c=Math.PI*2*r/n+(Math.random()-.5)*.4,u=50+Math.random()*60,o=Math.cos(c)*u,h=Math.sin(c)*u-20,d=600+Math.random()*300;l.animate([{transform:"translate(-50%, -50%) scale(1)",opacity:1},{transform:`translate(calc(-50% + ${o}px), calc(-50% + ${h}px)) scale(0)`,opacity:0}],{duration:d,easing:"cubic-bezier(.2,.7,.3,1)"}),setTimeout(()=>l.remove(),d+50)}e.animate([{transform:"scale(1)"},{transform:"scale(1.25)"},{transform:"scale(1)"}],{duration:360,easing:"ease-out"})}function A(e){e.animate([{transform:"scale(1) rotate(0deg)",filter:"brightness(1)"},{transform:"scale(1.2) rotate(-10deg)",filter:"brightness(1.6)"},{transform:"scale(1) rotate(0deg)",filter:"brightness(1)"}],{duration:420,easing:"ease-out"})}function $(e,t){const s=document.querySelector(`.artwork-card[data-id="${e}"]`);if(!s)return;const i=s.querySelector(".card-likes");if(i){let a=parseInt(s.dataset.likes||"0",10);isNaN(a)&&(a=0),a=t?a+1:Math.max(0,a-1),s.dataset.likes=a,i.innerHTML=`<i class="fa-solid fa-heart"></i> ${v(a)}`}}function v(e){return e=Number(e)||0,e>=1e4?(e/1e4).toFixed(1)+"w":e>=1e3?(e/1e3).toFixed(1)+"k":e}function C(e){if(!e)return"";const t=new Date(e),s=Date.now()-t.getTime(),i=60*1e3,a=60*i,n=24*a;return s<i?"刚刚":s<a?Math.floor(s/i)+"分钟前":s<n?Math.floor(s/a)+"小时前":s<30*n?Math.floor(s/n)+"天前":t.toLocaleDateString("zh-CN")}function b(e){return String(e??"").replace(/[&<>"']/g,t=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"})[t])}window.handleLike=L;window.handleFavorite=E;window.handleComment=x;window.renderComments=k;const w={modalEl:null,currentFile:null,MAX_IMG:5*1024*1024,MAX_VIDEO:20*1024*1024,aiLoading:!1,aiResult:null,aiSelectedIndex:-1,showPublishModal(){if(!window.currentUser){window.Auth&&Auth.requireLogin();return}this._buildModal(),typeof Sound<"u"&&Sound.playSound("pop"),window.ModalScrollLock&&ModalScrollLock.lock(),requestAnimationFrame(()=>this.modalEl.classList.add("open"))},_buildModal(){this.modalEl&&this.modalEl.remove();const e=document.createElement("div");e.className="modal-overlay publish-modal",e.id="publish-modal",e.innerHTML=`
      <div class="modal-box publish-box glass">
        <button class="modal-close" data-close aria-label="关闭"><i class="fa-solid fa-xmark"></i></button>
        <h2 class="pub-title">发布作品</h2>
        <p class="pub-sub">把你的梦境分享给世界</p>

        <div class="pub-dropzone" id="pub-dropzone">
          <input type="file" id="pub-file" accept="image/jpeg,image/png,image/webp,video/mp4,video/webm" hidden />
          <div class="pub-dropzone-inner" id="pub-dropzone-inner">
            <div class="pub-upload-icon"><i class="fa-solid fa-cloud-arrow-up"></i></div>
            <p class="pub-drop-text">拖拽文件到此处，或<span class="pub-link">点击上传</span></p>
            <p class="pub-drop-hint">支持 JPG / PNG / WEBP（&lt;5MB）、MP4 / WebM（&lt;20MB）</p>
          </div>
          <div class="pub-preview" id="pub-preview" style="display:none;"></div>
        </div>

        <form id="pub-form" class="pub-form">
          <div class="field">
            <div class="pub-field-label" style="display:flex; align-items:center; justify-content:space-between; margin-bottom:8px;">
              <label style="margin-bottom:0;">作品标题 <span class="req">*</span></label>
              <button type="button" class="ai-suggest-btn" id="ai-suggest-btn" aria-label="AI推荐标题">
                <i class="fa-solid fa-wand-magic-sparkles"></i> AI推荐标题✨
              </button>
            </div>
            <input type="text" id="pub-title-input" placeholder="给你的作品起个名字…" maxlength="60" required />
            <div class="ai-suggest-panel" id="ai-suggest-panel" style="display:none;"></div>
          </div>
          <div class="field">
            <label>介绍文案 <span class="req">*</span></label>
            <textarea id="pub-desc-input" placeholder="描述作品的灵感与故事…" rows="3" maxlength="300" required></textarea>
          </div>
          <div class="field">
            <label>分类</label>
            <div class="pub-categories" id="pub-categories">
              <button type="button" class="pub-cat active" data-cat="digital-art">数字艺术</button>
              <button type="button" class="pub-cat" data-cat="photography">摄影</button>
              <button type="button" class="pub-cat" data-cat="illustration">插画</button>
              <button type="button" class="pub-cat" data-cat="abstract">抽象</button>
              <button type="button" class="pub-cat" data-cat="3d-art">3D艺术</button>
            </div>
          </div>
          <div class="pub-error" id="pub-error"></div>
          <button type="submit" class="btn-primary btn-block" id="pub-submit">
            <i class="fa-solid fa-paper-plane"></i> 发布作品
          </button>
        </form>
      </div>
    `,document.body.appendChild(e),this.modalEl=e,this._bindUpload(),this._bindCategories(),this._bindSubmit(),this._bindAISuggest(),e.addEventListener("click",t=>{(t.target===e||t.target.closest("[data-close]"))&&this._close()})},_bindUpload(){const e=this.modalEl.querySelector("#pub-dropzone"),t=this.modalEl.querySelector("#pub-file");this.modalEl.querySelector("#pub-dropzone-inner").addEventListener("click",()=>t.click()),t.addEventListener("change",i=>{i.target.files[0]&&this._handleFile(i.target.files[0])}),["dragenter","dragover"].forEach(i=>{e.addEventListener(i,a=>{a.preventDefault(),e.classList.add("dragging")})}),["dragleave","drop"].forEach(i=>{e.addEventListener(i,a=>{a.preventDefault(),e.classList.remove("dragging")})}),e.addEventListener("drop",i=>{i.preventDefault();const a=i.dataTransfer.files[0];a&&this._handleFile(a)})},_handleFile(e){const t=this.modalEl.querySelector("#pub-error");t.textContent="";const s=/^image\/(jpeg|png|webp)$/.test(e.type),i=/^video\/(mp4|webm)$/.test(e.type);if(!s&&!i){t.textContent="不支持的文件格式，请上传图片或视频",typeof Sound<"u"&&Sound.playSound("close");return}if(s&&e.size>this.MAX_IMG){t.textContent="图片不能超过 5MB",typeof Sound<"u"&&Sound.playSound("close");return}if(i&&e.size>this.MAX_VIDEO){t.textContent="视频不能超过 20MB",typeof Sound<"u"&&Sound.playSound("close");return}const a=new FileReader;a.onload=n=>{this.currentFile={file:e,dataUrl:n.target.result,type:i?"video":"image"},this._renderPreview(),typeof Sound<"u"&&Sound.playSound("click")},a.onerror=()=>{t.textContent="文件读取失败，请重试"},a.readAsDataURL(e)},_renderPreview(){const e=this.modalEl.querySelector("#pub-preview"),t=this.modalEl.querySelector("#pub-dropzone-inner");if(!this.currentFile){e.style.display="none",t.style.display="";return}t.style.display="none",e.style.display="";const s=this.currentFile;e.innerHTML=`
      <div class="pub-preview-media">
        ${s.type==="video"?`<video src="${s.dataUrl}" controls muted></video>`:`<img src="${s.dataUrl}" alt="预览" />`}
      </div>
      <div class="pub-preview-info">
        <div class="pub-preview-name"><i class="fa-solid fa-file"></i> ${this._esc(s.file.name)}</div>
        <div class="pub-preview-size">${this._fmtSize(s.file.size)} · ${s.type==="video"?"视频":"图片"}</div>
        <button type="button" class="pub-remove" id="pub-remove"><i class="fa-solid fa-trash"></i> 移除</button>
      </div>
    `,this.modalEl.querySelector("#pub-remove").addEventListener("click",()=>{this.currentFile=null,this._renderPreview(),this.modalEl.querySelector("#pub-file").value=""})},_bindCategories(){const e=this.modalEl.querySelector("#pub-categories");e.querySelectorAll(".pub-cat").forEach(t=>{t.addEventListener("click",()=>{typeof Sound<"u"&&Sound.playSound("click"),e.querySelectorAll(".pub-cat").forEach(s=>s.classList.remove("active")),t.classList.add("active")})})},_bindSubmit(){this.modalEl.querySelector("#pub-form").addEventListener("submit",async t=>{t.preventDefault();const s=this.modalEl.querySelector("#pub-error");s.textContent="";const i=this.modalEl.querySelector("#pub-title-input").value.trim(),a=this.modalEl.querySelector("#pub-desc-input").value.trim(),n=this.modalEl.querySelector(".pub-cat.active").dataset.cat;if(!this.currentFile){s.textContent="请先上传作品文件";return}if(!i){s.textContent="请填写作品标题";return}if(!a){s.textContent="请填写介绍文案";return}const r=this.modalEl.querySelector("#pub-submit");r.disabled=!0,r.innerHTML='<i class="fa-solid fa-spinner fa-spin"></i> 发布中…';try{await this.handlePublish(this.currentFile,i,a,n)}catch(l){s.textContent=l.message||"发布失败，请重试",r.disabled=!1,r.innerHTML='<i class="fa-solid fa-paper-plane"></i> 发布作品'}})},async handlePublish(e,t,s,i){const a=window.currentUser;window.Sentry&&Sentry.addBreadcrumb({category:"publish",message:"Artwork publish attempt",data:{title:t,category:i,fileType:e.type,fileName:e.file.name}}),await addArtwork({title:t,description:s,author:a.username,category:i,imageUrl:e.dataUrl,type:e.type,userId:a.id}),this._successAnimation(),setTimeout(()=>this._close(),900),window.Gallery&&setTimeout(()=>Gallery.refreshGallery(),1e3),typeof Sound<"u"&&Sound.playSound("success")},_successAnimation(){const e=document.createElement("div");e.className="pub-success-overlay",e.innerHTML=`
      <div class="pub-success-card glass">
        <div class="pub-success-check"><i class="fa-solid fa-check"></i></div>
        <p>作品已发布到梦境</p>
      </div>
    `,document.body.appendChild(e),requestAnimationFrame(()=>e.classList.add("show")),setTimeout(()=>{e.classList.remove("show"),setTimeout(()=>e.remove(),400)},1200)},_close(){this.modalEl&&(this.modalEl.classList.remove("open"),window.ModalScrollLock&&ModalScrollLock.unlock(),typeof Sound<"u"&&Sound.playSound("close"),setTimeout(()=>{this.modalEl&&(this.modalEl.remove(),this.modalEl=null,this.currentFile=null,this.aiLoading=!1,this.aiResult=null,this.aiSelectedIndex=-1)},300))},_bindAISuggest(){const e=this.modalEl.querySelector("#ai-suggest-btn");e&&e.addEventListener("click",()=>{typeof Sound<"u"&&Sound.playSound("click"),this._generateAITitles()})},_getImageDescription(){const e=this.modalEl.querySelector("#pub-desc-input").value.trim();return e||(this.currentFile&&this.currentFile.file?this.currentFile.file.name.replace(/\.[^.]+$/,""):"")},_getCurrentCategory(){const e=this.modalEl.querySelector(".pub-cat.active");return e?e.dataset.cat:"digital-art"},async _generateAITitles(){const e=this.modalEl.querySelector("#ai-suggest-btn"),t=this.modalEl.querySelector("#ai-suggest-panel");if(!window.AI||typeof AI.generateTitleSuggestions!="function"){this._showAIPanelError("AI助手暂不可用，请稍后再试");return}if(!this.currentFile){this._showAIPanelError("请先上传作品图片后再使用AI推荐");return}this.aiLoading=!0,this.aiSelectedIndex=-1,e&&(e.disabled=!0,e.innerHTML='<i class="fa-solid fa-spinner fa-spin" style="animation: fa-spin 1s linear infinite;"></i> AI生成中…'),t.style.display="",t.innerHTML='<div class="ai-suggest-title"><i class="fa-solid fa-spinner fa-spin"></i> 小梦正在为你构思创意…</div>';try{const s=this._getImageDescription(),i=this._getCurrentCategory(),a=await AI.generateTitleSuggestions(s,i);this._renderAISuggestPanel(a)}catch(s){this._showAIPanelError(s&&s.message?s.message:"AI推荐生成失败，请重试")}finally{this.aiLoading=!1,e&&(e.disabled=!1,e.innerHTML='<i class="fa-solid fa-wand-magic-sparkles"></i> AI推荐标题✨')}},_renderAISuggestPanel(e){const t=this.modalEl.querySelector("#ai-suggest-panel");if(!e||!e.titles||!e.titles.length){this._showAIPanelError("AI未能生成推荐，请重试");return}this.aiResult=e,this.aiSelectedIndex=-1;const s=e.titles.map((i,a)=>`
      <div class="ai-suggest-item" data-idx="${a}">
        <span class="ai-suggest-text">${this._esc(i)}</span>
        <button type="button" class="ai-apply-btn">应用</button>
      </div>
    `).join("");t.style.display="",t.innerHTML=`
      <div class="ai-suggest-title">✨ 小梦为你推荐以下标题（点击选择，可一键应用）</div>
      ${s}
      <div class="ai-suggest-desc">${this._esc(e.description||"")}</div>
      <div class="ai-suggest-actions" style="display:flex; gap:8px; margin-top:10px;">
        <button type="button" class="ai-suggest-btn" id="ai-regen-btn">
          <i class="fa-solid fa-rotate"></i> 重新生成
        </button>
        <button type="button" class="ai-suggest-btn" id="ai-apply-all-btn" style="border-color:var(--dream-mint); color:var(--dream-mint);" disabled>
          <i class="fa-solid fa-check"></i> 一键应用
        </button>
      </div>
    `,this._bindAISuggestItems()},_bindAISuggestItems(){const e=this.modalEl.querySelector("#ai-suggest-panel");if(!e)return;const t=e.querySelectorAll(".ai-suggest-item"),s=e.querySelector("#ai-apply-all-btn"),i=e.querySelector("#ai-regen-btn");t.forEach(a=>{a.addEventListener("click",n=>{if(n.target.closest(".ai-apply-btn")){n.stopPropagation();const r=parseInt(a.dataset.idx,10);this._applyAIResult(r);return}typeof Sound<"u"&&Sound.playSound("click"),t.forEach(r=>{r.style.borderColor="",r.style.background=""}),a.style.borderColor="rgba(201,182,255,0.6)",a.style.background="rgba(201,182,255,0.12)",this.aiSelectedIndex=parseInt(a.dataset.idx,10),s&&(s.disabled=!1)})}),i&&i.addEventListener("click",()=>{typeof Sound<"u"&&Sound.playSound("click"),this._generateAITitles()}),s&&s.addEventListener("click",()=>{this.aiSelectedIndex<0||(typeof Sound<"u"&&Sound.playSound("click"),this._applyAIResult(this.aiSelectedIndex))})},_applyAIResult(e){if(!this.aiResult||!this.aiResult.titles[e])return;const t=this.aiResult.titles[e],s=this.aiResult.description||"";this.modalEl.querySelector("#pub-title-input").value=t,this.modalEl.querySelector("#pub-desc-input").value=s,typeof Sound<"u"&&Sound.playSound("success");const i=this.modalEl.querySelector("#ai-suggest-panel");i.style.display="none",i.innerHTML="",this.aiSelectedIndex=-1},_showAIPanelError(e){const t=this.modalEl.querySelector("#ai-suggest-panel");t&&(t.style.display="",t.innerHTML=`<div class="ai-suggest-desc" style="color:var(--dream-pink);">${this._esc(e)}</div>`)},_fmtSize(e){return e<1024?e+" B":e<1024*1024?(e/1024).toFixed(1)+" KB":(e/1024/1024).toFixed(1)+" MB"},_esc(e){return String(e??"").replace(/[&<>"']/g,t=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"})[t])}};window.Publish=w;window.showPublishModal=()=>w.showPublishModal();const _={debounceTimer:null,isOpen:!1,allArtworks:[],currentResults:[],currentKeyword:"",currentSort:"relevance",currentCategory:"all",HOT_KEYWORDS:["梦幻","抽象","霓虹","星河","赛博朋克","水彩","未来","自然"],HISTORY_KEY:"dreamcore_search_history",MAX_HISTORY:10,init(){const e=document.getElementById("nav-search-input");e&&(e.addEventListener("input",t=>{this.handleSearch(t.target.value)}),e.addEventListener("focus",async()=>{this.allArtworks.length===0&&(this.allArtworks=await getAllArtworks())}))},async showSearchBar(){typeof Sound<"u"&&Sound.playSound("pop"),this.allArtworks.length===0&&(this.allArtworks=await getAllArtworks());const e=document.getElementById("search-modal");if(e){this.isOpen||(e.classList.add("open"),this.isOpen=!0,window.ModalScrollLock&&ModalScrollLock.lock(),this._renderHistoryList(),this._setupFocusTrap(e)),setTimeout(()=>{const t=e.querySelector("#search-input");t&&t.focus()},200);return}this._buildModal()},_triggerElement:null,_buildModal(){const e=document.createElement("div");e.className="modal-overlay search-modal",e.id="search-modal",e.innerHTML=`
      <div class="search-panel glass">
        <button class="modal-close" data-close aria-label="关闭"><i class="fa-solid fa-xmark"></i></button>
        <div class="search-header">
          <i class="fa-solid fa-magnifying-glass"></i>
          <input type="text" id="search-input" placeholder="搜索作品名 / 作品号 / 艺术家…" autocomplete="off" />
        </div>
        <div class="search-suggest" id="search-suggest-section">
          <div class="search-dropdown-section">
            <div class="search-dropdown-title"><span><i class="fa-solid fa-fire"></i> 热门搜索</span></div>
            <div class="search-hot-list" id="search-hot-list"></div>
          </div>
          <div class="search-dropdown-section" id="search-history-section">
            <div class="search-dropdown-title">
              <span><i class="fa-regular fa-clock"></i> 搜索历史</span>
              <button class="search-history-clear" id="search-history-clear">清除全部</button>
            </div>
            <div class="search-history-list" id="search-history-list"></div>
          </div>
        </div>
        <div class="search-results" id="search-results">
          <div class="search-empty-hint">输入关键词，开始探索梦境艺术</div>
        </div>
      </div>
    `,document.body.appendChild(e),window.ModalScrollLock&&ModalScrollLock.lock(),requestAnimationFrame(()=>e.classList.add("open")),this.isOpen=!0;const t=e.querySelector("#search-input");t.addEventListener("input",s=>this.handleSearch(s.target.value)),t.addEventListener("focus",()=>this._showSuggest()),e.addEventListener("click",s=>{(s.target===e||s.target.closest("[data-close]"))&&this._close()}),e.addEventListener("click",s=>{!s.target.closest(".search-header")&&!s.target.closest(".search-suggest")&&this._hideSuggest()}),document.getElementById("search-history-clear")?.addEventListener("click",s=>{s.stopPropagation(),this.clearHistory()}),this._renderHotList(),this._renderHistoryList(),setTimeout(()=>{t.focus(),this._setupFocusTrap(e)},200)},_setupFocusTrap(e){const t=Array.from(e.querySelectorAll('button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])')),s=t[0],i=t[t.length-1],a=n=>{n.key==="Tab"?n.shiftKey&&document.activeElement===s?(n.preventDefault(),i.focus()):!n.shiftKey&&document.activeElement===i&&(n.preventDefault(),s.focus()):n.key==="Escape"&&(n.preventDefault(),this._close())};e._focusTrapHandler=a,e.addEventListener("keydown",a)},_removeFocusTrap(){const e=document.getElementById("search-modal");e&&e._focusTrapHandler&&(e.removeEventListener("keydown",e._focusTrapHandler),e._focusTrapHandler=null)},_showSuggest(){const e=document.getElementById("search-suggest-section");e&&(e.style.display="block")},_hideSuggest(){const e=document.getElementById("search-suggest-section");e&&(e.style.display="none")},_renderHotList(){const e=document.getElementById("search-hot-list");e&&(e.innerHTML=this.HOT_KEYWORDS.map((t,s)=>`
      <span class="search-hot-tag ${s===0?"hot-1":""}" data-kw="${this._esc(t)}">${this._esc(t)}</span>
    `).join(""),e.querySelectorAll(".search-hot-tag").forEach(t=>{t.addEventListener("click",()=>{const s=t.dataset.kw;this._doSearch(s)})}))},_getHistory(){try{const e=localStorage.getItem(this.HISTORY_KEY);return e?JSON.parse(e):[]}catch{return[]}},_saveHistory(e){if(!e||!e.trim())return;let t=this._getHistory();t=t.filter(s=>s!==e),t.unshift(e),t=t.slice(0,this.MAX_HISTORY);try{localStorage.setItem(this.HISTORY_KEY,JSON.stringify(t))}catch{}},_removeHistory(e){let t=this._getHistory();t=t.filter(s=>s!==e);try{localStorage.setItem(this.HISTORY_KEY,JSON.stringify(t))}catch{}this._renderHistoryList()},clearHistory(){try{localStorage.removeItem(this.HISTORY_KEY)}catch{}this._renderHistoryList(),window.showToast&&showToast("搜索历史已清除","success")},_renderHistoryList(){const e=document.getElementById("search-history-list"),t=document.getElementById("search-history-section");if(!e||!t)return;const s=this._getHistory();if(s.length===0){t.style.display="none";return}t.style.display="block",e.innerHTML=s.map(i=>`
      <div class="search-history-item" data-kw="${this._esc(i)}">
        <i class="fa-regular fa-clock" style="font-size:10px;opacity:0.6;"></i>
        <span>${this._esc(i)}</span>
        <span class="history-remove" title="删除"><i class="fa-solid fa-xmark"></i></span>
      </div>
    `).join(""),e.querySelectorAll(".search-history-item").forEach(i=>{i.addEventListener("click",a=>{if(a.target.closest(".history-remove")){a.stopPropagation(),this._removeHistory(i.dataset.kw);return}this._doSearch(i.dataset.kw)})})},handleSearch(e){clearTimeout(this.debounceTimer);const t=(e||"").trim();if(!t){this._renderEmptyState(),this._showSuggest();return}this.debounceTimer=setTimeout(()=>{this._doSearch(t)},300)},_doSearch(e){const t=document.getElementById("search-input");t&&(t.value=e),this.currentKeyword=e,this.currentSort="relevance",this.currentCategory="all",this._hideSuggest(),this._saveHistory(e);const s=this._search(e);this.currentResults=s,this.renderSearchResults(s,e),typeof Sound<"u"&&Sound.playSound("click")},_search(e){const t=e.toLowerCase(),i=e.trim().match(/^#?(\d+)$/),a=!!i,n=a?parseInt(i[1],10):null;return this.allArtworks.filter(r=>!!(a&&r.id===n||r.title&&r.title.toLowerCase().includes(t)||r.author&&r.author.toLowerCase().includes(t)||r.tags&&r.tags.some(l=>l.toLowerCase().includes(t))||r.description&&r.description.toLowerCase().includes(t)))},_sortResults(e,t,s){const i=[...e];switch(t){case"popular":i.sort((n,r)=>(r.likes||0)-(n.likes||0));break;case"latest":i.sort((n,r)=>{const l=new Date(n.createdAt||0).getTime(),c=new Date(r.createdAt||0).getTime();return c!==l?c-l:(r.id||0)-(n.id||0)});break;case"relevance":default:const a=s.toLowerCase();i.sort((n,r)=>{const l=this._calcRelevance(n,a);return this._calcRelevance(r,a)-l});break}return i},_calcRelevance(e,t){let s=0;const i=(e.title||"").toLowerCase(),a=(e.author||"").toLowerCase(),n=(e.description||"").toLowerCase(),r=e.tags||[];return i===t?s+=100:i.startsWith(t)?s+=60:i.includes(t)&&(s+=40),a===t?s+=50:a.includes(t)&&(s+=25),r.some(l=>l.toLowerCase()===t)?s+=45:r.some(l=>l.toLowerCase().includes(t))&&(s+=20),n.includes(t)&&(s+=10),s+=(e.likes||0)*.01,s},renderSearchResults(e,t){const s=document.getElementById("search-results");if(!s)return;const i=this.currentCategory==="all"?e:e.filter(o=>o.category===this.currentCategory),a=this._sortResults(i,this.currentSort,t);if(!a||a.length===0){s.innerHTML=`
        <div class="empty-state">
          <i class="fa-regular fa-face-frown empty-state-icon"></i>
          <p class="empty-state-text">未找到与「${this._esc(t)}」相关的作品</p>
          <p class="empty-state-hint">试试其他关键词，如作品名、艺术家或作品号</p>
        </div>
      `;return}const n=window.Gallery?Gallery.CATEGORY_LABELS:{},r={relevance:"相关度",latest:"最新",popular:"热门"},l=["all",...new Set(e.map(o=>o.category))];s.innerHTML=`
      <div class="search-result-count">找到 <strong>${a.length}</strong> 件相关作品</div>
      <div class="search-result-toolbar">
        <div class="search-filter-chips">
          ${l.map(o=>`
            <button class="search-filter-chip ${this.currentCategory===o?"active":""}" data-cat="${o}">
              ${o==="all"?"全部":n[o]||o}
            </button>
          `).join("")}
        </div>
        <select class="search-sort-select" id="search-sort-select">
          ${Object.entries(r).map(([o,h])=>`
            <option value="${o}" ${this.currentSort===o?"selected":""}>${h}</option>
          `).join("")}
        </select>
      </div>
      <div class="search-grid" id="search-grid"></div>
    `;const c=s.querySelector("#search-grid");a.slice(0,60).forEach(o=>{const h=document.createElement("div");h.className="search-card";const d=o.type==="video",m=window.Gallery&&Gallery.CATEGORY_LABELS[o.category]||o.category;h.innerHTML=`
        <div class="search-card-media">
          ${d?`<video muted src="${this._esc(o.imageUrl)}"></video>`:`<img loading="lazy" src="${this._esc(o.imageUrl)}" alt="${this._esc(o.title)}" />`}
          <span class="search-cat">${m}</span>
        </div>
        <div class="search-card-info">
          <h4>${this._highlight(o.title,t)}</h4>
          <div class="search-card-author">
            <i class="fa-regular fa-user"></i> ${this._highlight(o.author,t)}
            <span class="search-no">#${o.id}</span>
          </div>
        </div>
      `,h.addEventListener("click",()=>{this._close(),window.Gallery&&Gallery.openLightbox(o.id)}),c.appendChild(h)}),s.querySelectorAll(".search-filter-chip").forEach(o=>{o.addEventListener("click",()=>{this.currentCategory=o.dataset.cat,this.renderSearchResults(e,t)})});const u=document.getElementById("search-sort-select");u&&u.addEventListener("change",()=>{this.currentSort=u.value,this.renderSearchResults(e,t)})},_renderEmptyState(){const e=document.getElementById("search-results");e&&(e.innerHTML='<div class="search-empty-hint">输入关键词，开始探索梦境艺术</div>')},_close(){const e=document.getElementById("search-modal");e&&e.classList.remove("open"),this.isOpen=!1,this._removeFocusTrap(),window.ModalScrollLock&&ModalScrollLock.unlock(),typeof Sound<"u"&&Sound.playSound("close"),this._triggerElement&&document.body.contains(this._triggerElement)&&this._triggerElement.focus();const t=document.getElementById("search-input");t&&(t.value=""),this.currentKeyword="",this.currentResults=[],this.currentSort="relevance",this.currentCategory="all",this._showSuggest(),this._renderHistoryList()},_highlight(e,t){const s=this._esc(e||""),i=this._esc(t||"").trim();if(!i)return s;const a=i.replace(/[.*+?^${}()|[\]\\]/g,"\\$&");return s.replace(new RegExp(a,"gi"),n=>`<mark class="hl">${n}</mark>`)},_esc(e){return String(e??"").replace(/[&<>"']/g,t=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"})[t])}};window.Search=_;window.showSearchBar=()=>_.showSearchBar();const T={currentMenu:null,qrcodeModal:null,QRCode:null,getShareUrl(e){return`${window.location.origin+window.location.pathname}#artwork-${e.id}?utm_source=dreamcore&utm_medium=share`},getShareText(e){return`${e.title} - ${e.author} | Dreamcore 梦境数字艺术`},showShareMenu(e,t){this._closeExistingMenu();const s=document.createElement("div");s.className="share-menu glass",s.id="share-menu";const i=this.getShareUrl(e),a=this.getShareText(e),n=!!navigator.share;s.innerHTML=`
      <div class="share-menu-item highlight" data-action="copy">
        <i class="fa-solid fa-link"></i>
        <span>复制链接</span>
      </div>
      <div class="share-menu-divider"></div>
      <div class="share-menu-item" data-action="wechat">
        <i class="fa-brands fa-weixin"></i>
        <span>微信</span>
      </div>
      <div class="share-menu-item" data-action="weibo">
        <i class="fa-brands fa-weibo"></i>
        <span>微博</span>
      </div>
      <div class="share-menu-item" data-action="twitter">
        <i class="fa-brands fa-x-twitter"></i>
        <span>Twitter/X</span>
      </div>
      <div class="share-menu-item" data-action="facebook">
        <i class="fa-brands fa-facebook"></i>
        <span>Facebook</span>
      </div>
      ${n?`
      <div class="share-menu-item" data-action="more">
        <i class="fa-solid fa-ellipsis"></i>
        <span>更多…</span>
      </div>`:""}
    `,document.body.appendChild(s);const r=t.getBoundingClientRect(),l=s.getBoundingClientRect();let c=r.left+r.width/2-l.width/2,u=r.bottom+10;c<16&&(c=16),c+l.width>window.innerWidth-16&&(c=window.innerWidth-l.width-16),u+l.height>window.innerHeight-16&&(u=r.top-l.height-10),s.style.position="fixed",s.style.left=c+"px",s.style.top=u+"px",s.classList.add("open"),this.currentMenu=s,s.querySelectorAll(".share-menu-item").forEach(o=>{o.addEventListener("click",async h=>{h.stopPropagation();const d=o.dataset.action;await this._handleShare(d,e,i,a),d!=="wechat"&&this._closeExistingMenu()})}),setTimeout(()=>{this._outsideClickListener=o=>{!o.target.closest(".share-menu")&&!o.target.closest("#lb-share-btn")&&this._closeExistingMenu()},document.addEventListener("click",this._outsideClickListener)},0)},async _handleShare(e,t,s,i){switch(e){case"copy":await this._copyToClipboard(s),window.showToast&&showToast("链接已复制！","success");break;case"wechat":await this._showWechatQRCode(s,t);break;case"weibo":window.open(`https://service.weibo.com/share/share.php?url=${encodeURIComponent(s)}&title=${encodeURIComponent(i)}`,"_blank","width=600,height=500");break;case"twitter":window.open(`https://twitter.com/intent/tweet?url=${encodeURIComponent(s)}&text=${encodeURIComponent(i)}`,"_blank","width=600,height=400");break;case"facebook":window.open(`https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(s)}`,"_blank","width=600,height=400");break;case"more":if(navigator.share)try{await navigator.share({title:t.title,text:i,url:s})}catch(a){a.name!=="AbortError"&&console.error("分享失败:",a)}break}typeof Sound<"u"&&Sound.playSound("click")},async _showWechatQRCode(e,t){if(this._closeExistingMenu(),!this.QRCode)try{this.QRCode=await S(()=>import("./browser-BXdiCFWD.js").then(i=>i.b),[])}catch(i){console.error("加载二维码库失败:",i),window.showToast&&showToast("二维码功能暂不可用，请复制链接分享","warn");return}const s=document.createElement("div");s.className="modal-overlay wechat-qrcode-modal",s.innerHTML=`
      <div class="modal-box glass">
        <button class="modal-close" data-close aria-label="关闭"><i class="fa-solid fa-xmark"></i></button>
        <div class="qrcode-header">
          <h3>微信扫码分享</h3>
          <p>扫码后点击右上角分享给好友</p>
        </div>
        <div class="qrcode-container">
          <canvas id="qrcode-canvas"></canvas>
        </div>
        <div class="qrcode-artwork-info">
          <div class="qrcode-artwork-title">${this._esc(t.title)}</div>
          <div class="qrcode-artwork-author">by ${this._esc(t.author)}</div>
        </div>
      </div>
    `,document.body.appendChild(s),this.qrcodeModal=s,setTimeout(async()=>{s.classList.add("open");const i=s.querySelector("#qrcode-canvas");try{await this.QRCode.toCanvas(i,e,{width:180,margin:2,color:{dark:"#1a1a2e",light:"#ffffff"}})}catch(a){console.error("生成二维码失败:",a),i.parentNode.innerHTML='<p class="qrcode-error">无法生成二维码，请复制链接分享</p>'}},50),s.addEventListener("click",i=>{(i.target===s||i.target.closest("[data-close]"))&&this._closeQRCodeModal()})},_closeQRCodeModal(){if(!this.qrcodeModal)return;this.qrcodeModal.classList.remove("open");const e=this.qrcodeModal;setTimeout(()=>e.remove(),300),this.qrcodeModal=null},async _copyToClipboard(e){if(navigator.clipboard&&navigator.clipboard.writeText)try{return await navigator.clipboard.writeText(e),!0}catch{return this._fallbackCopy(e)}return this._fallbackCopy(e)},_fallbackCopy(e){const t=document.createElement("textarea");t.value=e,t.style.position="fixed",t.style.left="-9999px",t.style.top="-9999px",document.body.appendChild(t),t.select();try{return document.execCommand("copy"),document.body.removeChild(t),!0}catch{return document.body.removeChild(t),!1}},_closeExistingMenu(){if(this.currentMenu){this.currentMenu.classList.remove("open");const e=this.currentMenu;setTimeout(()=>e.remove(),250),this.currentMenu=null}this._outsideClickListener&&(document.removeEventListener("click",this._outsideClickListener),this._outsideClickListener=null)},_esc(e){return String(e||"").replace(/[&<>"']/g,t=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"})[t])}};window.Share=T;export{y as A,f as G,w as P,_ as S,T as a};
