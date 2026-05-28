# CLAUDE.md — repo-level orientation for AI agents

> **You are an AI agent landing in this repo.**
> Read this file first, then route yourself to the right sub-doc.

This project is the **MOTOGIATHINH / CENTERSAI** CRM — a driving-school
operations dashboard. Visual + UX has been signed off; the next phase
is wiring it to a real backend.

---

## Where to go based on what you're here to do

| Your job | Read first | Then |
|---|---|---|
| **Build / integrate a backend** | [`BACKEND.md`](BACKEND.md) — canonical schema, derived-field rules, endpoint map, invariants, auth model | Apply the integration plan from `BACKEND.md §11`. The frontend swap-in is `frontend/data-loader.js`. |
| **Wire frontend → backend** | [`frontend/CLAUDE.md`](frontend/CLAUDE.md) — frozen vs. editable contract, exact `window.MGT_DATA` shape, 10-step verification checklist | Edit **only** `frontend/data-loader.js`. Run the verification checklist before shipping. |
| **Change product behaviour** | [`SPEC.md`](SPEC.md) §3 — the LOCKED RULES (banded payment status, A/A1 only, etc) | Confirm with the product owner. SPEC overrides all other docs. |
| **Change visuals / UX** | [`HANDOFF.md`](HANDOFF.md) — UI architecture + v3 patterns + file-change map | Don't. Visuals are frozen. If you think there's a bug, stop and ask. |
| **Understand the design system** | [`README.md`](README.md) — voice, colors, type, spacing, glow tokens | `preview/*.html` cards render each token in isolation. |

---

## Repo map at a glance

```
.
├── README.md          ← brand strategy + design philosophy
├── SPEC.md            ← LOCKED product rules (authoritative)
├── HANDOFF.md         ← UI architecture + v3 decisions log
├── BACKEND.md         ← schema + endpoint contract for backend devs
├── SKILL.md           ← Claude skill descriptor
│
├── frontend/          ← THE TAKE-IT-AS-IS FRONTEND PACKAGE
│   ├── CLAUDE.md      ← strict agent contract for frontend integration
│   ├── README.md
│   ├── index.html
│   ├── colors_and_type.css
│   ├── data-loader.js ← the ONE editable file (the API seam)
│   ├── *.jsx          ← screens, atoms, shell — frozen
│   ├── fonts/         ← SF Pro Display + SF Pro Text
│   ├── assets/        ← logos
│   └── data/          ← 11 CSVs + a README that documents intent + how to swap subsets
│
└── preview/           ← design-system reference cards (HTML)
```

---

## Three non-negotiable rules

1. **The frontend visual + UX is frozen.** Any change to `frontend/*.jsx`,
   `frontend/colors_and_type.css`, or any `index.html` / CSS keyframes must be
   approved by the design owner. If you think you need to change one to make
   the backend work, the contract is wrong — fix it in `frontend/data-loader.js`
   instead.

2. **Derived fields are recomputed by the frontend**, never read from the
   wire. That means:
   - `student.paid`, `student.balance`, `student.paymentStatus`
   - `student.noPayOnRegistration`, `student.paidImmediately`
   - `class.status` (derived from `openDate` / `examDate` vs the live clock)

   Your backend can store them for query speed, but if it returns them, the
   loader will overwrite them. The single source of truth is the **payment
   event log** (`payments` table) + the class dates.

3. **Payments are immutable.** Treat the `payments` table as a ledger. To
   correct a payment, write a compensating event (negative amount). Never
   `DELETE` or `UPDATE` historical rows.

---

## Mock clock

The frontend currently runs against a mock clock pinned to
**30/05/2026 15:00**. See `frontend/CLAUDE.md "Mock clock"` for the exact
two-line swap when you wire production time.

---

## When in doubt

- Ask the human owner before changing anything frozen.
- Run `frontend/CLAUDE.md`'s 10-step verification checklist after any
  data-layer change.
- The CSVs under `frontend/data/` are a deterministic, seeded dataset — they're
  documented in `frontend/data/README.md`. Replace any subset to test
  scenarios without changing app code.
