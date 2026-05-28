// routes/entities.js — bulk read endpoints, one per CSV table.
//
// Returns rows in the same shape the frozen frontend expects (matches the
// CSV columns + native JSON bool/int coercion). The frontend's rewritten
// data-loader.js fetches all of these in parallel at boot, then computes
// derived fields (paid/balance/paymentStatus/class.status) client-side per
// frontend/CLAUDE.md "derived fields are NEVER read from the wire".

import { Router } from 'express';
import { db, coerceBoolsAll } from '../db.js';
import { requireAuth, publicAccount } from '../auth.js';

const router = Router();

function dump(table, mapRow) {
  return (req, res) => {
    const rows = db.prepare(`SELECT * FROM ${table}`).all();
    coerceBoolsAll(table, rows);
    res.json(mapRow ? rows.map(mapRow) : rows);
  };
}

// All bulk reads require an authenticated session.
router.use(requireAuth);

router.get('/branches',      dump('branches'));
router.get('/accounts',      dump('accounts', publicAccount));   // strip passwordHash
router.get('/classes',       dump('classes'));
router.get('/students',      dump('students'));
router.get('/payments',      dump('payments'));
router.get('/fee-plans',     dump('fee_plans'));
router.get('/promotions',    dump('promotions'));
router.get('/teachers',      dump('teachers'));
router.get('/vehicles',      dump('vehicles'));
router.get('/notifications', dump('notifications'));
router.get('/activity-log',  dump('activity_log'));

// PROFILE_DOCS constant — bundled here so the frontend can fetch it once
// rather than hard-coding (and so we can extend slot definitions later).
router.get('/constants/profile-docs', (_req, res) => {
  res.json([
    { key: 'cccd',      label: 'CCCD',                 hint: 'Hình mặt trước · OCR sẽ tự điền thông tin' },
    { key: 'gksk',      label: 'Giấy khám sức khỏe',   hint: 'Bản scan / chụp' },
    { key: 'donDeNghi', label: 'Đơn đề nghị học',      hint: 'Đơn đề nghị học sát hạch' },
    { key: 'the3x4',    label: 'Thẻ 3×4',              hint: 'Ảnh chân dung' },
  ]);
});

// Server time — so the frontend's mock-clock can be retired without baking
// the host machine's clock into chart aggregations.
router.get('/now', (_req, res) => {
  const d = new Date();
  res.json({ now: d.toISOString(), ms: d.getTime() });
});

export default router;
