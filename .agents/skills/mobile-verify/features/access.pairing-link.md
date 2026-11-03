---
screen: /open/pair
selectors:
  - 'Pair a computer'
  - 'pairing-link'
  - 'pair-environment'
  - 'Close'
tests:
  - apps/mobile/src/features/access/rules/pairing-link-intake.spec.ts
  - apps/mobile/src/features/access/pairing-sheet.spec.ts
api:
  - POST /api/pair
---

# access.pairing-link

A pairing link on the app-link origin, which a computer's pairing QR code carries, opens Pair a computer with the whole link filled in, and pairs only when Pair is pressed.

## How to get to it (user POV)

- Scan the computer's pairing QR code with the system Camera, or open `https://<app-link origin>/open/pair#c=<code>&e=<environment>&a=<addresses>`.

## Driving it with agent-device

Preconditions: [surface baseline](README.md).

1. Mint a link with the card's `pairing-link` command and rewrite it to `/open/pair` on the app-link origin with the same code and environment and the printed address as `a` (the contract's `pairingLink` builds it). On Android deliver it as a VIEW intent to the disposable development package, warm and cold.
2. Expect Pair a computer above Settings with `pairing-link` holding the whole link, fragment included, and no new server device. Press `pair-environment`: the form closes and an independent device readback shows the new device.
3. Deliver a malformed `/open/pair` link: the same form opens with it and Pair shows the normal link error. Close returns to Settings; reopening Add computer starts blank.

Automated coverage: `pairing-link-intake.spec.ts`, `pairing-sheet.spec.ts`.

## Gotchas

- The code never enters navigation state: the app rewrites `/open/pair#…` to `/open/pair` before routing, hands the full link to the next pairing form once and clears the native launch URL. Keep it out of evidence; redact the `c` value.
- On Android a warm link currently shows the form as a full page with a header and Back to Settings rather than a sheet; a cold link and Add computer present the sheet. A direct `porcelain.dev://pair-computer` link behaves the same way.
- A debug cold HTTPS intent can stop at the development launcher; choosing the Metro server then delivers the link. Automatic domain verification needs the distributed binary and the deployed association files.
