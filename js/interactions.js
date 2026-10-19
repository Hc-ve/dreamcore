// ============================================================
// js/interactions.js — 互动功能
// 点赞(含粒子飞出动画) / 收藏 / 评论
// 未登录用户点击互动按钮 → 调用 Auth.requireLogin()
// ============================================================

// ----------------------------------------------------------
// 点赞 / 取消点赞
// artworkId: 作品 id；btnEl: 触发的按钮元素（用于更新 UI 与动画）
// ----------------------------------------------------------
async function handleLike(artworkId, btnEl) {
  // 检查登录
  if (!window.currentUser) {
    if (window.Auth) Auth.requireLogin();
    return;
  }
  const user = window.currentUser;
  try {
    const liked = await toggleLike(artworkId, user.id);
    if (typeof Sound !== 'undefined') Sound.playSound('like');

    // 统一从作品记录读取最新计数（基线+真实记录），保证灯箱/卡片/列表一致
    let newCount = null;
    try {
      const art = await getArtworkById(artworkId);
      if (art) newCount = Number(art.likes) || 0;
    } catch (_) { /* 读取失败时下面用记录数兜底 */ }
    if (newCount === null) newCount = await getLikes(artworkId).catch(() => 0);

    // 同步灯箱当前列表的内存数据，避免左右切换后显示旧值
    if (window.Gallery && Array.isArray(Gallery.lightboxList)) {
      const art = Gallery.lightboxList.find(a => a.id === Number(artworkId));
      if (art) art.likes = newCount;
    }

    // 更新按钮 UI
    if (btnEl) {
      btnEl.classList.toggle('active', liked);
      const icon = btnEl.querySelector('i');
      if (icon) {
        icon.className = liked ? 'fa-solid fa-heart' : 'fa-regular fa-heart';
      }
      // 更新计数：使用作品记录的真实计数
      const countEl = btnEl.querySelector('.lb-like-count');
      if (countEl) {
        countEl.textContent = _fmtNum(newCount);
      }
      // 点赞动画：粒子飞出
      if (liked) _burstParticles(btnEl);
    }

    // 同步画廊卡片上的点赞数
    _syncCardLike(artworkId, newCount);
  } catch (err) {
    console.error('点赞失败:', err);
  }
}

// ----------------------------------------------------------
// 收藏 / 取消收藏
// ----------------------------------------------------------
async function handleFavorite(artworkId, btnEl) {
  if (!window.currentUser) {
    if (window.Auth) Auth.requireLogin();
    return;
  }
  const user = window.currentUser;
  try {
    const favorited = await toggleFavorite(artworkId, user.id);
    if (typeof Sound !== 'undefined') Sound.playSound(favorited ? 'like' : 'click');

    if (btnEl) {
      btnEl.classList.toggle('active', favorited);
      const icon = btnEl.querySelector('i');
      if (icon) {
        icon.className = favorited ? 'fa-solid fa-bookmark' : 'fa-regular fa-bookmark';
      }
      const label = btnEl.querySelector('.lb-action-label');
      if (label) label.textContent = favorited ? '已收藏' : '收藏';
      // 收藏动画
      if (favorited) _favAnimation(btnEl);
    }
    if (window.showToast) {
      showToast(favorited ? '已加入收藏' : '已取消收藏', favorited ? 'success' : 'info');
    }
  } catch (err) {
    console.error('收藏失败:', err);
  }
}

// ----------------------------------------------------------
// 发表评论
// ----------------------------------------------------------
async function handleComment(artworkId, content) {
  if (!window.currentUser) {
    if (window.Auth) Auth.requireLogin();
    return false;
  }
  const user = window.currentUser;
  content = (content || '').trim();
  if (!content) return false;
  if (content.length > 500) {
    if (window.showToast) showToast('评论不能超过 500 字', 'warn');
    return false;
  }
  try {
    await addComment(artworkId, user.id, user.username, content);
    if (typeof Sound !== 'undefined') Sound.playSound('success');
    if (window.showToast) showToast('评论已发布', 'success');
    return true;
  } catch (err) {
    console.error('评论失败:', err);
    if (window.showToast) showToast('评论发布失败', 'warn');
    return false;
  }
}

