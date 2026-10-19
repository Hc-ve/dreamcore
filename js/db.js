// ============================================================
// js/db.js — IndexedDB 数据层
// 数据库: DreamcoreArtDB (版本 10)
// 提供 作品 / 用户 / 评论 / 点赞 / 收藏 / 关注 / 通知 / AI记忆 的增删改查
// v4 新增: AI评分定级 / 同类作品对比 / 修图版本 / AI文创衍生品
//         智能策展展馆 / 陪练会话 / 合伙人申请 共7个表
// v7 新增: 文化探索足迹表（三行为点亮：浏览/创作/识图）
// v8 新增: 游客攻略共创表（智慧导览景区详情页 P1-5 降级版：提交即展示+待审核角标）
// v9 新增: 文创订单表（P3 演示级一键下单：创作→下单→运营看板闭环）
// v10 新增: 订单物流状态机（paid→producing→shipped→in_transit→delivered）
//          + timeline 物流时间线 + trackingNo 模拟物流单号 + status 索引
// 管理员默认账号: admin / admin123 (SHA-256 加密存储)
// 所有函数返回 Promise
// ============================================================

// ES Module: 导入种子数据
import { ARTWORKS_SEED_DATA } from '../data/artworks.js';

const DB_NAME = 'DreamcoreArtDB';
const DB_VERSION = 12; // 2026-10-03 bump：v12 确保所有浏览器（含已存 v11 的）触发 onupgradeneeded，幂等建 custom_3d_models

// v10 新增：订单物流状态机（5 态固定流转，不可跳跃/回退）
// paid(已支付) → producing(制作中) → shipped(已发货) → in_transit(运输中) → delivered(已签收)
const ORDER_STATES = ['paid', 'producing', 'shipped', 'in_transit', 'delivered'];
const ORDER_STATE_LABELS = {
  paid: '已支付', producing: '制作中', shipped: '已发货', in_transit: '运输中', delivered: '已签收'
};

// 数据库实例（initDB 完成后赋值）
let dbInstance = null;

// 分类列表（与画廊筛选栏保持一致）— M6b-1 文旅文创六分类
const CATEGORIES = ['scenic-photo', 'heritage-craft', 'guofeng-art', 'ai-art', 'museum-culture', 'creative-design'];

