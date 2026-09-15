// ============================================================
// js/db.js — IndexedDB 数据层
// 数据库: DreamcoreArtDB (版本 3)
// 提供 作品 / 用户 / 评论 / 点赞 / 收藏 / 关注 / 通知 的增删改查
// 管理员默认账号: admin / admin123 (SHA-256 加密存储)
// 所有函数返回 Promise
// ============================================================

// ES Module: 导入种子数据
import { ARTWORKS_SEED_DATA } from '../data/artworks.js';

const DB_NAME = 'DreamcoreArtDB';
const DB_VERSION = 3;

// 数据库实例（initDB 完成后赋值）
let dbInstance = null;

// 分类列表（与画廊筛选栏保持一致）
const CATEGORIES = ['digital-art', 'photography', 'illustration', 'abstract', '3d-art'];

// ------------------------------------------------------------
// 工具函数：SHA-256 加密密码（使用 crypto.subtle）
// 返回十六进制字符串
// ------------------------------------------------------------
async function hashPassword(password) {
  // 非安全上下文（如 HTTP 非 localhost）下 crypto.subtle 不可用
  if (!crypto || !crypto.subtle) {
    // 简易回退：仅用于本地开发，生产环境应使用 HTTPS
    let hash = 0;
    for (let i = 0; i < password.length; i++) {
      hash = ((hash << 5) - hash + password.charCodeAt(i)) | 0;
    }
    return 'fallback_' + Math.abs(hash).toString(16).padStart(8, '0');
  }
  const encoder = new TextEncoder();
  const data = encoder.encode(password);
  const hashBuffer = await crypto.subtle.digest('SHA-256', data);
  // 将 ArrayBuffer 转为十六进制字符串
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
}

// ------------------------------------------------------------
// 打开/初始化数据库
// 首次运行时导入种子数据和管理员账号
// ------------------------------------------------------------
function initDB() {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);

    // 数据库升级时创建 Object Stores 与索引
    request.onupgradeneeded = (event) => {
      const db = event.target.result;
      const oldVersion = event.oldVersion;

      // 作品表：keyPath = id（使用种子数据自带 id）
      if (!db.objectStoreNames.contains('artworks')) {
        const store = db.createObjectStore('artworks', { keyPath: 'id' });
        store.createIndex('category', 'category', { unique: false });
        store.createIndex('author', 'author', { unique: false });
        store.createIndex('userId', 'userId', { unique: false });
      }

      // 用户表：自增 id
      if (!db.objectStoreNames.contains('users')) {
        const store = db.createObjectStore('users', { keyPath: 'id', autoIncrement: true });
        store.createIndex('username', 'username', { unique: true });
        store.createIndex('email', 'email', { unique: false });
      }

      // 评论表：自增 id
      if (!db.objectStoreNames.contains('comments')) {
        const store = db.createObjectStore('comments', { keyPath: 'id', autoIncrement: true });
        store.createIndex('artworkId', 'artworkId', { unique: false });
        store.createIndex('userId', 'userId', { unique: false });
      }

      // 点赞表：自增 id，复合索引 [artworkId, userId] 保证唯一
      if (!db.objectStoreNames.contains('likes')) {
        const store = db.createObjectStore('likes', { keyPath: 'id', autoIncrement: true });
        store.createIndex('artworkId', 'artworkId', { unique: false });
        store.createIndex('userId', 'userId', { unique: false });
        store.createIndex('by_artwork_user', ['artworkId', 'userId'], { unique: true });
      }

      // 收藏表：自增 id
      if (!db.objectStoreNames.contains('favorites')) {
        const store = db.createObjectStore('favorites', { keyPath: 'id', autoIncrement: true });
        store.createIndex('userId', 'userId', { unique: false });
        store.createIndex('artworkId', 'artworkId', { unique: false });
        store.createIndex('by_artwork_user', ['artworkId', 'userId'], { unique: true });
      }

      // 关注表：自增 id
      if (!db.objectStoreNames.contains('follows')) {
        const store = db.createObjectStore('follows', { keyPath: 'id', autoIncrement: true });
        store.createIndex('followerId', 'followerId', { unique: false });
        store.createIndex('followingId', 'followingId', { unique: false });
        store.createIndex('by_follower_following', ['followerId', 'followingId'], { unique: true });
      }

      // 通知表：自增 id
      if (!db.objectStoreNames.contains('notifications')) {
        const store = db.createObjectStore('notifications', { keyPath: 'id', autoIncrement: true });
        store.createIndex('userId', 'userId', { unique: false });
        store.createIndex('read', 'read', { unique: false });
        store.createIndex('by_user_read', ['userId', 'read'], { unique: false });
      }

      // AI记忆表：自增 id（v3新增）
      if (!db.objectStoreNames.contains('ai_memories')) {
        const store = db.createObjectStore('ai_memories', { keyPath: 'id', autoIncrement: true });
        store.createIndex('userId', 'userId', { unique: false });
        store.createIndex('type', 'type', { unique: false });
        store.createIndex('createdAt', 'createdAt', { unique: false });
      }
    };

    request.onsuccess = async (event) => {
      dbInstance = event.target.result;
      try {
        await seedIfEmpty();
        await migrateExistingData();
        resolve(dbInstance);
      } catch (err) {
        console.error('初始化种子数据失败:', err);
        // 即使种子失败也返回 db，保证页面可用
        resolve(dbInstance);
      }
    };

    request.onerror = (event) => {
      console.error('打开数据库失败:', event.target.error);
      reject(event.target.error);
    };
  });
}

