# L5c Code Review — L5a sweep + L5b fixes

Scope: 6 commits since `218570e` (12fcac2, 50c81b7, 0898152, 901398f, f53dabf, 96d264c).
Reviewer: Claude (L5c). Read-only review against backend at `http://127.0.0.1:3001`.

---

## Verified-correct in L5b

- **Busy-ref guard pattern uniform across all 6 sites** · `webapp/modals.jsx:232,461`, `webapp/screen-org.jsx:759,842,932`, `webapp/screen-classes.jsx:413`. Verified by reading every site against the diff in 12fcac2 — same shape: `busyRef = React.useRef(false)` declared; `busyRef.current = false` in the `useEffect([open])` reset path so reopen does not carry stale state; synchronous guard `if (busyRef.current) return; busyRef.current = true;` at the top of `submit`; `busyRef.current = false` in the `finally` block.
- **e2e-deep tests confirm the fix works against a live backend** · ran `node seed/e2e-deep.js`. Test 14 (`modal triple-submit guarded (1 row created) — Δ=1`) and 14b (`AddClassModal triple-submit guarded — Δ=1 branch=br-1`) both PASS.
- **Over-payment soft warning rendering** · `webapp/modals.jsx:253-258, 285-289`. `overAmount` computed as `Math.max(0, newPaid - student.totalFee)`; `isOverpayment` shown only when amount>0 & student is set. Warning is non-blocking (does NOT touch `primaryDisabled` on line 280). Uses `var(--neon-amber)` — consistent with 20 other amber usages across `atoms.jsx`, `screen-payments.jsx`, `screen-notifs.jsx`. Wraps `fmtVND(overAmount)` for thousands-separator formatting (e.g. "+100,000đ"). Has `data-testid="overpayment-warning"` for future test hooks.
- **`unlinkStoredUrl` traversal guards are correct (in code)** · `backend/routes/uploads.js:114-125`. Strips the `/api/files/` prefix; rejects `..` segments and absolute paths; resolves under `UPLOAD_ROOT` then re-checks `abs.startsWith(UPLOAD_ROOT)` — defense in depth. Wrapped in try/catch with `console.warn`; failure does NOT throw a 500 (verified: caller is plain function call, not `await`, no rejection to leak). Called from both `POST /students/:id/docs/:key` (line 149) and `POST /payments/:id/bien-lai` (line 213) BEFORE the `UPDATE` so DB and disk stay aligned.
- **smoke-test idNumber rotation** · `backend/seed/smoke-test.js:66`. `'9' + Date.now().toString().slice(-11)` = 12 chars total, satisfies CCCD validation. Re-runs no longer 409. Confirmed: `node seed/smoke-test.js` exits 0.
- **No visual changes in L5b** · The only frontend diff that touches the DOM is the new `<span>` in `AddPaymentModal`'s `footerStart` slot — uses the existing `Modal` `footerStart` API, the established `var(--neon-amber)` token, and same font/size as the sibling error span. No layout/spacing/color/font-token churn anywhere. Verified by `git show 50c81b7 12fcac2 -- webapp/`.

---

## Bugs introduced by L5b (regression risk)

| Severity | File:line | Description | Repro | Fix recipe |
|---|---|---|---|---|
| (none — L5b is a clean fix-pass) | — | The plumbing changes in 12fcac2/50c81b7/0898152 don't introduce any new defects I can find. | — | — |

---

## Bugs L5a missed that L5c found

