# Dataset — CSV "database" for MOTOGIATHINH CRM

This folder is the **source of truth** for app data. The frontend loads
these CSVs at startup via `data-loader.js`. Backend devs can `COPY`
each `.csv` straight into a Postgres table with no transformation.

> **Mock clock.** Everything in this set is positioned relative to
> **30/05/2026 15:00** (set in `data-loader.js`). When you switch to a
> real backend, drop that constant and let the wall clock take over.

---

## File-by-file

| File | Cardinality | Maps to backend table | Notes |
|---|---:|---|---|
| `branches.csv` | 3 | `branch` | Three fixed branches (SPEC §3.11). |
| `accounts.csv` | 7 | `account` | 1 admin + 6 staff, 2 per branch. |
| `fee_plans.csv` | 2 | `fee_plan` | Bằng A: 1.995.000đ · Bằng A1: 565.000đ |
| `promotions.csv` | 5 | `promotion` | `appliesTo_csv` is pipe-joined fee-plan ids. |
| `teachers.csv` | 5 | `teacher` | Independent lookup; not FK'd today. |
| `vehicles.csv` | 6 | `vehicle` | Mix of bikes by licence (A vs A1). |
| `classes.csv` | 167 | `class` | One per branch per month, scaled by SEASONALITY × BRANCH_BIAS. |
| `students.csv` | 1208 | `student` | Celebrity names (recycled with II / III / IV suffixes after pool exhausted). |
| `payments.csv` | 1332 | `payment` | Event log — never edit historical rows. |
| `notifications.csv` | 13 | `notification` | Derived from current state; regenerate from live data. |
| `activity_log.csv` | 12 | `activity_log` | Last few events. Append-only in production. |

---

## How the generator built this

The whole set was produced by a **seeded deterministic generator** so
backend devs can compare hashes / reproduce edge cases. Three big
levers shape the data:

### 1. Branch health bias

Designed so that the dashboard clearly differentiates the three
branches at every aggregation level:

| Branch | volumeMult | Pay-full prob | Partial prob | Unpaid prob | Late top-up prob |
|---|---:|---:|---:|---:|---:|
| **331A QL1A** | 1.40 × | 78 % | 16 % | 6 % | 92 % |
| **183 14/9**  | 1.00 × | 62 % | 24 % | 14 % | 78 % |
| **18C Phạm Hùng** | 0.65 × | 42 % | 30 % | 28 % | 58 % |

End result in this dataset:

```
331A QL1A:   694 students   97 % paid   698M revenue
183 14/9:    351 students   88 % paid   347M revenue
18C Phạm Hùng: 163 students   79 % paid   153M revenue
```

Replace any `students.csv` / `payments.csv` slice and the bias is
preserved — the generator's logic is in `data/.generator-notes.md`.

### 2. Seasonality

Per-month multiplier (Vietnamese motorcycle licensing demand cycle):

```
Jan 0.55   Feb 0.45   Mar 1.30   Apr 1.45   May 1.50   Jun 0.95
Jul 0.80   Aug 0.85   Sep 1.20   Oct 1.30   Nov 1.20   Dec 0.85
```

- **Jan–Feb** Tết lull.
- **Mar–May** post-Tết surge, peak demand.
- **Jun–Aug** rainy / hot lull.
- **Sep–Nov** back-to-school + year-end push.
- **Dec** pre-Tết slowdown.

Multiplies into both class count and per-class enrollment, so charts
show a real seasonal heartbeat.

### 3. Date frame

```
Coverage:  01/01/2025 → 30/06/2026   (extends past NOW so we have open / ongoing classes)
Today:     30/05/2026 15:00          (mock clock — see data-loader.js)
```

Classes whose `examDate < NOW` are derived as **"đã kết thúc"**.
Classes where `openDate ≤ NOW ≤ examDate` are **"đang diễn ra"**.
Classes where `openDate > NOW` are **"đang mở"**.

