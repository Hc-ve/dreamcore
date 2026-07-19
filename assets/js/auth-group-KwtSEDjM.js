let r=null;const g={modalEl:null,async checkAuthState(){const t=localStorage.getItem("currentUser");if(!t)return null;try{r=JSON.parse(t)}catch{r=null}return window.currentUser=r,r},getCurrentUser(){return r},updateNavForUser(){const t=document.getElementById("nav-user-area");if(t)if(r){const e=(r.username||"?").charAt(0).toUpperCase(),i=r.isAdmin;t.innerHTML=`
        <div class="notification-wrap" id="notification-wrap">
          <button class="notification-bell" id="notification-bell" aria-label="通知">
            <i class="fa-regular fa-bell"></i>
            <span class="notification-badge" id="notification-badge" style="display:none;">0</span>
          </button>
          <div class="notification-dropdown" id="notification-dropdown">
            <div class="notif-header">
              <span class="notif-title">消息通知</span>
              <button class="notif-mark-all" id="notif-mark-all">全部已读</button>
            </div>
            <div class="notif-list" id="notif-list">
              <div class="notif-empty">
                <i class="fa-regular fa-bell"></i>
                <p>暂无新通知，快去探索作品吧~</p>
              </div>
            </div>
          </div>
        </div>
        <div class="user-menu" id="user-menu">
          <button class="user-avatar-btn" id="user-avatar-btn" aria-label="用户菜单">
            <span class="avatar-circle">${e}</span>
          </button>
          <div class="user-dropdown" id="user-dropdown">
            <div class="dropdown-header">
              <span class="avatar-circle lg">${e}</span>
              <div>
                <div class="dd-name">${this._esc(r.username)}</div>
                <div class="dd-email">${this._esc(r.email||"梦境居民")}</div>
              </div>
            </div>
            <button class="dropdown-item" data-action="profile">
              <i class="fa-regular fa-user"></i> 个人中心
            </button>
            ${i?`<button class="dropdown-item" data-action="admin">
              <i class="fa-solid fa-shield-halved"></i> 管理后台
            </button>`:""}
            <button class="dropdown-item danger" data-action="logout">
              <i class="fa-solid fa-arrow-right-from-bracket"></i> 退出登录
            </button>
          </div>
        </div>
      `;const a=document.getElementById("user-avatar-btn"),o=document.getElementById("user-dropdown");let n=null;a.addEventListener("click",d=>{d.stopPropagation();const s=o.classList.toggle("open");typeof Sound<"u"&&Sound.playSound("click"),s?(n=l=>{!o.contains(l.target)&&l.target!==a&&(o.classList.remove("open"),document.removeEventListener("click",n),n=null)},setTimeout(()=>document.addEventListener("click",n),0)):n&&(document.removeEventListener("click",n),n=null)}),t.querySelectorAll(".dropdown-item").forEach(d=>{d.addEventListener("click",()=>{o.classList.remove("open"),n&&(document.removeEventListener("click",n),n=null);const s=d.dataset.action;s==="profile"&&typeof showProfile=="function"&&showProfile(),s==="admin"&&typeof showAdminPanel=="function"&&showAdminPanel(),s==="logout"&&this.handleLogout()})})}else t.innerHTML=`
        <button class="btn-ghost" id="btn-login">
          <i class="fa-regular fa-circle-user"></i>
          <span>登录</span>
        </button>
      `,document.getElementById("btn-login").addEventListener("click",()=>{typeof Sound<"u"&&Sound.playSound("pop"),this.showAuthModal("login")})},showAuthModal(t="login"){const e=!!this.modalEl;this._buildModal(t),e||(typeof Sound<"u"&&Sound.playSound("pop"),window.ModalScrollLock&&ModalScrollLock.lock()),requestAnimationFrame(()=>this.modalEl.classList.add("open"))},_buildModal(t){this.modalEl&&this.modalEl.remove();const e=t==="login",i=document.createElement("div");i.className="modal-overlay auth-modal",i.id="auth-modal",i.innerHTML=`
      <div class="modal-box auth-box glass">
        <button class="modal-close" data-close aria-label="关闭">
          <i class="fa-solid fa-xmark"></i>
        </button>
        <div class="auth-visual">
          <div class="auth-orb"></div>
          <div class="auth-orb orb2"></div>
        </div>
        <div class="auth-body">
          <h2 class="auth-title">${e?"欢迎回到梦境":"开启你的梦境之旅"}</h2>
          <p class="auth-sub">${e?"登录以继续探索与创作":"注册账号，发布属于你的艺术作品"}</p>
          <form id="auth-form" class="auth-form" novalidate>
            <div class="field">
              <i class="fa-regular fa-user"></i>
              <input type="text" id="auth-username" placeholder="用户名" autocomplete="username" required />
            </div>
            ${e?"":`
            <div class="field">
              <i class="fa-regular fa-envelope"></i>
              <input type="email" id="auth-email" placeholder="邮箱（选填）" autocomplete="email" />
            </div>`}
            <div class="field">
              <i class="fa-solid fa-lock"></i>
              <input type="password" id="auth-password" placeholder="密码" autocomplete="${e?"current-password":"new-password"}" required />
            </div>
            <div class="auth-error" id="auth-error"></div>
            <button type="submit" class="btn-primary btn-block" id="auth-submit">
              ${e?"登录":"注册"}
            </button>
          </form>
          <div class="auth-switch">
            ${e?"还没有账号？":"已有账号？"}
            <a href="#" data-switch="${e?"register":"login"}">
              ${e?"立即注册":"去登录"}
            </a>
          </div>
          ${e?'<div class="auth-hint">体验账号：admin / admin123</div>':""}
        </div>
      </div>
    `,document.body.appendChild(i),this.modalEl=i,i.addEventListener("click",o=>{(o.target===i||o.target.closest("[data-close]"))&&this._closeModal()}),i.querySelectorAll("[data-switch]").forEach(o=>{o.addEventListener("click",n=>{n.preventDefault(),this.showAuthModal(o.dataset.switch)})}),i.querySelector("#auth-form").addEventListener("submit",async o=>{o.preventDefault();const n=i.querySelector("#auth-username").value.trim(),d=i.querySelector("#auth-password").value,s=i.querySelector("#auth-email"),l=s?s.value.trim():"",c=i.querySelector("#auth-error");c.textContent="";const u=i.querySelector("#auth-submit");u.disabled=!0,u.textContent="处理中...";try{e?await this.handleLogin(n,d):await this.handleRegister(n,l,d),this._closeModal()}catch(f){c.textContent=f.message||"操作失败，请重试",typeof Sound<"u"&&Sound.playSound("close")}finally{u.disabled=!1,u.textContent=e?"登录":"注册"}}),setTimeout(()=>i.querySelector("#auth-username").focus(),200)},_closeModal(){this.modalEl&&(this.modalEl.classList.remove("open"),window.ModalScrollLock&&ModalScrollLock.unlock(),typeof Sound<"u"&&Sound.playSound("close"),setTimeout(()=>{this.modalEl&&(this.modalEl.remove(),this.modalEl=null)},300))},async handleRegister(t,e,i){if(!t||t.length<2)throw new Error("用户名至少 2 个字符");if(!i||i.length<6)throw new Error("密码至少 6 位");window.Sentry&&Sentry.addBreadcrumb({category:"auth",message:"User registration attempt",data:{username:t,email:e}});const a=await registerUser({username:t,email:e,password:i});return r={id:a.id,username:a.username,email:a.email,isAdmin:a.isAdmin,createdAt:a.createdAt},window.currentUser=r,localStorage.setItem("currentUser",JSON.stringify(r)),this.updateNavForUser(),typeof AI<"u"&&AI.onUserLogin(r),this._toast(`欢迎加入，${a.username}！`,"success"),typeof Sound<"u"&&Sound.playSound("success"),a},async handleLogin(t,e){if(!t||!e)throw new Error("请输入用户名和密码");window.Sentry&&Sentry.addBreadcrumb({category:"auth",message:"User login attempt",data:{username:t}});const i=await loginUser(t,e);return r={id:i.id,username:i.username,email:i.email,isAdmin:i.isAdmin,createdAt:i.createdAt},window.currentUser=r,localStorage.setItem("currentUser",JSON.stringify(r)),this.updateNavForUser(),typeof AI<"u"&&AI.onUserLogin(r),this._toast(`欢迎回来，${i.username}！`,"success"),typeof Sound<"u"&&Sound.playSound("success"),i},handleLogout(){r=null,window.currentUser=null,localStorage.removeItem("currentUser"),this.updateNavForUser(),typeof AI<"u"&&AI.onUserLogout(),this._toast("已退出登录","info"),typeof Sound<"u"&&Sound.playSound("close")},requireLogin(){return r?!0:(this.showAuthModal("login"),this._toast("请先登录后再操作","warn"),!1)},showWelcomeIfFirstVisit(){if(localStorage.getItem("hasVisited"))return;localStorage.setItem("hasVisited","1");const t=document.createElement("div");t.className="modal-overlay welcome-modal",t.innerHTML=`
      <div class="modal-box welcome-box glass">
        <div class="welcome-orbs">
          <span></span><span></span><span></span>
        </div>
        <h2 class="welcome-title">梦境已开启</h2>
        <p class="welcome-text">
          欢迎来到 <span class="grad-text">Dreamcore</span> 数字艺术社交平台。<br/>
          在这里浏览 200+ 件梦幻艺术作品，发布你的创作，<br/>
          与艺术家们用点赞、收藏与评论交流。
        </p>
        <div class="welcome-tips">
          <div class="tip"><i class="fa-solid fa-palette"></i> 浏览与发现</div>
          <div class="tip"><i class="fa-solid fa-cloud-arrow-up"></i> 发布作品</div>
          <div class="tip"><i class="fa-solid fa-heart"></i> 互动收藏</div>
        </div>
        <button class="btn-primary btn-block" id="welcome-enter">进入梦境</button>
        <div class="welcome-hint">体验管理员账号：admin / admin123</div>
      </div>
    `,document.body.appendChild(t),window.ModalScrollLock&&ModalScrollLock.lock(),requestAnimationFrame(()=>t.classList.add("open")),typeof Sound<"u"&&Sound.playSound("pop");const e=()=>{t.classList.remove("open"),window.ModalScrollLock&&ModalScrollLock.unlock(),typeof Sound<"u"&&Sound.playSound("close"),setTimeout(()=>t.remove(),350)};t.addEventListener("click",i=>{(i.target===t||i.target.closest("#welcome-enter"))&&e()})},_toast(t,e="info"){if(typeof showToast=="function")return showToast(t,e);const i=document.createElement("div");i.className=`toast toast-${e}`,i.textContent=t,document.body.appendChild(i),requestAnimationFrame(()=>i.classList.add("show")),setTimeout(()=>{i.classList.remove("show"),setTimeout(()=>i.remove(),300)},2500)},_esc(t){return String(t||"").replace(/[&<>"']/g,e=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"})[e])}};window.Auth=g;window.currentUser=r;const y={isOpen:!1,currentUserId:null,_outsideHandler:null,init(){this._updateUserId(),this._bindBellEvents(),this.refreshBadge();const t=window.Auth?Auth.updateNavForUser.bind(Auth):null;t&&(Auth.updateNavForUser=()=>{t(),this._updateUserId(),setTimeout(()=>{this._bindBellEvents(),this.refreshBadge()},0)})},_updateUserId(){this.currentUserId=window.currentUser?window.currentUser.id:null},_bindBellEvents(){const t=document.getElementById("notification-bell"),e=document.getElementById("notif-mark-all"),i=document.getElementById("notification-dropdown");!t||!i||(t.onclick=a=>{a.stopPropagation(),typeof Sound<"u"&&Sound.playSound("click"),this.toggleDropdown()},e&&(e.onclick=async a=>{a.stopPropagation(),typeof Sound<"u"&&Sound.playSound("click"),await this.markAllRead()}))},toggleDropdown(){if(!window.currentUser){window.Auth&&Auth.requireLogin();return}this._updateUserId();const t=document.getElementById("notification-dropdown");t&&(this.isOpen=!this.isOpen,t.classList.toggle("open",this.isOpen),this.isOpen?(this.loadNotifications(),this._bindOutsideClick()):this._unbindOutsideClick())},closeDropdown(){const t=document.getElementById("notification-dropdown");t&&t.classList.remove("open"),this.isOpen=!1,this._unbindOutsideClick()},_bindOutsideClick(){this._unbindOutsideClick(),this._outsideHandler=t=>{t.target.closest(".notification-wrap")||this.closeDropdown()},setTimeout(()=>document.addEventListener("click",this._outsideHandler),0)},_unbindOutsideClick(){this._outsideHandler&&(document.removeEventListener("click",this._outsideHandler),this._outsideHandler=null)},async loadNotifications(){if(!this.currentUserId)return;const t=document.getElementById("notif-list");if(t){t.innerHTML='<div class="notif-loading"><div class="loader-orb-sm"></div><span>加载中…</span></div>';try{const e=await getUserNotifications(this.currentUserId);this._renderList(e)}catch(e){console.error("加载通知失败:",e),t.innerHTML=`
        <div class="empty-state">
          <i class="fa-solid fa-triangle-exclamation empty-state-icon"></i>
          <p class="empty-state-text">加载失败，请重试</p>
          <button class="btn-primary btn-sm" onclick="Notifications.loadNotifications(); event.stopPropagation();">重试</button>
        </div>
      `}}},async _renderList(t){const e=document.getElementById("notif-list");if(!e)return;if(!t||t.length===0){e.innerHTML=`
        <div class="notif-empty">
          <i class="fa-regular fa-bell"></i>
          <p>暂无新通知，快去探索作品吧~</p>
        </div>
      `;return}const i={},a={},o=async s=>{if(!s)return null;if(i[s])return i[s];try{const l=await getUserById(s);return i[s]=l,l}catch{return null}},n=async s=>{if(!s)return null;if(a[s])return a[s];try{const l=await getArtworkById(s);return a[s]=l,l}catch{return null}},d=[];for(const s of t){const l=await o(s.fromUserId),c=await n(s.artworkId);let u="",f="",m="";switch(s.type){case"like":u="fa-solid fa-heart",f="var(--dream-pink)",m=`<strong>${this._esc(l?.username||"匿名用户")}</strong> 赞了你的作品《${this._esc(c?.title||"未知作品")}》`;break;case"comment":u="fa-regular fa-comment",f="var(--dream-blue)",m=`<strong>${this._esc(l?.username||"匿名用户")}</strong> 评论了你的作品《${this._esc(c?.title||"未知作品")}》`;break;case"follow":u="fa-solid fa-user-plus",f="var(--dream-mint)",m=`<strong>${this._esc(l?.username||"匿名用户")}</strong> 关注了你`;break;default:u="fa-regular fa-bell",f="var(--dream-purple)",m=this._esc(s.content||"有新通知")}const p=(l?.username||"?").charAt(0).toUpperCase(),v=this._fmtTime(s.createdAt),w=c?`<div class="notif-thumb"><img src="${this._esc(c.imageUrl)}" alt="" /></div>`:"";d.push(`
        <div class="notif-item ${s.read?"is-read":"is-unread"}" data-id="${s.id}" data-type="${s.type}" data-artwork="${s.artworkId||""}" data-user="${s.fromUserId||""}">
          <div class="notif-avatar">
            <span class="avatar-circle sm">${this._esc(p)}</span>
            <span class="notif-icon" style="color:${f}"><i class="${u}"></i></span>
          </div>
          <div class="notif-content">
            <p class="notif-text">${m}</p>
            <span class="notif-time">${v}</span>
          </div>
          ${w}
          <button class="notif-mark-read" title="标记已读" aria-label="标记已读">
            <i class="fa-solid fa-check"></i>
          </button>
        </div>
      `)}e.innerHTML=d.join(""),e.querySelectorAll(".notif-item").forEach(s=>{s.addEventListener("click",async c=>{if(c.target.closest(".notif-mark-read"))return;const u=s.dataset.id,f=s.dataset.type,m=s.dataset.artwork,p=s.dataset.user;await this.markRead(u),this.closeDropdown(),m&&window.Gallery?Gallery.openLightbox(m):p&&f==="follow"&&window.Artist&&Artist.openByUserId(Number(p))}),s.querySelector(".notif-mark-read").addEventListener("click",async c=>{c.stopPropagation();const u=s.dataset.id;await this.markRead(u)})})},async markRead(t){if(this.currentUserId)try{await markNotificationRead(t),this.refreshBadge();const e=document.querySelector(`.notif-item[data-id="${t}"]`);e&&(e.classList.remove("is-unread"),e.classList.add("is-read"))}catch(e){console.error("标记已读失败:",e)}},async markAllRead(){if(this.currentUserId)try{await markAllNotificationsRead(this.currentUserId),this.refreshBadge(),document.querySelectorAll(".notif-item").forEach(t=>{t.classList.remove("is-unread"),t.classList.add("is-read")}),window.showToast&&showToast("已全部标记为已读","success")}catch(t){console.error("全部已读失败:",t)}},async refreshBadge(){this._updateUserId();const t=document.getElementById("notification-badge");if(t){if(!this.currentUserId){t.style.display="none";return}try{const e=await getUnreadNotificationCount(this.currentUserId);e>0?(t.style.display="flex",t.textContent=e>99?"99+":String(e)):t.style.display="none"}catch{t.style.display="none"}}},_fmtTime(t){if(!t)return"";const e=new Date(t),i=Date.now()-e.getTime(),a=60*1e3,o=60*a,n=24*o;return i<a?"刚刚":i<o?Math.floor(i/a)+"分钟前":i<n?Math.floor(i/o)+"小时前":i<30*n?Math.floor(i/n)+"天前":e.toLocaleDateString("zh-CN")},_esc(t){return String(t??"").replace(/[&<>"']/g,e=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"})[e])}};window.Notifications=y;const h={modalEl:null,currentTab:"works",showProfile(){if(!window.currentUser){window.Auth&&Auth.requireLogin();return}this.currentTab="works",this._build(),typeof Sound<"u"&&Sound.playSound("pop"),window.ModalScrollLock&&ModalScrollLock.lock(),requestAnimationFrame(()=>this.modalEl.classList.add("open")),this._loadContent()},_build(){this.modalEl&&this.modalEl.remove();const t=window.currentUser,e=(t.username||"?").charAt(0).toUpperCase(),i=t.createdAt?new Date(t.createdAt).toLocaleDateString("zh-CN"):"—",a=document.createElement("div");a.className="modal-overlay profile-modal",a.id="profile-modal",a.innerHTML=`
      <div class="modal-box profile-box glass">
        <button class="modal-close" data-close aria-label="关闭"><i class="fa-solid fa-xmark"></i></button>
        <div class="profile-head">
          <div class="profile-avatar-wrap">
            <span class="avatar-circle xl">${e}</span>
            <div class="profile-avatar-glow"></div>
          </div>
          <div class="profile-info">
            <h2 class="profile-name">${this._esc(t.username)}
              ${t.isAdmin?'<span class="profile-badge">管理员</span>':""}
            </h2>
            <p class="profile-email"><i class="fa-regular fa-envelope"></i> ${this._esc(t.email||"未设置邮箱")}</p>
            <p class="profile-reg"><i class="fa-regular fa-calendar"></i> 加入于 ${i}</p>
          </div>
        </div>

        <div class="profile-stats" id="profile-stats">
          <div class="stat-card"><div class="stat-num" id="stat-works">—</div><div class="stat-label">发布作品</div></div>
          <div class="stat-card"><div class="stat-num" id="stat-favs">—</div><div class="stat-label">收藏</div></div>
          <div class="stat-card"><div class="stat-num" id="stat-likes">—</div><div class="stat-label">获赞总数</div></div>
          <div class="stat-card"><div class="stat-num" id="stat-following">—</div><div class="stat-label">关注</div></div>
        </div>

        <div class="profile-tabs">
          <button class="profile-tab active" data-tab="works"><i class="fa-regular fa-images"></i> 我的作品</button>
          <button class="profile-tab" data-tab="favs"><i class="fa-regular fa-bookmark"></i> 我的收藏</button>
          <button class="profile-tab" data-tab="following"><i class="fa-regular fa-user-plus"></i> 我的关注</button>
        </div>

        <div class="profile-content" id="profile-content"></div>
      </div>
    `,document.body.appendChild(a),this.modalEl=a,a.addEventListener("click",o=>{(o.target===a||o.target.closest("[data-close]"))&&this._close()}),a.querySelectorAll(".profile-tab").forEach(o=>{o.addEventListener("click",()=>{typeof Sound<"u"&&Sound.playSound("click"),a.querySelectorAll(".profile-tab").forEach(n=>n.classList.remove("active")),o.classList.add("active"),this.currentTab=o.dataset.tab,this._loadContent()})})},async _loadContent(){const t=window.currentUser,[e,i,a,o]=await Promise.all([getUserArtworks(t.id),getFavorites(t.id),getUserTotalLikes(t.id),getFollowing(t.id)]),n=(d,s)=>{const l=this.modalEl.querySelector("#"+d);l&&(l.textContent=this._fmtNum(s))};n("stat-works",e.length),n("stat-favs",i.length),n("stat-likes",a),n("stat-following",o.length),this.currentTab==="works"?this._renderGrid(e,!0):this.currentTab==="favs"?this._renderGrid(i,!1):this.currentTab==="following"&&this._renderFollowing(o)},_renderGrid(t,e){const i=this.modalEl.querySelector("#profile-content");if(!t||t.length===0){i.innerHTML=`
        <div class="profile-empty">
          <i class="fa-regular fa-${e?"image":"bookmark"}"></i>
          <p>${e?"还没有发布作品":"还没有收藏作品"}</p>
          ${e?'<button class="btn-primary btn-sm" id="profile-go-publish"><i class="fa-solid fa-cloud-arrow-up"></i> 去发布</button>':""}
        </div>`;const o=i.querySelector("#profile-go-publish");o&&o.addEventListener("click",()=>{this._close(),window.Publish&&Publish.showPublishModal()});return}i.innerHTML='<div class="profile-grid"></div>';const a=i.querySelector(".profile-grid");t.forEach(o=>{const n=o.type==="video",d=window.Gallery&&Gallery.CATEGORY_LABELS[o.category]||o.category,s=document.createElement("div");s.className="profile-card",s.innerHTML=`
        <div class="profile-card-media">
          ${n?`<video muted src="${this._esc(o.imageUrl)}"></video>`:`<img loading="lazy" src="${this._esc(o.imageUrl)}" alt="${this._esc(o.title)}" />`}
          <span class="profile-cat">${d}</span>
        </div>
        <div class="profile-card-info">
          <h4>${this._esc(o.title)}</h4>
          <div class="profile-card-stats">
            <span><i class="fa-solid fa-heart"></i> ${this._fmtNum(o.likes)}</span>
            <span class="profile-no">#${o.id}</span>
          </div>
        </div>
      `,s.addEventListener("click",()=>{this._close(),window.Gallery&&Gallery.openLightbox(o.id)}),a.appendChild(s)})},_renderFollowing(t){const e=this.modalEl.querySelector("#profile-content");if(!t||t.length===0){e.innerHTML=`
        <div class="profile-empty">
          <i class="fa-regular fa-user-plus"></i>
          <p>还没有关注任何人</p>
          <p style="font-size:12px;margin-top:8px;opacity:0.6;">去画廊发现有趣的艺术家吧～</p>
        </div>`;return}e.innerHTML='<div class="profile-following-list"></div>';const i=e.querySelector(".profile-following-list");t.forEach(a=>{const o=(a.username||"?").charAt(0).toUpperCase(),n=document.createElement("div");n.className="following-item",n.innerHTML=`
        <span class="avatar-circle">${o}</span>
        <div class="following-item-info">
          <div class="following-item-name">${this._esc(a.username)}</div>
          <div class="following-item-meta">
            <span><i class="fa-regular fa-images"></i> ${this._fmtNum(a.worksCount||0)} 作品</span>
            <span><i class="fa-solid fa-heart"></i> ${this._fmtNum(a.followersCount||0)} 粉丝</span>
          </div>
        </div>
        <button class="following-unfollow-btn" data-userid="${a.id}">
          <i class="fa-solid fa-check"></i> 已关注
        </button>
      `,n.addEventListener("click",s=>{s.target.closest(".following-unfollow-btn")||(typeof Sound<"u"&&Sound.playSound("click"),this._close(),window.Artist&&Artist.openByUserId(a.id))});const d=n.querySelector(".following-unfollow-btn");d&&d.addEventListener("click",async s=>{s.stopPropagation(),typeof Sound<"u"&&Sound.playSound("click");try{await toggleFollow(window.currentUser.id,a.id);const l=await getFollowing(window.currentUser.id);this._renderFollowing(l);const c=this.modalEl.querySelector("#stat-following");c&&(c.textContent=this._fmtNum(l.length)),window.currentUser&&(window.currentUser.followingCount=l.length),window.showToast&&showToast("已取消关注","info")}catch(l){console.error("取消关注失败:",l)}}),i.appendChild(n)})},_close(){this.modalEl&&(this.modalEl.classList.remove("open"),window.ModalScrollLock&&ModalScrollLock.unlock(),typeof Sound<"u"&&Sound.playSound("close"),setTimeout(()=>{this.modalEl&&(this.modalEl.remove(),this.modalEl=null)},300))},_fmtNum(t){return t=Number(t)||0,t>=1e4?(t/1e4).toFixed(1)+"w":t>=1e3?(t/1e3).toFixed(1)+"k":t},_esc(t){return String(t??"").replace(/[&<>"']/g,e=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"})[e])}};window.Profile=h;window.showProfile=()=>h.showProfile();const b=window.showProfile;export{g as A,y as N,h as P,b as s};
