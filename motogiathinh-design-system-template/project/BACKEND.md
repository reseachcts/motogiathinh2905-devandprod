# Backend guide — MOTOGIATHINH CRM

> **Source of truth for backend implementation.**
>
> Use this together with `data.js` (the mock that the frontend reads
> today) and `HANDOFF.md` (UI architecture). Every field, derivation,
> query and endpoint the frontend expects is captured here. If you
> change a field name or derivation rule, update this file in the same
> commit.

---

## 1. Architecture at a glance

```
┌──────────────────────────────────┐
│  Frontend (React + Babel inline) │
│   reads from window.MGT_DATA     │
│   calls window.fmtVND, fmtVNDShort│
└──────────────┬───────────────────┘
               │ (will become) JSON-over-HTTPS
               ▼
┌──────────────────────────────────┐
│  Backend (yours to build)        │
│   thin REST or GraphQL — choice  │
│   open. Auth: session or JWT.    │
└──────────────┬───────────────────┘
               │
               ▼
┌──────────────────────────────────┐
│  Persistence                     │
│   Postgres recommended (this doc │
│   assumes it; adapt for others). │
└──────────────────────────────────┘
```

The frontend today does its work against the **synchronous** in-memory
mock at `frontend/data-loader.js`. When you wire a real backend, the
swap-in point is `window.MGT_DATA`: replace its methods with thin async
wrappers around HTTP calls.

---

## 2. Entities (canonical schema)

All IDs are stable string identifiers. Today they're short tokens
(`br-1`, `cls-2026-05-1`, `s-0123`, `PMT-0123`). For a real DB switch
to UUIDs or sequential surrogate keys + an external code field — the
frontend never assumes a format.

### 2.1 `branch`

| Field | Type | Notes |
|---|---|---|
| `id`        | string PK         | `br-1` etc. |
| `name`      | text NOT NULL     | Display name: `331A QL1A`, `183 14/9`, `18C Phạm Hùng` |
| `address`   | text              | Full street address. |
| `managerId` | FK → `account.id` | Branch manager; nullable while seeding. |

Locked product rule (SPEC §3.11): **three fixed branches.** A new one
implies a UX overhaul — flag before adding.

### 2.2 `account`

| Field | Type | Notes |
|---|---|---|
| `id`         | string PK | |
| `name`       | text NOT NULL | |
| `role`       | enum `admin` \| `staff` | Locked set. |
| `branchId`   | FK → `branch.id` | The branch this user works at. |
| `email`      | text UNIQUE | Login identifier. |
| `phone`      | text | Optional contact. |
| `lastActive` | timestamptz | Bumped on every authenticated request. |
| `active`     | bool | Soft-disable flag (keep history, block login). |

`currentUser` is the authenticated session subject. Frontend reads it
via `MGT_DATA.currentUser`; backend will inject from auth.

### 2.3 `class`

| Field | Type | Notes |
|---|---|---|
| `id`        | string PK | |
| `code`      | text NOT NULL UNIQUE | Display: `MÔ TÔ 05/2026`. |
| `branchId`  | FK → `branch.id` | |
| `openDate`  | date (dd/mm/yyyy in JSON) | When admissions opened. |
| `examDate`  | date | Scheduled exam date. |
| `status`    | enum `đang mở` \| `đang diễn ra` \| `đã kết thúc` | Locked set. |

Locked product rules:
- **A and A1 share a class.** No `licence` column on `class` — a single
  class admits both bằng types.
- **No max-capacity field.**
- **Status transitions are admin-manual today.** SPEC §8 lists "auto by
  date" as an open product question; if you implement auto-transition,
  also expose the admin override.

### 2.4 `student`

