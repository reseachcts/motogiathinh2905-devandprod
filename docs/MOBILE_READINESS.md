# MOBILE_READINESS.md — Browser-to-Native Audit (Guest UI)

Focused audit of what won't translate when the browser-embedded **guest**
experience (`webapp/screen-guest.jsx` + `webapp/data-loader.js`) is rebuilt
as a native iOS / Android app, plus suggested replacements.

> Sources: `webapp/screen-guest.jsx`, `webapp/data-loader.js`,
> `webapp/index.html`, `backend/server.js`, `backend/auth.js`.

---

## 1. Cookie auth (HttpOnly `mgt_session`)

**Current state.** JWT mounted as `Set-Cookie: mgt_session=...; HttpOnly;
SameSite=Lax; Secure(prod)`. Web client never sees the token — relies on
the browser to forward the cookie via `fetch(..., { credentials: 'include' })`
(`data-loader.js:43`).

**Why this breaks on mobile.** Native HTTP clients (URLSession / OkHttp /
Ktor) have no shared cookie jar by default; `Secure` requires HTTPS on every
call; `SameSite=Lax` is a no-op outside a browser; cookie persistence across
app restarts is non-trivial on both platforms.

**Two options.**

| Option | What changes | Trade-off |
|---|---|---|
| **A. Header token (recommended)** | Backend adds Bearer reader to `requireAuth`. Mobile stores JWT in Keychain / EncryptedSharedPreferences, sends `Authorization: Bearer <jwt>`. Cookie path stays for web. | One small backend patch. Standard mobile pattern. |
| **B. Cookie-jar wrapper** | HTTP client with built-in cookie support (`URLSession.shared.httpCookieStorage`, OkHttp `CookieJar`, Ktor `HttpCookies`). | Zero backend change. But expiry / rotation / multi-account / 401 handling are messier. |

**Patch sketch (Option A)** in `backend/auth.js → requireAuth`:

```js
const token = req.cookies?.[COOKIE_NAME]
           || (req.headers.authorization?.startsWith('Bearer ') &&
               req.headers.authorization.slice(7));
```

…and have `/api/auth/login` also return `{ user, token }` so the mobile app
can capture the JWT (currently returned only via `Set-Cookie`).

**401 handling.** `data-loader.js:49` reloads the page on any 401 except
`/api/me`. Mobile must instead navigate to login — no `window.location.reload`.

---

## 2. File picker via `<input type="file" capture="environment">`

**Current state.** `screen-guest.jsx:461-463` and `:486-488`:

```jsx
<input ref={inputRef} type="file" accept="image/*" capture="environment"
       onChange={(e) => onPick(e.target.files?.[0])}
       style={{ display: "none" }}/>
```

Hands the browser-built `File` to `FormData`, posted to
`/api/students/:id/docs/:key` or `/api/ocr/cccd-qr`.

**Native replacements:** `UIImagePickerController` / `PHPickerViewController`
(iOS), `ActivityResultContracts.TakePicture` + `GetContent` (Android), or
`expo-image-picker` / `react-native-image-picker` / Flutter `image_picker`.
Result is a local file URI, not a `File`/`Blob`.

**Multipart contract** the mobile client must produce:

| Endpoint | Field | Allowed Content-Type | Max |
|---|---|---|---|
| `POST /api/ocr/cccd-qr` | `file` | `image/jpeg` \| `png` \| `webp` | 8 MB |
| `POST /api/students/:id/docs/:key` | `file` | `image/jpeg` \| `png` \| `webp` \| `application/pdf` | 8 MB |

Server sniffs magic bytes (`uploads.js → enforceMagic`,
`ocr.js → looksLikeImage`). Mismatched mime → `415 unsupported_mime` and
the file is deleted. Don't spoof Content-Type; send real bytes.

**Capture:** ≥1280px long edge (server resizes QR to max 1600px). JPEG q85.
Strip EXIF orientation OR rely on `sharp.rotate()` (applied only by
`/api/ocr/cccd-qr` — student-doc upload does NOT auto-rotate).

---

## 3. Window-global injection points (don't exist on native)

`screen-guest.jsx` reads several `window` props that aren't present in a
native runtime. Each needs a context / store / props replacement.

