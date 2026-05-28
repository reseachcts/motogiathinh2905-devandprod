# Handoff — MOTOGIATHINH Design System v2

## What's in this repo

```
.
├── README.md                  ← brand strategy, content fundamentals, visual foundations
├── CLAUDE.md                  ← repo-level orientation for AI agents (read first)
├── SPEC.md                    ← LOCKED product spec (read §3 — RULES)
├── HANDOFF.md                 ← this file (UI architecture + v3 patterns)
├── BACKEND.md                 ← schema + endpoint contract for backend devs
├── SKILL.md                   ← Claude Code / Skills descriptor
│
├── preview/                   ← 21 design-system card HTML files
│   ├── colors-{ink,neon,semantic,glass}.html
│   ├── type-{display,body,metric,mono}.html
│   ├── spacing-{radii,scale,shadow,glow}.html
│   ├── components-{buttons,inputs,kpi,badges,table,controls,nav}.html
│   └── brand-{logo,canvas}.html
│
└── frontend/                  ← TAKE-IT-AS-IS FRONTEND PACKAGE
    ├── CLAUDE.md              ← strict agent contract (what's frozen, the ONE editable file)
    ├── README.md              ← human-dev orientation
    ├── index.html             ← entry point — serve this
    ├── colors_and_type.css    ← design tokens (CSS vars + light-mode override)
    ├── data-loader.js         ← THE editable seam (loads CSVs → window.MGT_DATA)
    ├── atoms.jsx              ← Icon, Button, GlassCard, StatusChip, PaymentPill, …
    ├── shell.jsx              ← Sidebar, TopBar, Modal, ThemeProvider, VehicleMode toggle
    ├── list-tools.jsx         ← FloatingFilterPanel, DateRangeField, ChipButton, paginator
    ├── modals.jsx             ← Add student / payment / class dialogs
    ├── screen-dashboard.jsx   ← 4 sections: Tổng · Biến động · So sánh · Hiệu suất
    ├── screen-students.jsx    ← list + pill-tab detail
    ├── screen-payments.jsx    ← list + detail
    ├── screen-classes.jsx     ← grid + detail
    ├── screen-notifs.jsx
    ├── screen-org.jsx         ← 7 sub-tabs incl. Giáo viên + Phương tiện
    ├── app.jsx                ← root routing + <Boot/> guard
    ├── fonts/                 ← SF Pro Display + SF Pro Text (bundled, offline-capable)
    ├── assets/                ← brand mark + wordmark SVGs
    └── data/                  ← CSV "database" (11 entities + README + intent notes)
```

## Getting started in a new account

1. Upload this zip to a new project.
2. Open `frontend/index.html` in the preview.
3. Read `SPEC.md` §3 first — those are the LOCKED RULES, authoritative over older code.
4. Read `README.md` for voice + visual foundations.

## v2 highlights vs v1

- **Mock data covers 2024 → 2026 YTD** (29 months, 275 students, 251 payments, deterministic via seeded RNG).
- **Dashboard restructured into 4 sections:**
  - **§1 Tổng** — cumulative line charts (hour/day/month switcher, default day/30)
  - **§2 Biến động** — per-bucket line charts (independent switcher per chart)
  - **§3 So sánh** — 3 branches overlaid, color tones per branch, full-width stacked charts, toggleable legend
  - **§4 Hiệu suất** — full-width branch bar charts; money as `1,100.95 triệu` with dimmed decimal
- **Legend chips are toggles** — click to hide/show a series.
- **Export buttons** moved out of the dashboard, into the page TopBar.
- **Light theme toggle** in TopBar right (sun/moon switch).

## Architecture cheatsheet

- All tokens in `frontend/colors_and_type.css`. Override `data-theme="light"` on `<html>` for light mode.
- All mock data in `frontend/data-loader.js` exposed on `window.MGT_DATA` with backend-style query methods (`revenueBuckets(grain, count, branchId)`, `studentBuckets(...)`, `revenueCumulative(...)`, `branchPerformance()`). CSV "database" sits in `frontend/data/`.
- Money formatter: `window.fmtVND()` → `14,200,000đ`.
- Payment status: banded `0%` / `50%` / `100%` → red / yellow / green.
- Profile completeness: single right-end badge, green ✓ or red ❗.

## Locked product rules (from SPEC.md §3)

