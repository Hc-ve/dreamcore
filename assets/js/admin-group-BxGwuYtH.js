const l={modalEl:null,currentTab:"artworks",artworksCache:[],usersCache:[],showAdminPanel(){const t=window.currentUser;if(!t){window.Auth&&Auth.requireLogin();return}if(!t.isAdmin){window.showToast&&showToast("仅管理员可访问后台","warn");return}this.currentTab="artworks",this._build(),typeof Sound<"u"&&Sound.playSound("pop"),window.ModalScrollLock&&ModalScrollLock.lock(),requestAnimationFrame(()=>this.modalEl.classList.add("open")),this._loadContent()},_build(){this.modalEl&&this.modalEl.remove();const t=document.createElement("div");t.className="modal-overlay admin-modal",t.id="admin-modal",t.innerHTML=`
      <div class="modal-box admin-box glass">
        <button class="modal-close" data-close aria-label="关闭"><i class="fa-solid fa-xmark"></i></button>
        <div class="admin-head">
          <h2><i class="fa-solid fa-shield-halved"></i> 管理后台</h2>
          <p class="admin-sub">梦境守护者控制台</p>
        </div>
        <div class="admin-tabs">
          <button class="admin-tab active" data-tab="artworks"><i class="fa-regular fa-images"></i> 作品管理</button>
          <button class="admin-tab" data-tab="users"><i class="fa-regular fa-users"></i> 用户管理</button>
        </div>
        <div class="admin-content" id="admin-content"></div>
      </div>
    `,document.body.appendChild(t),this.modalEl=t,t.addEventListener("click",e=>{(e.target===t||e.target.closest("[data-close]"))&&this._close()}),t.querySelectorAll(".admin-tab").forEach(e=>{e.addEventListener("click",()=>{typeof Sound<"u"&&Sound.playSound("click"),t.querySelectorAll(".admin-tab").forEach(a=>a.classList.remove("active")),e.classList.add("active"),this.currentTab=e.dataset.tab,this._loadContent()})})},async _loadContent(){const t=this.modalEl.querySelector("#admin-content");this.currentTab==="artworks"?(this.artworksCache=await getAllArtworks(),this._renderArtworks(t)):(this.usersCache=await getAllUsers(),this._renderUsers(t))},_renderArtworks(t){const e=this.artworksCache.length;t.innerHTML=`
      <div class="admin-toolbar">
        <div class="admin-count">共 <strong>${e}</strong> 件作品</div>
        <div class="admin-search-mini">
          <input type="text" id="admin-art-filter" placeholder="筛选作品名/作者…" />
        </div>
      </div>
      <div class="admin-table-wrap">
        <table class="admin-table">
          <thead>
            <tr><th>#</th><th>缩略</th><th>标题</th><th>作者</th><th>分类</th><th>点赞</th><th>操作</th></tr>
          </thead>
          <tbody id="admin-art-tbody"></tbody>
        </table>
      </div>
    `,this._fillArtRows(this.artworksCache);const a=t.querySelector("#admin-art-filter");a&&a.addEventListener("input",s=>{const o=s.target.value.trim().toLowerCase(),i=this.artworksCache.filter(d=>(d.title||"").toLowerCase().includes(o)||(d.author||"").toLowerCase().includes(o));this._fillArtRows(i)})},_fillArtRows(t){const e=this.modalEl.querySelector("#admin-art-tbody");if(e){if(!t.length){e.innerHTML='<tr><td colspan="7" class="admin-empty">无匹配作品</td></tr>';return}e.innerHTML=t.slice(0,200).map(a=>`
      <tr data-id="${a.id}">
        <td class="col-id">${a.id}</td>
        <td class="col-thumb"><img loading="lazy" src="${this._esc(a.imageUrl)}" alt="" /></td>
        <td class="col-title">${this._esc(a.title)}</td>
        <td>${this._esc(a.author)}</td>
        <td><span class="admin-cat-select" data-id="${a.id}">${this._catLabel(a.category)}</span></td>
        <td>${this._fmtNum(a.likes)}</td>
        <td class="col-actions">
          <button class="admin-btn edit" data-edit="${a.id}" title="编辑分类"><i class="fa-solid fa-pen"></i></button>
          <button class="admin-btn del" data-del="${a.id}" title="删除"><i class="fa-solid fa-trash"></i></button>
        </td>
      </tr>
    `).join(""),e.querySelectorAll("[data-edit]").forEach(a=>{a.addEventListener("click",()=>this._editCategory(Number(a.dataset.edit)))}),e.querySelectorAll("[data-del]").forEach(a=>{a.addEventListener("click",()=>this._deleteArtwork(Number(a.dataset.del)))})}},_editCategory(t){const e=this.artworksCache.find(i=>i.id===t);if(!e)return;const a=["digital-art","photography","illustration","abstract","3d-art"],s=document.createElement("div");s.className="modal-overlay confirm-modal",s.innerHTML=`
      <div class="modal-box confirm-box glass">
        <h3>编辑分类</h3>
        <p>为「${this._esc(e.title)}」选择新分类</p>
        <div class="admin-cat-picker">
          ${a.map(i=>`<button class="pub-cat ${i===e.category?"active":""}" data-cat="${i}">${this._catLabel(i)}</button>`).join("")}
        </div>
        <div class="confirm-actions">
          <button class="btn-ghost" data-cancel>取消</button>
          <button class="btn-primary" data-ok>确定</button>
        </div>
      </div>
    `,document.body.appendChild(s),requestAnimationFrame(()=>s.classList.add("open"));let o=e.category;s.querySelectorAll("[data-cat]").forEach(i=>{i.addEventListener("click",()=>{s.querySelectorAll("[data-cat]").forEach(d=>d.classList.remove("active")),i.classList.add("active"),o=i.dataset.cat})}),s.addEventListener("click",async i=>{(i.target===s||i.target.closest("[data-cancel]"))&&(s.classList.remove("open"),setTimeout(()=>s.remove(),300)),i.target.closest("[data-ok]")&&(await updateArtwork(t,{category:o}),window.showToast&&showToast("分类已更新","success"),typeof Sound<"u"&&Sound.playSound("success"),s.classList.remove("open"),setTimeout(()=>s.remove(),300),this._loadContent())})},_deleteArtwork(t){const e=this.artworksCache.find(s=>s.id===t);if(!e)return;const a=document.createElement("div");a.className="modal-overlay confirm-modal",a.innerHTML=`
      <div class="modal-box confirm-box glass">
        <h3><i class="fa-solid fa-triangle-exclamation"></i> 删除作品</h3>
        <p>确定删除「${this._esc(e.title)}」吗？此操作不可撤销。</p>
        <div class="confirm-actions">
          <button class="btn-ghost" data-cancel>取消</button>
          <button class="btn-primary danger" data-ok>确认删除</button>
        </div>
      </div>
    `,document.body.appendChild(a),requestAnimationFrame(()=>a.classList.add("open")),a.addEventListener("click",async s=>{(s.target===a||s.target.closest("[data-cancel]"))&&(a.classList.remove("open"),setTimeout(()=>a.remove(),300)),s.target.closest("[data-ok]")&&(await deleteArtwork(t),window.showToast&&showToast("作品已删除","success"),typeof Sound<"u"&&Sound.playSound("close"),a.classList.remove("open"),setTimeout(()=>a.remove(),300),this._loadContent(),window.Gallery&&Gallery.refreshGallery())})},_renderUsers(t){const e=this.usersCache.length;t.innerHTML=`
      <div class="admin-toolbar">
        <div class="admin-count">共 <strong>${e}</strong> 位用户</div>
      </div>
      <div class="admin-table-wrap">
        <table class="admin-table">
          <thead>
            <tr><th>ID</th><th>头像</th><th>用户名</th><th>邮箱</th><th>角色</th><th>注册时间</th></tr>
          </thead>
          <tbody>
            ${this.usersCache.map(a=>{const s=(a.username||"?").charAt(0).toUpperCase(),o=a.createdAt?new Date(a.createdAt).toLocaleDateString("zh-CN"):"—";return`
                <tr>
                  <td class="col-id">${a.id}</td>
                  <td><span class="avatar-circle sm">${s}</span></td>
                  <td>${this._esc(a.username)}</td>
                  <td class="col-email">${this._esc(a.email||"—")}</td>
                  <td>${a.isAdmin?'<span class="role-admin">管理员</span>':'<span class="role-user">用户</span>'}</td>
                  <td>${o}</td>
                </tr>`}).join("")}
          </tbody>
        </table>
      </div>
    `},_close(){this.modalEl&&(this.modalEl.classList.remove("open"),window.ModalScrollLock&&ModalScrollLock.unlock(),typeof Sound<"u"&&Sound.playSound("close"),setTimeout(()=>{this.modalEl&&(this.modalEl.remove(),this.modalEl=null)},300))},_catLabel(t){return{"digital-art":"数字艺术",photography:"摄影",illustration:"插画",abstract:"抽象","3d-art":"3D艺术"}[t]||t},_fmtNum(t){return t=Number(t)||0,t>=1e4?(t/1e4).toFixed(1)+"w":t>=1e3?(t/1e3).toFixed(1)+"k":t},_esc(t){return String(t??"").replace(/[&<>"']/g,e=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"})[e])}};window.Admin=l;window.showAdminPanel=()=>l.showAdminPanel();const n=window.showAdminPanel;export{l as A,n as s};
