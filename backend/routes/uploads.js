// routes/uploads.js — file uploads for student docs + payment biên lai.
//
// Storage: local filesystem under backend/data/uploads/{students,payments}/<id>/
// Served back via GET /api/files/* (auth-protected). Swap to S3 later by
// replacing the multer storage engine + the GET handler.

import { Router } from 'express';
import multer from 'multer';
import { mkdirSync, existsSync, readFileSync, statSync, openSync, readSync, closeSync, unlinkSync } from 'node:fs';
import { resolve, dirname, extname, basename } from 'node:path';
import { fileURLToPath } from 'node:url';
import { db, logActivity } from '../db.js';
import { requireAuth } from '../auth.js';
import { recomputeAfterWrite } from '../notifications.js';

const HERE = dirname(fileURLToPath(import.meta.url));
const UPLOAD_ROOT = process.env.UPLOAD_DIR
  ? resolve(process.env.UPLOAD_DIR)
  : resolve(HERE, '..', 'data', 'uploads');
mkdirSync(UPLOAD_ROOT, { recursive: true });

const DOC_KEYS = ['cccd', 'gksk', 'donDeNghi', 'the3x4'];
const ALLOWED_MIME = new Set(['image/jpeg', 'image/png', 'image/webp', 'application/pdf']);
const MAX_BYTES = 8 * 1024 * 1024;  // 8MB

// Sniff the first 16 bytes of `absPath` and return the canonical mime, or null
// if the magic doesn't match anything in ALLOWED_MIME. The browser-supplied
// file.mimetype is trusted only for the multer fileFilter pass; this verifies
// the actual bytes match (defeats `Content-Type: image/png` masquerading PHP).
function sniffMime(absPath) {
  let fd;
  try {
    fd = openSync(absPath, 'r');
    const buf = Buffer.alloc(16);
    const n = readSync(fd, buf, 0, 16, 0);
    if (n < 4) return null;
    // JPEG: FF D8 FF (E0/E1/E2/E3/...)
    if (buf[0] === 0xFF && buf[1] === 0xD8 && buf[2] === 0xFF) return 'image/jpeg';
    // PNG: 89 50 4E 47 0D 0A 1A 0A
    if (buf[0] === 0x89 && buf[1] === 0x50 && buf[2] === 0x4E && buf[3] === 0x47) return 'image/png';
    // WebP: "RIFF" .... "WEBP"
    if (n >= 12 && buf.slice(0, 4).toString('ascii') === 'RIFF' && buf.slice(8, 12).toString('ascii') === 'WEBP') return 'image/webp';
    // PDF: "%PDF-"
    if (buf.slice(0, 5).toString('ascii') === '%PDF-') return 'application/pdf';
    return null;
  } catch {
    return null;
  } finally {
    if (fd !== undefined) { try { closeSync(fd); } catch {} }
  }
}

// Verify the just-uploaded file's magic bytes match its claimed mime; on
// mismatch, delete the file and return false (caller should 415). Files that
// pass either match the declared mime or any other ALLOWED_MIME (e.g. user
// uploaded a PNG named .jpg — we accept based on actual bytes).
function enforceMagic(req, res) {
  if (!req.file?.path) return true;       // nothing to check
  const sniffed = sniffMime(req.file.path);
  if (!sniffed || !ALLOWED_MIME.has(sniffed)) {
    try { unlinkSync(req.file.path); } catch {}
    res.status(415).json({ error: 'unsupported_mime',
      detail: `magic bytes do not match an allowed file type (claimed ${req.file.mimetype || 'unknown'})` });
    return false;
  }
  req.file.sniffedMime = sniffed;
  return true;
}

// Multer disk storage — one folder per record so files for a deleted
// student/payment can be cleaned up by removing one dir.
const storage = multer.diskStorage({
  destination(req, _file, cb) {
    // req.originalUrl is the full incoming path (/api/students/... or
    // /api/payments/...) — baseUrl only carries the mount prefix.
    const url = req.originalUrl || '';
    const kind = /\/students\//.test(url) ? 'students'
              : /\/payments\//.test(url) ? 'payments'
              : 'misc';
    const recId = req.params.id || 'unknown';
    const dir = resolve(UPLOAD_ROOT, kind, recId);
    mkdirSync(dir, { recursive: true });
    cb(null, dir);
  },
  filename(req, file, cb) {
    const key = req.params.key || 'bienlai';
    const ext = (extname(file.originalname) || '.bin').toLowerCase().slice(0, 5);
    cb(null, `${key}-${Date.now()}${ext}`);
  },
});
const upload = multer({
  storage,
  limits: { fileSize: MAX_BYTES, files: 1 },
  fileFilter(_req, file, cb) {
    if (!ALLOWED_MIME.has(file.mimetype)) return cb(new Error('unsupported_mime: ' + file.mimetype));
    cb(null, true);
  },
});

const router = Router();
router.use(requireAuth);

