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
