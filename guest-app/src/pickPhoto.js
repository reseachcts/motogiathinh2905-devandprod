// Photo picker — single seam for the camera/gallery flow used by every
// photo slot in the app (CCCD front, CCCD back, CCCD QR, portrait).
//
// On WEB (dev / Vite preview): synthesises a hidden <input type="file">
// click. Pass `source: 'camera'` to add the `capture` attribute so the
// browser prefers the camera on supported devices.
//
// On NATIVE (Capacitor): swapped in Phase 5 to call @capacitor/camera
// with CameraSource.Prompt — this surfaces the OS-level action sheet
// asking "Chụp ảnh / Chọn từ thư viện".
//
// Returns a Promise<File | null>. `null` means the user cancelled.

// Lazy native picker resolution: cached after the first call. Avoids a
// top-level await (not yet in the Vite default browser target) and lets
// the web fallback kick in instantly when @capacitor/camera isn't there.
let nativePicker = undefined;  // undefined = unresolved, null = web-only, fn = native
async function resolveNative() {
  if (nativePicker !== undefined) return nativePicker;
  try {
    const mod = await import('./pickPhoto.native.js');
    nativePicker = typeof mod?.pickPhotoNative === 'function' ? mod.pickPhotoNative : null;
  } catch {
    nativePicker = null;
  }
  return nativePicker;
}

export async function pickPhoto({ source = 'prompt' } = {}) {
  const native = await resolveNative();
  if (native) {
    try { return await native({ source }); }
    catch (e) {
      if (/cancel/i.test(e?.message || '')) return null;
      throw e;
    }
  }
  return pickPhotoWeb({ source });
}

function pickPhotoWeb({ source }) {
  return new Promise((resolve) => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = 'image/*';
    if (source === 'camera') input.capture = 'environment';
    input.style.display = 'none';
    input.onchange = () => {
      const file = input.files?.[0] || null;
      document.body.removeChild(input);
      resolve(file);
    };
    // Cancellation: most browsers don't fire `cancel` reliably. We listen
    // for focus returning to the window — if no file arrived within a tick,
    // resolve null so the caller's busy spinner doesn't hang.
    let settled = false;
    const onFocus = () => {
      setTimeout(() => {
        if (settled) return;
        if (!input.files?.length) {
          settled = true;
          if (input.parentNode) document.body.removeChild(input);
          window.removeEventListener('focus', onFocus);
          resolve(null);
        }
      }, 300);
    };
    const wrapResolve = (f) => { settled = true; window.removeEventListener('focus', onFocus); resolve(f); };
    input.onchange = () => { wrapResolve(input.files?.[0] || null); };
    window.addEventListener('focus', onFocus);
    document.body.appendChild(input);
    input.click();
  });
}