1. Only A and A1 services exist. No A2/B1/B2.
2. A & A1 share classes.
3. No max capacity on classes.
4. No source-of-lead tracking.
5. No retake/thi-lại flag.
6. Nhân viên phụ trách is required.
7. Money format `14,200,000đ`.
8. Mã HV format `HV001`.
9. Payment status banded 0% / 50% / 100%.
10. Hồ sơ status is right-end badge only.
11. Branches: 331A QL1A · 183 14/9 · 18C Phạm Hùng.
12. Giáo viên + Phương tiện are sub-tabs of Tổ chức.
13. Class statuses: đang mở · đang diễn ra · đã kết thúc.

## Caveats

- SF font licensing — Apple's EULA may restrict use outside Apple platforms. Verify before public ship.
- SF Mono not bundled — JetBrains Mono used for numerals.
- No real backend; state resets on reload.

## Open question (SPEC §8)

- Class status transitions: admin-manual (current) or auto-by-date?

---

## v3 — architectural decisions & patterns (in-progress)

> Maintained as a running handoff log for the next dev. Each entry is a
> short rationale + where the pattern lives.

### Backend handoff

If you are picking this up to build a real backend, the **source of
truth is `BACKEND.md`** at the root. It documents:

- The canonical schema for every entity (with field types and FKs).
- Which fields are **derived** vs **stored** (payments are a true event
  log; `paid / balance / paymentStatus` are always recomputed).
- The dashboard's aggregation queries (`revenueBuckets`,
  `studentBuckets`, `branchPerformance`, …) — their inputs and return
  shapes.
- Suggested REST endpoint map for every `MGT_DATA.*` call the frontend
  currently makes.
- Business invariants (banded payment status, locked class statuses,
  immutable payments, etc.).
- Auth model (`admin` vs `staff`, branch-scoped writes).
- Future-feature pointers so the schema doesn't paint into a corner.
- A cutover plan from the in-memory mock to your real API.

The integration swap-in point is `frontend/data-loader.js` — replace the
methods on `window.MGT_DATA` with thin async HTTP wrappers and the rest
of the app keeps working.

### Theme system

- **`<ThemeProvider>`** + **`useTheme()`** in `shell.jsx`. `<App>` wraps
  the tree once with the provider, every component subscribes via the
  hook. Persists `data-theme` to `<html>` + `localStorage("mgt-theme")`.
