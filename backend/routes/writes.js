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
import { requireAuth, requireAdmin, hashPassword, publicAccount, passwordPolicy } from '../auth.js';
import { recomputeAfterWrite } from '../notifications.js';
import { validators as V, check, bad as badV } from '../validation.js';

const router = Router();
router.use(requireAuth);

const VALID_LICENCE = ['A', 'A1'];
const VALID_METHOD  = ['Tiền mặt', 'Chuyển khoản'];

function bad(res, code, error, extra) { return res.status(code).json({ error, ...extra }); }

// Validate a student form payload (POST + PATCH share most rules).
function validateStudentForm(form, { isCreate }) {
  if (isCreate) {
    const req = check(V.required(form, ['name', 'classId', 'responsibleStaffId']));
    if (req) return req;
  }
  return check(
    V.phone(form.phone),
    V.cccd(form.idNumber),
    V.date('dob', form.dob),
    V.date('ngayCapCCCD', form.ngayCapCCCD),
    V.licence(form.licence),
  );
}

// ---------------------------------------------------------------------------
// Students
// ---------------------------------------------------------------------------

// POST /api/students — modal: AddStudentModal { form, docs, profileComplete }
router.post('/students', (req, res) => {
  const { form, docs, profileComplete } = req.body || {};
  if (!form) return bad(res, 400, 'missing_form');
  const vErr = validateStudentForm(form, { isCreate: true });
  if (vErr) return badV(res, vErr);

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
  recomputeAfterWrite(req.user.id, `student ${maHV}`);
  const row = db.prepare('SELECT * FROM students WHERE id = ?').get(id);
  res.status(201).json(coerceBools('students', row));
});

// PATCH /api/students/:id — partial update.
//
// Fee/promo changes are admin-only and trigger a server-side totalFee
// recompute per BACKEND.md §8.4 (totalFee = feePlan.amount - promo.discount)
// so the derived paid/balance/paymentStatus stays consistent. Staff users
// editing the same row keep their existing scope (branch-only, no fee fields).
router.patch('/students/:id', (req, res) => {
  const id = req.params.id;
  const existing = db.prepare('SELECT * FROM students WHERE id = ?').get(id);
  if (!existing) return bad(res, 404, 'not_found');
  if (req.user.role !== 'admin' && existing.branchId !== req.user.branchId) {
    return bad(res, 403, 'wrong_branch');
  }
  const body = req.body || {};
  // Fee / promo changes are admin-only — staff would otherwise be able to
  // discount a student's tuition by editing the linked plan/promo.
  if (req.user.role !== 'admin' && ('feePlanId' in body || 'promotionId' in body)) {
    return bad(res, 403, 'admin_required');
  }
  const vErr = validateStudentForm(body, { isCreate: false });
  if (vErr) return badV(res, vErr);

  // If feePlanId or promotionId is changing, recompute totalFee from the
  // *new* combination (falling back to existing values for whichever field
  // wasn't touched). Validate the referenced rows up front so the UPDATE
  // doesn't half-apply.
  let derivedTotalFee = null;
  if ('feePlanId' in body || 'promotionId' in body) {
    const newFeeId = ('feePlanId'   in body) ? body.feePlanId   : existing.feePlanId;
    const newPromoId = ('promotionId' in body) ? body.promotionId : existing.promotionId;
    const feePlan = newFeeId
      ? db.prepare('SELECT * FROM fee_plans WHERE id = ?').get(newFeeId)
      : null;
    if (newFeeId && !feePlan) return bad(res, 400, 'invalid_feePlanId');
    const promo = newPromoId && newPromoId !== 'promo-none'
      ? db.prepare('SELECT * FROM promotions WHERE id = ?').get(newPromoId)
      : null;
    if (newPromoId && newPromoId !== 'promo-none' && !promo) {
      return bad(res, 400, 'invalid_promotionId');
    }
    derivedTotalFee = feePlan ? (feePlan.amount - (promo?.discount || 0)) : 0;
  }

  const allowed = ['name', 'phone', 'dob', 'gender', 'idNumber', 'address', 'queQuan',
    'ngayCapCCCD', 'noiCapCCCD', 'classId', 'licence', 'feePlanId', 'promotionId',
    'profileComplete', 'responsibleStaffId', 'notes',
    'docs_cccd', 'docs_gksk', 'docs_donDeNghi', 'docs_the3x4'];
  const sets = [], vals = [];
  for (const k of allowed) {
    if (k in body) {
      let v = body[k];
      if (k.startsWith('docs_') || k === 'profileComplete') v = v ? 1 : 0;
      sets.push(`${k} = ?`); vals.push(v);
    }
  }
  if (derivedTotalFee != null) {
    sets.push('totalFee = ?');
    vals.push(derivedTotalFee);
  }
  if (!sets.length) return bad(res, 400, 'no_fields_to_update');
  vals.push(id);
  db.prepare(`UPDATE students SET ${sets.join(', ')} WHERE id = ?`).run(...vals);

  logActivity(req.user.id, 'student.update', existing.maHV);
  recomputeAfterWrite(req.user.id, `student ${existing.maHV}`);
  const row = db.prepare('SELECT * FROM students WHERE id = ?').get(id);
  res.json(coerceBools('students', row));
});

