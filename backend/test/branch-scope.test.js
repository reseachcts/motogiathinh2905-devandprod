// branch-scope.test.js — verifies the security fix: a staff user can only
// PATCH/DELETE notifications attached to a student in their own branch.
// System-wide notifications (no studentId) and the admin role bypass the
// scope check. Talks to the live backend at SMOKE_BASE (default :3001).
//
// The test creates two ad-hoc staff accounts (one per branch) with known
// passwords via the admin reset-password endpoint, then exercises the guard.

import { test, before } from 'node:test';
import assert from 'node:assert/strict';

const BASE = process.env.SMOKE_BASE || 'http://127.0.0.1:3001';
const ADMIN_EMAIL = process.env.SMOKE_ADMIN_EMAIL || 'thinh@motogiathinh.vn';
const ADMIN_PW    = process.env.SMOKE_ADMIN_PW    || 'changeme';

async function api(path, opts = {}) {
  const res = await fetch(BASE + path, {
    headers: { 'Content-Type': 'application/json', cookie: opts.cookie || '', ...(opts.headers || {}) },
    method: opts.method || 'GET',
    body: opts.body ? JSON.stringify(opts.body) : undefined,
  });
  const setCookie = res.headers.get('set-cookie');
  const ct = res.headers.get('content-type') || '';
  const body = ct.includes('json') ? await res.json() : await res.text();
  return { status: res.status, body, cookie: setCookie?.split(';')[0] || '' };
}

let alive = false;
let adminCookie = '';
let staffBr1 = null;
let staffBr3 = null;
let staffBr1Cookie = '';
let staffBr3Cookie = '';

// Skip the whole suite if the backend isn't reachable. Avoids a noisy fail
// on machines where the dev server isn't running.
before(async () => {
  try {
    const h = await api('/api/health');
    alive = h.status === 200;
  } catch { alive = false; }
  if (!alive) return;

  const a = await api('/api/auth/login', { method: 'POST',
    body: { email: ADMIN_EMAIL, password: ADMIN_PW } });
  if (a.status !== 200) { alive = false; return; }
  adminCookie = a.cookie;

  // Find or create a staff account per branch. We prefer existing rows so we
  // don't pollute the seeded DB; if none has a password yet, set one.
  const accounts = await api('/api/accounts', { cookie: adminCookie });
  staffBr1 = accounts.body.find(a => a.role === 'staff' && a.branchId === 'br-1' && a.active);
  staffBr3 = accounts.body.find(a => a.role === 'staff' && a.branchId === 'br-3' && a.active);
  if (!staffBr1 || !staffBr3) { alive = false; return; }

  const TEST_PW = 'TestScope1234';
  for (const acct of [staffBr1, staffBr3]) {
    const r = await api(`/api/accounts/${encodeURIComponent(acct.id)}/reset-password`,
      { method: 'POST', body: { newPassword: TEST_PW }, cookie: adminCookie });
    if (r.status !== 200) { alive = false; return; }
  }

  const l1 = await api('/api/auth/login', { method: 'POST',
    body: { email: staffBr1.email, password: TEST_PW } });
  const l3 = await api('/api/auth/login', { method: 'POST',
    body: { email: staffBr3.email, password: TEST_PW } });
  if (l1.status !== 200 || l3.status !== 200) { alive = false; return; }
  staffBr1Cookie = l1.cookie;
  staffBr3Cookie = l3.cookie;
});

test('PATCH /notifications/:id — staff in wrong branch gets 403', async (t) => {
  if (!alive) { t.skip('backend not running / setup failed'); return; }
  const notifs = await api('/api/notifications', { cookie: adminCookie });
  const students = await api('/api/students', { cookie: adminCookie });
  const sById = new Map(students.body.map(s => [s.id, s]));
  const target = notifs.body.find(n => n.id.startsWith('auto-') && n.studentId
    && sById.get(n.studentId));
  assert.ok(target, 'expected an auto-* notification with a known student');
  const stu = sById.get(target.studentId);
  // Use the staff whose branch is NOT this student's branch.
  const wrongCookie = stu.branchId === 'br-1' ? staffBr3Cookie : staffBr1Cookie;
  const r = await api(`/api/notifications/${encodeURIComponent(target.id)}`,
    { method: 'PATCH', body: { read: true }, cookie: wrongCookie });
  assert.equal(r.status, 403, `expected 403, got ${r.status} ${JSON.stringify(r.body)}`);
  assert.equal(r.body.error, 'wrong_branch');
});

