# MOTOGIATHINH / CENTERSAI CRM

Driving-school operations dashboard. Three branches (331A QL1A · 183 14/9 ·
18C Phạm Hùng), A & A1 motorbike licences, full Vietnamese UI.

## Layout

```
.
├── README.md                              ← you are here
├── DEPLOY.md                              ← VPS deployment guide
├── backend/                               ← Node.js + SQLite REST API + static webapp serving
│   ├── README.md                          ← backend dev notes
│   ├── server.js · db.js · auth.js
│   ├── routes/ · seed/ · migrations/
│   └── .env.example
├── webapp/                                ← frontend (frozen visual + UX, signed off)
│   ├── CLAUDE.md                          ← integration contract
│   ├── index.html · *.jsx · *.css
│   ├── data-loader.js                     ← THE editable seam → fetches /api/*
│   └── data/ · fonts/ · assets/
└── motogiathinh-design-system-template/   ← original Claude Design hand-off bundle (reference)
```

## Quick start (local)

```bash
cd backend
npm install
node seed/seed-from-csv.js
PORT=3001 node server.js
# → http://127.0.0.1:3001  (login: admin@motogiathinh.local / changeme)
```

Full deployment instructions in [DEPLOY.md](./DEPLOY.md).

## Stack

- **Backend:** Node.js 22+ (uses built-in `node:sqlite`, no native compile),
  Express 5, bcryptjs, jsonwebtoken, csv-parse. SQLite file is the entire
  database — one-file backups, zero admin.
- **Frontend:** React 18 via Babel-in-browser (no build step), bundled
  SF Pro Display/Text fonts, design tokens in `colors_and_type.css`.
- **Persistence:** SQLite WAL. Roughly 1.2k students + 1.3k payments
  fit in ~1 MB; trivial Postgres migration path documented in
  `motogiathinh-design-system-template/project/BACKEND.md` if you outgrow it.

## Contracts

- `webapp/CLAUDE.md` — what's frozen vs editable in the frontend
- `motogiathinh-design-system-template/project/BACKEND.md` — entity schemas,
  derived-field rules, endpoint map, business invariants
- `motogiathinh-design-system-template/project/SPEC.md` — locked product rules

## Known integration deviation

To make the frontend's three create-modals (AddStudent / AddPayment / AddClass)
actually persist, three `onSave={() => {}}` stubs in `webapp/app.jsx` were
wired to `MGT_DATA.api.create*(...)` methods exposed by the rewritten
`webapp/data-loader.js`. **Zero visual or UX change** — the original placeholders
were clearly integration seams; everything signed-off remains intact.
See [DEPLOY.md §13](./DEPLOY.md#13-known-frontend-integration-deviation).