// ------------------------------------------------------------
// 迁移现有数据：为旧数据补充新字段
// ------------------------------------------------------------
async function migrateExistingData() {
  // 迁移作品数据：补充 tags, images, views 字段
  const artworks = await getAllArtworks();
  const tx = dbInstance.transaction('artworks', 'readwrite');
  const store = tx.objectStore('artworks');
  for (const art of artworks) {
    let changed = false;
    if (!art.tags) {
      art.tags = _generateTagsForArtwork(art);
      changed = true;
    }
    if (!art.images || !Array.isArray(art.images) || art.images.length === 0) {
      art.images = _generateImagesForArtwork(art);
      changed = true;
    }
    if (art.views === undefined || art.views === null) {
      art.views = art.views || 0;
      changed = true;
    }
    if (changed) {
      store.put(art);
    }
  }
  await new Promise((resolve, reject) => {
    tx.oncomplete = resolve;
    tx.onerror = () => reject(tx.error);
  });

  // 迁移用户数据：补充 bio, followersCount, followingCount, worksCount
  const users = await getAllUsers();
  const tx2 = dbInstance.transaction('users', 'readwrite');
  const store2 = tx2.objectStore('users');
  for (const user of users) {
    let changed = false;
    if (user.bio === undefined) {
      user.bio = '';
      changed = true;
    }
    if (user.followersCount === undefined || user.followersCount === null) {
      user.followersCount = 0;
      changed = true;
    }
    if (user.followingCount === undefined || user.followingCount === null) {
      user.followingCount = 0;
      changed = true;
    }
    if (user.worksCount === undefined || user.worksCount === null) {
      const userArts = artworks.filter(a => a.userId === user.id);
      user.worksCount = userArts.length;
      changed = true;
    }
    if (changed) {
      store2.put(user);
    }
  }
  await new Promise((resolve, reject) => {
    tx2.oncomplete = resolve;
    tx2.onerror = () => reject(tx2.error);
  });
}

// ------------------------------------------------------------
// 为作品生成标签（基于分类和标题）
// ------------------------------------------------------------
function _generateTagsForArtwork(art) {
  const tagPool = {
    'digital-art': ['梦幻', '霓虹', '未来', '赛博朋克', '粒子', '渐变'],
    'photography': ['自然', '人物', '建筑', '风光', '街拍', '微距'],
    'illustration': ['梦幻', '抽象', '人物', '童话', '水彩', '手绘'],
    'abstract': ['抽象', '几何', '色彩', '流体', '极简', '概念'],
    '3d-art': ['未来', '建筑', '雕塑', '渲染', '粒子', '科幻']
  };
  const pool = tagPool[art.category] || ['梦幻', '抽象'];
  const count = 2 + Math.floor(Math.random() * 3);
  const shuffled = [...pool].sort(() => Math.random() - 0.5);
  return shuffled.slice(0, count);
}

// ------------------------------------------------------------
// 为作品生成多图数组
// ------------------------------------------------------------
function _generateImagesForArtwork(art) {
  const images = [art.imageUrl];
  // 30% 的作品添加多张图片（2-5张）
  if (Math.random() < 0.3) {
    const extraCount = 1 + Math.floor(Math.random() * 4);
    for (let i = 0; i < extraCount; i++) {
      const seed = `art${art.id}_extra${i + 1}`;
      images.push(`https://picsum.photos/seed/${seed}/800/600`);
    }
  }
  return images;
}

