// ============================================================
// netlify/functions/update-artwork-status.mjs — 作品状态变更回写云端（服务端通道）
// POST /api/update-artwork-status
//   body: { access_token, cloudId, op?: 'status' | 'delete', status?: 'draft'|'published'|'offline' }
// 流程：校验 access_token（GoTrue /auth/v1/user）→ 归属/管理员权限校验
//       （非本人时查 profiles.role，仅 admin 放行）→
//       op='delete' → DELETE artworks；op='status'（默认）→ PATCH artworks.status
// 安全：service_role 密钥仅在本服务端函数内使用，永不下发前端；
//       service key 会绕过 RLS，故权限校验必须在本函数内自行完成，不信任客户端。
// ============================================================

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

// 用 access_token 换取用户身份（原生 /auth/v1/user 返回顶层用户对象）
async function verifyUser(sbUrl, srKey, token) {
  const res = await fetch(sbUrl + '/auth/v1/user', {
    headers: { apikey: srKey, Authorization: 'Bearer ' + token }
  });
  if (!res.ok) return null;
  const user = await res.json();
  return user && user.id ? user : null;
}

// 归属校验：本人直接放行；否则查 profiles.role，仅 admin 放行
async function canMutateArtwork(sbUrl, srKey, user, cloudId) {
  const res = await fetch(sbUrl + '/rest/v1/artworks?id=eq.' + encodeURIComponent(cloudId) + '&select=id,user_id', {
    headers: { apikey: srKey, Authorization: 'Bearer ' + srKey }
  });
  if (!res.ok) return { ok: false, status: 502, error: '作品查询失败 (' + res.status + ')' };
  const rows = await res.json();
  if (!Array.isArray(rows) || !rows.length) return { ok: false, status: 404, error: '云端作品不存在' };
  if (rows[0].user_id === user.id) return { ok: true };

  const pres = await fetch(sbUrl + '/rest/v1/profiles?id=eq.' + encodeURIComponent(user.id) + '&select=role', {
    headers: { apikey: srKey, Authorization: 'Bearer ' + srKey }
  });
  if (pres.ok) {
    const prows = await pres.json();
    if (Array.isArray(prows) && prows[0] && prows[0].role === 'admin') return { ok: true, viaAdmin: true };
  }
  return { ok: false, status: 403, error: '无权变更他人作品状态' };
}

const VALID_STATUS = ['draft', 'published', 'offline'];

export async function handler(event) {
  const sbUrl = process.env.VITE_SUPABASE_URL || '';
  const srKey = process.env.SUPABASE_SERVICE_ROLE_KEY || '';
  if (!sbUrl || !srKey) {
    return json(503, { error: '云端同步通道未开通：请在 .env / Netlify 环境变量配置 SUPABASE_SERVICE_ROLE_KEY' });
  }
  try {
    if (event.httpMethod === 'OPTIONS') return { statusCode: 204, body: '' };
    if (event.httpMethod !== 'POST') return json(405, { error: 'Method Not Allowed' });

    const body = JSON.parse(event.body || '{}');
    const accessToken = String(body.access_token || '');
    const cloudId = body.cloudId;
    const op = String(body.op || 'status');
    if (!accessToken) return json(401, { error: '缺少云端登录凭证' });
    if (cloudId == null || cloudId === '') return json(400, { error: '缺少 cloudId' });

    const user = await verifyUser(sbUrl, srKey, accessToken);
    if (!user) return json(401, { error: '云端登录已过期，请重新登录' });

    const perm = await canMutateArtwork(sbUrl, srKey, user, cloudId);
    if (!perm.ok) return json(perm.status, { error: perm.error });

    if (op === 'delete') {
      const del = await fetch(sbUrl + '/rest/v1/artworks?id=eq.' + encodeURIComponent(cloudId), {
        method: 'DELETE',
        headers: { apikey: srKey, Authorization: 'Bearer ' + srKey, Prefer: 'return=minimal' }
      });
      if (!del.ok) {
        const t = await del.text();
        return json(502, { error: '云端删除失败 (' + del.status + ')：' + t.slice(0, 120) });
      }
      return json(200, { ok: true, op: 'delete', cloudId });
    }

    // op === 'status'
    const status = String(body.status || '');
    if (!VALID_STATUS.includes(status)) {
      return json(400, { error: '非法状态（仅支持 draft/published/offline）' });
    }
    const patch = await fetch(sbUrl + '/rest/v1/artworks?id=eq.' + encodeURIComponent(cloudId), {
      method: 'PATCH',
      headers: { apikey: srKey, Authorization: 'Bearer ' + srKey, 'Content-Type': 'application/json', Prefer: 'return=minimal' },
      body: JSON.stringify({ status })
    });
    if (!patch.ok) {
      const t = await patch.text();
      return json(502, { error: '云端状态更新失败 (' + patch.status + ')：' + t.slice(0, 120) });
    }
    return json(200, { ok: true, op: 'status', cloudId, status, viaAdmin: !!perm.viaAdmin });
  } catch (e) {
    return json(500, { error: (e && e.message) || String(e) });
  }
}
