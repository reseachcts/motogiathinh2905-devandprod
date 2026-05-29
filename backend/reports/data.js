// reports/data.js — assembles the 6 datasets used by both the Excel and
// PDF formal-report renderers. All derivations happen server-side here
// so the Excel and PDF outputs are guaranteed identical.

import { db } from '../db.js';

// dd/mm/yyyy [HH:MM:SS] → ms-epoch. Mirrors the parseDT in
// webapp/data-loader.js so the period filter matches the live UI.
function parseDT(s) {
  if (!s) return 0;
  const [d, m, y, hh = 0, mm = 0, ss = 0] = String(s).trim().split(/[\/\s:]/).map(n => parseInt(n, 10));
  return new Date(y, m - 1, d, hh, mm, ss).getTime();
}

function fmtDate(d) {
  const p = (n) => String(n).padStart(2, '0');
  return `${p(d.getDate())}/${p(d.getMonth() + 1)}/${d.getFullYear()}`;
}

// Resolve the report period. Accepts dd/mm/yyyy ISO strings; defaults to
// last 7 days inclusive of today.
export function resolvePeriod(opts = {}) {
  const now = new Date();
  let until = opts.until ? parseInputDate(opts.until) : new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59);
  let since = opts.since ? parseInputDate(opts.since) : new Date(until.getFullYear(), until.getMonth(), until.getDate() - 6, 0, 0, 0);
  return {
    since, until,
    sinceMs: since.getTime(),
    untilMs: until.getTime(),
    label: `${fmtDate(since)} → ${fmtDate(until)}`,
  };
}
function parseInputDate(s) {
  // Accept dd/mm/yyyy. Anything else → today.
  const m = /^(\d{2})\/(\d{2})\/(\d{4})$/.exec(String(s || '').trim());
  if (!m) { const t = new Date(); return new Date(t.getFullYear(), t.getMonth(), t.getDate()); }
  return new Date(+m[3], +m[2] - 1, +m[1]);
}

// ---------------------------------------------------------------------------
// Derived student fields. Recomputes paid/balance/paymentStatus from the
// ledger so the report agrees with what the live UI shows.
//
// Rental payments (kind='rental') are EXCLUDED from the sum — rentals
// don't reduce a student's tuition balance; they're a pay-on-the-spot
// service tracked separately. Matches webapp/data-loader.js behaviour.
// ---------------------------------------------------------------------------
function studentsWithDerived(branchIdScope) {
  const where = branchIdScope ? 'WHERE branchId = ?' : '';
  const args = branchIdScope ? [branchIdScope] : [];
  const rows = db.prepare(`
    SELECT s.*, COALESCE(p.paid, 0) AS paid
    FROM students s
    LEFT JOIN (
      SELECT studentId, SUM(amount) AS paid
      FROM payments WHERE kind = 'tuition' GROUP BY studentId
    ) p ON p.studentId = s.id
    ${where}
    ORDER BY s.createdAt DESC
  `).all(...args);
  for (const s of rows) {
    s.paid = s.paid || 0;
    s.balance = (s.totalFee || 0) - s.paid;
    s.paymentStatus = s.paid <= 0 ? '0%' : s.paid >= s.totalFee ? '100%' : '50%';
  }
  return rows;
}

// ---------------------------------------------------------------------------
// 1. Tổng kết theo chi nhánh — branch aggregates for the period AND lifetime.
// ---------------------------------------------------------------------------
export function branchSummary(period) {
  const branches = db.prepare('SELECT * FROM branches').all();
  return branches.map(b => {
    const allStudents = studentsWithDerived(b.id);
    const newInPeriod = allStudents.filter(s => {
      const t = parseDT(s.createdAt);
      return t >= period.sinceMs && t <= period.untilMs;
    });
    const periodPays = db.prepare(`
      SELECT * FROM payments WHERE branchId = ? AND kind = 'tuition'
    `).all(b.id).filter(p => {
      const t = parseDT(p.createdAt);
      return t >= period.sinceMs && t <= period.untilMs;
    });
    return {
      branchId:  b.id,
      branchName: b.name,
      students:  allStudents.length,
      newStudents: newInPeriod.length,
      revenuePeriod: periodPays.reduce((a, p) => a + p.amount, 0),
      revenueAll:    db.prepare("SELECT COALESCE(SUM(amount),0) AS s FROM payments WHERE branchId = ? AND kind = 'tuition'").get(b.id).s,
      committed:     allStudents.reduce((a, s) => a + (s.totalFee || 0), 0),
      outstanding:   allStudents.reduce((a, s) => a + Math.max(0, s.balance || 0), 0),
      paidFull: allStudents.filter(s => s.paymentStatus === '100%').length,
      partial:  allStudents.filter(s => s.paymentStatus === '50%').length,
      unpaid:   allStudents.filter(s => s.paymentStatus === '0%').length,
    };
  });
}

// ---------------------------------------------------------------------------
// 2. Thanh toán trong kỳ — every payment in the period with joined lookups.
// ---------------------------------------------------------------------------
export function paymentsInPeriod(period) {
  // Tuition only — the Thanh toán list mirrors the live UI which hides
  // rentals from the regular payments page (rentals live under the
  // dedicated "Cho thuê xe" section below).
  const all = db.prepare(`
    SELECT p.*, s.name AS studentName, s.maHV AS studentMaHV,
           b.name AS branchName, a.name AS staffName, c.code AS classCode
    FROM payments p
    LEFT JOIN students s ON s.id = p.studentId
    LEFT JOIN branches b ON b.id = p.branchId
    LEFT JOIN accounts a ON a.id = p.staffId
    LEFT JOIN classes  c ON c.id = s.classId
    WHERE p.kind = 'tuition'
    ORDER BY p.createdAt DESC
  `).all();
  return all.filter(p => {
    const t = parseDT(p.createdAt);
    return t >= period.sinceMs && t <= period.untilMs;
  });
}

