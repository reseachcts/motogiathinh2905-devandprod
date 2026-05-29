// auth-policy.test.js — passwordPolicy + rate limit behavior.
// In-memory only; safe to run without a live server.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  passwordPolicy, checkLoginAttempt, recordLoginFailure, clearLoginFailures,
  hashPassword,
} from '../auth.js';

test('passwordPolicy — rejects too short', () => {
  const r = passwordPolicy('Ab1!');
  assert.equal(r.ok, false);
  assert.equal(r.code, 'password_too_short');
});

test('passwordPolicy — rejects missing complexity classes', () => {
  // 8+ chars but missing each class in turn. Checks are ordered
  // length → lower → upper → digit → special, so each input below trips
  // exactly the predicted code.
  assert.equal(passwordPolicy('ABCDEFG1!').code,   'password_needs_lowercase');
  assert.equal(passwordPolicy('abcdefg1!').code,   'password_needs_uppercase');
  assert.equal(passwordPolicy('Abcdefgh!').code,   'password_needs_digit');
  assert.equal(passwordPolicy('Abcdefg1').code,    'password_needs_special');
});

test('passwordPolicy — accepts conforming password', () => {
  assert.equal(passwordPolicy('Strong1Pass!').ok, true);
  assert.equal(passwordPolicy('MậtKhẩu1@').ok,    true);  // unicode letters + digit + special
});

test('rate limit — N attempts allowed, N+1 blocked', () => {
  const email = 'rl-test-1@example.com';
  clearLoginFailures(email);
  for (let i = 0; i < 5; i++) {
    assert.equal(checkLoginAttempt(email).allowed, true, `attempt ${i+1}`);
    recordLoginFailure(email);
  }
  const blocked = checkLoginAttempt(email);
  assert.equal(blocked.allowed, false);
  assert.equal(blocked.code, 'too_many_attempts');
});

test('rate limit — clearLoginFailures resets state', () => {
  const email = 'rl-test-2@example.com';
  clearLoginFailures(email);
  for (let i = 0; i < 5; i++) recordLoginFailure(email);
  assert.equal(checkLoginAttempt(email).allowed, false);
  clearLoginFailures(email);
  assert.equal(checkLoginAttempt(email).allowed, true);
});

test('rate limit — lockout after double the threshold', () => {
  const email = 'rl-test-3@example.com';
  clearLoginFailures(email);
  // 5 failures → rate limited (not yet locked)
  for (let i = 0; i < 5; i++) recordLoginFailure(email);
  // Pile on past the lockout threshold
  for (let i = 0; i < 5; i++) recordLoginFailure(email);
  const r = checkLoginAttempt(email);
  assert.equal(r.allowed, false);
  assert.equal(r.code, 'account_locked');
  assert.ok(r.retryAfter > 0);
});

test('hashPassword — bcrypt round-trip', async () => {
  const { default: bcrypt } = await import('bcryptjs');
  const hash = hashPassword('topsecret123');
  assert.ok(hash.startsWith('$2'));
  assert.equal(bcrypt.compareSync('topsecret123', hash), true);
  assert.equal(bcrypt.compareSync('wrong', hash), false);
});
