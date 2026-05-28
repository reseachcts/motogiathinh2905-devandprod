// notifications.test.js — integration test that exercises the recompute
// logic against the seeded DB. Boots ad-hoc against backend/data/<temp>.db.

import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, rmSync, copyFileSync, existsSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { resolve, join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { execSync } from 'node:child_process';

const HERE = dirname(fileURLToPath(import.meta.url));
let tmpDir, dbPath;
let recompute, buildDesired, db;

before(async () => {
  // Run the seeder into a throwaway tmp DB so we don't disturb the dev DB.
  tmpDir = mkdtempSync(join(tmpdir(), 'mgt-notif-test-'));
  dbPath = join(tmpDir, 'test.db');
  process.env.DB_PATH = dbPath;
  // Run seed via child process so it imports a fresh db module with our env.
  execSync(`node ${join(HERE, '..', 'seed', 'seed-from-csv.js')}`, {
    cwd: resolve(HERE, '..'), env: { ...process.env, DB_PATH: dbPath },
    stdio: 'pipe',
  });
  // Now import the modules — they'll pick up DB_PATH from env.
  ({ db } = await import('../db.js'));
  ({ recompute, buildDesired } = await import('../notifications.js'));
});

after(() => {
  try { db?.close(); } catch {}
  if (tmpDir && existsSync(tmpDir)) rmSync(tmpDir, { recursive: true, force: true });
});

test('buildDesired produces auto-* notifications from real seed', () => {
  const desired = buildDesired();
  assert.ok(desired.size > 0, 'expected some auto notifications');
  for (const [id, row] of desired) {
    assert.ok(id.startsWith('auto-payment-') || id.startsWith('auto-profile-'),
      'id should be auto-payment-* or auto-profile-*, got ' + id);
    assert.ok(['payment', 'profile'].includes(row.type));
    assert.ok(['info', 'warn', 'danger'].includes(row.severity));
    assert.ok(row.studentId);
  }
});

test('recompute is idempotent — second run has no changes', () => {
  const r1 = recompute();
  // After the FIRST recompute, every desired row is present.
  const r2 = recompute();
  assert.equal(r2.added, 0, 'no rows added on second run');
  assert.equal(r2.updated, 0, 'no rows updated on second run');
  assert.equal(r2.deleted, 0, 'no rows deleted on second run');
});

test('PATCH profileComplete=true removes the auto-profile row', () => {
  const desired = buildDesired();
  const sample = [...desired.values()].find(n => n.type === 'profile');
  assert.ok(sample, 'expected at least one profile-incomplete student');
  const sid = sample.studentId;
  // Flip the student.
  db.prepare('UPDATE students SET profileComplete = 1 WHERE id = ?').run(sid);
  recompute();
  const after = db.prepare('SELECT id FROM notifications WHERE id = ?').get(`auto-profile-${sid}`);
  assert.equal(after, undefined, 'auto-profile-<sid> should be deleted after flip');
  // Restore so subsequent test runs see the same state.
  db.prepare('UPDATE students SET profileComplete = 0 WHERE id = ?').run(sid);
  recompute();
});

test('hand-created notifications (no auto- prefix) are not touched', () => {
  const beforeHand = db.prepare("SELECT COUNT(*) AS n FROM notifications WHERE id NOT LIKE 'auto-%'").get().n;
  recompute();
  recompute();
  const afterHand = db.prepare("SELECT COUNT(*) AS n FROM notifications WHERE id NOT LIKE 'auto-%'").get().n;
  assert.equal(afterHand, beforeHand);
});