- The `useTheme()` hook falls back to a non-reactive read if called
  outside the provider (so isolated previews don't crash) — but inside
  the app, always use the provider.
- **Theme-aware JS-derived values** (e.g. branch line colors in charts)
  must read through a hook so they re-render on toggle. Pattern:

  ```js
  // screen-dashboard.jsx
  function useBranchTones() {
    const [theme] = window.useTheme();
    return theme === "light" ? BRANCH_TONES_LIGHT : BRANCH_TONES;
  }
  ```

  Inside `.map()`/loops, call the hook ONCE at the top of the component
  and index per-id (Rules of Hooks — hooks can't run in loops).

### Branch tones — two parallel maps

- `BRANCH_TONES` (dark) and `BRANCH_TONES_LIGHT` are both in
  `screen-dashboard.jsx`. Each branch owns a 3-tone family. The light
  set is re-tuned so cyan/violet lines stay visible on the paper
  surface (the dark neons wash out to ~2:1 contrast).
- Three exports:
  - `window.useBranchTones()` / `useBranchTone(id)` — **prefer these**
    in React components.
  - `window.currentBranchTones()` / `branchTone(id)` — global, reads
    `<html data-theme>` directly. Use outside React only.

### Light-mode neon tuning

- Light-mode `--neon-cyan / --neon-lime / --neon-amber` were re-tuned
  in `colors_and_type.css` to pass AA contrast (was: 3.4 / 3.8 / 4.3 →
  is: 4.7 / 4.6 / 4.6+). Dark-mode neons unchanged.
- Branch tones in light mode also re-tuned to match (`#0096C7 /
  #D81B60 / #6E48F2`).

### Z-index layers (locked-in)

| Range | Layer |
|---:|---|
| 1–9 | Local stacking inside cards |
| 30 | Sticky list toolbar |
| 40 | Hover popovers — section `?` tooltip, sort dropdown |
| 60 | Sidebar edge toggle · dashboard custom-range calendar |
| 70 | Calendar inside the floating filter panel |
| 80 | Floating paginator |
| 90 | Floating filter panel |
| **1000** | **Modal — portaled to `document.body`** |

Modals use `ReactDOM.createPortal(node, document.body)` to escape the
stacking context of whatever invokes them (e.g. the sticky-positioned
sidebar). Future components anywhere in the tree can render `<Modal>`
and it will always sit on top.

### Card padding tiers (`GlassCard` atom)

Documented inline above `GlassCard` in `atoms.jsx`. The five tiers:

| Padding | Role | Example |
|---:|---|---|
| `26` | Detail hero | `StudentDetail`, `ClassDetail`, `PaymentDetail`, `BranchExpanded` |
| `22` | Section / selector | `BranchCard`, `Hiệu suất` |
| `18` | Default | most general containers |
| `14` | Compact / chart | line-chart hosts, `TongKpi` |
| `0` | **List shell** — `padding=0` + a `padding: 14px 22px` header strip with `borderBottom: 1px solid var(--ink-4)` | every list table, all `Tổ chức` tabs |

Detail heroes share: `padding: 26`, `alignItems: center`, outer `gap: 18`,
center-column `gap: 8`, h2 size `28`. Structure (avatar vs icon tile,
optional right column) varies per page intent.

### Pill / button primitives

Standardised across dialogs:

| Type | Spec | Where |
|---|---|---|
| Footer Hủy / Lưu (Button md) | `padding: 10×16, radius: 14`, primary = cyan-filled glow | every `<Modal>` |
| Multi-select chip | `padding: 5×11, radius: 999, font: 11/600`. Active = white text + accent border + accent glow | `ChipButton` (list-tools) · `MultiPillFieldInline` (screen-org) |
| Option pill | `padding: 8×14, radius: 10, font: 13/600`. Active = white text + accent border + accent glow | `ClassEditModal` status |
| Floating-panel header (XÓA + X) | both `height: 34, radius: 999`. X is **deliberately oval** (high-alert close affordance — reserved for that semantic) | `FloatingFilterPanel` |
| Modal icon-close (`variant="icon"`) | `padding: 10, radius: 10`, glass-2 surface | `<Modal>` |

### Floating advanced-filter system

`<FloatingFilterPanel>` in `list-tools.jsx`:

- Draggable (top handle), no backdrop blur — data behind stays readable.
- Hot-applies on every change (no "Áp dụng" button).
- Top-right has only `XÓA` (clear-all, pink pill) + oval `X` (close).
- `maxHeight: 50vh` + inner scroll so it never exceeds half-viewport.
- Background: `color-mix(in oklab, var(--ink-1) 8%, transparent)` +
  `backdrop-filter: blur(22px) saturate(1.5)` — almost fully see-through.

Each list page (`Học viên` / `Thanh toán` / `Lớp học`) renders the
panel with its own `<FilterColumn>` set; chip-button pills hug content;
hồ-sơ / biên-lai columns use circular ✓/! icon pills.

`<DateRangeField>` inside the panel uses `<DateFieldNullable>` —
typeable `dd/mm/yyyy` text + Monday-start mini-calendar popup. Calendar
opens **right-aligned** so it expands into the left whitespace and
doesn't clip off-screen. Default range is `01/01/2010 → today`.

### KPI cards — liquid-glass hover

`KpiBig` in `screen-dashboard.jsx` + `screen-payments.jsx`:

- Base: BranchCard pattern — `var(--glass-2)` + accent diagonal gradient
  wash + accent halo on hover.
- Pointer-tracked metaball field (4 drifting white orbs + 1 accent orb
  following the cursor), `mix-blend: screen + blur 28px`, **lerped at
  6%/frame** so the highlight trails behind quick movements.
- Hover scale `1.012` only (outward; no Y translate), transitions
  `360ms / 320ms` — slow, calm.

`ClassCard` uses a stripped-down version: no orbs, no chromatic
dispersion, just scale `1.010` + branch-tone glow ring.

### `*:focus-visible` ring

CSS global focus ring uses `border-radius: inherit` so the cyan halo
traces each element's own radius (was hard-coded to `var(--r-sm)` which
caused visible mismatch on rounded inputs/pills). The `Input` atom also
moves its focus styling to the **wrapper** (`onFocus`/`onBlur` setting
border-color + `box-shadow: 0 0 14px haze`), and the inner `<input>`
explicitly sets `boxShadow: "none"` to suppress the global ring there.

### Section info-tooltips

Section headers in the dashboard use a glowing cyan `?` chip
(`InfoTooltip` in `screen-dashboard.jsx`) — hover reveals a popover
with the section explanation. Replaces inline section subtitles.

### Expandable charts

`SectionTong` and `SectionBienDong` host their two charts via
`<ExpandableChartGrid>` — clicking either small card promotes it to
full-width via `gridColumn: "1 / -1"`; cursor is `zoom-in / zoom-out`;
text-bearing children (h3, span, etc.) are excluded so users can still
highlight + copy values.

### Sidebar deck-pull animation

Sidebar wrapper is `position: sticky`, the inner `<aside>` is the deck
card itself with `translate3d / will-change / backface-visibility` for
GPU promotion. Collapse animates a 460ms cubic-bezier "deck pull" — the
card flies off the left edge with a slight scale-up while it leaves.
Edge toggle is a flush-left strip (no left gap), full screen height.

### Theme toggle moved into sidebar

`<ThemeToggle>` lives just above the user pill in the sidebar (not in
TopBar). Clicking the user pill opens a portaled logout `<Modal>`.

---

## Conventions / housekeeping notes

- **Copy**: no subtitle that restates the title. No `VD:` prefix in
  placeholders (write the example value directly).
- **Fonts**: three families with explicit roles — `--font-display`
  (headings, hero numbers), `--font-ui` (body, buttons, value text),
  `--font-mono` (numbers, codes, eyebrows, timestamps).
- **Eyebrows** (uppercase mono labels): `fontSize: 10, letterSpacing:
  0.16em` for card/section eyebrows; `fontSize: 9, letterSpacing:
  0.14em` for tight micro-labels (table column headers, MetaCell).
- **Section title (h3)** sizes are intentionally context-driven (modal
  inline `16`; card section `18`; card hero `20`; detail hero h2 `28`).
  Don't normalize aggressively.

---

## Files changed across v3 — quick map

| File | Major v3 changes |
|---|---|
| `frontend/colors_and_type.css` | Light-mode neon re-tuning; `:focus-visible` border-radius → `inherit` |
| `frontend/shell.jsx` | `<ThemeProvider>` + Context-based `useTheme`; portaled Modal; sidebar deck-pull animation; theme toggle relocated; logout modal; `<VehicleModeToggle>` + `useVehicleMode` (2-wheel / 4-wheel pill, UI-only, persisted to `localStorage("mgt-mode")`) |
| `frontend/app.jsx` | Theme provider wrap; `<AppRoot>` extracted; back-link routing with `detail.from` |
| `frontend/atoms.jsx` | `GlassCard` padding-tier comment; Input wrapper focus state |
| `frontend/list-tools.jsx` | `<FloatingFilterPanel>`, `<FilterColumn>`, `<ChipButton>`, `<DateRangeField>` + nullable calendar, paginator, ListToolbar |
| `frontend/data-loader.js` | Mock clock set to **30/05/2026 15:00**; `MGT_DATA.NOW` (Date) exposed; `firstRecordMs()` helper for "Toàn bộ các năm" preset |
| `frontend/screen-dashboard.jsx` | `<ThemeProvider>`-aware branch tones; `useBranchTones` hook; **theme-aware chart palette (`useChartColors`)**; expandable chart grid (paired transform + clip-path); **`BranchMetricsRow` click-to-expand (bars ↔ enlarged numbers, semantic colors)**; KPI liquid-glass hover; InfoTooltip; **dynamic time-frame presets computed from `_NOW`** |
| `frontend/screen-students.jsx` | `FloatingFilterPanel` integration; `RowField` profile layout; inline payment-detail fly-in card |
| `frontend/screen-payments.jsx` | Same filter pattern; KPI liquid-glass hover; per-payment row → routes to student's Thanh toán tab |
| `frontend/screen-classes.jsx` | Same filter; ClassCard branch-tone glow + hover; ClassEdit status pills; **ClassDetail branch name moved from eyebrow into the meta line, tone-colored** |
| `frontend/screen-org.jsx` | `<RecordCreatorModal>`; multipill field type; branch-tones hook |
| `frontend/modals.jsx` | AddStudent rebuilt to mirror profile detail layout; StudentSearchPicker; Modal `footerStart` slot |

---

## v3 — newer patterns layered on top

### Theme-aware chart palette

`screen-dashboard.jsx` defines two parallel hex maps —
`CHART_COLORS_DARK` and `CHART_COLORS_LIGHT` — for the SVG line series
(`cyan / lime / pink / violet / amber`). Light-mode hex mirrors the
re-tuned `--neon-*` light values from `colors_and_type.css`. Hook
`useChartColors()` subscribes to `useTheme()` and returns the right
map; both chart components (`CumChart`, `BienDongChart`) read
`const cc = useChartColors()` once and pass concrete hex into the
LineChart's `stroke` attributes (CSS vars don't work in SVG attributes,
hence the duplicate map).

