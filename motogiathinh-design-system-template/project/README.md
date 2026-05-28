# MOTOGIATHINH Design System

A simple-but-beautiful CRM for motorcycle/driver-training schools.
Keep records of student drivers, schedule lessons, and track cashflow with the
confidence of a fintech dashboard.

> *"Mô tô Gia Thịnh"* — a Vietnamese name. The product is bilingual-ready (UI in
> Vietnamese or English) and the system has been tuned for VN diacritic rendering.

## Sources

This design system was built from a brand brief only — **no codebase, no Figma,
no existing artifacts were provided**. The visual direction was synthesised from
these keywords:

- *Glassmorphism · neon · clean · interactive UX · strong confidence · working with data and numbers*

If the user has existing materials (logo files, Figma board, brand guidelines,
codebase), they should be attached so this system can be tightened against them.

---

## Index

| Path | What's inside |
|---|---|
| `README.md` | This file — strategy, content + visual foundations, iconography. |
| `SPEC.md` | LOCKED product rules — §3 is authoritative. |
| `HANDOFF.md` | UI architecture + v3 patterns (theme system, chart palette, expansion choreography, file-change map). |
| `BACKEND.md` | Canonical schema for every entity, derived-field formulas, suggested REST endpoints, invariants, auth model. **Backend devs read this first.** |
| `SKILL.md` | Cross-compatible skill descriptor for Claude Code. |
| `preview/` | Design-system card HTML files (rendered in the Design System tab). |
| `frontend/` | **The take-it-as-is frontend package.** Self-contained: HTML, CSS, JSX, fonts, assets, CSV "database", and `data-loader.js` (the one editable seam). See [`frontend/CLAUDE.md`](frontend/CLAUDE.md) for the integration contract. |

### For developers

- Start at [`frontend/CLAUDE.md`](frontend/CLAUDE.md) — what is frozen, what is
  editable, and the `window.MGT_DATA` contract.
- Schema + endpoint map: [`BACKEND.md`](BACKEND.md).
- UI patterns + decisions: [`HANDOFF.md`](HANDOFF.md).
- Product rules that override all other docs: [`SPEC.md`](SPEC.md).

---

## Product context

**MOTOGIATHINH** is an internal-facing CRM used by **driving-school operators**
(owner + instructors + receptionist). It is *not* end-user-facing for students.

Core jobs:

1. **Student roster** — add new students; track licence class (**A** or **A1**
   only — see SPEC §3), document collection, lesson hours logged, test
   attempts, pass/fail.
2. **Schedule** — assign instructors and bikes/cars to lesson slots.
3. **Cashflow** — record tuition payments (often in instalments, often cash),
   recurring overheads (fuel, vehicle maintenance, instructor commissions),
   and see the bottom line at a glance.
4. **Reports** — daily / weekly / monthly performance, instructor breakdowns,
   class-type breakdowns.

The product is designed for **operators looking at a screen all day** — so the
dark glass aesthetic is comfortable, and the neon accents do the work of
drawing the eye to *the number that matters right now*.

---

## Content fundamentals

### Voice

- **Operator-grade, calm, confident.** This product handles real money, and the
  copy reflects that. No exclamation marks, no over-promises, no "Awesome!"
- **Direct, second-person.** "Add a student", "You collected ₫4.2M today",
  "3 lessons need a reschedule" — not "Let's add some students!" or "We've
  noticed…".
- **Number-forward.** When a number exists, lead with it. Headings often *are*
  the number; the label is the subhead.
- **Vietnamese-first phrasing in product copy.** The CRM lives in Vietnamese,
  with English as a secondary locale. Strings should be authored in both.

### Tone examples

| ✅ Use | 🚫 Avoid |
|---|---|
| **₫4.240.000** collected today | 💰 Today's earnings are looking great! |
| 3 students owe a balance | Don't forget — 3 students still need to pay! |
| Lesson · 14:00 · Trần Văn A | Hey, your 2pm lesson with Trần Văn A is coming up 🚗 |
| New student | + Add a new student profile to get started |
| Cash · ₫1.500.000 | Wow, a cash payment of 1,500,000 VND |
| **+12.4%** vs last week | You're up 12.4% — keep it going! |

### Casing

- **Sentence case** for everything UI: buttons, menu items, headings, table
  headers, empty states. ("Add student", not "Add Student".)
- **All-caps + 0.16em letter-spacing** *only* on the `.t-eyebrow` style —
  used for one-line section labels above a number ("THIS WEEK", "BALANCE").
- **Title Case** is never used.

### Numbers + currency

- VND uses the **₫** prefix with **dot thousand separators** and no decimals:
  `₫4.240.000`. USD/EUR follow standard locale.