// Translate a disk path into the public URL used by the frontend.
function publicUrl(absPath) {
  const rel = absPath.replace(UPLOAD_ROOT, '').replace(/\\/g, '/').replace(/^\//, '');
  return '/api/files/' + rel;
}

// ---------------------------------------------------------------------------
// POST /api/students/:id/docs/:key  (multipart, single file field "file")
// ---------------------------------------------------------------------------
router.post('/students/:id/docs/:key', upload.single('file'), (req, res) => {
  const { id, key } = req.params;
  if (!DOC_KEYS.includes(key)) return res.status(400).json({ error: 'invalid_doc_key' });
  if (!req.file) return res.status(400).json({ error: 'missing_file' });
  if (!enforceMagic(req, res)) return;       // file unlinked + 415 already sent

  const student = db.prepare('SELECT * FROM students WHERE id = ?').get(id);
  if (!student) {
    try { unlinkSync(req.file.path); } catch {}
    return res.status(404).json({ error: 'not_found' });
  }
  if (req.user.role !== 'admin' && student.branchId !== req.user.branchId) {
    try { unlinkSync(req.file.path); } catch {}
    return res.status(403).json({ error: 'wrong_branch' });
  }

  const url = publicUrl(req.file.path);
  db.prepare(`UPDATE students SET docs_${key} = 1, docs_${key}_url = ? WHERE id = ?`).run(url, id);
  logActivity(req.user.id, 'student.upload', `${student.maHV} ${key}`);
  recomputeAfterWrite(req.user.id, `student ${student.maHV} doc ${key}`);
  res.status(201).json({ ok: true, key, url, size: req.file.size });
});

// ---------------------------------------------------------------------------
// POST /api/payments/:id/bien-lai
// ---------------------------------------------------------------------------
router.post('/payments/:id/bien-lai', upload.single('file'), (req, res) => {
  const { id } = req.params;
  if (!req.file) return res.status(400).json({ error: 'missing_file' });
  if (!enforceMagic(req, res)) return;       // file unlinked + 415 already sent

  const pay = db.prepare('SELECT * FROM payments WHERE id = ?').get(id);
  if (!pay) {
    try { unlinkSync(req.file.path); } catch {}
    return res.status(404).json({ error: 'not_found' });
  }
  if (req.user.role !== 'admin' && pay.branchId !== req.user.branchId) {
    try { unlinkSync(req.file.path); } catch {}
    return res.status(403).json({ error: 'wrong_branch' });
  }
  const url = publicUrl(req.file.path);
  db.prepare('UPDATE payments SET bienLaiPhoto = 1, bienLaiPhoto_url = ? WHERE id = ?').run(url, id);
  logActivity(req.user.id, 'payment.upload_bienlai', pay.bienLaiId);
  res.status(201).json({ ok: true, url, size: req.file.size });
});

// ---------------------------------------------------------------------------
// GET /api/files/<kind>/<recId>/<filename> — serve a previously uploaded
// file. Auth-required + path-traversal guarded. Branch scoping is enforced
// based on the record the file belongs to.
// ---------------------------------------------------------------------------
// Only these kinds are scopable to a record; everything else (e.g. /misc/)
// is refused so it can't be used to bypass branch isolation. New file kinds
// must be added here AND get a matching branchId lookup below.
const SERVABLE_KINDS = new Set(['students', 'payments']);

router.get('/files/*', (req, res) => {
  // Strip the leading "/files/" off the params[0] catch.
  const rel = req.params[0] || '';
  // Normalize + reject traversal.
  if (rel.includes('..') || rel.startsWith('/') || rel.includes('\\')) {
    return res.status(400).json({ error: 'bad_path' });
  }
  const parts = rel.split('/');
  // Require a kind we recognize as branch-scopable. Anything else (incl. the
  // legacy `misc/` bucket that wasn't covered by the scope check below) is a
  // 404 so staff can't bypass branch isolation by uploading to /misc/.
  if (parts.length < 3 || !SERVABLE_KINDS.has(parts[0])) {
    return res.status(404).json({ error: 'not_found' });
  }
  const abs = resolve(UPLOAD_ROOT, rel);
  if (!abs.startsWith(UPLOAD_ROOT)) return res.status(400).json({ error: 'bad_path' });
  if (!existsSync(abs) || !statSync(abs).isFile()) return res.status(404).json({ error: 'not_found' });

  // Branch-scope check (staff users can only download files attached to
  // records in their branch).
  if (req.user.role !== 'admin') {
    const [kind, recId] = parts;
    const table = kind === 'students' ? 'students' : 'payments';
    const row = db.prepare(`SELECT branchId FROM ${table} WHERE id = ?`).get(recId);
    if (!row || row.branchId !== req.user.branchId) {
      return res.status(403).json({ error: 'wrong_branch' });
    }
  }

  const ext = extname(abs).toLowerCase();
  const mime = ext === '.png'  ? 'image/png'
            :  ext === '.webp' ? 'image/webp'
            :  ext === '.pdf'  ? 'application/pdf'
            : 'image/jpeg';
  res.set('Content-Type', mime);
  res.set('Cache-Control', 'private, max-age=3600');
  res.send(readFileSync(abs));
});

// Multer error handler — friendly JSON errors instead of HTML.
router.use((err, _req, res, next) => {
  if (err instanceof multer.MulterError) {
    return res.status(400).json({ error: 'upload_failed', code: err.code, message: err.message });
  }
  if (err && /unsupported_mime/.test(err.message)) {
    return res.status(415).json({ error: 'unsupported_mime', detail: err.message });
  }
  next(err);
});

export default router;
