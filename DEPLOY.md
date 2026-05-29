# DEPLOY.md — MOTOGIATHINH / CENTERSAI CRM on a VPS

Single-process Node.js app: REST API + static webapp served on the same port.
SQLite persistence (one file). HTTPS via nginx reverse proxy.

Tested with: Node.js 22 LTS / 24, Ubuntu 22.04+ / Debian 12+.

---

## 1. Prerequisites

- **Node.js ≥ 22** (for built-in `node:sqlite`). Recommended: NodeSource LTS.
- **nginx** with TLS (Let's Encrypt via certbot).
- **systemd** (standard on the above distros).

```bash
# NodeSource (Ubuntu/Debian)
curl -fsSL https://deb.nodesource.com/setup_22.x | sudo -E bash -
sudo apt-get install -y nodejs nginx certbot python3-certbot-nginx
```

Verify:
```bash
node --version   # should be v22+ (24 works)
nginx -v
```

---

## 2. Get the code

```bash
sudo useradd --system --create-home --shell /usr/sbin/nologin mgt
sudo -u mgt -H bash -c '
  cd ~ &&
  git clone https://github.com/<owner>/<repo>.git app &&
  cd app/backend &&
  npm ci --omit=dev
'
```

If the user account that owns the repo also runs the service, skip the
`useradd` step.

---

## 3. Configure environment

```bash
sudo -u mgt cp /home/mgt/app/backend/.env.example /home/mgt/app/backend/.env
sudo -u mgt nano /home/mgt/app/backend/.env
```

Set at minimum:

```ini
NODE_ENV=production
PORT=3001
JWT_SECRET=<paste output of: node -e "console.log(require('crypto').randomBytes(48).toString('base64url'))">
SEED_ADMIN_EMAIL=admin@yourorg.example
SEED_ADMIN_PASSWORD=<one-time strong password — change at first login>
DB_PATH=/home/mgt/app/backend/data/motogiathinh.db
```

The app **refuses to start in production without `JWT_SECRET`**.

---

## 4. Seed the database

One-time. After this, `data/motogiathinh.db` is the source of truth — back
that file up.

```bash
cd /home/mgt/app/backend
sudo -u mgt -H bash -c 'cd /home/mgt/app/backend && node seed/seed-from-csv.js'
```

Re-running is idempotent (skips if DB has rows). Use `--reset` to wipe + re-seed.

---

## 5. systemd unit

`/etc/systemd/system/motogiathinh.service`:

```ini
[Unit]
Description=MOTOGIATHINH CRM
After=network.target

[Service]
Type=simple
User=mgt
WorkingDirectory=/home/mgt/app/backend
EnvironmentFile=/home/mgt/app/backend/.env
ExecStart=/usr/bin/node server.js
Restart=on-failure
RestartSec=3s
NoNewPrivileges=true
ProtectSystem=strict
ReadWritePaths=/home/mgt/app/backend/data
ProtectHome=read-only
PrivateTmp=true

[Install]
WantedBy=multi-user.target
```

Enable + start:

```bash
sudo systemctl daemon-reload
sudo systemctl enable --now motogiathinh
sudo systemctl status motogiathinh
journalctl -u motogiathinh -f         # follow logs
```

Smoke check (still loopback only at this point):

```bash
curl -s http://127.0.0.1:3001/api/health
```

---

## 6. nginx reverse proxy + HTTPS

`/etc/nginx/sites-available/motogiathinh.conf`:

```nginx
server {
    listen 80;
    listen [::]:80;
    server_name crm.yourorg.example;
    location / { return 301 https://$host$request_uri; }
}

server {
    listen 443 ssl http2;
    listen [::]:443 ssl http2;
    server_name crm.yourorg.example;

    # filled in by certbot below
    ssl_certificate     /etc/letsencrypt/live/crm.yourorg.example/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/crm.yourorg.example/privkey.pem;
    include /etc/letsencrypt/options-ssl-nginx.conf;
    ssl_dhparam         /etc/letsencrypt/ssl-dhparams.pem;

    # Static assets cached aggressively; HTML kept fresh.
    location ~* \.(otf|woff2?|svg|png|jpg|css|js|jsx)$ {
        proxy_pass http://127.0.0.1:3001;
        expires 7d;
        add_header Cache-Control "public, max-age=604800, immutable";
    }

    location / {
        proxy_pass http://127.0.0.1:3001;
        proxy_set_header Host              $host;
        proxy_set_header X-Real-IP         $remote_addr;
        proxy_set_header X-Forwarded-For   $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_read_timeout 60s;
    }

    client_max_body_size 8m;       # raises ceiling for future doc / receipt uploads
}
```

Enable + reload:

```bash
sudo ln -s /etc/nginx/sites-available/motogiathinh.conf /etc/nginx/sites-enabled/
sudo nginx -t && sudo systemctl reload nginx
sudo certbot --nginx -d crm.yourorg.example     # provisions TLS, edits the above
```

Open `https://crm.yourorg.example/` → login screen → enter the seeded admin
credentials → CRM loads.

---

## 7. First-login checklist

1. Log in with `SEED_ADMIN_EMAIL` / `SEED_ADMIN_PASSWORD`.
2. Change the admin password (Tổ chức tab → admin account → edit — or
   `POST /api/auth/password` with `currentPassword + newPassword`).
3. Create real staff accounts (Tổ chức → Tài khoản → Thêm tài khoản).
4. Disable any seeded demo accounts you don't need (`active = false`).
5. Begin importing real students / payments.

---

## 8. Backups

The entire dataset is one SQLite file. Back it up while the service runs
using the online backup API (safe — does not block writers):

```bash
# /usr/local/bin/mgt-backup
#!/usr/bin/env bash
set -euo pipefail
DST=/var/backups/mgt/$(date +%Y%m%d-%H%M%S).db
mkdir -p "$(dirname "$DST")"
sqlite3 /home/mgt/app/backend/data/motogiathinh.db ".backup '$DST'"
gzip -f "$DST"
# Keep last 30 days
find /var/backups/mgt -name '*.db.gz' -mtime +30 -delete
```

Cron:

```cron
# /etc/cron.d/mgt-backup
0 2 * * *   root   /usr/local/bin/mgt-backup
```

`apt install sqlite3` if `sqlite3` is missing.

---

## 9. Upgrades

```bash
sudo -u mgt -H bash -c 'cd /home/mgt/app && git fetch && git checkout <tag-or-sha>'
sudo -u mgt -H bash -c 'cd /home/mgt/app/backend && npm ci --omit=dev'
sudo systemctl restart motogiathinh
```

Schema migrations: `migrations/001_init.sql` uses `CREATE TABLE IF NOT EXISTS`,
so re-running on an existing DB is a no-op. Add new `00N_*.sql` files for
future changes and extend `db.js` to apply them in order.

---

## 10. Monitoring

- **Liveness:** `GET /api/health` returns `{ ok: true }`. Wire to your
  uptime monitor (UptimeRobot / Healthchecks.io / Datadog).
- **Logs:** `journalctl -u motogiathinh -f` (stdout + stderr captured).
  Rotate via `journald` defaults; no separate log file.
- **Activity:** `GET /api/activity-log` returns every recorded mutation.
  The Tổ chức → Lịch sử tab in the webapp surfaces this.

---

## 11. Security notes

- `JWT_SECRET` is the only secret in `.env` — guard the file (`chmod 600`).
- HTTPS terminated at nginx; JWT cookie is `Secure` only in `NODE_ENV=production`.
- `bcryptjs` with cost 10. Up the cost on the next major upgrade if hardware permits.
- Payments are immutable (BACKEND.md §8.5). Refunds = negative compensating
  entries; never `DELETE FROM payments`.
- No file-upload endpoint yet (BACKEND.md §10.7) — receipts/docs are
  boolean flags only. When you wire S3 / local storage, raise nginx
  `client_max_body_size` accordingly.

---

## 12. Rollback

Two failure modes, both reversible:

1. **Bad code deploy** → `git checkout <previous-sha> && systemctl restart`.
2. **Bad data state** → stop service, restore most recent `*.db.gz`:
   ```bash
   sudo systemctl stop motogiathinh
   gunzip -c /var/backups/mgt/YYYYMMDD-HHMMSS.db.gz > /home/mgt/app/backend/data/motogiathinh.db
   sudo chown mgt:mgt /home/mgt/app/backend/data/motogiathinh.db
   sudo systemctl start motogiathinh
   ```

---

## 13. Operational quick reference (polished build)

| Concern | Where it lives | How to inspect |
|---|---|---|
| API health | `GET /api/health` | `curl http://localhost:3001/api/health` |
| Request logs | stdout (`journalctl -u motogiathinh -f`) | `[req] METHOD path status ms userId` per request |
| Notifications auto-recompute | `backend/notifications.js`, fires every 5min + after each write | Watch logs for `[notifications] recompute: +X ~Y -Z` |
| File uploads | `backend/data/uploads/{students,payments}/<id>/<key>-<ts>.<ext>` | Listed dir; URL form `/api/files/<kind>/<id>/<file>` |
| Login rate-limit state | In-memory map, resets on restart | After 5 wrong tries an email gets 429 for 15min |
| Tests | `cd backend && npm test` | Built-in `node:test` — 27 cases (~535ms) |
| Smoke / E2E | `npm run smoke` / `npm run e2e` | Smoke = pure HTTP. E2E = headless Chromium walking all 6 screens |
| DB backup | `sqlite3 data/motogiathinh.db ".backup ./bk.db"` while service runs | One file. Compress + offsite. |

### Endpoint surface (post-polish)

Reads (auth required):
- `GET /api/{branches,accounts,classes,students,payments,fee-plans,promotions,teachers,vehicles,notifications,activity-log}`
- `GET /api/constants/profile-docs` · `GET /api/now`
- `GET /api/me` · `GET /api/files/<kind>/<recId>/<filename>` (branch-scoped)

Writes:
- `POST /api/auth/login` (rate-limited) · `/auth/logout` · `/auth/password`
- `POST /api/students` (any role, branch-scoped) · `PATCH /api/students/:id`
- `POST /api/students/:id/docs/:key` (multipart, ≤8MB)
- `POST /api/payments` (any role, immutable) · `POST /api/payments/:id/bien-lai`
- `POST /api/classes` · `PATCH /api/classes/:id` (admin only)
- `POST + PATCH /api/{accounts,fee-plans,promotions,teachers,vehicles}` (admin)
- `POST /api/accounts/:id/reset-password` (admin)
- `PATCH /api/notifications/:id` · `DELETE /api/notifications/:id`

### Per-table indexes (already in migrations)

```
students:  (branchId), (classId), (createdAt)
payments:  (studentId), (branchId), (createdAt)
classes:   (branchId), (code)
notifs:    (read)
activity:  (at)
```

---

## 14. Known frontend-integration deviations

The signed-off frontend (under `webapp/`) shipped with empty callbacks on
every "save / create / update / delete" modal — clearly integration seams
left for the backend phase. The integration wired them as follows. **No
visual or UX change** anywhere; only persistence plumbing was filled in.

| File | Site | Before | After |
|---|---|---|---|
| `app.jsx` | `AddStudentModal onSave` | `() => {}` | `D.api.createStudent(payload)` |
| `app.jsx` | `AddPaymentModal onSave` | `() => {}` | `D.api.createPayment(payload)` |
| `app.jsx` | `AddClassModal onSave` | `() => {}` | `D.api.createClass(payload)` |
| `app.jsx` | `AppRoot` body | — | `useReducer` + `window.addEventListener('mgt:datachanged')` for re-render after writes |
| `shell.jsx` | Logout modal `primaryAction` | only `setLogoutOpen(false)` | also `D.api.logout()` |
| `screen-classes.jsx` | `ClassEditModal onSaveStatus` | `setStatus` (local only) | also `D.api.updateClass(cls.id, {statusOverride})` |
| `screen-org.jsx` × 5 | `RecordCreatorModal` callers | no `onCreate` prop | `onCreate={D.api.createAccount / createFeePlan / createPromotion / createTeacher / createVehicle}` |
| `screen-notifs.jsx` | `markAllRead` / `deleteSelected` | local-only `setItems` | also `D.api.markNotificationRead` / `deleteNotification` per row |

### New admin tooling landed in polish sessions

These were not in the original frozen package but were added to support
admin workflows the customer asked for. They follow the existing atom
visual idiom (GlassCard, Chip, Modal, Input, MultiPill) and do not
change any signed-off colors / fonts / layout.

| Component | File | Purpose |
|---|---|---|
| `MoreMenu` | `webapp/screen-org.jsx` | `···` row-action popover (Sửa / Vô hiệu hoá / Đặt lại mật khẩu / Xóa). Portal-rendered, click-outside-to-close, scroll-anchored. |
| `EditRecordModal` | `webapp/screen-org.jsx` | Shared edit dialog seeded from `initialValues`; same field schema as `RecordCreatorModal`. Used by every "Sửa" action in Tổ chức. |
| `PasswordResetModal` | `webapp/screen-org.jsx` | Admin row action on accounts; calls `POST /api/accounts/:id/reset-password`. Masked input + inline error. |
| `DocLightbox` | `webapp/atoms.jsx` | Inline viewer for uploaded student docs (image or PDF). Portal overlay, Escape-to-close, sandboxed iframe for PDFs. |
| `BienLaiPreview` drag-drop | `webapp/modals.jsx` | The "Ảnh biên lai (tuỳ chọn)" slot in AddPaymentModal accepts drag-drop + click-to-pick and uploads to `/payments/:id/bien-lai` after save. |
| Branches CRUD UI | `webapp/screen-org.jsx` `BranchesTab` | Admin can `+ Thêm chi nhánh` / Sửa / Xóa. DELETE is FK-protected on the server (409 `branch_in_use`). |
| `ScreenErrorBoundary` | `webapp/app.jsx` | Per-screen wrapper so one broken screen doesn't blank the whole app. |
| `MGT_TOAST` | `webapp/data-loader.js` | Vanilla bottom-right toast helper for soft-failure notices (replaces inline `alert()` in plumbing). |

Per `webapp/CLAUDE.md`, the spirit of "frozen" is visual/UX preservation;
the empty callbacks were never meant to ship and the admin tooling above
fills bona-fide product gaps. The verification checklist in
`webapp/CLAUDE.md` plus `backend/seed/e2e-browser.js` (75 sweep checks
covering write-flow round-trips and these admin actions) confirms zero
visual regression.

One field-shape compat fix lives in `data-loader.js`:
- Backend returns `notifications[i].message`, frontend reads
  `notifications[i].detail` → data-loader aliases `n.detail = n.message`
  at boot, per the contract's "transform inside data-loader to match" allowance.
