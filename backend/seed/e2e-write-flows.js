// e2e-write-flows.js — exercises every create/edit/delete modal in the app
// via headless Chromium. Mirrors the login + console-error filtering of
// seed/e2e-browser.js. Run: cd backend && node seed/e2e-write-flows.js
// Exits 0 on full pass, 1 on any failure (always finishes every test).

import { chromium } from 'playwright';

const BASE     = process.env.SMOKE_BASE || 'http://127.0.0.1:3001';
const EMAIL    = process.env.SEED_ADMIN_EMAIL || 'admin@motogiathinh.local';
const PASSWORD = process.env.SEED_ADMIN_PASSWORD || 'changeme';
const SALT     = Math.random().toString(36).slice(2, 7);

const results = [];
const recordPass = (label, extra = '') => { results.push({ ok: true, label, extra }); console.log(`  PASS ${label}${extra ? ' — ' + extra : ''}`); };
const recordFail = (label, extra = '') => { results.push({ ok: false, label, extra }); console.log(`  FAIL ${label}${extra ? ' — ' + extra : ''}`); };

async function snapshotFailure(page, consoleErrors) {
  let body = '', url = '';
  try { body = (await page.evaluate(() => document.body.innerText || '')).replace(/\s+/g, ' ').slice(0, 300); } catch {}
  try { url  = page.url(); } catch {}
  return `url=${url} body="${body}" consoleErr="${consoleErrors.slice(-3).join(' || ')}"`;
}

// Focus + keyboard.type bypasses pointer actionability + sibling-<label> intercepts.
async function fillByPlaceholder(page, placeholder, text) {
  await page.locator(`input[placeholder="${placeholder}"]`).first().evaluate((e) => e.focus());
  await page.keyboard.type(text, { delay: 0 });
}

// Set a React-controlled <select> by label, skipping the placeholder option.
async function selectByLabel(page, labelText, optionLabelRegex) {
  await page.evaluate(({ labelText, optionLabelRegex }) => {
    const re = new RegExp(optionLabelRegex, 'i');
    const lbl = Array.from(document.querySelectorAll('label')).find(l => l.textContent.trim() === labelText);
    if (!lbl) throw new Error('label not found: ' + labelText);
    const select = lbl.parentElement && lbl.parentElement.querySelector('select');
    if (!select) throw new Error('select not found for label: ' + labelText);
    const opt = Array.from(select.options).find(o => o.value !== '' && !o.disabled && re.test(o.textContent));
    if (!opt) throw new Error(`option for "${labelText}" matching ${re} not found`);
    const setter = Object.getOwnPropertyDescriptor(window.HTMLSelectElement.prototype, 'value').set;
    setter.call(select, opt.value);
    select.dispatchEvent(new Event('change', { bubbles: true }));
    select.dispatchEvent(new Event('input',  { bubbles: true }));
  }, { labelText, optionLabelRegex });
}

// Click a button by exact text *inside the topmost modal portal* — avoids
// collisions with TopBar buttons sharing the same label (e.g. "Tạo lớp").
async function clickPrimary(page, label = 'Tạo mới') {
  const ok = await page.evaluate((label) => {
    const portals = Array.from(document.body.children).filter(el =>
      el.tagName === 'DIV' && /position:\s*fixed/i.test(el.getAttribute('style') || ''));
    const modal = portals[portals.length - 1];
    const find = (root) => Array.from(root.querySelectorAll('button')).find(b => (b.textContent || '').trim() === label);
    let btn = modal && find(modal); if (!btn) btn = find(document);
    if (btn) { btn.click(); return true; }
    return false;
  }, label);
  if (!ok) throw new Error(`primary button "${label}" not found`);
}

// Wait for any Modal portal (fixed-position, z-index 1000) to appear at body root.
async function waitForModalOpen(page) {
  await page.waitForFunction(() => {
    return Array.from(document.body.children).some(el =>
      el.tagName === 'DIV' && /position:\s*fixed/i.test(el.getAttribute('style') || ''));
  }, null, { timeout: 5000 });
  await page.waitForTimeout(120);
}

