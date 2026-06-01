// Storage shim — token + ephemeral kv. Async API throughout so the web
// branch (localStorage) and the native branch (Capacitor Preferences)
// share one signature.
//
// We probe Capacitor at module-load time. On web (dev / Vite preview)
// the @capacitor/preferences module is still resolvable (it's installed
// as a regular dep), but `Capacitor.isNativePlatform()` returns false,
// so we fall through to localStorage. Inside the Android APK that flips
// and we use the platform's SharedPreferences-backed storage.

import { Capacitor } from '@capacitor/core';
import { Preferences } from '@capacitor/preferences';

const useNative = Capacitor.isNativePlatform();

export const storage = useNative
  ? {
      async get(key)  { const { value } = await Preferences.get({ key }); return value; },
      async set(key, value) { await Preferences.set({ key, value: String(value) }); },
      async del(key)  { await Preferences.remove({ key }); },
    }
  : {
      async get(key)  { try { return localStorage.getItem(key); } catch { return null; } },
      async set(key, v) { try { localStorage.setItem(key, v); } catch {} },
      async del(key)  { try { localStorage.removeItem(key); } catch {} },
    };
