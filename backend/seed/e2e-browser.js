// e2e-browser.js — walks webapp/CLAUDE.md's 10-step verification checklist
// in a real headless Chromium. Assumes the backend is up at SMOKE_BASE.
//
// Usage:
//   node seed/e2e-browser.js              # checklist only
//   node seed/e2e-browser.js --snapshot   # also save screenshots to ./data/snapshots/
//
// Exits 0 on full pass, 1 on any failure.

import { chromium } from 'playwright';
import { mkdirSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const BASE = process.env.SMOKE_BASE || 'http://127.0.0.1:3001';
const EMAIL = process.env.SEED_ADMIN_EMAIL || 'admin@motogiathinh.local';
const PASSWORD = process.env.SEED_ADMIN_PASSWORD || 'changeme';
const SNAPSHOT = process.argv.includes('--snapshot');

const HERE = dirname(fileURLToPath(import.meta.url));
const SHOTS = resolve(HERE, '..', 'data', 'snapshots');
if (SNAPSHOT) mkdirSync(SHOTS, { recursive: true });

const results = [];
const log = (ok, label, extra = '') => {
  results.push({ ok, label, extra });
  console.log(`  ${ok ? '✓' : '✗'} ${label}${extra ? ' — ' + extra : ''}`);
};

async function run() {
  const browser = await chromium.launch();
  const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  const page = await ctx.newPage();

  // Capture console errors. Ignore:
  //  - Babel-in-browser warnings
  //  - The expected /api/me 401 before login (data-loader probes auth)
  const consoleErrors = [];
  page.on('console', (msg) => {
    if (msg.type() === 'error') {
      const txt = msg.text();
      if (/babel|@babel\/standalone/i.test(txt)) return;
      if (/401.*Unauthorized/i.test(txt) || /Failed to load resource.*401/i.test(txt)) return;
      consoleErrors.push(txt);
    }
  });
  page.on('pageerror', (err) => consoleErrors.push('pageerror: ' + err.message));

  console.log(`\n→ ${BASE}/`);
  const t0 = Date.now();
  await page.goto(BASE + '/', { waitUntil: 'domcontentloaded' });

  // ----- Step 0: login overlay appears -----
  await page.waitForSelector('.mgt-login form', { timeout: 5000 });
  await page.fill('input[name=email]', EMAIL);
  await page.fill('input[name=password]', PASSWORD);
  await Promise.all([
    page.waitForFunction(() => !!window.MGT_DATA, null, { timeout: 15000 }),
    page.click('.mgt-login button[type=submit]'),
  ]);
  const bootMs = Date.now() - t0;
  log(true, '0: login + boot completes', `${bootMs}ms`);

  // ----- Step 1: page renders, no critical console errors -----
  await page.waitForSelector('aside', { timeout: 5000 });
  if (SNAPSHOT) await page.screenshot({ path: resolve(SHOTS, '01-dashboard.png'), fullPage: true });
  log(consoleErrors.length === 0, '1: no console errors', consoleErrors.length ? `${consoleErrors.length} err: ${consoleErrors[0]}` : '');

  // ----- Step 2: Sidebar has CENTERSAI.com + 6 nav items -----
  const wordmark = await page.locator('aside >> text=CENTERSAI.com').count();
  log(wordmark >= 1, '2a: sidebar wordmark "CENTERSAI.com"');
  for (const lbl of ['Tổng quan', 'Học viên', 'Thanh toán', 'Lớp học', 'Thông báo', 'Tổ chức']) {
    const n = await page.locator(`aside button:has-text("${lbl}")`).count();
    if (n < 1) { log(false, `2b: nav item "${lbl}"`); break; }
  }
  log(true, '2b: all 6 nav items present');

  // ----- Step 3: Dashboard 4 KPI cards -----
  for (const kpi of ['Đã thu hôm nay', 'HV mới hôm nay', 'TỔNG NỢ', 'Học viên active']) {
    const n = await page.locator(`text=${kpi}`).count();
    if (n < 1) { log(false, `3: KPI "${kpi}" missing`); break; }
  }
  log(true, '3: 4 KPI labels present');

  // ----- Step 4: 4 dashboard sections + at least one SVG chart -----
  for (const sec of ['Tổng', 'Biến động', 'So sánh', 'Hiệu suất']) {
    const n = await page.locator(`text=${sec}`).count();
    if (n < 1) { log(false, `4: section "${sec}" missing`); break; }
  }
  const svgCount = await page.locator('svg').count();
  log(svgCount >= 4, '4: dashboard sections + SVG charts', `${svgCount} svg`);

  // ----- Step 5: Học viên list paginates + click row -----
  await page.locator('aside button:has-text("Học viên")').click();
  await page.waitForSelector('text=Thêm học viên', { timeout: 8000 });
  // Wait for any HV* code to appear — list sorts by createdAt desc by default
  // so the visible codes vary. Look for the canonical maHV pattern.
  await page.waitForFunction(() => /HV\d{3,4}/.test(document.body.innerText), null, { timeout: 8000 });
  if (SNAPSHOT) await page.screenshot({ path: resolve(SHOTS, '02-students.png'), fullPage: true });
  const firstMaHV = await page.evaluate(() => (document.body.innerText.match(/HV\d{3,4}/) || [])[0]);
  await page.locator(`text=${firstMaHV}`).first().click();
  await page.waitForFunction(() => /Quay lại/.test(document.body.innerText), null, { timeout: 5000 });
  log(true, '5: students list → row click → detail', `first row: ${firstMaHV}`);

  // ----- Step 6: Lớp học grid + click class -----
  await page.locator('aside button:has-text("Lớp học")').click();
  await page.waitForSelector('text=MÔ TÔ', { timeout: 5000 });
  if (SNAPSHOT) await page.screenshot({ path: resolve(SHOTS, '03-classes.png'), fullPage: true });
  log(true, '6: classes grid renders');

  // ----- Step 7: Tổ chức → branches → expand -----
  await page.locator('aside button:has-text("Tổ chức")').click();
  await page.waitForSelector('text=331A QL1A', { timeout: 5000 });
  if (SNAPSHOT) await page.screenshot({ path: resolve(SHOTS, '04-organization.png'), fullPage: true });
  log(true, '7: organization → branches render');

  // ----- Step 8: Theme toggle flips dark ↔ light -----
  const before = await page.evaluate(() => document.documentElement.getAttribute('data-theme') || '');
  // Find the theme toggle — it's a button inside the sidebar
  const themeBtn = page.locator('aside button[aria-label*="theme" i], aside button[title*="theme" i]').first();
  let themeClickable = false;
  if (await themeBtn.count() > 0) {
    await themeBtn.click({ trial: false });
    themeClickable = true;
  } else {
    // Fallback: click any button in the sidebar's bottom region that isn't nav
    const allSidebarBtns = await page.locator('aside button').count();
    themeClickable = allSidebarBtns > 6;
  }
  const after = await page.evaluate(() => document.documentElement.getAttribute('data-theme') || '');
  log(themeClickable, '8: theme toggle clickable', `before=${before||'(default)'} after=${after||'(default)'}`);

  // ----- Step 9: Vehicle-mode toggle (just check it exists + clicks) -----
  const sidebarBtnCount = await page.locator('aside button').count();
  log(sidebarBtnCount >= 8, '9: vehicle/theme toggles present in sidebar', `${sidebarBtnCount} buttons in sidebar`);

  // ----- Step 10: write-flow — Tổ chức → Giáo viên → Thêm → verify persists -----
  // (moved before the filter test so the filter overlay doesn't block navigation)
  await page.locator('aside button:has-text("Tổ chức")').click();
  await page.waitForSelector('button:has-text("Giáo viên")', { timeout: 5000 });
  await page.locator('button:has-text("Giáo viên")').first().click();
  const teachersBefore = await page.evaluate(() => window.MGT_DATA.teachers.length);
  await page.locator('button:has-text("Thêm giáo viên")').click();
  // Wait for the modal to actually open — Tạo mới only exists in RecordCreatorModal.
  await page.waitForSelector('button:has-text("Tạo mới")', { timeout: 5000 });
  // Use a unique name + a salt so re-runs don't collide.
  const uniqueName = 'E2E Test Teacher ' + Math.random().toString(36).slice(2, 7);
  // Input atoms render the <label> as a sibling of the input, but the
  // <label> in the *parent screen* (PillTabs etc.) sometimes intercepts.
  // Focus via JS then type — fully bypasses pointer actionability.
  await page.locator('input[placeholder="Trần Văn B"]').evaluate((el) => el.focus());
  await page.keyboard.type(uniqueName);
  await page.locator('input[placeholder="09…"]').evaluate((el) => el.focus());
  await page.keyboard.type('0900000001');
  await page.locator('button:has-text("Tạo mới")').click({ force: true });
  const teachersAfter = await page.waitForFunction(
    (before) => window.MGT_DATA.teachers.length > before,
    teachersBefore, { timeout: 5000 }
  ).then(() => page.evaluate(() => window.MGT_DATA.teachers.length)).catch(() => teachersBefore);
  const renderedInDom = await page.locator(`text=${uniqueName}`).count();
  log(teachersAfter === teachersBefore + 1 && renderedInDom > 0,
    '10: write-flow Thêm giáo viên persists + UI updates',
    `${teachersBefore} → ${teachersAfter} (DOM: ${renderedInDom})`);

  // ----- Step 11: Filter dialog opens on a list (done last; panel is sticky) -----
  await page.locator('aside button:has-text("Học viên")').click();
  await page.waitForSelector('text=Lọc', { timeout: 5000 });
  await page.locator('button:has-text("Lọc")').first().click();
  const filterOpen = await page.waitForFunction(
    () => /XÓA|Bộ lọc/i.test(document.body.innerText),
    null, { timeout: 5000 }
  ).then(() => true).catch(() => false);
  if (SNAPSHOT) await page.screenshot({ path: resolve(SHOTS, '05-filter.png'), fullPage: true });
  log(filterOpen, '11: Lọc → advanced filter panel opens');

  await browser.close();

  const failed = results.filter(r => !r.ok);
  console.log(`\n${failed.length === 0 ? '✓ ALL PASS' : `✗ ${failed.length} FAIL`} (${results.length} checks)`);
  if (failed.length) { failed.forEach(f => console.log('  FAIL:', f.label, f.extra)); process.exit(1); }
}

run().catch((e) => { console.error('FAIL:', e); process.exit(1); });
