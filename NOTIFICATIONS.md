# NOTIFICATIONS.md — when and why notifications fire

Authoritative list of conditions that produce a `notification` row in the
DB. The recompute pass runs every 5 minutes (`backend/notifications.js`
`startRecomputeTimer`) AND after every relevant write (student create /
update, payment create, doc upload, class update). Rules below are
mirrored from `BACKEND.md §9` + the current `notifications.js`.

---

## Auto-generated (recomputed; ids start with `auto-`)

| ID pattern | Type | Severity | Title (vi) | Trigger condition |
|---|---|---|---|---|
| `auto-payment-<studentId>` | `payment` | `warn`   | **Chờ đóng đợt 2**     | Student in a class whose status is `đang diễn ra` AND `paymentStatus === '50%'` (paid > 0 but < totalFee). |
| `auto-payment-<studentId>` | `payment` | `danger` | **Chưa đóng học phí**  | Student in a class whose status is `đang diễn ra` AND `paymentStatus === '0%'` (no payments at all). |
| `auto-profile-<studentId>` | `doc`     | `warn`   | **Hồ sơ chưa đầy đủ**  | Student has `profileComplete === false` (any required field or doc slot missing). Fires regardless of class status. |

### Derivation details

- `paymentStatus` is recomputed every recompute pass from the payment
  ledger: `sum(payment.amount where studentId = s.id)` → bands at `<=0` /
  `>=totalFee` / else.
- `class.status` follows BACKEND.md §3 via `openDate` / `examDate` vs the
  current clock (or the admin `statusOverride` when set).
- Recompute is idempotent: rows with stable deterministic ids are
  UPSERTed; rows no longer satisfying any rule are DELETEd. Manually-
  created notifications (any id without the `auto-` prefix) are never
  touched.

### Rules NOT currently in effect (deferred)

- Class about to start exam (`examDate` within N days) — would be `type:'class'`.
- New account created — would be `type:'system'` / `info`.
- Failed login spike — currently audited in `activity_log` only.
- Payment over-limit — allowed per BACKEND.md §8.5; inline soft
  warning in `AddPaymentModal` only, no notification fired.

---

## Manually authored (no `auto-` prefix)

Created by admin (via direct DB or future endpoint — no public POST today)
or seeded. Survive recompute. The seed CSV ships 13 hand-curated examples
to illustrate visual states.

| Type | Severity | Common use |
|---|---|---|
| `payment` | any | Manual escalation a staff wants pinned. |
| `doc`     | any | Specific document-issue follow-up. |
| `system`  | `info` / `warn` / `danger` | Site-wide announcements. |

---

## Lifecycle

1. **Created** by recompute or seed.
2. **Read** (`PATCH /api/notifications/:id { read: true }`) when an admin/
   staff clicks the row. Branch-scoped: staff users can only mark/un-mark
   notifications attached to students in their own branch.
3. **Deleted** (`DELETE /api/notifications/:id`) via "Xóa đã chọn" on the
   Thông báo screen. Same branch scoping as above.
4. **Re-emitted** on the next recompute if the underlying condition still
   holds (same deterministic id → UPSERT).

---

## Files

- `backend/notifications.js`           — recompute() + buildDesired() + per-rule emitters
- `backend/migrations/003_notif_types.sql` — broadens the type enum to include `'doc'`
- `backend/routes/writes.js`           — PATCH/DELETE handlers (branch-scoped)
- `webapp/screen-notifs.jsx`           — list + bulk-action UI
- `webapp/data-loader.js`              — aliases `n.detail = n.message` for the frozen NotificationRow
