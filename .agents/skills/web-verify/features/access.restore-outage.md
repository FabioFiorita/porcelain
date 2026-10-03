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

When a reload's session restore fails for a reason other than "not paired" (inventory answers an error, not 401), the page keeps the workspace address and shows the retrying workspace error instead of the not-paired page, and it opens the workspace by itself once the connection returns. Opening `/pair` during the outage shows the same retrying error, not the not-paired page.

## How a user reaches it

- Reload (or open) a workspace address `/<projectId>/<worktreeId>`, or `/pair` without a link, while the server cannot answer.
- The error retries on the window's `online`, `focus` and `visibilitychange` events.

## Driving it

`C=.agents/skills/web-verify/scripts/cli; $C start`. `network fail` answers `GET /api/inventory` with 503 from the browser's side, the outage the test makes; `network restore` ends it and dispatches the window `online` event, as the test does.

1. `$C open /`, `$C click --role button --name "Review"`, `$C click --role tab --name "Files"`
   Look for: tab "Files" selected; Page URL `/<projectId>/<worktreeId>?…surface=files` (call its path and query `$WORKSPACE`).
2. `$C network fail "GET /api/inventory" --status 503`, then `$C open "$WORKSPACE"` and `$C wait --text "Could not display the workspace."`
   Look for: alert with "Could not display the workspace." and "Porcelain will retry when the connection returns or this window becomes active again."; NO heading "This browser is not paired"; Page URL still `$WORKSPACE`. `$C network` lists `GET /api/inventory` answered 503 (not 401); `$C console` holds "ConnectionError: Could not reach Porcelain to restore this browser session.".
3. `$C network restore`, then `$C wait --role region --name "Review content"`
   Look for: "restored 1 failing route and dispatched the window online event"; without another `open`, region "Review content" appears; Page URL still `$WORKSPACE`.
4. `$C click --role button --name "Review"`
   Look for: tab "Files" [selected] (the `surface=files` search survived).

### The pairing page during the outage

5. `$C network fail "GET /api/inventory" --status 503`, then `$C open /pair` and `$C wait --text "Could not display the workspace."`
   Look for: the workspace error, not the heading "This browser is not paired".
6. `$C network restore`, then `$C wait --role region --name "Review content"`
   Look for: region "Review content": the paired browser left `/pair` for its workspace.

## What proves it works

- During the outage: the workspace error at the unchanged address, never the not-paired page. After it: the workspace returns at the same address with the Files surface kept.
- `$C network` during the outage: `GET /api/inventory` answered 503 (not 401), and no navigation to `/pair`.
- `$C console` shows the expected error "Could not reach Porcelain to restore this browser session."
- `apps/web/spec/e2e/access-restore-outage.e2e.ts`: pairs, opens Files, makes inventory answer 503 and reloads; asserts the workspace error, no not-paired heading and the same path; ends the outage and dispatches `online`; asserts "Review content", the same path and Files still selected. A second case opens `/pair` in a paired browser during the outage, asserts the workspace error and no not-paired heading, and after the outage "Review content" away from `/pair`.

## Gotchas

- The retry fires on `online`, `focus` or `visibilitychange`; a headless page rarely gets focus or visibility events, so the `online` event `network restore` dispatches is what brings the workspace back. An `open` would be a new load, not the self-recovery the promise is about.
- The console error "Could not reach Porcelain to restore this browser session." is expected during the outage.
- Phone width: the review panel is a sheet behind `Review`.