| Field | Type | Notes |
|---|---|---|
| `id`               | string PK | |
| `maHV`             | text UNIQUE | Display code: `HV0123`. SPEC §3.8 locks the format. |
| `name`             | text NOT NULL | |
| `gender`           | enum `Nam` \| `Nữ` | |
| `dob`              | date (dd/mm/yyyy) | |
| `phone`            | text | 10-digit, no formatting in DB. |
| `idNumber`         | text UNIQUE | 12-digit CCCD. |
| `address`          | text | Nơi thường trú. |
| `queQuan`          | text | Quê quán (origin city). |
| `ngayCapCCCD`      | date | When CCCD was issued. |
| `noiCapCCCD`       | text | Issuing authority. |
| `licence`          | enum `A` \| `A1` | The bằng this student is training for. |
| `classId`          | FK → `class.id` | |
| `branchId`         | FK → `branch.id` | Denormalised from class.branchId for fast filtering. |
| `feePlanId`        | FK → `fee_plan.id` | |
| `promotionId`      | FK → `promotion.id` nullable | `promo-none` if no promo. |
| `totalFee`         | numeric(12,0) NOT NULL | = `feePlan.amount - (promotion.discount ?? 0)`. **Computed once at enrolment**, then locked. |
| `responsibleStaffId` | FK → `account.id` | Required (SPEC §3.6). |
| `docs`             | jsonb `{ cccd, gksk, donDeNghi, the3x4: bool }` | Doc-slot states. See §2.10. |
| `profileComplete`  | bool (derived; stored snapshot OK) | True iff all four docs are filled AND all required fields present. |
| `notes`            | text nullable | Free-form Ghi chú. |
| `createdAt`        | text "dd/mm/yyyy HH:MM:SS" | Original creation timestamp. |
| `createdAtMs`      | bigint | Unix ms of `createdAt` — used by chart bucketing. |

### 2.5 `payment`

> **Architectural note (from `data.js` header):** Payments are a
> **true event log**. One row per real-life payment instance. **Never
> stored on the student** are `paid`, `balance`, `paymentStatus` —
> always recompute from the log. The frontend depends on this contract.

| Field | Type | Notes |
|---|---|---|
| `id`            | string PK | Display: `PMT-00123`. |
| `studentId`     | FK → `student.id` | |
| `branchId`      | FK → `branch.id` | Mirrored from `student.branchId` at write time for chart speed. |
| `staffId`       | FK → `account.id` | Cashier who recorded the payment. |
| `amount`        | numeric(12,0) NOT NULL CHECK (`amount > 0`) | |
| `method`        | enum `Tiền mặt` \| `Chuyển khoản` | Locked set. |
| `bienLaiId`     | text UNIQUE | Display: `BL-2026-0123-456`. |
| `bienLaiPhoto`  | bool (file URL nullable when wired to storage) | Whether receipt image attached. |
| `createdAt`     | text "dd/mm/yyyy HH:MM:SS" | |
| `createdAtMs`   | bigint | |

A student in **`noPayOnRegistration: true`** state has *zero* payment
events. This is a meaningful product state — don't auto-seed a 0₫
payment to "fix" it.

### 2.6 `fee_plan`

| Field | Type | Notes |
|---|---|---|
| `id`      | string PK | `fee-a`, `fee-a1`. |
| `name`    | text | `A`, `A1`. |
| `licence` | enum `A` \| `A1` | Today every plan is one licence; the table allows N plans per licence later (e.g. `fee-a-vip`). |
| `amount`  | numeric(12,0) | Sticker price in đ. |

### 2.7 `promotion`

| Field | Type | Notes |
|---|---|---|
| `id`         | string PK | |
| `name`       | text | Display. `KHÔNG` for the no-op promo. |
| `appliesTo`  | string[] | Today values are `["A"]`, `["A1"]` or `["A","A1"]`. **Future**: switch to a join table `promotion_fee_plan` so one promo can target a curated set of fee plans (UI already exposes this — see the multi-pill in `Tạo khuyến mãi`). |
| `discount`   | numeric(12,0) | đ off the sticker. `0` for `KHÔNG`. |

### 2.8 `teacher`, `vehicle`

Independent lookup tables, lightly used:

`teacher (id, name, phone, yearsExp, branchId, active)`
`vehicle (id, name, licence, plate, year, branchId, status)`

Neither is FK'd from `student` / `class` today. Future product intent
is to assign teachers + vehicles to classes; leave the schema room.

### 2.9 `notification`

| Field | Type | Notes |
|---|---|---|
| `id`        | string PK | |
| `type`      | enum `payment` \| `profile` \| `system` | |
| `severity`  | enum `info` \| `warn` \| `danger` | |
| `title`     | text | |
| `message`   | text | |
| `studentId` | FK nullable | |
| `read`      | bool | |
| `createdAt` | text "dd/mm/yyyy HH:MM" | |