// ---------------------------------------------------------------------------
// Payments — immutable event log.
// ---------------------------------------------------------------------------

router.post('/payments', (req, res) => {
  const { studentId, amount, method, bienLaiId, bienLaiPhoto, staffId,
          kind, vehicleId, rentalRounds } = req.body || {};
  if (!studentId || !method) return bad(res, 400, 'missing_required_fields');
  const methodErr = V.method(method);
  if (methodErr) return badV(res, methodErr);

  // Kind defaults to 'tuition'. Rentals are a separate ledger — same
  // `payments` table, but excluded from branch revenue / student balance.
  const k = kind || 'tuition';
  const kindErr = V.paymentKind(k);
  if (kindErr) return badV(res, kindErr);

  const student = db.prepare('SELECT * FROM students WHERE id = ?').get(studentId);
  if (!student) return bad(res, 400, 'invalid_studentId');
  if (req.user.role !== 'admin' && student.branchId !== req.user.branchId) {
    return bad(res, 403, 'wrong_branch');
  }

  // -- Rental branch ----------------------------------------------------
  // Server is the source of truth for the amount: it = vehicle.price ×
  // rentalRounds. The client never picks the number; we want audit logs
  // to reflect a price the operator can't quietly change.
  let amt, vehicleRow = null, rounds = null;
  if (k === 'rental') {
    if (!vehicleId) return bad(res, 400, 'rental_requires_vehicleId');
    rounds = parseInt(rentalRounds, 10);
    if (!Number.isFinite(rounds) || rounds < 1) return bad(res, 400, 'rental_requires_positive_rounds');
    vehicleRow = db.prepare('SELECT * FROM vehicles WHERE id = ?').get(vehicleId);
    if (!vehicleRow) return bad(res, 400, 'invalid_vehicleId');
    if (req.user.role !== 'admin' && vehicleRow.branchId && vehicleRow.branchId !== req.user.branchId) {
      return bad(res, 403, 'wrong_branch');
    }
    if (!vehicleRow.price || vehicleRow.price <= 0) return bad(res, 400, 'vehicle_price_unset');
    amt = vehicleRow.price * rounds;
  } else {
    // -- Tuition branch (legacy default) --------------------------------
    const amtErr = V.amount(amount, { allowNegative: true });
    if (amtErr) return badV(res, amtErr);
    amt = parseInt(amount, 10);
  }

  const id = genId(k === 'rental' ? 'RNT' : 'PMT');
  const blId = bienLaiId || nextBienLaiId();
  const createdAt = nowDdMmYyyyHHMMSS();

  try {
    db.prepare(`
      INSERT INTO payments (id, studentId, branchId, staffId, amount, method, bienLaiId, bienLaiPhoto, createdAt,
                            kind, vehicleId, rentalRounds)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(id, studentId, student.branchId, staffId || req.user.id, amt, method, blId,
      bienLaiPhoto ? 1 : 0, createdAt, k, vehicleId || null, rounds);
  } catch (e) {
    if (String(e.message).includes('UNIQUE')) return bad(res, 409, 'duplicate_bienLaiId');
    throw e;
  }

  const auditAction = k === 'rental' ? 'rental.create' : 'payment.create';
  const auditTarget = k === 'rental'
    ? `${blId} (${amt}đ · ${vehicleRow.name} × ${rounds} for ${student.maHV})`
    : `${blId} (${amt}đ for ${student.maHV})`;
  logActivity(req.user.id, auditAction, auditTarget);
  recomputeAfterWrite(req.user.id, `payment ${blId}`);
  const row = db.prepare('SELECT * FROM payments WHERE id = ?').get(id);
  res.status(201).json(coerceBools('payments', row));
});

// ---------------------------------------------------------------------------
// Classes — admin only for create/update.
// ---------------------------------------------------------------------------

router.post('/classes', requireAdmin, (req, res) => {
  const { code, branchId, openDate, examDate } = req.body || {};
  if (!code || !branchId) return bad(res, 400, 'missing_required_fields');
  const vErr = check(V.date('openDate', openDate), V.date('examDate', examDate));
  if (vErr) return badV(res, vErr);
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
  const vErr = check(
    V.date('openDate', req.body?.openDate),
    V.date('examDate', req.body?.examDate),
    V.classStatus(req.body?.statusOverride),
  );
  if (vErr) return badV(res, vErr);

  const allowed = ['code', 'branchId', 'openDate', 'examDate', 'statusOverride'];
  const sets = [], vals = [];
  for (const k of allowed) if (k in req.body) { sets.push(`${k} = ?`); vals.push(req.body[k]); }
  if (!sets.length) return bad(res, 400, 'no_fields_to_update');
  vals.push(id);
  db.prepare(`UPDATE classes SET ${sets.join(', ')} WHERE id = ?`).run(...vals);
  logActivity(req.user.id, 'class.update', existing.code);
  recomputeAfterWrite(req.user.id, `class ${existing.code}`);
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

// Branches — admin-only CRUD with FK-aware DELETE.
router.post('/branches', requireAdmin, makeAdminCreator('branches', 'br',
  ['name', 'address', 'manager_id'], { required: ['name'] }));

router.delete('/branches/:id', requireAdmin, (req, res) => {
  const id = req.params.id;
  const existing = db.prepare('SELECT * FROM branches WHERE id = ?').get(id);
  if (!existing) return bad(res, 404, 'not_found');
  // Refuse if any class / student / payment / teacher / vehicle / account
  // references this branch — preserves FK integrity even though SQLite-side
  // FKs aren't declared on these tables.
  const refs = {
    classes:  db.prepare('SELECT COUNT(*) AS n FROM classes  WHERE branchId = ?').get(id).n,
    students: db.prepare('SELECT COUNT(*) AS n FROM students WHERE branchId = ?').get(id).n,
    accounts: db.prepare('SELECT COUNT(*) AS n FROM accounts WHERE branchId = ?').get(id).n,
    teachers: db.prepare('SELECT COUNT(*) AS n FROM teachers WHERE branchId = ?').get(id).n,
    vehicles: db.prepare('SELECT COUNT(*) AS n FROM vehicles WHERE branchId = ?').get(id).n,
  };
  const total = Object.values(refs).reduce((a, b) => a + b, 0);
  if (total > 0) return bad(res, 409, 'branch_in_use', { references: refs });
  db.prepare('DELETE FROM branches WHERE id = ?').run(id);
  logActivity(req.user.id, 'branch.delete', `${id} (${existing.name})`);
  res.json({ ok: true, id });
});

// POST /accounts — admin-only account creation.
//   - role / email validated against the locked enums + regex in validation.js
//   - branchId must reference an existing row (FK is not declared SQLite-side
//     because branches were historically fixed; now CRUD-able, so we check).
//   - password goes through passwordPolicy() before bcrypt, so weak passwords
//     bail with a 400 + structured error (UI maps the code to a friendly msg).
router.post('/accounts', requireAdmin, (req, res, next) => {
  const { role, email, branchId, password } = req.body || {};
  // Enum / regex validation up front so the user sees a clear error before
  // the generic creator runs an INSERT that would have to be rolled back.
  const vErr = check(V.role(role), V.email(email));
  if (vErr) return badV(res, vErr);
  if (branchId) {
    const branchOk = db.prepare('SELECT 1 FROM branches WHERE id = ?').get(branchId);
    if (!branchOk) return bad(res, 400, 'invalid_branchId');
  }
  // Password is required at creation time — without it the account can never
  // log in. passwordPolicy enforces length + char-class rules.
  const pol = passwordPolicy(password);
  if (!pol.ok) return bad(res, 400, pol.code, { message: pol.message });
  next();
}, makeAdminCreator('accounts', 'u',
  ['name', 'role', 'branchId', 'phone', 'email'], {
    required: ['name', 'email', 'role'],
    preInsert: (row, req) => {
      row.passwordHash = hashPassword(req.body.password);
      row.lastActive = nowDdMmYyyyHHMMSS();
    },
    extraCols: { passwordHash: null, lastActive: null, active: 1 },
    postFetch: publicAccount,
  }));

router.post('/fee-plans', requireAdmin, makeAdminCreator('fee_plans', 'fee',
  ['name', 'licence', 'amount'], { required: ['name', 'licence', 'amount'] }));

// promotions: appliesTo is an array on the wire, joined to pipe-string for DB.
// Filter the incoming array down to the canonical licence set {A, A1} per
// SPEC §3; legacy fee-plan ids (e.g. "fee-a") slipping in here would break
// the frontend's `selectedFeePlan.licence`-based promo matcher.
router.post('/promotions', requireAdmin, (req, res) => {
  const { name, appliesTo, discount } = req.body || {};
  if (!name) return bad(res, 400, 'missing_name');
  const filtered = Array.isArray(appliesTo)
    ? appliesTo.filter(v => v === 'A' || v === 'A1')
    : [];
  const id = genId('promo');
  const csv = filtered.join('|');
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
  ['name', 'licence', 'plate', 'year', 'branchId', 'status', 'price'], { required: ['name'] }));

// Branch-scope guard for notifications: system-wide rows (no studentId) are
// editable by anyone; per-student rows are limited to the student's branch.
// Returns null when allowed, or a {status, error} object to bail with.
function notificationBranchGuard(req, existing) {
  if (req.user.role === 'admin') return null;
  if (!existing.studentId) return null;       // system-wide notification
  const student = db.prepare('SELECT branchId FROM students WHERE id = ?').get(existing.studentId);
  // If the student vanished, treat as cross-branch (safer than allowing).
  if (!student || student.branchId !== req.user.branchId) {
    return { status: 403, error: 'wrong_branch' };
  }
  return null;
}

// PATCH /api/notifications/:id { read: true }
router.patch('/notifications/:id', (req, res) => {
  const id = req.params.id;
  const existing = db.prepare('SELECT * FROM notifications WHERE id = ?').get(id);
  if (!existing) return bad(res, 404, 'not_found');
  const guard = notificationBranchGuard(req, existing);
  if (guard) return bad(res, guard.status, guard.error);
  if (!('read' in (req.body || {}))) return bad(res, 400, 'missing_read');
  db.prepare('UPDATE notifications SET read = ? WHERE id = ?').run(req.body.read ? 1 : 0, id);
  res.json(coerceBools('notifications', db.prepare('SELECT * FROM notifications WHERE id = ?').get(id)));
});

// DELETE /api/notifications/:id — user dismisses a notification.
router.delete('/notifications/:id', (req, res) => {
  const id = req.params.id;
  const existing = db.prepare('SELECT * FROM notifications WHERE id = ?').get(id);
  if (!existing) return bad(res, 404, 'not_found');
  const guard = notificationBranchGuard(req, existing);
  if (guard) return bad(res, guard.status, guard.error);
  db.prepare('DELETE FROM notifications WHERE id = ?').run(id);
  logActivity(req.user.id, 'notification.delete', id);
  res.json({ ok: true, id });
});

// ---------------------------------------------------------------------------
// PATCH for support tables. Per-table whitelist of mutable columns; same
// generic body that writes.js uses for student/class patches.
// ---------------------------------------------------------------------------

const PATCHABLE = {
  accounts:   ['name', 'role', 'branchId', 'phone', 'email', 'active'],
  fee_plans:  ['name', 'licence', 'amount'],
  promotions: ['name', 'appliesTo', 'discount'],
  teachers:   ['name', 'phone', 'yearsExp', 'branchId', 'active'],
  vehicles:   ['name', 'licence', 'plate', 'year', 'branchId', 'status', 'price'],
  branches:   ['name', 'address', 'manager_id'],
};

const BOOL_PATCH_FIELDS = { accounts: ['active'], teachers: ['active'] };

// Locked-enum gate: tables here have field→validator pairs that must pass
// before the column gets included in the UPDATE. Catches PATCH payloads that
// try to elevate a staff account to `superadmin`, change a fee plan's licence
// to `B2`, etc. — clearer 400 than letting the value land in the DB.
const ENUM_VALIDATORS = {
  accounts:   { role: V.role },
  fee_plans:  { licence: V.licence },
  promotions: {},
  teachers:   {},
  vehicles:   { licence: V.licence },
  branches:   {},
};

function makeAdminPatcher(table) {
  return (req, res) => {
    const id = req.params.id;
    const existing = db.prepare(`SELECT * FROM ${table} WHERE id = ?`).get(id);
    if (!existing) return bad(res, 404, 'not_found');
    const allowed = PATCHABLE[table];
    // Run enum validators before building the SET clause so a bad value
    // surfaces as a structured field error instead of silently sticking.
    const enums = ENUM_VALIDATORS[table] || {};
    for (const k of Object.keys(enums)) {
      if (k in req.body) {
        const e = enums[k](req.body[k]);
        if (e) return badV(res, e);
      }
    }
    // promotions.appliesTo on the wire is an array; canonicalize to
    // {'A','A1'} per SPEC §3 so legacy fee-plan ids can't sneak through.
    if (table === 'promotions' && 'appliesTo' in (req.body || {})) {
      const raw = req.body.appliesTo;
      if (Array.isArray(raw)) {
        req.body.appliesTo = raw.filter(v => v === 'A' || v === 'A1');
      }
    }
    const sets = [], vals = [];
    for (const k of allowed) {
      if (!(k in req.body)) continue;
      let v = req.body[k];
      // promotions.appliesTo on the wire is an array; persist as pipe-string.
      if (table === 'promotions' && k === 'appliesTo') {
        v = Array.isArray(v) ? v.join('|') : (v || '');
        sets.push('appliesTo_csv = ?');
        vals.push(v);
        continue;
      }
      if ((BOOL_PATCH_FIELDS[table] || []).includes(k)) v = v ? 1 : 0;
      sets.push(`${k} = ?`); vals.push(v);
    }
    if (!sets.length) return bad(res, 400, 'no_fields_to_update');
    vals.push(id);
    try {
      db.prepare(`UPDATE ${table} SET ${sets.join(', ')} WHERE id = ?`).run(...vals);
    } catch (e) {
      if (String(e.message).includes('UNIQUE')) return bad(res, 409, 'duplicate', { detail: e.message });
      throw e;
    }
    logActivity(req.user.id, `${table}.update`, id);
    const fresh = db.prepare(`SELECT * FROM ${table} WHERE id = ?`).get(id);
    coerceBools(table, fresh);
    res.json(table === 'accounts' ? publicAccount(fresh) : fresh);
  };
}

router.patch('/accounts/:id',   requireAdmin, makeAdminPatcher('accounts'));
router.patch('/fee-plans/:id',  requireAdmin, makeAdminPatcher('fee_plans'));
router.patch('/promotions/:id', requireAdmin, makeAdminPatcher('promotions'));
router.patch('/teachers/:id',   requireAdmin, makeAdminPatcher('teachers'));
router.patch('/vehicles/:id',   requireAdmin, makeAdminPatcher('vehicles'));
router.patch('/branches/:id',   requireAdmin, makeAdminPatcher('branches'));

// Admin password reset for any account (separate from /auth/password which
// requires the caller's current password).
router.post('/accounts/:id/reset-password', requireAdmin, (req, res) => {
  const id = req.params.id;
  const existing = db.prepare('SELECT * FROM accounts WHERE id = ?').get(id);
  if (!existing) return bad(res, 404, 'not_found');
  const { newPassword } = req.body || {};
  const pol = passwordPolicy(newPassword);
  if (!pol.ok) return bad(res, 400, pol.code, { message: pol.message });
  db.prepare('UPDATE accounts SET passwordHash = ? WHERE id = ?').run(hashPassword(newPassword), id);
  logActivity(req.user.id, 'accounts.reset_password', id);
  res.json({ ok: true });
});

export default router;