test('PATCH /notifications/:id — staff in correct branch succeeds', async (t) => {
  if (!alive) { t.skip('backend not running / setup failed'); return; }
  const notifs = await api('/api/notifications', { cookie: adminCookie });
  const students = await api('/api/students', { cookie: adminCookie });
  const br1Ids = new Set(students.body.filter(s => s.branchId === 'br-1').map(s => s.id));
  const target = notifs.body.find(n => n.id.startsWith('auto-') && br1Ids.has(n.studentId));
  assert.ok(target, 'expected an auto-* notification for a br-1 student');
  const r = await api(`/api/notifications/${encodeURIComponent(target.id)}`,
    { method: 'PATCH', body: { read: true }, cookie: staffBr1Cookie });
  assert.equal(r.status, 200, `expected 200, got ${r.status} ${JSON.stringify(r.body)}`);
});

test('DELETE /notifications/:id — staff in wrong branch gets 403', async (t) => {
  if (!alive) { t.skip('backend not running / setup failed'); return; }
  const notifs = await api('/api/notifications', { cookie: adminCookie });
  const students = await api('/api/students', { cookie: adminCookie });
  const sById = new Map(students.body.map(s => [s.id, s]));
  const target = notifs.body.find(n => n.id.startsWith('auto-') && n.studentId
    && sById.get(n.studentId));
  assert.ok(target, 'expected an auto-* notification with a known student');
  const stu = sById.get(target.studentId);
  const wrongCookie = stu.branchId === 'br-1' ? staffBr3Cookie : staffBr1Cookie;
  const r = await api(`/api/notifications/${encodeURIComponent(target.id)}`,
    { method: 'DELETE', cookie: wrongCookie });
  assert.equal(r.status, 403, `expected 403, got ${r.status} ${JSON.stringify(r.body)}`);
});

test('POST /accounts/:id/reset-password — short password rejected by policy', async (t) => {
  if (!alive) { t.skip('backend not running / setup failed'); return; }
  // Too short: violates MIN_PW_LEN.
  const r1 = await api(`/api/accounts/${encodeURIComponent(staffBr1.id)}/reset-password`,
    { method: 'POST', body: { newPassword: 'short1' }, cookie: adminCookie });
  assert.equal(r1.status, 400);
  assert.equal(r1.body.error, 'password_too_short');
  // No digit: violates the digit rule.
  const r2 = await api(`/api/accounts/${encodeURIComponent(staffBr1.id)}/reset-password`,
    { method: 'POST', body: { newPassword: 'allletters' }, cookie: adminCookie });
  assert.equal(r2.status, 400);
  assert.equal(r2.body.error, 'password_needs_digit');
});

test('POST /auth/logout — double-logout is idempotent (200 both times)', async (t) => {
  if (!alive) { t.skip('backend not running / setup failed'); return; }
  const out1 = await api('/api/auth/logout', { method: 'POST', cookie: staffBr1Cookie });
  assert.equal(out1.status, 200, `first logout: ${JSON.stringify(out1.body)}`);
  // Second logout with no cookie (cookie was cleared) — still 200.
  const out2 = await api('/api/auth/logout', { method: 'POST', cookie: '' });
  assert.equal(out2.status, 200, `second logout (no cookie) must still 200: ${JSON.stringify(out2.body)}`);
});

test('GET /api/files/misc/* — refused even for admin (kind not in SERVABLE_KINDS)', async (t) => {
  if (!alive) { t.skip('backend not running / setup failed'); return; }
  // Any /misc/ path should 404 (or 400) — never serve files outside the
  // branch-scopable kinds. We expect 404 from the kind check.
  const r = await fetch(BASE + '/api/files/misc/whatever/file.jpg', {
    headers: { cookie: adminCookie },
  });
  assert.equal(r.status, 404, `expected 404, got ${r.status}`);
});
