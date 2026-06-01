// Native picker stub — replaced in Phase 5 with the actual @capacitor/camera
// implementation. pickPhoto.js dynamic-imports this file; with no export
// here, it falls through to the web fallback (programmatic <input>).
//
// In Phase 5 this file becomes:
//
//   import { Camera, CameraSource, CameraResultType } from '@capacitor/camera';
//   export async function pickPhotoNative({ source }) {
//     const photo = await Camera.getPhoto({
//       quality: 85,
//       resultType: CameraResultType.Uri,
//       source: source === 'camera' ? CameraSource.Camera
//             : source === 'library' ? CameraSource.Photos
//             : CameraSource.Prompt,
//     });
//     const resp = await fetch(photo.webPath);
//     const blob = await resp.blob();
//     return new File([blob], `photo-${Date.now()}.jpg`, { type: blob.type || 'image/jpeg' });
//   }

export {};
