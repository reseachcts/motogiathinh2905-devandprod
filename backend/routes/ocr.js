// routes/ocr.js — Vietnamese CCCD OCR via tesseract.js (pure JS).
//
// Flow:
//   client POSTs the CCCD image to /api/ocr/cccd  (multipart, field "file")
//   → tesseract recognizes with `vie` + `eng` language data
//   → text is regex-parsed into structured fields
//   → returns { fields: {...}, raw: '<full text>' }
//
// The image is NOT persisted here — the caller is expected to keep the File
// object and POST it to /api/students/:id/docs/cccd after the student row
// is created. Keeps the OCR endpoint stateless + side-effect free.
//
// First run downloads ~12MB of `vie` traineddata into the tesseract.js
// worker cache (default: backend/node_modules/.cache). Subsequent runs
// are instant.

import { Router } from 'express';
import multer from 'multer';
import { createWorker } from 'tesseract.js';
import { requireAuth } from '../auth.js';

const router = Router();
router.use(requireAuth);

// Defensive: tesseract.js v7 surfaces worker-thread errors via
// process.nextTick(() => { throw err; }), which would crash the API
// process. Catch them at the process level (the per-request handler
// already returned a 500); log + survive.
if (!global.__mgt_ocr_unhandled_installed) {
  global.__mgt_ocr_unhandled_installed = true;
  process.on('uncaughtException', (err) => {
    if (/attempt(?:ing)? to read image|tesseract|worker/i.test(String(err?.message || err))) {
      console.warn('[ocr] swallowed worker error:', err.message);
      return;
    }
    throw err;
  });
}

// Singleton worker — first call downloads ~12MB of `vie+eng` traineddata
// to the tesseract.js cache (default: backend/node_modules/.cache). Reused
// across requests so subsequent OCR calls are 10–20× faster. Resets on
// error so the next call doesn't pile onto a broken worker.
let _workerPromise = null;
function getWorker() {
  if (!_workerPromise) {
    _workerPromise = createWorker('vie+eng').catch(e => {
      _workerPromise = null;
      throw e;
    });
  }
  return _workerPromise;
}
function resetWorker() {
  const p = _workerPromise;
  _workerPromise = null;
  if (p) p.then(w => w.terminate?.()).catch(() => {});
}

// Magic-byte sniff: refuse non-image uploads BEFORE OCR so tesseract
// doesn't trip on garbage and crash its worker thread.
function looksLikeImage(buf) {
  if (!buf || buf.length < 8) return false;
  // JPEG (FF D8), PNG (89 50 4E 47), WebP (RIFF…WEBP), GIF (47 49 46 38)
  if (buf[0] === 0xff && buf[1] === 0xd8) return true;
  if (buf[0] === 0x89 && buf[1] === 0x50 && buf[2] === 0x4e && buf[3] === 0x47) return true;
  if (buf[0] === 0x52 && buf[1] === 0x49 && buf[2] === 0x46 && buf[3] === 0x46
      && buf[8] === 0x57 && buf[9] === 0x45 && buf[10] === 0x42 && buf[11] === 0x50) return true;
  if (buf[0] === 0x47 && buf[1] === 0x49 && buf[2] === 0x46 && buf[3] === 0x38) return true;
  return false;
}

const ALLOWED_MIME = new Set(['image/jpeg', 'image/png', 'image/webp']);
const MAX_BYTES = 8 * 1024 * 1024;
const upload = multer({
  storage: multer.memoryStorage(),     // OCR consumes the buffer directly
  limits: { fileSize: MAX_BYTES, files: 1 },
  fileFilter(_req, file, cb) {
    if (!ALLOWED_MIME.has(file.mimetype)) return cb(new Error('unsupported_mime: ' + file.mimetype));
    cb(null, true);
  },
});

// ---------------------------------------------------------------------------
// Regex parsers for the modern chip-based Vietnamese CCCD layout. Each
// parser is best-effort: returns the extracted value or null. The image
// quality varies hugely; we never fail the whole call on a single miss.
// ---------------------------------------------------------------------------

function parseId(text) {
  // Look for label "Số" / "No." / "No" followed by 12 digits (allow spaces).
  const m = text.match(/(?:S[ốoô]|No\.?)\s*[:\.\s]*\s*((?:\d[\s.]*){12})/i);
  if (m) return m[1].replace(/\D+/g, '');
  // Fallback: any 12-digit run.
  const any = text.match(/(?<!\d)((?:\d\s*){12})(?!\d)/);
  return any ? any[1].replace(/\D+/g, '') : null;
}

