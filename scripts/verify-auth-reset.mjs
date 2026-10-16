// ============================================================
// scripts/verify-auth-reset.mjs — 密保找回 + 管理员重置 服务端集成验证
// 用法：node scripts/verify-auth-reset.mjs [devServerBaseURL]
// 前置：.env 已配置 SUPABASE_SERVICE_ROLE_KEY；dev 服务器已启动（默认 http://127.0.0.1:5173）
// 流程：注册测试用户 → 密保查询 → 错误答案403 → 正确答案重置 → 新密码登录 →
//       非管理员403 → 提升管理员后 admin-reset 重置他人密码 → 被重置者登录验证 → 清理
// 安全：全程仅服务端使用 service_role 密钥；测试账户结束后删除
// ============================================================
import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';

const ROOT = path.resolve(import.meta.dirname, '..');
const envText = fs.readFileSync(path.join(ROOT, '.env'), 'utf8');
const envGet = (k) => {
  const m = envText.match(new RegExp('^\\s*' + k + '=(.+)$', 'm'));
  return m ? m[1].trim() : '';
};

const SB_URL = envGet('VITE_SUPABASE_URL');
const ANON = envGet('VITE_SUPABASE_ANON_KEY');
const SR = envGet('SUPABASE_SERVICE_ROLE_KEY');
const BASE = process.argv[2] || 'http://127.0.0.1:5173';

if (!SB_URL || !ANON || !SR) {
  console.error('缺少 VITE_SUPABASE_URL / VITE_SUPABASE_ANON_KEY / SUPABASE_SERVICE_ROLE_KEY');
  process.exit(1);
}

// 与 js/auth.js _authEmailFor / 云函数 authEmailFor 完全一致
function authEmailFor(username) {
  const u = String(username || '').trim().toLowerCase();
  if (u.includes('@')) return u;
  const cleaned = u.replace(/[^a-z0-9_.-]/g, '');
  if (cleaned) return cleaned + '@dreamcore.app';
  let h = 5381;
  for (let i = 0; i < u.length; i++) h = ((h << 5) + h + u.charCodeAt(i)) >>> 0;
  return 'u' + h.toString(36) + '@dreamcore.app';
}

// 与云函数 hashAnswer 一致：sha256(lower(username):lower(answer))
function hashAnswer(username, answer) {
  return crypto.createHash('sha256')
    .update(String(username).trim().toLowerCase() + ':' + String(answer).trim().toLowerCase())
    .digest('hex');
}

const srHeaders = { apikey: SR, Authorization: 'Bearer ' + SR, 'Content-Type': 'application/json' };
const anonHeaders = { apikey: ANON, Authorization: 'Bearer ' + ANON, 'Content-Type': 'application/json' };

async function api(url, opts) {
  const res = await fetch(url, opts);
  let body = null;
  try { body = await res.json(); } catch (_) { /* 非 JSON */ }
  return { status: res.status, body };
}

const results = [];
function check(name, cond, detail) {
  results.push({ name, pass: !!cond, detail: detail || '' });
  console.log((cond ? '  PASS ' : '  FAIL ') + name + (detail ? ' → ' + detail : ''));
}

