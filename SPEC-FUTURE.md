# SPEC-FUTURE.md — pending product spec items

Bigger product changes that need design + schema work before implementation.
Sourced from user feedback in the polish session. Reference these when planning
the next iteration.

---

## 1. Multi-file uploads per document slot

**Status:** open spec. Currently each doc slot holds exactly ONE file
(`students.docs_<key>_url`). User wants each slot to hold N files.

**Current behavior (single-file):**
- `students` table has 4 boolean flags + 4 nullable URL columns:
  `docs_{cccd,gksk,donDeNghi,the3x4}` (INTEGER 0/1) and `..._url` (TEXT).
- `POST /api/students/:id/docs/:key` replaces the URL on each upload.
- Frontend `DocSlot` shows a single preview image + a "thay tệp" pencil to
  replace, and a lightbox click to view.

**Desired behavior (multi-file):**
- Each slot becomes a grid of N file thumbnails.
- Visual feedback in the slot reflects the count (e.g. `(3)` chip in the
  header, or one-thumb / two-thumb / "+N more" arrangement).
- Each thumbnail clickable to view in lightbox.
- Each thumbnail has a per-file delete affordance.
- Add-file button stays available even when slot has files.
- Order: newest-first probably; clarify with user.

**Proposed schema:**
```sql
CREATE TABLE student_doc_files (
  id          TEXT PRIMARY KEY,
  studentId   TEXT NOT NULL REFERENCES students(id) ON DELETE CASCADE,
  doc_key     TEXT NOT NULL CHECK (doc_key IN ('cccd','gksk','donDeNghi','the3x4')),
  url         TEXT NOT NULL,
  filename    TEXT,
  size        INTEGER,
  mime        TEXT,
  uploadedAt  TEXT NOT NULL,
  uploadedBy  TEXT REFERENCES accounts(id)
);
CREATE INDEX idx_student_doc_files_student_key ON student_doc_files(studentId, doc_key);
```

The existing `students.docs_<key>` boolean stays as the "any file present"
quick-check (kept in sync via app trigger or recompute after every upload/
delete). The `..._url` column can be retired or kept as "primary/first" file
URL for thumbnail previews.

**API changes:**
- `POST /api/students/:id/docs/:key` — appends a new file (returns the new
  file's id + url). Already multipart.
- `GET  /api/students/:id/docs/:key` — list all files for that slot.
- `DELETE /api/students/:id/docs/:key/:fileId` — remove a specific file +
  unlink from disk.

**Frontend changes:**
- `DocSlot` extended to accept `files: Array<{id, url, filename, mime}>` in
  addition to the current `previewUrl` (for single-file legacy callers).
- New `DocSlotGrid` (or extension) renders a small thumbnail grid (max 3
  visible, then "+N" overflow chip).
- Lightbox extended to support next/prev navigation across the file set.
- AddStudentModal needs to accumulate a per-key array of File objects;
  app.jsx's onSave upload loop uploads each file sequentially.

**Out of scope for the next iteration unless explicitly asked:** PDF
preview pagination, file rename, drag-reorder.

---

## 2. Payment refund / compensating-entry UI

**Status:** backend already accepts negative-amount payments per BACKEND.md
§8.5; no UI exposes this.

When a payment was recorded incorrectly, an admin should be able to create a
compensating entry from the payment row (right-click / MoreMenu → "Ghi nhận
hoàn tiền"). Prefills `AddPaymentModal` with `defaultAmount = -p.amount` and
locks the studentId.

---

## 3. Class deletion + soft-archive

**Status:** backend has no `DELETE /api/classes/:id`. UI has no delete
affordance. SPEC implicit — admin should be able to delete a class with NO
enrolled students; archive (status=đã kết thúc) is the standard "remove from
active grids" mechanism.

---

## 4. Email-based password reset for staff users

**Status:** backend has admin-only `POST /api/accounts/:id/reset-password`.
Staff can self-change via `POST /api/auth/password` (needs current password).
No self-service "forgot password" flow because we don't have SMTP wiring.

When SMTP is provisioned: add `POST /api/auth/forgot-password { email }` →
emails a short-lived reset token; `POST /api/auth/reset-password { token,
newPassword }` consumes it.

---

## 5. Per-class teacher + vehicle assignment

**Status:** schema has standalone `teachers` and `vehicles` tables; classes
don't reference either. BACKEND.md §10.1 calls this out as future.

When implemented: add nullable `classes.teacherId / classes.vehicleId` (or
join tables if multi-teacher classes are needed). Surface in ClassEditModal +
ClassDetail header. Available teachers + vehicles list filterable by branch
+ active=true.

---

## 6. Branch-level dashboards

Currently the Tổng-quan dashboard charts run on ALL branches. SPEC §1 implies
staff users should see their own branch only. Frontend computes locally from
`MGT_DATA.<table>` arrays, which (post K1 security fix) are already
branch-scoped for staff. **Verify** that all dashboard chart components
respect `MGT_DATA.currentUser.branchId` and don't fall back to "all branches"
view when staff is logged in.
