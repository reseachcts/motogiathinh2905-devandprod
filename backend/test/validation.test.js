// validation.test.js — unit tests for backend/validation.js.
// Run: node --test backend/test/

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { validators as V, check } from '../validation.js';

test('phone — accepts Vietnamese formats', () => {
  assert.equal(V.phone('0900000000'), null);
  assert.equal(V.phone('090 000 0000'), null);
  assert.equal(V.phone('090.000.0000'), null);
  assert.equal(V.phone('090-000-0000'), null);
  assert.equal(V.phone(''), null);  // optional
  assert.equal(V.phone(null), null);
});

test('phone — rejects bad input', () => {
  assert.equal(V.phone('abc').code, 'bad_phone');
  assert.equal(V.phone('123').code, 'bad_phone');           // too short
  assert.equal(V.phone('1234567890123').code, 'bad_phone'); // too long
});

test('cccd — accepts 12 digits, rejects others', () => {
  assert.equal(V.cccd('123456789012'), null);
  assert.equal(V.cccd(''), null);
  assert.equal(V.cccd('123').code, 'bad_cccd');
  assert.equal(V.cccd('12345678901a').code, 'bad_cccd');    // letter in middle
  assert.equal(V.cccd('1234567890123').code, 'bad_cccd');   // too long
});

test('date — strict dd/mm/yyyy with real-date check', () => {
  assert.equal(V.date('dob', '01/01/2000'), null);
  assert.equal(V.date('dob', '29/02/2024'), null);          // leap year
  assert.equal(V.date('dob', ''), null);                    // optional
  assert.equal(V.date('dob', '31/02/2024').code, 'bad_date');  // impossible
  assert.equal(V.date('dob', '29/02/2023').code, 'bad_date');  // not leap
  assert.equal(V.date('dob', '2024-01-01').code, 'bad_date');  // wrong format
  assert.equal(V.date('dob', '1/1/2000').code, 'bad_date');    // missing zero pad
});

test('amount — integer non-zero, optional negative', () => {
  assert.equal(V.amount(100), null);
  assert.equal(V.amount('500000'), null);
  assert.equal(V.amount(0).code, 'bad_amount');
  assert.equal(V.amount('').code, 'bad_amount');
  assert.equal(V.amount(null).code, 'bad_amount');
  assert.equal(V.amount(100.5).code, 'bad_amount');
  assert.equal(V.amount(-100).code, 'bad_amount');                       // default rejects
  assert.equal(V.amount(-100, { allowNegative: true }), null);            // opt-in
});

test('classStatus — locked enum', () => {
  for (const ok of ['đang mở', 'đang diễn ra', 'đã kết thúc']) {
    assert.equal(V.classStatus(ok), null);
  }
  assert.equal(V.classStatus(null), null);  // unchanged is fine
  assert.equal(V.classStatus('bogus').code, 'bad_status');
});

test('licence + method + role — locked enums', () => {
  assert.equal(V.licence('A'), null);
  assert.equal(V.licence('A1'), null);
  assert.equal(V.licence('B').code, 'bad_licence');
  assert.equal(V.method('Tiền mặt'), null);
  assert.equal(V.method('cash').code, 'bad_method');
  assert.equal(V.role('admin'), null);
  assert.equal(V.role('owner').code, 'bad_role');
});

test('required — all fields present', () => {
  assert.equal(V.required({ a: 1, b: 'x' }, ['a', 'b']), null);
  assert.equal(V.required({ a: 1 }, ['a', 'b']).code, 'required');
  assert.equal(V.required({ a: 1, b: '' }, ['a', 'b']).code, 'required');
});

test('check — short-circuits on first error', () => {
  const e1 = { field: 'phone', code: 'bad_phone', message: 'x' };
  assert.equal(check(null, null, null), null);
  assert.equal(check(null, e1, null), e1);
  assert.equal(check(e1, { code: 'other' }), e1);
});

test('email — basic format', () => {
  assert.equal(V.email('a@b.co'), null);
  assert.equal(V.email(''), null);
  assert.equal(V.email('not-email').code, 'bad_email');
  assert.equal(V.email('a@').code, 'bad_email');
});
