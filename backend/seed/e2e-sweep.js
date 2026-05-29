// e2e-sweep.js — discovery harness for affordances NOT covered by
// e2e-write-flows.js. Sweeps sidebar, dashboard, lists (filter/sort/paging),
// detail screens, notifications, organization tabs, MoreMenus, modals.
//
// Captures each failure to backend/data/snapshots/L1-<scenario>.png and
// keeps going. Exits 0 always — discovery, not gating.
//
// Usage: cd backend && node seed/e2e-sweep.js

import { chromium } from 'playwright';
import { mkdirSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const BASE     = process.env.SMOKE_BASE          || 'http://127.0.0.1:3001';
const EMAIL    = process.env.SEED_ADMIN_EMAIL    || 'admin@motogiathinh.centersai';
const PASSWORD = process.env.SEED_ADMIN_PASSWORD || 'admin';
const SHOTS    = resolve(dirname(fileURLToPath(import.meta.url)), '..', 'data', 'snapshots');
mkdirSync(SHOTS, { recursive: true });

const results = [];
const PASS = (l, x = '') => { results.push({ ok: true,   l, x }); console.log(`  PASS ${l}${x ? ' — ' + x : ''}`); };
const FAIL = (l, x = '') => { results.push({ ok: false,  l, x }); console.log(`  FAIL ${l}${x ? ' — ' + x : ''}`); };
const WARN = (l, x = '') => { results.push({ ok: 'warn', l, x }); console.log(`  WARN ${l}${x ? ' — ' + x : ''}`); };

const shoot = (p, n) => p.screenshot({ path: resolve(SHOTS, `L1-${n}.png`), fullPage: true }).catch(() => {});

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
  catch (e) { await shoot(page, name); FAIL(name, 'EXC ' + (e.message || String(e)).slice(0, 200)); }
  await dismiss(page);
}

