// validation.js — input validators tied to BACKEND.md §8 invariants and
// SPEC.md product rules. Each validator returns null on pass or an error
// object `{ field, code, message }` (Vietnamese message, machine code).
//
// Used by routes/writes.js; aim is friendly UI errors + locked spec rules.

// Vietnamese phone — canonical store form is digits-only, exactly 10
// digits. Frontend Input strips separators while typing, so writes
// arrive bare; the regex tolerates legacy whitespace from old rows but
// the digit count must equal 10.
const PHONE_RE  = /^[\s.\-]*(?:\d[\s.\-]*){10}$/;
// CCCD — canonical store form is exactly 12 digits, no separators.
const CCCD_RE   = /^\d{12}$/;
const DDMMYYYY  = /^(\d{2})\/(\d{2})\/(\d{4})$/;
const EMAIL_RE  = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

const LOCKED_CLASS_STATUS = new Set(['đang mở', 'đang diễn ra', 'đã kết thúc']);
const LOCKED_LICENCE      = new Set(['A', 'A1']);
const LOCKED_METHOD       = new Set(['Tiền mặt', 'Chuyển khoản']);
const LOCKED_ROLE         = new Set(['admin', 'staff']);
const LOCKED_PAYMENT_KIND = new Set(['tuition', 'rental']);

function err(field, code, message) { return { field, code, message }; }

// Strict date check: dd/mm/yyyy AND the date is real (not 31/02/2026 etc).
function isValidDate(s) {
  if (typeof s !== 'string') return false;
  const m = DDMMYYYY.exec(s);
  if (!m) return false;
  const [_, dd, mm, yyyy] = m;
  const d = parseInt(dd, 10), mo = parseInt(mm, 10), y = parseInt(yyyy, 10);
  if (mo < 1 || mo > 12 || y < 1900 || y > 2100 || d < 1) return false;
  const probe = new Date(y, mo - 1, d);
  return probe.getDate() === d && probe.getMonth() === mo - 1 && probe.getFullYear() === y;
}

// Money: positive integer (compensating negatives allowed only when flagged).
function isValidAmount(v, { allowNegative = false } = {}) {
  if (v == null || v === '') return false;
  const n = typeof v === 'number' ? v : parseInt(String(v), 10);
  if (!Number.isFinite(n) || n === 0 || !Number.isInteger(n)) return false;
  if (!allowNegative && n < 0) return false;
  return true;
}

export const validators = {
  required(obj, fields) {
    for (const f of fields) {
      if (obj?.[f] == null || obj[f] === '') return err(f, 'required', `Thiếu trường bắt buộc: ${f}.`);
    }
    return null;
  },
  phone(v) {
    if (!v) return null;  // optional — required handled separately
    return PHONE_RE.test(String(v))
      ? null
      : err('phone', 'bad_phone', 'Số điện thoại không hợp lệ. Cần 9–10 chữ số.');
  },
  cccd(v) {
    if (!v) return null;
    return CCCD_RE.test(String(v))
      ? null
      : err('idNumber', 'bad_cccd', 'CCCD phải gồm đúng 12 chữ số.');
  },
  email(v) {
    if (!v) return null;
    return EMAIL_RE.test(String(v))
      ? null
      : err('email', 'bad_email', 'Email không hợp lệ.');
  },
  date(field, v) {
    if (!v) return null;
    return isValidDate(v)
      ? null
      : err(field, 'bad_date', `Ngày không hợp lệ ở trường ${field}. Định dạng cần là dd/mm/yyyy.`);
  },
  amount(v, opts) {
    return isValidAmount(v, opts)
      ? null
      : err('amount', 'bad_amount', 'Số tiền phải là số nguyên khác 0.');
  },
  classStatus(v) {
    if (v == null) return null;
    return LOCKED_CLASS_STATUS.has(v)
      ? null
      : err('statusOverride', 'bad_status', 'Trạng thái lớp phải là một trong: đang mở · đang diễn ra · đã kết thúc.');
  },
  licence(v) {
    if (v == null) return null;
    return LOCKED_LICENCE.has(v)
      ? null
      : err('licence', 'bad_licence', 'Bằng phải là A hoặc A1.');
  },
  method(v) {
    return LOCKED_METHOD.has(v)
      ? null
      : err('method', 'bad_method', 'Hình thức phải là Tiền mặt hoặc Chuyển khoản.');
  },
  role(v) {
    if (v == null) return null;
    return LOCKED_ROLE.has(v)
      ? null
      : err('role', 'bad_role', 'Vai trò phải là admin hoặc staff.');
  },
  paymentKind(v) {
    if (v == null) return null;
    return LOCKED_PAYMENT_KIND.has(v)
      ? null
      : err('kind', 'bad_kind', 'Loại thanh toán phải là tuition hoặc rental.');
  },
};

// Composite: run a list of validators; return the first error or null.
export function check(...calls) {
  for (const c of calls) { if (c) return c; }
  return null;
}

// Express helper: send a 400 with the validation error and the trace.
export function bad(res, e, status = 400) {
  return res.status(status).json({ error: e.code, field: e.field, message: e.message });
}
