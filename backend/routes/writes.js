// routes/writes.js — POST / PATCH endpoints implied by the frontend modals.
//
// Each write:
//   1. Validates required fields (BACKEND.md §8 invariants).
//   2. Inserts/updates the canonical row.
//   3. Appends an activity_log entry.
//   4. Returns the fresh row(s) the frontend needs to patch its in-memory
//      MGT_DATA without reloading the page.
//
// Payments are immutable (BACKEND.md §8.5) — no DELETE/UPDATE; corrections
// are compensating event entries (negative amount).

import { Router } from 'express';
import {
  db, logActivity, nowDdMmYyyy, nowDdMmYyyyHHMMSS,
  nextMaHV, nextBienLaiId, genId, coerceBools,
} from '../db.js';
import { requireAuth, requireAdmin, hashPassword, publicAccount } from '../auth.js';

const router = Router();
router.use(requireAuth);

const VALID_LICENCE = ['A', 'A1'];
const VALID_METHOD  = ['Tiền mặt', 'Chuyển khoản'];

function bad(res, code, error, extra) { return res.status(code).json({ error, ...extra }); }

// ---------------------------------------------------------------------------
// Students
// ---------------------------------------------------------------------------

// POST /api/students — modal: AddStudentModal { form, docs, profileComplete }
router.post('/students', (req, res) => {
  const { form, docs, profileComplete } = req.body || {};
  if (!form?.name || !form.classId || !form.responsibleStaffId) {
    return bad(res, 400, 'missing_required_fields');
  }

  const cls = db.prepare('SELECT * FROM classes WHERE id = ?').get(form.classId);
  if (!cls) return bad(res, 400, 'invalid_classId');

  const feePlan = form.feePlanId
    ? db.prepare('SELECT * FROM fee_plans WHERE id = ?').get(form.feePlanId)
    : null;
  if (form.feePlanId && !feePlan) return bad(res, 400, 'invalid_feePlanId');

  const promo = form.promotionId && form.promotionId !== 'promo-none'
    ? db.prepare('SELECT * FROM promotions WHERE id = ?').get(form.promotionId)
    : null;
  if (form.promotionId && form.promotionId !== 'promo-none' && !promo) {
    return bad(res, 400, 'invalid_promotionId');
  }

  const licence = feePlan?.licence || (VALID_LICENCE.includes(form.licence) ? form.licence : 'A');
  const totalFee = feePlan ? feePlan.amount - (promo?.discount || 0) : 0;

  // Branch-scoping: staff users can only enroll into their own branch.
  if (req.user.role !== 'admin' && cls.branchId !== req.user.branchId) {
    return bad(res, 403, 'wrong_branch');
  }

  const id = genId('s');
  const maHV = nextMaHV();
  const createdAt = nowDdMmYyyyHHMMSS();
  const d = docs || {};

  try {
    db.prepare(`
      INSERT INTO students (
        id, maHV, name, phone, dob, gender, idNumber, address, queQuan,
        ngayCapCCCD, noiCapCCCD, classId, licence, feePlanId, promotionId,
        totalFee, profileComplete, responsibleStaffId, branchId, createdAt,
        docs_cccd, docs_gksk, docs_donDeNghi, docs_the3x4, notes
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      id, maHV, form.name, form.phone || null, form.dob || null, form.gender || null,
      form.idNumber || null, form.address || null, form.queQuan || null,
      form.ngayCapCCCD || null, form.noiCapCCCD || null,
      form.classId, licence, form.feePlanId || null, form.promotionId || null,
      totalFee, profileComplete ? 1 : 0, form.responsibleStaffId, cls.branchId, createdAt,
      d.cccd ? 1 : 0, d.gksk ? 1 : 0, d.donDeNghi ? 1 : 0, d.the3x4 ? 1 : 0,
      form.notes || null,
    );
  } catch (e) {
    if (String(e.message).includes('UNIQUE')) return bad(res, 409, 'duplicate', { detail: e.message });
    throw e;
  }

  logActivity(req.user.id, 'student.create', maHV);
  const row = db.prepare('SELECT * FROM students WHERE id = ?').get(id);
  res.status(201).json(coerceBools('students', row));
});

// PATCH /api/students/:id — partial update.
router.patch('/students/:id', (req, res) => {
  const id = req.params.id;
  const existing = db.prepare('SELECT * FROM students WHERE id = ?').get(id);
  if (!existing) return bad(res, 404, 'not_found');
  if (req.user.role !== 'admin' && existing.branchId !== req.user.branchId) {
    return bad(res, 403, 'wrong_branch');
  }

  const allowed = ['name', 'phone', 'dob', 'gender', 'idNumber', 'address', 'queQuan',
    'ngayCapCCCD', 'noiCapCCCD', 'classId', 'licence', 'feePlanId', 'promotionId',
    'profileComplete', 'responsibleStaffId', 'notes',
    'docs_cccd', 'docs_gksk', 'docs_donDeNghi', 'docs_the3x4'];
  const sets = [], vals = [];
  for (const k of allowed) {
    if (k in req.body) {
      let v = req.body[k];
      if (k.startsWith('docs_') || k === 'profileComplete') v = v ? 1 : 0;
      sets.push(`${k} = ?`); vals.push(v);
    }
  }
  if (!sets.length) return bad(res, 400, 'no_fields_to_update');
  vals.push(id);
  db.prepare(`UPDATE students SET ${sets.join(', ')} WHERE id = ?`).run(...vals);

  logActivity(req.user.id, 'student.update', existing.maHV);
  const row = db.prepare('SELECT * FROM students WHERE id = ?').get(id);
  res.json(coerceBools('students', row));
});

// ---------------------------------------------------------------------------
// Payments — immutable event log.
// ---------------------------------------------------------------------------

router.post('/payments', (req, res) => {
  const { studentId, amount, method, bienLaiId, bienLaiPhoto, staffId } = req.body || {};
  if (!studentId || !amount || !method) return bad(res, 400, 'missing_required_fields');
  if (!VALID_METHOD.includes(method)) return bad(res, 400, 'invalid_method');

  const student = db.prepare('SELECT * FROM students WHERE id = ?').get(studentId);
  if (!student) return bad(res, 400, 'invalid_studentId');
  if (req.user.role !== 'admin' && student.branchId !== req.user.branchId) {
    return bad(res, 403, 'wrong_branch');
  }

  const amt = parseInt(amount, 10);
  if (!Number.isFinite(amt) || amt === 0) return bad(res, 400, 'invalid_amount');

  const id = genId('PMT');
  const blId = bienLaiId || nextBienLaiId();
  const createdAt = nowDdMmYyyyHHMMSS();

  try {
    db.prepare(`
      INSERT INTO payments (id, studentId, branchId, staffId, amount, method, bienLaiId, bienLaiPhoto, createdAt)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(id, studentId, student.branchId, staffId || req.user.id, amt, method, blId,
      bienLaiPhoto ? 1 : 0, createdAt);
  } catch (e) {
    if (String(e.message).includes('UNIQUE')) return bad(res, 409, 'duplicate_bienLaiId');
    throw e;
  }

  logActivity(req.user.id, 'payment.create', `${blId} (${amt}đ for ${student.maHV})`);
  const row = db.prepare('SELECT * FROM payments WHERE id = ?').get(id);
  res.status(201).json(coerceBools('payments', row));
});

// ---------------------------------------------------------------------------
// Classes — admin only for create/update.
// ---------------------------------------------------------------------------

router.post('/classes', requireAdmin, (req, res) => {
  const { code, branchId, openDate, examDate } = req.body || {};
  if (!code || !branchId) return bad(res, 400, 'missing_required_fields');
  const branch = db.prepare('SELECT id FROM branches WHERE id = ?').get(branchId);
  if (!branch) return bad(res, 400, 'invalid_branchId');

  const id = genId('cls');
  db.prepare(`
    INSERT INTO classes (id, code, branchId, openDate, examDate, statusOverride)
    VALUES (?, ?, ?, ?, ?, NULL)
  `).run(id, code, branchId, openDate || nowDdMmYyyy(), examDate || nowDdMmYyyy());
  logActivity(req.user.id, 'class.create', `${code} @ ${branchId}`);
  res.status(201).json(db.prepare('SELECT * FROM classes WHERE id = ?').get(id));
});

router.patch('/classes/:id', requireAdmin, (req, res) => {
  const id = req.params.id;
  const existing = db.prepare('SELECT * FROM classes WHERE id = ?').get(id);
  if (!existing) return bad(res, 404, 'not_found');

  const allowed = ['code', 'branchId', 'openDate', 'examDate', 'statusOverride'];
  const sets = [], vals = [];
  for (const k of allowed) if (k in req.body) { sets.push(`${k} = ?`); vals.push(req.body[k]); }
  if (!sets.length) return bad(res, 400, 'no_fields_to_update');
  vals.push(id);
  db.prepare(`UPDATE classes SET ${sets.join(', ')} WHERE id = ?`).run(...vals);
  logActivity(req.user.id, 'class.update', existing.code);
  res.json(db.prepare('SELECT * FROM classes WHERE id = ?').get(id));
});

// ---------------------------------------------------------------------------
// Admin-only CRUD for support tables: accounts / fee-plans / promotions /
// teachers / vehicles. Same minimal pattern: insert with generated id, log.
// ---------------------------------------------------------------------------

function makeAdminCreator(table, prefix, fields, opts = {}) {
  return (req, res) => {
    const row = { id: genId(prefix) };
    for (const f of fields) row[f] = req.body?.[f] ?? null;
    if (opts.preInsert) opts.preInsert(row, req);
    if (opts.required) {
      for (const r of opts.required) if (!row[r]) return bad(res, 400, 'missing_' + r);
    }
    try {
      const cols = ['id', ...fields, ...(opts.extraCols ? Object.keys(opts.extraCols) : [])];
      if (opts.extraCols) Object.assign(row, opts.extraCols);
      const placeholders = cols.map(() => '?').join(', ');
      db.prepare(`INSERT INTO ${table} (${cols.join(', ')}) VALUES (${placeholders})`)
        .run(...cols.map(c => row[c] ?? null));
    } catch (e) {
      if (String(e.message).includes('UNIQUE')) return bad(res, 409, 'duplicate', { detail: e.message });
      throw e;
    }
    logActivity(req.user.id, `${table}.create`, row.id);
    const fresh = db.prepare(`SELECT * FROM ${table} WHERE id = ?`).get(row.id);
    coerceBools(table, fresh);
    res.status(201).json(opts.postFetch ? opts.postFetch(fresh) : fresh);
  };
}

router.post('/accounts', requireAdmin, makeAdminCreator('accounts', 'u',
  ['name', 'role', 'branchId', 'phone', 'email'], {
    required: ['name', 'email', 'role'],
    preInsert: (row, req) => {
      if (req.body.password) row.passwordHash = hashPassword(req.body.password);
      row.lastActive = nowDdMmYyyyHHMMSS();
    },
    extraCols: { passwordHash: null, lastActive: null, active: 1 },
    postFetch: publicAccount,
  }));

router.post('/fee-plans', requireAdmin, makeAdminCreator('fee_plans', 'fee',
  ['name', 'licence', 'amount'], { required: ['name', 'licence', 'amount'] }));

// promotions: appliesTo is an array on the wire, joined to pipe-string for DB.
router.post('/promotions', requireAdmin, (req, res) => {
  const { name, appliesTo, discount } = req.body || {};
  if (!name) return bad(res, 400, 'missing_name');
  const id = genId('promo');
  const csv = Array.isArray(appliesTo) ? appliesTo.join('|') : (appliesTo || '');
  db.prepare('INSERT INTO promotions (id, name, appliesTo_csv, discount) VALUES (?, ?, ?, ?)')
    .run(id, name, csv, parseInt(discount, 10) || 0);
  logActivity(req.user.id, 'promotion.create', id);
  res.status(201).json(db.prepare('SELECT * FROM promotions WHERE id = ?').get(id));
});

router.post('/teachers', requireAdmin, makeAdminCreator('teachers', 't',
  ['name', 'phone', 'yearsExp', 'branchId'], {
    required: ['name'],
    extraCols: { active: 1 },
  }));

router.post('/vehicles', requireAdmin, makeAdminCreator('vehicles', 'v',
  ['name', 'licence', 'plate', 'year', 'branchId', 'status'], { required: ['name'] }));

// PATCH /api/notifications/:id { read: true }
router.patch('/notifications/:id', (req, res) => {
  const id = req.params.id;
  const existing = db.prepare('SELECT * FROM notifications WHERE id = ?').get(id);
  if (!existing) return bad(res, 404, 'not_found');
  if (!('read' in (req.body || {}))) return bad(res, 400, 'missing_read');
  db.prepare('UPDATE notifications SET read = ? WHERE id = ?').run(req.body.read ? 1 : 0, id);
  res.json(coerceBools('notifications', db.prepare('SELECT * FROM notifications WHERE id = ?').get(id)));
});

export default router;
