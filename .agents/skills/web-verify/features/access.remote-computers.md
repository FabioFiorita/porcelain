---
route: /settings/$section
selectors:
  - 'Settings'
  - 'Computers'
  - 'Pairing link'
  - 'Add'
  - 'Computers list'
  - 'Forget on this app'
tests:
  - apps/web/spec/e2e/access-remote-computers.desktop.e2e.ts
  - apps/web/spec/e2e/access-remote-detail.desktop.e2e.ts
api:
  - POST /api/pair
  - GET /api/environment
  - GET /api/session
---

# access.remote-computers

Settings → Computers lists This computer first, then saved computers. The list has no search. Each row shows name and status, current/latest version and an eligible update offer. Add computer keeps the paste-link flow: run porcelain pair on the other computer, paste the full link and click Add.

## How to get to it (user POV)

- Settings → Computers → Add computer; saved computer → Open <name> or Forget.

## Driving it with browser

Preconditions: [surface baseline](README.md).

In a disposable desktop instance open Computers. There is one listitem, This computer. Add a malformed link and expect its validation message. A link for this same computer is refused. Add a real remote link; the named row appears online. Open <name> shows detail at `/settings/computers/<environmentId>`.

Return to the list and retry the consumed link: it is refused. Revoke the remote credential at its host and reload; detail now says Needs pairing. Forget on this app removes the saved row, leaving only This computer. Host credentials are not revoked by Forget.

Automated coverage: `access-remote-computers.desktop.e2e.ts`.

## Gotchas

- Consumed/same-computer links must not add a saved connection. Use fresh links and independent device readbacks.

### Connection lifecycle

With a paired, live remote, fail only its HTTP status request in the browser and return focus. Independently read host health, then change an open remote file on disk: the existing socket remains open, Online stays visible and the file updates. Repeated ordinary focus changes must retain the socket and selected fallback route. A long resume checks that session and refreshes active reads and pending Git receipts after an acknowledged round trip.

Drop the actual live socket, restore transport and verify a replacement session receives the current subscription and fresh file data without a reload. A silent socket and an initial ready handshake that never arrives must also recover within their bounded setup/probe deadlines. Confirmed revocation ends retries; an unreachable alternative does not count as revoked. Forget stops that computer's session while other computers remain available. Retain socket open/close counts, frames, route identity, status-probe failures and independent file readbacks.
