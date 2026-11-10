---
route: /settings/$section
selectors:
  - porcelain:credentials-read
  - porcelain:credentials-write
  - porcelain:credentials-clear
  - credentials.enc
  - 'Computers'
  - 'Pairing link'
  - 'Saved computers could not be read'
  - 'Read saved computers'
  - 'Walkthrough'
  - 'Review'
tests:
  - apps/desktop/spec/e2e/bridge.e2e.ts
api: []
---

# access.remote-credentials

The Mac app saves paired computers securely, preserves unreadable credentials without overwriting them,.

## How to get to it (user POV)

- Settings › Computers › paste a pairing link › Add

## Driving it with Electron

Preconditions: [surface baseline](README.md).

1. Start two disposable app instances. Mint a fresh link with the second card’s exact pairing command. In the first, Settings → Computers → paste link → Add; confirm its row and open its workspace. Follow [web remote-computer steps](../../web-verify/features/access.remote-computers.md) for link refusal and Forget.
2. Inspect `credentialFiles.remoteEncrypted`: no plaintext credential is present and file mode is 0600. Restart with the same disposable profile and confirm the saved computer reconnects.
3. Using the named bridge fixture, make the encrypted store unreadable. Expect Settings to explain the failure; it must not overwrite unreadable ciphertext. Refuse encryption on write and confirm the prior ciphertext stays. Clear removes the saved store.
4. In an in-process Electron journey, invoke credential/update IPC from an unowned window: every request is refused. Keep the owned window usable.

Automated coverage: `bridge.e2e.ts`.

6. With an already open remote file/review, capture socket identity and independently change fixture data while the app is suspended. Resume without assuming a browser focus/visibility transition; accepted live subscription refreshes active reads and pending Git receipts, keeping a healthy socket. If the window remains unfocused, that refresh is retained until it becomes active. Computers diagnostic reads pause during native suspension. Keep another computer usable throughout. Run the native suspend/resume bridge regression separately from actual OS sleep/wake; emitted test events do not prove physical sleep. Repeat after closing/reopening the window and confirm power listeners are released.

## Gotchas

- The named encrypted-store and remote-summary regressions run in the `macos` project with Keychain and the same disposable profile. Linux encrypted persistence would need a real supported encrypted backend; plaintext fallback is refused. Never inspect the installed profile.
- The `portable` project independently covers local signed summaries, untrusted-window IPC refusal and emitted suspend/resume delivery. Those promises do not require Keychain; they do not prove remote persistence or physical OS sleep.
- A remote encrypted-store file may not exist before the first save.
