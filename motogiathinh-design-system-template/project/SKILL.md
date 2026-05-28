---
name: motogiathinh-design
description: Use this skill to generate well-branded interfaces and assets for MOTOGIATHINH — a glassmorphism + neon CRM for motorcycle / driver-training schools — either for production or for throwaway prototypes, mocks, and decks. Contains essential design guidelines, color tokens, type system, fonts, brand assets, and a click-thru UI kit for prototyping.
user-invocable: true
---

Read the `README.md` file at the root of this skill, and explore the
other available files:

- `colors_and_type.css` — single source of truth for tokens. Import this in
  any HTML artifact (`<link rel="stylesheet" href="colors_and_type.css">`)
  and the CSS variables + utility classes (`.mgt-canvas`, `.glass`,
  `.t-metric`, `.t-eyebrow`, etc.) are available immediately.
- `assets/` — logo mark + wordmark SVGs.
- `preview/` — small HTML cards that demonstrate each foundation in
  isolation. Useful as visual reference.
- `frontend/` — fully-built React click-thru of the product. Lift
  components from here (`atoms.jsx`, `shell.jsx`, `screens-*.jsx`) or
  use it as a worked example of how the system composes.
- `fonts/` — notes on font sourcing (Google Fonts: Space Grotesk +
  Manrope + JetBrains Mono).

If creating visual artifacts (slides, mocks, throwaway prototypes,
demo HTML), copy assets out and create static HTML files for the user
to view. If working on production code, copy assets and read the rules
in `README.md` to become an expert in designing with this brand —
especially the **Visual foundations**, **Content fundamentals**, and
**Iconography** sections.

If the user invokes this skill without any other guidance, ask them
what they want to build or design, ask some questions, and act as an
expert designer who outputs HTML artifacts *or* production code,
depending on the need.

## The non-negotiables

- **Dark ink + 5 neons only.** Never invent new accent hues.
- **Glass surfaces over the mesh canvas** — never solid card fills.
- **One neon per surface.** Don't pile lime + pink + amber on the same card.
- **Numbers are always tabular** (`font-variant-numeric: tabular-nums`).
- **VND uses ₫ prefix + dot thousands**, no decimals: `₫4.240.000`.
- **No emoji in chrome.** No unicode glyphs as icons. Lucide-style 1.5px
  stroke iconography only.
- **Sentence case** for all UI strings, never Title Case.
- **No bouncy animations.** Standard duration 220ms, cubic-bezier(0.22, 1, 0.36, 1).
