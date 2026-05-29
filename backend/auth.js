// auth.js — JWT + bcrypt + role-based middleware.
//
// JWT is mounted as a same-site HttpOnly cookie so the frozen frontend
// (no localStorage / no Authorization header wiring) authenticates
// transparently. Login endpoint sets the cookie; logout clears it.

import jwt from 'jsonwebtoken';
import bcrypt from 'bcryptjs';
import { db, nowDdMmYyyyHHMMSS } from './db.js';

const JWT_SECRET   = process.env.JWT_SECRET;
const JWT_COOKIE   = process.env.JWT_COOKIE || 'mgt_session';
const JWT_DAYS     = Math.max(1, Number(process.env.JWT_DAYS) || 14);
const IS_PROD      = process.env.NODE_ENV === 'production';

if (IS_PROD && !JWT_SECRET) {
  console.error('FATAL: JWT_SECRET must be set in production. Set it in backend/.env');
  process.exit(1);
}
// Dev fallback — clearly insecure, only used when NODE_ENV !== "production".
const SECRET = JWT_SECRET || 'dev-only-do-not-use-in-prod';

export function signToken(account) {
  return jwt.sign(
    { sub: account.id, role: account.role, branchId: account.branchId || null },
    SECRET,
    { expiresIn: `${JWT_DAYS}d` }
  );
}

export function verifyToken(token) {
  try { return jwt.verify(token, SECRET); }
  catch { return null; }
}

export function cookieOptions() {
  return {
    httpOnly: true,
    sameSite: 'lax',
    secure: IS_PROD,
    maxAge: JWT_DAYS * 24 * 60 * 60 * 1000,
    path: '/',
  };
}
export const COOKIE_NAME = JWT_COOKIE;

// -- account lookups ---------------------------------------------------------

export function findAccountByEmail(email) {
  return db.prepare('SELECT * FROM accounts WHERE LOWER(email) = LOWER(?) AND active = 1').get(email);
}

export function findAccountById(id) {
  return db.prepare('SELECT * FROM accounts WHERE id = ?').get(id);
}

export function verifyPassword(plain, hash) {
  if (!hash) return false;
  try { return bcrypt.compareSync(plain, hash); }
  catch { return false; }
}

export function hashPassword(plain) {
  return bcrypt.hashSync(plain, 10);
}