// ------------------------------------------------------------
// 首次运行导入种子数据与管理员账号
// ------------------------------------------------------------
async function seedIfEmpty() {
  // 检查是否已有作品
  const count = await new Promise((resolve, reject) => {
    const tx = dbInstance.transaction('artworks', 'readonly');
    const req = tx.objectStore('artworks').count();
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });

  if (count === 0 && typeof ARTWORKS_SEED_DATA !== 'undefined') {
    // 批量导入种子作品
    const tx = dbInstance.transaction('artworks', 'readwrite');
    const store = tx.objectStore('artworks');
    ARTWORKS_SEED_DATA.forEach(art => {
      const tags = _generateTagsForArtwork(art);
      const images = _generateImagesForArtwork(art);
      store.put({
        ...art,
        userId: null,
        type: 'image',
        tags,
        images,
        views: art.views || 0
      });
    });
    await new Promise((resolve, reject) => {
      tx.oncomplete = resolve;
      tx.onerror = () => reject(tx.error);
    });
  }

  // 检查是否已有管理员
  const hasAdmin = await new Promise((resolve, reject) => {
    const tx = dbInstance.transaction('users', 'readonly');
    const req = tx.objectStore('users').index('username').get('admin');
    req.onsuccess = () => resolve(!!req.result);
    req.onerror = () => reject(req.error);
  });

  if (!hasAdmin) {
    const adminHash = await hashPassword('admin123');
    const tx = dbInstance.transaction('users', 'readwrite');
    tx.objectStore('users').add({
      username: 'admin',
      email: 'admin@dreamcore.art',
      passwordHash: adminHash,
      avatar: null,
      createdAt: new Date().toISOString(),
      isAdmin: true,
      bio: 'Dreamcore 平台管理员，热爱梦境美学与数字艺术。',
      followersCount: 0,
      followingCount: 0,
      worksCount: 0
    });
    await new Promise((resolve, reject) => {
      tx.oncomplete = resolve;
      tx.onerror = () => reject(tx.error);
    });
  }
}

// ------------------------------------------------------------
// 通用：执行一个事务中的请求并返回 Promise
// ------------------------------------------------------------
function runRequest(storeName, mode, callback) {
  return new Promise((resolve, reject) => {
    const tx = dbInstance.transaction(storeName, mode);
    const store = tx.objectStore(storeName);
    const req = callback(store);
    if (req) {
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => reject(req.error);
    } else {
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    }
  });
}

// ============================================================
// 作品相关 API
// ============================================================

// 获取所有作品（按 id 倒序，最新在前）
function getAllArtworks() {
  return new Promise((resolve, reject) => {
    const tx = dbInstance.transaction('artworks', 'readonly');
    const req = tx.objectStore('artworks').getAll();
    req.onsuccess = () => {
      const list = req.result || [];
      list.sort((a, b) => (b.id || 0) - (a.id || 0));
      resolve(list);
    };
    req.onerror = () => reject(req.error);
  });
}

// 获取单个作品
function getArtworkById(id) {
  id = Number(id);
  return runRequest('artworks', 'readonly', store => store.get(id));
}

// 添加作品（返回新作品，含分配的 id）
async function addArtwork(artwork) {
  // 生成新 id：当前最大 id + 1
  const all = await getAllArtworks();
  const maxId = all.reduce((m, a) => Math.max(m, Number(a.id) || 0), 0);
  const newId = maxId + 1;
  const tags = artwork.tags || [];
  const images = artwork.images || (artwork.imageUrl ? [artwork.imageUrl] : []);
  const record = {
    id: newId,
    title: artwork.title,
    description: artwork.description,
    author: artwork.author || '匿名艺术家',
    category: artwork.category || 'digital-art',
    imageUrl: artwork.imageUrl || '',
    type: artwork.type || 'image',
    likes: 0,
    views: 0,
    createdAt: new Date().toISOString().slice(0, 10),
    userId: artwork.userId || null,
    tags,
    images
  };
  await runRequest('artworks', 'readwrite', store => store.add(record));

  // 更新用户作品数
  if (record.userId) {
    try {
      await _updateUserWorksCount(record.userId);
    } catch (e) { /* 忽略 */ }
  }

  return record;
}

// 删除作品
async function deleteArtwork(id) {
  id = Number(id);
  const art = await getArtworkById(id);
  await runRequest('artworks', 'readwrite', store => store.delete(id));

  // 更新用户作品数
  if (art && art.userId) {
    try {
      await _updateUserWorksCount(art.userId);
    } catch (e) { /* 忽略 */ }
  }
}

