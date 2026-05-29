// routes/reports.js — server-side PDF generation via headless chromium
// (reuses the playwright install already present for the E2E harness).
//
// GET /api/reports/dashboard.pdf
//   - Requires auth (admin or staff)
//   - Mints a short-lived signed token for the headless browser to log
//     in as the calling user
//   - Headless chromium navigates to ?print=dashboard on the running
//     server, waits for `window.MGT_DATA` + the dashboard to settle, then
//     page.pdf() with A4 landscape
//   - Streams the PDF back as application/pdf
//
// No additional dependencies — playwright was already installed for E2E.

import { Router } from 'express';
import jwt from 'jsonwebtoken';
import { requireAuth, COOKIE_NAME } from '../auth.js';
import { buildReportData } from '../reports/data.js';
import { buildExcel } from '../reports/excel.js';
import { buildFormalHtml } from '../reports/html.js';

const router = Router();
router.use(requireAuth);

// Playwright is heavy; lazy-import so server boot stays fast even when
// reports are never requested.
let _chromiumPromise = null;
async function getChromium() {
  if (!_chromiumPromise) {
    _chromiumPromise = (async () => {
      const { chromium } = await import('playwright');
      return chromium.launch();
    })().catch(e => { _chromiumPromise = null; throw e; });
  }
  return _chromiumPromise;
}

const SECRET = process.env.JWT_SECRET || 'dev-only-do-not-use-in-prod';
const SELF_BASE = process.env.SELF_BASE || `http://127.0.0.1:${process.env.PORT || 3001}`;

router.get('/reports/dashboard.pdf', async (req, res) => {
  // Mint a short-lived (60s) JWT cookie so the headless browser context
  // can hit /api/me without a session round-trip.
  const token = jwt.sign(
    { sub: req.user.id, role: req.user.role, branchId: req.user.branchId || null },
    SECRET, { expiresIn: '60s' }
  );

  let context, page;
  const t0 = Date.now();
  try {
    const browser = await getChromium();
    // 1280×900 keeps charts un-cropped at the A4-landscape page-print
    // ratio used by the @page rule in the injected print stylesheet.
    context = await browser.newContext({ viewport: { width: 1280, height: 900 } });
    await context.addCookies([{
      name: COOKIE_NAME, value: token,
      url: SELF_BASE, httpOnly: true, sameSite: 'Lax',
    }]);
    page = await context.newPage();
    // ?print=dashboard tells the frontend to force light theme, hide
    // the sidebar, inject @page A4 landscape + break-before-page rules.
    await page.goto(`${SELF_BASE}/?print=dashboard`, { waitUntil: 'domcontentloaded' });
    // Wait for data + the dashboard render. We poll for an h3 or KPI
    // marker to appear (max 20s).
    await page.waitForFunction(
      () => window.MGT_DATA && /TỔNG NỢ|Tổng quan|cộng dồn/i.test(document.body.innerText),
      null, { timeout: 20_000 }
    );
    // Wait for the 4 page-section wrappers + a settle delay so chart
    // animations complete and SVGs finish laying out.
    await page.waitForFunction(
      () => document.querySelectorAll('.mgt-print-section').length >= 4,
      null, { timeout: 10_000 }
    );
    await page.waitForTimeout(900);
    // Sizing handled by `zoom: 0.78` on .mgt-print-section in the
    // injected print stylesheet (playwright's `scale` option turns out
    // to be a no-op when the page renders into a known-format viewport).
    const pdf = await page.pdf({
      format: 'A4', landscape: true, printBackground: true,
      margin: { top: '8mm', bottom: '8mm', left: '8mm', right: '8mm' },
    });
    const fname = `tongquan-${new Date().toISOString().slice(0,10)}.pdf`;
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="${fname}"`);
    res.setHeader('X-Render-Ms', String(Date.now() - t0));
    res.send(pdf);
  } catch (e) {
    console.error('[reports] pdf failed:', e?.message || e);
    res.status(500).json({ error: 'pdf_failed', message: String(e?.message || e) });
  } finally {
    if (page) await page.close().catch(() => {});
    if (context) await context.close().catch(() => {});
  }
});

// ---------------------------------------------------------------------------
// Formal weekly report — Excel
// GET /api/reports/data.xlsx?since=dd/mm/yyyy&until=dd/mm/yyyy
//   Defaults: last 7 days inclusive.
// ---------------------------------------------------------------------------
router.get('/reports/data.xlsx', async (req, res) => {
  const t0 = Date.now();
  try {
    const data = buildReportData({ since: req.query.since, until: req.query.until });
    const buf  = await buildExcel(data);
    const fname = `baocao-${data.period.label.replace(/[\/\s→]/g, '')}.xlsx`;
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', `attachment; filename="${fname}"`);
    res.setHeader('X-Render-Ms', String(Date.now() - t0));
    res.end(Buffer.from(buf));
  } catch (e) {
    console.error('[reports] xlsx failed:', e?.message || e);
    res.status(500).json({ error: 'xlsx_failed', message: String(e?.message || e) });
  }
});

// ---------------------------------------------------------------------------
// Formal weekly report — PDF (table-only, no charts).
// GET /api/reports/data.pdf?since=&until=
// Uses page.setContent() — does NOT require a logged-in browser session.
// ---------------------------------------------------------------------------
router.get('/reports/data.pdf', async (req, res) => {
  let context, page;
  const t0 = Date.now();
  try {
    const data = buildReportData({ since: req.query.since, until: req.query.until });
    const html = buildFormalHtml(data);
    const browser = await getChromium();
    context = await browser.newContext({ viewport: { width: 1080, height: 1500 } });
    page = await context.newPage();
    await page.setContent(html, { waitUntil: 'domcontentloaded' });
    await page.emulateMedia({ media: 'print' });
    const pdf = await page.pdf({
      format: 'A4', printBackground: true,
      margin: { top: '14mm', bottom: '14mm', left: '12mm', right: '12mm' },
    });
    const fname = `baocao-${data.period.label.replace(/[\/\s→]/g, '')}.pdf`;
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="${fname}"`);
    res.setHeader('X-Render-Ms', String(Date.now() - t0));
    res.send(pdf);
  } catch (e) {
    console.error('[reports] data.pdf failed:', e?.message || e);
    res.status(500).json({ error: 'pdf_failed', message: String(e?.message || e) });
  } finally {
    if (page) await page.close().catch(() => {});
    if (context) await context.close().catch(() => {});
  }
});

export default router;
