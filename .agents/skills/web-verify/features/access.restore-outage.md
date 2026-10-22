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

When a reload's session restore fails for a reason other than "not paired" (inventory answers an error, not 401), the page keeps the workspace address and shows the retrying workspace error instead of the not-paired page, and it opens the workspace by itself once the connection returns.

## How to get to it (user POV)

- Reload (or open) a workspace address `/<projectId>/<worktreeId>`, or `/pair` without a link, while the server cannot answer.
- The error retries on the window's `online`, `focus` and `visibilitychange` events.

## Driving it with browser

Preconditions: [surface baseline](README.md).

Opening `/pair` during the outage shows the same retrying error, not the not-paired page.

1. Navigate to `/`, click button `Review`, click tab `Files`
   Expect: tab "Files" selected; URL `/<projectId>/<worktreeId>?…surface=files` (call its path and query `$WORKSPACE`).
2. Answer matching `GET /api/inventory` requests with 503 in the browser (see [routing recipes and per-map instructions](../references/failure-injection.md)), then navigate to `$WORKSPACE` and wait for text 'Could not display the workspace.'
   Expect: alert with "Could not display the workspace." and "Porcelain will retry when the connection returns or this window becomes active again."; NO heading "This browser is not paired"; URL still `$WORKSPACE`. Inspect HTTP traffic lists `GET /api/inventory` answered 503 (not 401); Inspect console holds "ConnectionError: Could not reach Porcelain to restore this browser session.".
3. Restore HTTP pass-through (dispatch `online` only for access.restore-outage), then wait for region named `Review content`
   Expect: HTTP pass-through is restored and the page receives the `online` event; without another full page load, region "Review content" appears; URL still `$WORKSPACE`.
4. Click button `Review`
   Expect: tab "Files" [selected] (the `surface=files` search survived).

### The pairing page during the outage

5. Answer matching `GET /api/inventory` requests with 503 in the browser (see [routing recipes and per-map instructions](../references/failure-injection.md)), then navigate to `/pair` and wait for text 'Could not display the workspace.'
   Expect: the workspace error, not the heading "This browser is not paired".
6. Restore HTTP pass-through (dispatch `online` only for access.restore-outage), then wait for region named `Review content`
   Expect: region "Review content": the paired browser left `/pair` for its workspace.

### Observable proof

Record unchanged workspace URL through 503/recovery, zero `/pair` navigation, and expected console error “Could not reach Porcelain to restore this browser session.”

Automated coverage: `access-restore-outage.e2e.ts`.

## Gotchas

- Restore pass-through and dispatch `online`; headless pages may receive no focus/visibility event. Reloading would prove a different path.
- “Could not reach Porcelain to restore this browser session.” is expected during outage.