function parseName(text) {
  // "Họ và tên" / "Full name" → next non-empty line of upper-case letters/diacritics.
  const m = text.match(/(?:H[oọ]\s*(?:v[àaả])?\s*t[êe]n|Full\s*name)\s*[:\.]?\s*\n?\s*([A-ZÀ-Ỹ][A-ZÀ-Ỹ\s'\.\-]{2,})/);
  if (!m) return null;
  return m[1].trim().replace(/\s+/g, ' ');
}

function parseDob(text) {
  // "Ngày, tháng, năm sinh" / "Date of birth" → dd/mm/yyyy
  const m = text.match(/(?:Ng[àaả]y[\s,]*th[áa]ng[\s,]*n[ăa]m\s*sinh|Date\s*of\s*birth)\s*[:\.]?\s*(\d{2}[\/\-.]\d{2}[\/\-.]\d{4})/i);
  if (!m) return null;
  return m[1].replace(/[\-.]/g, '/');
}

function parseGender(text) {
  // "Giới tính" / "Sex" → Nam / Nữ / Male / Female
  const m = text.match(/(?:Gi[ớoơ]i\s*t[íi]nh|Sex)\s*[:\.]?\s*(Nam|N[ữu]|Male|Female)/i);
  if (!m) return null;
  const v = m[1].toLowerCase();
  if (/^n[ữu]/.test(v) || v === 'female') return 'Nữ';
  return 'Nam';
}

function parseQueQuan(text) {
  // "Quê quán" / "Place of origin" → next text line.
  const m = text.match(/(?:Qu[êe]\s*qu[áa]n|Place\s*of\s*origin)\s*[:\.]?\s*\n?\s*([A-ZÀ-Ỹa-zà-ỹ][^\n]{2,80})/);
  return m ? m[1].trim().replace(/\s+/g, ' ') : null;
}

function parseAddress(text) {
  // "Nơi thường trú" or "Place of residence" — skip the label line + any
  // adjacent English-translation line, then capture the next non-empty
  // line(s) up to a double-newline OR end. Tolerates both single-language
  // and dual-language CCCD layouts.
  const m = text.match(/N[ơoô]i\s*th[ưuừ][ơoờ]ng\s*tr[úu][^\n]*\n+\s*(?:\/?\s*Place\s*of\s*residence[^\n]*\n+\s*)?([^\n]{4,200})(?:\n([^\n]{0,200}))?/);
  if (!m) {
    const e = text.match(/Place\s*of\s*residence[^\n]*\n+\s*([^\n]{4,200})/);
    if (!e) return null;
    return e[1].replace(/\s+/g, ' ').trim().slice(0, 200);
  }
  const joined = (m[1] + (m[2] ? ' ' + m[2] : '')).replace(/\s+/g, ' ').trim();
  return joined.slice(0, 200);
}

function parseIssueDate(text) {
  // Issue date is sometimes labeled "Có giá trị đến" (expiry, skip) or
  // appears as a standalone date near the back. Grab a date that isn't
  // the dob and isn't a year of birth.
  const dobStr = parseDob(text);
  const all = [...text.matchAll(/(\d{2}[\/\-.]\d{2}[\/\-.]\d{4})/g)].map(m => m[1].replace(/[\-.]/g, '/'));
  for (const d of all) if (d !== dobStr) return d;
  return null;
}

function parseAll(text) {
  return {
    idNumber:    parseId(text),
    name:        parseName(text),
    dob:         parseDob(text),
    gender:      parseGender(text),
    queQuan:     parseQueQuan(text),
    address:     parseAddress(text),
    ngayCapCCCD: parseIssueDate(text),
  };
}

// ---------------------------------------------------------------------------
// POST /api/ocr/cccd — multipart, single "file". Returns the parsed fields
// (any subset may be null) plus the raw recognized text for debugging.
// ---------------------------------------------------------------------------
router.post('/ocr/cccd', upload.single('file'), async (req, res) => {
  if (!req.file) return res.status(400).json({ error: 'missing_file' });
  if (!looksLikeImage(req.file.buffer)) {
    return res.status(400).json({ error: 'not_an_image', message: 'Tệp không phải ảnh hợp lệ (JPEG/PNG/WebP).' });
  }

  const t0 = Date.now();
  try {
    const worker = await getWorker();
    const { data } = await worker.recognize(req.file.buffer);
    const text = data?.text || '';
    const fields = parseAll(text);
    const ms = Date.now() - t0;
    res.json({
      ms,
      fields,
      raw: text,
      confidence: typeof data?.confidence === 'number' ? Math.round(data.confidence) : null,
    });
  } catch (e) {
    console.error('[ocr] failed:', e?.message || e);
    resetWorker();   // worker state may be corrupted — recreate next time
    res.status(500).json({ error: 'ocr_failed', message: String(e?.message || e) });
  }
});

// Friendly multer error → JSON.
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
