// Storage shim — token + ephemeral kv. Async API so the Capacitor
// swap in Phase 5 is a 1-file change (just replace the body of these
// three functions with `Preferences.get/set/remove`).

export const storage = {
  async get(key) {
    try { return localStorage.getItem(key); } catch { return null; }
  },
  async set(key, value) {
    try { localStorage.setItem(key, value); } catch {}
  },
  async del(key) {
    try { localStorage.removeItem(key); } catch {}
  },
};
