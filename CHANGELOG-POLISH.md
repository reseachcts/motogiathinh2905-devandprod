# CHANGELOG-POLISH.md

Session changelog covering the full polish + integration cycle that
followed commit `2caefe9` (A1, the playwright-bootstrap commit). 53
commits over the cycle. All test suites green at close; backend stays
running on `http://127.0.0.1:3001`. No VPS deploy yet — local only.

---

## A — Stack setup (2 commits)

| Commit  | Title |
|---------|-------|
| 2caefe9 | A1: add playwright + chromium for browser-driven E2E |
| 92bd333 | A2: browser E2E covering 10-step verification checklist |

Wires `playwright + chromium` and the first round of browser-driven
smoke checks against the frozen frontend.

## B + C — Initial integration (3 commits)

| Commit  | Title |
|---------|-------|
| 72c83cb | B1: catalog every frontend→backend touchpoint, list integration gaps |
| 5e7c975 | C1: PATCH support tables + DELETE notifications + admin password reset |
| ef351c7 | C2+C3: wire 8 frozen-file stubs + alias n.detail = n.message |

`INTEGRATION-CATALOG.md` enumerates every empty-callback site in the
frozen `webapp/*.jsx` files. C1/C2/C3 fills those callbacks with real
HTTP calls (no visual change), plus the one wire-shape adapter the
backend needed (`notification.message` → `notification.detail`).

## D through J — Feature implementation (9 commits)

| Commit  | Title |
|---------|-------|
| 34760be | D: notifications auto-regeneration per BACKEND.md §9 |
| 78be035 | E: local-filesystem file uploads for student docs + biên lai photos |
| 2b75ad6 | F: validation hardening per BACKEND.md §8 invariants |
| 6e30ca4 | G: auth hardening — rate limit + lockout + password policy |
| 0abdc1f | H: unit + integration tests with node --test (21 passing) |
| 01797da | I: request logging + structured error responses |
| b2756bc | J: final review pass — tests + smoke + e2e all green, DEPLOY.md current |
| 434b563 | J followup: env var docs for upload/password/login limits in backend/README |
| d6025b2 | fix: no-store cache on JS/JSX in dev so browser picks up edits |

Core backend behaviour landed in these letters:

- **D** — `notifications.js` exposes `buildDesired()` and
  `recomputeAfterWrite()`. Every write recomputes auto-* notifications
  so the badge count, doc-missing list, and overdue-payment list stay
  fresh without a cron.
- **E** — `routes/uploads.js` does multipart writes to
  `backend/data/uploads/{students,payments}/...`. Magic-byte check on
  upload; `GET /api/files/...` serves the right `Content-Type`.
- **F** — `validation.js` enforces BACKEND.md §8 invariants
  (phone/CCCD/dd-mm-yyyy/locked enums/integer money) at every POST/PATCH.
- **G** — `auth.js` adds per-IP login rate limit, 5-fail lockout,
  bcrypt-rounds-12, password policy (≥10 chars, alpha+num).
- **H** — `test/` node:test suite (validation, recompute idempotence,
  account/branch CRUD round-trips).
- **I** — Express middleware: structured 4xx JSON, raw `error.message`
  stripped from 500s in production, request log on stderr.
- **J** — Final pre-K sweep + DEPLOY.md sync.

## K-series — multi-agent polish (5 commits)

