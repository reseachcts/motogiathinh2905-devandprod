# API_GUEST.md — Guest-Role API Spec

Audience: native mobile (iOS / Android) developers integrating with the
MOTOGIATHINH / CENTERSAI CRM backend as a **guest** role account.

> Sources audited: `webapp/screen-guest.jsx`, `webapp/data-loader.js`,
> `backend/auth.js`, `backend/routes/{auth,entities,writes,uploads,ocr}.js`,
> `backend/server.js`, `backend/validation.js`.

## 0. Conventions

- **Base URL:** `<host>/api`.
- **Auth:** cookie `mgt_session` — JWT (HS256), HttpOnly, SameSite=Lax,
  Secure in prod. Guest JWT lifetime ~50 years (`GUEST_DAYS = 365*50`);
  other roles: `JWT_DAYS` env, default 14d.
- **Body:** JSON unless multipart.
- **Error envelope:** `{ error: "<code>", message?: "<vi>", field?: "<field>", ... }`.
- **401 web behavior:** web client calls `window.location.reload()` on any
  401 except `/api/me`; mobile must show "session expired" instead.
- **Dates:** `dd/mm/yyyy` and `dd/mm/yyyy HH:MM:SS`. **Money:** integer VND
  (no decimals, no `đ`). **Phone / CCCD canonical:** 10 / 12 digits, no separators.

All routes require `mgt_session` unless flagged "no auth". `requireAuth`
returns `401 auth_required` or `401 auth_invalid` (account gone / `active=0`).

---

## 1. Auth

### 1.1 POST `/api/auth/login` — no auth

Sets `mgt_session` on 200. Request: `{ "email": "...", "password": "..." }`.

Success `200`:
```json
{ "user": {
  "id": "u-7f3a", "name": "Cộng tác viên A", "role": "guest",
  "email": "guest@example.com", "phone": "0901234567",
  "branchId": null, "assignedClassId": "cls-123",
  "active": true, "lastActive": "02/06/2026 10:14:22"
} }
```

Errors: 400 `missing_credentials`; 401 `invalid_credentials`;
429 `too_many_attempts` (5 fails / 15 min, Vietnamese `message`);
429 `account_locked` (after 10 fails, 60 min lockout, includes `retryAfter` ms).

Side effects: `activity_log` rows `auth.login` / `auth.login_fail` / `auth.login_blocked`.
Guest password policy is **simple** — any non-empty string.

### 1.2 POST `/api/auth/logout`

Idempotent. Empty body. Always `200 { "ok": true }`, clears cookie, writes `auth.logout` activity row when valid session present.

### 1.3 GET `/api/me` — re-issues cookie

Returns `{ user }` (same shape as login) and slides JWT expiry forward. Errors: 401 `auth_required`, 401 `auth_invalid`.

### 1.4 POST `/api/auth/password`

Self-service change. Not used by guest UI; if called, the **full**
complexity policy (8+, upper/lower/digit/special) applies. Errors:
400 `missing_fields`, 401 `invalid_credentials`, 400 `password_too_short` /
`password_needs_lowercase` / `password_needs_uppercase` / `password_needs_digit`
/ `password_needs_special` (each with Vietnamese `message`).

---

## 2. Reads

Guest scope (`entities.js → dump()`): only `accounts` (self), `classes`
(assigned class or empty), `students` (own only), `constants/profile-docs`,
`now`, `health`. All other reads return `[]`: `/branches`, `/payments`,
`/fee-plans`, `/promotions`, `/teachers`, `/vehicles`, `/notifications`,
`/activity-log`.

### 2.1 GET `/api/students` — own students

```json
[{
  "id": "s-9ab12", "maHV": "HV2026-0042",
  "name": "Nguyễn Văn A", "phone": "0901234567",
  "dob": "01/05/2000", "gender": "Nam",
  "idNumber": "036200012345",
  "address": "12 Lê Lợi, P. Bến Nghé, Q.1, TP.HCM",
  "queQuan": "Hà Tĩnh", "ngayCapCCCD": "10/03/2021", "noiCapCCCD": null,
  "classId": null, "licence": "A1",
  "feePlanId": null, "promotionId": null,
  "totalFee": 0, "profileComplete": false,
  "responsibleStaffId": "u-7f3a", "branchId": null,
  "createdAt": "02/06/2026 10:14:22", "notes": null,
  "docs_cccd": true,      "docs_cccd_url":      "/api/files/students/s-9ab12/cccd-1717312462.jpg",
  "docs_cccd_back": true, "docs_cccd_back_url": "/api/files/students/s-9ab12/cccd_back-1717312487.jpg",
  "docs_cccd_qr": true,   "docs_cccd_qr_url":   "/api/files/students/s-9ab12/cccd_qr-1717312501.jpg",
  "docs_gksk": false, "docs_gksk_url": null,
  "docs_donDeNghi": false, "docs_donDeNghi_url": null,
  "docs_the3x4": false, "docs_the3x4_url": null
}]
```