### Dynamic time-frame presets

`presetsForGrain(grain)` in `screen-dashboard.jsx` builds the
"Chọn khung" row 1 dynamically from `window.MGT_DATA._NOW`. Each
preset's `getFrame()` computes its bucket count from the live clock,
so "Hôm qua đến nay" at 15:00 returns `{ count: 40, mode: "rolling" }`
and renders exactly yesterday 00:00 → today 15:59 — never lies. The
chart heading reads `data.length` (not the preset's requested count),
so it always matches the actual node count drawn.

The mock clock is set in `data.js`:
- `TODAY_STR = "30/05/2026"` · `NOW = new Date(2026, 4, 30, 15, 0, 0)`
- To shift "today" globally, update those two **and** the `TODAY`
  strings in `screen-dashboard.jsx`, `screen-payments.jsx`,
  `screen-students.jsx` (each filters by their own copy).

### Hiệu suất — click-to-expand row form

`BranchMetricsRow` (Theo chi nhánh view) accepts `{ expanded, onToggle }`
and swaps its 5-column bars layout for an enlarged-number layout. Each
cell uses `minHeight: 60` + `space-between` so card height is
**identical** between the two states (the bars row height is the
source of truth). Numbers use semantic metric colors (revenue green,
outstanding red, students cyan, both rates white) not the branch tone.
A single `bigNumbers: bool` state in `SectionHieuSuat` flips all three
rows together.

`TrieuValue` gained a `mono` flag: passes `currentColor` to all three
spans (integer, decimal, "triệu" unit) instead of the default
dim-decimal treatment, so the whole number reads as one solid hue when
it sits inside a semantically colored container.

### ExpandableChartGrid v3 — choreographed swap

Single bool `expanded` shared by both cards. Clicking either's
`ChartHitbox` (a top-right transparent zoom-affordance, sized
`min(50%, 240px) × 80px`) toggles the section's layout AND triggers
four position-aware keyframes simultaneously:

- **expand-left**: `clip-path inset(0 50% 0 0) → 0` — left card reveals
  rightward, no scaling, content stays at natural size.
- **expand-right**: `translate(50%, -100%) + clip-path inset(0 50% 0 0) → 0`
  — right card slides down-left from its old top-row col-2 slot.
- **collapse-left**: paired **outer scale(2, 1.2) → 1** + **inner inverse
  scale(0.5, 0.833) → 1** so the card outline retracts inward from
  right + bottom edges while text stays at natural pixel size (FLIP-
  style box-vs-content decoupling).
- **collapse-right**: `translate(-100%, 100%) → 0` — slides up-right
  back to col 2.

All four run 420ms `cubic-bezier(0.4, 0, 0.2, 1)`. The
`useExpansionAnim` hook returns `{ ref, contentRef }` — chart cards
must wire **both** refs (outer + inner content wrapper) for the
collapse-left FLIP to work; the other three states leave the inner
wrapper untransformed.

### ClassDetail header — branch in meta line

The old `Chi nhánh {name}` eyebrow was removed. Branch name now sits
as the first chip in the meta row (`{branch} · Ngày mở · Ngày thi · Sĩ số`)
colored with `useBranchTone(cls.branchId)`. Always reactive to theme.

### Vehicle-mode toggle

`<VehicleModeToggle>` (2-wheel / 4-wheel) sits snug next to
`<ThemeToggle>` in the sidebar. Visual + persistence only — writes
`data-mode` to `<html>` and `mgt-mode` to localStorage. Theme-aware
knob: cyan-violet gradient in dark, amber-orange in light. Same firm
`cubic-bezier(0.65, 0, 0.35, 1)` 180ms slide as the theme toggle.