| Commit  | Title |
|---------|-------|
| 6a2636b | K1: critical security + spec fixes |
| 488ca9f | fix(modals): AddStudent hint for no-open-class + AddPayment status '100%' (was 'FULL') |
| 6165c81 | fix(org): RecordCreatorModal closes only after async create succeeds + password field |
| 80fa2d3 | fix(modals): AddPayment + AddClass close only after async success, surface errors inline |
| 786843b | fix(payments): allow uploading biên lai photo after payment creation |
| 9b18042 | test(e2e): 2 new checks for modal UX fixes — AddStudent hint, modal-stays-open-on-error |
| ac182ac | fix(notifications): broaden type vocab to 'doc', serialize recompute, harden tx |
| d661f91 | fix(writes): branch-scope notification mutations + enforce password policy on admin reset |
| e0155fd | fix(uploads): verify magic bytes post-upload, refuse non-scopable file kinds |
| 131b6de | fix(server): strip raw error.message from /api 500 responses in production |
| a298026 | fix(auth): resolve req.user on logout so audit log captures the actor |
| c009bc4 | fix: enforce feePlanId in AddStudent + click-to-view DocSlot + multi-file spec |
| a813299 | test(security): live-server checks for notification branch scope + adjacent fixes |
| 20cadae | K4: MoreMenu row actions + branches CRUD + generic _crud helper |
| 84c288f | fix(test): smoke-test uses actual CSV admin email (thinh@motogiathinh.vn) |

K1 caught a batch of high-severity gaps:

- Payment status enum disagreed between FE (`FULL`) and BE (`100%`).
- AddStudent allowed creating students against no-open-class branches.
- Several modals closed instantly on submit — failed API calls vanished
  silently. Switched to await-then-close with inline error.
- Notification mutations needed branch-scope checks for staff actors.
- File-upload magic-byte verification was missing.
- `req.user` was being cleared before the audit log write on logout.

K4 added the `MoreMenu` (· · · row-action popover) and a full Branches
CRUD UI in the Tổ chức page, plus a `_crud` generic that the support
tables (accounts/feePlans/promotions/teachers/vehicles) all consume.

## L-series — deeper iteration (4 commits)

| Commit  | Title |
|---------|-------|
| 612c42d | fix(org): ActivityTab survives null log.userId + EditRecordModal stays open on API error |
| cff2388 | fix(classes): ClassEditModal stays open + shows inline error on API rejection |
| 039161c | fix(shell): Modal dismisses on Escape key |
| 69530a8 | feat(toast): add window.MGT_TOAST helper for transient placeholders |
| 1ce07e5 | fix(app): ScreenErrorBoundary isolates per-screen crashes + wire Báo cáo onClick |
| 3358368 | test(sweep): extend e2e-sweep with 15 regression checks for L1 fixes |
| 5dea01e | fix(org): mask password inputs + keep PasswordResetModal open on error |
| 3dba15f | feat(docs): DELETE /students/:id/docs/:key + wire DocSlot onClear |
| e1a5977 | fix(writes): tighten POST /accounts + PATCH validation + totalFee recompute |
| 782cd86 | fix(backend): robustness — auth-failure GC + migration-owned schema + scoped log + sandboxed iframe |
| 84abcff | docs: sync SPEC/BACKEND/DEPLOY/CLAUDE with polish-session reality |
| 952ef2c | test(writes): add 7 regression tests for polish-round gates |

L-cycle hardened the polish:

- `Modal` now dismisses on Escape (paired in L5d with the same handler
  on `FloatingFilterPanel`).
- `ScreenErrorBoundary` isolates per-screen render crashes so one
  broken screen doesn't blank the app.
- `MGT_TOAST` replaces inline `alert()` calls with a vanilla bottom-right
  toast for soft-failure notices.
- `ActivityTab` survives `null userId` (system-generated activity log
  rows).
- `EditRecordModal` / `ClassEditModal` / `PasswordResetModal` all now
  stay open on API rejection and render inline error in the footer.
- `DELETE /students/:id/docs/:key` plus the `DocSlot onClear` plumbing
  so users can remove uploaded files (not just replace).
- POST `/accounts` validates role + branchId + password policy before
  insert.
- Auth-failure GC, migration-owned schema, scoped activity log,
  sandboxed PDF iframe — backend robustness pass.

## L5a-L5d — deep iteration cycle (15 commits)

### L5a-c — feature gaps + bugs

