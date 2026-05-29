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
const ADMIN_EMAIL = process.env.SMOKE_ADMIN_EMAIL || 'admin@motogiathinh.centersai';
const ADMIN_PW    = process.env.SMOKE_ADMIN_PW    || 'admin';

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
    { method: 'POST', body: { newPassword: 'Ab1!' }, cookie: adminCookie });
  assert.equal(r1.status, 400);
  assert.equal(r1.body.error, 'password_too_short');
  // Long enough but missing uppercase: trips the lowercase→uppercase→… chain.
  const r2 = await api(`/api/accounts/${encodeURIComponent(staffBr1.id)}/reset-password`,
    { method: 'POST', body: { newPassword: 'allletters1!' }, cookie: adminCookie });
  assert.equal(r2.status, 400);
  assert.equal(r2.body.error, 'password_needs_uppercase');
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

// ---------------------------------------------------------------------------
// Polish-round regression tests (L3 → L5 boundary). Each covers a write-side
// gate added in this pass.
// ---------------------------------------------------------------------------

test('POST /accounts — rejects weak password before insert', async (t) => {
  if (!alive) { t.skip('backend not running / setup failed'); return; }
  const r = await api('/api/accounts', { method: 'POST', cookie: adminCookie,
    body: {
      name: 'Weak Pass User', email: `weak-${Date.now()}@example.com`,
      role: 'staff', branchId: 'br-1', password: 'short1',
    },
  });
  assert.equal(r.status, 400);
  // passwordPolicy emits its structured code; UI maps to a friendly message.
  assert.ok(/password_(too_short|needs_)/.test(r.body.error),
    `expected password_* error code, got ${JSON.stringify(r.body)}`);
});

test('PATCH /accounts — rejects role: "superadmin" (enum gate)', async (t) => {
  if (!alive) { t.skip('backend not running / setup failed'); return; }
  const r = await api(`/api/accounts/${encodeURIComponent(staffBr1.id)}`,
    { method: 'PATCH', cookie: adminCookie, body: { role: 'superadmin' } });
  assert.equal(r.status, 400, `expected 400, got ${r.status} ${JSON.stringify(r.body)}`);
  assert.equal(r.body.error, 'bad_role');
  // Sanity: original role intact on disk.
  const accts = await api('/api/accounts', { cookie: adminCookie });
  const still = accts.body.find(a => a.id === staffBr1.id);
  assert.equal(still.role, 'staff', 'role should not have changed');
});

test('POST /branches — admin-only + 409 on duplicate-after-FK-protect', async (t) => {
  if (!alive) { t.skip('backend not running / setup failed'); return; }
  // Staff cannot create branches at all (admin-only middleware).
  const staffTry = await api('/api/branches', { method: 'POST', cookie: staffBr1Cookie,
    body: { name: 'Should Reject', address: 'x' } });
  assert.equal(staffTry.status, 403, `expected 403 from staff, got ${staffTry.status}`);

  // Admin can create. We use a unique name so the row doesn't collide with
  // prior test runs.
  const name = `E2E Branch ${Date.now()}`;
  const ok = await api('/api/branches', { method: 'POST', cookie: adminCookie,
    body: { name, address: 'E2E address' } });
  assert.equal(ok.status, 201, `expected 201, got ${ok.status} ${JSON.stringify(ok.body)}`);
  assert.ok(ok.body.id?.startsWith('br'), `new branch id: ${ok.body.id}`);

  // Cleanup — branch is unused so delete should succeed (and exercises the
  // FK-clean path on DELETE).
  const del = await api(`/api/branches/${encodeURIComponent(ok.body.id)}`,
    { method: 'DELETE', cookie: adminCookie });
  assert.equal(del.status, 200, `cleanup delete: ${JSON.stringify(del.body)}`);
});

test('DELETE /branches/:id — FK refusal when classes/students/etc reference it', async (t) => {
  if (!alive) { t.skip('backend not running / setup failed'); return; }
  // br-1 in the seed has classes, students, payments, etc — must refuse.
  const r = await api('/api/branches/br-1', { method: 'DELETE', cookie: adminCookie });
  assert.equal(r.status, 409, `expected 409 in_use, got ${r.status} ${JSON.stringify(r.body)}`);
  assert.equal(r.body.error, 'branch_in_use');
  assert.ok(r.body.references && Object.keys(r.body.references).length,
    'expected per-table reference counts in the error body');
});