---

## Intent per CSV — swap-in guide

Each CSV is independent. Replace any one to test a different scenario;
the loader will rebuild derived state without code changes.

### `branches.csv`

Three fixed branches. Don't add a fourth without product approval —
the UI is built around three.

### `accounts.csv`

1 admin (sees everything) · 6 staff (2 per branch). Staff scope
writes to their own branch. Swap names freely; keep the role + branch
distribution.

### `fee_plans.csv` / `promotions.csv`

The price ladder. Promotions reference fee plans by pipe-joined IDs
(`promo-link` applies to both `fee-a` and `fee-a1`). For a multi-fee
promo, switch to a join table when you stand up the real DB.

### `teachers.csv` / `vehicles.csv`

Independent lookups. Frontend reads them but doesn't FK from anything
yet — when you wire teachers/vehicles into classes, drop foreign keys
into `classes.csv` and update the loader.

### `classes.csv`

One row per cohort. `openDate` and `examDate` are dates as
`dd/mm/yyyy`. Status is **always derived** from those vs the clock —
never write a `status` column.

### `students.csv`

The big one. **Celebrity names** (Vietnamese pop / film / sports
primary, then K-pop / global football + pop, then classical Chinese
figures recognisable from phim cổ trang). Pool is ~247 names; this
dataset cycles 4 times so a few celebrities appear with `II` / `III` /
`IV` / `V` suffixes. To get a new pool, edit the generator's `NAMES`
array.

Fields worth noting:

- `totalFee` — frozen at enrollment (= fee_plan.amount − promo.discount).
- `profileComplete` — only true when **all four** of `docs_cccd / gksk
  / donDeNghi / the3x4` are filled.
- `notes` — synthesised mix of **payment-state observation** ("Đã đóng
  đợt 1...") + a **driving-school behaviour line** ("Bài hình số 8 còn
  rộng..."). Both phrasing pools are in the generator if you want to
  expand them.
- `branchId` is denormalised from `class.branchId` for fast filtering.

### `payments.csv`

The **event log**. Each row is one real-life payment instance with its
own `bienLaiId`. Derived student fields (`paid`, `balance`,
`paymentStatus`) are recomputed from this log every time the app
loads — **never** edit per-student paid totals manually.

`bienLaiPhoto` is a boolean here (true / false). In production, swap
for a URL / S3 key.

### `notifications.csv` / `activity_log.csv`

These are convenience seeds for the demo. In production:

- `notifications` is generated by a cron when balance>0 + exam<N days,
  not stored as canonical CSV input.
- `activity_log` is append-only on every mutation.

Feel free to replace either with hand-curated samples when testing
specific dashboard scenarios (e.g. an empty notifications.csv shows the
"no urgent items" state).

---

## Replacing a slice — workflow

1. Open the CSV you want to alter in Excel / Sheets / Numbers.
2. Edit rows directly. Keep the header row intact.
3. Save back as `*.csv` (UTF-8, comma-delimited).
4. Refresh the app — `data-loader.js` re-parses on every page load.
5. Verify derived fields match expectations (e.g. a new payment
   immediately flips that student's `paymentStatus`).

No app code changes needed.

---

## When backend is real

Replace `data-loader.js`'s `fetch()` calls with HTTP calls to your
API. The interface (`window.MGT_DATA.*`) stays identical, so the rest
of the frontend keeps working. See `BACKEND.md` for the canonical
endpoint map.

---

## Footnotes

- All phone numbers use real Vietnamese mobile prefixes (Viettel /
  Mobifone / Vinaphone / Vietnamobile / Gmobile). Generated 9-digit
  subscriber numbers are random — no real-world collisions.
- CCCD numbers follow the 12-digit format (province `079` = TP.HCM, sex
  digit, two-digit birth year, six random digits).
- All money values are integer đ. The UI formats with thousands
  separators at render time.