| Global | File:Line | Used for | Native replacement |
|---|---|---|---|
| `window.MGT_DATA` | `screen-guest.jsx:34, 146, 309, 583, 584` | All data + API calls (`D.api.*`, `D.currentUser`, `D.students`, `D.getStudent`, `D.getClass`) | React Context (RN) / Riverpod / Bloc / Combine store; API client injected via hook |
| `window.MGT_DATA.api.*` | many | `refreshMe`, `cccdQr`, `createStudent`, `updateStudent`, `uploadStudentDoc` | Dedicated `ApiClient` module wrapping native HTTP + base URL + auth header |
| `window.MGT_TOAST` | `screen-guest.jsx:215, 219, 375, 378` | Transient confirmations / soft-failure notices | `react-native-toast-message`, or a custom snackbar |
| `window.fmtPhone` | `screen-guest.jsx:133, 259, 407` | Format phone as `xxx xxx xxxx` | Port `data-loader.js:119-124` to a util module |
| `window.useTheme` | `screen-guest.jsx:552` | `[theme, setTheme]` ("light"/"dark") | Context + `Appearance` listener; persist to `AsyncStorage` / `UserDefaults` |
| `window.useBranchTone` | (not used by guest UI; in webapp elsewhere) | — | n/a |
| `window.digitsOnly` | indirectly via `Input` atom | Strip non-digits | Port to util |
| `window.fmtVND / fmtVNDShort / fmtCCCD / fmtMoneyInput / fmtDateInput` | not in guest UI | — | Port if reused later |

Note: `window.useTheme` is defined outside the audited files; treat it as a
required injection point alongside the others.

---

## 4. URL-relative paths

**Current.** `data-loader.js:7` reads `API = (window.MGT_API_BASE || '') + '/api'`.
Same-origin works in prod because web app and API ship from the same Node
process. Other call sites use bare `/api/...`:

- `screen-guest.jsx:505` — `fetch('/api/auth/logout', { method: 'POST', credentials: 'include' })`
- `data-loader.js:528, 550, 579` — direct `fetch(API + '/...')` calls
- `student.docs_<key>_url` strings come back as `/api/files/...`

**Why it breaks.** Native apps have no implicit origin. Every relative
`/api/...` is malformed.

**Fix.** Define one `API_BASE` constant, e.g. (RN):

```js
export const API_BASE = 'https://api.crm.example.com';
// All calls: `${API_BASE}/api/students` etc.
// For dev, use 10.0.2.2:3000 on Android emulator / your LAN IP on iOS sim.
```

Also prepend `API_BASE` before loading any `docs_*_url` in `<Image>` components.

---

## 5. React-in-browser (Babel standalone + UMD React)

**Current.** `webapp/index.html:68-70` loads React, ReactDOM, and
`@babel/standalone` from a CDN, then JSX files via `<script type="text/babel">`.
JSX is compiled at runtime in the browser.

**Why it won't ship.** Babel standalone is 2+ MB and compiles on every load.
No native runtime supports `type="text/babel"`. The DOM the entry HTML uses
(`document.head/body`, `#root`, CSS keyframes) doesn't exist either.

**Fix — pick one:**

1. **React Native.** JSX in `screen-guest.jsx` ports nearly 1:1 once
   `<div>/<button>/<input>/<span>` become `<View>/<Pressable>/<TextInput>/<Text>`
   and inline `style={{...}}` is translated. RN does NOT support
   `display:"grid"`, CSS custom-properties (`var(--neon-cyan)`),
   `color-mix(...)`, or `backdrop-filter` — replace with literal hex from
   the theme.
2. **Native SwiftUI / Compose.** Full rewrite; API surface is small enough
   (see `API_GUEST.md` §7) that this is feasible.
3. **Flutter.** Same trade-off; single codebase.

Re-express `webapp/colors_and_type.css` tokens as a typed theme object regardless.

---

## 6. DOM-only APIs used by guest UI

