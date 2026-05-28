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