// M6b-1 旧分类 → 新分类迁移映射（存量数据读取时自动归一）
const CATEGORY_MIGRATE = {
  'digital-art': 'ai-art',
  'photography': 'scenic-photo',
  'illustration': 'guofeng-art',
  'abstract': 'ai-art',
  '3d-art': 'creative-design'
};
function normalizeCategory(cat) {
  const c = String(cat || '').trim();
  return CATEGORY_MIGRATE[c] || (CATEGORIES.includes(c) ? c : 'ai-art');
}
function _normalizeArtworkCategory(rec) {
  if (rec && rec.category) rec.category = normalizeCategory(rec.category);
  return rec;
}

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

      // ============================================================
      // v4 新增 7 个表（AI赋能文旅文创升级）
      // ============================================================

      // AI评分定级表：自增 id（v4新增）
      // 业务语义：AI对作品进行构图/光影/色彩/清晰度/主题五维评分，给出等级与教学建议
      if (!db.objectStoreNames.contains('aesthetic_scores')) {
        const store = db.createObjectStore('aesthetic_scores', { keyPath: 'id', autoIncrement: true });
        store.createIndex('artworkId', 'artworkId', { unique: false });
        store.createIndex('userId', 'userId', { unique: false });
        store.createIndex('createdAt', 'createdAt', { unique: false });
      }

      // 同类作品对比表：自增 id（v4新增）
      // 业务语义：评分时检索构图/光影/色彩/主题维度相近的作品，供用户对比参考
      if (!db.objectStoreNames.contains('similar_works')) {
        const store = db.createObjectStore('similar_works', { keyPath: 'id', autoIncrement: true });
        store.createIndex('artworkId', 'artworkId', { unique: false });
        store.createIndex('similarArtworkId', 'similarArtworkId', { unique: false });
        store.createIndex('createdAt', 'createdAt', { unique: false });
      }

      // 修图版本表：自增 id（v4新增）
      // 业务语义：记录原始/ai-edit/manual-edit三类版本的曝光/对比度/饱和度/锐化/HSL参数与滤镜
      if (!db.objectStoreNames.contains('edit_versions')) {
        const store = db.createObjectStore('edit_versions', { keyPath: 'id', autoIncrement: true });
        store.createIndex('artworkId', 'artworkId', { unique: false });
        store.createIndex('userId', 'userId', { unique: false });
        store.createIndex('createdAt', 'createdAt', { unique: false });
      }

      // AI文创衍生品表：自增 id（v4新增）
      // 业务语义：基于作品生成壁纸/海报/收藏品/明信片/模板，风格涵盖国风/非遗纹样/现代极简
      if (!db.objectStoreNames.contains('ai_crafts')) {
        const store = db.createObjectStore('ai_crafts', { keyPath: 'id', autoIncrement: true });
        store.createIndex('artworkId', 'artworkId', { unique: false });
        store.createIndex('userId', 'userId', { unique: false });
        store.createIndex('craftType', 'craftType', { unique: false });
        store.createIndex('createdAt', 'createdAt', { unique: false });
      }

      // 智能策展展馆表：自增 id（v4新增）
      // 业务语义：AI按非遗/地域/季节光影等主题聚合作品生成策展展馆，含草稿/发布状态
      if (!db.objectStoreNames.contains('curated_halls')) {
        const store = db.createObjectStore('curated_halls', { keyPath: 'id', autoIncrement: true });
        store.createIndex('theme', 'theme', { unique: false });
        store.createIndex('status', 'status', { unique: false });
        store.createIndex('createdAt', 'createdAt', { unique: false });
      }

      // 陪练会话表：自增 id（v4新增）
      // 业务语义：AI陪练的构图法则/作品改进/摄影史/非遗文化等会话记录，含工具调用
      if (!db.objectStoreNames.contains('tutor_sessions')) {
        const store = db.createObjectStore('tutor_sessions', { keyPath: 'id', autoIncrement: true });
        store.createIndex('userId', 'userId', { unique: false });
        store.createIndex('sessionType', 'sessionType', { unique: false });
        store.createIndex('createdAt', 'createdAt', { unique: false });
      }

      // 合伙人申请表：自增 id（v4新增）
      // 业务语义：景区/博物馆/非遗传承人提交合作意向，含 pending/approved/rejected 审批状态
      if (!db.objectStoreNames.contains('partner_applications')) {
        const store = db.createObjectStore('partner_applications', { keyPath: 'id', autoIncrement: true });
        store.createIndex('status', 'status', { unique: false });
        store.createIndex('organizationType', 'organizationType', { unique: false });
        store.createIndex('createdAt', 'createdAt', { unique: false });
      }

      // ============================================================
      // v5 新增：管理后台表（操作日志 / 站点设置）
      // ============================================================

      // 操作日志表：自增 id（v5新增）
      // 业务语义：记录管理员全部写操作，供后台审计
      if (!db.objectStoreNames.contains('admin_logs')) {
        const store = db.createObjectStore('admin_logs', { keyPath: 'id', autoIncrement: true });
        store.createIndex('adminId', 'adminId', { unique: false });
        store.createIndex('action', 'action', { unique: false });
        store.createIndex('createdAt', 'createdAt', { unique: false });
      }

      // 站点设置表：keyPath = key（v5新增）
      // 业务语义：站点名称/公告/注册开关/AI评分开关等 KV 配置
      if (!db.objectStoreNames.contains('site_settings')) {
        db.createObjectStore('site_settings', { keyPath: 'key' });
      }

      // ============================================================
      // v6 新增：发布草稿箱表
      // ============================================================

      // 发布草稿表：自增 id（v6新增）
      // 业务语义：用户填写发布表单中途暂存，防止误关弹窗/意外退出导致内容丢失；
      // 每篇草稿保留标题/描述/分类/图片数据，可随时恢复继续发布或删除
      if (!db.objectStoreNames.contains('publish_drafts')) {
        const store = db.createObjectStore('publish_drafts', { keyPath: 'id', autoIncrement: true });
        store.createIndex('userId', 'userId', { unique: false });
        store.createIndex('updatedAt', 'updatedAt', { unique: false });
      }

      // ============================================================
      // v7 新增：文化探索足迹表
      // ============================================================

      // 文化足迹表：自增 id（v7新增）
      // 业务语义：用户对某文化主题完成 浏览作品/创作文创/AI识图 三类行为之一即点亮一条足迹；
      // 复合唯一索引 [userId, themeId, action] 保证同一行为只记一次（幂等点亮）
      if (!db.objectStoreNames.contains('culture_footprints')) {
        const store = db.createObjectStore('culture_footprints', { keyPath: 'id', autoIncrement: true });
        store.createIndex('userId', 'userId', { unique: false });
        store.createIndex('themeId', 'themeId', { unique: false });
        store.createIndex('action', 'action', { unique: false });
        store.createIndex('createdAt', 'createdAt', { unique: false });
        store.createIndex('by_user_theme_action', ['userId', 'themeId', 'action'], { unique: true });
      }

      // ============================================================
      // v8 新增：游客攻略共创表（智慧导览 P1-5 降级版）
      // ============================================================

      // 景区攻略表：自增 id（v8 新增）
      // 业务语义：游客在景区详情页提交的共创攻略；
      // 降级版无审核流：提交即展示 + 「待审核」黄角标（status 默认 'pending'）
      if (!db.objectStoreNames.contains('scenic_guides')) {
        const store = db.createObjectStore('scenic_guides', { keyPath: 'id', autoIncrement: true });
        store.createIndex('areaId', 'areaId', { unique: false });
        store.createIndex('status', 'status', { unique: false });
        store.createIndex('createdAt', 'createdAt', { unique: false });
      }

      // ============================================================
      // v9 新增：文创订单表（P3 演示级一键下单）
      // ============================================================

      // 订单表：自增 id（v9 新增）
      // 业务语义：预览弹窗「一键定制下单」的模拟支付订单（演示环境仅存本地）；
      // 携带 userId/artworkId/craftType/scene/price/status/orderNo 供运营看板聚合
      if (!db.objectStoreNames.contains('orders')) {
        const store = db.createObjectStore('orders', { keyPath: 'id', autoIncrement: true });
        store.createIndex('userId', 'userId', { unique: false });
        store.createIndex('createdAt', 'createdAt', { unique: false });
        store.createIndex('status', 'status', { unique: false }); // v10：状态机索引（新建库路径）
      }

      // ============================================================
      // v10 新增：订单物流字段（status 状态机 / timeline 时间线 / trackingNo）
      // 声明式迁移：建 status 索引 + 遍历旧记录补默认值（版本变更事务内完成）
      // ============================================================
      if (oldVersion < 10 && db.objectStoreNames.contains('orders')) {
        const store = event.target.transaction.objectStore('orders');
        if (!store.indexNames.contains('status')) {
          store.createIndex('status', 'status', { unique: false });
        }
        // 旧记录补默认：status 兜底 paid / timeline 空 / trackingNo 空串
        const curReq = store.openCursor();
        curReq.onsuccess = (ev) => {
          const cursor = ev.target.result;
          if (!cursor) return;
          const rec = cursor.value;
          let changed = false;
          if (!ORDER_STATES.includes(rec.status)) { rec.status = 'paid'; changed = true; }
          if (!Array.isArray(rec.timeline)) { rec.timeline = [{ state: rec.status, ts: rec.createdAt || new Date().toISOString(), note: '已支付' }]; changed = true; }
          if (typeof rec.trackingNo !== 'string') { rec.trackingNo = ''; changed = true; }
          if (changed) cursor.update(rec);
          cursor.continue();
        };
      }

      // ============================================================
      // v11 新增：自定义 3D 模型表（运营后台品类模型替换）
      // 双重声明式：
      //   a) if (!contains) → 全新库 / 升级库 都能走到（幂等）
      //   b) if (oldVersion < 11) → 版本显式迁移段（和 v10 同模式）
      //      保证 onupgradeneeded 回调里 store 已就绪，后续事务不会抛
      //      "One of the specified object stores was not found"
      // ============================================================

      // a) 常规声明式创建（全新库 / 升级库通用）
      if (!db.objectStoreNames.contains('custom_3d_models')) {
        const store = db.createObjectStore('custom_3d_models', { keyPath: 'id', autoIncrement: true });
        store.createIndex('productKey', 'productKey', { unique: false }); // 查询某品类绑定的模型
        store.createIndex('format', 'format', { unique: false });
        store.createIndex('createdAt', 'createdAt', { unique: false });
      }

      // b) 显式 oldVersion < 11 迁移段（版本号变化时必进，幂等索引补建）
      if (oldVersion < 11 && db.objectStoreNames.contains('custom_3d_models')) {
        const tx = event.target.transaction;
        const store = tx.objectStore('custom_3d_models');
        if (!store.indexNames.contains('productKey')) store.createIndex('productKey', 'productKey', { unique: false });
        if (!store.indexNames.contains('format')) store.createIndex('format', 'format', { unique: false });
        if (!store.indexNames.contains('createdAt')) store.createIndex('createdAt', 'createdAt', { unique: false });
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
  // 迁移作品数据：补充 tags, images, views 字段，以及 v4 新增的 AI评分状态字段
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
    // v4 新增：AI评分状态字段（向后兼容，仅在缺失时补默认值）
    if (art.aiScored === undefined || art.aiScored === null) {
      art.aiScored = false;
      changed = true;
    }
    if (art.lastAiScoreVersion === undefined || art.lastAiScoreVersion === null) {
      art.lastAiScoreVersion = null;
      changed = true;
    }
    // v5 新增：内容审核状态（默认已发布）
    if (art.status === undefined || art.status === null) {
      art.status = 'published';
      changed = true;
    }
    // description_ai_generated 字段保留（如已有则不重复添加）
    // 此处无需显式处理：若已存在则保持原值，若不存在则由具体业务在生成时写入
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
    // v5 新增：角色字段（superadmin/admin/user）
    if (!user.role) {
      user.role = user.username === 'admin' && user.isAdmin ? 'superadmin' : (user.isAdmin ? 'admin' : 'user');
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
    'scenic-photo': ['文旅摄影', '山川古迹', '城市漫步', '光影记录', '风物纪实', '人文地理'],
    'heritage-craft': ['非遗', '手作', '传统技艺', '匠心', '民艺新生', '东方美学'],
    'guofeng-art': ['国风', '水墨', '工笔', '国潮', '东方美学', '青绿山水'],
    'ai-art': ['AI生成', '人机共创', '数字转译', '算法美学', '传统文化新生', '赛博'],
    'museum-culture': ['博物', '文物', '考古美学', '国宝', '文创灵感', '馆藏'],
    'creative-design': ['文创设计', 'IP形象', '视觉设计', '包装', '国潮', '创意']
  };
  const pool = tagPool[art.category] || tagPool[normalizeCategory(art.category)] || ['文创', '东方美学'];
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
      // M6b-3 种子自带文旅主题标签优先
      const tags = (Array.isArray(art.tags) && art.tags.length) ? art.tags : _generateTagsForArtwork(art);
      const images = _generateImagesForArtwork(art);
      store.put({
        ...art,
        userId: null,
        type: 'image',
        tags,
        images,
        baseLikes: art.likes || 0,
        views: art.views || 0
      });
    });
    await new Promise((resolve, reject) => {
      tx.oncomplete = resolve;
      tx.onerror = () => reject(tx.error);
    });
  } else if (count > 0) {
    // M7 种子刷新 v2：旧库种子记录全字段同步（含 imageUrl/grade/totalScore/author）
    // + 增量补种（种子扩容如 220→244 时插入缺失 id）
    // 安全性：仅覆盖无 userId 的种子记录；新种子 id 已存在（用户作品）时跳过，绝不覆盖用户作品
    try {
      await new Promise((resolve, reject) => {
        const tx = dbInstance.transaction('artworks', 'readwrite');
        const store = tx.objectStore('artworks');
        const seedMap = new Map(ARTWORKS_SEED_DATA.map(a => [a.id, a]));
        const allReq = store.getAll();
        allReq.onsuccess = () => {
          const all = allReq.result || [];
          const existingIds = new Set(all.filter(r => r && r.id != null).map(r => r.id));
          all.forEach(rec => {
            if (rec && !rec.userId && seedMap.has(rec.id)) {
              const seed = seedMap.get(rec.id);
              if (rec.title !== seed.title || rec.imageUrl !== seed.imageUrl) {
                store.put({ ...rec,
                  title: seed.title, description: seed.description, category: seed.category,
                  tags: seed.tags || rec.tags, imageUrl: seed.imageUrl,
                  grade: seed.grade, totalScore: seed.totalScore,
                  author: seed.author || rec.author,
                  likes: seed.likes != null ? seed.likes : rec.likes,
                  baseLikes: rec.baseLikes != null ? rec.baseLikes : (seed.likes != null ? seed.likes : rec.likes),
                  views: seed.views != null ? seed.views : rec.views,
                  createdAt: seed.createdAt || rec.createdAt });
              }
            }
          });
          // M7 增量补种：缺失的种子 id 直接插入（与首次导入同构）
          seedMap.forEach((seed, id) => {
            if (!existingIds.has(id)) {
              const tags = (Array.isArray(seed.tags) && seed.tags.length) ? seed.tags : _generateTagsForArtwork(seed);
              const images = _generateImagesForArtwork(seed);
              store.put({ ...seed, userId: null, type: 'image', tags, images, baseLikes: seed.likes || 0, views: seed.views || 0 });
            }
          });
        };
        tx.oncomplete = resolve;
        tx.onerror = () => reject(tx.error);
      });
    } catch (_) { /* 种子刷新失败不阻断启动 */ }
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
      role: 'superadmin',
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
    if (req && typeof req.then === 'function') {
      // 回调为 async 函数：其内部已自行 await 完所有 IDB 请求，
      // 直接以回调的返回值/异常为准（避免把 Promise 误当 IDBRequest 挂 onsuccess 导致永久挂起）
      req.then(resolve, reject);
    } else if (req) {
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
      // M6b-1 存量数据分类归一（旧分类自动映射到文旅文创新分类）
      resolve(list.map(_normalizeArtworkCategory));
    };
    req.onerror = () => reject(req.error);
  });
}

// ============================================================
// 作品可见性（单一事实来源）
// 本地 status 四态：pending 待审核 / published 已发布 / rejected 已下架 / deleted 逻辑删除
//   · 对外公开可见（画廊/搜索/榜单/策展/他人主页）：仅 published
//   · 作者本人可见（个人中心我的作品）：排除 rejected / deleted（保留 pending，作者能看到"审核中"）
//   · 历史存量数据无 status 字段 → 视为公开可见
// 读取侧统一走 getPublicArtworks()/getUserArtworks()，避免各页面自行过滤导致视图不一致
// ============================================================
const ARTWORK_STATUS = {
  PENDING: 'pending',
  PUBLISHED: 'published',
  REJECTED: 'rejected',   // 后台下架
  DELETED: 'deleted'      // 逻辑删除（归档，可恢复）
};

// 本地状态 → 云端枚举（与 supabase/schema.sql 的 check(draft/published/offline) 对齐）
const CLOUD_STATUS_MAP = {
  pending: 'draft',
  published: 'published',
  rejected: 'offline',
  deleted: 'offline'
};