Web loader collapses `docs_<key>` into nested `docs: {...}` client-side only.

### 2.2 GET `/api/accounts` — self only

```json
[{ "id": "u-7f3a", "name": "Cộng tác viên A", "role": "guest",
   "branchId": null, "phone": "0901234567",
   "email": "guest@example.com", "assignedClassId": "cls-123",
   "active": true, "lastActive": "02/06/2026 10:14:22" }]
```

### 2.3 GET `/api/classes` — assigned class only

```json
[{ "id": "cls-123", "code": "A1-T6-CN-2026", "branchId": "br-hcm-1",
   "openDate": "01/06/2026", "examDate": "30/06/2026", "statusOverride": null }]
```

Guest UI uses only `code`.

### 2.4 GET `/api/constants/profile-docs`

Static slot list — mobile guest flow uses `cccd`, `cccd_back`, `cccd_qr`:

```json
[
  { "key": "cccd",      "label": "CCCD mặt trước",      "hint": "Hình mặt trước · OCR sẽ tự điền thông tin" },
  { "key": "cccd_back", "label": "CCCD mặt sau",        "hint": "Hình mặt sau" },
  { "key": "cccd_qr",   "label": "CCCD QR",             "hint": "Mã QR trên CCCD (do kiosk khách quét)" },
  { "key": "gksk",      "label": "Giấy khám sức khỏe",   "hint": "Bản scan / chụp" },
  { "key": "donDeNghi", "label": "Đơn đề nghị học",      "hint": "Đơn đề nghị học sát hạch" },
  { "key": "the3x4",    "label": "Ảnh thẻ 3×4",          "hint": "Ảnh chân dung" }
]
```

### 2.5 `D.api.refreshMe()` — composite (not one endpoint)

Web wrapper re-fetches `/api/accounts` + `/api/classes` in parallel. Guest
UI calls this when opening "Thêm học viên" to pick up admin's latest
`assignedClassId`. Mobile: re-issue both reads (or just `/api/me` for the
account) before showing the dialog.

---

## 3. Writes

### 3.1 POST `/api/students` — create student

Guest's main write. Required: `form.name` only. Server fills:
`responsibleStaffId = guest.id`; `classId = accounts.assignedClassId`
(nullable); `branchId = class.branchId` (nullable); `totalFee = 0`;
`feePlanId/promotionId = null`; `licence = form.licence` if `A`/`A1`.

Request:
```json
{
  "form": {
    "name": "Nguyễn Văn A", "phone": "0901234567", "licence": "A1",
    "idNumber": "036200012345", "dob": "01/05/2000", "gender": "Nam",
    "address": "12 Lê Lợi, P. Bến Nghé, Q.1, TP.HCM",
    "ngayCapCCCD": "10/03/2021"
  },
  "docs": { "cccd": true, "cccd_back": true, "cccd_qr": true },
  "profileComplete": false
}
```

`docs` DECLARES which slots will be populated (sets `docs_<key>` booleans).
File bytes upload via §4.1 after the row exists.

Success `201`: full `Student` row (shape per §2.1).

Errors: 400 `missing_form`; 400 `required` (name missing —
`Thiếu trường bắt buộc: name.`); 400 `bad_phone` / `bad_cccd` /
`bad_date` / `bad_licence`; 409 `duplicate` (UNIQUE e.g. idNumber, with `detail`).

Side effects: INSERT, `student.create` log, notification recompute.

### 3.2 PATCH `/api/students/:id` — partial update

Guest UI uses for `name`, `phone`, `licence`, and (if QR rescanned) `idNumber`.
Scope: `existing.responsibleStaffId === req.user.id` else `403 not_owner`.
Guest forbidden from `feePlanId` / `promotionId` (`403 admin_required`).

Allowed (guest subset): `name`, `phone`, `dob`, `gender`, `idNumber`,
`address`, `queQuan`, `ngayCapCCCD`, `noiCapCCCD`, `licence`, `notes`,
`profileComplete`, `docs_*`.