- Always use **tabular numerals** (`font-variant-numeric: tabular-nums`).
  Tokens `.t-metric`, `.t-metric-sm`, `.t-mono` apply this automatically.
- Deltas: **+12.4%** / **-3.1%** with the sign explicit, never hidden by color
  alone.

### Emoji

- **Not used in product chrome.** Never in buttons, headings, labels, tabs,
  empty states.
- **Permissible only in user-generated content** — e.g. an instructor's name
  has a sticker, or a student writes a note. The system displays them as-is.

### Words to avoid

- "Awesome", "great", "amazing", "let's", "oops", "uh oh"
- "Smart", "AI-powered", "magical" — the product is competent, not clever
- "Easy" — show, don't tell

---

## Visual foundations

### Color

The palette is **deep ink + 5 neons**.

- **Surfaces** are five steps of near-black with a slight blue cast
  (`--ink-0` through `--ink-4`). The canvas is `--ink-1`. Cards are glass
  panels — *not* a lighter ink fill — so they always sit on top of a hint of
  the gradient mesh beneath.
- **Neons** are saturated, slightly off-pure: cyan `#00E5FF`, lime `#B6FF3C`,
  pink `#FF3D8A`, amber `#FFB020`, violet `#8B6CFF`. Each ships with a `-glow`
  rgba (50–55% alpha) for shadows and a `-haze` (10–12% alpha) for haloed
  surfaces.
- **Semantic mapping:** cyan = action / focus / primary, lime = income /
  positive, pink = expense / danger, amber = pending / warning, violet =
  scheduling / informational.

Neons are loud — use **one at a time per surface**. A card with both a lime
delta and a cyan CTA is fine; a card with lime + pink + amber + violet badges
is noise.

### Type

- **Display:** SF Pro Display (Apple's system display font, bundled in
  `fonts/`). Used for headings, hero numbers, and any text ≥ 20pt.
- **UI/body:** SF Pro Text — optical-size sibling of Display, tuned
  for 13–15px. Vietnamese diacritics render cleanly at all weights.
- **Mono / numbers:** JetBrains Mono with `font-variant-numeric:
  tabular-nums`.

Headings get **tight tracking** (-0.025em to -0.035em). Eyebrows get **wide
tracking** (+0.16em). Body never gets letter-spaced.

The system **leans hard on big numbers**. `.t-metric` at 60px / weight 500 is
the hero treatment for any number that matters. The label sits above as an
11px uppercase mono eyebrow.

### Spacing

A **4-px base grid** (`--s-1` = 4 … `--s-10` = 80). Cards are typically
padded `--s-6` (24px). Stack rhythm inside a card is `--s-3` (12px) between
label and value, `--s-5` (20px) between groups.

### Background

The signature background is a **3-blob neon mesh** (cyan top-left, violet
top-right, pink bottom-centre) over `--ink-1`, with a **2% SVG grain overlay**
in `overlay` blend mode. Apply with `.mgt-canvas`. The mesh is never animated
— it's a calm room you work inside.

Full-bleed photography is **avoided** in product UI; if used in marketing,
it's desaturated to 30–50% and tinted toward cyan or violet to fit the room.

### Glass surfaces

Cards are `.glass` — `rgba(255,255,255,0.06)` with
`backdrop-filter: blur(24px) saturate(140%)` and a 1px
`rgba(255,255,255,0.08)` stroke. Inner highlight: `0 1px 0
rgba(255,255,255,0.06) inset`. Outer shadow: `0 12px 32px rgba(0,0,0,0.5)`.

There are **three glass tints** (`--glass-1` through `--glass-3`). Most cards
use tier 2. Modals use tier 3 over a `rgba(0,0,0,0.5)` scrim.

### Corner radii

- `--r-xs` 6px → tags, code, focus rings
- `--r-sm` 10px → inputs, segmented controls
- `--r-md` 14px → buttons
- `--r-lg` 20px → cards, panels, modals
- `--r-xl` 28px → hero / full-bleed feature blocks
- `--r-pill` 999px → chips, badges, the sidebar avatar dot

Inputs and cards **never share the same radius** — inputs are tighter (10px)
inside cards (20px) so the nest feels intentional.

### Borders & strokes

- **Hairline 1px** strokes only. No 2px borders on anything except the
  focus ring (which is a 2px box-shadow ring offset by 2px gap).
- Strokes are **either** `--glass-stroke` (subtle, default) **or** the
  semantic neon at 100%. There is no "border-light" grey scale.

### Shadow + glow

Two separate systems, never combined on the same element:

- **Outer drop shadow** (`--shadow-1/2/3`) — used to lift cards off the
  canvas. Always include the 1px inner highlight for the "lit edge" feel.
- **Neon glow** (`--glow-cyan/lime/pink`) — a 1px solid neon stroke + a
  24px radius blurred glow at 55% alpha. Reserved for **the primary CTA**
  and **focused interactive elements**. Never on body text, never on a
  static card.

### Hover / press / focus

- **Hover** on glass cards: background goes from `--glass-2` to `--glass-3`,
  stroke goes from `--glass-stroke` to `--glass-stroke-strong`, **220ms**
  ease-out. No translate, no scale.
- **Hover** on primary CTAs: glow intensity bumps from 24px to 32px,
  background brightens by ~6%, **140ms** ease-out.
- **Press** scales the button to `0.97` and damps the glow to 12px for
  **90ms** then snaps back.
- **Focus** is a **2px cyan ring** offset by 2px transparent (so it looks
  like a halo, not a stroke).
- **Disabled** drops opacity to 0.4, removes glow, removes pointer.

### Animation

- All UI transitions use `--ease-out` `cubic-bezier(0.22, 1, 0.36, 1)` —
  fast in, gentle out.
- **Standard duration: 220ms.** Fast: 140ms. Slow (modals, sheet enter):
  360ms.
- A **spring** ease is reserved for "delight" moments — a number ticking up,
  a status badge flipping to "Paid".
- Numbers **count up** when they first appear or when they change (CountUp,
  220ms, ease-out). This is the one piece of motion that's load-bearing.
- **No bounces, no parallax, no spinners that aren't tiny.** Loading is a
  shimmering glass skeleton.

### Transparency & blur usage

- Blur **only on glass surfaces** that sit over the mesh background. Don't
  blur over a solid ink color (it does nothing and burns GPU).
- Modal scrims are `rgba(0,0,0,0.5)` with `backdrop-filter: blur(8px)`.
- Tooltips are **opaque** ink, not glass — they need to be readable in any
  context.

### Layout rules

- **Sidebar nav: 240px**, fixed left, on a glass panel that runs full
  height.
- **Top bar: 64px**, fixed top, glass.
- Main content has a **max-width of 1280px** and is left-aligned (not
  centered) — the dashboard feels operational, not a marketing landing.
- Tables: 56px row height, 16px horizontal padding, hairline divider in
  `--ink-4`.

### Imagery & illustration

- No mascots. No isometric illos. No 3D rendery hero objects.
- If imagery is needed, use **abstract data visuals**: charts, sparklines,
  candle plots, motion blur of a vehicle's wheel rendered in cyan glow over
  ink. The vibe is **fintech terminal**, not **driving school clipart**.

---

## Iconography

- **System:** [Lucide](https://lucide.dev) — 24×24, **1.5px stroke**, round
  caps and joins. Linked from the unpkg CDN so the kit stays light.
- We **substitute Lucide** rather than ship a custom set; this is flagged
  as a substitution. If the user has an existing icon system, point us to
  it and we'll swap.
- **Color:** icons inherit `currentColor`. Active states get the semantic
  neon. Inactive nav icons live at `--fg-3`.
- **Size:** 18px in dense rows, 20px in nav, 24px in headers, 32px+ for
  empty-state heroes.
- **No emoji** in chrome (see Content Fundamentals).
- **No unicode glyphs as icons** (e.g. ★, →). The only allowed unicode is
  the currency mark **₫** and standard punctuation.

### How to use icons in code

```html
<!-- via CDN -->
<script src="https://unpkg.com/lucide@latest/dist/umd/lucide.min.js"></script>
<i data-lucide="user-round-plus"></i>
<script>lucide.createIcons();</script>
```

The CRM UI kit uses inline SVG copies of Lucide icons that the user has
actually placed, so the kit works offline.

---

## Substitution flags

A small set of decisions were made without source material — please review
and override if you have stronger inputs:

1. **Brand name + logo** — the wordmark `MOTOGIATHINH` is a working name.
   If you have a real wordmark file, drop it into `assets/` and the system
   will pick it up.
2. **Fonts** — Space Grotesk + Manrope + JetBrains Mono are Google Fonts
   substitutions chosen for VN-diacritic coverage and the geometric-confident
   vibe. If you have brand fonts (e.g. a licensed display face), swap them
   in via `@font-face` inside `fonts/` and update `--font-display`.
3. **Icon set** — Lucide is the placeholder. Swap to Phosphor, Tabler, or
   a custom set as needed.
4. **Locale strings** — the demo CRM ships with mixed Vietnamese + English
   labels. A real rollout would commit to a single primary locale.