| API | File:Line | What it does | Native replacement |
|---|---|---|---|
| `document.addEventListener('mousedown', onDoc)` | `screen-guest.jsx:501-502` | Click-outside for user-chip menu | Backdrop `Pressable`, or `Modal` with `onDismiss` |
| `document.removeEventListener('mousedown', onDoc)` | `screen-guest.jsx:502` | cleanup | n/a |
| `window.addEventListener('mgt:datachanged', fn)` | `screen-guest.jsx:39` | Cross-screen refresh after writes | Store subscription (Context / Riverpod / Combine) |
| `window.removeEventListener('mgt:datachanged', fn)` | `screen-guest.jsx:40` | cleanup | n/a |
| `window.dispatchEvent(new Event('mgt:datachanged'))` | `data-loader.js:443` | Loader → UI write fan-out | Store mutator that re-renders subscribers |
| `window.location.reload()` | `screen-guest.jsx:506`, `data-loader.js:49, 620` | Logout / session-expired hard refresh | `navigation.reset()` to login |
| `<input type="file">` | `screen-guest.jsx:461-463, 486-488` | Photo picker | see §2 |
| `<div>/<button>/<span>/<input>/<header>/<main>/<svg>` | throughout `screen-guest.jsx` | Layout + form primitives | RN: `<View>/<Pressable>/<Text>/<TextInput>`; SVG via `react-native-svg` |
| Inline `var(--neon-cyan)` / `color-mix(...)` / `backdrop-filter` | throughout | Theming | Literal hex/rgba from theme; no RN equivalent for `color-mix` / `backdrop-filter` |
| `URL.createObjectURL(blob)` / `URL.revokeObjectURL(url)` | `data-loader.js:531, 536` | Triggers a browser PDF/XLSX download | Used by report download (admin/staff only — NOT in guest UI). If ever surfaced: `expo-file-system` write-then-share, or Android `MediaStore` |
| `document.createElement('a') + a.click()` | `data-loader.js:532-535` | Same — download trigger | same as above |
| `document.createElement('div'/'style') + appendChild` | `data-loader.js:67-101` (MGT_TOAST), `:162-198` (showLoginOverlay) | Vanilla DOM toast + login overlay | Replace MGT_TOAST per §3; replace `showLoginOverlay` with a real RN / SwiftUI login screen |
| `document.head.appendChild(css)` | `data-loader.js:37` | Injects print-mode stylesheet | n/a — print mode is not a guest feature |
| `new URLSearchParams(window.location.search)` | `data-loader.js:14` | Reads `?print=` param | Deep-link / launch-args API if needed |
| `requestAnimationFrame` | `data-loader.js:95` | Toast fade-in trigger | `setTimeout(..., 0)` or `Animated` |

---

## 7. localStorage / sessionStorage

**Searched** `screen-guest.jsx`, `data-loader.js`, and their direct
dependencies. The guest UI does **NOT** read or write `localStorage` /
`sessionStorage`. (The theme system may persist via `window.useTheme`,
which lives outside the audited files — confirm when porting.)

**Implication.** Nothing to migrate from web storage for the guest flow.
The mobile app's own storage needs are:

- Auth token (Option A, §1) → Keychain / EncryptedSharedPreferences
- Theme preference → `AsyncStorage` / `UserDefaults`
- (Optional) Offline draft of in-flight student create — useful on flaky
  cellular; web UI has no such cache today.

---

## 8. CORS

**Current** (`backend/server.js:75-78`):

```js
const corsOrigins = (process.env.CORS_ORIGINS || '').split(',').map(s => s.trim()).filter(Boolean);
if (corsOrigins.length) app.use(cors({ origin: corsOrigins, credentials: true }));
```

CORS is only applied when `CORS_ORIGINS` is set. Prod has the web app
same-origin, so this stays empty.

**Mobile path.**

- **WebView wrapper** (Capacitor / Cordova / Ionic): Origin is
  `capacitor://localhost` or `http://localhost` — add to `CORS_ORIGINS`.
- **React Native / native HTTP**: there is no CORS (browser-only concept).
  Native clients bypass it entirely.
- **Bearer-token path (Option A)**: cookies + `credentials: true` are
  irrelevant for the mobile path; only the web app needs them.

Example mixed deployment:

```
CORS_ORIGINS=https://app.crm.example.com,capacitor://localhost,ionic://localhost
```

---

## 9. Mobile-team checklist

- [ ] Pick auth transport: Bearer (recommended) or cookie jar (§1). Bearer needs `requireAuth` + login-response patch.
- [ ] Define `API_BASE`; prepend to every `/api/...` and every `docs_*_url` (§4).
- [ ] Native image picker → multipart `file` field (§2).
- [ ] Replace `window.MGT_DATA / MGT_TOAST / useTheme / fmtPhone` with context / store / utils (§3).
- [ ] Replace `mgt:datachanged` event with a store subscription; replace `window.location.reload()` on logout / 401 with login navigation (§1, §6).
- [ ] Drop Babel-in-browser; pick RN / Flutter / native (§5).
- [ ] Localize or pass through Vietnamese server strings (`API_GUEST.md` §6).
- [ ] WebView wrapper: set `CORS_ORIGINS`. Native HTTP: not needed (§8).
- [ ] Confirm `window.useTheme`'s storage backend when porting (outside audited scope).