These are **generated server-side** when state crosses a threshold
(e.g. balance > 0 and exam date within N days). Today the mock
hand-computes them from current state — port that logic.

### 2.10 `PROFILE_DOCS` constant

Frontend defines four required doc slots:

```js
[
  { key: "cccd",      label: "CCCD" },
  { key: "gksk",      label: "Giấy khám sức khỏe" },
  { key: "donDeNghi", label: "Đơn đề nghị học" },
  { key: "the3x4",    label: "Thẻ 3×4" },
]
```

Stored on student as `docs.{cccd,gksk,donDeNghi,the3x4}: bool`. A real
backend stores the **file URL** instead of bool, plus
`uploadedAt / uploadedBy`. Switch the bool → URL when implementing; the
UI already drops a check vs exclamation badge based on presence.

### 2.11 `activity_log`

`(id, type, actor, who, what, when)` — append-only audit trail. Today
synthesised from recent payments + new students. In production, write
on every mutation.

---

## 3. Derived fields (single source of truth)

These are **never stored** on the canonical tables — always derived.
Caching them in a materialised view or denorm column is OK, but the
derivation rule is authoritative:

### 3.1 `student.paid`

```
paid = SUM(payment.amount) WHERE payment.studentId = student.id
```

### 3.2 `student.balance`

```
balance = student.totalFee - student.paid
```

### 3.3 `student.paymentStatus` — three bands only

```
if paid <= 0                    → "0%"
else if paid >= student.totalFee → "100%"
else                            → "50%"
```

SPEC §3.9 locks these three bands. Don't introduce `75%` etc.

### 3.4 `student.noPayOnRegistration`

`true` iff **no payment exists within 10 minutes of
`student.createdAt`**. This flag distinguishes "student walked in with
intent but didn't pay" from "student paid a deposit". Used by branch
performance reports.

### 3.5 `branchPerformance()` per branch

Backend should expose an endpoint returning, for each branch:

| Field | Formula |
|---|---|
| `students`        | count of students in branch |
| `revenue`         | sum of payments in branch |
| `committed`       | sum of student.totalFee |
| `outstanding`     | sum of student.balance where balance > 0 |
| `paidFull`        | count of students with `paymentStatus = '100%'` |
| `partial`         | count of students with `paymentStatus = '50%'` |
| `unpaid`          | count of students with `paymentStatus = '0%'` |
| `noPayOnReg`      | count of students with `noPayOnRegistration = true` |
| `paidImmediately` | count of students where a single payment ≥ totalFee landed within 10 min of `createdAt` AND `paymentStatus = '100%'` |

---

## 4. Aggregation queries (the dashboard)

The dashboard needs **time-bucketed series** of revenue and student
counts. The mock implements four shapes; replicate them:

### 4.1 `revenueBuckets(grain, count, branchId?, mode = "rolling")`

Returns N consecutive time buckets each with totals:

```ts
[
  { label: "01/05", tong: 12_000_000, daNhan: 9_000_000, conNo: 3_000_000 },
  ...
]
```