Request: `{ "name": "...", "phone": "...", "licence": "A1", "idNumber": "036200012345" }`

Success `200`: updated `Student` row.

Errors: 404 `not_found`, 403 `not_owner`, 403 `admin_required`,
400 `bad_phone` / `bad_cccd` / `bad_date` / `bad_licence`,
400 `no_fields_to_update`, 409 `duplicate`. Side effects: UPDATE,
`student.update` log, notification recompute.

---

## 4. Uploads

Multipart, single field `"file"`, max **8 MB**. Allowed mimes:
`image/jpeg`, `image/png`, `image/webp`, `application/pdf` (PDF only for
non-CCCD slots). Magic-byte sniff server-side; mismatch → `415 unsupported_mime`
and the file is deleted.

### 4.1 POST `/api/students/:id/docs/:key`

`:key` ∈ `{ cccd, cccd_back, cccd_qr, gksk, donDeNghi, the3x4 }`. Body: `file=<binary>`.

Guest auth: branch check (`student.branchId !== req.user.branchId`) treats
null===null as same branch, so works while admin hasn't routed the student.
Once admin assigns the student to a real branch, guests get `403 wrong_branch`.

Success `201`: `{ "ok": true, "key": "cccd", "url": "/api/files/students/s-9ab12/cccd-1717312462.jpg", "size": 184232 }`.

Errors: 400 `invalid_doc_key` / `missing_file` / `upload_failed` (multer
with `code`+`message`); 415 `unsupported_mime`; 404 `not_found`; 403 `wrong_branch`.

Side effects: file at `backend/data/uploads/students/<id>/<key>-<ts>.<ext>`;
prior file at same slot deleted; UPDATE sets `docs_<key>=1` and `docs_<key>_url`;
`student.upload` activity row.

### 4.2 GET `/api/files/<kind>/<recId>/<filename>`

Auth-protected file serve. The `url` from §4.1 is what you GET. Attach
the same `mgt_session` cookie / token. Returns raw bytes with
`Content-Type` per extension, `Cache-Control: private, max-age=3600`.
Errors: 400 `bad_path`, 404 `not_found`, 403 `wrong_branch`.

### 4.3 DELETE `/api/students/:id/docs/:key`

Not used by guest UI; available, idempotent, `200 { ok: true, key }`.

---

## 5. OCR

### 5.1 POST `/api/ocr/cccd-qr` — QR scan (PRIMARY for guest)

Guest UI gates "Save" on a successful scan: only after `fields.idNumber`
comes back is create/patch allowed. Multipart, single `file`. Image only
(no PDF). 8 MB.

Success `200`:
```json
{
  "fields": {
    "idNumber":    "036200012345",
    "oldIdNumber": "201234567",
    "name":        "NGUYỄN VĂN A",
    "dob":         "01/05/2000",
    "gender":      "Nam",
    "address":     "12 Lê Lợi, P. Bến Nghé, Q.1, TP.HCM",
    "ngayCapCCCD": "10/03/2021"
  },
  "raw": "036200012345|201234567|NGUYỄN VĂN A|01/05/2000|Nam|12 Lê Lợi...|10/03/2021"
}
```

Mobile should copy `fields.idNumber` (and any other non-null fields) into
the student create payload (exactly what `GuestAddStudentModal.submit` does).

Errors: 400 `missing_file`; 400 `not_an_image` (`Tệp không phải ảnh hợp lệ.`);
415 `unsupported_mime`; 400 `upload_failed` (multer); 422 `qr_unreadable`
(`QR chưa rõ. Hãy chụp rõ hơn.`); 422 `qr_unrecognized`
(`Mã QR không phải CCCD Việt Nam hợp lệ.`); 500 `qr_failed`.

Client wrapper rethrows with `e.code = body.error`; guest UI maps
`qr_unreadable` / `qr_failed` → "QR chưa rõ. Hãy chụp rõ hơn.".

### 5.2 POST `/api/ocr/cccd` — text OCR (NOT used by guest UI)

Available as `D.api.ocrCccd()` but not called by `screen-guest.jsx`.
tesseract.js (vie+eng), returns `{ ms, fields, raw, confidence }` (same
fields as §5.1). Slow (~2–10 s first call). Use only as a fallback when
QR is unscannable. Errors: 400 `missing_file` / `not_an_image`, 415
`unsupported_mime`, 500 `ocr_failed`.

### 5.3 QR payload format (`parseCccdQr`)

Pipe-delimited:
```
<CCCD-12-digits>|<old CMND>|<full name>|<dob>|<gender>|<address>|<issue date>
```

