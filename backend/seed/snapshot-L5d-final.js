// snapshot-L5d-final.js — capture dashboard / students / classes
// screenshots at L-cycle close so the coworker / reviewer has a
// frozen visual record. Outputs PNG to backend/data/snapshots/L5d-final-*.png.
//
// Run: cd backend && node seed/snapshot-L5d-final.js

import { chromium } from 'playwright';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { mkdirSync } from 'node:fs';

const BASE     = process.env.SMOKE_BASE || 'http://127.0.0.1:3001';
const EMAIL    = process.env.SEED_ADMIN_EMAIL || 'admin@motogiathinh.centersai';
const PASSWORD = process.env.SEED_ADMIN_PASSWORD || 'admin';
const SHOTS    = resolve(dirname(fileURLToPath(import.meta.url)), '..', 'data', 'snapshots');

mkdirSync(SHOTS, { recursive: true });

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

async function gotoTab(page, label) {
  await page.locator(`aside button:has-text("${label}")`).first().click({ force: true, timeout: 6000 });
  await page.waitForTimeout(350);
}

(async () => {
  const browser = await chromium.launch();
  const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  const page = await ctx.newPage();
  try {
    await loginUI(page);

    // Dashboard
    await page.waitForTimeout(400);
    const dash = resolve(SHOTS, 'L5d-final-dashboard.png');
    await page.screenshot({ path: dash, fullPage: true });
    console.log('saved:', dash);

    // Students
    await gotoTab(page, 'Học viên');
    await page.waitForTimeout(400);
    const stud = resolve(SHOTS, 'L5d-final-students.png');
    await page.screenshot({ path: stud, fullPage: true });
    console.log('saved:', stud);

    // Classes
    await gotoTab(page, 'Lớp học');
    await page.waitForTimeout(400);
    const cls = resolve(SHOTS, 'L5d-final-classes.png');
    await page.screenshot({ path: cls, fullPage: true });
    console.log('saved:', cls);

    console.log('done — 3 PNGs written to', SHOTS);
  } finally {
    await browser.close();
  }
})();