// ---------------------------------------------------------------------------
// 7. Cho thuê xe trong kỳ — vehicle rentals (separate from revenue).
// ---------------------------------------------------------------------------
export function rentalsInPeriod(period) {
  const all = db.prepare(`
    SELECT p.*, s.name AS studentName, s.maHV AS studentMaHV,
           b.name AS branchName, a.name AS staffName,
           v.name AS vehicleName, v.plate AS vehiclePlate, v.licence AS vehicleLicence
    FROM payments p
    LEFT JOIN students s ON s.id = p.studentId
    LEFT JOIN branches b ON b.id = p.branchId
    LEFT JOIN accounts a ON a.id = p.staffId
    LEFT JOIN vehicles v ON v.id = p.vehicleId
    WHERE p.kind = 'rental'
    ORDER BY p.createdAt DESC
  `).all();
  return all.filter(p => {
    const t = parseDT(p.createdAt);
    return t >= period.sinceMs && t <= period.untilMs;
  });
}

// ---------------------------------------------------------------------------
// 3. Học viên đăng ký mới trong kỳ.
// ---------------------------------------------------------------------------
export function newStudentsInPeriod(period) {
  const all = studentsWithDerived(null);
  return all.filter(s => {
    const t = parseDT(s.createdAt);
    return t >= period.sinceMs && t <= period.untilMs;
  }).map(s => {
    const cls = db.prepare('SELECT code FROM classes WHERE id = ?').get(s.classId);
    const br  = db.prepare('SELECT name FROM branches WHERE id = ?').get(s.branchId);
    const fee = db.prepare('SELECT name FROM fee_plans WHERE id = ?').get(s.feePlanId);
    return { ...s, classCode: cls?.code || '', branchName: br?.name || '', feePlanName: fee?.name || '' };
  });
}

// ---------------------------------------------------------------------------
// 4. Lớp đang hoạt động — currently "đang diễn ra" classes (date-derived).
// ---------------------------------------------------------------------------
export function activeClasses() {
  const nowMs = Date.now();
  const rows = db.prepare(`
    SELECT c.*, b.name AS branchName,
           (SELECT COUNT(*) FROM students s WHERE s.classId = c.id) AS enrolled
    FROM classes c LEFT JOIN branches b ON b.id = c.branchId
  `).all();
  return rows.filter(c => {
    if (c.statusOverride) return c.statusOverride === 'đang diễn ra';
    const open = parseDT(c.openDate);
    const exam = parseDT(c.examDate);
    return exam >= nowMs && open <= nowMs;
  }).sort((a, b) => parseDT(a.openDate) - parseDT(b.openDate));
}

// ---------------------------------------------------------------------------
// 5. Học viên còn nợ — outstanding-balance roster (any branch, balance > 0).
// ---------------------------------------------------------------------------
export function outstandingStudents() {
  const all = studentsWithDerived(null);
  return all.filter(s => s.balance > 0).map(s => {
    const cls = db.prepare('SELECT code FROM classes WHERE id = ?').get(s.classId);
    const br  = db.prepare('SELECT name FROM branches WHERE id = ?').get(s.branchId);
    return { ...s, classCode: cls?.code || '', branchName: br?.name || '' };
  }).sort((a, b) => b.balance - a.balance);
}

// ---------------------------------------------------------------------------
// 6. Nhật ký Sửa / Xóa trong kỳ — audit trail (creates excluded per spec).
// ---------------------------------------------------------------------------
export function auditLogInPeriod(period) {
  const rows = db.prepare(`
    SELECT al.*, a.name AS userName, a.role AS userRole
    FROM activity_log al
    LEFT JOIN accounts a ON a.id = al.userId
    ORDER BY al.at DESC
  `).all();
  return rows.filter(l => {
    const t = parseDT(l.at);
    if (t < period.sinceMs || t > period.untilMs) return false;
    // Per user spec: "no warnings upon creation" — audit table covers
    // edits + deletes + money operations only.
    if (/\.(update|delete|reset_password|doc_clear|upload)$/i.test(l.action)) return true;
    if (/^(payment|payments|rental|rentals)\./.test(l.action)) return true;
    return false;
  });
}

// ---------------------------------------------------------------------------
// Top-level: assemble everything the renderers need.
// ---------------------------------------------------------------------------
export function buildReportData(opts = {}) {
  const period = resolvePeriod(opts);
  return {
    period,
    generatedAt: fmtDate(new Date()) + ' ' + new Date().toTimeString().slice(0, 5),
    company: 'CENTERSAI · MOTOGIATHINH',
    branchSummary:       branchSummary(period),
    paymentsInPeriod:    paymentsInPeriod(period),
    newStudentsInPeriod: newStudentsInPeriod(period),
    activeClasses:       activeClasses(),
    outstandingStudents: outstandingStudents(),
    rentalsInPeriod:     rentalsInPeriod(period),
    auditLog:            auditLogInPeriod(period),
  };
}

export function fmtVND(n) {
  const abs = Math.abs(Math.round(n || 0));
  return (n < 0 ? '−' : '') + abs.toLocaleString('en-US') + 'đ';
}
