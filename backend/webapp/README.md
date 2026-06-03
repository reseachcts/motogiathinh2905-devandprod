# Frontend package

This is the **frozen, take-it-as-is frontend** for the MOTOGIATHINH /
CENTERSAI CRM. Drop this folder into a customer repo and it works:

```
frontend/
├── index.html               ← entry point
├── colors_and_type.css      ← design tokens
├── data-loader.js           ← THE editable seam (replaces with your API)
├── *.jsx                    ← screens, atoms, shell — frozen
├── fonts/                   ← SF Pro Display + Text
├── assets/                  ← logo + brand
└── data/                    ← CSV "database" (dev mode)
```

## Try it locally

Serve the folder with any static server, e.g.:

```bash
cd frontend
python3 -m http.server 5173
# open http://localhost:5173/
```

You'll see the live dashboard backed by `data/*.csv`.

## Wiring a real backend

Edit **only** `data-loader.js`. Replace the `loadCsv()` fetches with
HTTP calls to your API. The rest of the package stays untouched and
the UI keeps looking identical.

The full contract — including the `window.MGT_DATA` shape every screen
expects — is in [`CLAUDE.md`](./CLAUDE.md). Backend devs (human or
agent) should read that first.

For the canonical entity schemas + endpoint map, see
[`../BACKEND.md`](../BACKEND.md).

## What's frozen vs. editable

| Path | Status |
|---|---|
| `data-loader.js` | **EDITABLE** — swap fetches, keep `window.MGT_DATA` shape |
| `data/*.csv` | dev fixtures — replace with API responses in production |
| `index.html`, `*.jsx`, `*.css`, `fonts/`, `assets/` | **FROZEN** — design + UX has been signed off |

If you think a frozen file needs changing, stop and ask the design
owner. Don't edit silently.
