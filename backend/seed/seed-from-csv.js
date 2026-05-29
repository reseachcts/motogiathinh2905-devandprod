// seed/seed-from-csv.js — one-shot importer of the design's CSV fixtures.
//
// Reads ../../webapp/data/*.csv and INSERTs into the SQLite tables.
// Idempotent by default (skips tables that already have rows). Pass --reset
// to wipe + re-seed. Also creates the default admin account if missing.

import { readFileSync, existsSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { parse as parseCsv } from 'csv-parse/sync';
import bcrypt from 'bcryptjs';

import { db, ENTITY_TABLES, countAll, nowDdMmYyyyHHMMSS } from '../db.js';

const HERE = dirname(fileURLToPath(import.meta.url));
const DATA_DIR = resolve(HERE, '..', '..', 'webapp', 'data');

const RESET = process.argv.includes('--reset');

// CSV column → DB column mappings (where they differ from the schema)
// and per-column casts (CSV is always strings).
const TABLE_SPECS = {
  branches: {
    csv: 'branches.csv',
    intCols: [],
    boolCols: [],
  },
  accounts: {
    csv: 'accounts.csv',
    intCols: [],
    boolCols: ['active'],
  },
  classes: {
    csv: 'classes.csv',
    intCols: [],
    boolCols: [],
    // classes CSV has no statusOverride column; insert NULL.
    columnOrder: ['id', 'code', 'branchId', 'openDate', 'examDate'],
    extraCols: { statusOverride: null },
  },
  students: {
    csv: 'students.csv',
    intCols: ['totalFee'],
    boolCols: ['profileComplete', 'docs_cccd', 'docs_gksk', 'docs_donDeNghi', 'docs_the3x4'],
  },
  payments: {
    csv: 'payments.csv',
    intCols: ['amount'],
    boolCols: ['bienLaiPhoto'],
  },
  fee_plans: {
    csv: 'fee_plans.csv',
    intCols: ['amount'],
    boolCols: [],
  },
  promotions: {
    csv: 'promotions.csv',
    intCols: ['discount'],
    boolCols: [],
  },
  teachers: {
    csv: 'teachers.csv',
    intCols: ['yearsExp'],
    boolCols: ['active'],
  },
  vehicles: {
    csv: 'vehicles.csv',
    intCols: ['year', 'price'],
    boolCols: [],
  },
  notifications: {
    csv: 'notifications.csv',
    intCols: [],
    boolCols: ['read'],
  },
  activity_log: {
    csv: 'activity_log.csv',
    intCols: [],
    boolCols: [],
  },
};

function loadCsv(name) {
  const path = resolve(DATA_DIR, name);
  if (!existsSync(path)) throw new Error('CSV not found: ' + path);
  return parseCsv(readFileSync(path, 'utf-8'), { columns: true, skip_empty_lines: true, bom: true });
}

// Phone / CCCD canonicalization. Migration 004 normalizes existing rows
// but only runs once per DB; --reset re-inserts CSV-formatted data, so we
// re-canonicalize here too. Keep in sync with window.fmtPhone / fmtCCCD
// (frontend) and validation.js (backend).
function digitsOnly(s) { return String(s || '').replace(/\D+/g, ''); }
function castRow(row, spec) {
  for (const k of spec.intCols) row[k] = row[k] === '' || row[k] == null ? 0 : parseInt(row[k], 10);
  for (const k of spec.boolCols) row[k] = row[k] === 'true' ? 1 : 0;
  if ('phone' in row && row.phone) {
    let p = digitsOnly(row.phone);
    if (p.length === 9) p = p + '0';   // VN spec is exactly 10
    row.phone = p.slice(0, 10);
  }
  if ('idNumber' in row && row.idNumber) row.idNumber = digitsOnly(row.idNumber).slice(0, 12);
  if (spec.extraCols) Object.assign(row, spec.extraCols);
  return row;
}

function insertMany(table, rows, columnOrder) {
  if (!rows.length) return 0;
  const cols = columnOrder || Object.keys(rows[0]);
  const placeholders = cols.map(() => '?').join(', ');
  const stmt = db.prepare(`INSERT INTO ${table} (${cols.join(', ')}) VALUES (${placeholders})`);
  const tx = db.prepare('BEGIN');
  const commit = db.prepare('COMMIT');
  tx.run();
  try {
    for (const r of rows) {
      stmt.run(...cols.map(c => r[c] ?? null));
    }
    commit.run();
  } catch (e) {
    db.prepare('ROLLBACK').run();
    throw e;
  }
  return rows.length;
}

function wipeAll() {
  for (const t of [...ENTITY_TABLES].reverse()) {
    db.prepare(`DELETE FROM ${t}`).run();
  }
}

function seedTables() {
  for (const [table, spec] of Object.entries(TABLE_SPECS)) {
    const rows = loadCsv(spec.csv).map(r => castRow(r, spec));
    const order = spec.columnOrder
      ? [...spec.columnOrder, ...Object.keys(spec.extraCols || {})]
      : null;
    const n = insertMany(table, rows, order);
    console.log(`  ${table.padEnd(16)} ${String(n).padStart(5)} rows`);
  }
}

function seedAdminIfMissing() {
  const row = db.prepare('SELECT COUNT(*) AS n FROM accounts WHERE passwordHash IS NOT NULL').get();
  if (row.n > 0) {
    console.log('  ✓ at least one account has a password; skipping admin seed');
    return;
  }

  const email = process.env.SEED_ADMIN_EMAIL || 'admin@motogiathinh.centersai';
  const password = process.env.SEED_ADMIN_PASSWORD || 'admin';

  // Prefer an existing admin row (from accounts.csv) and just set its password.
  let admin = db.prepare("SELECT * FROM accounts WHERE role = 'admin' LIMIT 1").get();
  const hash = bcrypt.hashSync(password, 10);

  if (admin) {
    // Don't overwrite the CSV-seeded email — set the password on whatever
    // email the CSV already has. The SEED_ADMIN_EMAIL env var is only used
    // when NO admin row exists yet (initial bootstrap below).
    db.prepare('UPDATE accounts SET passwordHash = ?, active = 1 WHERE id = ?')
      .run(hash, admin.id);
    console.log(`  ✓ password set on existing admin (id=${admin.id}, email=${admin.email})`);
    console.log(`     login with that email, NOT SEED_ADMIN_EMAIL`);
  } else {
    const id = 'u-admin';
    db.prepare(
      'INSERT INTO accounts (id, name, role, branchId, phone, email, passwordHash, lastActive, active) VALUES (?, ?, ?, ?, ?, ?, ?, ?, 1)'
    ).run(id, 'Admin', 'admin', null, null, email, hash, nowDdMmYyyyHHMMSS());
    console.log(`  ✓ created default admin (id=${id}, email=${email})`);
  }
  if (password === 'admin' || password === 'changeme') {
    console.log(`  ⚠ default password is "${password}" — change immediately after first login`);
  }
}

function main() {
  console.log(`Seeding DB from ${DATA_DIR}`);
  const before = countAll();
  const totalBefore = Object.values(before).reduce((a, b) => a + b, 0);

  if (RESET) {
    console.log('  --reset: wiping all tables');
    wipeAll();
  } else if (totalBefore > 0) {
    console.log(`  DB already populated (${totalBefore} rows). Pass --reset to re-seed.`);
    seedAdminIfMissing();
    return;
  }

  seedTables();
  seedAdminIfMissing();

  const after = countAll();
  console.log('Done. Row counts:');
  for (const t of ENTITY_TABLES) console.log(`  ${t.padEnd(16)} ${after[t]}`);
}

main();
