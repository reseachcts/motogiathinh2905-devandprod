// routes/entities.js — bulk read endpoints, one per CSV table.
//
// Returns rows in the same shape the frozen frontend expects (matches the
// CSV columns + native JSON bool/int coercion). The frontend's rewritten
// data-loader.js fetches all of these in parallel at boot, then computes
// derived fields (paid/balance/paymentStatus/class.status) client-side per
// frontend/CLAUDE.md "derived fields are NEVER read from the wire".
//
// Branch scoping (BACKEND.md §7 + SPEC §1):
//   - admin: sees every row
//   - staff: sees only their own branch's rows for branch-scoped tables
//     (students, payments, classes, notifications)
//   - The lookup tables (branches, fee_plans, promotions, teachers,
//     vehicles, accounts) stay readable across branches so e.g. the
//     class-detail page can resolve a teacher's name regardless of the
//     viewer's branch.

import { Router } from 'express';
import { db, coerceBoolsAll } from '../db.js';
import { requireAuth, publicAccount } from '../auth.js';

const router = Router();

// Tables where each row carries a branchId and should be filtered for
// staff role. Notifications scope via student.branchId (FK lookup).
const BRANCH_SCOPED = new Set(['students', 'payments', 'classes']);

function dump(table, mapRow) {
  return (req, res) => {
    let rows;
    // Guests: only their own students; their account row (for currentUser
    // resolution); and the one class they've been assigned to (for the
    // "current class" eyebrow on the kiosk). Everything else empty.
    if (req.user.role === 'guest') {
      if (table === 'students') {
        rows = db.prepare(`SELECT * FROM students WHERE responsibleStaffId = ?`).all(req.user.id);
      } else if (table === 'accounts') {
        rows = db.prepare(`SELECT * FROM accounts WHERE id = ?`).all(req.user.id);
      } else if (table === 'classes') {
        const me = db.prepare('SELECT assignedClassId FROM accounts WHERE id = ?').get(req.user.id);
        rows = me?.assignedClassId
          ? db.prepare(`SELECT * FROM classes WHERE id = ?`).all(me.assignedClassId)
          : [];
      } else {
        rows = [];
      }
      coerceBoolsAll(table, rows);
      return res.json(mapRow ? rows.map(mapRow) : rows);
    }
    if (BRANCH_SCOPED.has(table) && req.user.role !== 'admin') {
      rows = db.prepare(`SELECT * FROM ${table} WHERE branchId = ?`).all(req.user.branchId);
    } else if (table === 'notifications' && req.user.role !== 'admin') {
      // Notifications without studentId are system-wide → visible to all.
      // Notifications with studentId → only if the student is in user's branch.
      rows = db.prepare(`
        SELECT n.* FROM notifications n
        LEFT JOIN students s ON s.id = n.studentId
        WHERE n.studentId IS NULL OR s.branchId = ?
      `).all(req.user.branchId);
    } else if (table === 'activity_log' && req.user.role !== 'admin') {
      // Staff see only their own branch's actions. The activity row carries
      // userId (the actor), so we resolve actor → accounts.branchId and
      // include rows where the actor was in the caller's branch OR where
      // the actor is the caller themselves (covers system rows too).
      rows = db.prepare(`
        SELECT a.* FROM activity_log a
        LEFT JOIN accounts u ON u.id = a.userId
        WHERE u.branchId = ? OR a.userId = ?
        ORDER BY a.at DESC
      `).all(req.user.branchId, req.user.id);
    } else {
      rows = db.prepare(`SELECT * FROM ${table}`).all();
    }
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
  // === GUEST-QR-PACK begin — adds CCCD mặt sau + CCCD QR slots in
  // the order requested. Revert by restoring the original 4-entry list.
  res.json([
    { key: 'cccd',      label: 'CCCD mặt trước',      hint: 'Hình mặt trước · OCR sẽ tự điền thông tin' },
    { key: 'cccd_back', label: 'CCCD mặt sau',        hint: 'Hình mặt sau' },
    { key: 'cccd_qr',   label: 'CCCD QR',             hint: 'Mã QR trên CCCD (do kiosk khách quét)' },
    { key: 'gksk',      label: 'Giấy khám sức khỏe',   hint: 'Bản scan / chụp' },
    { key: 'donDeNghi', label: 'Đơn đề nghị học',      hint: 'Đơn đề nghị học sát hạch' },
    { key: 'the3x4',    label: 'Ảnh thẻ 3×4',          hint: 'Ảnh chân dung' },
  ]);
  // === GUEST-QR-PACK end
});

// Server time — so the frontend's mock-clock can be retired without baking
// the host machine's clock into chart aggregations.
router.get('/now', (_req, res) => {
  const d = new Date();
  res.json({ now: d.toISOString(), ms: d.getTime() });
});

export default router;
