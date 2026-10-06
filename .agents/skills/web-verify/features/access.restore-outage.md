# access.restore-outage

## What it is

When a reload's session restore fails for a reason other than "not paired" (inventory answers an error, not 401), the page keeps the workspace address and shows the retrying workspace error instead of the not-paired page, and it opens the workspace by itself once the connection returns. Opening `/pair` during the outage shows the same retrying error, not the not-paired page.

## How a user reaches it

- Reload (or open) a workspace address `/<projectId>/<worktreeId>`, or `/pair` without a link, while the server cannot answer.
- The error retries on the window's `online`, `focus` and `visibilitychange` events.

## Driving it

`C=.agents/skills/web-verify/scripts/cli; $C start`. Fail `GET /api/inventory` with HTTP 503 from the browser side, as the test does. Restore normal responses and dispatch the window `online` event to end the outage.
After each start, use the skill’s in-app attachment workflow: open the fresh attachment page in an owned tab and follow "Open workspace".

This controlled case requires HTTP failure interception for `GET /api/inventory` and response restoration. The selected in-app browser presently does not expose these controls. Record this interactive case as unavailable. The named automated regressions are separate evidence.

1. Open `/` on the instance web URL, click the button named 'Review', click the tab named 'Files'
   Look for: tab "Files" selected; Page URL `/<projectId>/<worktreeId>?…surface=files` (call its path and query `$WORKSPACE`).
2. Fail `GET /api/inventory` with HTTP 503, then open `$WORKSPACE` on the instance web URL and wait for the text 'Could not display the workspace.'
   Look for: alert with "Could not display the workspace." and "Porcelain will retry when the connection returns or this window becomes active again."; NO heading "This browser is not paired"; Page URL still `$WORKSPACE`. Browser network evidence lists `GET /api/inventory` answered 503 (not 401); browser console evidence holds "ConnectionError: Could not reach Porcelain to restore this browser session.".
3. Restore normal HTTP responses and dispatch the window `online` event, then wait for the region named 'Review content'
   Look for: normal responses restored and the window `online` event dispatched; without another page load, region "Review content" appears; Page URL still `$WORKSPACE`.
4. Click the button named 'Review'
   Look for: tab "Files" [selected] (the `surface=files` search survived).

### The pairing page during the outage

5. Fail `GET /api/inventory` with HTTP 503, then open `/pair` on the instance web URL and wait for the text 'Could not display the workspace.'
   Look for: the workspace error, not the heading "This browser is not paired".
6. Restore normal HTTP responses and dispatch the window `online` event, then wait for the region named 'Review content'
   Look for: region "Review content": the paired browser left `/pair` for its workspace.

## What proves it works

- During the outage: the workspace error at the unchanged address, never the not-paired page. After it: the workspace returns at the same address with the Files surface kept.
- Browser network evidence during the outage: `GET /api/inventory` answered 503 (not 401), and no navigation to `/pair`.
- browser console evidence shows the expected error "Could not reach Porcelain to restore this browser session."
- `apps/web/spec/e2e/access-restore-outage.e2e.ts`: pairs, opens Files, makes inventory answer 503 and reloads; asserts the workspace error, no not-paired heading and the same path; ends the outage and dispatches `online`; asserts "Review content", the same path and Files still selected. A second case opens `/pair` in a paired browser during the outage, asserts the workspace error and no not-paired heading, and after the outage "Review content" away from `/pair`.

## Gotchas

- The retry fires on `online`, `focus` or `visibilitychange`; this controlled promise dispatches the `online` event after restoring responses to bring the workspace back. A reload starts a new load; it does not prove the promised self-recovery.
- The console error "Could not reach Porcelain to restore this browser session." is expected during the outage.
- Phone width: the review panel is a sheet behind `Review`.