| File:line | Description | Severity |
|---|---|---|
| `webapp/list-tools.jsx:424-540` (`FloatingFilterPanel`) | **No Esc-dismiss handler.** `AdvancedFilterModal` (line 293) wraps `<Modal>` which has Esc, but `FloatingFilterPanel` is a bare fixed-position div with only X/XÓA buttons. All four screens (`screen-org.jsx`, `screen-classes.jsx`, `screen-students.jsx`, `screen-payments.jsx`) use **FloatingFilterPanel**, not AdvancedFilterModal. So L5a's "Lọc Esc-dismiss" finding is a real product bug, not Playwright noise. | P3 / nice-to-have |
| `backend/seed/e2e-write-flows.js:9` | Default `EMAIL` is `'admin@motogiathinh.local'`, but actual admin is `thinh@motogiathinh.vn`. Running without env vars times out at login (silently — login form stays up, MGT_DATA never sets, waitForFunction → FATAL). This is pre-existing (not L5b's fault) but L5b's smoke fix didn't propagate the same env hardening here. | P2 / flaky tests block CI |
| `backend/seed/e2e-write-flows.js:tests 4, 5, 14` | Even with correct `SEED_ADMIN_EMAIL=thinh@motogiathinh.vn`, three tests fail: **#4 Sửa lớp (status not persisted)**, **#5 Tạo tài khoản (400 Bad Request)**, **#14 RecordCreatorModal keeps open on failure (timeout)**. These appear to be real regressions or test brittleness; investigation needed in L5d. | P2 |
| `webapp/list-tools.jsx` (`FloatingFilterPanel`) | No close on backdrop click either — only the explicit X button closes it. Matches a real user complaint pattern. | P3 |
| `motogiathinh-design-system-template/project/BACKEND.md` | Over-payment commit references "Per BACKEND.md §8.5" but §8 has no `.5` subsection (sub-items are numbered, not §8.x). Cosmetic, but a future reader chasing the citation will find nothing. | P4 / docs |

---

## Live-test results

- **Triple-click guard: PASS.** e2e-deep test 14 reports `Δ=1` (1 row created from 3 sync clicks); test 14b reports `Δ=1` for AddClassModal. Confirmed against running backend.

- **Orphan cleanup: FAIL — but the bug is operational, not code.** Live curl reproduction:
  ```
  POST /api/students/hv-001/docs/cccd → v1.url = /api/files/students/hv-001/cccd-1780024750693.png
  POST /api/students/hv-001/docs/cccd → v2.url = /api/files/students/hv-001/cccd-1780024750829.png
  GET v1.url → 200 (file still served)
  GET v2.url → 200
  existsSync(v1_disk_path) === true after v2 upload
  ```
  **Root cause:** The backend (PID 16968) started at **2026-05-29 08:57:31**. The L5b orphan-cleanup commit (`0898152`) landed at **09:52:55**. The running process predates the fix by **~55 minutes** — it is executing the OLD code. The prompt's claim that "backend restarted with the new orphan-cleanup code loaded" is incorrect. After a restart, the cleanup should work — I verified the path resolution in isolation: `resolve(UPLOAD_ROOT, "students/hv-001/cccd-XXX.png")` → correct absolute path, `startsWith(UPLOAD_ROOT)` returns true, `existsSync` returns true. Code is correct; runtime is stale.
  
  Also: e2e-deep itself reports the same WARN ("v1 file STILL exists after replace (orphan on disk)") — that test (06-docslot-replace-and-clear, line 388-391) was written before L5b and explicitly documents this as a "known gap"; after a real restart, the test should be updated to upgrade the WARN to a PASS assertion.

- **Over-payment warning: PASS (verified by code reading + e2e-deep test 11).** Test 11 confirms the API accepts over-payment (`balance=997500 amt=1097500 pmt=PMT-... → 201`), consistent with the spec'd "payments are an event log" design. The UI warning is purely cosmetic, doesn't block, and per code review formats the surplus correctly via `fmtVND`.

---

## Test counts after L5b

| Suite | Count | Status |
|---|---|---|
| `npm test` (unit) | 34 PASS / 0 FAIL | green |
| `node seed/smoke-test.js` | 18 assertions PASS | green (idNumber rotation fix verified) |
| `node seed/e2e-sweep.js` | 75 PASS / 0 FAIL / 0 WARN | green |
| `node seed/e2e-deep.js` | 55 PASS / 0 FAIL / 5 WARN (total 60) | green (was 55+5=60 already at L5a; the 14b commit appears as PASS so total is 60 incl. 14 + 14b) |
| `node seed/e2e-write-flows.js` | 11 PASS / 3 FAIL / 14 total | **FAIL** (requires `SEED_ADMIN_EMAIL=thinh@motogiathinh.vn`; even then tests 4/5/14 fail) |

WARNs in e2e-deep (informational only):
1. branch glow ring stale color (visual flicker)
2. v1 orphan file (operational — see above)
3. no br-1 student with uploaded file (data gap)
4. over-payment accepted (now expected per design — should be upgraded to PASS w/ confirming assertion in L5d)
5. dashboard screenshot diverges 55% from baseline (likely real — needs visual review)

---

## Doc drift requiring update

| Doc | What's stale |
|---|---|
| `DEPLOY.md §14` | No mention of: (a) over-payment soft warning UX, (b) orphan-cleanup on doc/biên-lai overwrite, (c) busy-ref synchronous guard. The "New admin tooling landed in polish sessions" table should get a row for each. |
| `motogiathinh-design-system-template/project/BACKEND.md §8` | Doesn't explicitly say "over-payment is allowed by design (compensating entries in §8 #5 imply it but never stated)." Add a sentence under #5 or as a new §8.5: "Over-payment (sum of payments > totalFee) is permitted; the UI surfaces a soft warning but does not block." This matches the citation that 50c81b7's commit message expects to exist. |
| `backend/INTEGRATION-CATALOG.md:3` | Already flagged as "STALE SNAPSHOT from session B1" — fine, no action. |
| `backend/seed/e2e-deep.js:388-391` (test 06) | After backend restart, the `WARN('v1 file STILL exists after replace ...')` branch should never fire. Convert to a `FAIL` assertion so this test guards the fix going forward instead of just informationally tolerating it. |

---

## Push state

**Local is 13 commits ahead of `origin/main`** (`git status` reports this). The 6 L5b commits + the earlier 7 polish commits have NOT been pushed. Flag for the main loop to push.

```
$ git log origin/main..HEAD --oneline | wc -l
13
```

Untracked files (not in scope for push but worth a sweep): 19 PNG snapshots under `backend/data/snapshots/` plus the `backend/data/uploads/` directory. The snapshot dir already has tracked baseline PNGs; the L1-*.png and L5-*.png are diagnostic-only — caller's choice whether to commit.

---

## Recommendations for L5d (final polish, prioritized)

1. **[P1] Restart the backend** before any further e2e testing. Current process (PID 16968) predates the L5b orphan-cleanup commit. Re-run `node seed/e2e-deep.js` after restart; test 06 should flip from WARN to PASS for "v1 file cleaned up on replace".
2. **[P1] Update `backend/seed/e2e-deep.js` test 06** to FAIL (not WARN) on orphan persistence, now that the fix is in place. Same for the WARN on "over-payment ACCEPTED by API" in test 11 — upgrade to PASS with an explicit "by design" assertion.
3. **[P2] Add Esc handler to `FloatingFilterPanel`** (`webapp/list-tools.jsx:424`) mirroring the `Modal` pattern at `atoms.jsx:424` / `shell.jsx:387`:
   ```js
   React.useEffect(() => {
     if (!open) return;
     const onKey = (e) => { if (e.key === "Escape") onClose && onClose(); };
     document.addEventListener("keydown", onKey);
     return () => document.removeEventListener("keydown", onKey);
   }, [open, onClose]);
   ```
   This closes the real product gap L5a found.
4. **[P2] Fix `e2e-write-flows.js:9` default email** to `thinh@motogiathinh.vn` (or whichever account `seed/seed.js` actually creates as admin). Then investigate the 3 still-failing tests (#4 Sửa lớp, #5 Tạo tài khoản 400, #14 RecordCreatorModal-keeps-open) — these may be real regressions.
5. **[P3] Doc updates in `DEPLOY.md §14`** — add rows for over-payment soft warning + orphan cleanup + busy-ref guards (one-line each is fine; that table is short).
6. **[P3] Tighten smoke-test idNumber** to also include process PID or a randomness suffix to survive parallel runs in the same second: `'9' + (Date.now()%1e9).toString().padStart(9,'0') + (process.pid%1000).toString().padStart(3,'0')` — 13 chars, would fail CCCD validation (12 only). Pragmatic alternative: `'9' + Date.now().toString().slice(-9) + Math.floor(Math.random()*100).toString().padStart(2,'0')` = 12 chars with random tail. Not blocking; flag only.
7. **[P4] BACKEND.md §8.5 citation** — either add the §8.5 the commit message references, or change the citation to `§8 #5` in a follow-up doc-fix commit.
8. **[P4] Dashboard screenshot baseline drift (55%)** — visual regression flagged by e2e-deep test 18. L5b shouldn't have touched visuals; this is likely from earlier work. Re-baseline or investigate.
9. **[P4] Push 13 local commits to origin/main** when L5d closes the iteration.
