// Storage shim — token + ephemeral kv. Async API throughout so call sites
// (api.js) don't care about the backing store.
//
// Single implementation: localStorage. It persists across launches in BOTH
// WKWebView (iOS) and the Android System WebView, which is all the guest
// kiosk needs for its bearer token.
//
// We dropped @capacitor/preferences: its 8.0.1 iOS Swift source fails to
// compile against @capacitor/core 8.3.4 (8.0.1 is already the newest stable
// preferences on npm — no fixed release exists), which broke every iOS CI
// build. localStorage is functionally equivalent for token persistence and
// keeps one code path for both platforms.

export const storage = {
  async get(key)        { try { return localStorage.getItem(key); } catch { return null; } },
  async set(key, value) { try { localStorage.setItem(key, String(value)); } catch {} },
  async del(key)        { try { localStorage.removeItem(key); } catch {} },
};
