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

## What it is

A Git action still running when the page reloads is still followed after the reload: the app keeps its request in session storage, the commit form shows "Outcome not yet confirmed" and refuses another commit, then shows how the action ended once the app reads its receipt.

## How a user reaches it

- Commit → Commit selected files → reload (or the tab is restored) before the app hears the outcome → Commit again.
- Any Git action from the Git button or Git actions menu is followed the same way; the commit form is the one the test drives.

## Driving it

Start with `$C start`; pair your browser using the card’s pairing-link command; `REPO` is `connection.json` → `fixtures.repositoryPath`. The CLI's server ends a blocked Git action after 1.5 seconds (`gitActionDeadlineMs: 1500`); holding incoming live frames before the commit keeps the page from hearing that outcome, so the reload happens while the page still follows a running action, as the test's held live notices do.

### Setup

Make Git block on its reflog:

```sh
rm "$REPO/.git/logs/HEAD"
mkfifo "$REPO/.git/logs/HEAD"
```

1. Click button named `Commit`
   Look for: dialog "Commit changes" with textbox "Message".
2. Replace the contents of textbox named `Message` with 'Commit across a reload'
   Look for: button "Commit selected files" is enabled.
3. Hold incoming live frames while forwarding the real connection (see [routing recipes and per-map instructions](../references/failure-injection.md)), then click button named `Commit selected files`
   Look for: button "Committing…" [disabled] in the dialog.
4. Navigate to `/` on the card’s web URL (full page load)
   Look for: the page reloads in the same browser context; keep incoming frames held so the UI has not yet confirmed the action outcome.
5. Click button named `Commit`
   Look for: dialog "Commit changes" with status "Outcome not yet confirmed" and button "Commit selected files" [disabled]: the reloaded page still follows the commit.
6. Keep frames held until `$C server receipt <requestId>` reports `"state": "interrupted"` (take the ID from the accepted action POST), then release held incoming frames (see [routing recipes and per-map instructions](../references/failure-injection.md)), then wait for text 'interrupted' to be visible
   Look for: the held live frames arrive; the dialog's status now reads "interrupted" and "Outcome not yet confirmed" is gone.

## What proves it works

- After a reload while the action runs: "Outcome not yet confirmed" with Commit selected files disabled, then the `status` "interrupted" and "Outcome not yet confirmed" gone; the browser network evidence shows `GET /api/worktrees/<id>/git/receipts/<requestId>` with status 200 after the reload, and `$C server receipt <requestId>` prints the commit's receipt.
- `git -C "$REPO" log --format=%s` still prints only `Initial commit`.
- `apps/web/spec/e2e/git-actions-reload-running.e2e.ts`: with live notices held, the commit is running ("Committing…" disabled, "running") when the page reloads; after the reload the commit form shows "Outcome not yet confirmed" and a disabled Commit selected files; releasing the live notices shows "interrupted" and removes "Outcome not yet confirmed"; the server reports the commit as the interrupted action.

## Gotchas

- Arm the incoming-frame hold before submitting the commit and keep it across the reload. The server deadline is 1.5 seconds; use one bounded browser operation so inspection does not miss the followed state. After inspecting the reloaded pending form, await the terminal server receipt before releasing held frames; a fast reload can otherwise still read `running`.
- The server kills the stuck Git with SIGKILL, leaving lock files: run `rm -f "$REPO/.git/logs/HEAD" "$REPO"/.git/*.lock "$REPO/.git/refs/heads/main.lock"` and dismiss the notice with button "Got it" before driving another Git feature, or start a fresh instance.
