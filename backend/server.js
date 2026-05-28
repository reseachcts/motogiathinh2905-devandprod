// server.js — single process: REST API at /api/* + static webapp at /.
//
// Production envelope: drop on a VPS, set JWT_SECRET, run `node server.js`
// behind nginx+TLS. The webapp/ folder ships unchanged; only data-loader.js
// inside it switches to fetch() against /api/.

import express from 'express';
import cookieParser from 'cookie-parser';
import cors from 'cors';
import { existsSync, readFileSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

import { db, countAll, closeDb } from './db.js';
import { startRecomputeTimer, stopRecomputeTimer } from './notifications.js';
import authRoutes from './routes/auth.js';
import entityRoutes from './routes/entities.js';
import writeRoutes from './routes/writes.js';

const HERE = dirname(fileURLToPath(import.meta.url));

// Load .env if present (no external dep — flat KEY=VALUE only).
function loadDotEnv() {
  const p = resolve(HERE, '.env');
  if (!existsSync(p)) return;
  for (const line of readFileSync(p, 'utf-8').split(/\r?\n/)) {
    const m = line.match(/^\s*([A-Z_][A-Z0-9_]*)\s*=\s*(.*)\s*$/i);
    if (!m) continue;
    let val = m[2];
    if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'"))) {
      val = val.slice(1, -1);
    }
    if (process.env[m[1]] === undefined) process.env[m[1]] = val;
  }
}
loadDotEnv();

const PORT      = Number(process.env.PORT) || 3000;
const NODE_ENV  = process.env.NODE_ENV || 'development';
const WEBAPP_DIR = resolve(HERE, '..', 'webapp');

const app = express();
app.disable('x-powered-by');
app.use(express.json({ limit: '2mb' }));
app.use(cookieParser());

// CORS: same-origin in production (no header needed). Dev / cross-origin
// front-ends can set CORS_ORIGINS=https://app.example.com,...
const corsOrigins = (process.env.CORS_ORIGINS || '').split(',').map(s => s.trim()).filter(Boolean);
if (corsOrigins.length) {
  app.use(cors({ origin: corsOrigins, credentials: true }));
}

// Health probe — used by nginx + monitoring. Returns 200 once DB is open.
app.get('/api/health', (_req, res) => {
  try {
    const n = db.prepare('SELECT COUNT(*) AS n FROM accounts').get().n;
    res.json({ ok: true, ts: Date.now(), accounts: n });
  } catch (e) {
    res.status(500).json({ ok: false, error: String(e.message || e) });
  }
});

// API routes
app.use('/api', authRoutes);     // /api/auth/* + /api/me
app.use('/api', entityRoutes);   // /api/branches, /api/students, …
app.use('/api', writeRoutes);    // POST/PATCH

// Catch unhandled API errors as JSON (not HTML).
app.use('/api', (err, _req, res, _next) => {
  console.error('[api error]', err);
  res.status(500).json({ error: 'internal_error', message: String(err.message || err) });
});

// Static webapp — serve the same folder GitHub Pages serves.
if (existsSync(WEBAPP_DIR)) {
  app.use(express.static(WEBAPP_DIR, { extensions: ['html'], maxAge: '1h' }));
  // SPA fallback: any non-API route falls back to index.html so deep links
  // (e.g. /students/HV0123) load. Currently the frontend doesn't use the
  // URL for routing, but leave the door open.
  app.get(/^\/(?!api\/).*/, (_req, res, next) => {
    const index = resolve(WEBAPP_DIR, 'index.html');
    if (existsSync(index)) res.sendFile(index);
    else next();
  });
} else {
  console.warn(`[server] webapp dir not found at ${WEBAPP_DIR}; serving API only`);
}

const server = app.listen(PORT, () => {
  const stats = countAll();
  const total = Object.values(stats).reduce((a, b) => a + b, 0);
  console.log(`[server] MOTOGIATHINH backend listening on :${PORT} (${NODE_ENV})`);
  console.log(`[server] DB rows: ${total} total · ${stats.students} students · ${stats.payments} payments · ${stats.classes} classes`);
  if (NODE_ENV !== 'production' && !process.env.JWT_SECRET) {
    console.warn('[server] ⚠ Using insecure dev JWT secret. Set JWT_SECRET in .env for production.');
  }
  startRecomputeTimer();    // BACKEND.md §9 — keeps notifications fresh
});

function shutdown(sig) {
  console.log(`\n[server] ${sig} received, shutting down...`);
  stopRecomputeTimer();
  server.close(() => { closeDb(); process.exit(0); });
  setTimeout(() => process.exit(1), 5000).unref();
}
process.on('SIGINT', () => shutdown('SIGINT'));
process.on('SIGTERM', () => shutdown('SIGTERM'));
