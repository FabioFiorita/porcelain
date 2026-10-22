---
route: /
selectors:
  - "Commit"
  - "Message"
  - "Commit selected files"
  - "Committing…"
  - "Outcome not yet confirmed"
  - "A Git action was interrupted:"
tests:
  - apps/web/spec/e2e/git-actions-reload-running.e2e.ts
api:
  - GET /api/worktrees/:worktreeId/git/receipts/:requestId
  - POST /api/worktrees/:worktreeId/git/actions
---

# git-actions.reload-running

A Git action still running when the page reloads is still followed after the reload: the app keeps its request in session storage, the commit form shows "Outcome not yet confirmed" and refuses another commit, then shows how the action ended once the app reads its receipt.

## How to get to it (user POV)

- Commit → Commit selected files → reload (or the tab is restored) before the app hears the outcome → Commit again.
- Any Git action from the Git button or Git actions menu is followed the same way; the commit form is the one the test drives.

## Driving it with browser

Preconditions: [surface baseline](README.md).

Required instance mode: `$C start --git-interruption` (1.5-second action deadline). Hold incoming live frames before committing and across reload; confirm the terminal receipt before releasing them.

### Setup

Make Git block on its reflog:

```sh
rm "$REPO/.git/logs/HEAD"
mkfifo "$REPO/.git/logs/HEAD"
```

1. Click button `Commit`
   Expect: dialog "Commit changes" with textbox "Message".
2. Fill textbox `Message` with 'Commit across a reload'
   Expect: button "Commit selected files" is enabled.
3. Hold incoming live frames while forwarding the real connection (see [routing recipes and per-map instructions](../references/failure-injection.md)), then click button `Commit selected files`
   Expect: button "Committing…" [disabled] in the dialog.
4. Navigate to `/`
   Expect: the page reloads in the same browser context; keep incoming frames held so the UI has not yet confirmed the action outcome.
5. Click button `Commit`
   Expect: dialog "Commit changes" with status "Outcome not yet confirmed" and button "Commit selected files" [disabled]: the reloaded page still follows the commit.
6. Keep frames held until `$C server receipt <requestId>` reports `"state": "interrupted"` (take the ID from the accepted action POST), then release held incoming frames (see [routing recipes and per-map instructions](../references/failure-injection.md)), then wait for 'interrupted'
   Expect: the held live frames arrive; the dialog's status now reads "interrupted" and "Outcome not yet confirmed" is gone.

### Observable proof

Reload while running: Outcome not yet confirmed disables commit, then receipt GET/200 resolves interrupted. `$C server receipt <requestId>` agrees; Git remains Initial commit.

Automated coverage: `git-actions-reload-running.e2e.ts`.

## Gotchas

- Arm the incoming-frame hold before submitting the commit and keep it across the reload. The server deadline is 1.5 seconds; use one bounded browser operation so inspection does not miss the followed state. After inspecting the reloaded pending form, await the terminal server receipt before releasing held frames; a fast reload can otherwise still read `running`.
- The server kills the stuck Git with SIGKILL, leaving lock files: run `rm -f "$REPO/.git/logs/HEAD" "$REPO"/.git/*.lock "$REPO/.git/refs/heads/main.lock"` and dismiss the notice with button "Got it" before driving another Git feature, or start a fresh instance.