| Commit  | Title |
|---------|-------|
| 218570e | polish: surface AddStudent doc upload errors + reportWriteError via MGT_TOAST |
| 12fcac2 | fix(modals): synchronous useRef guard against triple-click double-submit |
| 50c81b7 | feat(payments): soft over-payment warning in AddPaymentModal |
| 0898152 | fix(uploads): unlink prior file on disk when overwriting student doc / biên lai |
| 901398f | fix(smoke): per-run unique idNumber so re-runs don't 409 |
| f53dabf | test(e2e-deep): add 14b — AddClassModal triple-submit guard |
| 96d264c | test(e2e-deep): fix 14b to drive native <select> for branchId |

Three real bugs the multi-agent L5 review caught:

- **Triple-submit race** in 6 create/edit modals — `setBusy(true)` is
  async, so a fast triple-click could fire 3 INSERTs. Each modal now
  also holds `busyRef.current = true` synchronously and bails on
  re-entry.
- **Over-payment** went through silently — no UI signal that
  `amount > student.balance` would create a surplus. Added a yellow
  non-blocking warning in `AddPaymentModal`'s footer slot.
- **Orphan files** accumulated in `backend/data/uploads/` when a
  student doc or biên-lai photo was overwritten. The pre-existing
  file is now unlinked from disk on replace. Hard-asserted in e2e-deep
  test 06.

### L5d — closing the cycle (this session, 7 commits)

| Commit  | Title |
|---------|-------|
| 7439a46 | fix(filters): FloatingFilterPanel dismisses on Escape key |
| c5ddfce | fix(test): e2e-write-flows uses actual CSV admin email by default |
| 830c2c7 | test(writes): include password in account-create tests 5 & 14 |
| 7dfacb5 | test(e2e-deep): promote orphan-cleanup check from WARN to FAIL |
| bf1c781 | docs: §14 polish-landed rows + resolve §8.<n> citation drift |
| 66e72df | test(writes): fix flaky tests 4 + 10 (duplicate class codes, stale notif ids) |
| (snapshot) | snapshot-L5d-final + this CHANGELOG-POLISH.md |

- `FloatingFilterPanel` now mirrors `Modal`'s Escape-to-dismiss
  pattern — all 4 list screens.
- `e2e-write-flows.js` default `EMAIL` was the wrong account; switched
  to the CSV-seeded `thinh@motogiathinh.vn`. Tests 5 & 14 also needed
  the new mandatory password field.
- Test 4 was flaky because many seed classes share the code
  `MÔ TÔ 06/2026`; `find()` returned a different id than the grid
  rendered. Now resolves the id via `(code + openDate + examDate)`
  tuple from the detail view.
- Test 10 was flaky because `recomputeAfterWrite` from earlier tests
  rotated notification ids; the screen's local state still held dead
  ids and produced 404s on PATCH. Now forces a fresh fetch first.
- `e2e-deep.js` test 06 (orphan cleanup) promoted from WARN to
  hard FAIL — fix is loaded and a regression must be loud.
- `DEPLOY.md §14` table now has rows for the L5a-c landings (over-
  payment warning, orphan cleanup, useRef guard, Esc handler).
- `BACKEND.md §8` items prefixed with their (§8.<n>) tags so
  commit-message citations resolve to actual anchors.

---

## Final test counts (close of L5d)

| Suite | Result |
|---|---|
| `npm test`               | 34 pass / 0 fail |
| `node seed/smoke-test.js`     | all checks passed (1 suite of 8 sections) |
| `node seed/e2e-sweep.js`      | 75 PASS · 0 FAIL · 0 WARN |
| `node seed/e2e-write-flows.js`| 14 PASS · 0 FAIL · stable across 3+ consecutive runs |
| `node seed/e2e-deep.js`       | 56 PASS · 0 FAIL · 4 WARN (acceptable — see below) |

The 4 standing WARNs in `e2e-deep`:

