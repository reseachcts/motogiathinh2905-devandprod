import { chromium, devices } from 'playwright';
import { readFile } from 'node:fs/promises';

const BASE = 'http://localhost:4173';
const userDataDir = (process.env.TEMP || '/tmp') + '/playwright-qr-' + Date.now();

const ctx = await chromium.launchPersistentContext(userDataDir, {
  ...devices['iPhone 13'],
  locale: 'vi-VN',
  bypassCSP: true,
  args: ['--disable-web-security'],
});
const page = await ctx.newPage();
page.on('console', m => { if (m.type()==='error') console.log('[browser err]', m.text()); });
page.on('pageerror', e => console.log('[pageerror]', e.message));
page.on('request', r => { if (r.url().includes('/ocr/')) console.log('  req:', r.method(), r.url(), 'headers.content-type:', r.headers()['content-type']); });
page.on('response', async r => {
  if (r.url().includes('/ocr/')) {
    const body = await r.text().catch(()=>'(read failed)');
    console.log('  res:', r.status(), body.slice(0, 250));
  }
});

await page.goto(BASE, { waitUntil: 'networkidle' });
await page.getByPlaceholder('ten@motogiathinh.centersai').fill('viet@motogiathinh.centersai');
await page.getByPlaceholder('••••••').fill('viet');
await page.getByRole('button', { name: /Đăng nhập/i }).click();
await page.waitForSelector('text=Thêm học viên', { timeout: 15000 });
await page.getByRole('button', { name: /Thêm học viên/i }).first().click();
await page.waitForSelector('text=Lưu học viên', { timeout: 5000 });

// Simulate picking the QR file. The hidden <input type=file> the picker
// creates needs intercepting — easier: drive the click + setInputFiles.
const fileBuf = await readFile('../cccd14.3.jpg');
// The pickPhoto helper creates an input dynamically — let's poll for it
// after clicking the QR slot.
page.once('filechooser', async (chooser) => {
  console.log('  filechooser opened');
  await chooser.setFiles({ name: 'cccd14.3.jpg', mimeType: 'image/jpeg', buffer: fileBuf });
});
await page.locator('text=Mã QR trên CCCD').click();

// Wait long enough for OCR roundtrip
await new Promise(r => setTimeout(r, 8000));
await page.screenshot({ path: '../qr-probe.png' });
console.log('done — screenshot at ../qr-probe.png');
await ctx.close();
