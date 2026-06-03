# Fonts

The brand fonts are **San Francisco**, Apple's system family.

| Role | Family | Weights bundled | File |
|---|---|---|---|
| `--font-display` | **SF Pro Display** | 400, 500, 600, 700, 800 | `fonts/SFProDisplay-*.otf` |
| `--font-ui` | **SF Pro Text** | 400, 500, 600, 700 | `fonts/SFProText-*.otf` |
| `--font-mono` | **JetBrains Mono** (web) | 400, 500, 600, 700 | loaded via Google Fonts |

`SF Pro Display` is used for headings and big numbers, `SF Pro Text` for
body and UI labels — matching Apple's own usage guidelines (Display for
sizes ≥ 20pt, Text for everything smaller).

## How they're loaded

`colors_and_type.css` declares them via `@font-face` pointing at the
`fonts/` folder, so the kit works fully offline:

```css
@font-face { font-family: "SF Pro Display"; src: url("fonts/SFProDisplay-Regular.otf")  format("opentype"); font-weight: 400; ... }
/* … plus Medium, Semibold, Bold, Heavy … */
```

JetBrains Mono is web-loaded for now (SF Mono wasn't supplied — if you
have it, drop the files in here and add @font-face declarations).

## License note

SF is **Apple's licensed font family**. It's typically only freely
licensed for use *inside Apple platform apps*. Confirm with your legal
that bundling SF inside a Vietnamese web CRM is OK before shipping
publicly. If not, the system's fallback chain (`Space Grotesk`,
`Manrope`, `system-ui`) is ready to take over with no code changes.

## Why SF works for this product

- Tabular numerals and SF's `cv11` / `ss01` features are perfect for a
  CRM where money and dates are everywhere.
- Display's tight tracking at large sizes gives `t-metric` (₫4.240.000)
  the right authoritative weight.
- Text's optical correction at 13–15px keeps Vietnamese diacritics
  from getting muddy.