// -- password complexity ----------------------------------------------------
// 8+ chars · ≥1 lowercase · ≥1 uppercase · ≥1 digit · ≥1 special.
// The frontend "Tạo tài khoản mới" dialog shows the same 5 checks live.
const MIN_PW_LEN = Math.max(8, Number(process.env.MIN_PASSWORD_LENGTH) || 8);
const SPECIAL_RE = /[!@#$%^&*()_+\-={}\[\]|\\:;"'<>,.?/~`]/;
export function passwordPolicy(pw) {
  if (typeof pw !== 'string') return { ok: false, code: 'password_required', message: 'Mật khẩu là bắt buộc.' };
  if (pw.length < MIN_PW_LEN) return { ok: false, code: 'password_too_short',
    message: `Mật khẩu phải có ít nhất ${MIN_PW_LEN} ký tự.` };
  if (!/[a-z]/.test(pw)) return { ok: false, code: 'password_needs_lowercase',
    message: 'Mật khẩu phải có ít nhất một chữ thường (a–z).' };
  if (!/[A-Z]/.test(pw)) return { ok: false, code: 'password_needs_uppercase',
    message: 'Mật khẩu phải có ít nhất một chữ HOA (A–Z).' };
  if (!/\d/.test(pw)) return { ok: false, code: 'password_needs_digit',
    message: 'Mật khẩu phải có ít nhất một chữ số.' };
  if (!SPECIAL_RE.test(pw)) return { ok: false, code: 'password_needs_special',
    message: 'Mật khẩu phải có ít nhất một ký tự đặc biệt.' };
  return { ok: true };
}

// -- login rate limiting ----------------------------------------------------
// Sliding window per email: max LIMIT failed attempts in WINDOW_MS, then
// LOCKOUT_MS cooldown. In-memory; resets on restart (fine for single-node).
const LIMIT       = Number(process.env.LOGIN_LIMIT)       || 5;
const WINDOW_MS   = (Number(process.env.LOGIN_WINDOW_MIN) || 15) * 60_000;
const LOCKOUT_MS  = (Number(process.env.LOGIN_LOCKOUT_MIN) || 60) * 60_000;
const _failures = new Map();    // email → { attempts: number[], lockUntil: number }

function _now() { return Date.now(); }
function _key(email) { return String(email || '').toLowerCase().trim(); }

export function checkLoginAttempt(email) {
  const k = _key(email);
  const rec = _failures.get(k);
  if (!rec) return { allowed: true };
  if (rec.lockUntil && rec.lockUntil > _now()) {
    return { allowed: false, code: 'account_locked',
      message: `Tài khoản tạm khóa. Thử lại sau ${Math.ceil((rec.lockUntil - _now())/60000)} phút.`,
      retryAfter: rec.lockUntil - _now() };
  }
  // Drop attempts outside the window.
  rec.attempts = rec.attempts.filter(t => _now() - t < WINDOW_MS);
  if (rec.attempts.length >= LIMIT) {
    return { allowed: false, code: 'too_many_attempts',
      message: `Quá ${LIMIT} lần thử trong ${Math.round(WINDOW_MS/60000)} phút. Vui lòng đợi.` };
  }
  return { allowed: true };
}

export function recordLoginFailure(email) {
  const k = _key(email);
  const rec = _failures.get(k) || { attempts: [], lockUntil: 0 };
  rec.attempts.push(_now());
  rec.attempts = rec.attempts.filter(t => _now() - t < WINDOW_MS);
  // Hard lockout after double the per-window limit.
  if (rec.attempts.length >= LIMIT * 2) {
    rec.lockUntil = _now() + LOCKOUT_MS;
    rec.attempts = [];
  }
  _failures.set(k, rec);
}

export function clearLoginFailures(email) {
  _failures.delete(_key(email));
}

// Periodic cleanup so abandoned attempt records don't accumulate forever in
// a long-running process. Drops entries whose attempts window is empty AND
// whose lockout has expired — both implicit "no longer relevant" signals.
// Runs every 60s, unref'd so it doesn't keep the event loop alive at
// shutdown. Tests don't need this so we only start it under non-test envs
// (NODE_ENV !== 'test') to keep `node --test` deterministic.
function _evictStaleFailures() {
  const now = _now();
  for (const [k, rec] of _failures) {
    const liveAttempts = rec.attempts.filter(t => now - t < WINDOW_MS);
    const stillLocked = rec.lockUntil && rec.lockUntil > now;
    if (!liveAttempts.length && !stillLocked) {
      _failures.delete(k);
    } else if (liveAttempts.length !== rec.attempts.length) {
      rec.attempts = liveAttempts;     // trim in place
    }
  }
}
if (process.env.NODE_ENV !== 'test') {
  setInterval(_evictStaleFailures, 60_000).unref();
}
// Exported only for tests; the live interval handles production cleanup.
export const _evictStaleFailuresForTest = _evictStaleFailures;

const touchActive = db.prepare('UPDATE accounts SET lastActive = ? WHERE id = ?');
export function bumpLastActive(accountId) {
  touchActive.run(nowDdMmYyyyHHMMSS(), accountId);
}

// -- middleware --------------------------------------------------------------

export function requireAuth(req, res, next) {
  const token = req.cookies?.[COOKIE_NAME];
  const claims = token ? verifyToken(token) : null;
  if (!claims) return res.status(401).json({ error: 'auth_required' });

  const account = findAccountById(claims.sub);
  if (!account || !account.active) return res.status(401).json({ error: 'auth_invalid' });

  req.user = account;
  // Cheap touch; don't await — better-sqlite3 / node:sqlite is sync anyway.
  bumpLastActive(account.id);
  next();
}

export function requireAdmin(req, res, next) {
  if (!req.user) return res.status(401).json({ error: 'auth_required' });
  if (req.user.role !== 'admin') return res.status(403).json({ error: 'admin_required' });
  next();
}

// Branch-scoping helper: staff users are limited to their own branchId on
// list / detail / mutation routes that accept a branchId parameter.
// Returns the effective branchId filter, or null = no scoping (admin).
export function effectiveBranchScope(req, requestedBranchId) {
  if (!req.user) return null;
  if (req.user.role === 'admin') return requestedBranchId || null;
  // staff: always pinned to their branch.
  return req.user.branchId || null;
}

// Strip sensitive fields before returning an account to the client. Also
// coerces SQLite's 0/1 INTEGER bools into native JSON booleans so the
// frontend doesn't need string-coercion logic.
export function publicAccount(account) {
  if (!account) return null;
  const { passwordHash, ...safe } = account;
  if ('active' in safe) safe.active = !!safe.active;
  return safe;
}
