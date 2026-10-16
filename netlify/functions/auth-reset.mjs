// ============================================================
// netlify/functions/auth-reset.mjs — M6a-2 密保找回密码云函数
// GET  /api/auth?action=question&username=xxx → 返回该账号密保问题
// POST /api/auth { username, answer, newPassword } → 验证密保后重置密码
// POST /api/auth { action:'admin-reset', token, targetUserId, newPassword }
//      → 管理员登录态下重置指定用户密码（服务端校验管理员身份）
// 需要 SUPABASE_SERVICE_ROLE_KEY 环境变量（本地 .env / Netlify 后台）
// 验证规则：sha256(username:answer) 与注册时写入 user_metadata 的哈希一致
// 安全：service_role 密钥仅在本服务端函数内使用，永不下发前端
// ============================================================
import crypto from 'node:crypto';

function json(statusCode, obj) {
  return {
    statusCode,
    headers: {
      'Content-Type': 'application/json; charset=utf-8',
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Headers': 'Content-Type'
    },
    body: JSON.stringify(obj)
  };
}

// 与前端 js/auth.js _authEmailFor 完全一致：
// 非 ASCII（如中文）用户名清洗后为空时，用确定性哈希合成邮箱
function authEmailFor(username) {
  const u = String(username || '').trim().toLowerCase();
  if (u.includes('@')) return u;
  const cleaned = u.replace(/[^a-z0-9_.-]/g, '');
  if (cleaned) return cleaned + '@dreamcore.app';
  let h = 5381;
  for (let i = 0; i < u.length; i++) h = ((h << 5) + h + u.charCodeAt(i)) >>> 0;
  return 'u' + h.toString(36) + '@dreamcore.app';
}

function hashAnswer(username, answer) {
  return crypto.createHash('sha256')
    .update(String(username).trim().toLowerCase() + ':' + String(answer).trim().toLowerCase())
    .digest('hex');
}

async function findUserByEmail(sbUrl, srKey, email) {
  // 实证发现：当前 GoTrue 版本会忽略 ?email= / ?keywords= 等过滤参数并返回整个列表，
  // 直接取 users[0] 会命中错误账户（安全缺陷）。必须分页拉取后在服务端精确匹配邮箱。
  const target = String(email || '').toLowerCase();
  const perPage = 200;
  for (let page = 1; page <= 100; page++) {
    const res = await fetch(sbUrl + '/auth/v1/admin/users?per_page=' + perPage + '&page=' + page, {
      headers: { apikey: srKey, Authorization: 'Bearer ' + srKey }
    });
    if (!res.ok) throw new Error('Supabase admin 查询失败 (' + res.status + ')');
    const data = await res.json();
    const users = data.users || [];
    const hit = users.find(u => (u.email || '').toLowerCase() === target);
    if (hit) return hit;
    if (users.length < perPage) return null; // 不足一页说明已到末页
  }
  return null;
}

async function updateUserPassword(sbUrl, srKey, userId, newPassword) {
  const res = await fetch(sbUrl + '/auth/v1/admin/users/' + userId, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json', apikey: srKey, Authorization: 'Bearer ' + srKey },
    body: JSON.stringify({ password: String(newPassword) })
  });
  if (!res.ok) {
    const t = await res.text();
    throw new Error('重置失败 (' + res.status + ')：' + t.slice(0, 120));
  }
}

// 校验调用者是否为管理员：用其 access_token 查 auth 身份 + profiles 角色
async function verifyAdmin(sbUrl, srKey, token) {
  const res = await fetch(sbUrl + '/auth/v1/user', {
    headers: { apikey: srKey, Authorization: 'Bearer ' + token }
  });
  if (!res.ok) return null;
  // 原生 /auth/v1/user 直接返回顶层用户对象（JS 客户端才会包装成 {data:{user}}）
  const user = await res.json();
  if (!user || !user.id) return null;
  let role = '';
  try {
    const pr = await fetch(sbUrl + '/rest/v1/profiles?id=eq.' + user.id + '&select=role', {
      headers: { apikey: srKey, Authorization: 'Bearer ' + srKey }
    });
    if (pr.ok) {
      const rows = await pr.json();
      role = (rows && rows[0] && rows[0].role) || '';
    }
  } catch (_) { /* profiles 查询失败按无角色处理 */ }
  if (role !== 'admin' && role !== 'superadmin') {
    // profiles 无角色时回退 metadata（老账号）
    const meta = user.user_metadata || {};
    const metaRole = meta.role === 'superadmin' ? 'superadmin' : (meta.isAdmin ? 'admin' : '');
    if (metaRole) role = metaRole;
  }
  return (role === 'admin' || role === 'superadmin') ? { id: user.id, role } : null;
}

export async function handler(event) {
  const sbUrl = process.env.VITE_SUPABASE_URL || '';
  const srKey = process.env.SUPABASE_SERVICE_ROLE_KEY || '';
  if (!sbUrl || !srKey) {
    return json(503, { error: '找回密码通道未开通：请在 .env / Netlify 环境变量配置 SUPABASE_SERVICE_ROLE_KEY' });
  }
  try {
    if (event.httpMethod === 'OPTIONS') return { statusCode: 204, body: '' };
    if (event.httpMethod === 'GET') {
      // 兼容 dev 中间件（query 拼在 path）与 Netlify 生产（queryStringParameters）
      let qsStr = '';
      if (event.path && event.path.includes('?')) qsStr = event.path.split('?')[1];
      const qs = new URLSearchParams(qsStr);
      const qsp = event.queryStringParameters || {};
      const username = qsp.username || qs.get('username') || '';
      if (!username) return json(400, { error: '缺少用户名' });
      const user = await findUserByEmail(sbUrl, srKey, authEmailFor(username));
      if (!user) return json(404, { error: '该用户名不存在' });
      const meta = user.user_metadata || {};
      if (!meta.secQuestion) return json(404, { error: '该账号未设置密保问题（旧账号），请联系管理员重置' });
      return json(200, { question: meta.secQuestion });
    }
    if (event.httpMethod === 'POST') {
      const body = JSON.parse(event.body || '{}');

      // ---- 管理员重置通道：服务端验证管理员登录态后直接改密 ----
      if (body.action === 'admin-reset') {
        const { token, targetUserId, newPassword } = body;
        if (!token || !targetUserId || !newPassword) return json(400, { error: '参数不完整' });
        if (String(newPassword).length < 6) return json(400, { error: '新密码至少 6 位' });
        const admin = await verifyAdmin(sbUrl, srKey, String(token));
        if (!admin) return json(403, { error: '无管理员权限或登录已过期' });
        await updateUserPassword(sbUrl, srKey, targetUserId, newPassword);
        return json(200, { success: true });
      }

      // ---- 密保找回通道 ----
      const { username, answer, newPassword } = body;
      if (!username || !answer || !newPassword) return json(400, { error: '参数不完整' });
      if (String(newPassword).length < 6) return json(400, { error: '新密码至少 6 位' });
      const user = await findUserByEmail(sbUrl, srKey, authEmailFor(username));
      if (!user) return json(404, { error: '该用户名不存在' });
      const meta = user.user_metadata || {};
      if (!meta.secAnswerHash) return json(404, { error: '该账号未设置密保问题（旧账号），请联系管理员重置' });
      if (hashAnswer(username, answer) !== meta.secAnswerHash) return json(403, { error: '密保答案不正确' });
      await updateUserPassword(sbUrl, srKey, user.id, newPassword);
      return json(200, { success: true });
    }
    return json(405, { error: 'Method Not Allowed' });
  } catch (e) {
    return json(500, { error: (e && e.message) || String(e) });
  }
}