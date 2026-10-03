---
route: /$projectId/$worktreeId
selectors:
  - "Review"
  - "Files"
  - "Could not display the workspace."
  - "This browser is not paired"
  - "Review content"
tests:
  - apps/web/spec/e2e/access-restore-outage.e2e.ts
api:
  - GET /api/inventory
---

# access.restore-outage

## What it is

When a reload's session restore fails for a reason other than "not paired" (inventory answers an error, not 401), the page keeps the workspace address and shows the retrying workspace error instead of the not-paired page, and it opens the workspace by itself once the connection returns.

## How a user reaches it

- Reload (or open) a workspace address `/<projectId>/<worktreeId>` while the server cannot answer.
- The error retries on the window's `online`, `focus` and `visibilitychange` events.

## Driving it

`C=.agents/skills/web-verify/scripts/cli; $C start`. Only the healthy reload can be driven; the outage needs a CLI gap (first gotcha).

### Setup

- CLI gap: make `GET /api/inventory` answer 503 and later restore it. Needed commands: `cli network fail "GET /api/inventory" --status 503` and `cli network restore` (which should also dispatch the window `online` event, as the test does).

1. `$C open /`, `$C click --role button --name "Review"`, `$C click --role tab --name "Files"`
   Look for: tab "Files" selected; Page URL `/<projectId>/<worktreeId>?surface=files` (call it `$WORKSPACE`).
2. `cli network fail "GET /api/inventory" --status 503` (missing), then `$C open "$WORKSPACE"`
   Look for: alert text "Could not display the workspace." and "Porcelain will retry when the connection returns or this window becomes active again."; NO heading "This browser is not paired"; Page URL still `$WORKSPACE`.
3. `cli network restore` (missing)
   Look for: without another `open`, region "Review content" appears; Page URL still `$WORKSPACE`.
4. `$C click --role button --name "Review"`
   Look for: tab "Files" still selected (the `surface=files` search survived).

Healthy path the CLI can do today: after step 1, `$C open "$WORKSPACE"` shows region "Review content" at the same URL, and step 4 shows tab "Files" selected.

## What proves it works

- During the outage: the workspace error at the unchanged address, never the not-paired page. After it: the workspace returns at the same address with the Files surface kept.
- `$C network` during the outage: `GET /api/inventory` answered 503 (not 401), and no navigation to `/pair`.
- `$C console` shows the expected error "Could not reach Porcelain to restore this browser session."
- `apps/web/spec/e2e/access-restore-outage.e2e.ts`: pairs, opens Files, makes inventory answer 503 and reloads; asserts the workspace error, no not-paired heading and the same path; ends the outage and dispatches `online`; asserts "Review content", the same path and Files still selected.

## Gotchas

- Unreachable through the CLI: it cannot fail a request or cut the network. Needed: `cli network fail "GET /api/inventory" --status 503` and `cli network restore` (restore dispatching `online`).
- The retry fires on `online`, `focus` or `visibilitychange`; a headless page rarely gets focus or visibility events, so without a dispatched `online` the error stays until the next `open`, and an `open` is a new load, not the self-recovery the promise is about.
- The console error "Could not reach Porcelain to restore this browser session." is expected during the outage.
- Phone width: the review panel is a sheet behind `Review`.
