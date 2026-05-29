// routes/auth.js — POST /api/auth/login, POST /api/auth/logout, GET /api/me

import { Router } from 'express';
import {
  COOKIE_NAME, cookieOptions, findAccountByEmail, findAccountById,
  hashPassword, publicAccount, requireAuth, signToken, verifyPassword, verifyToken,
  passwordPolicy, checkLoginAttempt, recordLoginFailure, clearLoginFailures,
} from '../auth.js';
import { db, logActivity } from '../db.js';

const router = Router();

router.post('/auth/login', (req, res) => {
  const { email, password } = req.body || {};
  if (!email || !password) return res.status(400).json({ error: 'missing_credentials' });

  const gate = checkLoginAttempt(email);
  if (!gate.allowed) {
    logActivity(null, 'auth.login_blocked', `${email} (${gate.code})`);
    return res.status(429).json({ error: gate.code, message: gate.message, retryAfter: gate.retryAfter });
  }

  const account = findAccountByEmail(email);
  if (!account || !verifyPassword(password, account.passwordHash)) {
    recordLoginFailure(email);
    logActivity(null, 'auth.login_fail', email);
    return res.status(401).json({ error: 'invalid_credentials' });
  }

  clearLoginFailures(email);
  const token = signToken(account);
  res.cookie(COOKIE_NAME, token, cookieOptions());
  logActivity(account.id, 'auth.login', account.email);
  res.json({ user: publicAccount(account) });
});

// Logout is idempotent: it always clears the cookie and returns 200, even on
// double-logout when the cookie has already been cleared. When a valid session
// IS present, we resolve req.user (so we can write an activity_log entry that
// names the actor instead of dropping the audit trail).
router.post('/auth/logout', (req, res) => {
  const token = req.cookies?.[COOKIE_NAME];
  const claims = token ? verifyToken(token) : null;
  const account = claims ? findAccountById(claims.sub) : null;
  if (account?.active) {
    req.user = account;
    logActivity(account.id, 'auth.logout', account.email);
  }
  res.clearCookie(COOKIE_NAME, { path: '/' });
  res.json({ ok: true });
});

router.get('/me', requireAuth, (req, res) => {
  res.json({ user: publicAccount(req.user) });
});

// Self-service password change. Admin can reset any user's password via
// POST /accounts/:id/reset-password (see routes/writes.js).
router.post('/auth/password', requireAuth, (req, res) => {
  const { currentPassword, newPassword } = req.body || {};
  if (!currentPassword || !newPassword) return res.status(400).json({ error: 'missing_fields' });
  const pol = passwordPolicy(newPassword);
  if (!pol.ok) return res.status(400).json({ error: pol.code, message: pol.message });
  if (!verifyPassword(currentPassword, req.user.passwordHash)) {
    return res.status(401).json({ error: 'invalid_credentials' });
  }
  db.prepare('UPDATE accounts SET passwordHash = ? WHERE id = ?').run(hashPassword(newPassword), req.user.id);
  logActivity(req.user.id, 'auth.password_change', req.user.email);
  res.json({ ok: true });
});

export default router;