// 更新作品字段
async function updateArtwork(id, data) {
  id = Number(id);
  const art = await getArtworkById(id);
  if (!art) throw new Error('作品不存在');
  const updated = { ...art, ...data, id };
  await runRequest('artworks', 'readwrite', store => store.put(updated));
  return updated;
}

// 获取指定用户发布的作品
async function getUserArtworks(userId) {
  const all = await getAllArtworks();
  // 先按userId精确匹配
  const matched = all.filter(a => a.userId === userId);
  // 如果没有匹配结果，可能是因为用户发布了种子数据作品（没有userId字段）
  // 此时通过用户名匹配
  if (matched.length === 0) {
    try {
      const user = await getUserById(userId);
      if (user && user.username) {
        const normalized = user.username.trim().toLowerCase();
        return all.filter(a => {
          const author = (a.author || '').trim().toLowerCase();
          return author === normalized;
        });
      }
    } catch (e) { /* 忽略 */ }
  }
  return matched;
}

// 获取指定作者名的作品（用于种子数据中的作者）
async function getArtworksByAuthorName(authorName) {
  const all = await getAllArtworks();
  const normalized = (authorName || '').trim().toLowerCase();
  return all.filter(a => {
    const author = (a.author || '').trim().toLowerCase();
    return author === normalized;
  });
}

// 根据标签获取作品
async function getArtworksByTag(tag) {
  const all = await getAllArtworks();
  return all.filter(a => a.tags && a.tags.includes(tag));
}

// ============================================================
// 用户相关 API
// ============================================================

// 获取所有用户
function getAllUsers() {
  return runRequest('users', 'readonly', store => store.getAll());
}

// 根据 id 获取用户
function getUserById(id) {
  id = Number(id);
  return runRequest('users', 'readonly', store => store.get(id));
}