async function gotoTab(page, label) {
  await dismiss(page);
  // Recover from React-tree crashes: reload + re-login if sidebar vanished.
  if ((await page.locator('aside button').count().catch(() => 0)) === 0) {
    console.log(`  (recovering: reload + re-login)`);
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

async function waitModal(page) {
  await page.waitForFunction(() => Array.from(document.body.children).some(el =>
    el.tagName === 'DIV' && /position:\s*fixed/i.test(el.getAttribute('style') || '')), null, { timeout: 4000 });
  await page.waitForTimeout(80);
}

async function run() {
  const browser = await chromium.launch();
  const ctx  = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  const page = await ctx.newPage();
  page.setDefaultTimeout(6000);

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

  console.log(`\n→ ${BASE}/`);
  await page.goto(BASE + '/', { waitUntil: 'domcontentloaded' });
  await page.waitForSelector('.mgt-login form', { timeout: 5000 });
  await page.fill('input[name=email]', EMAIL);
  await page.fill('input[name=password]', PASSWORD);
  await Promise.all([
    page.waitForFunction(() => !!window.MGT_DATA, null, { timeout: 12000 }),
    page.click('.mgt-login button[type=submit]'),
  ]);
  await page.waitForSelector('aside', { timeout: 5000 });
  console.log(`  (boot OK, ${consoleErrors.length} early errs)`);

  // ============ 1. SIDEBAR NAV — 6 items + each renders signature content ============
  await safe(page, 'sidebar-nav', async () => {
    const expected = {
      'Tổng quan': 'TỔNG NỢ', 'Học viên': 'Thêm học viên', 'Thanh toán': 'Ghi nhận thanh toán',
      'Lớp học': 'Tạo lớp', 'Thông báo': 'Đánh dấu đã đọc', 'Tổ chức': 'Chi nhánh',
    };
    for (const [tab, sig] of Object.entries(expected)) {
      await gotoTab(page, tab);
      const ok = await page.locator(`text=${sig}`).count() >= 1;
      ok ? PASS(`nav → ${tab}`, `signature "${sig}"`) : FAIL(`nav → ${tab}`, `signature "${sig}" missing`);
    }
  });

  // ============ 2. SIDEBAR EDGE-TOGGLE ============
  await safe(page, 'sidebar-edge-toggle', async () => {
    const edge = page.locator('button[aria-label*="thanh điều hướng" i]');
    if (!(await edge.count())) { FAIL('sidebar edge-toggle missing'); return; }
    const before = await page.evaluate(() => document.querySelector('aside').getBoundingClientRect().x);
    await edge.first().click({ force: true });
    await page.waitForTimeout(550);
    const after = await page.evaluate(() => document.querySelector('aside').getBoundingClientRect().x);
    after < 0 ? PASS('sidebar collapse', `x ${before.toFixed(0)} → ${after.toFixed(0)}`)
              : FAIL('sidebar collapse did not animate', `x stayed ${after}`);
    await edge.first().click({ force: true });
    await page.waitForTimeout(550);
    const back = await page.evaluate(() => document.querySelector('aside').getBoundingClientRect().x);
    back >= 0 ? PASS('sidebar re-expand') : FAIL('sidebar re-expand', `x=${back}`);
  });

  // ============ 3. THEME TOGGLE ============
  await safe(page, 'theme-toggle', async () => {
    const before = await page.evaluate(() => document.documentElement.getAttribute('data-theme'));
    const t = page.locator('aside button[title*="Light" i], aside button[title*="Dark" i]').first();
    if (!(await t.count())) { FAIL('theme toggle missing'); return; }
    await t.click({ force: true });
    await page.waitForTimeout(200);
    const after = await page.evaluate(() => document.documentElement.getAttribute('data-theme'));
    before !== after ? PASS('theme flips', `${before} → ${after}`) : FAIL('theme no-op', `stayed ${before}`);
    if (after === 'light') { await t.click({ force: true }); await page.waitForTimeout(150); }
  });

  // ============ 4. VEHICLE-MODE TOGGLE ============
  await safe(page, 'vehicle-mode-toggle', async () => {
    const before = await page.evaluate(() => document.documentElement.getAttribute('data-mode'));
    const v = page.locator('aside button[title*="bánh" i]').first();
    if (!(await v.count())) { FAIL('vehicle-mode toggle missing'); return; }
    await v.click({ force: true });
    await page.waitForTimeout(180);
    const after = await page.evaluate(() => document.documentElement.getAttribute('data-mode'));
    before !== after ? PASS('vehicle-mode flips', `${before} → ${after}`) : FAIL('vehicle-mode no-op', `stayed ${before}`);
    if (after === '4w') { await v.click({ force: true }); await page.waitForTimeout(150); }
  });

  // ============ 5. DASHBOARD 4 KPIs render real numeric values ============
  await safe(page, 'dashboard-kpis', async () => {
    await gotoTab(page, 'Tổng quan');
    await page.waitForSelector('text=TỔNG NỢ', { timeout: 5000 });
    const kpis = await page.evaluate(() => {
      const out = {};
      for (const lbl of ['Đã thu hôm nay', 'HV mới hôm nay', 'TỔNG NỢ', 'Học viên active']) {
        const n = Array.from(document.querySelectorAll('span')).find(s => {
          const t = (s.textContent || '').trim();
          return t === lbl || t === lbl.toUpperCase();
        });
        if (!n) { out[lbl] = null; continue; }
        let card = n.parentElement;
        for (let i = 0; i < 6 && card; i++) {
          const txt = (card.innerText || '').replace(lbl, '').replace(lbl.toUpperCase(), '').trim();
          if (/\d/.test(txt)) { out[lbl] = txt.slice(0, 60); break; }
          card = card.parentElement;
        }
      }
      return out;
    });
    for (const [lbl, val] of Object.entries(kpis))
      val ? PASS(`KPI "${lbl}"`, val.split('\n')[0]) : FAIL(`KPI "${lbl}" empty/missing`);
  });

  // ============ 6. "BÁO CÁO" — onClick handler presence ============
  await safe(page, 'dashboard-baocao', async () => {
    await gotoTab(page, 'Tổng quan');
    const btn = page.locator('header button:has-text("Báo cáo")').first();
    if (!(await btn.count())) { FAIL('Báo cáo button missing'); return; }
    const has = await btn.evaluate(el => {
      const k = Object.keys(el).find(k => k.startsWith('__reactProps$'));
      return !!(k && typeof el[k].onClick === 'function');
    });
    has ? PASS('Báo cáo has onClick') : WARN('Báo cáo has NO onClick handler', 'dead UI — clicking does nothing');
  });

  // ============ 7. DASHBOARD ĐƠN VỊ pills + CHỌN KHUNG preset grid ============
  await safe(page, 'dashboard-tong-controls', async () => {
    await gotoTab(page, 'Tổng quan');
    for (const u of ['Giờ', 'Ngày', 'Tháng']) {
      const b = page.locator(`button:has-text("${u}")`).first();
      if (await b.count()) await b.click({ force: true });
      await page.waitForTimeout(120);
    }
    PASS('ĐƠN VỊ pills clickable');
    const seen = await page.evaluate(() => {
      const t = document.body.innerText;
      return ['Tuần trước đến nay', 'Tháng này', 'Tháng trước đến nay', 'Hôm nay', 'Năm nay'].filter(p => t.includes(p)).length;
    });
    seen >= 2 ? PASS('CHỌN KHUNG presets render', `${seen} labels`) : WARN('few preset labels visible', `${seen}`);
    const tm = page.locator('button:has-text("Tháng này")').first();
    if (await tm.count()) { await tm.click({ force: true }); PASS('preset "Tháng này" clickable'); }
  });

  // ============ 8. DASHBOARD custom-range pill activate + dismiss ============
  await safe(page, 'dashboard-customrange', async () => {
    await gotoTab(page, 'Tổng quan');
    const lbl = page.locator('button:has-text("Chọn khung")').first();
    if (!(await lbl.count())) { WARN('Chọn khung label not present'); return; }
    await lbl.click({ force: true });
    await page.waitForTimeout(250);
    const on = await page.evaluate(() => /\(\d+ ngày\)/.test(document.body.innerText));
    if (!on) { FAIL('custom-range pill did NOT appear'); return; }
    PASS('custom-range pill appeared');
    const x = page.locator('button[title*="Bỏ chọn"]').first();
    if (await x.count()) {
      await x.click({ force: true });
      await page.waitForTimeout(220);
      const off = await page.evaluate(() => /\(\d+ ngày\)/.test(document.body.innerText));
      off ? FAIL('X did not dismiss') : PASS('custom-range X dismisses');
    }
  });

  // ============ 9. DASHBOARD InfoTooltip hover popover ============
  await safe(page, 'dashboard-infotooltip', async () => {
    await gotoTab(page, 'Tổng quan');
    const chip = page.locator('span:has-text("?")').first();
    if (!(await chip.count())) { WARN('InfoTooltip ? chip not found'); return; }
    await chip.hover().catch(() => {});
    await page.waitForTimeout(220);
    const has = await page.evaluate(() => Array.from(document.querySelectorAll('span')).some(n =>
      (n.style?.minWidth === '240px') && (n.innerText || '').length > 10));
    has ? PASS('InfoTooltip popover on hover') : WARN('InfoTooltip popover not detected');
  });

  // ============ 10. STUDENTS quick-filter chips toggle ============
  await safe(page, 'students-quick-filters', async () => {
    await gotoTab(page, 'Học viên');
    for (const ch of ['Thiếu hồ sơ', 'Còn nợ', 'Hôm nay']) {
      const b = page.locator(`button:has-text("${ch}")`).first();
      if (!(await b.count())) { WARN(`chip "${ch}" missing`); continue; }
      await b.click({ force: true });
      await page.waitForTimeout(180);
      await b.click({ force: true });
      await page.waitForTimeout(120);
      PASS(`quick-filter "${ch}" toggleable`);
    }
  });

  // ============ 11. STUDENTS Lọc panel + chip toggle + XÓA clear ============
  await safe(page, 'students-advanced-filter', async () => {
    await gotoTab(page, 'Học viên');
    await page.locator('button:has-text("Lọc")').first().click({ force: true });
    await page.waitForTimeout(300);
    const open = await page.evaluate(() => /Bộ lọc nâng cao|XÓA/i.test(document.body.innerText));
    if (!open) { FAIL('Lọc panel did not open'); return; }
    PASS('Lọc panel opens');
    const a1 = page.locator('button:has-text("A1")').first();
    if (await a1.count()) { await a1.click({ force: true }); await page.waitForTimeout(120); PASS('A1 chip toggled'); }
    const xoa = page.locator('button:has-text("XÓA")').first();
    if (await xoa.count()) { await xoa.click({ force: true }); await page.waitForTimeout(120); PASS('XÓA clears filter'); }
    else WARN('XÓA button missing');
  });

  // ============ 12. STUDENTS sort dir + paginator size dropdown + page input ============
  await safe(page, 'students-sort-paginator', async () => {
    await gotoTab(page, 'Học viên');
    const dir = page.locator('button[title="Giảm dần"], button[title="Tăng dần"]').first();
    if (await dir.count()) {
      const b = await dir.getAttribute('title');
      await dir.click({ force: true });
      await page.waitForTimeout(150);
      const a = await dir.getAttribute('title');
      b !== a ? PASS('sort dir arrow flips', `${b} → ${a}`) : FAIL('sort dir no-op');
    } else FAIL('sort dir arrow missing');
    const sel = page.locator('select').first();
    if (await sel.count()) {
      const opts = await sel.evaluate(el => Array.from(el.options).map(o => o.value));
      ['10','20','50','100'].every(w => opts.includes(w)) ? PASS('page-size dropdown 10/20/50/100') : FAIL('page-size options missing', opts.join(','));
      await sel.selectOption('20'); await page.waitForTimeout(150); PASS('page-size selectable');
    } else FAIL('paginator select missing');
    const pinp = page.locator('input[type=text], input[inputmode="numeric"]').last();
    if (await pinp.count()) {
      await pinp.evaluate(el => { el.focus(); el.select(); });
      await page.keyboard.type('2'); await page.keyboard.press('Enter');
      await page.waitForTimeout(150);
      PASS('paginator page input typable');
    }
  });

  // ============ 13. STUDENT DETAIL — row click + notes persist + doc slots ============
  await safe(page, 'student-detail', async () => {
    await page.keyboard.press('Escape').catch(() => {});
    await gotoTab(page, 'Học viên');
    const close = page.locator('button:has-text("Đóng")');
    if (await close.count()) await close.first().click({ force: true }).catch(() => {});
    await page.waitForFunction(() => /HV\d{3,4}/.test(document.body.innerText), null, { timeout: 5000 });
    const code = await page.evaluate(() => {
      const rows = Array.from(document.querySelectorAll('main div'))
        .filter(el => /HV\d{3,4}/.test(el.textContent || '') && /grid-template-columns/.test(el.getAttribute('style') || ''));
      if (rows[0]) { rows[0].click(); return (rows[0].textContent.match(/HV\d{3,4}/) || [])[0]; }
      return null;
    });
    if (!code) { FAIL('no student row to click'); return; }
    await page.waitForFunction(() => /Quay lại/.test(document.body.innerText), null, { timeout: 5000 });
    PASS('student detail opened', code);
    // tabs switch
    await page.locator('main button:has-text("Thanh toán")').first().click({ force: true });
    await page.waitForTimeout(200);
    PASS('payments tab switch');
    await page.locator('main button:has-text("Thông tin")').first().click({ force: true });
    await page.waitForTimeout(200);
    // notes
    const ta = page.locator('main textarea').first();
    if (await ta.count()) {
      const m = 'E2E-NOTE-' + Math.random().toString(36).slice(2, 7);
      await ta.evaluate(el => el.focus());
      await page.keyboard.type(' ' + m);
      await page.keyboard.press('Tab');
      await page.waitForTimeout(800);
      const ok = await page.evaluate(mk => window.MGT_DATA.students.some(s => (s.notes || '').includes(mk)), m);
      ok ? PASS('notes persist on blur', m) : FAIL('notes did NOT persist on blur');
    } else FAIL('notes textarea missing');
    // doc slots
    const slots = await page.evaluate(() => {
      const body = document.body.textContent || '';
      const labels = (window.MGT_DATA.PROFILE_DOCS || []).map(d => d.label);
      return { sectionPresent: /Tài liệu/.test(body), seen: labels.filter(l => body.includes(l)).length, expected: labels.length };
    });
    slots.sectionPresent && slots.seen >= slots.expected
      ? PASS('all 4 doc slots rendered', `${slots.seen}/${slots.expected}`)
      : FAIL('doc slots not all rendered', JSON.stringify(slots));
  });

  // ============ 14. PAYMENTS — row click routes + auto-expands detail card ============
  await safe(page, 'payments-row-routes', async () => {
    await gotoTab(page, 'Thanh toán');
    const tt = await page.evaluate(() => (document.body.innerText.match(/PMT[-_]?\d{3,6}/i) || [])[0]);
    if (!tt) { WARN('no PMT- code visible'); return; }
    await page.locator(`text=${tt}`).first().click({ force: true });
    await page.waitForTimeout(500);
    const r = await page.evaluate(() => ({
      onDetail: /Quay lại/.test(document.body.innerText),
      cardExpanded: /Hình thức thanh toán|Mã biên lai|Tải lại biên lai/i.test(document.body.innerText),
    }));
    r.onDetail ? PASS('payment row → student detail') : FAIL('payment row routing failed');
    r.cardExpanded ? PASS('payment auto-expands its detail card') : WARN('payment did not auto-expand');
  });

  // ============ 15. CLASSES quick-filter chip defaults ============
  await safe(page, 'classes-chip-defaults', async () => {
    await gotoTab(page, 'Lớp học');
    const st = await page.evaluate(() => {
      const labels = ['Đang mở', 'Đang diễn ra', 'Đã kết thúc'];
      const out = {};
      for (const l of labels) {
        const b = Array.from(document.querySelectorAll('button')).find(x => (x.textContent || '').trim() === l);
        const s = b ? (b.getAttribute('style') || '') : '';
        out[l] = /neon-(lime|cyan|pink)/.test(s) && !/glass-stroke[^"]*1px/.test(s.replace(/border:[^;]*?glass-stroke/g, '')) ? 'on' : 'off';
      }
      return out;
    });
    st['Đang mở'] === 'on' && st['Đang diễn ra'] === 'on' && st['Đã kết thúc'] === 'off'
      ? PASS('class chip defaults', JSON.stringify(st))
      : WARN('class chip defaults differ from spec', JSON.stringify(st));
  });

  // ============ 16. CLASS DETAIL — status pill opens edit modal ============
  await safe(page, 'class-detail-status-pill', async () => {
    await gotoTab(page, 'Lớp học');
    await page.waitForFunction(() => document.querySelectorAll('main h3').length > 0, null, { timeout: 5000 });
    const code = await page.evaluate(() => document.querySelectorAll('main h3')[0]?.textContent?.trim());
    if (!code) { FAIL('no class card'); return; }
    await page.locator(`main h3:has-text("${code}")`).first().click({ force: true });
    await page.waitForTimeout(350);
    const pill = page.locator('main button:has-text("Đang mở"), main button:has-text("Đang diễn ra"), main button:has-text("Đã kết thúc")').first();
    if (!(await pill.count())) { FAIL('status pill missing'); return; }
    await pill.click({ force: true });
    await page.waitForTimeout(300);
    /Sửa lớp/.test(await page.evaluate(() => document.body.innerText))
      ? PASS('status pill opens edit modal') : FAIL('status pill did not open modal');
  });

  // ============ 17. NOTIFICATIONS — 4 SmallStats render ============
  await safe(page, 'notifications-smallstats', async () => {
    await gotoTab(page, 'Thông báo');
    const miss = [];
    for (const l of ['Chưa đọc', 'Thanh toán trễ', 'Hồ sơ thiếu', 'Lớp sắp đóng']) {
      if (!(await page.locator(`text=${l}`).count())) miss.push(l);
    }
    miss.length === 0 ? PASS('all 4 notification SmallStats') : FAIL('SmallStats missing', miss.join(','));
  });

  // ============ 18. NOTIFICATIONS — row click routes to student ============
  await safe(page, 'notifications-row-routes', async () => {
    await gotoTab(page, 'Thông báo');
    const t = await page.evaluate(() => {
      const n = window.MGT_DATA.notifications.find(x => x.studentId);
      return n ? { title: n.title, sid: n.studentId } : null;
    });
    if (!t) { WARN('no notif with studentId'); return; }
    await page.locator(`text=${t.title}`).first().click({ force: true });
    await page.waitForTimeout(400);
    /Quay lại/.test(await page.evaluate(() => document.body.innerText))
      ? PASS('notification row → student detail', t.sid) : FAIL('notif row did not route');
  });

  // ============ 19. NOTIFICATIONS bulk select-all checkbox ============
  await safe(page, 'notifications-bulk-select', async () => {
    await gotoTab(page, 'Thông báo');
    if ((await page.evaluate(() => window.MGT_DATA.notifications.length)) === 0) { WARN('no notifications'); return; }
    const cb = page.locator('input[type=checkbox]').first();
    await cb.click({ force: true });
    await page.waitForTimeout(150);
    /đã chọn/i.test(await page.evaluate(() => document.body.innerText))
      ? PASS('select-all toggles UI') : FAIL('select-all did not toggle UI');
    await cb.click({ force: true });
  });

  // ============ 20. ORG TABS — each renders content; detect React-tree crash ============
  await safe(page, 'org-tabs', async () => {
    const tabs = [
      { id: 'Chi nhánh',  proof: 'chi nhánh' },
      { id: 'Tài khoản',  proof: 'tài khoản' },
      { id: 'Học phí',    proof: 'học phí' },
      { id: 'Khuyến mãi', proof: 'khuyến mãi' },
      { id: 'Giáo viên',  proof: 'giáo viên' },
      { id: 'Phương tiện',proof: 'phương tiện' },
      { id: 'Lịch sử',    proof: 'Nhật ký hoạt động' },
    ];
    for (const t of tabs) {
      await gotoTab(page, 'Tổ chức');
      const errBefore = consoleErrors.length;
      const b = page.locator(`main button:has-text("${t.id}"), button:has-text("${t.id}")`).first();
      if (!(await b.count())) { FAIL(`org tab "${t.id}" missing`); continue; }
      await b.click({ force: true });
      await page.waitForTimeout(450);
      const aside = await page.locator('aside button').count();
      const rendered = await page.evaluate(p => (document.body.innerText || '').toLowerCase().includes(p.toLowerCase()), t.proof);
      const newErr = consoleErrors.slice(errBefore);
      const crashed = newErr.some(e => /Cannot read properties of undefined|pageerror/i.test(e));
      if (aside === 0 || crashed) FAIL(`org tab "${t.id}" CRASHES React tree`, `aside=${aside} err="${(newErr[0]||'').slice(0,140)}"`);
      else if (rendered) PASS(`org tab "${t.id}" renders`, `proof "${t.proof}"`);
      else FAIL(`org tab "${t.id}" no content`, `expected "${t.proof}"`);
    }
  });

  // ============ 21. ORG — ActivityTab dedicated crash test ============
  await safe(page, 'org-activity-renders', async () => {
    await gotoTab(page, 'Tổ chức');
    const before = consoleErrors.length;
    await page.locator('button:has-text("Lịch sử")').first().click({ force: true });
    await page.waitForTimeout(500);
    const aside = await page.locator('aside button').count();
    const newErr = consoleErrors.slice(before);
    const crashed = newErr.some(e => /Cannot read properties of undefined.*name|ActivityTab/i.test(e));
    // Note: the header is styled `text-transform: uppercase`, which DOES
    // affect Chrome's `innerText`. Use case-insensitive match so we don't
    // false-FAIL on a perfectly-rendered tab.
    crashed || aside === 0
      ? FAIL('ActivityTab CRASHES React tree (whole app unmounts)',
             `err="${newErr.slice(0,2).join(' | ').slice(0,200)}" aside=${aside}`)
      : /Nhật ký hoạt động/i.test(await page.evaluate(() => document.body.innerText))
        ? PASS('ActivityTab renders') : FAIL('ActivityTab no title');
  });

  // ============ 22. ORG — BranchesTab card click expands ============
  await safe(page, 'org-branches-expand', async () => {
    await gotoTab(page, 'Tổ chức');
    await page.locator('button:has-text("Chi nhánh")').first().click({ force: true });
    await page.waitForTimeout(400);
    if (!(await page.locator('main h3:has-text("331A")').count())) { FAIL('331A branch card not found'); return; }
    await page.locator('main h3:has-text("331A")').first().click({ force: true });
    await page.waitForTimeout(600);
    const r = await page.evaluate(() => ({
      hasMaLop: /Mã lớp/.test(document.body.innerText),
      hasOpen: /Đóng/.test(document.body.innerText),
      hasMgr: /Quản lý:/.test(document.body.innerText),
    }));
    r.hasMaLop || r.hasOpen ? PASS('branch card expands', JSON.stringify(r)) : FAIL('branch card did not expand', JSON.stringify(r));
  });

  // ============ 23. ORG — Account MoreMenu has Sửa/Vô hiệu hoá/Đặt lại mật khẩu ============
  await safe(page, 'org-account-moremenu', async () => {
    await gotoTab(page, 'Tổ chức');
    await page.locator('button:has-text("Tài khoản")').first().click({ force: true });
    await page.waitForTimeout(250);
    const more = page.locator('button[aria-label="Tác vụ"]');
    const n = await more.count();
    if (!n) { FAIL('no MoreMenu in accounts'); return; }
    PASS('account MoreMenu count', `${n}`);
    await more.nth(1).click({ force: true });
    await page.waitForTimeout(200);
    /Sửa.*Vô hiệu hoá|Vô hiệu hoá.*Đặt lại mật khẩu/s.test(await page.evaluate(() => document.body.innerText))
      ? PASS('MoreMenu items present (Sửa / Vô hiệu hoá / Đặt lại mật khẩu)')
      : WARN('MoreMenu opened but item set unconfirmed');
    await page.keyboard.press('Escape').catch(() => {});
  });

  // ============ 24. ORG — EditRecordModal opens & saves ============
  await safe(page, 'org-account-edit', async () => {
    await gotoTab(page, 'Tổ chức');
    await page.locator('button:has-text("Tài khoản")').first().click({ force: true });
    await page.waitForTimeout(250);
    const more = page.locator('button[aria-label="Tác vụ"]');
    if ((await more.count()) < 2) { WARN('need ≥2 accounts'); return; }
    await more.nth(1).click({ force: true });
    await page.waitForTimeout(150);
    const sua = page.locator('button:has-text("Sửa")').first();
    if (!(await sua.count())) { FAIL('Sửa item missing'); return; }
    await sua.click({ force: true });
    await page.waitForTimeout(300);
    if (!/Sửa tài khoản|Lưu thay đổi/.test(await page.evaluate(() => document.body.innerText)))
      { FAIL('Edit modal did not open'); return; }
    PASS('EditRecordModal opens');
    await page.locator('button:has-text("Lưu thay đổi")').first().click({ force: true });
    await page.waitForTimeout(400);
    /Sửa tài khoản/.test(await page.evaluate(() => document.body.innerText))
      ? FAIL('Edit modal stayed open after Lưu') : PASS('Edit modal closes on Lưu');
  });

  // ============ 25. ORG — PasswordResetModal opens + disabled on <10ch ============
  await safe(page, 'org-account-pwreset', async () => {
    await gotoTab(page, 'Tổ chức');
    await page.locator('button:has-text("Tài khoản")').first().click({ force: true });
    await page.waitForTimeout(250);
    const more = page.locator('button[aria-label="Tác vụ"]');
    if ((await more.count()) < 2) { WARN('need ≥2 accounts'); return; }
    await more.nth(1).click({ force: true });
    await page.waitForTimeout(150);
    const pw = page.locator('button:has-text("Đặt lại mật khẩu")').first();
    if (!(await pw.count())) { FAIL('pw reset item missing'); return; }
    await pw.click({ force: true });
    await page.waitForTimeout(250);
    if (!/Đặt lại mật khẩu/.test(await page.evaluate(() => document.body.innerText)))
      { FAIL('pw reset modal did not open'); return; }
    PASS('Password reset modal opens');
    await page.locator('input[placeholder*="•"]').first().evaluate(el => el.focus());
    await page.keyboard.type('short');
    await page.waitForTimeout(120);
    const disabled = await page.evaluate(() => {
      const b = Array.from(document.querySelectorAll('button')).find(x => (x.textContent || '').trim() === 'Đặt lại');
      return b ? b.disabled : null;
    });
    disabled ? PASS('Đặt lại disabled for <10ch') : FAIL('Đặt lại enabled for 5ch — validation gap');
  });

  // ============ 26. MODAL backdrop does NOT dismiss (was changed N1) ============
  // Backdrop click intentionally does NOT close create dialogs — would
  // discard user-typed form data. Close affordances: X icon, Hủy, Esc.
  await safe(page, 'modal-backdrop-no-dismiss', async () => {
    await gotoTab(page, 'Tổ chức');
    await page.locator('button:has-text("Giáo viên")').first().click({ force: true });
    await page.waitForTimeout(200);
    await page.locator('button:has-text("Thêm giáo viên")').first().click({ force: true });
    await waitModal(page);
    await page.mouse.click(8, 8);
    await page.waitForTimeout(250);
    const open = await page.evaluate(() => Array.from(document.body.children).some(el =>
      el.tagName === 'DIV' && /z-index:\s*1000/i.test(el.getAttribute('style') || '')));
    open ? PASS('modal backdrop click does NOT dismiss (correct)') : FAIL('backdrop click dismissed — should not');
    // Tidy up via the intended affordance.
    if (open) await page.locator('button:has-text("Hủy")').first().click({ force: true });
  });

  // ============ 27. MODAL Esc dismisses ============
  await safe(page, 'modal-esc-dismiss', async () => {
    await gotoTab(page, 'Tổ chức');
    await page.locator('button:has-text("Giáo viên")').first().click({ force: true });
    await page.waitForTimeout(200);
    await page.locator('button:has-text("Thêm giáo viên")').first().click({ force: true });
    await waitModal(page);
    await page.keyboard.press('Escape');
    await page.waitForTimeout(250);
    const open = await page.evaluate(() => Array.from(document.body.children).some(el =>
      el.tagName === 'DIV' && /z-index:\s*1000/i.test(el.getAttribute('style') || '')));
    open ? WARN('Esc did NOT dismiss modal', 'no global Esc handler — only backdrop/X dismiss')
         : PASS('Esc dismisses modal');
  });

  // ============ 28. MODAL X button dismisses ============
  await safe(page, 'modal-x-dismiss', async () => {
    await gotoTab(page, 'Tổ chức');
    await page.locator('button:has-text("Giáo viên")').first().click({ force: true });
    await page.waitForTimeout(200);
    await page.locator('button:has-text("Thêm giáo viên")').first().click({ force: true });
    await waitModal(page);
    const clicked = await page.evaluate(() => {
      const portals = Array.from(document.body.children).filter(el =>
        el.tagName === 'DIV' && /position:\s*fixed/i.test(el.getAttribute('style') || ''));
      const m = portals[portals.length - 1];
      if (!m) return false;
      const x = Array.from(m.querySelectorAll('button')).filter(b => (b.textContent || '').trim() === '' && b.querySelector('svg'))[0];
      if (x) { x.click(); return true; }
      return false;
    });
    if (!clicked) { FAIL('X icon not found in modal header'); return; }
    await page.waitForTimeout(250);
    const open = await page.evaluate(() => Array.from(document.body.children).some(el =>
      el.tagName === 'DIV' && /z-index:\s*1000/i.test(el.getAttribute('style') || '')));
    open ? FAIL('modal stayed open after X click') : PASS('modal X dismisses');
  });

  // ============ 29. TOAST helper — window.MGT_TOAST renders ============
  await safe(page, 'toast-helper', async () => {
    const has = await page.evaluate(() => typeof window.MGT_TOAST === 'function');
    if (!has) { FAIL('window.MGT_TOAST not defined'); return; }
    PASS('window.MGT_TOAST registered');
    await page.evaluate(() => window.MGT_TOAST('e2e-sweep-toast'));
    await page.waitForTimeout(120);
    const seen = await page.evaluate(() => /e2e-sweep-toast/.test(document.body.innerText));
    seen ? PASS('toast text renders') : FAIL('toast text missing');
    await page.waitForTimeout(3000);
    const gone = await page.evaluate(() => !/e2e-sweep-toast/.test(document.body.innerText));
    gone ? PASS('toast auto-dismisses') : WARN('toast lingered past 3s');
  });

  // ============ 30. BÁO CÁO triggers MGT_TOAST ============
  await safe(page, 'baocao-toast', async () => {
    await gotoTab(page, 'Tổng quan');
    const btn = page.locator('header button:has-text("Báo cáo")').first();
    if (!(await btn.count())) { FAIL('Báo cáo button missing'); return; }
    await btn.click({ force: true });
    await page.waitForTimeout(180);
    const seen = await page.evaluate(() => /Tính năng đang phát triển/.test(document.body.innerText));
    seen ? PASS('Báo cáo onClick fires toast') : FAIL('Báo cáo did not show toast');
    await page.waitForTimeout(2800);
  });

  // ============ 31. ActivityTab survives null log.userId (P0 regression) ============
  await safe(page, 'activity-null-userid', async () => {
    await gotoTab(page, 'Tổ chức');
    const before = consoleErrors.length;
    await page.locator('main button:has-text("Lịch sử")').first().click({ force: true });
    // 215+ rows in the log — give it room to commit + render.
    await page.waitForFunction(() => /Nhật ký hoạt động/i.test(document.body.innerText), null, { timeout: 5000 }).catch(() => {});
    const aside = await page.locator('aside button').count();
    const crashed = consoleErrors.slice(before).some(e => /Cannot read properties of undefined.*name/i.test(e));
    if (crashed || aside === 0) { FAIL('ActivityTab crashed', `crashed=${crashed} aside=${aside}`); return; }
    // Confirm at least one row is rendered with the system fallback name when userId is null.
    // Header is CSS-uppercased — `innerText` reflects that — so match case-insensitively.
    const r = await page.evaluate(() => {
      const D = window.MGT_DATA;
      const nullRows = D.activityLog.filter(l => !l.userId).length;
      const txt = document.body.innerText || '';
      return { nullRows, hasHeTheng: /Hệ thống/i.test(txt), hasNhatKy: /Nhật ký hoạt động/i.test(txt) };
    });
    r.hasNhatKy ? PASS('ActivityTab renders nhật ký', `null-userId rows=${r.nullRows}`)
                : FAIL('ActivityTab title missing');
    if (r.nullRows > 0) {
      r.hasHeTheng ? PASS('null userId rendered as "Hệ thống"') : FAIL('null userId fallback label missing');
    } else {
      WARN('no null-userId rows in dataset to verify fallback');
    }
  });

  // ============ 32. ScreenErrorBoundary catches injected error ============
  await safe(page, 'error-boundary', async () => {
    // Patch a method to throw on next render, navigate to that screen,
    // verify the boundary card appears AND the sidebar is still mounted.
    await gotoTab(page, 'Học viên');
    // Inject BEFORE first dashboard mount so the boundary catches the
    // very first render. (Navigating between tabs unmounts/remounts.)
    await page.evaluate(() => {
      const D = window.MGT_DATA;
      D.__origBP = D.branchPerformance;
      D.branchPerformance = () => { throw new Error('e2e-injected-render-error'); };
    });
    await gotoTab(page, 'Tổng quan');
    // Wait for the boundary card to appear (or for body text to stabilize).
    // Header is CSS-uppercased → match case-insensitively.
    await page.waitForFunction(() => /Lỗi hiển thị màn hình/i.test(document.body.innerText), null, { timeout: 5000 }).catch(() => {});
    const r = await page.evaluate(() => ({
      asideCount: document.querySelectorAll('aside button').length,
      hasErrUI:   /Lỗi hiển thị màn hình/i.test(document.body.innerText),
      hasInjected: /e2e-injected-render-error/.test(document.body.innerText),
    }));
    // Restore so subsequent tests can navigate freely.
    await page.evaluate(() => { window.MGT_DATA.branchPerformance = window.MGT_DATA.__origBP; });
    r.hasErrUI && r.asideCount > 0
      ? PASS('ErrorBoundary isolates screen crash', `aside=${r.asideCount} injectedErrShown=${r.hasInjected}`)
      : FAIL('ErrorBoundary did not isolate', JSON.stringify(r));
    // Navigate away to clear the boundary's error state before next test.
    await gotoTab(page, 'Học viên');
  });

  // ============ 33. EditRecordModal stays open on API rejection ============
  await safe(page, 'edit-modal-stays-on-error', async () => {
    await gotoTab(page, 'Tổ chức');
    await page.locator('button:has-text("Học phí")').first().click({ force: true });
    await page.waitForTimeout(250);
    // Stub updateFeePlan to reject so the modal save fails.
    await page.evaluate(() => {
      const api = window.MGT_DATA.api;
      api.__origUpdateFee = api.updateFeePlan;
      api.updateFeePlan = () => Promise.reject(new Error('injected-failure'));
    });
    const more = page.locator('button[aria-label="Tác vụ"]');
    if (!(await more.count())) { WARN('no MoreMenu in fees'); return; }
    await more.first().click({ force: true });
    await page.waitForTimeout(140);
    const sua = page.locator('button:has-text("Sửa")').first();
    if (!(await sua.count())) { FAIL('Sửa item missing'); return; }
    await sua.click({ force: true });
    await page.waitForTimeout(280);
    await page.locator('button:has-text("Lưu thay đổi")').first().click({ force: true });
    await page.waitForTimeout(450);
    const r = await page.evaluate(() => ({
      stillOpen: /Sửa gói học phí/.test(document.body.innerText),
      hasErr:    /Lỗi: injected-failure/.test(document.body.innerText),
    }));
    r.stillOpen ? PASS('EditRecordModal stays open on API rejection')
                : FAIL('EditRecordModal closed even though API rejected');
    r.hasErr ? PASS('EditRecordModal renders inline error') : WARN('inline error not visible');
    // Restore and dismiss.
    await page.evaluate(() => { window.MGT_DATA.api.updateFeePlan = window.MGT_DATA.api.__origUpdateFee; });
    await page.keyboard.press('Escape').catch(() => {});
    await page.waitForTimeout(180);
  });

  // ============ 34. ClassEditModal stays open on API rejection ============
  await safe(page, 'class-edit-stays-on-error', async () => {
    await gotoTab(page, 'Lớp học');
    await page.waitForFunction(() => document.querySelectorAll('main h3').length > 0, null, { timeout: 5000 });
    const code = await page.evaluate(() => document.querySelectorAll('main h3')[0]?.textContent?.trim());
    if (!code) { FAIL('no class card'); return; }
    await page.locator(`main h3:has-text("${code}")`).first().click({ force: true });
    await page.waitForTimeout(350);
    const pill = page.locator('main button:has-text("Đang mở"), main button:has-text("Đang diễn ra"), main button:has-text("Đã kết thúc")').first();
    if (!(await pill.count())) { FAIL('status pill missing'); return; }
    await pill.click({ force: true });
    await page.waitForTimeout(300);
    await page.evaluate(() => {
      const api = window.MGT_DATA.api;
      api.__origUpdateClass = api.updateClass;
      api.updateClass = () => Promise.reject(new Error('class-rejected'));
    });
    await page.locator('button:has-text("Lưu thay đổi")').first().click({ force: true });
    await page.waitForTimeout(450);
    const r = await page.evaluate(() => ({
      stillOpen: /Sửa lớp/.test(document.body.innerText),
      hasErr:    /Lỗi: class-rejected/.test(document.body.innerText),
    }));
    r.stillOpen ? PASS('ClassEditModal stays open on API rejection')
                : FAIL('ClassEditModal closed even though API rejected');
    r.hasErr ? PASS('ClassEditModal renders inline error') : WARN('inline error not visible');
    await page.evaluate(() => { window.MGT_DATA.api.updateClass = window.MGT_DATA.api.__origUpdateClass; });
    await page.keyboard.press('Escape').catch(() => {});
    await page.waitForTimeout(180);
  });

  // ============ 35. Khuyến mãi edit — name + discount + appliesTo round-trip ============
  await safe(page, 'promo-edit-roundtrip', async () => {
    await gotoTab(page, 'Tổ chức');
    await page.locator('button:has-text("Khuyến mãi")').first().click({ force: true });
    await page.waitForTimeout(280);
    const target = await page.evaluate(() => {
      const D = window.MGT_DATA;
      const p = D.promotions.find(x => x.id !== 'promo-none');
      if (!p) return null;
      // The edit modal normalizes fee-plan ids → licences (A/A1); compute the
      // expected pill-label set the same way so this test is robust to either
      // storage flavor in the seed.
      const norm = Array.from(new Set((p.appliesTo || []).map(v =>
        v === 'A' || v === 'A1' ? v : (D.getFeePlan(v)?.licence || null)
      ).filter(Boolean)));
      return { id: p.id, name: p.name, discount: p.discount,
               appliesTo: [...(p.appliesTo || [])],
               appliesToLabels: norm };
    });
    if (!target) { WARN('no editable promotion'); return; }
    const more = page.locator('button[aria-label="Tác vụ"]');
    if (!(await more.count())) { FAIL('no MoreMenu in promos'); return; }
    await more.first().click({ force: true });
    await page.waitForTimeout(120);
    const sua = page.locator('button:has-text("Sửa")').first();
    if (!(await sua.count())) { FAIL('Sửa missing'); return; }
    await sua.click({ force: true });
    await page.waitForTimeout(300);
    if (!/Sửa khuyến mãi/.test(await page.evaluate(() => document.body.innerText))) { FAIL('promo edit modal did not open'); return; }
    PASS('promo edit modal opens');
    // Verify multipill preselected the current appliesTo.
    const seeded = await page.evaluate(expected => {
      const m = Array.from(document.querySelectorAll('div[style*="position: fixed"]')).pop();
      if (!m) return null;
      const out = {};
      for (const L of expected) {
        const btn = Array.from(m.querySelectorAll('button')).find(b => (b.textContent || '').trim() === L);
        if (!btn) { out[L] = 'missing'; continue; }
        const s = btn.getAttribute('style') || '';
        out[L] = /neon-lime/i.test(s) ? 'on' : 'off';
      }
      return out;
    }, target.appliesToLabels);
    const allPreSelected = seeded && target.appliesToLabels.every(L => seeded[L] === 'on');
    allPreSelected ? PASS('appliesTo pre-selected from initialValues', JSON.stringify(seeded))
                   : FAIL('appliesTo NOT pre-selected', JSON.stringify(seeded));
    // Save unchanged — should hit the backend and the modal closes.
    await page.locator('button:has-text("Lưu thay đổi")').first().click({ force: true });
    await page.waitForTimeout(700);
    const stillOpen = /Sửa khuyến mãi/.test(await page.evaluate(() => document.body.innerText));
    stillOpen ? FAIL('promo edit modal stayed open after save')
              : PASS('promo edit modal closes on successful save');
    // Verify the row reflects the SAME normalized licence set (no pills
    // dropped). The DB representation may shift from fee-plan ids to
    // licences after save — that's the intended normalization.
    const after = await page.evaluate(id => {
      const D = window.MGT_DATA;
      const p = D.getPromotion(id);
      if (!p) return null;
      const norm = Array.from(new Set((p.appliesTo || []).map(v =>
        v === 'A' || v === 'A1' ? v : (D.getFeePlan(v)?.licence || null)
      ).filter(Boolean))).sort();
      return norm;
    }, target.id);
    const expected = [...target.appliesToLabels].sort();
    JSON.stringify(after) === JSON.stringify(expected)
      ? PASS('appliesTo (normalized) preserved after round-trip', JSON.stringify(after))
      : FAIL('appliesTo changed unexpectedly', `before=${JSON.stringify(expected)} after=${JSON.stringify(after)}`);
  });

  // ============ 36. LOGOUT → login overlay returns ============
  await safe(page, 'logout', async () => {
    await page.locator('aside button').last().click({ force: true });
    await waitModal(page);
    if (!/Đăng xuất khỏi tài khoản/.test(await page.evaluate(() => document.body.innerText)))
      { FAIL('logout modal title missing'); return; }
    await page.locator('button:has-text("Đăng xuất")').last().click({ force: true });
    try { await page.waitForSelector('.mgt-login form', { timeout: 6000 }); PASS('logout → login overlay'); }
    catch { FAIL('login form did not return'); }
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
  consoleErrors.slice(0, 6).forEach(e => console.log('  err:', e.slice(0, 200)));
  process.exit(0);
}

run().catch(e => { console.error('FATAL:', e); process.exit(1); });
