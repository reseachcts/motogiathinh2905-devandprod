# CLAUDE.md — frontend package contract

> **You are an AI agent integrating this frontend with a backend.**
> Read this entire file before touching anything.

This folder is a **frozen, take-it-as-is frontend package**. It has
been visually + behaviourally signed off. The customer-facing UI must
look + behave **identically** to what `index.html` produces today.

You have **exactly one job**: wire the in-memory CSV loader to your
real backend.

---

## What you may edit

**Only this file** — and the lines inside it explicitly marked with
`// EDIT-ME ⇩` / `// ⇧ EDIT-ME`:

```
frontend/data-loader.js
```

That file fetches CSVs from `frontend/data/*.csv` at boot, normalises
them into `window.MGT_DATA`, and exposes the query interface that the
rest of the app reads. Your job is to **replace those CSV fetches with
HTTP calls** to your backend.

The **shape** of `window.MGT_DATA` is frozen — see `../BACKEND.md`
"§5 Read endpoints" for the canonical entity schemas and the methods
the frontend calls on it. If your backend returns the data in a
different shape, transform it inside `data-loader.js` to match.

## What you may NOT edit

**Everything else.** Specifically:

```
frontend/index.html              ← entry HTML, asset wiring, CSS keyframes
frontend/colors_and_type.css     ← design tokens (colors, type, spacing)
frontend/fonts/*                 ← SF Pro Display + SF Pro Text font files
frontend/assets/*                ← logo + brand SVGs
frontend/app.jsx                 ← routing + <Boot/> data-ready guard
frontend/shell.jsx               ← Sidebar, TopBar, Modal, ThemeProvider, VehicleMode toggle
frontend/atoms.jsx               ← primitives (GlassCard, Button, Icon, Chip, Avatar, …)
frontend/list-tools.jsx          ← FloatingFilterPanel, DateRangeField, ChipButton, paginator
frontend/modals.jsx              ← Add student / payment / class dialogs
frontend/screen-*.jsx            ← every dashboard / list / detail screen
```

If you find a bug or limitation in a frozen file, **stop and ask**.
Do not fix it yourself. The customer trusts that the visual + UX
artefacts are unchanged.

---

## How to integrate your backend

The contract you must satisfy is straightforward — the rest of the
app will call these methods on `window.MGT_DATA` and expect the
shapes documented in `../BACKEND.md`.

### Step 1 — choose your integration mode

| Mode | What you do |
|---|---|
| **A. Keep CSVs as your dev database** | Your real backend writes to / reads from the same CSV files. No code changes needed in `data-loader.js`. Useful when you're prototyping. |
| **B. Replace fetch with HTTP** | In `data-loader.js`, change the per-table `loadCsv(name, schema)` calls to fetch JSON from your API. Adapt the response into the same row shape. |
| **C. WebSocket / GraphQL** | Same as B but with your transport. The interface (`window.MGT_DATA`) doesn't change. |

### Step 2 — replace the data source (mode B example)

Inside `data-loader.js`, find:

```js
async function loadCsv(name, schema) {
  const res = await fetch("data/" + name + ".csv");
  ...
}
```

Replace with something like:

```js
async function loadEntity(name, schema) {
  const res = await fetch("/api/" + name);   // your backend route
  if (!res.ok) throw new Error(`Failed to load ${name} (${res.status})`);
  const rows = await res.json();
  return rows.map(r => coerceRow(r, schema || {}));
}
```

Then change every `loadCsv("...", schema)` call to `loadEntity(...)`.
Coercion still happens via the schema map; your backend JSON should
already use the right field names.

### Step 3 — keep `window.MGT_DATA` shape identical

The frozen screens depend on these methods existing and returning
exactly these shapes:

