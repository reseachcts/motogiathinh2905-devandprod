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
    context = await browser.newContext({ viewport: { width: 1440, height: 1800 } });
    await context.addCookies([{
      name: COOKIE_NAME, value: token,
      url: SELF_BASE, httpOnly: true, sameSite: 'Lax',
    }]);
    page = await context.newPage();
    // Navigate with ?print=dashboard so the frontend can render a
    // print-friendly layout (hide sidebar, show all sections expanded).
    await page.goto(`${SELF_BASE}/?print=dashboard`, { waitUntil: 'domcontentloaded' });
    // Wait for data + the dashboard render. We poll for an h3 or KPI
    // marker to appear (max 20s).
    await page.waitForFunction(
      () => window.MGT_DATA && /TỔNG NỢ|Tổng quan|cộng dồn/i.test(document.body.innerText),
      null, { timeout: 20_000 }
    );
    // Small settle delay so chart animations complete.
    await page.waitForTimeout(900);
    const pdf = await page.pdf({
      format: 'A4', landscape: true, printBackground: true,
      margin: { top: '10mm', bottom: '10mm', left: '10mm', right: '10mm' },
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

export default router;
