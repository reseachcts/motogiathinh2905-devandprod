# MOTOGIATHINH — Guest App

Standalone mobile-first kiosk app for collaborators (Cộng tác viên). Wraps with Capacitor for Android distribution.

This is an extract of the guest UI that lived in the main webapp (`webapp/screen-guest.jsx`). It calls the same backend (`backend/`) via REST and is otherwise independent — no shared imports, no shared build.

## Quick start

```bash
cd guest-app
npm install
npm run dev          # → http://localhost:5173
```

The dev server talks to `http://127.0.0.1:3001` (the local backend). Edit `.env.development` to point at a LAN IP if you're testing from a phone on the same Wi-Fi.

## Build

```bash
npm run build        # → dist/, prod env (HTTPS backend)
npm run build:dev    # → dist/, dev env (LAN backend) — for APK testing
npm run preview      # → http://localhost:4173, serve dist/
```

## Folder layout

```
guest-app/
├─ index.html                Vite entry
├─ vite.config.js
├─ package.json
├─ .env.development          VITE_API_BASE=http://127.0.0.1:3001
├─ .env.production           VITE_API_BASE=https://...
├─ public/
│  └─ fonts/                 SF Pro Display + SF Pro Text
└─ src/
   ├─ main.jsx               Boot: ThemeProvider → LoginGate → App
   ├─ App.jsx                Port of webapp/screen-guest.jsx
   ├─ components.jsx         Icon, Avatar, Input, Select, Button, Modal, Theme*
   ├─ LoginGate.jsx          Handles 401: shows login form
   ├─ store.js               In-memory D.* (replaces window.MGT_DATA)
   ├─ api.js                 REST client with Bearer-token auth
   ├─ storage.js             Token storage (swap for Capacitor Preferences in Phase 5)
   ├─ formatters.js          fmtPhone, fmtCCCD, fmtDateInput, digitsOnly
   └─ styles.css             Design tokens + reset (copy of webapp's colors_and_type.css)
```

## Backend contract

This app calls a subset of the main backend API. See `../docs/API_GUEST.md` for the full spec. Auth flow:

1. POST `/api/auth/login` → `{ user, token }`
2. Token stored via `storage.set(...)`
3. Every subsequent request: `Authorization: Bearer <token>`

The backend accepts both the legacy `mgt_session` cookie and the Bearer header; this app uses Bearer exclusively so it ports cleanly to native (Capacitor) where HttpOnly cookies are awkward.

## Mobile port (Capacitor — Phase 5)

```bash
npm install @capacitor/core @capacitor/cli @capacitor/android \
            @capacitor/preferences @capacitor/camera
npx cap init "MOTOGIATHINH Cộng tác viên" vn.motogiathinh.guest
npm run build
npx cap add android
npx cap sync
npx cap open android
```

The `src/storage.js` shim becomes Capacitor Preferences and `<input type="file" capture="environment">` in `App.jsx` is replaced with `@capacitor/camera` calls. See `../docs/MOBILE_READINESS.md` for the full porting checklist.