// 根据用户名获取用户
function getUserByUsername(username) {
  return new Promise((resolve, reject) => {
    const tx = dbInstance.transaction('users', 'readonly');
    const req = tx.objectStore('users').index('username').get(username);
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

// 注册用户（密码 SHA-256 加密）
async function registerUser(user) {
  // 检查用户名是否已存在
  const exist = await new Promise((resolve, reject) => {
    const tx = dbInstance.transaction('users', 'readonly');
    const req = tx.objectStore('users').index('username').get(user.username);
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
  if (exist) {
    throw new Error('该用户名已被注册');
  }
  const passwordHash = await hashPassword(user.password);
  const record = {
    username: user.username,
    email: user.email || '',
    passwordHash,
    avatar: null,
    createdAt: new Date().toISOString(),
    isAdmin: false,
    bio: user.bio || '',
    followersCount: 0,
    followingCount: 0,
    worksCount: 0
  };
  const newId = await new Promise((resolve, reject) => {
    const tx = dbInstance.transaction('users', 'readwrite');
    const req = tx.objectStore('users').add(record);
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
  return { id: newId, ...record };
}

// 登录验证：用户名 + 密码
async function loginUser(username, password) {
  const user = await new Promise((resolve, reject) => {
    const tx = dbInstance.transaction('users', 'readonly');
    const req = tx.objectStore('users').index('username').get(username);
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
  if (!user) throw new Error('用户不存在');
  const hash = await hashPassword(password);
  if (hash !== user.passwordHash) throw new Error('密码错误');
  // 不返回密码哈希
  const { passwordHash, ...safe } = user;
  return safe;
}

// 更新用户信息
async function updateUser(id, data) {
  id = Number(id);
  const user = await getUserById(id);
  if (!user) throw new Error('用户不存在');
  const updated = { ...user, ...data, id };
  await runRequest('users', 'readwrite', store => store.put(updated));
  const { passwordHash, ...safe } = updated;
  return safe;
}

// 更新用户作品数
async function _updateUserWorksCount(userId) {
  const arts = await getUserArtworks(userId);
  await updateUser(userId, { worksCount: arts.length });
}

// ============================================================
// 评论相关 API
// ============================================================

// 添加评论
async function addComment(artworkId, userId, username, content) {
  const record = {
    artworkId: Number(artworkId),
    userId: userId,
    username: username,
    content: content,
    createdAt: new Date().toISOString()
  };
  const result = await new Promise((resolve, reject) => {
    const tx = dbInstance.transaction('comments', 'readwrite');
    const req = tx.objectStore('comments').add(record);
    req.onsuccess = () => resolve({ id: req.result, ...record });
    req.onerror = () => reject(req.error);
  });

  // 产生通知（如果评论者不是作者）
  try {
    const art = await getArtworkById(artworkId);
    if (art && art.userId && art.userId !== userId) {
      await addNotification({
        userId: art.userId,
        type: 'comment',
        fromUserId: userId,
        artworkId: Number(artworkId),
        content: content.slice(0, 50)
      });
    }
  } catch (e) { /* 忽略通知错误 */ }

  return result;
}

// 获取作品评论（按时间正序）
function getComments(artworkId) {
  artworkId = Number(artworkId);
  return new Promise((resolve, reject) => {
    const tx = dbInstance.transaction('comments', 'readonly');
    const req = tx.objectStore('comments').index('artworkId').getAll(artworkId);
    req.onsuccess = () => {
      const list = req.result || [];
      list.sort((a, b) => new Date(a.createdAt) - new Date(b.createdAt));
      resolve(list);
    };
    req.onerror = () => reject(req.error);
  });
}

// ============================================================
// 点赞相关 API
// ============================================================

// 切换点赞（已赞则取消，未赞则添加），返回当前是否已赞
async function toggleLike(artworkId, userId) {
  artworkId = Number(artworkId);
  const existing = await new Promise((resolve, reject) => {
    const tx = dbInstance.transaction('likes', 'readonly');
    const req = tx.objectStore('likes').index('by_artwork_user').get([artworkId, userId]);
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });

  let liked;
  if (existing) {
    // 取消点赞
    await new Promise((resolve, reject) => {
      const tx = dbInstance.transaction('likes', 'readwrite');
      const req = tx.objectStore('likes').delete(existing.id);
      req.onsuccess = () => resolve();
      req.onerror = () => reject(req.error);
    });
    liked = false;
  } else {
    // 添加点赞
    await new Promise((resolve, reject) => {
      const tx = dbInstance.transaction('likes', 'readwrite');
      const req = tx.objectStore('likes').add({ artworkId, userId });
      req.onsuccess = () => resolve();
      req.onerror = () => reject(req.error);
    });
    liked = true;

    // 产生通知（如果点赞者不是作者）
    try {
      const art = await getArtworkById(artworkId);
      if (art && art.userId && art.userId !== userId) {
        await addNotification({
          userId: art.userId,
          type: 'like',
          fromUserId: userId,
          artworkId: artworkId
        });
      }
    } catch (e) { /* 忽略通知错误 */ }
  }

  // 同步作品表中的 likes 计数（便于快速展示）
  const count = await getLikes(artworkId);
  try {
    await updateArtwork(artworkId, { likes: count });
  } catch (e) { /* 忽略计数同步错误 */ }

  return liked;
}

// 获取作品点赞数
function getLikes(artworkId) {
  artworkId = Number(artworkId);
  return new Promise((resolve, reject) => {
    const tx = dbInstance.transaction('likes', 'readonly');
    const req = tx.objectStore('likes').index('artworkId').count(artworkId);
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

// 检查用户是否已点赞
function hasUserLiked(artworkId, userId) {
  artworkId = Number(artworkId);
  return new Promise((resolve, reject) => {
    const tx = dbInstance.transaction('likes', 'readonly');
    const req = tx.objectStore('likes').index('by_artwork_user').get([artworkId, userId]);
    req.onsuccess = () => resolve(!!req.result);
    req.onerror = () => reject(req.error);
  });
}

// ============================================================
// 收藏相关 API
// ============================================================

// 切换收藏，返回当前是否已收藏
async function toggleFavorite(artworkId, userId) {
  artworkId = Number(artworkId);
  const existing = await new Promise((resolve, reject) => {
    const tx = dbInstance.transaction('favorites', 'readonly');
    const req = tx.objectStore('favorites').index('by_artwork_user').get([artworkId, userId]);
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });

  let favorited;
  if (existing) {
    await new Promise((resolve, reject) => {
      const tx = dbInstance.transaction('favorites', 'readwrite');
      const req = tx.objectStore('favorites').delete(existing.id);
      req.onsuccess = () => resolve();
      req.onerror = () => reject(req.error);
    });
    favorited = false;
  } else {
    await new Promise((resolve, reject) => {
      const tx = dbInstance.transaction('favorites', 'readwrite');
      const req = tx.objectStore('favorites').add({ artworkId, userId });
      req.onsuccess = () => resolve();
      req.onerror = () => reject(req.error);
    });
    favorited = true;
  }
  return favorited;
}

// 获取用户收藏的作品列表
async function getFavorites(userId) {
  const favRecords = await new Promise((resolve, reject) => {
    const tx = dbInstance.transaction('favorites', 'readonly');
    const req = tx.objectStore('favorites').index('userId').getAll(userId);
    req.onsuccess = () => resolve(req.result || []);
    req.onerror = () => reject(req.error);
  });
  // 取出对应作品
  const artworks = [];
  for (const fav of favRecords) {
    const art = await getArtworkById(fav.artworkId);
    if (art) artworks.push(art);
  }
  return artworks;
}

// 检查用户是否已收藏
function hasUserFavorited(artworkId, userId) {
  artworkId = Number(artworkId);
  return new Promise((resolve, reject) => {
    const tx = dbInstance.transaction('favorites', 'readonly');
    const req = tx.objectStore('favorites').index('by_artwork_user').get([artworkId, userId]);
    req.onsuccess = () => resolve(!!req.result);
    req.onerror = () => reject(req.error);
  });
}

// 统计用户获赞总数（其发布作品的总点赞）
async function getUserTotalLikes(userId) {
  const arts = await getUserArtworks(userId);
  return arts.reduce((sum, a) => sum + (a.likes || 0), 0);
}

// ============================================================
// 关注相关 API
// ============================================================

// 切换关注
async function toggleFollow(followerId, followingId) {
  followerId = Number(followerId);
  followingId = Number(followingId);

  if (followerId === followingId) {
    throw new Error('不能关注自己');
  }

  const existing = await new Promise((resolve, reject) => {
    const tx = dbInstance.transaction('follows', 'readonly');
    const req = tx.objectStore('follows').index('by_follower_following').get([followerId, followingId]);
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });

  let isFollowing;
  if (existing) {
    // 取消关注
    await new Promise((resolve, reject) => {
      const tx = dbInstance.transaction('follows', 'readwrite');
      const req = tx.objectStore('follows').delete(existing.id);
      req.onsuccess = () => resolve();
      req.onerror = () => reject(req.error);
    });
    isFollowing = false;
  } else {
    // 添加关注
    await new Promise((resolve, reject) => {
      const tx = dbInstance.transaction('follows', 'readwrite');
      const req = tx.objectStore('follows').add({
        followerId,
        followingId,
        createdAt: new Date().toISOString()
      });
      req.onsuccess = () => resolve();
      req.onerror = () => reject(req.error);
    });
    isFollowing = true;

    // 产生通知
    try {
      await addNotification({
        userId: followingId,
        type: 'follow',
        fromUserId: followerId
      });
    } catch (e) { /* 忽略通知错误 */ }
  }

  // 更新双方计数
  try {
    await _updateFollowCounts(followerId, followingId);
  } catch (e) { /* 忽略计数错误 */ }

  return isFollowing;
}

// 更新关注双方的计数
async function _updateFollowCounts(followerId, followingId) {
  const followerCount = await getFollowersCount(followingId);
  const followingCount = await getFollowingCount(followerId);

  await updateUser(followingId, { followersCount: followerCount });
  await updateUser(followerId, { followingCount: followingCount });
}

// 检查是否已关注
function isFollowing(followerId, followingId) {
  followerId = Number(followerId);
  followingId = Number(followingId);
  return new Promise((resolve, reject) => {
    const tx = dbInstance.transaction('follows', 'readonly');
    const req = tx.objectStore('follows').index('by_follower_following').get([followerId, followingId]);
    req.onsuccess = () => resolve(!!req.result);
    req.onerror = () => reject(req.error);
  });
}

// 获取粉丝数
function getFollowersCount(userId) {
  userId = Number(userId);
  return new Promise((resolve, reject) => {
    const tx = dbInstance.transaction('follows', 'readonly');
    const req = tx.objectStore('follows').index('followingId').count(userId);
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

// 获取关注数
function getFollowingCount(userId) {
  userId = Number(userId);
  return new Promise((resolve, reject) => {
    const tx = dbInstance.transaction('follows', 'readonly');
    const req = tx.objectStore('follows').index('followerId').count(userId);
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

// 获取粉丝列表（返回用户对象数组）
async function getFollowers(userId) {
  userId = Number(userId);
  const records = await new Promise((resolve, reject) => {
    const tx = dbInstance.transaction('follows', 'readonly');
    const req = tx.objectStore('follows').index('followingId').getAll(userId);
    req.onsuccess = () => resolve(req.result || []);
    req.onerror = () => reject(req.error);
  });
  const users = [];
  for (const record of records) {
    const user = await getUserById(record.followerId);
    if (user) {
      const { passwordHash, ...safe } = user;
      users.push(safe);
    }
  }
  return users;
}

// 获取关注列表（返回用户对象数组）
async function getFollowing(userId) {
  userId = Number(userId);
  const records = await new Promise((resolve, reject) => {
    const tx = dbInstance.transaction('follows', 'readonly');
    const req = tx.objectStore('follows').index('followerId').getAll(userId);
    req.onsuccess = () => resolve(req.result || []);
    req.onerror = () => reject(req.error);
  });
  const users = [];
  for (const record of records) {
    const user = await getUserById(record.followingId);
    if (user) {
      const { passwordHash, ...safe } = user;
      users.push(safe);
    }
  }
  return users;
}

// ============================================================
// 通知相关 API
// ============================================================

// 添加通知
function addNotification(notification) {
  const record = {
    userId: Number(notification.userId),
    type: notification.type,
    fromUserId: notification.fromUserId ? Number(notification.fromUserId) : null,
    artworkId: notification.artworkId ? Number(notification.artworkId) : null,
    content: notification.content || '',
    read: false,
    createdAt: new Date().toISOString()
  };
  return new Promise((resolve, reject) => {
    const tx = dbInstance.transaction('notifications', 'readwrite');
    const req = tx.objectStore('notifications').add(record);
    req.onsuccess = () => resolve({ id: req.result, ...record });
    req.onerror = () => reject(req.error);
  });
}

// 获取用户通知列表
async function getUserNotifications(userId, unreadOnly = false) {
  userId = Number(userId);
  let records;
  if (unreadOnly) {
    records = await new Promise((resolve, reject) => {
      const tx = dbInstance.transaction('notifications', 'readonly');
      const req = tx.objectStore('notifications').index('by_user_read').getAll([userId, false]);
      req.onsuccess = () => resolve(req.result || []);
      req.onerror = () => reject(req.error);
    });
  } else {
    records = await new Promise((resolve, reject) => {
      const tx = dbInstance.transaction('notifications', 'readonly');
      const req = tx.objectStore('notifications').index('userId').getAll(userId);
      req.onsuccess = () => resolve(req.result || []);
      req.onerror = () => reject(req.error);
    });
  }
  records.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
  return records;
}

// 标记通知为已读
async function markNotificationRead(id) {
  id = Number(id);
  const notif = await runRequest('notifications', 'readonly', store => store.get(id));
  if (!notif) return;
  notif.read = true;
  await runRequest('notifications', 'readwrite', store => store.put(notif));
}

// 标记所有通知为已读
async function markAllNotificationsRead(userId) {
  userId = Number(userId);
  const records = await getUserNotifications(userId, true);
  const tx = dbInstance.transaction('notifications', 'readwrite');
  const store = tx.objectStore('notifications');
  for (const record of records) {
    record.read = true;
    store.put(record);
  }
  await new Promise((resolve, reject) => {
    tx.oncomplete = resolve;
    tx.onerror = () => reject(tx.error);
  });
}

// 获取未读通知数
function getUnreadNotificationCount(userId) {
  userId = Number(userId);
  return new Promise((resolve, reject) => {
    const tx = dbInstance.transaction('notifications', 'readonly');
    const req = tx.objectStore('notifications').index('by_user_read').count([userId, false]);
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

// ============================================================
// AI记忆系统 CRUD（v3新增）
// ============================================================

// 保存记忆
function saveMemory(userId, type, content, metadata = {}) {
  return new Promise((resolve, reject) => {
    const tx = dbInstance.transaction('ai_memories', 'readwrite');
    const store = tx.objectStore('ai_memories');
    const req = store.add({ userId, type, content, metadata, createdAt: Date.now() });
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

// 获取用户记忆（按时间倒序，最多limit条）
function getMemories(userId, limit = 50) {
  return new Promise((resolve) => {
    const tx = dbInstance.transaction('ai_memories', 'readonly');
    const idx = tx.objectStore('ai_memories').index('userId');
    const req = idx.getAll(userId);
    req.onsuccess = () => {
      const all = req.result || [];
      all.sort((a, b) => b.createdAt - a.createdAt);
      resolve(all.slice(0, limit));
    };
    req.onerror = () => resolve([]);
  });
}

// 获取指定类型的记忆
function getMemoriesByType(userId, type) {
  return new Promise((resolve) => {
    const tx = dbInstance.transaction('ai_memories', 'readonly');
    const store = tx.objectStore('ai_memories');
    const req = store.getAll();
    req.onsuccess = () => {
      const all = (req.result || []).filter(m => m.userId === userId && m.type === type);
      resolve(all);
    };
    req.onerror = () => resolve([]);
  });
}

// 清除用户所有记忆
function clearMemories(userId) {
  return new Promise((resolve, reject) => {
    const tx = dbInstance.transaction('ai_memories', 'readwrite');
    const idx = tx.objectStore('ai_memories').index('userId');
    const req = idx.openCursor(userId);
    req.onsuccess = (e) => {
      const cursor = e.target.result;
      if (cursor) { cursor.delete(); cursor.continue(); }
    };
    tx.oncomplete = () => resolve(true);
    tx.onerror = () => reject(tx.error);
  });
}

// 删除指定记忆
function deleteMemory(memoryId) {
  return new Promise((resolve, reject) => {
    const tx = dbInstance.transaction('ai_memories', 'readwrite');
    const req = tx.objectStore('ai_memories').delete(memoryId);
    req.onsuccess = () => resolve(true);
    req.onerror = () => reject(req.error);
  });
}

// 获取记忆总数
function getMemoryCount(userId) {
  return new Promise((resolve) => {
    const tx = dbInstance.transaction('ai_memories', 'readonly');
    const req = tx.objectStore('ai_memories').index('userId').count(userId);
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => resolve(0);
  });
}

// 暴露到全局（ES Module 向后兼容）
window.hashPassword = hashPassword;
window.initDB = initDB;
window.migrateExistingData = migrateExistingData;
window._generateTagsForArtwork = _generateTagsForArtwork;
window._generateImagesForArtwork = _generateImagesForArtwork;
window.seedIfEmpty = seedIfEmpty;
window.runRequest = runRequest;
window.getAllArtworks = getAllArtworks;
window.getArtworkById = getArtworkById;
window.addArtwork = addArtwork;
window.deleteArtwork = deleteArtwork;
window.updateArtwork = updateArtwork;
window.getUserArtworks = getUserArtworks;
window.getArtworksByAuthorName = getArtworksByAuthorName;
window.getArtworksByTag = getArtworksByTag;
window.getAllUsers = getAllUsers;
window.getUserById = getUserById;
window.getUserByUsername = getUserByUsername;
window.registerUser = registerUser;
window.loginUser = loginUser;
window.updateUser = updateUser;
window._updateUserWorksCount = _updateUserWorksCount;
window.addComment = addComment;
window.getComments = getComments;
window.toggleLike = toggleLike;
window.getLikes = getLikes;
window.hasUserLiked = hasUserLiked;
window.toggleFavorite = toggleFavorite;
window.getFavorites = getFavorites;
window.hasUserFavorited = hasUserFavorited;
window.getUserTotalLikes = getUserTotalLikes;
window.toggleFollow = toggleFollow;
window._updateFollowCounts = _updateFollowCounts;
window.isFollowing = isFollowing;
window.getFollowersCount = getFollowersCount;
window.getFollowingCount = getFollowingCount;
window.getFollowers = getFollowers;
window.getFollowing = getFollowing;
window.addNotification = addNotification;
window.getUserNotifications = getUserNotifications;
window.markNotificationRead = markNotificationRead;
window.markAllNotificationsRead = markAllNotificationsRead;
window.getUnreadNotificationCount = getUnreadNotificationCount;
window.saveMemory = saveMemory;
window.getMemories = getMemories;
window.getMemoriesByType = getMemoriesByType;
window.clearMemories = clearMemories;
window.deleteMemory = deleteMemory;
window.getMemoryCount = getMemoryCount;

// ES Module export
export {
  hashPassword,
  initDB,
  migrateExistingData,
  _generateTagsForArtwork,
  _generateImagesForArtwork,
  seedIfEmpty,
  runRequest,
  getAllArtworks,
  getArtworkById,
  addArtwork,
  deleteArtwork,
  updateArtwork,
  getUserArtworks,
  getArtworksByAuthorName,
  getArtworksByTag,
  getAllUsers,
  getUserById,
  getUserByUsername,
  registerUser,
  loginUser,
  updateUser,
  _updateUserWorksCount,
  addComment,
  getComments,
  toggleLike,
  getLikes,
  hasUserLiked,
  toggleFavorite,
  getFavorites,
  hasUserFavorited,
  getUserTotalLikes,
  toggleFollow,
  _updateFollowCounts,
  isFollowing,
  getFollowersCount,
  getFollowingCount,
  getFollowers,
  getFollowing,
  addNotification,
  getUserNotifications,
  markNotificationRead,
  markAllNotificationsRead,
  getUnreadNotificationCount,
  saveMemory,
  getMemories,
  getMemoriesByType,
  clearMemories,
  deleteMemory,
  getMemoryCount
};
