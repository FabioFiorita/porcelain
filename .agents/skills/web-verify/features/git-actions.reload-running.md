---
route: /
selectors:
  - "Commit"
  - "Message"
  - "Commit selected files"
  - "Committing…"
  - "running"
  - "Outcome not yet confirmed"
  - "interrupted"
tests:
  - apps/web/spec/e2e/git-actions-reload-running.e2e.ts
api:
  - GET /api/worktrees/:worktreeId/git/receipts/:requestId
  - POST /api/worktrees/:worktreeId/git/actions
---

# git-actions.reload-running

## What it is

A Git action still running when the page reloads is still followed after the reload: the commit form waits for its outcome and refuses another commit, then shows how it ended once the app reads its receipt.

## How a user reaches it

- Commit → Commit selected files → reload before the app hears its outcome → Commit

## Driving it

Start an instance first: `.agents/skills/web-verify/scripts/cli start`.

### A commit still running when the page reloads is still followed: the commit form waits for its outcome, then shows it ended interrupted

Before driving, on the instance (the sample repository and project home are in the instance file):

- delete `.git/logs/HEAD` from the sample repository
- replace `.git/logs/HEAD` with a named pipe, so Git blocks on it

```sh
.agents/skills/web-verify/scripts/cli open /
```

1. `.agents/skills/web-verify/scripts/cli click --role button --name "Commit"`
   Look for: the page settles; take a snapshot to read what it shows.
2. `.agents/skills/web-verify/scripts/cli fill --role textbox --name "Message" "Commit across a reload"`
   Look for: the page settles; take a snapshot to read what it shows.
3. `.agents/skills/web-verify/scripts/cli click --role button --name "Commit selected files"`
   Look for: the button “Committing…” is disabled; the text “running” shows.
4. `.agents/skills/web-verify/scripts/cli click --role button --name "Commit"`
   Look for: the text “Outcome not yet confirmed” shows; the button “Commit selected files” is disabled; the text “interrupted” shows; the text “Outcome not yet confirmed” is gone.

Then `.agents/skills/web-verify/scripts/cli snapshot` and `.agents/skills/web-verify/scripts/cli screenshot` record the end state, and `.agents/skills/web-verify/scripts/cli network` lists the requests the page sent.

## What proves it works

- `apps/web/spec/e2e/git-actions-reload-running.e2e.ts` (Playwright e2e): a commit still running when the page reloads is still followed: the commit form waits for its outcome, then shows it ended interrupted.
- The tests read back what the server kept through the kit: `server.changes()`.

## Gotchas

- The tests hold or drop the live connection or a request to reach a race; the CLI cannot, so an agent drives the ordinary path and leaves the race to the tests.
