# backend — MOTOGIATHINH / CENTERSAI CRM

REST API + same-process static webapp serving. SQLite-backed. Single
Node process, no native dependencies (uses Node 22+ built-in `node:sqlite`).

## Run locally

```bash
cd backend
npm install
node seed/seed-from-csv.js          # one-time: import CSV fixtures
PORT=3001 node server.js
# open http://127.0.0.1:3001/  → login: admin@motogiathinh.local / changeme
```

## Layout

```
backend/
├── package.json          # express + bcryptjs + jsonwebtoken + csv-parse + cookie-parser + cors
├── server.js             # entrypoint, mounts /api/* + serves ../webapp/ statically
├── db.js                 # node:sqlite handle, schema apply, ID helpers, bool coercion
├── auth.js               # JWT cookie + bcrypt + requireAuth/requireAdmin middleware
├── routes/
│   ├── auth.js           # /api/auth/login · /api/auth/logout · /api/me · /api/auth/password
│   ├── entities.js       # GET /api/{branches,students,payments,…} bulk dumps
│   └── writes.js         # POST/PATCH /api/{students,payments,classes,…}
├── migrations/001_init.sql
├── seed/
│   ├── seed-from-csv.js  # node seed/seed-from-csv.js [--reset]
│   └── smoke-test.js     # node seed/smoke-test.js  (assumes server is up)
├── data/                 # SQLite db lives here (gitignored)
├── .env.example          # copy to .env and edit
└── .gitignore
```

## Environment

| Var | Default | Notes |
|---|---|---|
| `PORT` | 3000 | Listening port |
| `NODE_ENV` | development | Set to `production` on VPS |
| `DB_PATH` | `./data/motogiathinh.db` | SQLite file location |
| `JWT_SECRET` | dev-only | **Required in production.** Generate with `node -e "console.log(require('crypto').randomBytes(48).toString('base64url'))"` |
| `JWT_COOKIE` | `mgt_session` | Cookie name |
| `JWT_DAYS` | 14 | Session lifetime |
| `SEED_ADMIN_EMAIL` | `admin@motogiathinh.local` | Default admin email |
| `SEED_ADMIN_PASSWORD` | `changeme` | **Change immediately** after first login |
| `CORS_ORIGINS` | (empty) | Comma-separated; leave empty when API + webapp share an origin |
| `UPLOAD_DIR` | `./data/uploads` | Where multer writes uploaded files (student docs + biên lai). Must be writable by the service user. |
| `MIN_PASSWORD_LENGTH` | 10 | Min length for `POST /api/auth/password`. Lower bound is 8. |
| `LOGIN_LIMIT` | 5 | Failed-login attempts per email per `LOGIN_WINDOW_MIN`. |
| `LOGIN_WINDOW_MIN` | 15 | Sliding window for the login limiter. |
| `LOGIN_LOCKOUT_MIN` | 60 | Hard lockout duration once `2 × LOGIN_LIMIT` failures pile up. |

## Contract

Read endpoints return raw entity rows in the same shape `webapp/data-loader.js`
expects (see `frontend/CLAUDE.md` "Step 3 — keep MGT_DATA shape identical").

Derived fields are **never** returned from the wire — the frontend recomputes
`student.paid / balance / paymentStatus / noPayOnRegistration` and `class.status`
locally per the contract.

Write endpoints follow BACKEND.md §6. Each write logs to `activity_log` and
returns the fresh row so the client can patch in-memory state without a reload.

## Tests

```bash
npm test            # 27 cases (~535ms) — node:test, runs validation +
                    # auth-policy + branch-scope + notifications.
npm run smoke       # POSTs the full happy-path round-trip against a live :3001.
npm run e2e         # headless-Chromium sweep (75 cases) of every screen + write.
```

`branch-scope.test.js` and a few cases in `auth-policy.test.js` skip
gracefully when the server isn't reachable — start it with
`PORT=3001 node server.js` before `npm test` to get the full suite.
