# MOTOGIATHINH — Guest App

Standalone mobile-first kiosk app for collaborators (Cộng tác viên). Wraps with Capacitor for Android distribution. Calls the same backend (`../backend/`) via REST.

This is an extract of the guest UI that lived in the main webapp (`webapp/screen-guest.jsx`). Independent build, no shared imports.

---

## Quick start (web)

```bash
cd guest-app
npm install
npm run dev          # → http://localhost:5173, talks to localhost:3001
```

Login as one of the seeded guests:
- `viet@motogiathinh.centersai` / `viet`
- `tuan@motogiathinh.centersai` / `tuan`
- `thaianh@motogiathinh.centersai` / `thaianh`
- `tannhan@motogiathinh.centersai` / `tannhan`

## Quick start (Android — debug build)

Prereqs: **Android Studio** + JDK 17 (Capacitor 8 ships with AGP 8.x). Install from <https://developer.android.com/studio>.

```bash
# 1. Sync the latest web bundle into the android shell
npm run android:sync           # dev backend (LAN/localhost)
# OR
npm run android:sync:prod      # prod backend (HTTPS)

# 2. Open Android Studio
npm run android:open
# → Studio opens the android/ folder. Wait for Gradle sync, then:
#   Run → Run 'app' (Shift+F10), pick a device/emulator.
```

The debug APK is signed with Android's debug keystore — install via USB / `adb install android/app/build/outputs/apk/debug/app-debug.apk` once Gradle builds it.

For a release APK or AAB → see "Release signing" below.

## Folder layout

```
guest-app/
├─ index.html                Vite entry
├─ vite.config.js
├─ capacitor.config.json     appId, appName, webDir, plugin labels
├─ package.json
├─ .env.development          VITE_API_BASE=http://127.0.0.1:3001
├─ .env.production           VITE_API_BASE=https://api.<host>
├─ public/
│  └─ fonts/                 SF Pro Display + SF Pro Text (otf)
├─ src/
│  ├─ main.jsx               Boot: ThemeProvider → LoginGate → App
│  ├─ App.jsx                Port of webapp/screen-guest.jsx
│  ├─ components.jsx         Icon, Avatar, Input, Select, Button, Modal, Theme*
│  ├─ LoginGate.jsx          Handles 401: shows login form
│  ├─ store.js               In-memory D.* (replaces window.MGT_DATA)
│  ├─ api.js                 REST client with Bearer-token auth
│  ├─ storage.js             Token storage — Capacitor Preferences on native, localStorage on web
│  ├─ pickPhoto.js           Photo picker entry point (lazy native resolve)
│  ├─ pickPhoto.native.js    Capacitor Camera implementation (active on native)
│  ├─ formatters.js          fmtPhone, fmtCCCD, fmtDateInput, digitsOnly
│  └─ styles.css             Design tokens + reset
└─ android/                  Capacitor-generated Android Studio project
   ├─ app/src/main/
   │  ├─ AndroidManifest.xml             Permissions: INTERNET, CAMERA, READ_MEDIA_IMAGES
   │  ├─ assets/public/                  Synced from dist/ on every cap sync
   │  ├─ assets/capacitor.config.json    Synced from capacitor.config.json
   │  └─ res/xml/network_security_config.xml   Allows cleartext for LAN debug; HTTPS-only otherwise
   ├─ build.gradle / settings.gradle / variables.gradle
   └─ gradlew / gradlew.bat
```

## Backend contract

Calls a subset of the main backend API. Full spec: `../docs/API_GUEST.md`. Auth flow:

1. POST `/api/auth/login` → `{ user, token }`
2. Token stored via `storage.set(...)` (Capacitor Preferences on native, localStorage on web)
3. Every subsequent request: `Authorization: Bearer <token>`

The backend accepts both the `mgt_session` HttpOnly cookie and the Bearer header (`backend/auth.js`); this app uses Bearer exclusively so the native port is clean.

## Photo capture

The four photo slots (CCCD front, CCCD back, CCCD QR, portrait 3×4) all use the same `pickPhoto({ source: 'prompt' })` helper:

- **Native (Capacitor)** — surfaces the OS action sheet with localised labels (`Chụp ảnh mới` / `Chọn từ thư viện`), backed by `@capacitor/camera`.
- **Web (Vite dev)** — synthesises a hidden `<input type="file" accept="image/*">` and lets the browser's native picker do its thing.

The CCCD QR slot additionally gates submission on a successful `/api/ocr/cccd-qr` scan; see the `runQr` flow in `App.jsx`.

## Release signing

```bash
# 1. Generate a keystore (one-time, keep this file safe + back it up)
keytool -genkey -v -keystore release.keystore -alias guest-key \
        -keyalg RSA -keysize 2048 -validity 10000

# 2. Add signing config to android/app/build.gradle in the `android {}` block:
#
#    signingConfigs {
#      release {
#        storeFile file("../../release.keystore")
#        storePassword System.getenv("MGT_KEYSTORE_PASSWORD")
#        keyAlias "guest-key"
#        keyPassword System.getenv("MGT_KEY_PASSWORD")
#      }
#    }
#    buildTypes {
#      release {
#        signingConfig signingConfigs.release
#        minifyEnabled false
#      }
#    }

# 3. Build the signed APK
npm run android:sync:prod
cd android && ./gradlew assembleRelease
# → android/app/build/outputs/apk/release/app-release.apk

# Or AAB for Play Store
cd android && ./gradlew bundleRelease
# → android/app/build/outputs/bundle/release/app-release.aab
```

Never commit `release.keystore` or the passwords. Add to `.gitignore`.

## Common tasks

```bash
# Add a new Capacitor plugin
npm install @capacitor/<plugin>
npx cap sync android

# Change the Android app id (only at scaffold time)
# - capacitor.config.json → "appId"
# - android/app/build.gradle → applicationId
# - android/app/src/main/res/values/strings.xml → package_name

# Change the app icon
# Place a 1024×1024 PNG in resources/icon.png then:
npm install --save-dev @capacitor/assets
npx capacitor-assets generate --android

# Force-reset the android shell (rare)
rm -rf android/ && npx cap add android && npx cap sync android
```

## Phase status

- ✅ Phase 1+2 — Standalone Vite bundle, lean store + API client
- ✅ Phase 3   — Bearer-token auth, no more page reload on logout
- ✅ Phase 4   — `pickPhoto()` seam (web + native paths)
- ✅ Phase 5   — Capacitor + Android shell, Camera + Preferences plugins
- 🔧 Phase 6   — Release signing (template above; needs your keystore)
