// routes/auth.js — POST /api/auth/login, POST /api/auth/logout, GET /api/me

import { Router } from 'express';
import {
  COOKIE_NAME, cookieOptions, findAccountByEmail, findAccountById,
  hashPassword, publicAccount, requireAuth, signToken, verifyPassword,
} from '../auth.js';
import { db, logActivity } from '../db.js';

const router = Router();

router.post('/auth/login', (req, res) => {
  const { email, password } = req.body || {};
  if (!email || !password) return res.status(400).json({ error: 'missing_credentials' });

  const account = findAccountByEmail(email);
  if (!account || !verifyPassword(password, account.passwordHash)) {
    return res.status(401).json({ error: 'invalid_credentials' });
  }

  const token = signToken(account);
  res.cookie(COOKIE_NAME, token, cookieOptions());
  logActivity(account.id, 'auth.login', account.email);
  res.json({ user: publicAccount(account) });
});

router.post('/auth/logout', (req, res) => {
  res.clearCookie(COOKIE_NAME, { path: '/' });
  if (req.user) logActivity(req.user.id, 'auth.logout', req.user.email);
  res.json({ ok: true });
});

router.get('/me', requireAuth, (req, res) => {
  res.json({ user: publicAccount(req.user) });
});

// Self-service password change. Admin can also change other users' passwords
// via PATCH /accounts/:id (see routes/accounts.js).
router.post('/auth/password', requireAuth, (req, res) => {
  const { currentPassword, newPassword } = req.body || {};
  if (!currentPassword || !newPassword) return res.status(400).json({ error: 'missing_fields' });
  if (newPassword.length < 8) return res.status(400).json({ error: 'password_too_short' });
  if (!verifyPassword(currentPassword, req.user.passwordHash)) {
    return res.status(401).json({ error: 'invalid_credentials' });
  }
  db.prepare('UPDATE accounts SET passwordHash = ? WHERE id = ?').run(hashPassword(newPassword), req.user.id);
  logActivity(req.user.id, 'auth.password_change', req.user.email);
  res.json({ ok: true });
});

export default router;
