---
screen: /computers
selectors:
  - 'Add computer'
  - 'add-environment'
  - 'Pair a computer'
  - 'pairing-link'
  - 'Pair'
  - 'pair-environment'
  - 'Cancel'
  - 'cancel-pairing'
  - 'Use development server'
  - 'development-pairing-link'
  - 'Creating pairing link…'
  - 'Online'
tests:
  - apps/server/spec/kit/development-pairing.spec.ts
api:
  - POST /api/pair
  - GET /api/environment
  - GET /api/session
---

# access.pairing

Add computer pairs through a pasted one-time link, saves the computer across cold launches, and retains errors until corrected or retried.

## How to get to it (user POV)

- Settings → Computers → Add computer → paste the link → Pair
- Metro development: Settings → Computers → Add computer → Use development server → Pair

## Driving it with agent-device

Preconditions: [surface baseline](README.md).

1. Computers → `add-environment`. Expect Pair a computer in a phone sheet or inline on iPad. Blank links disable Pair. Enter `invalid-link` in `pairing-link`, press `pair-environment`: an error remains in the form, with no new server device. Edit to clear it.
2. Mint a fresh link with the card command, paste it, wait for the keyboard animation, then Pair. The form closes, Online appears and an independent server read shows the native device.
3. Pair a second disposable computer; cold-launch and confirm both return. Another address for the same computer retains both connections: follow [connections](access.connections.md).
4. Reopen and press `cancel-pairing`: saved computers stay unchanged. On phone expand the half-height sheet and scroll; every control remains reachable.
5. In Metro development choose `development-pairing-link` (Use development server). Expect a full link but no device until Pair. Request another: its code differs. Pair and read the Development mobile device independently.
6. While Creating pairing link…, field/helper/Pair are disabled and Cancel works. Inject helper failure, restore its owner connection and retry. Cancel during creation, reopen: blank field, no error/pending state. Exercise unreadable saved storage/save error: Pair stays disabled or Try again offers recovery.

Automated coverage: `development-pairing.spec.ts`.

## Gotchas

- Use test IDs if a native host duplicates a button label. Pair requests have a 15-second deadline; fresh links work once and expire.
- The helper is absent from production and unconfigured development sessions. Restart Metro after changing helper configuration/owner socket; no native rebuild is needed. Keep helper links private.