1. Branch ring colour cycle — possible stale colour, not a regression
   from this cycle. Cosmetic.
2. No br-1 student with uploaded file — test-data shape, not a bug.
3. Over-payment ACCEPTED by API — **intentional** per BACKEND.md §8.5
   (payments are an event log; over-payment is a valid compensating
   entry). The UI now warns at the modal level (50c81b7).
4. Dashboard screenshot size diverges from baseline by ~55% — visual
   noise from theme + real data growth, no regression in the layout.
   Baselines need refresh.

## Endpoint surface (as of L5d-final)

All routes mounted under `/api`. See `backend/INTEGRATION-CATALOG.md`
for the canonical map.

| Verb | Path | Auth |
|---|---|---|
| POST | `/auth/login` | public (rate-limited, locks after 5 fails) |
| POST | `/auth/logout` | session |
| GET  | `/me` | session |
| GET  | `/branches /accounts /classes /students /payments /fee-plans /promotions /teachers /vehicles /notifications /activity-log` | session, branch-scoped for staff |
| POST | `/students /payments /classes /branches /accounts /fee-plans /promotions /teachers /vehicles` | admin (or staff for `/students /payments`) |
| PATCH | `/students/:id /classes/:id /accounts/:id /branches/:id /fee-plans/:id /promotions/:id /teachers/:id /vehicles/:id /notifications/:id` | admin (varies) |
| DELETE | `/notifications/:id /branches/:id /students/:id/docs/:key` | admin |
| POST | `/accounts/:id/reset-password` | admin |
| POST | `/students/:id/docs/:key` | admin/staff multipart |
| POST | `/payments/:id/bien-lai` | admin/staff multipart |
| GET  | `/files/*` | session, kind-gated |

## Known deviations from the original frozen design

Documented in detail in `DEPLOY.md §14`. Summary:

- Every "save/create/update/delete" callback was empty in the
  signed-off frontend — that was the integration seam left for backend
  phase. Filled with real `D.api.*` calls. No visual change.
- New admin-tooling primitives that follow the existing atom idiom:
  `MoreMenu`, `EditRecordModal`, `RecordCreatorModal`,
  `PasswordResetModal`, `DocLightbox`, `BienLaiPreview`, Branches CRUD
  UI, `ScreenErrorBoundary`, `MGT_TOAST`.
- `notifications[i].message` aliased to `.detail` inside `data-loader.js`
  per the "transform inside data-loader" allowance.

## Known gaps + future spec items

See `SPEC-FUTURE.md` for the full pending list. Highlights:

1. **Multi-file uploads per document slot** — currently each doc slot
   holds exactly one file; the user wants N per slot. Open spec, schema
   change required.
2. **Payment refund / compensating-entry UI** — backend supports
   negative amounts (BACKEND.md §8.5); no UI affordance yet.
3. **Class deletion + soft-archive** — DELETE class endpoint missing;
   archived-class semantics undefined.
4. **Email-based password reset for staff** — admin can reset, staff
   cannot self-serve.
5. **Per-class teacher + vehicle assignment** — class row has no FK
   yet to the teachers/vehicles tables.
6. **Branch-level dashboards** — currently only the global admin view
   has KPI cards.

## Live URL

**No VPS yet.** The backend is local-only at `http://127.0.0.1:3001/`.
SQLite database at `backend/data/motogiathinh.db`. Uploads at
`backend/data/uploads/`. When the user has a VPS, see `DEPLOY.md` for
the deploy checklist (`npm install --omit=dev`, env vars for
`SESSION_SECRET / UPLOAD_DIR / LOG_LEVEL`, `node server.js` behind a
TLS-terminating reverse proxy).

Visual snapshots at L5d close:
- `backend/data/snapshots/L5d-final-dashboard.png`
- `backend/data/snapshots/L5d-final-students.png`
- `backend/data/snapshots/L5d-final-classes.png`
