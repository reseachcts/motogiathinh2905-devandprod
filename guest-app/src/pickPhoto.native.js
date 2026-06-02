// Native picker — Capacitor Camera plugin. The `import` resolves only
// when the app runs inside a Capacitor shell (web has no @capacitor/core
// module path at runtime in the Vite dev server). When this module loads
// and `Capacitor.isNativePlatform()` is false, we still export the
// function — pickPhoto.js calls it and the plugin will throw, and pickPhoto
// is wrapped to catch that and fall through to the web path.
//
// Inside an APK, `Camera.getPhoto({source: CameraSource.Prompt})` shows
// the OS action sheet labelled per capacitor.config.json:
//   "Chụp ảnh mới"  → CameraSource.Camera
//   "Chọn từ thư viện" → CameraSource.Photos
// User cancellation throws a `User cancelled photos app` error — caught
// by pickPhoto.js and converted to a `null` resolution.

import { Capacitor } from '@capacitor/core';
import { Camera, CameraSource, CameraResultType } from '@capacitor/camera';

const sourceMap = {
  camera:  CameraSource.Camera,
  library: CameraSource.Photos,
  prompt:  CameraSource.Prompt,
};

export async function pickPhotoNative({ source = 'prompt' } = {}) {
  if (!Capacitor.isNativePlatform()) {
    // Running in a browser (Vite dev / preview). Throw so pickPhoto.js
    // falls back to the web <input> path.
    throw new Error('not_native');
  }
  const photo = await Camera.getPhoto({
    // quality:100 prevents the Camera plugin from re-encoding a clear
    // QR photo down to JPEG q=85 — which can shave just enough fidelity
    // off a borderline-clear photo for jsQR to fail decode. The plugin
    // still resizes if width is set; we leave it unset so the original
    // resolution is preserved.
    quality: 100,
    allowEditing: false,
    resultType: CameraResultType.Uri,
    source: sourceMap[source] || CameraSource.Prompt,
    saveToGallery: false,
  });
  // photo.webPath is a blob:// URL we can fetch + convert to a File
  // matching the contract the multipart uploader expects (POST /api/students/:id/docs/:key).
  const resp = await fetch(photo.webPath);
  const blob = await resp.blob();
  const ext = blob.type === 'image/png' ? 'png' : 'jpg';
  return new File([blob], `photo-${Date.now()}.${ext}`, { type: blob.type || 'image/jpeg' });
}