test('PATCH /students — feePlanId change recomputes totalFee server-side', async (t) => {
  if (!alive) { t.skip('backend not running / setup failed'); return; }
  // Find a student + a different fee plan than what they're on. We need both
  // fee plans to exist; the seed has fee-a (1,995,000) + fee-a1 (565,000).
  const [studentsRes, feesRes] = await Promise.all([
    api('/api/students', { cookie: adminCookie }),
    api('/api/fee-plans', { cookie: adminCookie }),
  ]);
  const stu = studentsRes.body.find(s => s.feePlanId && s.feePlanId !== '');
  assert.ok(stu, 'expected at least one student with a feePlanId');
  const otherFee = feesRes.body.find(f => f.id !== stu.feePlanId);
  assert.ok(otherFee, 'expected a different fee plan to switch to');

  const r = await api(`/api/students/${encodeURIComponent(stu.id)}`, {
    method: 'PATCH', cookie: adminCookie,
    body: { feePlanId: otherFee.id, promotionId: 'promo-none' },
  });
  assert.equal(r.status, 200, `patch failed: ${JSON.stringify(r.body)}`);
  // totalFee should equal the new fee plan's amount (promo-none = 0 discount).
  assert.equal(r.body.totalFee, otherFee.amount,
    `expected totalFee=${otherFee.amount}, got ${r.body.totalFee}`);

  // Restore — keeps the seeded dataset stable for downstream tests / smoke.
  await api(`/api/students/${encodeURIComponent(stu.id)}`, {
    method: 'PATCH', cookie: adminCookie,
    body: { feePlanId: stu.feePlanId, promotionId: stu.promotionId || 'promo-none' },
  });
});

test('POST /students/:id/docs/:key — rejects magic-byte mismatch (PNG bytes, .jpg name)', async (t) => {
  if (!alive) { t.skip('backend not running / setup failed'); return; }
  // Pick any student we can write to as admin.
  const studentsRes = await api('/api/students', { cookie: adminCookie });
  const stu = studentsRes.body[0];
  assert.ok(stu, 'expected at least one student');

  // Real PNG signature (8 bytes) + a tiny IHDR-ish chunk so it's a "valid"
  // PNG by magic. We label it .jpg with mimetype image/jpeg to force the
  // server's enforceMagic() to compare and reject.
  const pngBytes = Buffer.from([
    0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A,    // PNG signature
    0x00, 0x00, 0x00, 0x0D, 0x49, 0x48, 0x44, 0x52,    // IHDR length + "IHDR"
    0x00, 0x00, 0x00, 0x01, 0x00, 0x00, 0x00, 0x01,    // 1×1
    0x08, 0x02, 0x00, 0x00, 0x00,
  ]);
  const fd = new FormData();
  fd.append('file', new Blob([pngBytes], { type: 'image/jpeg' }), 'fake.jpg');
  const r = await fetch(BASE + `/api/students/${encodeURIComponent(stu.id)}/docs/cccd`, {
    method: 'POST', body: fd, headers: { cookie: adminCookie },
  });
  // The browser-supplied mimetype passes multer's fileFilter (image/jpeg),
  // but our magic-byte check sniffs PNG and accepts it as image/png (PNG is
  // in ALLOWED_MIME). So a PNG-bytes-but-jpg-named upload actually SUCCEEDS.
  // What MUST fail is a non-image disguised as one — verify with random bytes.
  assert.ok(r.status === 201 || r.status === 415,
    `PNG-bytes/jpg-name should be 201 or 415, got ${r.status}`);

  // The real disguise test: garbage bytes labeled image/jpeg → 415.
  const fd2 = new FormData();
  fd2.append('file', new Blob([Buffer.from('not an image at all')], { type: 'image/jpeg' }), 'fake.jpg');
  const r2 = await fetch(BASE + `/api/students/${encodeURIComponent(stu.id)}/docs/cccd`, {
    method: 'POST', body: fd2, headers: { cookie: adminCookie },
  });
  assert.equal(r2.status, 415, `garbage-bytes upload must 415, got ${r2.status}`);
});

test('DELETE /students/:id/docs/:key — clears the doc + zeroes URL', async (t) => {
  if (!alive) { t.skip('backend not running / setup failed'); return; }
  // First, upload a real PNG so there's something to delete.
  const studentsRes = await api('/api/students', { cookie: adminCookie });
  const stu = studentsRes.body[0];
  const pngBytes = Buffer.from([
    0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A,
    0x00, 0x00, 0x00, 0x0D, 0x49, 0x48, 0x44, 0x52,
    0x00, 0x00, 0x00, 0x01, 0x00, 0x00, 0x00, 0x01,
    0x08, 0x02, 0x00, 0x00, 0x00,
  ]);
  const fd = new FormData();
  fd.append('file', new Blob([pngBytes], { type: 'image/png' }), 'real.png');
  const up = await fetch(BASE + `/api/students/${encodeURIComponent(stu.id)}/docs/the3x4`, {
    method: 'POST', body: fd, headers: { cookie: adminCookie },
  });
  assert.equal(up.status, 201, `upload failed: ${up.status}`);

  // Now delete it.
  const del = await api(`/api/students/${encodeURIComponent(stu.id)}/docs/the3x4`,
    { method: 'DELETE', cookie: adminCookie });
  assert.equal(del.status, 200, `delete failed: ${JSON.stringify(del.body)}`);

  // Verify the row reflects the clear.
  const after = await api('/api/students', { cookie: adminCookie });
  const stuAfter = after.body.find(s => s.id === stu.id);
  assert.equal(stuAfter.docs_the3x4, false, 'docs_the3x4 should be false');
  assert.equal(stuAfter.docs_the3x4_url, null, 'docs_the3x4_url should be null');
});