- `grain` ∈ `"hour" | "day" | "month"`
- `mode` = `"rolling"` (last N buckets ending now) or `"ptd"` (period-to-date — today's hours / this month's days / this year's months)
- Bucket boundaries:
  - hour → top-of-hour UTC, …
  - day → midnight at school local time
  - month → first day of month
- `tong` = sum of payment.amount + student.balance in bucket (i.e. revenue committed)
- `daNhan` = sum of payment.amount in bucket (revenue received)
- `conNo` = sum of student.balance for students created in bucket (revenue still owed)

### 4.2 `studentBuckets(grain, count, branchId?, mode)`

Same shape, but counting **new students** per bucket:

```ts
[
  { label, tong: 5, A: 3, A1: 2 },
  ...
]
```

### 4.3 `revenueCumulative(grain, count, mode)` / `studentCumulative(...)`

Running sum of the per-bucket version. Trivial to derive from §4.1/4.2.

These four methods drive Dashboard sections §1 (Tổng), §2 (Biến động),
§3 (So sánh). Optimisation hint: indexes on `(branchId, createdAtMs)`
for both `payments` and `students`.

---

## 5. Read endpoints (mapping current `MGT_DATA.*`)

| Frontend call | Suggested REST | Suggested GraphQL |
|---|---|---|
| `MGT_DATA.currentUser` | `GET /me` | `query { me { ... } }` |
| `MGT_DATA.branches` | `GET /branches` | `query { branches { ... } }` |
| `MGT_DATA.classes` | `GET /classes?status=…` | `query { classes(status) { ... } }` |
| `MGT_DATA.students` | `GET /students?branchId=…&licence=…&status=…&search=…&page=…&perPage=…` | `query { students(filters) { ... } }` |
| `MGT_DATA.payments` | `GET /payments?branchId=…&method=…&dateFrom=…&dateTo=…&page=…` | |
| `MGT_DATA.getBranch(id)` etc. | `GET /branches/:id` etc. | |
| `MGT_DATA.studentsInClass(id)` | `GET /classes/:id/students` | |
| `MGT_DATA.paymentsForStudent(id)` | `GET /students/:id/payments` | |
| `MGT_DATA.revenueBuckets(grain, count, branchId?, mode)` | `GET /reports/revenue-buckets?grain=…&count=…&mode=…&branchId=…` | |
| `MGT_DATA.studentBuckets(...)` | `GET /reports/student-buckets?...` | |
| `MGT_DATA.revenueCumulative(...)`, `studentCumulative(...)` | `GET /reports/revenue-cumulative?...`, `…student-cumulative…` | |
| `MGT_DATA.branchPerformance()` | `GET /reports/branch-performance` | |
| `MGT_DATA.notifications` | `GET /notifications` | |
| `MGT_DATA.activityLog` | `GET /activity-log?limit=…` | |
| `MGT_DATA.PROFILE_DOCS` | `GET /constants/profile-docs` (or bundle into the app shell) | |

Filtering / pagination is currently client-side; for real data move all
list endpoints to server-paginated + indexed.

---

## 6. Write endpoints (implied by the UI)

| User action | Endpoint | Body |
|---|---|---|
| Create student | `POST /students` | personal info + class/fee/promo/staff + docs presence |
| Update student | `PATCH /students/:id` | partial |
| Upload doc | `POST /students/:id/docs/:key` | multipart file |
| Record payment | `POST /payments` | `{ studentId, amount, method, bienLaiId, bienLaiPhotoUrl? }` |
| Upload receipt photo | `POST /payments/:id/bien-lai` | multipart file |
| Create class | `POST /classes` (admin only) | |
| Update class (status, dates) | `PATCH /classes/:id` (admin only) | |
| Create account | `POST /accounts` (admin only) | |
| Create fee plan | `POST /fee-plans` (admin only) | |
| Create promotion | `POST /promotions` (admin only) | `appliesTo` is array of fee-plan ids (future) |
| Create teacher / vehicle | `POST /teachers`, `POST /vehicles` (admin only) | |
| Mark notification read | `PATCH /notifications/:id` `{ read: true }` | |
| Log out | `POST /auth/logout` | |

Every write must:
1. Run authz check (see §7).
2. Write the canonical row.
3. Append an `activity_log` row.
4. Recompute `student.paid / balance / paymentStatus` on the fly when returning the affected student in the response (so the UI gets the fresh state without a second roundtrip).
5. Fire any cascading notifications (e.g. payment that flips status to 100%).

---

## 7. Auth & authz

- `accounts` table is the user store.
- Two roles, **`admin`** and **`staff`**.
- Most read endpoints are open to both roles.
- These endpoints are **admin-only** (locked by SPEC §3 + current UI gating):
  - Create / update `class`
  - Create / update `account`, `fee_plan`, `promotion`, `teacher`, `vehicle`
- A staff user may write payments and students within their own branch
  only. `branchId` scoping should be enforced server-side on every
  mutation and on list queries that don't pass a branch filter.
- Session model: bearer JWT recommended (the SPA can use HttpOnly
  cookies if you'd rather). Last-seen ping updates
  `account.lastActive`.

---

## 8. Invariants & business rules

1. **Banded payment status** (§3.3): only `0%`, `50%`, `100%` exist.
2. **Three classes status values** only (`đang mở`, `đang diễn ra`, `đã kết thúc`).
3. **A & A1 share classes** — never split by licence.
4. **`student.totalFee` is locked at enrolment.** Changing fee plan or
   promotion later requires an explicit admin override and re-write of
   `totalFee`.
5. **Payments are immutable.** Treat as ledger. To correct a payment,
   write a compensating event (e.g. negative-amount entry) — never
   `DELETE`.
6. **`responsibleStaffId` is required on every student.**
7. **`maHV` and `idNumber` must be unique.** Conflict → 409.
8. **`payment.bienLaiId` must be unique.**
9. **Money is integer đ** (no decimals). Store as `numeric(12,0)`.
10. **Dates of birth, ngày cấp, ngày mở, ngày thi** are stored as date
    only — format `dd/mm/yyyy` over the wire for compatibility with the
    current UI; backend can use ISO internally and reformat at the edge.
11. **`createdAt` keeps the original timestamp; never bump on update.**
    Use `updatedAt` for that.

---

## 9. Notifications — when to generate

Today's rules (port these):

- For each currently-enrolled student (`class.status = "đang diễn ra"`)
  with `paymentStatus = "50%"`: emit a `payment` / `warn`
  notification ("Chờ đóng đợt 2").
- Same with `paymentStatus = "0%"`: `payment` / `danger`.
- Each student with `profileComplete = false`: emit a `profile` /
  `warn` notification.
- These are recomputed on payment write + on doc upload. A simple
  approach: cron every 5 min that diffs the current set against the
  last-emitted set per student.

---

## 10. Future-feature pointers (don't paint into a corner)

The current UI already hints at these — leave room in the schema:

1. **Teacher + vehicle assignment to classes.** Add nullable
   `class.teacherId / class.vehicleId` (or N:M join tables if multiple
   teachers per class).
2. **Promotion ↔ fee_plan multi-link.** Move `promotion.appliesTo` from
   string[] to a join table `promotion_fee_plan(promotionId, feePlanId)`.
   The "Tạo khuyến mãi" UI already collects this as multi-select.
3. **Auto class status transitions.** Plan a cron that flips:
   - `đang mở` → `đang diễn ra` on `openDate`
   - `đang diễn ra` → `đã kết thúc` on `examDate + N days` (N TBD)
   - Keep admin override; UI's `ClassEditModal` writes the manual override.
4. **Multi-payment-plan support per student.** Today there's one
   `feePlanId` per student. If you ever add "advanced" or "bundle"
   plans, swap the FK column for a `student_enrolment` row with
   plan/promo/totalFee, leaving `student` itself product-agnostic.
5. **Branch metadata growth.** Phone, opening hours, GPS coordinates —
   the UI already shows `branch.address`; the `branch` table is the
   place.
6. **Audit + soft-delete.** Today nothing is deleted; you'll want
   `deletedAt` on `student` and `class` for GDPR-style erasure later.
7. **File storage for docs + biên lai photos.** S3-compatible bucket
   keyed by `students/{id}/{docKey}.jpg` and
   `payments/{id}/bienLai.jpg`. Frontend already drops images via DnD;
   wire the upload to a presigned URL.

---

## 11. Frontend integration cutover

When you stand up the backend, the swap-in is one file
(`frontend/data-loader.js`). Replace the bottom of that file with HTTP
calls; keep the **method names and return shapes identical** to what
this guide documents. Recommended sequence:

1. Build the schema in your DB; seed it with the current mock data (run
   `data.js` once and dump to SQL).
2. Stand up read endpoints first — leaves the UI fully working.
3. Add write endpoints. Wire the create flows
   (`AddStudentModal`, `AddPaymentModal`, `AddClassModal`,
   `RecordCreatorModal`) one at a time. Each modal already calls an
   `onSave` callback with the form payload — that's the shape your POST
   body should accept.
4. Replace `data.js` methods with `await fetch(...)`. The UI is mostly
   synchronous against `MGT_DATA`; wrap callers in
   `React.useEffect / useState` where blocking happens.
5. Wire auth last; gate `<App>` on an auth-check render.

---

## 12. Open questions to resolve with product

These are SPEC §8 open items — flag them before you start writing
business logic that locks the answer in:

- **Class status auto-transition vs manual?** See §10.3.
- **Notification deduplication window** — once you've warned about
  "50% còn nợ" for student X, when do you re-warn?
- **Payment refund / void semantics** — negative-amount entries
  (recommended) or a `voided` flag?
- **Multi-branch staff** — can one account work at two branches? Today
  `account.branchId` is single-valued.
