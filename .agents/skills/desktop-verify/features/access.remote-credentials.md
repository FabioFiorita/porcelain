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
  - 'Walkthrough of the decisions'
  - 'Agent summary'
tests:
  - apps/desktop/spec/e2e/bridge.e2e.ts
  - apps/desktop/spec/e2e/review-summaries.e2e.ts
api: []
---

# access.remote-credentials

The Mac app saves paired computers securely, preserves unreadable credentials without overwriting them, and opens remote review summaries in isolation.

## How to get to it (user POV)

- Settings › Computers › paste a pairing link › Add
- the sidebar group of a paired computer, then its worktree's Review → Agent summary

## Driving it with Electron

Preconditions: [surface baseline](README.md).

1. Start two disposable app instances. Mint a fresh link with the second card’s exact pairing command. In the first, Settings → Computers → paste link → Add; confirm its row and open its workspace. Follow [web remote-computer steps](../../web-verify/features/access.remote-computers.md) for link refusal and Forget.
2. Inspect `credentialFiles.remoteEncrypted`: no plaintext credential is present and file mode is 0600. Restart with the same disposable profile and confirm the saved computer reconnects.
3. Using the named bridge fixture, make the encrypted store unreadable. Expect Settings to explain the failure; it must not overwrite unreadable ciphertext. Refuse encryption on write and confirm the prior ciphertext stays. Clear removes the saved store.
4. In an in-process Electron journey, invoke credential/update IPC from an unowned window: every request is refused. Keep the owned window usable.
5. Publish authored summaries on local and paired remote fixtures. Walkthrough is initial; Agent summary opens HTML, and its #layer-N links open decision N. Return through Walkthrough of the decisions, then Agent summary. Open both through the app: theme and decision links work, content stays sandboxed, and no remote website, Node or bridge access is available.

Automated coverage: `bridge.e2e.ts`, `review-summaries.e2e.ts`.

## Gotchas

- Keychain/encryption and restart proof require macOS and the same disposable profile. Never inspect the installed profile.
- Signed summary links expire shortly after the review read; reload for a fresh link before mounting a late frame. Focus the intended link and release Enter only after the destination takes focus; iframe replacement can otherwise send activation twice. Confirm the actual decision opens, or a frame-src violation blocks website navigation with zero website requests.
- A remote encrypted-store file may not exist before the first save.
