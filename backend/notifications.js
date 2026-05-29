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
// Schema self-patch — broaden notifications.type CHECK to include 'doc'.
//
// The frozen frontend (webapp/screen-notifs.jsx) counts `type === "doc"` for
// its "Hồ sơ thiếu" stat, but the original schema only allowed
// ('payment','profile','system'), so the profile-incomplete rule emitted
// rows that the UI never saw. We:
//   1. Migrate any existing auto-profile-* rows to type='doc'.
//   2. Relax the CHECK so new INSERTs with 'doc' succeed.
//
// SQLite can't ALTER a CHECK in place, so we rebuild the table when the old
// constraint is detected. Idempotent — re-runs are no-ops once 'doc' is in
// the CHECK. Lives here (not in db.js / migrations) so the contract that
// "notifications.js owns the type vocabulary" stays in one file.
// ---------------------------------------------------------------------------
(function ensureDocType() {
  const row = db.prepare("SELECT sql FROM sqlite_master WHERE type = 'table' AND name = 'notifications'").get();
  if (!row || !row.sql) return;
  if (/CHECK\s*\(\s*type\s+IN\s*\([^)]*'doc'[^)]*\)\s*\)/i.test(row.sql)) return; // already broadened
  db.exec('BEGIN');
  try {
    db.exec('ALTER TABLE notifications RENAME TO notifications_old');
    db.exec(`
      CREATE TABLE notifications (
        id         TEXT PRIMARY KEY,
        type       TEXT NOT NULL CHECK (type IN ('payment','profile','doc','system')),
        severity   TEXT NOT NULL CHECK (severity IN ('info','warn','danger')),
        title      TEXT NOT NULL,
        message    TEXT,
        studentId  TEXT,
        read       INTEGER NOT NULL DEFAULT 0,
        createdAt  TEXT NOT NULL
      )
    `);
    db.exec(`
      INSERT INTO notifications (id, type, severity, title, message, studentId, read, createdAt)
      SELECT id,
             CASE WHEN id LIKE 'auto-%' AND type = 'profile' THEN 'doc' ELSE type END,
             severity, title, message, studentId, read, createdAt
        FROM notifications_old
    `);
    db.exec('DROP TABLE notifications_old');
    db.exec('CREATE INDEX IF NOT EXISTS idx_notifications_read ON notifications(read)');
    db.exec('COMMIT');
    console.log("[notifications] schema patched: type CHECK now allows 'doc'");
  } catch (e) {
    try { db.exec('ROLLBACK'); } catch {}
    console.error('[notifications] schema patch failed:', e);
    throw e;
  }
})();

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

    // Rule 3: profile incomplete. type='doc' (not 'profile') because the
    // frozen frontend (webapp/screen-notifs.jsx) filters its "Hồ sơ thiếu"
    // stat on type === 'doc'. The CHECK constraint is broadened in the
    // ensureDocType() self-migration at module load.
    if (!s.profileComplete) {
      const id = `auto-profile-${s.id}`;
      desired.set(id, {
        id, type: 'doc', severity: 'warn',
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
//
// Concurrency: node:sqlite's DatabaseSync doesn't expose a better-sqlite3
// style db.transaction() wrapper, so we serialize callers ourselves. Two
// simultaneous recomputes would both try to BEGIN and the second would throw
// "cannot start a transaction within a transaction". An in-process boolean
// flag is enough since DatabaseSync calls are all synchronous — any caller
// that finds the flag set queues a "needs another pass" bit and skips the
// expensive work (the in-flight call already covers the latest state once
// the row reads happen after the flag is set).
// ---------------------------------------------------------------------------
let _running = false;
let _rerunQueued = false;

function _recomputeUnlocked() {
  const desired = buildDesired();
  const desiredIds = new Set(desired.keys());

  const existingAuto = db.prepare("SELECT id, type, severity, title, message FROM notifications WHERE id LIKE 'auto-%'").all();
  const existingById = new Map(existingAuto.map(n => [n.id, n]));

  // 1. DELETE stale: auto-rows no longer in the desired set.
  const stale = existingAuto.filter(n => !desiredIds.has(n.id));

  // 2. UPSERT desired. If row already present, only update mutable fields
  //    (don't reset `read` — user may have already dismissed).
  const del = db.prepare('DELETE FROM notifications WHERE id = ?');
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
  // Single transaction wraps both DELETE-stale and UPSERT-desired so
  // observers never see a half-applied state.
  db.exec('BEGIN');
  let committed = false;
  try {
    for (const n of stale) del.run(n.id);
    for (const [id, row] of desired) {
      const ex = existingById.get(id);
      if (!ex) { ins.run(row); added++; }
      else if (ex.type !== row.type || ex.severity !== row.severity
            || ex.title !== row.title || ex.message !== row.message) {
        upd.run(row); updated++;
      }
    }
    db.exec('COMMIT');
    committed = true;
  } finally {
    if (!committed) { try { db.exec('ROLLBACK'); } catch {} }
  }

  return { desired: desired.size, added, updated, deleted: stale.length };
}

export function recompute() {
  if (_running) {
    // Another recompute is mid-flight on this process. Note that a follow-up
    // pass is wanted and return a no-op result; the active call will pick up
    // the latest DB state (or we'll catch it on the next tick).
    _rerunQueued = true;
    return { desired: 0, added: 0, updated: 0, deleted: 0, skipped: true };
  }
  _running = true;
  try {
    let result = _recomputeUnlocked();
    // Drain any queued reruns so callers that arrived during the active pass
    // still see their changes reflected before we return control.
    while (_rerunQueued) {
      _rerunQueued = false;
      result = _recomputeUnlocked();
    }
    return result;
  } finally {
    _running = false;
  }
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
