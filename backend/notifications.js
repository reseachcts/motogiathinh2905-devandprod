// notifications.js — auto-regeneration per BACKEND.md §9.
//
// Rules (ported verbatim from the spec):
// - Each currently-enrolled student (class.status === "đang diễn ra")
//   with paymentStatus "50%" → payment/warn  ("Chờ đóng đợt 2")
// - Same with paymentStatus "0%"                   → payment/danger
// - Each student with profileComplete === false    → profile/warn
//
// Strategy: deterministic IDs (`auto-payment-<sid>`, `auto-profile-<sid>`)
// so recompute is idempotent. We UPSERT the desired set and DELETE the
// stale auto-rows that no longer apply. Hand-created notifications (any
// id not starting with `auto-`) are left untouched.

import { db, nowDdMmYyyyHHMMSS, logActivity } from './db.js';

// ---------------------------------------------------------------------------
// Date / status derivation (mirrors webapp/data-loader.js so server-side
// recompute agrees with what the UI shows).
// ---------------------------------------------------------------------------
function parseDT(s) {
  if (!s) return 0;
  const [d, m, y, hh = 0, mm = 0, ss = 0] = s.trim().split(/[\/\s:]/).map(n => parseInt(n, 10));
  return new Date(y, m - 1, d, hh, mm, ss).getTime();
}
function classStatus(cls, nowMs) {
  if (cls.statusOverride) return cls.statusOverride;
  const openMs = parseDT(cls.openDate);
  const examMs = parseDT(cls.examDate);
  if (examMs < nowMs) return 'đã kết thúc';
  if (openMs > nowMs) return 'đang mở';
  return 'đang diễn ra';
}
function paymentStatus(student, paid) {
  if (paid <= 0) return '0%';
  if (paid >= student.totalFee) return '100%';
  return '50%';
}

// ---------------------------------------------------------------------------
// Build the *desired* auto-notification set from current DB state.
// ---------------------------------------------------------------------------
export function buildDesired() {
  const nowMs = Date.now();
  const now = nowDdMmYyyyHHMMSS();

  const classes = db.prepare('SELECT * FROM classes').all();
  const classStatusById = new Map();
  for (const c of classes) classStatusById.set(c.id, classStatus(c, nowMs));

  const students = db.prepare('SELECT * FROM students').all();
  const paidById = new Map(
    db.prepare('SELECT studentId, SUM(amount) AS paid FROM payments GROUP BY studentId')
      .all().map(r => [r.studentId, r.paid || 0])
  );

  const desired = new Map(); // id → row
  for (const s of students) {
    const status = paymentStatus(s, paidById.get(s.id) || 0);
    const clsStatus = classStatusById.get(s.classId);
    const enrolled = clsStatus === 'đang diễn ra';

    // Rule 1 + 2: payment status for currently-enrolled students
    if (enrolled && status !== '100%') {
      const id = `auto-payment-${s.id}`;
      desired.set(id, {
        id, type: 'payment',
        severity: status === '50%' ? 'warn' : 'danger',
        title: status === '50%' ? 'Chờ đóng đợt 2' : 'Chưa đóng học phí',
        message: `${s.name} (${s.maHV}) — ${status === '50%' ? 'đã đóng đợt 1, còn nợ đợt 2.' : 'chưa đóng học phí.'}`,
        studentId: s.id, read: 0, createdAt: now,
      });
    }

    // Rule 3: profile incomplete
    if (!s.profileComplete) {
      const id = `auto-profile-${s.id}`;
      desired.set(id, {
        id, type: 'profile', severity: 'warn',
        title: 'Hồ sơ chưa đầy đủ',
        message: `${s.name} (${s.maHV}) — thiếu tài liệu / thông tin cá nhân.`,
        studentId: s.id, read: 0, createdAt: now,
      });
    }
  }
  return desired;
}

// ---------------------------------------------------------------------------
// Apply the desired set against the DB. Returns counts for logging.
// ---------------------------------------------------------------------------
export function recompute() {
  const desired = buildDesired();
  const desiredIds = new Set(desired.keys());

  const existingAuto = db.prepare("SELECT id, type, severity, title, message FROM notifications WHERE id LIKE 'auto-%'").all();
  const existingById = new Map(existingAuto.map(n => [n.id, n]));

  // 1. DELETE stale: auto-rows no longer in the desired set.
  const stale = existingAuto.filter(n => !desiredIds.has(n.id));
  if (stale.length) {
    const del = db.prepare('DELETE FROM notifications WHERE id = ?');
    db.prepare('BEGIN').run();
    try { for (const n of stale) del.run(n.id); db.prepare('COMMIT').run(); }
    catch (e) { db.prepare('ROLLBACK').run(); throw e; }
  }

  // 2. UPSERT desired. If row already present, only update mutable fields
  //    (don't reset `read` — user may have already dismissed).
  const ins = db.prepare(`
    INSERT INTO notifications (id, type, severity, title, message, studentId, read, createdAt)
    VALUES (@id, @type, @severity, @title, @message, @studentId, @read, @createdAt)
  `);
  const upd = db.prepare(`
    UPDATE notifications
       SET type = @type, severity = @severity, title = @title, message = @message,
           studentId = @studentId
     WHERE id = @id
  `);
  let added = 0, updated = 0;
  db.prepare('BEGIN').run();
  try {
    for (const [id, row] of desired) {
      const ex = existingById.get(id);
      if (!ex) { ins.run(row); added++; }
      else if (ex.type !== row.type || ex.severity !== row.severity
            || ex.title !== row.title || ex.message !== row.message) {
        upd.run(row); updated++;
      }
    }
    db.prepare('COMMIT').run();
  } catch (e) { db.prepare('ROLLBACK').run(); throw e; }

  return { desired: desired.size, added, updated, deleted: stale.length };
}

// ---------------------------------------------------------------------------
// Background timer. Started by server.js after boot; stopped on shutdown.
// ---------------------------------------------------------------------------
let _timer = null;
export function startRecomputeTimer(intervalMs = 5 * 60 * 1000) {
  stopRecomputeTimer();
  // Kick once at start so the seeded DB is in a consistent state immediately.
  try {
    const r = recompute();
    if (r.added + r.updated + r.deleted > 0) {
      console.log(`[notifications] initial recompute: +${r.added} ~${r.updated} -${r.deleted}`);
    }
  } catch (e) { console.error('[notifications] initial recompute failed:', e); }
  _timer = setInterval(() => {
    try {
      const r = recompute();
      if (r.added + r.updated + r.deleted > 0) {
        console.log(`[notifications] recompute: +${r.added} ~${r.updated} -${r.deleted}`);
      }
    } catch (e) { console.error('[notifications] recompute failed:', e); }
  }, intervalMs);
  _timer.unref?.();
}
export function stopRecomputeTimer() { if (_timer) { clearInterval(_timer); _timer = null; } }

// Convenience hook for write endpoints — runs synchronously after each
// relevant mutation, so the new state is reflected before the next GET.
export function recomputeAfterWrite(actor, target) {
  try {
    const r = recompute();
    if (r.added + r.updated + r.deleted > 0) {
      logActivity(actor, 'notifications.recompute', `${target}: +${r.added} ~${r.updated} -${r.deleted}`);
    }
    return r;
  } catch (e) {
    console.error('[notifications] recomputeAfterWrite failed:', e);
    return null;
  }
}