async function main() {
  const stamp = Date.now().toString(36);
  const nameA = 'resetqa_' + stamp;      // 普通用户（带密保）
  const nameB = 'resetadm_' + stamp;     // 测试管理员
  const emailA = authEmailFor(nameA);
  const emailB = authEmailFor(nameB);
  const passA1 = 'OldPass123!';
  const passA2 = 'SecReset456!';
  const passA3 = 'AdminReset789!';
  const passB = 'AdmPass123!';
  const secQ = '你最喜欢的数字是多少？';
  const secAns = '4321';
  const uidList = [];

  console.log('\n[1] 注册测试用户 A（带密保） ' + nameA);
  const r1 = await api(SB_URL + '/auth/v1/signup', {
    method: 'POST', headers: anonHeaders,
    body: JSON.stringify({ email: emailA, password: passA1, data: { username: nameA, avatar: '', bio: '', secQuestion: secQ, secAnswerHash: hashAnswer(nameA, secAns) } })
  });
  const userA = r1.body && r1.body.user;
  const sessionOk = !!(r1.body && (r1.body.session || r1.body.access_token));
  check('注册成功且返回会话', r1.status === 200 && sessionOk && userA, 'status=' + r1.status + (r1.body && r1.body.error ? ' err=' + r1.body.error : ''));
  if (!userA) throw new Error('用户A注册失败，中止');
  uidList.push(userA.id);

  console.log('\n[2] 密保问题查询（经 dev 中间件 → 云函数）');
  const r2 = await api(BASE + '/api/auth?action=question&username=' + encodeURIComponent(nameA));
  check('返回 A 的密保问题', r2.status === 200 && r2.body.question === secQ, 'status=' + r2.status + ' question=' + r2.body.question);

  console.log('\n[3] 错误密保答案 → 403 拒绝');
  const r3 = await api(BASE + '/api/auth', {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ username: nameA, answer: '9999', newPassword: 'WrongAnswer0!' })
  });
  check('错误答案被拒绝', r3.status === 403, 'status=' + r3.status + ' body=' + JSON.stringify(r3.body));

  console.log('\n[4] 旧密码能登录（重置前基线）');
  const r4 = await api(SB_URL + '/auth/v1/token?grant_type=password', {
    method: 'POST', headers: anonHeaders, body: JSON.stringify({ email: emailA, password: passA1 })
  });
  check('旧密码登录成功', r4.status === 200 && r4.body.access_token, 'status=' + r4.status);

  console.log('\n[5] 正确密保答案 → 重置为新密码');
  const r5 = await api(BASE + '/api/auth', {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ username: nameA, answer: secAns, newPassword: passA2 })
  });
  check('密保重置成功', r5.status === 200 && r5.body.success, 'status=' + r5.status + ' body=' + JSON.stringify(r5.body));

  console.log('\n[6] 新密码可登录 / 旧密码失效');
  const r6a = await api(SB_URL + '/auth/v1/token?grant_type=password', {
    method: 'POST', headers: anonHeaders, body: JSON.stringify({ email: emailA, password: passA2 })
  });
  check('新密码登录成功', r6a.status === 200 && r6a.body.access_token, 'status=' + r6a.status);
  const r6b = await api(SB_URL + '/auth/v1/token?grant_type=password', {
    method: 'POST', headers: anonHeaders, body: JSON.stringify({ email: emailA, password: passA1 })
  });
  check('旧密码已失效', r6b.status !== 200, 'status=' + r6b.status);

  console.log('\n[7] admin-reset 权限校验：普通用户 token → 403');
  const r7 = await api(BASE + '/api/auth', {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ action: 'admin-reset', token: r6a.body.access_token, targetUserId: userA.id, newPassword: passA3 })
  });
  check('非管理员被拒绝', r7.status === 403, 'status=' + r7.status + ' body=' + JSON.stringify(r7.body));

  console.log('\n[8] 准备测试管理员 B（profiles.role=admin）');
  const r8 = await api(SB_URL + '/auth/v1/signup', {
    method: 'POST', headers: anonHeaders,
    body: JSON.stringify({ email: emailB, password: passB, data: { username: nameB, avatar: '', bio: '' } })
  });
  const userB = r8.body && r8.body.user;
  check('管理员B注册成功', r8.status === 200 && userB, 'status=' + r8.status);
  if (!userB) throw new Error('用户B注册失败，中止');
  uidList.push(userB.id);
  // profiles 行存在则更新 role，不存在则插入（依赖建表触发器与否两种情况都兼容）
  const r8b = await api(SB_URL + '/rest/v1/profiles?id=eq.' + userB.id + '&select=id,role', { headers: srHeaders });
  let roleSet = false;
  if (r8b.body && r8b.body.length) {
    const r8c = await api(SB_URL + '/rest/v1/profiles?id=eq.' + userB.id, {
      method: 'PATCH', headers: { ...srHeaders, Prefer: 'return=representation' }, body: JSON.stringify({ role: 'admin' })
    });
    roleSet = r8c.body && r8c.body.length && r8c.body[0].role === 'admin';
  } else {
    const r8d = await api(SB_URL + '/rest/v1/profiles', {
      method: 'POST', headers: { ...srHeaders, Prefer: 'return=representation' }, body: JSON.stringify({ id: userB.id, username: nameB, role: 'admin' })
    });
    roleSet = Array.isArray(r8d.body) ? !!(r8d.body[0] && r8d.body[0].role === 'admin') : !!(r8d.body && r8d.body.role);
  }
  check('B 的 profiles.role 已设为 admin', roleSet, 'profiles响应=' + JSON.stringify(r8b.body));

  console.log('\n[9] 管理员 B 登录并执行 admin-reset 重置 A');
  const r9a = await api(SB_URL + '/auth/v1/token?grant_type=password', {
    method: 'POST', headers: anonHeaders, body: JSON.stringify({ email: emailB, password: passB })
  });
  check('管理员B登录成功', r9a.status === 200 && r9a.body.access_token, 'status=' + r9a.status);
  const r9 = await api(BASE + '/api/auth', {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ action: 'admin-reset', token: r9a.body.access_token, targetUserId: userA.id, newPassword: passA3 })
  });
  check('admin-reset 成功', r9.status === 200 && r9.body.success, 'status=' + r9.status + ' body=' + JSON.stringify(r9.body));

  console.log('\n[10] A 用管理员重置后的密码登录');
  const r10 = await api(SB_URL + '/auth/v1/token?grant_type=password', {
    method: 'POST', headers: anonHeaders, body: JSON.stringify({ email: emailA, password: passA3 })
  });
  check('A 新密码登录成功', r10.status === 200 && r10.body.access_token, 'status=' + r10.status);

  console.log('\n[11] 清理测试数据');
  for (const uid of uidList) {
    const rd = await api(SB_URL + '/auth/v1/admin/users/' + uid, { method: 'DELETE', headers: srHeaders });
    const rp = await api(SB_URL + '/rest/v1/profiles?id=eq.' + uid, { method: 'DELETE', headers: srHeaders });
    check('清理 ' + uid.slice(0, 8) + '…', rd.status === 200 || rd.status === 204, 'auth=' + rd.status + ' profiles=' + rp.status);
  }

  const failed = results.filter(r => !r.pass);
  console.log('\n========== 汇总：' + (results.length - failed.length) + '/' + results.length + ' 通过 ==========');
  if (failed.length) {
    console.log('失败项：');
    failed.forEach(f => console.log('  - ' + f.name + ' → ' + f.detail));
    process.exit(1);
  }
  process.exit(0);
}

main().catch(e => {
  console.error('脚本异常：' + (e && e.message || e));
  process.exit(2);
});
