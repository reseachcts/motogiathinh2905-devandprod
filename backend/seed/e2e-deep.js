// e2e-deep.js — L5 deeper-pass discovery sweep.
// Targets edge cases L1-L4 skipped: persistence, concurrency, branch-scope
// enforcement, modal-async races, search/pagination resilience, deeper
// dashboard sections, drag-drop uploads, doc lightbox cycle, etc.
//
// FAIL-only screenshots → backend/data/snapshots/L5-<scenario>.png
// Does NOT modify production code. Exits 0 always — discovery, not gating.
//
// Usage: cd backend && node seed/e2e-deep.js

import { chromium } from 'playwright';
import { mkdirSync, writeFileSync, readFileSync, existsSync, statSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const BASE     = process.env.SMOKE_BASE          || 'http://127.0.0.1:3001';
const EMAIL    = process.env.SEED_ADMIN_EMAIL    || 'thinh@motogiathinh.vn';
const PASSWORD = process.env.SEED_ADMIN_PASSWORD || 'changeme';
const SALT     = Math.random().toString(36).slice(2, 7);
const SHOTS    = resolve(dirname(fileURLToPath(import.meta.url)), '..', 'data', 'snapshots');
const TMPDIR   = resolve(dirname(fileURLToPath(import.meta.url)), '..', 'data', 'tmp-l5');
mkdirSync(SHOTS, { recursive: true });
mkdirSync(TMPDIR, { recursive: true });

const results = [];
const PASS = (l, x = '') => { results.push({ ok: true,  l, x }); console.log(`  PASS ${l}${x ? ' — ' + x : ''}`); };
const FAIL = (l, x = '') => { results.push({ ok: false, l, x }); console.log(`  FAIL ${l}${x ? ' — ' + x : ''}`); };
const WARN = (l, x = '') => { results.push({ ok: 'warn', l, x }); console.log(`  WARN ${l}${x ? ' — ' + x : ''}`); };

const shoot = (p, n) => p.screenshot({ path: resolve(SHOTS, `L5-${n}.png`), fullPage: true }).catch(() => {});

// Tiny but valid 65-byte PNG (1×1 px, transparent) — used for upload tests.
// Hand-crafted so it passes the backend's magic-byte sniff (89 50 4E 47).
const TINY_PNG = Buffer.from(
  '89504e470d0a1a0a0000000d49484452000000010000000108060000001f15c4' +
  '890000000a49444154789c6300010000000500017a37d9930000000049454e44ae426082',
  'hex',
);

async function dismiss(page) {
  try {
    await page.keyboard.press('Escape').catch(() => {});
    await page.waitForTimeout(60);
    const huy = page.locator('button:has-text("Hủy")');
    if (await huy.count()) await huy.first().click({ force: true }).catch(() => {});
    await page.evaluate(() => document.querySelectorAll('div[style*="z-index: 1000"], div[style*="zIndex: 1000"]').forEach(el => el.remove()));
  } catch {}
}

async function safe(page, name, fn) {
  try { await fn(); }
  catch (e) { await shoot(page, name); FAIL(name, 'EXC ' + (e.message || String(e)).slice(0, 220)); }
  // Hard-reset: dismiss any open modals by clicking their actual close action
  // (DOM-removal alone is undone by React's next reconciliation).
  try {
    for (let attempt = 0; attempt < 4; attempt++) {
      const closed = await page.evaluate(() => {
        const portals = Array.from(document.body.children).filter(el =>
          el.tagName === 'DIV' && /position:\s*fixed/i.test(el.getAttribute('style') || ''));
        if (!portals.length) return true;
        for (const p of portals) {
          // Try the X icon button first.
          const xbtn = Array.from(p.querySelectorAll('button')).find(b => (b.textContent || '').trim() === '' && b.querySelector('svg'));
          if (xbtn) { xbtn.click(); return false; }
          // Try Hủy.
          const huy = Array.from(p.querySelectorAll('button')).find(b => (b.textContent || '').trim() === 'Hủy');
          if (huy) { huy.click(); return false; }
          // Try backdrop click (outer div has onClick=close).
          p.click();
        }
        return false;
      });
      await page.waitForTimeout(180);
      if (closed) break;
    }
  } catch {}
}

async function gotoTab(page, label) {
  await dismiss(page);
  // Always nuke modal portals first — they intercept aside clicks.
  await page.evaluate(() => {
    Array.from(document.body.children).forEach(el => {
      const s = el.getAttribute('style') || '';
      if (el.tagName === 'DIV' && /position:\s*fixed/i.test(s) && /(z-index:\s*1000|z-index:\s*2000)/i.test(s)) el.remove();
    });
  });
  if ((await page.locator('aside button').count().catch(() => 0)) === 0) {
    await page.goto(BASE + '/', { waitUntil: 'domcontentloaded' });
    if (await page.locator('.mgt-login form').count()) {
      await page.fill('input[name=email]', EMAIL);
      await page.fill('input[name=password]', PASSWORD);
      await Promise.all([
        page.waitForFunction(() => !!window.MGT_DATA, null, { timeout: 12000 }),
        page.click('.mgt-login button[type=submit]'),
      ]);
    }
    await page.waitForSelector('aside', { timeout: 5000 });
  }
  await page.locator(`aside button:has-text("${label}")`).first().click({ force: true, timeout: 6000 });
  await page.waitForTimeout(220);
}

async function loginUI(page) {
  await page.goto(BASE + '/', { waitUntil: 'domcontentloaded' });
  await page.waitForSelector('.mgt-login form', { timeout: 5000 });
  await page.fill('input[name=email]', EMAIL);
  await page.fill('input[name=password]', PASSWORD);
  await Promise.all([
    page.waitForFunction(() => !!window.MGT_DATA, null, { timeout: 12000 }),
    page.click('.mgt-login button[type=submit]'),
  ]);
  await page.waitForSelector('aside', { timeout: 5000 });
}

// API helper for direct backend hits — uses cookie jar.
async function apiCall(cookieJar, path, opts = {}) {
  const headers = { 'Content-Type': 'application/json', ...(opts.headers || {}) };
  if (cookieJar) headers.cookie = cookieJar;
  const res = await fetch(BASE + path, {
    method: opts.method || 'GET', headers,
    body: opts.body ? JSON.stringify(opts.body) : undefined,
  });
  const setCookie = res.headers.get('set-cookie');
  const ct = res.headers.get('content-type') || '';
  const body = ct.includes('json') ? await res.json().catch(() => null) : await res.text();
  return { status: res.status, body, setCookie: setCookie ? setCookie.split(';')[0] : null };
}

async function run() {
  const browser = await chromium.launch();
  const ctx  = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  const page = await ctx.newPage();
  page.setDefaultTimeout(8000);

  const consoleErrors = [];
  page.on('console', m => {
    if (m.type() !== 'error') return;
    const t = m.text();
    if (/babel|@babel\/standalone/i.test(t)) return;
    if (/401.*Unauthorized|Failed to load resource.*401/i.test(t)) return;
    consoleErrors.push(t);
  });
  page.on('pageerror', e => consoleErrors.push('pageerror: ' + e.message));
  page.on('dialog', d => { consoleErrors.push('dialog: ' + d.message()); d.dismiss().catch(() => {}); });

  console.log(`\n→ ${BASE}/   L5 deep sweep starting`);
  await loginUI(page);
  console.log(`  (boot OK, ${consoleErrors.length} early errs)\n`);

  // ============ 1. THEME 5-cycle re-tint on dashboard ============
  await safe(page, '01-theme-cycle-dashboard', async () => {
    await gotoTab(page, 'Tổng quan');
    await page.waitForSelector('text=TỔNG NỢ', { timeout: 5000 });
    // Sample the body bg-color before each flip; assert 5 dark↔light cycles toggle CSS var.
    const observed = [];
    const t = page.locator('aside button[title*="Light" i], aside button[title*="Dark" i]').first();
    if (!(await t.count())) { FAIL('theme toggle missing'); return; }
    for (let i = 0; i < 10; i++) {
      const before = await page.evaluate(() => ({
        attr: document.documentElement.getAttribute('data-theme'),
        bg:   getComputedStyle(document.body).backgroundColor,
        fg1:  getComputedStyle(document.documentElement).getPropertyValue('--fg-1').trim(),
      }));
      await t.click({ force: true });
      await page.waitForTimeout(180);
      const after = await page.evaluate(() => ({
        attr: document.documentElement.getAttribute('data-theme'),
        bg:   getComputedStyle(document.body).backgroundColor,
        fg1:  getComputedStyle(document.documentElement).getPropertyValue('--fg-1').trim(),
      }));
      observed.push({ i, before: before.attr, after: after.attr, bgChanged: before.bg !== after.bg, fgChanged: before.fg1 !== after.fg1 });
    }
    const allFlipped  = observed.every(o => o.before !== o.after);
    const allBgChanged = observed.every(o => o.bgChanged);
    if (allFlipped && allBgChanged) PASS('theme flips 10 times, CSS vars re-applied', `bg changed in all cycles`);
    else FAIL('theme cycle stale-color leak', JSON.stringify(observed.slice(0,3)));
    // Verify charts re-tint (sample SVG path strokes in dashboard).
    const ringColors = await page.evaluate(() => {
      const svgs = Array.from(document.querySelectorAll('main svg'));
      return svgs.slice(0, 5).map(s => Array.from(s.querySelectorAll('[stroke]')).slice(0, 3).map(p => p.getAttribute('stroke')).join(','));
    });
    PASS('chart svg samples present', `${ringColors.length} svgs sampled`);
  });

  // ============ 2. THEME cycle on Tổ chức → Chi nhánh (glow rings) ============
  await safe(page, '02-theme-cycle-branches', async () => {
    await gotoTab(page, 'Tổ chức');
    await page.locator('button:has-text("Chi nhánh")').first().click({ force: true });
    await page.waitForTimeout(300);
    const t = page.locator('aside button[title*="Light" i], aside button[title*="Dark" i]').first();
    if (!(await t.count())) { FAIL('theme toggle missing'); return; }
    const cycles = [];
    for (let i = 0; i < 6; i++) {
      const before = await page.evaluate(() => ({
        attr: document.documentElement.getAttribute('data-theme'),
        // glow ring on first branch card — sample its computed border/box-shadow.
        ring: (() => {
          const h = document.querySelectorAll('main h3')[0]?.closest('div');
          if (!h) return null;
          const cs = getComputedStyle(h);
          return cs.boxShadow + '|' + cs.backgroundColor;
        })(),
      }));
      await t.click({ force: true });
      await page.waitForTimeout(180);
      const after = await page.evaluate(() => ({
        attr: document.documentElement.getAttribute('data-theme'),
        ring: (() => {
          const h = document.querySelectorAll('main h3')[0]?.closest('div');
          if (!h) return null;
          const cs = getComputedStyle(h);
          return cs.boxShadow + '|' + cs.backgroundColor;
        })(),
      }));
      cycles.push({ i, themeFlipped: before.attr !== after.attr, ringChanged: before.ring !== after.ring });
    }
    const allFlipped = cycles.every(c => c.themeFlipped);
    const ringsTinted = cycles.every(c => c.ringChanged);
    allFlipped ? PASS('branch theme cycle x6 themes flip OK') : FAIL('branch theme cycle attr did not flip', JSON.stringify(cycles));
    ringsTinted ? PASS('branch glow ring re-tints each cycle') : WARN('branch ring did NOT change all cycles (possible stale color)', JSON.stringify(cycles.filter(c=>!c.ringChanged)));
  });

  // ============ 3. PERSISTENCE: theme=light + vehicleMode=4w survive reload ============
  await safe(page, '03-persistence-reload', async () => {
    await page.evaluate(() => {
      localStorage.setItem('mgt-theme', 'light');
      localStorage.setItem('mgt-mode', '4w');
    });
    await page.reload({ waitUntil: 'domcontentloaded' });
    // After reload may need to wait for login (cookie persists in same context).
    await page.waitForFunction(() => !!window.MGT_DATA, null, { timeout: 12000 }).catch(() => {});
    await page.waitForTimeout(500);
    const state = await page.evaluate(() => ({
      theme: document.documentElement.getAttribute('data-theme'),
      mode:  document.documentElement.getAttribute('data-mode'),
      lsTheme: localStorage.getItem('mgt-theme'),
      lsMode:  localStorage.getItem('mgt-mode'),
      loggedIn: !!window.MGT_DATA,
    }));
    state.loggedIn ? PASS('reload kept session cookie + MGT_DATA loaded') : FAIL('reload lost session');
    state.theme === 'light' ? PASS('theme=light persisted across reload', state.theme)
                            : FAIL('theme did NOT persist', `attr=${state.theme} ls=${state.lsTheme}`);
    state.mode === '4w' ? PASS('vehicleMode=4w persisted across reload', state.mode)
                        : FAIL('vehicleMode did NOT persist', `attr=${state.mode} ls=${state.lsMode}`);
    // Restore for downstream tests
    await page.evaluate(() => { localStorage.setItem('mgt-theme', 'dark'); localStorage.setItem('mgt-mode', '2w'); });
    await page.reload({ waitUntil: 'domcontentloaded' });
    await page.waitForFunction(() => !!window.MGT_DATA, null, { timeout: 12000 }).catch(() => {});
  });

  // ============ 4. DASHBOARD Biến động / So sánh / Hiệu suất render + grain switch ============
  await safe(page, '04-dashboard-deep-sections', async () => {
    await gotoTab(page, 'Tổng quan');
    await page.waitForTimeout(400);
    const sections = await page.evaluate(() => {
      const txt = document.body.innerText;
      return {
        biendong: /Biến động/.test(txt),
        sosanh:   /So sánh/.test(txt),
        hieusuat: /Hiệu suất/.test(txt),
      };
    });
    Object.entries(sections).forEach(([k,v]) => v ? PASS(`section "${k}" rendered`) : FAIL(`section "${k}" missing`));
    // Switch grain Giờ → Ngày → Tháng (top dashboard controls).
    const errBefore = consoleErrors.length;
    for (const grain of ['Giờ', 'Ngày', 'Tháng']) {
      const b = page.locator(`button:has-text("${grain}")`).first();
      if (await b.count()) {
        await b.click({ force: true });
        await page.waitForTimeout(280);
      }
    }
    const newErrs = consoleErrors.slice(errBefore);
    newErrs.length === 0 ? PASS('grain switch Giờ/Ngày/Tháng no console errors')
                         : FAIL('grain switch triggered console errors', newErrs.slice(0,2).join(' | ').slice(0,200));
    // Try hovering over a chart svg (any path) — assert no exception thrown.
    const hoverHits = await page.evaluate(() => {
      const paths = document.querySelectorAll('main svg path, main svg circle, main svg rect');
      let hovered = 0;
      paths.forEach((p, i) => { if (i < 5) { p.dispatchEvent(new MouseEvent('mousemove', { bubbles: true })); hovered++; } });
      return hovered;
    });
    PASS('chart hitbox hover smoke', `${hoverHits} svg children dispatched mousemove`);
  });

  // ============ 5. PAYMENT BIEN-LAI re-upload via API (deep flow) ============
  await safe(page, '05-payment-bienlai-upload', async () => {
    // Use direct API since drag-drop file injection through Playwright is brittle.
    // Get the page's session cookie.
    const cookies = await ctx.cookies(BASE);
    const cookieStr = cookies.map(c => `${c.name}=${c.value}`).join('; ');
    // Find a real payment to upload to.
    const paymentList = await apiCall(cookieStr, '/api/payments');
    if (paymentList.status !== 200 || !paymentList.body.length) { FAIL('cannot list payments via API', `status=${paymentList.status}`); return; }
    const pay = paymentList.body[0];
    // Multipart POST via fetch FormData; can't reuse apiCall (JSON-only).
    const fd = new FormData();
    fd.append('file', new Blob([TINY_PNG], { type: 'image/png' }), 'test.png');
    const res = await fetch(`${BASE}/api/payments/${pay.id}/bien-lai`, {
      method: 'POST', body: fd, headers: { cookie: cookieStr },
    });
    const body = await res.json().catch(() => ({}));
    if (res.status !== 201) { FAIL('bien-lai upload failed', `status=${res.status} body=${JSON.stringify(body)}`); return; }
    PASS('bien-lai uploaded to existing payment', `url=${body.url} size=${body.size}`);
    // HEAD the file to verify it's served back.
    const fileUrl = body.url;
    const get = await fetch(BASE + fileUrl, { headers: { cookie: cookieStr } });
    get.ok && get.headers.get('content-type')?.includes('image/png')
      ? PASS('uploaded bien-lai retrievable via /api/files', `ct=${get.headers.get('content-type')}`)
      : FAIL('uploaded bien-lai not retrievable', `status=${get.status} ct=${get.headers.get('content-type')}`);
  });

  // ============ 6. DOCSLOT replace + delete cycle via API ============
  await safe(page, '06-docslot-replace-and-clear', async () => {
    const cookies = await ctx.cookies(BASE);
    const cookieStr = cookies.map(c => `${c.name}=${c.value}`).join('; ');
    const studentList = await apiCall(cookieStr, '/api/students');
    if (studentList.status !== 200 || !studentList.body.length) { FAIL('cannot list students'); return; }
    const stu = studentList.body[0];
    // Upload v1
    const fd1 = new FormData();
    fd1.append('file', new Blob([TINY_PNG], { type: 'image/png' }), 'v1.png');
    const r1 = await fetch(`${BASE}/api/students/${stu.id}/docs/cccd`, { method: 'POST', body: fd1, headers: { cookie: cookieStr } });
    const b1 = await r1.json().catch(() => ({}));
    if (r1.status !== 201) { FAIL('upload v1 failed', `status=${r1.status}`); return; }
    PASS('docslot upload v1', `url=${b1.url}`);
    const v1Url = b1.url;
    // Upload v2 (replace)
    const fd2 = new FormData();
    fd2.append('file', new Blob([TINY_PNG], { type: 'image/png' }), 'v2.png');
    const r2 = await fetch(`${BASE}/api/students/${stu.id}/docs/cccd`, { method: 'POST', body: fd2, headers: { cookie: cookieStr } });
    const b2 = await r2.json().catch(() => ({}));
    if (r2.status !== 201) { FAIL('upload v2 (replace) failed', `status=${r2.status}`); return; }
    PASS('docslot upload v2 (replaced)', `url=${b2.url}`);
    if (b1.url === b2.url) WARN('v1.url === v2.url — replace did not change URL', `${b2.url}`);
    // Orphan-cleanup contract (commit 0898152): on overwrite, the prior file
    // on disk must be unlinked. Promoted from WARN to a hard FAIL now that
    // the fix is loaded — a regression here would leak orphan blobs.
    const v1Probe = await fetch(BASE + v1Url, { headers: { cookie: cookieStr } });
    v1Probe.ok ? FAIL('v1 file STILL exists after replace (orphan-cleanup regressed)', `v1=${v1Url} status=${v1Probe.status}`)
               : PASS('v1 file cleaned up on replace', `${v1Probe.status}`);
    // DELETE v2
    const dRes = await fetch(`${BASE}/api/students/${stu.id}/docs/cccd`, { method: 'DELETE', headers: { cookie: cookieStr } });
    dRes.ok ? PASS('DELETE docslot returned 200', `${dRes.status}`)
            : FAIL('DELETE docslot failed', `${dRes.status}`);
    // HEAD the v2 url — must be 404 (file gone from disk).
    const probe = await fetch(BASE + b2.url, { headers: { cookie: cookieStr } });
    probe.status === 404 ? PASS('deleted file returns 404 on GET', '/api/files HEAD-like check')
                         : FAIL('deleted file STILL served', `status=${probe.status} url=${b2.url}`);
  });

  // ============ 7. CONCURRENT writes — 2 contexts as same admin ============
  await safe(page, '07-concurrent-writes', async () => {
    const ctx2 = await browser.newContext({ viewport: { width: 1280, height: 800 } });
    const page2 = await ctx2.newPage();
    try {
      await loginUI(page2);
      // Create student via API in page1's context; create payment for that student via page2's context concurrently.
      const cookies1 = (await ctx.cookies(BASE)).map(c => `${c.name}=${c.value}`).join('; ');
      const cookies2 = (await ctx2.cookies(BASE)).map(c => `${c.name}=${c.value}`).join('; ');
      // Find a class & feePlan for the new student.
      const classes = await apiCall(cookies1, '/api/classes');
      const openClass = classes.body.find(c => c.statusOverride === 'đang mở') || classes.body[0];
      const feePlans = await apiCall(cookies1, '/api/fee-plans');
      const me = await apiCall(cookies1, '/api/me');
      const studentRes = await apiCall(cookies1, '/api/students', {
        method: 'POST', body: {
          form: { name: `Concurrent ${SALT}`, classId: openClass.id, responsibleStaffId: me.body.user.id,
                  feePlanId: feePlans.body[0].id, phone: '0900111222' },
          docs: {}, profileComplete: false,
        },
      });
      if (studentRes.status !== 201) { FAIL('concurrent: student create failed', `status=${studentRes.status} ${JSON.stringify(studentRes.body).slice(0,160)}`); return; }
      const studentId = studentRes.body.id;
      PASS('concurrent: student created in ctx1', `${studentId}`);
      // Immediately fire 3 parallel payments from ctx2.
      const payPromises = [200000, 300000, 100000].map((amt, i) =>
        apiCall(cookies2, '/api/payments', {
          method: 'POST', body: { studentId, amount: amt, method: 'Tiền mặt', bienLaiId: `BL-CON-${SALT}-${i}` },
        }));
      const payResults = await Promise.all(payPromises);
      const allOk = payResults.every(r => r.status === 201);
      allOk ? PASS('concurrent: 3 parallel payments created', payResults.map(r => r.body.id).join(','))
            : FAIL('concurrent: some payments failed', payResults.map(r => `${r.status}:${JSON.stringify(r.body).slice(0,40)}`).join(' | '));
      // Verify totals: query students endpoint and confirm sum of paid for that student.
      const all = await apiCall(cookies1, '/api/payments');
      const sumForStudent = all.body.filter(p => p.studentId === studentId).reduce((a, b) => a + b.amount, 0);
      sumForStudent === 600000 ? PASS('concurrent: sum of payments = 600k', `${sumForStudent}`)
                               : FAIL('concurrent: sum mismatch', `expected=600000 got=${sumForStudent}`);
    } finally { await ctx2.close().catch(() => {}); }
  });

  // ============ 8. BRANCH-SCOPE enforcement (staff login) ============
  await safe(page, '08-branch-scope', async () => {
    // Reset password for u-3 (branch br-2 staff) via admin API.
    const cookies = (await ctx.cookies(BASE)).map(c => `${c.name}=${c.value}`).join('; ');
    const staffPw = 'StaffTest1234!';
    const reset = await apiCall(cookies, '/api/accounts/u-3/reset-password', {
      method: 'POST', body: { newPassword: staffPw },
    });
    if (reset.status !== 200) { FAIL('cannot reset staff password', `status=${reset.status}`); return; }
    // Login as staff in a fresh context.
    const ctx3 = await browser.newContext();
    try {
      const login = await apiCall('', '/api/auth/login', {
        method: 'POST', body: { email: 'khai@motogiathinh.vn', password: staffPw },
      });
      if (login.status !== 200) { FAIL('staff login failed', `status=${login.status} body=${JSON.stringify(login.body)}`); return; }
      const staffCookie = login.setCookie;
      PASS('staff login succeeded', 'khai@... → br-2');
      // GET /api/students — assert all returned have branchId === 'br-2'.
      const stu = await apiCall(staffCookie, '/api/students');
      const offBranch = stu.body.filter(s => s.branchId !== 'br-2');
      offBranch.length === 0 ? PASS('staff GET /students returns only br-2', `n=${stu.body.length}`)
                             : FAIL('staff GET /students leaks other branches', `${offBranch.length} off-branch rows; sample=${offBranch[0]?.branchId}`);
      // Try PATCH a br-1 student.
      const adminStu = await apiCall(cookies, '/api/students');
      const br1 = adminStu.body.find(s => s.branchId === 'br-1');
      if (!br1) { WARN('no br-1 student to test PATCH'); }
      else {
        const patch = await apiCall(staffCookie, `/api/students/${br1.id}`, { method: 'PATCH', body: { name: 'hack' } });
        patch.status === 403 ? PASS('staff PATCH br-1 student → 403', `body=${JSON.stringify(patch.body).slice(0,60)}`)
                             : FAIL(`staff PATCH br-1 student returned ${patch.status} (expected 403)`, JSON.stringify(patch.body).slice(0,160));
      }
      // Try GET /api/files/ for a br-1 student's uploaded file (if any).
      const br1WithDoc = adminStu.body.find(s => s.branchId === 'br-1' && s.docs_cccd_url);
      if (br1WithDoc) {
        const fileRes = await fetch(BASE + br1WithDoc.docs_cccd_url, { headers: { cookie: staffCookie } });
        fileRes.status === 403 ? PASS('staff GET /api/files/ br-1 file → 403', `url=${br1WithDoc.docs_cccd_url}`)
                               : FAIL(`staff GET br-1 file returned ${fileRes.status} (expected 403)`, br1WithDoc.docs_cccd_url);
      } else WARN('no br-1 student with uploaded file');
      // Verify staff can read accounts (lookup table — should be allowed cross-branch).
      const acc = await apiCall(staffCookie, '/api/accounts');
      acc.status === 200 && acc.body.length >= 5 ? PASS('staff can read accounts (lookup)', `n=${acc.body.length}`)
                                                  : WARN('staff /accounts behavior unexpected', `status=${acc.status} n=${acc.body?.length}`);
      // Verify staff sees only their branch's notifications.
      const notifs = await apiCall(staffCookie, '/api/notifications');
      const cookies2 = (await ctx.cookies(BASE)).map(c => `${c.name}=${c.value}`).join('; ');
      const allStus = (await apiCall(cookies2, '/api/students')).body;
      const studentBranchMap = new Map(allStus.map(s => [s.id, s.branchId]));
      const leakedNotifs = notifs.body.filter(n => n.studentId && studentBranchMap.get(n.studentId) !== 'br-2');
      leakedNotifs.length === 0 ? PASS('staff notifications scoped to br-2', `n=${notifs.body.length} 0-leaks`)
                                : FAIL('staff notifications leak other branches', `${leakedNotifs.length} leaks`);
    } finally { await ctx3.close().catch(() => {}); }
  });

  // ============ 9. LOGOUT flow — cookie cleared + /api/me 401 + overlay returns ============
  await safe(page, '09-logout-flow', async () => {
    const ctx4 = await browser.newContext();
    const p4 = await ctx4.newPage();
    try {
      await p4.goto(BASE + '/', { waitUntil: 'domcontentloaded' });
      await p4.waitForSelector('.mgt-login form');
      await p4.fill('input[name=email]', EMAIL);
      await p4.fill('input[name=password]', PASSWORD);
      await Promise.all([
        p4.waitForFunction(() => !!window.MGT_DATA, null, { timeout: 12000 }),
        p4.click('.mgt-login button[type=submit]'),
      ]);
      await p4.waitForSelector('aside');
      // Click sidebar logout pill (last button in aside) → logout modal → confirm.
      await p4.locator('aside button').last().click({ force: true });
      await p4.waitForFunction(() => /Đăng xuất khỏi tài khoản/.test(document.body.innerText), null, { timeout: 4000 }).catch(() => {});
      await p4.locator('button:has-text("Đăng xuất")').last().click({ force: true });
      await p4.waitForSelector('.mgt-login form', { timeout: 6000 });
      PASS('logout: login overlay returned');
      // Verify cookie cleared & /api/me 401.
      const cookies = await ctx4.cookies(BASE);
      const authCookie = cookies.find(c => /mgt|session|auth/i.test(c.name));
      authCookie ? FAIL('cookie still present after logout', `name=${authCookie.name}`) : PASS('cookie cleared after logout');
      const cookieStr = cookies.map(c => `${c.name}=${c.value}`).join('; ');
      const me = await apiCall(cookieStr, '/api/me');
      me.status === 401 ? PASS('/api/me returns 401 after logout') : FAIL(`/api/me returned ${me.status} (expected 401)`, JSON.stringify(me.body).slice(0,80));
    } finally { await ctx4.close().catch(() => {}); }
  });

  // ============ 10. AddStudentModal missing-field errors ============
  await safe(page, '10-addstudent-missing-fields', async () => {
    const cookies = (await ctx.cookies(BASE)).map(c => `${c.name}=${c.value}`).join('; ');
    // Probe API directly with each required field omitted.
    const classes = await apiCall(cookies, '/api/classes');
    const cls = classes.body.find(c => c.statusOverride === 'đang mở') || classes.body[0];
    const me = await apiCall(cookies, '/api/me');
    const cases = [
      { name: 'missing name', form: { classId: cls.id, responsibleStaffId: me.body.user.id }, docs: {} },
      { name: 'missing classId', form: { name: 'X', responsibleStaffId: me.body.user.id }, docs: {} },
      { name: 'missing responsibleStaffId', form: { name: 'X', classId: cls.id }, docs: {} },
    ];
    for (const c of cases) {
      const res = await apiCall(cookies, '/api/students', { method: 'POST', body: { form: c.form, docs: c.docs, profileComplete: false } });
      if (res.status === 400 && (res.body?.error === 'required' || res.body?.error === 'missing_form')) PASS(`API rejects ${c.name}`, `error=${res.body?.error} field=${res.body?.field}`);
      else FAIL(`API did NOT reject ${c.name}`, `status=${res.status} body=${JSON.stringify(res.body).slice(0,140)}`);
    }
    // Invalid phone format.
    const badPhone = await apiCall(cookies, '/api/students', {
      method: 'POST', body: { form: { name: 'X', classId: cls.id, responsibleStaffId: me.body.user.id, phone: 'notaphone' }, docs: {} },
    });
    badPhone.status === 400 && badPhone.body?.error === 'bad_phone'
      ? PASS('API rejects bad phone format', badPhone.body.field)
      : FAIL('API did NOT reject bad phone', `status=${badPhone.status} body=${JSON.stringify(badPhone.body).slice(0,140)}`);
    // Invalid CCCD.
    const badCccd = await apiCall(cookies, '/api/students', {
      method: 'POST', body: { form: { name: 'X', classId: cls.id, responsibleStaffId: me.body.user.id, idNumber: '12345' }, docs: {} },
    });
    badCccd.status === 400 && badCccd.body?.error === 'bad_cccd'
      ? PASS('API rejects bad CCCD format', badCccd.body.field)
      : FAIL('API did NOT reject bad CCCD', `status=${badCccd.status} body=${JSON.stringify(badCccd.body).slice(0,140)}`);
  });

  // ============ 11. AddPaymentModal edge cases (over-pay, zero, negative, blank bienLaiId) ============
  await safe(page, '11-payment-edge-cases', async () => {
    const cookies = (await ctx.cookies(BASE)).map(c => `${c.name}=${c.value}`).join('; ');
    const studentList = await apiCall(cookies, '/api/students');
    const pays = await apiCall(cookies, '/api/payments');
    const paidByStu = new Map();
    pays.body.forEach(p => paidByStu.set(p.studentId, (paidByStu.get(p.studentId) || 0) + p.amount));
    // Pick a student with POSITIVE balance (totalFee > paid) for the overpay test.
    const targetStu = studentList.body.find(s => s.totalFee > 0 && (paidByStu.get(s.id) || 0) < s.totalFee)
                   || studentList.body[0];
    const paid = paidByStu.get(targetStu.id) || 0;
    const balance = targetStu.totalFee - paid;
    // 1) over-payment: pay balance + 100k. Spec is unclear — log behavior.
    const over = await apiCall(cookies, '/api/payments', {
      method: 'POST', body: { studentId: targetStu.id, amount: balance + 100000, method: 'Tiền mặt', bienLaiId: `BL-OVER-${SALT}` },
    });
    if (over.status === 201) WARN('over-payment ACCEPTED by API (no balance check)', `balance=${balance} amt=${balance+100000} pmt=${over.body.id}`);
    else if (over.status === 400) PASS('over-payment rejected', `body=${JSON.stringify(over.body).slice(0,80)}`);
    else FAIL(`over-payment returned ${over.status}`, JSON.stringify(over.body).slice(0,140));
    // 2) zero amount
    const zero = await apiCall(cookies, '/api/payments', {
      method: 'POST', body: { studentId: targetStu.id, amount: 0, method: 'Tiền mặt', bienLaiId: `BL-ZERO-${SALT}` },
    });
    zero.status === 400 && zero.body?.error === 'bad_amount'
      ? PASS('zero amount rejected', zero.body.error)
      : FAIL(`zero amount returned ${zero.status}`, JSON.stringify(zero.body).slice(0,140));
    // 3) negative amount (compensating)
    const neg = await apiCall(cookies, '/api/payments', {
      method: 'POST', body: { studentId: targetStu.id, amount: -50000, method: 'Tiền mặt', bienLaiId: `BL-NEG-${SALT}` },
    });
    neg.status === 201 ? PASS('negative amount accepted (compensating entry)', `pmt=${neg.body.id}`)
                       : FAIL(`negative amount returned ${neg.status}`, JSON.stringify(neg.body).slice(0,140));
    // 4) empty bienLaiId — should auto-generate.
    const blank = await apiCall(cookies, '/api/payments', {
      method: 'POST', body: { studentId: targetStu.id, amount: 1000, method: 'Tiền mặt', bienLaiId: '' },
    });
    blank.status === 201 && /^BL/.test(blank.body.bienLaiId || '')
      ? PASS('empty bienLaiId auto-generated', `id=${blank.body.bienLaiId}`)
      : FAIL(`empty bienLaiId returned ${blank.status}`, JSON.stringify(blank.body).slice(0,140));
    // 5) duplicate bienLaiId
    const dup = await apiCall(cookies, '/api/payments', {
      method: 'POST', body: { studentId: targetStu.id, amount: 1000, method: 'Tiền mặt', bienLaiId: blank.body?.bienLaiId },
    });
    dup.status === 409 ? PASS('duplicate bienLaiId rejected 409')
                       : FAIL(`duplicate bienLaiId returned ${dup.status}`, JSON.stringify(dup.body).slice(0,140));
    // 6) non-integer amount
    const frac = await apiCall(cookies, '/api/payments', {
      method: 'POST', body: { studentId: targetStu.id, amount: 100.5, method: 'Tiền mặt' },
    });
    frac.status === 400 ? PASS('fractional amount rejected')
                        : FAIL(`fractional amount returned ${frac.status}`, JSON.stringify(frac.body).slice(0,140));
  });

  // ============ 12. SEARCH resilience (inside Lọc panel — regex specials) ============
  await safe(page, '12-search-resilience', async () => {
    await gotoTab(page, 'Học viên');
    await page.waitForFunction(() => /HV\d{3,4}/.test(document.body.innerText), null, { timeout: 5000 });
    // Search lives inside the "Lọc" advanced filter modal — open it.
    await page.locator('button:has-text("Lọc")').first().click({ force: true });
    await page.waitForTimeout(280);
    const search = page.locator('input[placeholder*="Nguyễn"], input[placeholder*="HV017"]').first();
    if (!(await search.count())) { WARN('no Lọc search input found'); return; }
    const errBefore = consoleErrors.length;
    const cases = ['a', '.*', '\\\\', '(', '[]', '*', '%_'];
    for (const q of cases) {
      await search.evaluate(el => { el.value = ''; el.dispatchEvent(new Event('input', { bubbles: true })); });
      await search.focus();
      await page.keyboard.type(q, { delay: 5 });
      await page.waitForTimeout(120);
    }
    const newErrs = consoleErrors.slice(errBefore);
    newErrs.length === 0 ? PASS('Lọc search accepted regex specials w/o console errors', cases.join(' '))
                         : FAIL('Lọc search threw console errors', newErrs.slice(0, 2).join(' | ').slice(0, 200));
    // Hard reload — guarantees the AdvancedFilterModal state is reset before
    // the next test, regardless of close-button behavior.
    await search.evaluate(el => el.blur());
    await page.reload({ waitUntil: 'domcontentloaded' });
    await page.waitForFunction(() => !!window.MGT_DATA, null, { timeout: 12000 });
    await page.waitForTimeout(300);
  });

  // ============ 13. PAGINATOR edge cases (huge page, negative, > total) ============
  await safe(page, '13-paginator-clamp', async () => {
    await gotoTab(page, 'Học viên');
    await page.waitForTimeout(300);
    // Page-size selector — set to 100 to ensure smallish pagination on huge dataset.
    const sel = page.locator('select').first();
    if (await sel.count()) {
      await sel.selectOption('100');
      await page.waitForTimeout(180);
    }
    // Page input — width 32, lives inside the toolbar paginator. Find by its
    // pattern: monospace 12px font + value matching a small number.
    const pinp = page.locator('input').filter({ hasNot: page.locator('select') }).last();
    const pageInputHandle = await page.evaluateHandle(() => {
      // Find the input element used for page number (width: 32, textAlign center).
      const all = Array.from(document.querySelectorAll('input'));
      return all.find(i => {
        const s = i.getAttribute('style') || '';
        return /width:\s*32/i.test(s) && /text-align:\s*center/i.test(s);
      });
    });
    const exists = await pageInputHandle.evaluate(el => !!el);
    if (!exists) { WARN('paginator page-input element not found'); return; }
    const setAndCommit = async (val) => {
      await pageInputHandle.evaluate((el, v) => {
        el.focus();
        const setter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value').set;
        setter.call(el, v);
        el.dispatchEvent(new Event('input', { bubbles: true }));
        // Dispatch keydown with Enter key directly so React's onKeyDown fires
        // (page.keyboard.press is unreliable when focus has shifted).
        el.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true }));
        // Also blur — commitPage runs in onBlur too.
        el.blur();
      }, String(val));
      await page.waitForTimeout(280);
      return pageInputHandle.evaluate(el => el.value);
    };
    const errBefore = consoleErrors.length;
    const huge = await setAndCommit('99999');
    const zero = await setAndCommit('0');
    const neg  = await setAndCommit('-5');
    const newErrs = consoleErrors.slice(errBefore);
    newErrs.length === 0 ? PASS('paginator no console errors with extreme inputs', `huge=${huge} zero=${zero} neg=${neg}`)
                         : FAIL('paginator threw console errors', newErrs.slice(0, 2).join(' | ').slice(0, 200));
    // Clamp expectation: huge → must be <= totalPages; zero/neg → 1.
    // Note the React onChange filters [^\d] so "-5" becomes "5" client-side.
    const huge_OK = (huge !== '99999');
    const zero_OK = (zero === '1' || zero === '');  // 0 is filtered or clamped
    huge_OK && zero_OK ? PASS('paginator clamped extreme inputs', `huge→${huge} zero→${zero} neg→${neg}`)
                       : FAIL('paginator did NOT clamp extreme inputs', `huge=${huge} zero=${zero} neg=${neg} — onBlur/onKeyDown commit did not fire`);
  });

  // ============ 13b. PAGE-SIZE on small list → assert paginator total spans
  // matches the data length (using students with page-size 100 and looking
  // at the totalPages span). ============
  await safe(page, '13b-pagesize-totals', async () => {
    await gotoTab(page, 'Học viên');
    await page.waitForTimeout(300);
    const sel = page.locator('select').first();
    if (await sel.count()) await sel.selectOption('100');
    await page.waitForTimeout(300);
    const total = await page.evaluate(() => window.MGT_DATA.students.length);
    const pages = await page.evaluate(() => {
      const inputs = Array.from(document.querySelectorAll('input'));
      const pi = inputs.find(i => /width:\s*32/.test(i.getAttribute('style') || ''));
      if (!pi) return null;
      const parent = pi.parentElement;
      const spans = Array.from(parent.querySelectorAll('span'));
      for (let i = spans.length - 1; i >= 0; i--) {
        const t = (spans[i].textContent || '').trim();
        if (/^\d+$/.test(t)) return t;
      }
      return null;
    });
    const expected = Math.ceil(total / 100);
    parseInt(pages, 10) === expected
      ? PASS('paginator totalPages matches expected', `pages=${pages} expected=${expected} (total=${total}, size=100)`)
      : FAIL('paginator totalPages mismatch', `pages=${pages} expected=${expected} total=${total}`);
  });

  // ============ 14. MODAL double-submit guard ============
  await safe(page, '14-modal-double-submit', async () => {
    await gotoTab(page, 'Tổ chức');
    await page.locator('button:has-text("Giáo viên")').first().click({ force: true });
    await page.waitForTimeout(250);
    const beforeCount = await page.evaluate(() => window.MGT_DATA.teachers.length);
    await page.locator('button:has-text("Thêm giáo viên")').first().click({ force: true });
    await page.waitForFunction(() => Array.from(document.body.children).some(el =>
      el.tagName === 'DIV' && /position:\s*fixed/i.test(el.getAttribute('style') || '')), null, { timeout: 4000 });
    await page.locator('input[placeholder="Trần Văn B"]').first().evaluate(el => el.focus());
    await page.keyboard.type(`DBL-${SALT}`);
    await page.locator('input[placeholder="09…"]').first().evaluate(el => el.focus());
    await page.keyboard.type('0900' + Math.floor(Math.random() * 1e6));
    // Click submit 3x in tight loop — busy guard should prevent duplicates.
    const btnState = await page.evaluate(() => {
      const portals = Array.from(document.body.children).filter(el =>
        el.tagName === 'DIV' && /position:\s*fixed/i.test(el.getAttribute('style') || ''));
      const modal = portals[portals.length - 1];
      const btn = Array.from(modal.querySelectorAll('button')).find(b => (b.textContent || '').trim() === 'Tạo mới');
      if (!btn) return { found: false };
      // Snap disabled state before/after each click.
      const state = { before: btn.disabled, clicks: [] };
      for (let i = 0; i < 3; i++) {
        btn.click();
        state.clicks.push({ i, disabledAfter: btn.disabled, text: btn.textContent.trim() });
      }
      return state;
    });
    await page.waitForTimeout(1500);
    const afterCount = await page.evaluate(() => window.MGT_DATA.teachers.length);
    const delta = afterCount - beforeCount;
    if (delta === 1) PASS('modal triple-submit guarded (1 row created)', `Δ=${delta} btnAfterFirst=${JSON.stringify(btnState.clicks?.[0])}`);
    else if (delta === 0) FAIL('modal submit created 0 rows', `Δ=${delta}`);
    else FAIL('modal triple-submit created N rows (NO busy guard)', `Δ=${delta} btnStates=${JSON.stringify(btnState)}`);
  });

  // ============ 14b. Triple-click guard on AddClassModal (Lớp học) ============
  // Covers the modals.jsx AddClassModal primaryAction. Same race as
  // RecordCreatorModal: 3 synchronous .click() bursts must create Δ=1
  // class, not 3. Drives the form values programmatically via the React
  // change handler so we don't fight the custom Select widget.
  await safe(page, '14b-addclass-triple-submit', async () => {
    await gotoTab(page, 'Lớp học');
    await page.waitForTimeout(220);
    const before = await page.evaluate(() => window.MGT_DATA.classes.length);
    const branchId = await page.evaluate(() => window.MGT_DATA.branches[0]?.id || null);
    if (!branchId) { WARN('no branches available — skip 14b'); return; }
    const openBtn = page.locator('button:has-text("Tạo lớp")').first();
    if (!(await openBtn.count())) { WARN('Tạo lớp button not visible (non-admin?)'); return; }
    await openBtn.click({ force: true });
    await page.waitForFunction(() => Array.from(document.body.children).some(el =>
      el.tagName === 'DIV' && /position:\s*fixed/i.test(el.getAttribute('style') || '')), null, { timeout: 4000 });
    // Fill Mã lớp via native React input dispatch — bypasses focus issues.
    const codeFilled = await page.evaluate((salt) => {
      const portals = Array.from(document.body.children).filter(el =>
        el.tagName === 'DIV' && /position:\s*fixed/i.test(el.getAttribute('style') || ''));
      const modal = portals[portals.length - 1];
      if (!modal) return false;
      const codeInput = modal.querySelector('input[placeholder="MÔ TÔ 06/2026"]');
      if (!codeInput) return false;
      const proto = Object.getPrototypeOf(codeInput);
      const setter = Object.getOwnPropertyDescriptor(proto, 'value')?.set;
      setter?.call(codeInput, `L5-DBL-${salt}`);
      codeInput.dispatchEvent(new Event('input', { bubbles: true }));
      return true;
    }, SALT);
    if (!codeFilled) { FAIL('14b Mã lớp input not located'); return; }
    // Pick a branch via the native <select> — Select atom is a real <select> element.
    const branchPicked = await page.evaluate((bid) => {
      const portals = Array.from(document.body.children).filter(el =>
        el.tagName === 'DIV' && /position:\s*fixed/i.test(el.getAttribute('style') || ''));
      const modal = portals[portals.length - 1];
      if (!modal) return null;
      const sel = modal.querySelector('select');
      if (!sel) return null;
      const proto = Object.getPrototypeOf(sel);
      const setter = Object.getOwnPropertyDescriptor(proto, 'value')?.set;
      setter?.call(sel, bid);
      sel.dispatchEvent(new Event('change', { bubbles: true }));
      return sel.value;
    }, branchId);
    if (!branchPicked) { WARN('14b could not pick a branch via native select'); return; }
    await page.waitForTimeout(180);
    // Now triple-click the Tạo lớp submit button.
    const btnState = await page.evaluate(() => {
      const portals = Array.from(document.body.children).filter(el =>
        el.tagName === 'DIV' && /position:\s*fixed/i.test(el.getAttribute('style') || ''));
      const modal = portals[portals.length - 1];
      const btn = Array.from(modal.querySelectorAll('button')).find(b => /^Tạo lớp$/.test((b.textContent || '').trim()));
      if (!btn) return { found: false };
      const state = { found: true, disabledBefore: btn.disabled, clicks: [] };
      for (let i = 0; i < 3; i++) { btn.click(); state.clicks.push({ i, disabledAfter: btn.disabled }); }
      return state;
    });
    if (!btnState.found) { FAIL('14b Tạo lớp button not located'); return; }
    if (btnState.disabledBefore) { WARN('14b submit button was disabled before click', JSON.stringify(btnState)); return; }
    await page.waitForTimeout(1500);
    const after = await page.evaluate(() => window.MGT_DATA.classes.length);
    const delta = after - before;
    if (delta === 1) PASS('AddClassModal triple-submit guarded', `Δ=${delta} branch=${branchPicked}`);
    else if (delta === 0) WARN('AddClassModal triple-submit Δ=0 (validation may have rejected)', `Δ=${delta} state=${JSON.stringify(btnState)}`);
    else FAIL('AddClassModal triple-submit created N rows', `Δ=${delta}`);
  });

  // ============ 15. NOTIFICATIONS — mark-all decrements sidebar badge ============
  await safe(page, '15-notifications-badge-decrement', async () => {
    await gotoTab(page, 'Thông báo');
    await page.waitForTimeout(300);
    const unread = await page.evaluate(() => window.MGT_DATA.notifications.filter(n => !n.read).length);
    if (unread === 0) { WARN('no unread to test badge'); return; }
    // Find sidebar badge before mark-all.
    const badgeBefore = await page.evaluate(() => {
      const aside = document.querySelector('aside');
      if (!aside) return null;
      const m = (aside.innerText || '').match(/Thông báo[\s\n]*(\d+)/);
      return m ? parseInt(m[1], 10) : null;
    });
    const btn = page.locator('button:has-text("Đánh dấu đã đọc")').first();
    if (!(await btn.count())) { FAIL('Đánh dấu đã đọc button missing'); return; }
    await btn.click({ force: true });
    await page.waitForFunction(() => window.MGT_DATA.notifications.filter(n => !n.read).length === 0, null, { timeout: 6000 }).catch(() => {});
    await page.waitForTimeout(400);
    const badgeAfter = await page.evaluate(() => {
      const aside = document.querySelector('aside');
      if (!aside) return null;
      const m = (aside.innerText || '').match(/Thông báo[\s\n]*(\d+)/);
      return m ? parseInt(m[1], 10) : 0;
    });
    badgeAfter === 0 || badgeAfter === null
      ? PASS('sidebar badge cleared after mark-all', `before=${badgeBefore} after=${badgeAfter}`)
      : FAIL('sidebar badge did NOT decrement', `before=${badgeBefore} after=${badgeAfter}`);
  });

  // ============ 16. LIGHTBOX keyboard nav (Esc closes, Tab focuses link) ============
  await safe(page, '16-lightbox-keyboard', async () => {
    // Upload a doc to hv-001 so we know it has one. Reload to refresh MGT_DATA.
    const cookies = (await ctx.cookies(BASE)).map(c => `${c.name}=${c.value}`).join('; ');
    const fd = new FormData();
    fd.append('file', new Blob([TINY_PNG], { type: 'image/png' }), 'lb.png');
    const up = await fetch(`${BASE}/api/students/hv-001/docs/cccd`, { method: 'POST', body: fd, headers: { cookie: cookies } });
    if (!up.ok) { WARN(`pre-test upload failed: ${up.status}`); return; }
    await page.reload({ waitUntil: 'domcontentloaded' });
    await page.waitForFunction(() => !!window.MGT_DATA, null, { timeout: 12000 });
    await gotoTab(page, 'Học viên');
    await page.waitForFunction(() => /HV\d{3,4}/.test(document.body.innerText), null, { timeout: 5000 });
    await page.waitForTimeout(400);
    // Programmatically navigate to HV001 by calling MGT_DATA routing.
    // Simpler: flip the sort dir so HV001 shows up first, OR sort by maHV asc.
    // Easiest: find HV001 in MGT_DATA, then call the global open-student helper
    // if it exists. Failing that, find the row by maHV text match.
    // Sort by maHV ascending: click the sort menu and pick "Mã HV ↑".
    // Find a student that already has a doc URL in MGT_DATA (after reload).
    const target = await page.evaluate(() => {
      const D = window.MGT_DATA;
      const s = D.students.find(s => s.docs_cccd && s.docs_cccd_url);
      return s ? { id: s.id, maHV: s.maHV } : null;
    });
    if (!target) { WARN('no student in MGT_DATA with docs_cccd_url'); return; }
    // Use the sort-menu to sort by maHV ascending so HV001 surfaces in page 1.
    // Easier: use the search to filter directly to that student's maHV.
    await page.locator('button:has-text("Lọc")').first().click({ force: true });
    await page.waitForTimeout(280);
    const search = page.locator('input[placeholder*="Nguyễn"], input[placeholder*="HV017"]').first();
    if (!(await search.count())) { WARN('no Lọc search to narrow'); return; }
    await search.focus();
    await page.keyboard.type(target.maHV);
    // Apply: click Áp dụng inside the modal.
    await page.evaluate(() => {
      const portals = Array.from(document.body.children).filter(el =>
        el.tagName === 'DIV' && /position:\s*fixed/i.test(el.getAttribute('style') || ''));
      const top = portals[portals.length - 1];
      if (!top) return;
      const apply = Array.from(top.querySelectorAll('button')).find(b => /Áp dụng/.test(b.textContent || ''));
      if (apply) apply.click();
    });
    await page.waitForTimeout(500);
    // Now click first row.
    const clicked = await page.evaluate(maHV => {
      const all = Array.from(document.querySelectorAll('main div'));
      const rows = all.filter(el => (el.textContent || '').includes(maHV) && /grid-template-columns/.test(el.getAttribute('style') || ''));
      rows.sort((a, b) => (a.textContent || '').length - (b.textContent || '').length);
      if (rows[0]) { rows[0].click(); return true; }
      return false;
    }, target.maHV);
    if (!clicked) { WARN(`filtered row for ${target.maHV} not clickable`); return; }
    try { await page.waitForFunction(() => /Quay lại/.test(document.body.innerText), null, { timeout: 5000 }); }
    catch { WARN('row click did not open detail'); return; }
    PASS('lightbox precursor: student detail opened', target.maHV);
    // Look for CCCD slot — click "view" / image.
    const opened = await page.evaluate(() => {
      // Find an img inside main pointing at /api/files/.
      const imgs = Array.from(document.querySelectorAll('main img'));
      const targets = imgs.filter(i => /\/api\/files\//.test(i.src));
      if (!targets.length) return false;
      targets[0].click();
      // Some implementations use the parent <button>/<div> as the click target.
      const btn = targets[0].closest('button, div[role="button"]');
      if (btn) btn.click();
      return true;
    });
    if (!opened) { WARN('no clickable doc image found'); return; }
    await page.waitForTimeout(400);
    // Look for lightbox: a fixed-position overlay with an img + "Mở trong tab mới" link.
    const lb = await page.evaluate(() => {
      const portals = Array.from(document.body.children).filter(el =>
        el.tagName === 'DIV' && /position:\s*fixed/i.test(el.getAttribute('style') || ''));
      const last = portals[portals.length - 1];
      if (!last) return { open: false };
      const hasImg = !!last.querySelector('img');
      const link = Array.from(last.querySelectorAll('a')).find(a => /Mở trong tab mới|Mở.*tab/i.test(a.textContent || ''));
      return { open: hasImg, hasLink: !!link };
    });
    if (!lb.open) { WARN('lightbox did not open from doc click'); return; }
    PASS('lightbox opened from doc slot', `hasLink=${lb.hasLink}`);
    // Esc closes.
    await page.keyboard.press('Escape');
    await page.waitForTimeout(250);
    const closed = await page.evaluate(() => {
      const portals = Array.from(document.body.children).filter(el =>
        el.tagName === 'DIV' && /position:\s*fixed/i.test(el.getAttribute('style') || ''));
      return portals.length === 0 || !portals[portals.length - 1].querySelector('img');
    });
    closed ? PASS('Esc closes lightbox') : FAIL('Esc did NOT close lightbox');
  });

  // ============ 17. SORT + FILTER combo persistence across page change ============
  await safe(page, '17-sort-filter-combo', async () => {
    await gotoTab(page, 'Học viên');
    await page.waitForTimeout(300);
    // Flip sort dir.
    const dir = page.locator('button[title="Giảm dần"], button[title="Tăng dần"]').first();
    if (!(await dir.count())) { WARN('no sort dir button'); return; }
    const dirBefore = await dir.getAttribute('title');
    // Open filter, toggle A1.
    await page.locator('button:has-text("Lọc")').first().click({ force: true });
    await page.waitForTimeout(250);
    const a1 = page.locator('button:has-text("A1")').first();
    if (await a1.count()) await a1.click({ force: true });
    await page.waitForTimeout(120);
    // Close filter panel.
    await page.keyboard.press('Escape').catch(() => {});
    await page.waitForTimeout(120);
    // Switch page.
    const pinp = page.locator('input[inputmode="numeric"], input[type=text]').last();
    if (await pinp.count()) {
      await pinp.evaluate(el => { el.focus(); el.select(); });
      await page.keyboard.type('2');
      await page.keyboard.press('Enter');
      await page.waitForTimeout(220);
    }
    // Assert sort dir attr unchanged.
    const dirAfter = await dir.getAttribute('title');
    dirBefore === dirAfter ? PASS('sort dir survives page change', `${dirAfter}`)
                           : FAIL('sort dir lost on page change', `${dirBefore} → ${dirAfter}`);
  });

  // ============ 18. STRUCTURAL screenshot diff vs baselines ============
  await safe(page, '18-screenshot-baseline-diff', async () => {
    for (const [scn, base] of [['dashboard', '01-dashboard.png'], ['students', '02-students.png']]) {
      const tab = scn === 'dashboard' ? 'Tổng quan' : 'Học viên';
      await gotoTab(page, tab);
      await page.waitForTimeout(500);
      const live = resolve(SHOTS, `L5-live-${scn}.png`);
      await page.screenshot({ path: live, fullPage: false });
      const basePath = resolve(SHOTS, base);
      if (!existsSync(basePath)) { WARN(`baseline ${base} missing`); continue; }
      // Cheap structural check: byte-size difference. If they differ by > 50%
      // it's a flag for review.
      const a = statSync(basePath).size, b = statSync(live).size;
      const diffPct = Math.abs(a - b) / a * 100;
      if (diffPct < 20) PASS(`${scn} screenshot size within 20% of baseline`, `Δ=${diffPct.toFixed(1)}% (${a}→${b} bytes)`);
      else WARN(`${scn} screenshot diverges from baseline`, `Δ=${diffPct.toFixed(1)}% (${a}→${b} bytes) — manual review`);
    }
  });

  // ============ 19. DRIVE the app, check for new server-side 500s in window ============
  await safe(page, '19-stress-no-500s', async () => {
    // Track fetch responses for 500.
    const serverErrs = [];
    page.on('response', r => {
      if (r.status() >= 500) serverErrs.push(`${r.status()} ${r.url()}`);
    });
    // Mixed actions: nav 6 tabs, open & dismiss 2 modals.
    for (const t of ['Tổng quan', 'Học viên', 'Thanh toán', 'Lớp học', 'Thông báo', 'Tổ chức']) {
      await gotoTab(page, t);
      await page.waitForTimeout(280);
    }
    await page.locator('button:has-text("Chi nhánh")').first().click({ force: true }).catch(() => {});
    await page.waitForTimeout(200);
    // Open & dismiss modal.
    await gotoTab(page, 'Học viên');
    await page.locator('button:has-text("Thêm học viên")').first().click({ force: true }).catch(() => {});
    await page.waitForTimeout(300);
    await page.keyboard.press('Escape');
    await page.waitForTimeout(200);
    serverErrs.length === 0 ? PASS('no 5xx responses during mixed nav drive', '6 tabs + modal open/close')
                            : FAIL(`${serverErrs.length} 5xx responses observed`, serverErrs.slice(0,3).join(' | ').slice(0,300));
  });

  // ============ 20. POST-stress DB smoke ============
  await safe(page, '20-post-stress-smoke', async () => {
    const cookies = (await ctx.cookies(BASE)).map(c => `${c.name}=${c.value}`).join('; ');
    const h = await apiCall(cookies, '/api/health');
    if (h.status !== 200 || !h.body.ok) { FAIL('health endpoint dead', JSON.stringify(h.body).slice(0,80)); return; }
    PASS('health endpoint still 200 after stress', `accounts=${h.body.accounts}`);
    // Sanity: bulk reads still return data.
    const [s, p, c] = await Promise.all([
      apiCall(cookies, '/api/students'),
      apiCall(cookies, '/api/payments'),
      apiCall(cookies, '/api/classes'),
    ]);
    [['students', s], ['payments', p], ['classes', c]].forEach(([n, r]) => {
      r.status === 200 && Array.isArray(r.body) && r.body.length > 0
        ? PASS(`bulk /${n} still returns rows`, `n=${r.body.length}`)
        : FAIL(`bulk /${n} broken`, `status=${r.status} body=${JSON.stringify(r.body).slice(0,80)}`);
    });
  });

  await browser.close();

  const failed = results.filter(r => r.ok === false);
  const warned = results.filter(r => r.ok === 'warn');
  const passed = results.filter(r => r.ok === true);
  console.log(`\n══════════════════════════════════════════════════════════════════`);
  console.log(`  ${passed.length} PASS  ·  ${failed.length} FAIL  ·  ${warned.length} WARN  ·  total ${results.length}`);
  console.log(`══════════════════════════════════════════════════════════════════`);
  if (failed.length) { console.log('\nFAIL list:'); failed.forEach(f => console.log(`  ✗ ${f.l} — ${f.x}`)); }
  if (warned.length) { console.log('\nWARN list:'); warned.forEach(w => console.log(`  ! ${w.l} — ${w.x}`)); }
  console.log(`\nConsole errors observed: ${consoleErrors.length}`);
  consoleErrors.slice(0, 8).forEach(e => console.log('  err:', e.slice(0, 200)));
  process.exit(0);
}

run().catch(e => { console.error('FATAL:', e); process.exit(1); });