// Forcefully dismiss any open Modal between tests.
async function dismissAnyModal(page) {
  try {
    await page.keyboard.press('Escape').catch(() => {});
    await page.waitForTimeout(80);
    const huy = page.locator('button:has-text("Hủy")');
    if (await huy.count() > 0) await huy.first().click({ force: true }).catch(() => {});
    await page.waitForTimeout(80);
    await page.evaluate(() => {
      document.querySelectorAll('div[style*="z-index: 1000"], div[style*="zIndex: 1000"]').forEach(el => el.remove());
    });
  } catch {}
}

async function gotoTab(page, label) {
  await dismissAnyModal(page);
  await page.locator(`aside button:has-text("${label}")`).first().click({ force: true, timeout: 8000 });
  await page.waitForTimeout(250);
}
async function clickOrgTab(page, label) {
  await page.locator(`button:has-text("${label}")`).first().click({ force: true, timeout: 8000 });
  await page.waitForTimeout(250);
}

async function safeRun(page, name, fn) {
  try { await fn(); }
  catch (e) { recordFail(name, 'EXC ' + (e.message || String(e)).slice(0, 240)); }
  await dismissAnyModal(page);
}

// Wait for a counter expression to grow past `before`; record pass/fail.
// arrayPath like 'students', 'payments', etc — read from window.MGT_DATA[path].
async function assertGrew(page, consoleErrors, name, arrayPath, before, timeout = 6000) {
  try {
    await page.waitForFunction(
      ({ p, b }) => (window.MGT_DATA[p] || []).length > b,
      { p: arrayPath, b: before }, { timeout }
    );
    const after = await page.evaluate((p) => window.MGT_DATA[p].length, arrayPath);
    recordPass(name, `${before} → ${after}`);
  } catch { recordFail(name + ' (did not persist)', await snapshotFailure(page, consoleErrors)); }
}