// 对外公开可见判定
function isPublicArtwork(a) {
  return !!a && (!a.status || a.status === ARTWORK_STATUS.PUBLISHED);
}

// 作者本人可见判定（后台下架/逻辑删除后不再出现在个人中心）
function isOwnerVisibleArtwork(a) {
  return !!a && a.status !== ARTWORK_STATUS.REJECTED && a.status !== ARTWORK_STATUS.DELETED;
}

// 仅返回对外公开可见的作品（对外读取侧的统一入口）
async function getPublicArtworks() {
  const all = await getAllArtworks();
  return all.filter(isPublicArtwork);
}

// 获取单个作品
async function getArtworkById(id) {
  id = Number(id);
  const rec = await runRequest('artworks', 'readonly', store => store.get(id));
  // M6b-1 读取归一：旧分类自动映射
  return rec ? _normalizeArtworkCategory(rec) : rec;
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
    category: normalizeCategory(artwork.category),
    imageUrl: artwork.imageUrl || '',
    type: artwork.type || 'image',
    status: artwork.status || 'published',
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
// 删除作品：级联清理关联数据（comments/likes/favorites/notifications/aesthetic_scores/similar_works/edit_versions/ai_crafts）
// deleteArtwork(id, { soft })
//   · soft=true → 逻辑删除（status='deleted'，保留记录供恢复）
//   · 默认物理删除（级联清理关联表）
//   · orders 不级联（交易记录归 deleteUserCascade 管）
async function deleteArtwork(id, { soft = false } = {}) {
  id = Number(id);
  const art = await getArtworkById(id);
  if (!art) throw new Error('作品不存在');

  if (soft) {
    // 逻辑删除：把状态设为 deleted
    await runRequest('artworks', 'readwrite', store => {
      store.put({ ...art, status: 'deleted', deletedAt: new Date().toISOString() });
    });
    await _updateUserWorksCount(art.userId);
    return { ok: true, soft: true };
  }

  // 物理删除：跨 store transaction 级联清理
  const cascadeStores = ['artworks', 'comments', 'likes', 'favorites', 'notifications',
    'aesthetic_scores', 'similar_works', 'edit_versions', 'ai_crafts'];
  await new Promise((resolve, reject) => {
    const tx = dbInstance.transaction(cascadeStores, 'readwrite');
    const idxs = {
      comments: tx.objectStore('comments').index('artworkId'),
      likes: tx.objectStore('likes').index('artworkId'),
      favorites: tx.objectStore('favorites').index('artworkId'),
      notifications: tx.objectStore('notifications').index('artworkId'),
      aesthetic_scores: tx.objectStore('aesthetic_scores').index('artworkId'),
      similar_works: tx.objectStore('similar_works').index('artworkId'),
      edit_versions: tx.objectStore('edit_versions').index('artworkId'),
      ai_crafts: tx.objectStore('ai_crafts').index('artworkId'),
    };
    let pending = 0;
    const done = () => { if (--pending <= 0) resolve(); };
    Object.entries(idxs).forEach(([storeName, idx]) => {
      pending++;
      const req = idx.getAllKeys(id);
      req.onsuccess = () => {
        const store = tx.objectStore(storeName);
        for (const key of req.result) store.delete(key);
        done();
      };
      req.onerror = () => { done(); };
    });
    // similar_works 双向：similarArtworkId 也指向这个 id
    pending++;
    try {
      const swIdx = tx.objectStore('similar_works').index('similarArtworkId');
      const req2 = swIdx.getAllKeys(id);
      req2.onsuccess = () => {
        for (const key of req2.result) tx.objectStore('similar_works').delete(key);
        done();
      };
      req2.onerror = () => { done(); };
    } catch { done(); }
    // 主表
    tx.objectStore('artworks').delete(id);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });

  // 清理 ai_creations 的 sourceArtworkId 引用（设 null，保留 AI 创作本身）
  try {
    await runRequest('ai_creations', 'readwrite', store => {
      const idx = store.index('sourceArtworkId');
      const req = idx.getAllKeys(id);
      req.onsuccess = () => {
        // 注意：IndexedDB 不支持 update via index，需要遍历重新 put
        idx.getAll(id).onsuccess = (e) => {
          for (const rec of e.target.result) {
            store.put({ ...rec, sourceArtworkId: null });
          }
        };
      };
    });
  } catch { /* ai_creations 可能没 sourceArtworkId 索引或 store，忽略 */ }

  // 更新用户作品数
  if (art.userId) {
    try { await _updateUserWorksCount(art.userId); } catch { /* 忽略 */ }
  }
  return { ok: true, soft: false };
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

// 获取指定用户发布的作品（严格按 userId 匹配，杜绝把同名种子作品误算作用户作品）
// 可见性收口：后台下架(rejected)/逻辑删除(deleted)的作品不再出现在个人中心与他人主页
async function getUserArtworks(userId) {
  const all = await getAllArtworks();
  const uid = _keepId(userId);
  return all.filter(a => _keepId(a.userId) === uid && a.userId != null && isOwnerVisibleArtwork(a));
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

// 根据 id 获取用户（兼容云端 UUID 与本地数字 id）
function getUserById(id) {
  id = _keepId(id);
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
  id = _keepId(id);
  const user = await getUserById(id);
  if (!user) throw new Error('用户不存在');
  const updated = { ...user, ...data, id };
  await runRequest('users', 'readwrite', store => store.put(updated));
  const { passwordHash, ...safe } = updated;
  return safe;
}

// ------------------------------------------------------------
// 云端(Supabase)用户在本地 users 表的惰性同步（幂等）
// 使艺术家主页/关注/粉丝等本地数据能力对云端用户同样可用
// ------------------------------------------------------------
async function ensureLocalUserForCloudUser(cu) {
  if (!cu || !cu.id) return null;
  const id = _keepId(cu.id);
  const existing = await runRequest('users', 'readonly', store => store.get(id)).catch(() => null);
  if (existing) return existing;

  // 用户名唯一索引冲突处理：
  // 种子数据会创建一个本地 admin（自增数字 id）；云端用户用 UUID id 登录时，
  // 二者用户名同名但 id 不同。旧实现遇到同名直接 return null（静默跳过），
  // 导致云端用户始终拿不到本地 users 记录 —— 随后 updateUser(uuid) 抛
  // 「用户不存在」，头像/昵称/简介永远写不进 users 表（历史 Bug #2 根因）。
  // 正确做法：把同名旧记录「重键」到云端 id（delete 旧键 + put 新键），
  // 既消除唯一索引冲突，又保留旧记录中的本地字段（头像/bio/计数等）。
  let conflict = null;
  try { conflict = await getUserByUsername(cu.username); } catch (e) { /* 忽略 */ }
  if (conflict && String(conflict.id) === String(id)) return conflict;

  const base = conflict ? { ...conflict } : {};
  delete base.id; // keyPath 不可就地修改，必须 delete 旧键 + put 新键
  const record = {
    ...base,
    id,
    username: cu.username || base.username || '用户',
    email: cu.email || base.email || '',
    passwordHash: base.passwordHash || '',
    avatar: base.avatar || null,
    createdAt: base.createdAt || cu.createdAt || new Date().toISOString(),
    isAdmin: !!cu.isAdmin,
    role: cu.role || (cu.isAdmin ? 'admin' : 'user'),
    // 优先采用云端权威资料（metadata），其次沿用旧记录的本地资料
    nickname: base.nickname || cu.nickname || '',
    bio: cu.bio || base.bio || '',
    followersCount: base.followersCount || 0,
    followingCount: base.followingCount || 0,
    worksCount: base.worksCount || 0
  };
  await runRequest('users', 'readwrite', store => {
    if (conflict && String(conflict.id) !== String(id)) store.delete(conflict.id);
    store.put(record);
  });
  return record;
}

// ------------------------------------------------------------
// 为种子(虚拟)艺术家惰性建立本地用户记录（幂等）
// 使关注/粉丝数据真实落库，替代原随机假数据
// ------------------------------------------------------------
async function ensureVirtualArtist(username, bio) {
  const name = String(username || '').trim();
  if (!name) return null;
  let user = null;
  try { user = await getUserByUsername(name); } catch (e) { /* 忽略 */ }
  if (user) return user;
  const record = {
    username: name,
    email: '',
    passwordHash: '',
    avatar: null,
    createdAt: new Date().toISOString(),
    isAdmin: false,
    bio: bio || '梦境艺术家，专注于创造独特的视觉体验。',
    isVirtual: true,
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

// 更新用户作品数
async function _updateUserWorksCount(userId) {
  const arts = await getUserArtworks(userId);
  await updateUser(userId, { worksCount: arts.length });
}

// ============================================================
// 管理后台 API（v5 新增）
// ============================================================

// 记录管理员操作日志
async function addAdminLog(entry) {
  const record = {
    adminId: entry && entry.adminId != null ? entry.adminId : null,
    adminName: (entry && entry.adminName) || 'unknown',
    action: (entry && entry.action) || '',
    targetType: (entry && entry.targetType) || '',
    targetId: entry && entry.targetId != null ? String(entry.targetId) : '',
    detail: (entry && entry.detail) || '',
    createdAt: new Date().toISOString()
  };
  return runRequest('admin_logs', 'readwrite', store => store.add(record));
}

// 获取操作日志（倒序，默认 100 条）
function getAdminLogs(limit) {
  limit = limit || 100;
  return new Promise((resolve, reject) => {
    const tx = dbInstance.transaction('admin_logs', 'readonly');
    const req = tx.objectStore('admin_logs').getAll();
    req.onsuccess = () => {
      const list = (req.result || []).sort((a, b) => (b.id || 0) - (a.id || 0)).slice(0, limit);
      resolve(list);
    };
    req.onerror = () => reject(req.error);
  });
}

// 清空操作日志
function clearAdminLogs() {
  return runRequest('admin_logs', 'readwrite', store => store.clear());
}

// 读取单个站点设置
async function getSiteSetting(key, defaultValue) {
  const row = await runRequest('site_settings', 'readonly', store => store.get(key));
  return row ? row.value : defaultValue;
}

// 读取全部站点设置（返回 KV 对象）
async function getAllSiteSettings() {
  const rows = await runRequest('site_settings', 'readonly', store => store.getAll());
  const obj = {};
  (rows || []).forEach(r => { obj[r.key] = r.value; });
  return obj;
}

// 写入站点设置
async function setSiteSetting(key, value) {
  const row = { key, value, updatedAt: new Date().toISOString() };
  await runRequest('site_settings', 'readwrite', store => store.put(row));
  return row;
}

// 按索引删除一个 store 中匹配值的所有行（级联删除辅助）
function _deleteRowsByIndex(storeName, indexName, value) {
  return new Promise((resolve, reject) => {
    const tx = dbInstance.transaction(storeName, 'readwrite');
    const idx = tx.objectStore(storeName).index(indexName);
    const req = idx.openCursor(IDBKeyRange.only(value));
    req.onsuccess = (e) => {
      const cursor = e.target.result;
      if (cursor) { cursor.delete(); cursor.continue(); }
    };
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

// 级联删除用户（作品/评论/点赞/收藏/关注/通知/AI记忆）
async function deleteUserCascade(id) {
  id = Number(id);
  const user = await getUserById(id);
  if (!user) throw new Error('用户不存在');
  const arts = await getUserArtworks(id);
  for (const a of arts) {
    try { await deleteArtwork(a.id); } catch (e) { /* 单条失败继续 */ }
  }
  await _deleteRowsByIndex('comments', 'userId', id);
  await _deleteRowsByIndex('likes', 'userId', id);
  await _deleteRowsByIndex('favorites', 'userId', id);
  await _deleteRowsByIndex('follows', 'followerId', id);
  await _deleteRowsByIndex('follows', 'followingId', id);
  await _deleteRowsByIndex('notifications', 'userId', id);
  await _deleteRowsByIndex('ai_memories', 'userId', id);
  try { await _deleteRowsByIndex('culture_footprints', 'userId', id); } catch (e) { /* 旧库无表 */ }
  await runRequest('users', 'readwrite', store => store.delete(id));
  return user;
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

  // 先计算点赞基线（种子作品的初始热度），确保列表/详情/个人主页计数一致
  // 基线 = 作品记录当前 likes - 已有点赞记录数（兼容旧逻辑曾把 likes 覆盖为裸计数的存量数据）
  let baseLikes = null;
  try {
    const art = await getArtworkById(artworkId);
    if (art) {
      if (art.baseLikes != null) {
        baseLikes = Number(art.baseLikes);
      } else {
        const countBefore = await getLikes(artworkId);
        baseLikes = Math.max(0, (Number(art.likes) || 0) - countBefore);
      }
    }
  } catch (e) { /* 基线计算失败不阻塞点赞 */ }

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

  // 同步作品表中的 likes 计数：基线 + 真实点赞记录数（单一数据源，列表/详情一致）
  const count = await getLikes(artworkId);
  try {
    if (baseLikes != null) {
      await updateArtwork(artworkId, { likes: baseLikes + count, baseLikes });
    } else {
      await updateArtwork(artworkId, { likes: count });
    }
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
  followerId = _keepId(followerId);
  followingId = _keepId(followingId);

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
  followerId = _keepId(followerId);
  followingId = _keepId(followingId);
  return new Promise((resolve, reject) => {
    const tx = dbInstance.transaction('follows', 'readonly');
    const req = tx.objectStore('follows').index('by_follower_following').get([followerId, followingId]);
    req.onsuccess = () => resolve(!!req.result);
    req.onerror = () => reject(req.error);
  });
}

// 云端用户 id 为 UUID 字符串：Number 强转会变 NaN 并导致 IDBIndex 查询抛 DataError
// 本函数：数字样式（含纯数字字符串）保持 Number，其余原样返回
function _keepId(v) {
  if (v === null || v === undefined || v === '') return v;
  const n = Number(v);
  return Number.isFinite(n) ? n : v;
}

// 获取粉丝数
function getFollowersCount(userId) {
  userId = _keepId(userId);
  return new Promise((resolve, reject) => {
    const tx = dbInstance.transaction('follows', 'readonly');
    const req = tx.objectStore('follows').index('followingId').count(userId);
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

// 获取关注数
function getFollowingCount(userId) {
  userId = _keepId(userId);
  return new Promise((resolve, reject) => {
    const tx = dbInstance.transaction('follows', 'readonly');
    const req = tx.objectStore('follows').index('followerId').count(userId);
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

// 获取粉丝列表（返回用户对象数组）
async function getFollowers(userId) {
  userId = _keepId(userId);
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
  userId = _keepId(userId);
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
    userId: _keepId(notification.userId),
    type: notification.type,
    fromUserId: notification.fromUserId ? _keepId(notification.fromUserId) : null,
    artworkId: notification.artworkId ? _keepId(notification.artworkId) : null,
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
  userId = _keepId(userId);
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
  userId = _keepId(userId);
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
  userId = _keepId(userId);
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

// ============================================================
// AI评分定级 API（v4新增：aesthetic_scores）
// 字段: id, artworkId, userId, scores{composition,lighting,color,clarity,theme},
//      totalScore, grade, similarWorks[], teachingComments, aiDescription, createdAt
// ============================================================

// 添加评分记录
function addAestheticScore(data) {
  const record = {
    artworkId: Number(data.artworkId),
    userId: data.userId,
    scores: data.scores || {},
    totalScore: data.totalScore || 0,
    grade: data.grade || '入门',
    similarWorks: Array.isArray(data.similarWorks) ? data.similarWorks : [],
    teachingComments: data.teachingComments || '',
    aiDescription: data.aiDescription || '',
    createdAt: new Date().toISOString()
  };
  return new Promise((resolve, reject) => {
    const tx = dbInstance.transaction('aesthetic_scores', 'readwrite');
    const req = tx.objectStore('aesthetic_scores').add(record);
    req.onsuccess = () => resolve({ id: req.result, ...record });
    req.onerror = () => reject(req.error);
  });
}

// 根据 id 获取评分记录
function getAestheticScore(id) {
  id = Number(id);
  return runRequest('aesthetic_scores', 'readonly', store => store.get(id));
}

// 获取作品的所有评分记录（按时间倒序）
function getAestheticScoresByArtwork(artworkId) {
  artworkId = Number(artworkId);
  return new Promise((resolve, reject) => {
    const tx = dbInstance.transaction('aesthetic_scores', 'readonly');
    const req = tx.objectStore('aesthetic_scores').index('artworkId').getAll(artworkId);
    req.onsuccess = () => {
      const list = req.result || [];
      list.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
      resolve(list);
    };
    req.onerror = () => reject(req.error);
  });
}

// 更新评分记录
async function updateAestheticScore(id, data) {
  id = Number(id);
  const old = await getAestheticScore(id);
  if (!old) throw new Error('评分记录不存在');
  const updated = { ...old, ...data, id };
  await runRequest('aesthetic_scores', 'readwrite', store => store.put(updated));
  return updated;
}

// 删除评分记录
function deleteAestheticScore(id) {
  id = Number(id);
  return runRequest('aesthetic_scores', 'readwrite', store => store.delete(id));
}

// ============================================================
// 同类作品对比 API（v4新增：similar_works）
// 字段: id, artworkId, similarArtworkId, similarityScore,
//      matchDimensions{composition,lighting,color,theme}, createdAt
// ============================================================

function addSimilarWork(data) {
  const record = {
    artworkId: Number(data.artworkId),
    similarArtworkId: Number(data.similarArtworkId),
    similarityScore: data.similarityScore || 0,
    matchDimensions: data.matchDimensions || {},
    createdAt: new Date().toISOString()
  };
  return new Promise((resolve, reject) => {
    const tx = dbInstance.transaction('similar_works', 'readwrite');
    const req = tx.objectStore('similar_works').add(record);
    req.onsuccess = () => resolve({ id: req.result, ...record });
    req.onerror = () => reject(req.error);
  });
}

function getSimilarWork(id) {
  id = Number(id);
  return runRequest('similar_works', 'readonly', store => store.get(id));
}

function getSimilarWorksByArtwork(artworkId) {
  artworkId = Number(artworkId);
  return new Promise((resolve, reject) => {
    const tx = dbInstance.transaction('similar_works', 'readonly');
    const req = tx.objectStore('similar_works').index('artworkId').getAll(artworkId);
    req.onsuccess = () => {
      const list = req.result || [];
      list.sort((a, b) => (b.similarityScore || 0) - (a.similarityScore || 0));
      resolve(list);
    };
    req.onerror = () => reject(req.error);
  });
}

async function updateSimilarWork(id, data) {
  id = Number(id);
  const old = await getSimilarWork(id);
  if (!old) throw new Error('同类作品记录不存在');
  const updated = { ...old, ...data, id };
  await runRequest('similar_works', 'readwrite', store => store.put(updated));
  return updated;
}

function deleteSimilarWork(id) {
  id = Number(id);
  return runRequest('similar_works', 'readwrite', store => store.delete(id));
}

// ============================================================
// 修图版本 API（v4新增：edit_versions）
// 字段: id, artworkId, userId, versionType(original/ai-edit/manual-edit),
//      parameters{exposure,contrast,saturation,sharpness,hsl}, filterName,
//      imageData, parentVersionId, createdAt
// ============================================================

function addEditVersion(data) {
  const record = {
    artworkId: Number(data.artworkId),
    userId: data.userId,
    versionType: data.versionType || 'original',
    parameters: data.parameters || {},
    filterName: data.filterName || '',
    imageData: data.imageData || '',
    parentVersionId: data.parentVersionId || null,
    createdAt: new Date().toISOString()
  };
  return new Promise((resolve, reject) => {
    const tx = dbInstance.transaction('edit_versions', 'readwrite');
    const req = tx.objectStore('edit_versions').add(record);
    req.onsuccess = () => resolve({ id: req.result, ...record });
    req.onerror = () => reject(req.error);
  });
}

function getEditVersion(id) {
  id = Number(id);
  return runRequest('edit_versions', 'readonly', store => store.get(id));
}

function getEditVersionsByArtwork(artworkId) {
  artworkId = Number(artworkId);
  return new Promise((resolve, reject) => {
    const tx = dbInstance.transaction('edit_versions', 'readonly');
    const req = tx.objectStore('edit_versions').index('artworkId').getAll(artworkId);
    req.onsuccess = () => {
      const list = req.result || [];
      list.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
      resolve(list);
    };
    req.onerror = () => reject(req.error);
  });
}

async function updateEditVersion(id, data) {
  id = Number(id);
  const old = await getEditVersion(id);
  if (!old) throw new Error('修图版本记录不存在');
  const updated = { ...old, ...data, id };
  await runRequest('edit_versions', 'readwrite', store => store.put(updated));
  return updated;
}

function deleteEditVersion(id) {
  id = Number(id);
  return runRequest('edit_versions', 'readwrite', store => store.delete(id));
}

// ============================================================
// 发布草稿箱 API（v6新增：publish_drafts）
// 字段: id, userId, title, description, category,
//       imageData(base64), mediaType(image/video), sourceArtworkId,
//       createdAt, updatedAt
// ============================================================

function addPublishDraft(data) {
  const now = new Date().toISOString();
  const record = {
    userId: data.userId,
    title: data.title || '',
    description: data.description || '',
    category: data.category || null,
    imageData: data.imageData || '',
    mediaType: data.mediaType || 'image',
    sourceArtworkId: data.sourceArtworkId || null,
    createdAt: now,
    updatedAt: now
  };
  return new Promise((resolve, reject) => {
    const tx = dbInstance.transaction('publish_drafts', 'readwrite');
    const req = tx.objectStore('publish_drafts').add(record);
    req.onsuccess = () => resolve({ id: req.result, ...record });
    req.onerror = () => reject(req.error);
  });
}

function getPublishDrafts(userId) {
  return new Promise((resolve, reject) => {
    const tx = dbInstance.transaction('publish_drafts', 'readonly');
    const req = tx.objectStore('publish_drafts').index('userId').getAll(userId);
    req.onsuccess = () => resolve((req.result || []).sort((a, b) => (b.updatedAt || '').localeCompare(a.updatedAt || '')));
    req.onerror = () => reject(req.error);
  });
}

function updatePublishDraft(id, data) {
  return new Promise((resolve, reject) => {
    const tx = dbInstance.transaction('publish_drafts', 'readwrite');
    const store = tx.objectStore('publish_drafts');
    const getReq = store.get(id);
    getReq.onsuccess = () => {
      const old = getReq.result;
      if (!old) return reject(new Error('草稿不存在或已被删除'));
      const updated = { ...old, ...data, updatedAt: new Date().toISOString() };
      const putReq = store.put(updated);
      putReq.onsuccess = () => resolve(updated);
      putReq.onerror = () => reject(putReq.error);
    };
    getReq.onerror = () => reject(getReq.error);
  });
}

function deletePublishDraft(id) {
  return runRequest('publish_drafts', 'readwrite', store => store.delete(id));
}

// ============================================================
// AI文创衍生品 API（v4新增：ai_crafts）
// 字段: id, artworkId, userId, craftType(wallpaper/poster/collectible/postcard/template),
//      styleTheme(国风/非遗纹样/现代极简), imageData, aiPrompt, createdAt
// ============================================================

function addAiCraft(data) {
  const record = {
    artworkId: Number(data.artworkId),
    userId: data.userId,
    craftType: data.craftType || 'wallpaper',
    styleTheme: data.styleTheme || '现代极简',
    imageData: data.imageData || '',
    aiPrompt: data.aiPrompt || '',
    createdAt: new Date().toISOString()
  };
  return new Promise((resolve, reject) => {
    const tx = dbInstance.transaction('ai_crafts', 'readwrite');
    const req = tx.objectStore('ai_crafts').add(record);
    req.onsuccess = () => resolve({ id: req.result, ...record });
    req.onerror = () => reject(req.error);
  });
}

function getAiCraft(id) {
  id = Number(id);
  return runRequest('ai_crafts', 'readonly', store => store.get(id));
}

function getAiCraftsByArtwork(artworkId) {
  artworkId = Number(artworkId);
  return new Promise((resolve, reject) => {
    const tx = dbInstance.transaction('ai_crafts', 'readonly');
    const req = tx.objectStore('ai_crafts').index('artworkId').getAll(artworkId);
    req.onsuccess = () => {
      const list = req.result || [];
      list.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
      resolve(list);
    };
    req.onerror = () => reject(req.error);
  });
}

// 按用户查询其所有文创衍生品（数字文创馆用）
// userId 可为数字或字符串；空 userId 返回空数组
function getAiCraftsByUser(userId) {
  if (userId === null || userId === undefined || userId === '') return Promise.resolve([]);
  return new Promise((resolve, reject) => {
    const tx = dbInstance.transaction('ai_crafts', 'readonly');
    const req = tx.objectStore('ai_crafts').index('userId').getAll(userId);
    req.onsuccess = () => {
      const list = req.result || [];
      list.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
      resolve(list);
    };
    req.onerror = () => reject(req.error);
  });
}

async function updateAiCraft(id, data) {
  id = Number(id);
  const old = await getAiCraft(id);
  if (!old) throw new Error('文创衍生品记录不存在');
  const updated = { ...old, ...data, id };
  await runRequest('ai_crafts', 'readwrite', store => store.put(updated));
  return updated;
}

function deleteAiCraft(id) {
  id = Number(id);
  return runRequest('ai_crafts', 'readwrite', store => store.delete(id));
}

// ============================================================
// 智能策展展馆 API（v4新增：curated_halls）
// 字段: id, name, description, theme(非遗/地域/季节光影等), artworkIds[],
//      aiGeneratedSummary, status(draft/published), createdBy,
//      publishedAt, createdAt
// ============================================================

function addCuratedHall(data) {
  const record = {
    name: data.name || '未命名展馆',
    description: data.description || '',
    theme: data.theme || '',
    artworkIds: Array.isArray(data.artworkIds) ? data.artworkIds : [],
    aiGeneratedSummary: data.aiGeneratedSummary || '',
    status: data.status || 'draft',
    createdBy: data.createdBy || null,
    publishedAt: data.publishedAt || null,
    createdAt: new Date().toISOString()
  };
  return new Promise((resolve, reject) => {
    const tx = dbInstance.transaction('curated_halls', 'readwrite');
    const req = tx.objectStore('curated_halls').add(record);
    req.onsuccess = () => resolve({ id: req.result, ...record });
    req.onerror = () => reject(req.error);
  });
}

function getCuratedHall(id) {
  id = Number(id);
  return runRequest('curated_halls', 'readonly', store => store.get(id));
}

function getCuratedHallsByTheme(theme) {
  return new Promise((resolve, reject) => {
    const tx = dbInstance.transaction('curated_halls', 'readonly');
    const req = tx.objectStore('curated_halls').index('theme').getAll(theme);
    req.onsuccess = () => {
      const list = req.result || [];
      list.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
      resolve(list);
    };
    req.onerror = () => reject(req.error);
  });
}

async function updateCuratedHall(id, data) {
  id = Number(id);
  const old = await getCuratedHall(id);
  if (!old) throw new Error('策展展馆记录不存在');
  const updated = { ...old, ...data, id };
  // 发布时自动写入 publishedAt
  if (data.status === 'published' && !updated.publishedAt) {
    updated.publishedAt = new Date().toISOString();
  }
  await runRequest('curated_halls', 'readwrite', store => store.put(updated));
  return updated;
}

function deleteCuratedHall(id) {
  id = Number(id);
  return runRequest('curated_halls', 'readwrite', store => store.delete(id));
}

// ============================================================
// 陪练会话 API（v4新增：tutor_sessions）
// 字段: id, userId, sessionType(构图法则/作品改进/摄影史/非遗文化),
//      messages[{role,content,timestamp,toolCall}], artworkId, createdAt
// ============================================================

function addTutorSession(data) {
  const record = {
    userId: data.userId,
    sessionType: data.sessionType || '构图法则',
    messages: Array.isArray(data.messages) ? data.messages : [],
    artworkId: data.artworkId != null ? Number(data.artworkId) : null,
    createdAt: new Date().toISOString()
  };
  return new Promise((resolve, reject) => {
    const tx = dbInstance.transaction('tutor_sessions', 'readwrite');
    const req = tx.objectStore('tutor_sessions').add(record);
    req.onsuccess = () => resolve({ id: req.result, ...record });
    req.onerror = () => reject(req.error);
  });
}

function getTutorSession(id) {
  id = Number(id);
  return runRequest('tutor_sessions', 'readonly', store => store.get(id));
}

function getTutorSessionsByUser(userId) {
  return new Promise((resolve, reject) => {
    const tx = dbInstance.transaction('tutor_sessions', 'readonly');
    const req = tx.objectStore('tutor_sessions').index('userId').getAll(userId);
    req.onsuccess = () => {
      const list = req.result || [];
      list.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
      resolve(list);
    };
    req.onerror = () => reject(req.error);
  });
}

async function updateTutorSession(id, data) {
  id = Number(id);
  const old = await getTutorSession(id);
  if (!old) throw new Error('陪练会话记录不存在');
  const updated = { ...old, ...data, id };
  await runRequest('tutor_sessions', 'readwrite', store => store.put(updated));
  return updated;
}

function deleteTutorSession(id) {
  id = Number(id);
  return runRequest('tutor_sessions', 'readwrite', store => store.delete(id));
}

// ============================================================
// 合伙人申请 API（v4新增：partner_applications）
// 字段: id, organizationName, organizationType(景区/博物馆/非遗传承人),
//      contactName, contactPhone, contactEmail, cooperationIntent,
//      status(pending/approved/rejected), reviewedBy, reviewedAt, createdAt
// ============================================================

function addPartnerApplication(data) {
  const record = {
    organizationName: data.organizationName || '',
    organizationType: data.organizationType || '',
    contactName: data.contactName || '',
    contactPhone: data.contactPhone || '',
    contactEmail: data.contactEmail || '',
    cooperationIntent: data.cooperationIntent || '',
    status: data.status || 'pending',
    reviewedBy: data.reviewedBy || null,
    reviewedAt: data.reviewedAt || null,
    createdAt: new Date().toISOString()
  };
  return new Promise((resolve, reject) => {
    const tx = dbInstance.transaction('partner_applications', 'readwrite');
    const req = tx.objectStore('partner_applications').add(record);
    req.onsuccess = () => resolve({ id: req.result, ...record });
    req.onerror = () => reject(req.error);
  });
}

function getPartnerApplication(id) {
  id = Number(id);
  return runRequest('partner_applications', 'readonly', store => store.get(id));
}

function getPartnerApplicationsByStatus(status) {
  return new Promise((resolve, reject) => {
    const tx = dbInstance.transaction('partner_applications', 'readonly');
    const req = tx.objectStore('partner_applications').index('status').getAll(status);
    req.onsuccess = () => {
      const list = req.result || [];
      list.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
      resolve(list);
    };
    req.onerror = () => reject(req.error);
  });
}

async function updatePartnerApplication(id, data) {
  id = Number(id);
  const old = await getPartnerApplication(id);
  if (!old) throw new Error('合伙人申请记录不存在');
  const updated = { ...old, ...data, id };
  // 审批时自动写入 reviewedAt
  if ((data.status === 'approved' || data.status === 'rejected') && !updated.reviewedAt) {
    updated.reviewedAt = new Date().toISOString();
  }
  await runRequest('partner_applications', 'readwrite', store => store.put(updated));
  return updated;
}

function deletePartnerApplication(id) {
  id = Number(id);
  return runRequest('partner_applications', 'readwrite', store => store.delete(id));
}

// ============================================================
// 文化探索足迹 API（v7 新增）
// ============================================================

// 记录足迹（幂等点亮：同一 user+theme+action 只记一次）
// 返回 true=本次新点亮 / false=此前已点亮
async function recordFootprint(userId, themeId, action, extra = {}) {
  const key = [userId, themeId, action];
  const existing = await new Promise((resolve, reject) => {
    const tx = dbInstance.transaction('culture_footprints', 'readonly');
    const req = tx.objectStore('culture_footprints').index('by_user_theme_action').get(key);
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
  if (existing) return false;

  const record = {
    userId: userId,
    themeId: String(themeId),
    action: String(action),
    createdAt: new Date().toISOString(),
    ...extra
  };
  await runRequest('culture_footprints', 'readwrite', store => store.add(record));
  return true;
}

// 获取用户全部足迹（按时间正序，便于足迹地图按探索先后排列）
function getFootprintsByUser(userId) {
  return new Promise((resolve, reject) => {
    const tx = dbInstance.transaction('culture_footprints', 'readonly');
    const req = tx.objectStore('culture_footprints').index('userId').getAll(userId);
    req.onsuccess = () => {
      const list = req.result || [];
      list.sort((a, b) => String(a.createdAt).localeCompare(String(b.createdAt)));
      resolve(list);
    };
    req.onerror = () => reject(req.error);
  });
}

// 获取用户在某文化主题下已点亮的行为集合（用于徽章分级：铜/银/金）
async function getFootprintActions(userId, themeId) {
  const list = await getFootprintsByUser(userId);
  return list.filter(r => r.themeId === String(themeId)).map(r => r.action);
}

// 清空用户足迹（隐私/管理场景）
function clearFootprintsByUser(userId) {
  return _deleteRowsByIndex('culture_footprints', 'userId', userId);
}

// ============================================================
// 游客攻略共创 API（v8 新增，智慧导览 P1-5 降级版）
// ============================================================

// 发布攻略（降级版：提交即展示，status 默认 'pending' 待审核角标）
// username 取调用方传入（页面侧用 window.currentUser?.username || '游客' 兜底）
function addScenicGuide({ areaId, username, title, content } = {}) {
  const record = {
    areaId: String(areaId || ''),
    username: String(username || '游客'),
    title: String(title || '').trim(),
    content: String(content || '').trim(),
    status: 'pending',
    createdAt: new Date().toISOString()
  };
  return new Promise((resolve, reject) => {
    const tx = dbInstance.transaction('scenic_guides', 'readwrite');
    const req = tx.objectStore('scenic_guides').add(record);
    req.onsuccess = () => resolve({ id: req.result, ...record });
    req.onerror = () => reject(req.error);
  });
}

// 按景区读取攻略（createdAt 倒序，最多 limit 条，默认 10）
function getScenicGuidesByArea(areaId, limit = 10) {
  return new Promise((resolve, reject) => {
    const tx = dbInstance.transaction('scenic_guides', 'readonly');
    const req = tx.objectStore('scenic_guides').index('areaId').getAll(String(areaId));
    req.onsuccess = () => {
      const list = (req.result || [])
        .sort((a, b) => String(b.createdAt).localeCompare(String(a.createdAt)))
        .slice(0, limit);
      resolve(list);
    };
    req.onerror = () => reject(req.error);
  });
}

// ============================================================
// 文创订单 API（v9 新增，P3 演示级一键下单）
// ============================================================

// 创建订单（演示级模拟支付：成功即 status='paid'；未登录 userId 用 'guest'）
// orderNo 由调用方生成（DC+年月日+4位确定性随机），此处只负责落库
// v10 扩展：product（具体落地产品名）/ timeline（物流时间线，初始 paid 节点）/ trackingNo
function addOrder({ userId, artworkId, craftType, product, scene, price, status, orderNo, timeline, trackingNo, material, size, receiver, phone, address } = {}) {
  const st = ORDER_STATES.includes(status) ? status : 'paid';
  const record = {
    userId: userId != null ? userId : 'guest',
    artworkId: String(artworkId || ''),
    craftType: String(craftType || ''),
    product: String(product || ''), // v10：AI 推荐/用户选定的具体落地产品名（品类无关）
    scene: scene != null ? scene : 1,
    price: Number(price) || 0,
    // v11：规格（材质/尺寸）与收货信息，供订单详情展示
    material: String(material || ''),
    size: String(size || ''),
    receiver: String(receiver || ''),
    phone: String(phone || ''),
    address: String(address || ''),
    status: st,
    orderNo: String(orderNo || ''),
    // v10：物流时间线（JSON 数组 [{state, ts, note}]，首个节点 = 当前状态）
    timeline: Array.isArray(timeline) && timeline.length
      ? timeline
      : [{ state: st, ts: new Date().toISOString(), note: ORDER_STATE_LABELS[st] }],
    trackingNo: String(trackingNo || ''), // v10：物流单号（shipped 态生成）
    createdAt: new Date().toISOString()
  };
  return new Promise((resolve, reject) => {
    const tx = dbInstance.transaction('orders', 'readwrite');
    const req = tx.objectStore('orders').add(record);
    req.onsuccess = () => resolve({ id: req.result, ...record });
    req.onerror = () => reject(req.error);
  });
}

// v10 新增：推进订单物流状态机（5 态顺序流转，不可跳跃/回退）
// updateOrderStatus(id, { status, note })
//   · status 省略 → 自动推进到下一态（演示快进按钮即用此语义）
//   · status 显式给定 → 仅接受顺序前进（index ≥ 当前），delivered 为终态
//   · shipped 态自动生成模拟物流单号（SF + 13 位数字）
// 返回更新后的完整订单记录；已签收/非法状态返回 null
function updateOrderStatus(id, { status, note } = {}) {
  return new Promise((resolve, reject) => {
    const tx = dbInstance.transaction('orders', 'readwrite');
    const store = tx.objectStore('orders');
    const getReq = store.get(id);
    getReq.onsuccess = () => {
      const rec = getReq.result;
      if (!rec) { resolve(null); return; }
      const curIdx = Math.max(0, ORDER_STATES.indexOf(rec.status));
      let nextIdx;
      if (status == null) {
        nextIdx = curIdx + 1; // 自动快进一态
      } else {
        if (!ORDER_STATES.includes(status)) { resolve(null); return; }
        nextIdx = ORDER_STATES.indexOf(status);
        if (nextIdx < curIdx) { resolve(null); return; } // 拒绝回退
      }
      if (nextIdx >= ORDER_STATES.length || nextIdx === curIdx) { resolve(rec); return; } // 终态/原地不动
      const nextState = ORDER_STATES[nextIdx];
      rec.status = nextState;
      if (!Array.isArray(rec.timeline)) rec.timeline = [];
      rec.timeline.push({
        state: nextState,
        ts: new Date().toISOString(),
        note: String(note || ORDER_STATE_LABELS[nextState])
      });
      if (nextState === 'shipped' && !rec.trackingNo) {
        // 模拟物流单号：SF + 13 位（时间戳 10 位 + 3 位随机，仅演示用）
        rec.trackingNo = 'SF' + String(Date.now()) + String(100 + Math.floor(Math.random() * 900));
      }
      const putReq = store.put(rec);
      putReq.onsuccess = () => resolve(rec);
      putReq.onerror = () => reject(putReq.error);
    };
    getReq.onerror = () => reject(getReq.error);
  });
}

// v11 新增：管理员编辑订单收货信息 / 物流单号（任意阶段可改，不影响状态机）
// updateOrderAddr(id, { receiver, phone, address, trackingNo })
function updateOrderAddr(id, { receiver, phone, address, trackingNo } = {}) {
  return new Promise((resolve, reject) => {
    const tx = dbInstance.transaction('orders', 'readwrite');
    const store = tx.objectStore('orders');
    const getReq = store.get(id);
    getReq.onsuccess = () => {
      const rec = getReq.result;
      if (!rec) { resolve(null); return; }
      if (receiver != null) rec.receiver = receiver;
      if (phone != null) rec.phone = phone;
      if (address != null) rec.address = address;
      if (trackingNo != null) rec.trackingNo = trackingNo;
      const putReq = store.put(rec);
      putReq.onsuccess = () => resolve(rec);
      putReq.onerror = () => reject(putReq.error);
    };
    getReq.onerror = () => reject(getReq.error);
  });
}

// 读取全部订单（createdAt 倒序，供运营看板聚合）
function getAllOrders() {
  return new Promise((resolve, reject) => {
    const tx = dbInstance.transaction('orders', 'readonly');
    const req = tx.objectStore('orders').getAll();
    req.onsuccess = () => {
      const list = (req.result || [])
        .sort((a, b) => String(b.createdAt).localeCompare(String(a.createdAt)));
      resolve(list);
    };
    req.onerror = () => reject(req.error);
  });
}

// ============================================================
// v11 新增：自定义 3D 模型 API（运营后台品类模型替换）
// 校验常量（const 暴露给前端统一使用）
// ============================================================
const CUSTOM_3D_VALIDATION = {
  MAX_SIZE: 100 * 1024 * 1024,  // 100MB
  MAX_TRI: 100000,              // 10万面 — 本地demo优先预览效果（AI生成模型默认3~8万面）
  ALLOWED_FORMATS: ['glb', 'fbx', 'usdz']
};

// 表是否存在（前置守卫：避免 upgrade 竞争时事务抛 "object stores was not found"）
function _hasCustom3dStore() {
  return !!(dbInstance && dbInstance.objectStoreNames && dbInstance.objectStoreNames.contains('custom_3d_models'));
}

// addCustom3dModel({ name, file(ArrayBuffer), size, format, triCount, productKey, uploadedBy, previewImage })
//   · 基础校验：格式合法性、大小 ≤10MB、面数 ≤2000、productKey 非空
//   · 前端（three.js 环境）需先调用 validateCustom3dModelFile 做解析级面数校验，再传入 triCount
function addCustom3dModel({ name, file, size, format, triCount, productKey, uploadedBy, previewImage } = {}) {
  // 前置守卫：表不存在（极早期 init / upgrade 竞争）→ 友好降级不崩
  if (!_hasCustom3dStore()) {
    return Promise.reject(new Error('数据库版本过低，请刷新页面升级（custom_3d_models 表尚未就绪）'));
  }
  // 基础校验
  const fmt = String(format || '').toLowerCase();
  if (!CUSTOM_3D_VALIDATION.ALLOWED_FORMATS.includes(fmt)) {
    throw new Error(`格式不支持：${format || '(空)'}，仅允许 glb / fbx / usdz（推荐 glb）`);
  }
  if (!(file instanceof ArrayBuffer)) {
    throw new Error('模型文件必须是 ArrayBuffer（Blob.arrayBuffer() 产物）');
  }
  const sz = size != null ? Number(size) : file.byteLength;
  if (sz > CUSTOM_3D_VALIDATION.MAX_SIZE) {
    throw new Error(`文件过大：${(sz / 1024 / 1024).toFixed(2)}MB，上限 ${CUSTOM_3D_VALIDATION.MAX_SIZE / 1024 / 1024}MB`);
  }
  if (!productKey) {
    throw new Error('必须绑定品类（productKey 不可为空）');
  }
  const tri = Number(triCount) || 0;
  if (tri > CUSTOM_3D_VALIDATION.MAX_TRI) {
    throw new Error(`面数过多：${tri}，上限 ${CUSTOM_3D_VALIDATION.MAX_TRI}（建议使用低面数模型保证 WebGL 流畅）`);
  }

  // 防御：previewImage 必须足够大（空 PNG dataURL 只有 ~200B，正常缩略图 ≥ 2KB）
  // 根因拦截：preserveDrawingBuffer 缺失导致 toDataURL 取到空白帧
  let safePreview = '';
  if (previewImage) {
    const s = String(previewImage);
    if (s.length >= 2000 && s.startsWith('data:image/')) {
      safePreview = s;
    } else {
      console.warn('[DB C3D] 拒绝写入可疑 previewImage（长度 ' + s.length + '），可在后台用「立即补齐缩略图」重建');
    }
  }

  const record = {
    name: String(name || `自定义模型-${new Date().toISOString().slice(0, 10)}`),
    file,
    size: sz,
    format: fmt,
    triCount: tri,
    productKey: String(productKey),
    uploadedBy: String(uploadedBy || 'admin'),
    previewImage: safePreview,
    createdAt: new Date().toISOString()
  };
  return new Promise((resolve, reject) => {
    const tx = dbInstance.transaction('custom_3d_models', 'readwrite');
    const req = tx.objectStore('custom_3d_models').add(record);
    req.onsuccess = () => resolve({ id: req.result, ...record, file: undefined }); // 返回不含 file 的元数据
    req.onerror = () => reject(req.error);
  });
}

// getAllCustom3dModels() —— 全部模型（含 file 原始数据，前端加载时用）
function getAllCustom3dModels() {
  // 前置守卫：表不存在 → 空数组降级
  if (!_hasCustom3dStore()) return Promise.resolve([]);
  return new Promise((resolve, reject) => {
    const tx = dbInstance.transaction('custom_3d_models', 'readonly');
    const req = tx.objectStore('custom_3d_models').getAll();
    req.onsuccess = () => {
      const list = (req.result || [])
        .sort((a, b) => String(b.createdAt).localeCompare(String(a.createdAt)));
      resolve(list);
    };
    req.onerror = () => reject(req.error);
  });
}

// getCustom3dModelsMeta() —— 仅元数据（管理后台列表用，省略 file 减小 payload）
function getCustom3dModelsMeta() {
  return getAllCustom3dModels().then(list =>
    list.map(({ file, ...meta }) => meta)
  );
}

// getCustom3dModelByProductKey(productKey) —— 某品类绑定的最新模型（含 file）
function getCustom3dModelByProductKey(productKey) {
  // 前置守卫
  if (!_hasCustom3dStore()) return Promise.resolve(null);
  return new Promise((resolve, reject) => {
    const tx = dbInstance.transaction('custom_3d_models', 'readonly');
    const req = tx.objectStore('custom_3d_models').index('productKey').getAll(String(productKey));
    req.onsuccess = () => {
      const list = req.result || [];
      if (list.length === 0) { resolve(null); return; }
      // 取最新创建的一条
      list.sort((a, b) => String(b.createdAt).localeCompare(String(a.createdAt)));
      resolve(list[0]);
    };
    req.onerror = () => reject(req.error);
  });
}

// updateCustom3dModel(id, { name, productKey, previewImage }) —— 仅元数据更新（file 不可热替换，需删了重传）
function updateCustom3dModel(id, data) {
  // 前置守卫
  if (!_hasCustom3dStore()) {
    return Promise.reject(new Error('数据库版本过低，请刷新页面升级（custom_3d_models 表尚未就绪）'));
  }
  id = Number(id);
  return runRequest('custom_3d_models', 'readwrite', async (store) => {
    const rec = await new Promise((res, rej) => {
      const r = store.get(id);
      r.onsuccess = () => res(r.result);
      r.onerror = () => rej(r.error);
    });
    if (!rec) throw new Error('自定义 3D 模型不存在');
    const updated = { ...rec, id };
    if (data.name != null) updated.name = String(data.name);
    if (data.productKey != null) updated.productKey = String(data.productKey);
    if (data.previewImage != null) updated.previewImage = String(data.previewImage);
    if (data.uploadedBy != null) updated.uploadedBy = String(data.uploadedBy);
    await new Promise((res, rej) => {
      const r = store.put(updated);
      r.onsuccess = () => res();
      r.onerror = () => rej(r.error);
    });
    const { file, ...meta } = updated;
    return meta;
  });
}

// deleteCustom3dModel(id) —— 删除模型（解绑品类）
function deleteCustom3dModel(id) {
  if (!_hasCustom3dStore()) {
    return Promise.reject(new Error('数据库版本过低，请刷新页面升级（custom_3d_models 表尚未就绪）'));
  }
  id = Number(id);
  return runRequest('custom_3d_models', 'readwrite', store => store.delete(id));
}

// 导入记录净化：与 addCustom3dModel 同源的校验（格式/大小/面数），
// 但放宽 productKey（备份里允许存在未绑定模型），并保留原 createdAt。
function _sanitizeImportedC3d(r) {
  if (!r || typeof r !== 'object') return null;
  const fmt = String(r.format || '').toLowerCase();
  if (!CUSTOM_3D_VALIDATION.ALLOWED_FORMATS.includes(fmt)) return null;
  const file = r.file;
  if (!(file instanceof ArrayBuffer)) return null;
  const sz = file.byteLength;                       // 以真实字节为准（防 metadata 被篡改）
  if (!(sz > 0) || sz > CUSTOM_3D_VALIDATION.MAX_SIZE) return null;
  const tri = Number(r.triCount) || 0;
  if (tri > CUSTOM_3D_VALIDATION.MAX_TRI) return null;
  const preview = String(r.previewImage || '');
  const safePreview = preview.length >= 2000 && preview.startsWith('data:image/') ? preview : '';
  return {
    name: String(r.name || `导入模型-${new Date().toISOString().slice(0, 10)}`).slice(0, 80),
    file, size: sz, format: fmt, triCount: tri,
    productKey: String(r.productKey || ''),
    uploadedBy: String(r.uploadedBy || 'import'),
    previewImage: safePreview,
    createdAt: String(r.createdAt || new Date().toISOString())
  };
}

// importCustom3dModels(records) —— 批量恢复（备份导入）
//   · 逐条走 _sanitizeImportedC3d 校验；保留原 createdAt（列表顺序/绑定语义不被导入打乱）
//   · 去重键 createdAt|name|size：已存在则跳过，避免重复导入产生副本
//   · 返回 { added, skipped, invalid }
function importCustom3dModels(records) {
  if (!_hasCustom3dStore()) {
    return Promise.reject(new Error('数据库版本过低，请刷新页面升级（custom_3d_models 表尚未就绪）'));
  }
  const list = Array.isArray(records) ? records : [];
  const keyOf = (r) => `${r.createdAt || ''}|${r.name || ''}|${Number(r.size) || 0}`;
  return new Promise((resolve, reject) => {
    const tx = dbInstance.transaction('custom_3d_models', 'readwrite');
    const store = tx.objectStore('custom_3d_models');
    const existing = new Set();
    let added = 0, skipped = 0, invalid = 0;
    const cur = store.openCursor();
    cur.onsuccess = (ev) => {
      const c = ev.target.result;
      if (c) { existing.add(keyOf(c.value)); c.continue(); return; }
      // 游标遍历完毕 → 逐条校验并写入（同一事务内追加请求，事务保持存活至全部完成）
      for (const r of list) {
        const rec = _sanitizeImportedC3d(r);
        if (!rec) { invalid++; continue; }
        if (existing.has(keyOf(rec))) { skipped++; continue; }
        store.add(rec);
        existing.add(keyOf(rec));
        added++;
      }
      tx.oncomplete = () => resolve({ added, skipped, invalid });
    };
    cur.onerror = () => reject(cur.error);
    tx.onerror = () => reject(tx.error);
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
// 作品可见性收口（对外读取侧统一入口 + 状态常量/云端映射）
window.getPublicArtworks = getPublicArtworks;
window.ARTWORK_STATUS = ARTWORK_STATUS;
window.CLOUD_STATUS_MAP = CLOUD_STATUS_MAP;
window.getArtworksByAuthorName = getArtworksByAuthorName;
window.getArtworksByTag = getArtworksByTag;
window.getAllUsers = getAllUsers;
window.getUserById = getUserById;
window.getUserByUsername = getUserByUsername;
window.registerUser = registerUser;
window.loginUser = loginUser;
window.updateUser = updateUser;
window.ensureLocalUserForCloudUser = ensureLocalUserForCloudUser;
window.ensureVirtualArtist = ensureVirtualArtist;
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
// v4 新增：7个表的 CRUD API
window.addAestheticScore = addAestheticScore;
window.getAestheticScore = getAestheticScore;
window.getAestheticScoresByArtwork = getAestheticScoresByArtwork;
window.updateAestheticScore = updateAestheticScore;
window.deleteAestheticScore = deleteAestheticScore;
window.addSimilarWork = addSimilarWork;
window.getSimilarWork = getSimilarWork;
window.getSimilarWorksByArtwork = getSimilarWorksByArtwork;
window.updateSimilarWork = updateSimilarWork;
window.deleteSimilarWork = deleteSimilarWork;
window.addEditVersion = addEditVersion;
window.getEditVersion = getEditVersion;
window.getEditVersionsByArtwork = getEditVersionsByArtwork;
window.updateEditVersion = updateEditVersion;
window.deleteEditVersion = deleteEditVersion;
window.addPublishDraft = addPublishDraft;
window.getPublishDrafts = getPublishDrafts;
window.updatePublishDraft = updatePublishDraft;
window.deletePublishDraft = deletePublishDraft;
window.addAiCraft = addAiCraft;
window.getAiCraft = getAiCraft;
window.getAiCraftsByArtwork = getAiCraftsByArtwork;
window.getAiCraftsByUser = getAiCraftsByUser;
window.updateAiCraft = updateAiCraft;
window.deleteAiCraft = deleteAiCraft;
window.addCuratedHall = addCuratedHall;
window.getCuratedHall = getCuratedHall;
window.getCuratedHallsByTheme = getCuratedHallsByTheme;
window.updateCuratedHall = updateCuratedHall;
window.deleteCuratedHall = deleteCuratedHall;
window.addTutorSession = addTutorSession;
window.getTutorSession = getTutorSession;
window.getTutorSessionsByUser = getTutorSessionsByUser;
window.updateTutorSession = updateTutorSession;
window.deleteTutorSession = deleteTutorSession;
window.addPartnerApplication = addPartnerApplication;
window.getPartnerApplication = getPartnerApplication;
window.getPartnerApplicationsByStatus = getPartnerApplicationsByStatus;
window.updatePartnerApplication = updatePartnerApplication;
window.deletePartnerApplication = deletePartnerApplication;
// v5 新增：管理后台 API
window.addAdminLog = addAdminLog;
window.getAdminLogs = getAdminLogs;
window.clearAdminLogs = clearAdminLogs;
window.getSiteSetting = getSiteSetting;
window.getAllSiteSettings = getAllSiteSettings;
window.setSiteSetting = setSiteSetting;
window.deleteUserCascade = deleteUserCascade;
// v7 新增：文化探索足迹 API
window.recordFootprint = recordFootprint;
window.getFootprintsByUser = getFootprintsByUser;
window.getFootprintActions = getFootprintActions;
window.clearFootprintsByUser = clearFootprintsByUser;
// v8 新增：游客攻略共创 API（智慧导览 P1-5）
window.addScenicGuide = addScenicGuide;
window.getScenicGuidesByArea = getScenicGuidesByArea;
// v9 新增：文创订单 API（P3 演示级一键下单）
window.addOrder = addOrder;
window.getAllOrders = getAllOrders;
window.updateOrderStatus = updateOrderStatus;
window.updateOrderAddr = updateOrderAddr;
window.ORDER_STATES = ORDER_STATES;
window.ORDER_STATE_LABELS = ORDER_STATE_LABELS;
// v11 新增：自定义 3D 模型 API（运营后台品类模型替换）
window.addCustom3dModel = addCustom3dModel;
window.getAllCustom3dModels = getAllCustom3dModels;
window.getCustom3dModelsMeta = getCustom3dModelsMeta;
window.getCustom3dModelByProductKey = getCustom3dModelByProductKey;
window.updateCustom3dModel = updateCustom3dModel;
window.deleteCustom3dModel = deleteCustom3dModel;
window.importCustom3dModels = importCustom3dModels;
window.CUSTOM_3D_VALIDATION = CUSTOM_3D_VALIDATION;

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
  // 作品可见性收口（对外读取侧统一入口 + 状态常量/云端映射）
  getPublicArtworks,
  isPublicArtwork,
  isOwnerVisibleArtwork,
  ARTWORK_STATUS,
  CLOUD_STATUS_MAP,
  getArtworksByAuthorName,
  getArtworksByTag,
  getAllUsers,
  getUserById,
  getUserByUsername,
  registerUser,
  loginUser,
  updateUser,
  ensureLocalUserForCloudUser,
  ensureVirtualArtist,
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
  getMemoryCount,
  // v4 新增：AI评分定级
  addAestheticScore,
  getAestheticScore,
  getAestheticScoresByArtwork,
  updateAestheticScore,
  deleteAestheticScore,
  // v4 新增：同类作品对比
  addSimilarWork,
  getSimilarWork,
  getSimilarWorksByArtwork,
  updateSimilarWork,
  deleteSimilarWork,
  // v4 新增：修图版本
  addEditVersion,
  getEditVersion,
  getEditVersionsByArtwork,
  updateEditVersion,
  deleteEditVersion,
  addPublishDraft,
  getPublishDrafts,
  updatePublishDraft,
  deletePublishDraft,
  // v4 新增：AI文创衍生品
  addAiCraft,
  getAiCraft,
  getAiCraftsByArtwork,
  getAiCraftsByUser,
  updateAiCraft,
  deleteAiCraft,
  // v4 新增：智能策展展馆
  addCuratedHall,
  getCuratedHall,
  getCuratedHallsByTheme,
  updateCuratedHall,
  deleteCuratedHall,
  // v4 新增：陪练会话
  addTutorSession,
  getTutorSession,
  getTutorSessionsByUser,
  updateTutorSession,
  deleteTutorSession,
  // v4 新增：合伙人申请
  addPartnerApplication,
  getPartnerApplication,
  getPartnerApplicationsByStatus,
  updatePartnerApplication,
  deletePartnerApplication,
  // v7 新增：文化探索足迹
  recordFootprint,
  getFootprintsByUser,
  getFootprintActions,
  clearFootprintsByUser,
  addScenicGuide,
  getScenicGuidesByArea,
  // v9 新增：文创订单（v10 扩展物流状态机）
  addOrder,
  getAllOrders,
  updateOrderStatus,
  updateOrderAddr,
  ORDER_STATES,
  ORDER_STATE_LABELS,
  // v11 新增：自定义 3D 模型（运营后台品类模型替换）
  addCustom3dModel,
  getAllCustom3dModels,
  getCustom3dModelsMeta,
  getCustom3dModelByProductKey,
  updateCustom3dModel,
  deleteCustom3dModel,
  importCustom3dModels,
  CUSTOM_3D_VALIDATION
};
