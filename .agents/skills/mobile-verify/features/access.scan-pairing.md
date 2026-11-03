---
screen: /scan-pairing-link
selectors:
  - 'Scan QR code'
  - 'scan-pairing-link'
  - 'qr-scanner'
  - 'Allow camera'
  - 'Open Settings'
  - 'Close'
  - 'pairing-link'
tests:
  - apps/mobile/src/features/access/rules/pairing-link-intake.spec.ts
api: []
---

# access.scan-pairing

Scan QR code reads a computer's pairing QR code with the camera, fills the pairing form with the link and returns to it for Pair.

## How to get to it (user POV)

- Settings → Computers → Add computer → Scan QR code

## Driving it with agent-device

Preconditions: [surface baseline](README.md).

1. Open Pair a computer ([pairing](access.pairing.md)) and press `scan-pairing-link`. A full-screen scanner opens above the sheet with its own Close; Close and Android Back return to the sheet unchanged.
2. Without camera access the scanner explains why it needs the camera and offers Allow camera. The system prompt names the camera only, never the microphone. Deny it: Allow camera stays until the system stops asking, then Open Settings opens the app's system settings. Grant access there and return: the camera preview and its hint appear without reopening the scanner.
3. With access, the `qr-scanner` preview and the hint render. A scanned pairing link in either format (`/open/pair#…` on the app-link origin, or `<address>/pair#…`) fills `pairing-link` and returns to the sheet; nothing pairs until Pair. Any other QR code shows a short message and scanning continues.

Automated coverage: `pairing-link-intake.spec.ts`.

## Gotchas

- Emulators have no real camera: the preview shows the emulator's virtual camera and no QR code reaches the scanner, so scan handling is proven by the named spec. A real scan needs a physical device.
- `pm revoke` of the camera permission stops the app process. The app remembers earlier denials, so a revoked permission can return straight to Open Settings.
- The camera permission and scanner are native: a development client built before the camera dependency cannot open the scanner.