```
MGT_DATA.branches        : Array<Branch>
MGT_DATA.accounts        : Array<Account>
MGT_DATA.feePlans        : Array<FeePlan>
MGT_DATA.promotions      : Array<Promotion>          // promotion.appliesTo = string[]
MGT_DATA.teachers        : Array<Teacher>
MGT_DATA.vehicles        : Array<Vehicle>
MGT_DATA.classes         : Array<Class>              // status derived from openDate/examDate vs _NOW
MGT_DATA.students        : Array<Student>            // paid/balance/paymentStatus/noPayOnRegistration derived from payments
MGT_DATA.payments        : Array<Payment>            // event log
MGT_DATA.notifications   : Array<Notification>
MGT_DATA.activityLog     : Array<ActivityLogEntry>

MGT_DATA.currentUser     : Account
MGT_DATA.NOW             : Date                      // server time
MGT_DATA.TODAY           : "dd/mm/yyyy"

MGT_DATA.getStaff(id)        → Account | undefined
MGT_DATA.getBranch(id)       → Branch  | undefined
MGT_DATA.getClass(id)        → Class   | undefined
MGT_DATA.getStudent(id)      → Student | undefined
MGT_DATA.getFeePlan(id)      → FeePlan | undefined
MGT_DATA.getPromotion(id)    → Promotion | undefined

MGT_DATA.paymentsForStudent(studentId)   → Payment[]
MGT_DATA.studentsInClass(classId)        → Student[]
MGT_DATA.paymentsToday()                 → Payment[]
MGT_DATA.studentsCreatedToday()          → Student[]
MGT_DATA.firstRecordMs()                 → number

MGT_DATA.revenueBuckets(grain, count, branchId?, mode)    → Array<{ label, tong, daNhan, conNo }>
MGT_DATA.studentBuckets(grain, count, branchId?, mode)    → Array<{ label, tong, A, A1 }>
MGT_DATA.revenueCumulative(grain, count, mode)            → same shape, cumulative
MGT_DATA.studentCumulative(grain, count, mode)            → same shape, cumulative
MGT_DATA.branchPerformance()                              → Array<{ branchId, name, students, revenue, committed, outstanding, paidFull, partial, unpaid, noPayOnReg, paidImmediately }>

MGT_DATA.PROFILE_DOCS    : Array<{ key, label, hint }>
```

Plus performance indices, exposed for direct read in tight render
loops — keep these populated:

```
MGT_DATA._byId.{branchesById, accountsById, classesById, studentsById, feePlansById, promotionsById}
MGT_DATA._indexes.{paymentsByStudentId, studentsByClassId, studentsByBranchId, paymentsByBranchId}
```

### Step 4 — derived fields are NEVER read from the wire

These are computed in `data-loader.js` **after** the raw arrays load:

- `student.paid` `student.balance` `student.paymentStatus`
- `student.noPayOnRegistration`
- `class.status`

If your backend returns these, **ignore them**. Let `data-loader.js`
recompute. This guarantees consistency with the payment event log
and is non-negotiable.

---

## Mock clock

The package ships with a **fixed mock clock**: `30/05/2026 15:00`.
Find these two lines at the top of `data-loader.js`:

```js
// EDIT-ME ⇩  mock clock — drop this when shipping
const TODAY_STR = "30/05/2026";
const NOW       = new Date(2026, 4, 30, 15, 0, 0);
// ⇧ EDIT-ME
```

When you wire up the real backend, replace them with:

```js
const NOW       = new Date();
const TODAY_STR = `${String(NOW.getDate()).padStart(2,"0")}/${String(NOW.getMonth()+1).padStart(2,"0")}/${NOW.getFullYear()}`;
```

…and propagate `NOW` through to wherever it's referenced (the dashboard
time-frame presets, the live KPI hint strings).

The CSVs were generated relative to that mock clock — once you switch
the clock you'll also want to retire the CSVs and source from your DB.

---

## Verification checklist

After your changes, run **all** of these — none should regress:

1. `frontend/index.html` opens. The page renders within 2 seconds. No
   console errors except the standard Babel-in-browser warning.
2. Sidebar shows all 6 nav items. `CENTERSAI.com` wordmark, no eyebrow.
3. Tổng quan loads with 4 KPI cards showing real numbers — `Đã thu hôm
   nay`, `HV mới hôm nay`, `TỔNG NỢ`, `Học viên active`.
4. Tổng / Biến động / So sánh / Hiệu suất sections all render charts
   without empty data.
5. Học viên list paginates. Click a row → detail. The student's
   `paid / balance / paymentStatus` match the sum of their payments.
6. Lớp học grid renders. Click a class → detail. Enrolled students
   sum correctly.
7. Tổ chức loads. Click a branch tile → expanded panel with classes
   sorted by `openDate` desc.
8. Theme toggle flips dark ↔ light without recomputing data.
9. Vehicle-mode toggle clicks (UI-only, no behaviour wired).
10. Filter dialogs open from each list, apply / clear correctly.

If any of these regress, your data-loader change has broken the
contract.

---

## Where to read more

- `../HANDOFF.md` — UI architecture + v3 patterns (theme system,
  chart palette, expansion choreography, etc.)
- `../BACKEND.md` — canonical schema for every entity, derived-field
  formulas, suggested REST endpoints, invariants, auth model
- `../SPEC.md` — locked product rules
- `./README.md` — quick orientation for human devs
- `./data/README.md` — current dataset's intent + how to swap subsets