Rules (`routes/ocr.js`):
- Field 0 MUST match `^\d{12}$` — else `qr_unrecognized`.
- `oldIdNumber` may be empty.
- `dob` / `issue date`: `dd/MM/yyyy` OR `ddMMyyyy` (8 digits); server normalizes to `dd/MM/yyyy`.
- `gender`: starts with `N`+`ữ`/`u` → `Nữ`; else non-empty → `Nam`.
- Trailing fields > index 6 tolerated.

Sample: `036200012345|201234567|NGUYỄN VĂN A|01052000|Nam|12 Lê Lợi, P. Bến Nghé, Q.1, TP.HCM|10032021`

---

## 6. Vietnamese strings to localize / pattern-match

**Validation** (`validation.js`): `Thiếu trường bắt buộc: <field>.` (400 `required`),
`Số điện thoại không hợp lệ. Cần 9–10 chữ số.` (`bad_phone`),
`CCCD phải gồm đúng 12 chữ số.` (`bad_cccd`),
`Ngày không hợp lệ ở trường <field>. Định dạng cần là dd/mm/yyyy.` (`bad_date`),
`Bằng phải là A hoặc A1.` (`bad_licence`),
`Trạng thái lớp phải là một trong: đang mở · đang diễn ra · đã kết thúc.` (`bad_status`),
`Hình thức phải là Tiền mặt hoặc Chuyển khoản.` (`bad_method`),
`Vai trò phải là admin, staff hoặc guest.` (`bad_role`).

**Auth** (`auth.js`): `Mật khẩu là bắt buộc.` / `Mật khẩu phải có ít nhất N ký tự.`
(400 password); `Tài khoản tạm khóa. Thử lại sau N phút.` (429 `account_locked`);
`Quá N lần thử trong M phút. Vui lòng đợi.` (429 `too_many_attempts`).

**OCR** (`ocr.js`): `Tệp không phải ảnh hợp lệ.` / `… (JPEG/PNG/WebP).` (400 `not_an_image`);
`QR chưa rõ. Hãy chụp rõ hơn.` (422 `qr_unreadable`);
`Mã QR không phải CCCD Việt Nam hợp lệ.` (422 `qr_unrecognized`).

**Profile-doc labels** (`entities.js`): see §2.4.

**Locked enums in payloads:** `gender` ∈ {`Nam`, `Nữ`}; `licence` ∈ {`A`, `A1`};
`payments.method` ∈ {`Tiền mặt`, `Chuyển khoản`} (n/a for guest);
`classes.status` ∈ {`đang mở`, `đang diễn ra`, `đã kết thúc`};
`accounts.role` ∈ {`admin`, `staff`, `guest`}.

---

## 7. End-to-end guest flows

**Login + first list:**
```
POST /api/auth/login {email, password}   → cookie + {user}
GET  /api/me                             → re-issues cookie
GET  /api/accounts                       → [self]
GET  /api/classes                        → [assignedClass] or []
GET  /api/students                       → own students
GET  /api/constants/profile-docs         → slot list (cache forever)
```

**Create student** ("Thêm học viên"):
```
GET  /api/accounts + /api/classes        (refreshMe — opens dialog)
POST /api/ocr/cccd-qr  (QR photo)        → {fields:{idNumber,...}}  must return idNumber
POST /api/students {form, docs, profileComplete:false}  → student
POST /api/students/<id>/docs/cccd        (front photo)
POST /api/students/<id>/docs/cccd_back   (back photo)
POST /api/students/<id>/docs/cccd_qr     (QR photo)
GET  /api/students                       (refresh)
```

**Edit detail:**
```
PATCH /api/students/<id> {name?, phone?, licence?, idNumber?}
If QR rescanned: POST /api/ocr/cccd-qr first (must succeed)
For each new photo: POST /api/students/<id>/docs/<key>
GET  /api/students                       (refresh)
```

**Logout:** `POST /api/auth/logout` → clears cookie → mobile clears local session and navigates to login.

---

## 8. CORS

Same-origin in production (web app + API in one Node process → no CORS).
For a cross-origin app set `.env` `CORS_ORIGINS=https://mobile.example.com,capacitor://localhost,ionic://localhost`.
`backend/server.js` wires `cors({ origin: corsOrigins, credentials: true })`
(required for cookie auth). Native HTTP clients ignore CORS entirely; with
Bearer-token auth (`MOBILE_READINESS.md` §1) CORS is a non-issue for mobile.
