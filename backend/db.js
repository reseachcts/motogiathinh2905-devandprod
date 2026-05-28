// db.js — SQLite via Node's built-in node:sqlite (Node 22+).
// Single shared synchronous handle, WAL mode, ~80ms boot end-to-end.

import { DatabaseSync } from 'node:sqlite';
import { readFileSync, mkdirSync, existsSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));

const DB_PATH = process.env.DB_PATH
  ? resolve(process.env.DB_PATH)
  : resolve(HERE, 'data', 'motogiathinh.db');

mkdirSync(dirname(DB_PATH), { recursive: true });

export const db = new DatabaseSync(DB_PATH);
db.exec('PRAGMA journal_mode = WAL');
db.exec('PRAGMA foreign_keys = ON');
db.exec('PRAGMA busy_timeout = 5000');

// Apply schema migrations. 001 is idempotent (CREATE IF NOT EXISTS).
// Later ones (ALTER TABLE) can't be — we track applied versions in a
// _migrations table and skip what's already done.
db.exec("CREATE TABLE IF NOT EXISTS _migrations (id TEXT PRIMARY KEY, applied_at TEXT)");
const applied = new Set(db.prepare('SELECT id FROM _migrations').all().map(r => r.id));
const MIGRATIONS = ['001_init.sql', '002_uploads.sql'];
for (const m of MIGRATIONS) {
  if (applied.has(m)) continue;
  const sql = readFileSync(resolve(HERE, 'migrations', m), 'utf-8');
  db.exec(sql);
  db.prepare('INSERT INTO _migrations (id, applied_at) VALUES (?, ?)')
    .run(m, new Date().toISOString());
}

// ---------------------------------------------------------------------------
// Tiny helpers: row coercion. SQLite stores 0/1 INTEGER for bools; we cast to
// native JSON booleans on the way out so the rewritten frontend data-loader
// doesn't need string-coercion logic.
// ---------------------------------------------------------------------------
const BOOL_FIELDS = {
  accounts:      ['active'],
  students:      ['profileComplete', 'docs_cccd', 'docs_gksk', 'docs_donDeNghi', 'docs_the3x4'],
  payments:      ['bienLaiPhoto'],
  teachers:      ['active'],
  notifications: ['read'],
};

export function coerceBools(table, row) {
  if (!row) return row;
  const fields = BOOL_FIELDS[table];
  if (!fields) return row;
  for (const f of fields) {
    if (f in row && row[f] !== null) row[f] = !!row[f];
  }
  return row;
}

export function coerceBoolsAll(table, rows) {
  if (!BOOL_FIELDS[table]) return rows;
  for (const r of rows) coerceBools(table, r);
  return rows;
}

// Tables exposed via per-table read endpoints. Order matters for boot stats only.
export const ENTITY_TABLES = [
  'branches', 'accounts', 'classes', 'students', 'payments',
  'fee_plans', 'promotions', 'teachers', 'vehicles',
  'notifications', 'activity_log',
];

export function countAll() {
  const out = {};
  for (const t of ENTITY_TABLES) {
    out[t] = db.prepare(`SELECT COUNT(*) AS n FROM ${t}`).get().n;
  }
  return out;
}

// Append to activity_log. Cheap; called from every write endpoint.
const insertActivity = db.prepare(
  'INSERT INTO activity_log (id, userId, action, target, at) VALUES (?, ?, ?, ?, ?)'
);
export function logActivity(userId, action, target) {
  const id = 'act-' + Date.now().toString(36) + '-' + Math.random().toString(36).slice(2, 8);
  const at = nowDdMmYyyyHHMMSS();
  insertActivity.run(id, userId || null, action, target || null, at);
  return id;
}

// dd/mm/yyyy HH:MM:SS — same format the frontend parses everywhere.
export function nowDdMmYyyyHHMMSS(d = new Date()) {
  const p = (n) => String(n).padStart(2, '0');
  return `${p(d.getDate())}/${p(d.getMonth() + 1)}/${d.getFullYear()} ${p(d.getHours())}:${p(d.getMinutes())}:${p(d.getSeconds())}`;
}
export function nowDdMmYyyy(d = new Date()) {
  const p = (n) => String(n).padStart(2, '0');
  return `${p(d.getDate())}/${p(d.getMonth() + 1)}/${d.getFullYear()}`;
}

// ID generators. Keep them ergonomic + sortable.
const _idCounters = {};
export function genId(prefix) {
  // prefix-yyyymmdd-HHMMSS-NN (NN = short rand) — sortable + collision-resistant.
  const d = new Date();
  const p = (n) => String(n).padStart(2, '0');
  const stamp = `${d.getFullYear()}${p(d.getMonth() + 1)}${p(d.getDate())}-${p(d.getHours())}${p(d.getMinutes())}${p(d.getSeconds())}`;
  _idCounters[prefix] = (_idCounters[prefix] || 0) + 1;
  const seq = String(_idCounters[prefix]).padStart(2, '0');
  return `${prefix}-${stamp}-${seq}`;
}

// Next maHV (HV0001, HV0002, …). Picks max numeric suffix + 1.
export function nextMaHV() {
  const row = db.prepare(
    "SELECT MAX(CAST(SUBSTR(maHV, 3) AS INTEGER)) AS m FROM students WHERE maHV GLOB 'HV[0-9]*'"
  ).get();
  const next = (row.m || 0) + 1;
  return 'HV' + String(next).padStart(4, '0');
}

// Next bienLaiId BL-YYYY-NNNN — yearly counter.
export function nextBienLaiId() {
  const yr = new Date().getFullYear();
  const prefix = `BL-${yr}-`;
  const row = db.prepare(
    "SELECT MAX(CAST(SUBSTR(bienLaiId, ?) AS INTEGER)) AS m FROM payments WHERE bienLaiId LIKE ? || '%'"
  ).get(prefix.length + 1, prefix);
  const next = (row.m || 0) + 1;
  return prefix + String(next).padStart(4, '0');
}

export function closeDb() {
  try { db.close(); } catch { /* ignore */ }
}