async function run() {
  const browser = await chromium.launch();
  const ctx     = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  const page    = await ctx.newPage();
  page.setDefaultTimeout(8000);

  const consoleErrors = [];
  page.on('console', (msg) => {
    if (msg.type() !== 'error') return;
    const t = msg.text();
    if (/babel|@babel\/standalone/i.test(t)) return;
    if (/401.*Unauthorized/i.test(t) || /Failed to load resource.*401/i.test(t)) return;
    consoleErrors.push(t);
  });
  page.on('pageerror', (err) => consoleErrors.push('pageerror: ' + err.message));
  page.on('dialog',     (d)   => { consoleErrors.push('dialog: ' + d.message()); d.dismiss().catch(() => {}); });

  console.log(`\n→ ${BASE}/`);
  await page.goto(BASE + '/', { waitUntil: 'domcontentloaded' });
  await page.waitForSelector('.mgt-login form', { timeout: 5000 });
  await page.fill('input[name=email]', EMAIL);
  await page.fill('input[name=password]', PASSWORD);
  await Promise.all([
    page.waitForFunction(() => !!window.MGT_DATA, null, { timeout: 15000 }),
    page.click('.mgt-login button[type=submit]'),
  ]);
  await page.waitForSelector('aside', { timeout: 5000 });
  console.log(`  (boot ok, ${consoleErrors.length} early errs)`);

  // 1. Thêm học viên (AddStudentModal)
  await safeRun(page, '1: Thêm học viên', async () => {
    await gotoTab(page, 'Học viên');
    const before = await page.evaluate(() => window.MGT_DATA.students.length);
    await page.locator('button:has-text("Thêm học viên")').first().click({ force: true });
    await waitForModalOpen(page);
    await fillByPlaceholder(page, '079 202 155 678', '079' + Date.now().toString().slice(-9));
    await fillByPlaceholder(page, 'Nguyễn Văn A',    `E2E Test Student ${SALT}`);
    await fillByPlaceholder(page, 'dd/mm/yyyy',      '01/01/2000');
    await fillByPlaceholder(page, 'Nam / Nữ',        'Nam');
    await fillByPlaceholder(page, 'Bến Tre',         'TP.HCM');
    await fillByPlaceholder(page, 'Số nhà, đường, phường, quận', '123 Lê Lợi');
    await fillByPlaceholder(page, '090 123 4567',    '0911' + Math.floor(Math.random() * 1e6));
    await selectByLabel(page, 'Lớp',       '.+');
    await selectByLabel(page, 'Nhân viên', '.+');
    await selectByLabel(page, 'Học phí',   '.+');
    await page.waitForTimeout(120);
    try { await selectByLabel(page, 'Khuyến mãi', '.+'); } catch {}
    await clickPrimary(page, 'Lưu học viên');
    await assertGrew(page, consoleErrors, '1: Thêm học viên', 'students', before);
  });

  // 2. Ghi nhận thanh toán (AddPaymentModal)
  await safeRun(page, '2: Ghi nhận thanh toán', async () => {
    await gotoTab(page, 'Thanh toán');
    const before = await page.evaluate(() => window.MGT_DATA.payments.length);
    await page.locator('button:has-text("Ghi nhận thanh toán")').first().click({ force: true });
    await waitForModalOpen(page);
    // Open the student picker dropdown then click the first result button
    // *inside the modal portal* — generic ":has-text('·')" matches too much.
    await page.locator('input[placeholder="Tìm theo tên, SĐT, Mã HV…"]').first().click({ force: true });
    await page.waitForTimeout(250);
    await page.evaluate(() => {
      const portals = Array.from(document.body.children).filter(el =>
        el.tagName === 'DIV' && /position:\s*fixed/i.test(el.getAttribute('style') || ''));
      const modal = portals[portals.length - 1];
      if (!modal) throw new Error('payment modal portal not found');
      const rowBtn = Array.from(modal.querySelectorAll('button'))
        .find(b => /·\s*hv-?\d+|·\s*HV\d+|\d{3}\s\d{3}\s\d{3,4}/i.test((b.textContent || '')));
      if (!rowBtn) throw new Error('no student row button in picker');
      rowBtn.click();
    });
    await page.waitForTimeout(150);
    await fillByPlaceholder(page, '0',          '500000');
    await selectByLabel(page,    'Hình thức',   'Tiền mặt');
    await fillByPlaceholder(page, 'BL-2026-…',  'BL-E2E-' + SALT);
    await clickPrimary(page, 'Lưu thanh toán');
    await assertGrew(page, consoleErrors, '2: Ghi nhận thanh toán', 'payments', before);
  });

  // 3. Tạo lớp (AddClassModal)
  await safeRun(page, '3: Tạo lớp', async () => {
    await gotoTab(page, 'Lớp học');
    const before = await page.evaluate(() => window.MGT_DATA.classes.length);
    await page.locator('button:has-text("Tạo lớp")').first().click({ force: true });
    await waitForModalOpen(page);
    await fillByPlaceholder(page, 'MÔ TÔ 06/2026', `MÔ TÔ E2E ${SALT}`);
    await selectByLabel(page,     'Chi nhánh',     '.+');
    await fillByPlaceholder(page, '01/06/2026',    '01/07/2026');
    await fillByPlaceholder(page, '30/06/2026',    '30/07/2026');
    await clickPrimary(page, 'Tạo lớp');
    await assertGrew(page, consoleErrors, '3: Tạo lớp', 'classes', before);
  });

  // 4. ClassDetail → Sửa lớp → toggle status
  await safeRun(page, '4: Sửa lớp (ClassEditModal)', async () => {
    await gotoTab(page, 'Lớp học');
    await page.waitForFunction(() => document.querySelectorAll('main h3').length > 0, null, { timeout: 5000 });
    const pick = await page.evaluate(() => {
      const visibleCodes = Array.from(document.querySelectorAll('main h3')).map(h => h.textContent.trim());
      for (const code of visibleCodes) {
        const cls = window.MGT_DATA.classes.find(c => c.code === code && c.status !== 'đã kết thúc');
        if (cls) return { id: cls.id, code: cls.code, status: cls.status };
      }
      return null;
    });
    if (!pick) throw new Error('no visible non-ended class in grid');
    await page.locator(`main h3:has-text("${pick.code}")`).first().click({ force: true });
    await page.waitForFunction(() => /Quay lại/.test(document.body.innerText), null, { timeout: 5000 });
    const labelMap = { 'đang mở':'Đang mở','đang diễn ra':'Đang diễn ra','đã kết thúc':'Đã kết thúc' };
    const detailStatus = await page.evaluate(() => {
      const main = document.querySelector('main'); if (!main) return null;
      for (const btn of Array.from(main.querySelectorAll('button'))) {
        const t = (btn.textContent || '').trim();
        if (t === 'Đang mở' || t === 'Đang diễn ra' || t === 'Đã kết thúc') return t;
      }
      return null;
    });
    if (!detailStatus) throw new Error('no status pill button in class detail header');
    const detailKey  = ({ 'Đang mở':'đang mở','Đang diễn ra':'đang diễn ra','Đã kết thúc':'đã kết thúc' })[detailStatus];
    const newStatus  = detailKey === 'đang mở' ? 'đang diễn ra' : 'đang mở';
    const newLabel   = labelMap[newStatus];
    await page.locator(`main button:has-text("${detailStatus}")`).first().click({ force: true });
    await waitForModalOpen(page);
    // Click the new-status pill *inside the modal portal* so we don't hit
    // a same-text element in <main>.
    await page.evaluate((newLabel) => {
      const portals = Array.from(document.body.children).filter(el =>
        el.tagName === 'DIV' && /position:\s*fixed/i.test(el.getAttribute('style') || ''));
      const modal = portals[portals.length - 1];
      if (!modal) throw new Error('class-edit modal portal not found');
      const btn = Array.from(modal.querySelectorAll('button'))
        .find(b => (b.textContent || '').trim() === newLabel);
      if (!btn) throw new Error('new-status pill not found in modal: ' + newLabel);
      btn.click();
    }, newLabel);
    await page.waitForTimeout(200);
    await clickPrimary(page, 'Lưu thay đổi');
    try {
      await page.waitForFunction(({ id, ns }) => window.MGT_DATA.getClass(id).status === ns,
        { id: pick.id, ns: newStatus }, { timeout: 6000 });
      recordPass('4: Sửa lớp', `${pick.code}: ${detailKey} → ${newStatus}`);
    } catch { recordFail('4: Sửa lớp (status not persisted)', await snapshotFailure(page, consoleErrors)); }
  });

  // 5. Tổ chức → Tài khoản → Tạo tài khoản
  await safeRun(page, '5: Tạo tài khoản', async () => {
    await gotoTab(page, 'Tổ chức');
    await clickOrgTab(page, 'Tài khoản');
    const before = await page.evaluate(() => window.MGT_DATA.accounts.length);
    await page.locator('button:has-text("Tạo tài khoản")').first().click({ force: true });
    await waitForModalOpen(page);
    await fillByPlaceholder(page, 'Nguyễn Văn A',        `E2E Acct ${SALT}`);
    await fillByPlaceholder(page, '090 123 4567',        '0922' + Math.floor(Math.random() * 1e6));
    await fillByPlaceholder(page, 'you@motogiathinh.vn', `e2e+${SALT}@motogiathinh.vn`);
    await selectByLabel(page,     'Chi nhánh',           '.+');
    await clickPrimary(page, 'Tạo mới');
    await assertGrew(page, consoleErrors, '5: Tạo tài khoản', 'accounts', before);
  });

  // 6. Tổ chức → Học phí → Tạo gói
  await safeRun(page, '6: Tạo gói học phí', async () => {
    await gotoTab(page, 'Tổ chức');
    await clickOrgTab(page, 'Học phí');
    const before = await page.evaluate(() => window.MGT_DATA.feePlans.length);
    await page.locator('button:has-text("Tạo gói")').first().click({ force: true });
    await waitForModalOpen(page);
    await fillByPlaceholder(page, 'A — Trọn gói', `E2E Gói ${SALT}`);
    await fillByPlaceholder(page, '1995000',      '1500000');
    await clickPrimary(page, 'Tạo mới');
    await assertGrew(page, consoleErrors, '6: Tạo gói học phí', 'feePlans', before);
  });

  // 7. Tổ chức → Khuyến mãi → Tạo khuyến mãi
  await safeRun(page, '7: Tạo khuyến mãi', async () => {
    await gotoTab(page, 'Tổ chức');
    await clickOrgTab(page, 'Khuyến mãi');
    const before = await page.evaluate(() => window.MGT_DATA.promotions.length);
    await page.locator('button:has-text("Tạo khuyến mãi")').first().click({ force: true });
    await waitForModalOpen(page);
    await fillByPlaceholder(page, 'Hè Vui — Giảm 200K', `E2E Promo ${SALT}`);
    await fillByPlaceholder(page, '200000',            '50000');
    // Multipill option lives inside the modal portal; scope the click there.
    await page.evaluate(() => {
      const portals = Array.from(document.body.children).filter(el =>
        el.tagName === 'DIV' && /position:\s*fixed/i.test(el.getAttribute('style') || ''));
      const modal = portals[portals.length - 1];
      if (!modal) throw new Error('modal portal not found');
      const skip = /^(×|Hủy|Tạo mới)$/;
      const pillBtns = Array.from(modal.querySelectorAll('button'))
        .filter(b => !skip.test((b.textContent || '').trim()))
        .filter(b => /·/.test(b.textContent || ''));
      if (pillBtns[0]) pillBtns[0].click();
    });
    await page.waitForTimeout(150);
    await clickPrimary(page, 'Tạo mới');
    await assertGrew(page, consoleErrors, '7: Tạo khuyến mãi', 'promotions', before);
  });

  // 8. Tổ chức → Giáo viên → Thêm giáo viên
  await safeRun(page, '8: Thêm giáo viên', async () => {
    await gotoTab(page, 'Tổ chức');
    await clickOrgTab(page, 'Giáo viên');
    const before = await page.evaluate(() => window.MGT_DATA.teachers.length);
    await page.locator('button:has-text("Thêm giáo viên")').first().click({ force: true });
    await waitForModalOpen(page);
    await fillByPlaceholder(page, 'Trần Văn B', `E2E Teacher ${SALT}`);
    await fillByPlaceholder(page, '09…',         '0900' + Math.floor(Math.random() * 1e6));
    await clickPrimary(page, 'Tạo mới');
    await assertGrew(page, consoleErrors, '8: Thêm giáo viên', 'teachers', before);
  });

  // 9. Tổ chức → Phương tiện → Thêm phương tiện
  await safeRun(page, '9: Thêm phương tiện', async () => {
    await gotoTab(page, 'Tổ chức');
    await clickOrgTab(page, 'Phương tiện');
    const before = await page.evaluate(() => window.MGT_DATA.vehicles.length);
    await page.locator('button:has-text("Thêm phương tiện")').first().click({ force: true });
    await waitForModalOpen(page);
    await fillByPlaceholder(page, 'Honda Wave Alpha', `E2E Xe ${SALT}`);
    await fillByPlaceholder(page, '59-K1 123.45',     '59-E2E ' + SALT);
    await fillByPlaceholder(page, '2024',             '2025');
    await clickPrimary(page, 'Tạo mới');
    await assertGrew(page, consoleErrors, '9: Thêm phương tiện', 'vehicles', before);
  });

  // 10. Notifications → Đánh dấu đã đọc
  await safeRun(page, '10: Đánh dấu đã đọc', async () => {
    await gotoTab(page, 'Thông báo');
    await page.waitForSelector('button:has-text("Đánh dấu đã đọc")', { timeout: 5000 });
    const unreadBefore = await page.evaluate(() => window.MGT_DATA.notifications.filter(n => !n.read).length);
    if (unreadBefore === 0) { recordPass('10: Đánh dấu đã đọc (no unread to mark)', '0 unread'); return; }
    await page.locator('button:has-text("Đánh dấu đã đọc")').first().click({ force: true });
    try {
      await page.waitForFunction(() => window.MGT_DATA.notifications.filter(n => !n.read).length === 0, null, { timeout: 6000 });
      recordPass('10: Đánh dấu đã đọc', `${unreadBefore} → 0 unread`);
    } catch {
      const after = await page.evaluate(() => window.MGT_DATA.notifications.filter(n => !n.read).length);
      recordFail('10: Đánh dấu đã đọc (backend did not update)', `${unreadBefore} → ${after} unread; ` + await snapshotFailure(page, consoleErrors));
    }
  });

  // 11. Notifications → select first row + Xóa đã chọn
  await safeRun(page, '11: Xóa thông báo đã chọn', async () => {
    await gotoTab(page, 'Thông báo');
    const before = await page.evaluate(() => window.MGT_DATA.notifications.length);
    if (before === 0) { recordPass('11: Xóa đã chọn (no notifications)', '0 items'); return; }
    const checkboxes = page.locator('input[type=checkbox]');
    const count = await checkboxes.count();
    if (count < 2) { recordPass('11: Xóa đã chọn (no row checkboxes)', `${count} checkboxes`); return; }
    await checkboxes.nth(1).click({ force: true });
    await page.waitForTimeout(150);
    const delBtn = page.locator('button:has-text("Xóa đã chọn")').first();
    if (!(await delBtn.count())) { recordFail('11: Xóa đã chọn (Xóa button never appeared)', await snapshotFailure(page, consoleErrors)); return; }
    await delBtn.click({ force: true });
    try {
      await page.waitForFunction((b) => window.MGT_DATA.notifications.length < b, before, { timeout: 6000 });
      const after = await page.evaluate(() => window.MGT_DATA.notifications.length);
      recordPass('11: Xóa đã chọn', `${before} → ${after}`);
    } catch { recordFail('11: Xóa đã chọn (backend delete did not persist)', await snapshotFailure(page, consoleErrors)); }
  });

  // 12. Sidebar user pill → logout modal → Đăng xuất → login form returns
  await safeRun(page, '12: Đăng xuất', async () => {
    await page.locator('aside button').last().click({ force: true });
    await waitForModalOpen(page);
    await page.locator('button:has-text("Đăng xuất")').last().click({ force: true });
    try {
      await page.waitForSelector('.mgt-login form', { timeout: 8000 });
      recordPass('12: Đăng xuất', 'login form shown');
    } catch { recordFail('12: Đăng xuất (no login form after logout)', await snapshotFailure(page, consoleErrors)); }
  });

  await browser.close();

  const failed = results.filter(r => !r.ok);
  console.log(`\n${failed.length === 0 ? 'ALL PASS' : `${failed.length} FAIL of ${results.length}`}`);
  if (failed.length) failed.forEach(f => console.log('  FAIL:', f.label, '—', f.extra));
  console.log(`\nTOTAL: ${results.length - failed.length}/${results.length} passed`);
  process.exit(failed.length ? 1 : 0);
}

run().catch((e) => { console.error('FATAL:', e); process.exit(1); });
