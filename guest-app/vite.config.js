import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// Vite config for the standalone guest kiosk app.
// - dev:    `npm run dev`       (uses .env.development → http://127.0.0.1:3001)
// - prod:   `npm run build`     (uses .env.production → public HTTPS host)
// - LAN:    `npm run build:dev` (still talks to dev backend, for LAN APK testing)
//
// Capacitor (added in Phase 5) consumes dist/ as the webview payload — keep
// outDir at the default `dist`.

export default defineConfig({
  plugins: [react()],
  server: {
    host: true,         // 0.0.0.0 — lets a phone on the same Wi-Fi load the dev server
    port: 5173,
  },
  build: {
    outDir: 'dist',
    assetsDir: 'assets',
    sourcemap: true,    // keep for native crash reports until we ship signed
  },
});
