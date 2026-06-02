// Drive Chromium through every guest-app screen at iPhone-13 viewport
// (390 x 844) and save PNGs to guest-app/screenshots/.
//
//   01 login-dark      — boot screen, unauthenticated
//   02 list-dark       — student list after login
//   03 detail-dark     — first student opened
//   04 add-modal-dark  — create dialog open
//   05 list-light      — list with light theme
//
// Driven against a backend on http://127.0.0.1:3099 (snapshot-only) which
// returns the JWT in the response body so the storage shim catches it.

import { chromium, devices } from 'playwright';
import { mkdir } from 'node:fs/promises';
import { existsSync } from 'node:fs';

const BASE = 'http://localhost:4173';
const OUT  = new URL('../screenshots/', import.meta.url).pathname.replace(/^\/([A-Za-z]):/, '$1:');
const wait = (ms) => new Promise(r => setTimeout(r, ms));

async function shot(page, name) {
  await page.screenshot({ path: `${OUT}/${name}.png`, fullPage: false });
  console.log(`  → ${name}.png`);
}

async function login(page) {
  await page.getByPlaceholder('ten@motogiathinh.centersai').fill('viet@motogiathinh.centersai');
  await page.getByPlaceholder('••••••').fill('viet');
  await page.getByRole('button', { name: /Đăng nhập/i }).click();
  await page.waitForSelector('text=Thêm học viên', { timeout: 15000 });
  await wait(400);
}

async function main() {
  if (!existsSync(OUT)) await mkdir(OUT, { recursive: true });

  // Fresh profile each run — otherwise localStorage persists the JWT
  // from a prior screenshot session and the login screen is skipped.
  const userDataDir = (process.env.TEMP || '/tmp') + '/playwright-snapshot-' + Date.now();
  const context = await chromium.launchPersistentContext(userDataDir, {
    ...devices['iPhone 13'],
    locale: 'vi-VN',
    bypassCSP: true,
    args: ['--disable-web-security'],
  });
  const page = await context.newPage();
  page.on('pageerror', (e) => console.log('[pageerror]', e.message));

  // ---- 1. Login screen ----
  console.log('1. login screen (dark)');
  await page.goto(BASE, { waitUntil: 'networkidle' });
  await wait(500);
  await shot(page, '01-login-dark');

  // ---- 2. List after login ----
  console.log('2. log in → list (dark)');
  await login(page);
  await shot(page, '02-list-dark');

  // ---- 3. Detail view ----
  console.log('3. open first student → detail (dark)');
  // Click the first non-cyan student row (skip the big "Thêm học viên" card)
  await page.locator('button:has(p), button:has(div)')
    .filter({ hasText: /\d{3}\s*\d{3}\s*\d{4}/ })  // contains a formatted phone
    .first().click();
  await page.waitForSelector('text=Danh sách', { timeout: 10000 });
  await wait(500);
  await shot(page, '03-detail-dark');

  // Back to list
  await page.getByRole('button', { name: /Danh sách/i }).click();
  await page.waitForSelector('text=Thêm học viên', { timeout: 5000 });
  await wait(300);

  // ---- 4. Add modal ----
  console.log('4. add-student modal (dark)');
  await page.getByRole('button', { name: /Thêm học viên/i }).first().click();
  await page.waitForSelector('text=Lưu học viên', { timeout: 5000 });
  await wait(400);
  await shot(page, '04-add-modal-dark');

  // ---- 5. Light theme on list (reload page to drop modal cleanly) ----
  console.log('5. reload → toggle theme → list (light)');
  await page.goto(BASE, { waitUntil: 'networkidle' });
  await page.waitForSelector('text=Thêm học viên', { timeout: 8000 });
  await wait(300);
  await page.locator('button[title*="Chuyển sang"]').click();
  await wait(600);
  await shot(page, '05-list-light');

  await context.close();
  console.log(`\nAll screenshots in ${OUT}`);
}

main().catch((e) => { console.error(e); process.exit(1); });