// ----------------------------------------------------------
// 渲染评论列表（独立函数，供 profile 等模块复用）
// ----------------------------------------------------------
function renderComments(artworkId) {
  return getComments(artworkId).then(async comments => {
    const list = document.getElementById('lb-comment-list');
    if (!list) return comments;
    if (!comments || comments.length === 0) {
      list.innerHTML = '<div class="lb-no-comment">还没有评论，成为第一个发声的人吧</div>';
    } else {
      // 评论记录只存 userId + username，头像一次性读 users 表按账户解析
      const users = (window.Settings && typeof window.Settings.buildUserMap === 'function')
        ? await window.Settings.buildUserMap() : new Map();
      const avatarOf = (c) => (window.Settings && typeof window.Settings.renderAvatarHtml === 'function')
        ? window.Settings.renderAvatarHtml(users.get(String(c.userId)) || { username: c.username }, { sizeClass: 'sm' })
        : `<span class="avatar-circle sm">${_esc((c.username || '?').charAt(0))}</span>`;
      list.innerHTML = comments.map(c => `
        <div class="comment-item">
          ${avatarOf(c)}
          <div class="comment-body">
            <div class="comment-head">
              <span class="comment-user">${_esc(c.username)}</span>
              <span class="comment-time">${_fmtTime(c.createdAt)}</span>
            </div>
            <p class="comment-text">${_esc(c.content)}</p>
          </div>
        </div>
      `).join('');
    }
    const cnt = document.getElementById('lb-comment-count');
    if (cnt) cnt.textContent = comments.length;
    return comments;
  });
}

// ----------------------------------------------------------
// 点赞粒子飞出动画
// 从按钮位置发射多个彩色小圆点，向外扩散并淡出
// ----------------------------------------------------------
function _burstParticles(btnEl) {
  const rect = btnEl.getBoundingClientRect();
  const cx = rect.left + rect.width / 2;
  const cy = rect.top + rect.height / 2;
  const colors = ['#ffd1e8', '#c9b6ff', '#a8d8ff', '#b8f0d4', '#fff4c2'];
  const count = 14;

  for (let i = 0; i < count; i++) {
    const p = document.createElement('div');
    p.className = 'like-particle';
    p.style.left = cx + 'px';
    p.style.top = cy + 'px';
    p.style.background = colors[i % colors.length];
    document.body.appendChild(p);

    const angle = (Math.PI * 2 * i) / count + (Math.random() - 0.5) * 0.4;
    const dist = 50 + Math.random() * 60;
    const dx = Math.cos(angle) * dist;
    const dy = Math.sin(angle) * dist - 20; // 略带上飘
    const dur = 600 + Math.random() * 300;

    p.animate([
      { transform: 'translate(-50%, -50%) scale(1)', opacity: 1 },
      { transform: `translate(calc(-50% + ${dx}px), calc(-50% + ${dy}px)) scale(0)`, opacity: 0 }
    ], { duration: dur, easing: 'cubic-bezier(.2,.7,.3,1)' });

    setTimeout(() => p.remove(), dur + 50);
  }

  // 按钮自身心跳
  btnEl.animate([
    { transform: 'scale(1)' },
    { transform: 'scale(1.25)' },
    { transform: 'scale(1)' }
  ], { duration: 360, easing: 'ease-out' });
}

// ----------------------------------------------------------
// 收藏动画：环形闪光
// ----------------------------------------------------------
function _favAnimation(btnEl) {
  btnEl.animate([
    { transform: 'scale(1) rotate(0deg)', filter: 'brightness(1)' },
    { transform: 'scale(1.2) rotate(-10deg)', filter: 'brightness(1.6)' },
    { transform: 'scale(1) rotate(0deg)', filter: 'brightness(1)' }
  ], { duration: 420, easing: 'ease-out' });
}

// ----------------------------------------------------------
// 同步画廊卡片上的点赞数（newCount 为作品记录中的最新计数）
// ----------------------------------------------------------
function _syncCardLike(artworkId, newCount) {
  const card = document.querySelector(`.artwork-card[data-id="${artworkId}"]`);
  if (!card) return;
  const stat = card.querySelector('.card-likes');
  if (stat) {
    const cur = Number(newCount) || 0;
    card.dataset.likes = cur;
    stat.innerHTML = `<i class="fa-solid fa-heart"></i> ${_fmtNum(cur)}`;
  }
}

// ----------------------------------------------------------
// 工具函数（与 gallery 共享风格）
// ----------------------------------------------------------
function _fmtNum(n) {
  n = Number(n) || 0;
  if (n >= 10000) return (n / 10000).toFixed(1) + 'w';
  if (n >= 1000) return (n / 1000).toFixed(1) + 'k';
  return n;
}

function _fmtTime(iso) {
  if (!iso) return '';
  const d = new Date(iso);
  const diff = Date.now() - d.getTime();
  const min = 60 * 1000, hour = 60 * min, day = 24 * hour;
  if (diff < min) return '刚刚';
  if (diff < hour) return Math.floor(diff / min) + '分钟前';
  if (diff < day) return Math.floor(diff / hour) + '小时前';
  if (diff < 30 * day) return Math.floor(diff / day) + '天前';
  return d.toLocaleDateString('zh-CN');
}

function _esc(s) {
  return String(s == null ? '' : s).replace(/[&<>"']/g, c => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
  }[c]));
}

// 暴露为全局
window.handleLike = handleLike;
window.handleFavorite = handleFavorite;
window.handleComment = handleComment;
window.renderComments = renderComments;

// ES Module export
export { handleLike, handleFavorite, handleComment, renderComments };
