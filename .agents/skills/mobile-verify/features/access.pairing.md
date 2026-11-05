---
screen: /pair-computer
selectors:
  - 'Add computer'
  - 'Pair a computer'
  - 'pairing-link'
  - 'Pair'
  - 'pair-environment'
  - 'Close'
  - 'Use development server'
  - 'development-pairing-link'
  - 'Creating pairing link…'
  - 'Online'
  - 'Scan QR code'
tests:
  - apps/server/spec/kit/development-pairing.spec.ts
  - apps/mobile/src/features/access/pairing-sheet.spec.ts
api:
  - POST /api/pair
  - GET /api/environment
  - GET /api/session
---

# access.pairing

Add computer pairs through a scanned or pasted one-time link, saves the computer across cold launches, and retains errors until corrected or retried.

## How to get to it (user POV)

- Settings → Computers → Add computer → paste the link → Pair
- Settings → Computers → Add computer → Scan QR code: follow [scan pairing](access.scan-pairing.md).
- A pairing link opened from the system Camera or another app: follow [pairing link](access.pairing-link.md).
- Metro development: Settings → Computers → Add computer → Use development server → Pair

## Driving it with agent-device

Preconditions: [surface baseline](README.md).

1. Settings → Computers → header + labelled Add computer. Expect Pair a computer in a form sheet route on phones and tablets: the title with an X (Close) in the native header on iOS, and an in-sheet header with a drag handle, the title and an X on Android, with rounded top corners, inside the Settings modal. The form has no Cancel button. The sheet opens tall enough on iPhone that Pair is fully visible below the field. Paste a long link: it wraps inside the field, which grows to a few lines and then scrolls, never past the sheet's edges; Return closes the keyboard instead of adding a line. Blank links disable Pair. Enter `invalid-link` in `pairing-link`, press `pair-environment`: an error remains in the form, with no new server device. Edit to clear it.
2. Mint a fresh link with the card command, paste it, wait for the keyboard animation, then Pair. The form closes, Online appears and an independent server read shows the native device.
3. Pair a second disposable computer; cold-launch and confirm both return. Another address for the same computer retains both connections: follow [connections](access.connections.md).
4. Reopen and press Close; reopen and swipe the sheet down: either way Computers returns and saved computers stay unchanged. Expand the half-height sheet and scroll; every control remains reachable.
5. In Metro development choose `development-pairing-link` (Use development server). Expect a full link but no device until Pair. Request another: its code differs. Pair and read the Development mobile device independently.
6. While Creating pairing link…, field/helper/Pair are disabled and Close works. Inject helper failure, restore its owner connection and retry. Close during creation, reopen: blank field, no error/pending state. Exercise unreadable saved storage/save error: Pair stays disabled or Try again offers recovery.

Automated coverage: `development-pairing.spec.ts`.

## Gotchas

- Pairing a missing connection (Pair again), Add connection and the linked-review Pair this computer keep the same form inline, with its heading and `cancel-pairing`.

- Closing the sheet forgets an unsubmitted link: reopening Add computer starts blank.
- Use test IDs if a native host duplicates a button label. Pair requests have a 15-second deadline; fresh links work once and expire.
- The helper is absent from production and unconfigured development sessions. Restart Metro after changing helper configuration/owner socket; no native rebuild is needed. Keep helper links private.
