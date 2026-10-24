---
route: /settings/$section/$environmentId
selectors:
  - 'Computers'
  - 'Computers list'
  - 'Open This computer:'
  - 'Computer settings'
  - 'Overview'
  - 'Address'
  - 'Computer ID'
  - 'Ways in'
  - 'Forget on this app'
  - 'Close Settings'
tests:
  - apps/web/spec/e2e/access-remote-detail.desktop.e2e.ts
api:
  - GET /api/environment
  - GET /api/session
  - POST /api/pair
---

# access.remote-detail

Computers is a unified list.

## How to get to it (user POV)

- Settings → Computers → Open <name>; `/settings/computers/<environmentId>`.

## Driving it with browser

Preconditions: [surface baseline](README.md).

This computer comes first, followed by saved computers. A saved row has an explicit Open <name> action, status, version/update information when online, and no search or filter. `/settings/computers/<environmentId>` opens its detail with the computer name in the breadcrumb. Browser and desktop both accept this route. A missing saved computer explains how to return to Computers and pair again.

Open Settings → Computers, paste a remote pairing link and click Add. Open the named row. Overview shows live name/status, address, Computer ID, version and this device's ID; Ways in lists saved addresses read-only. Update progress stays consistent with the computer list. Offline detail keeps saved identity, labels it stale and explains Pair again. Forget on this app lives in the Danger zone and protects unsaved drafts.

Close Settings, the Computers breadcrumb and browser Back restore list scroll and the Open <name> button's focus. Immediate Escape works after click or keyboard activation; input Escape is ignored. Forget removes the row and moves focus to Computers list, so the next Escape can leave Settings. Direct detail URLs reload safely. An extra segment on any other section is not found.

The former per-computer sidebar shortcut buttons were removed. Use Settings → Computers → Open <name>. An unavailable workspace's Computer settings action still opens that exact computer without changing the selected review.

Automated coverage: `access-remote-detail.desktop.e2e.ts`.

## Gotchas

- Offline saved details are stale; reconnect before claiming their current state. Keep the draft guard when forgetting.
