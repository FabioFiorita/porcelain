---
route: /
selectors:
  - "Commit"
  - "Message"
  - "Commit selected files"
  - "Committing…"
  - "succeeded"
  - "Git actions"
  - "Stash changes"
  - "Pop stash"
  - "Working…"
tests:
  - apps/web/spec/integration/git-actions-follow-receipt.test.tsx
api:
  - GET /api/worktrees/:worktreeId/git/receipts/:requestId
  - POST /api/worktrees/:worktreeId/git/actions
---

# git-actions.follow-receipt

## What it is

A Git action that settles while the live connection is down stays in progress until the app reconnects, then the app reads its receipt and shows how it ended, whether it succeeded or Git refused it.

## How a user reaches it

- Commit → Commit selected files while the live connection is down, then it reconnects

## Driving it

Start an instance first: `.agents/skills/web-verify/scripts/cli start`.

### 1. A commit made while the live connection is down shows its outcome once the app reconnects and reads the receipt

```sh
.agents/skills/web-verify/scripts/cli open /
```

1. `.agents/skills/web-verify/scripts/cli click --role button --name "Commit"`
   Look for: the page settles; take a snapshot to read what it shows.
2. `.agents/skills/web-verify/scripts/cli fill --role textbox --name "Message" "Followed commit"`
   Look for: the page settles; take a snapshot to read what it shows.
3. `.agents/skills/web-verify/scripts/cli click --role button --name "Commit selected files"`
   Look for: the button “Committing…” is disabled; the text “succeeded” shows.
4. `.agents/skills/web-verify/scripts/cli press Escape`
   Look for: the dialog is gone.

Then `.agents/skills/web-verify/scripts/cli snapshot` and `.agents/skills/web-verify/scripts/cli screenshot` record the end state, and `.agents/skills/web-verify/scripts/cli network` lists the requests the page sent.

### 2. A stash pop refused while the live connection is down shows what Git said once the app reconnects and reads the receipt

Before driving, on the instance (the sample repository and project home are in the instance file):

- commit everything in the sample repository as “Followed commit”
- write `README.md` in the sample repository
- write `README.md` in the sample repository

```sh
.agents/skills/web-verify/scripts/cli open /
```

1. `.agents/skills/web-verify/scripts/cli click --role button --name "Git actions"`
   Look for: the page settles; take a snapshot to read what it shows.
2. `.agents/skills/web-verify/scripts/cli click --role menuitem --name "/^Stash changes/"`
   Look for: the page settles; take a snapshot to read what it shows.
3. `.agents/skills/web-verify/scripts/cli click --role button --name "Stash changes"`
   Look for: the text “succeeded” shows.
4. `.agents/skills/web-verify/scripts/cli press Escape`
   Look for: the dialog “Stash changes” is gone.
5. `.agents/skills/web-verify/scripts/cli click --role button --name "Git actions"`
   Look for: the page settles; take a snapshot to read what it shows.
6. `.agents/skills/web-verify/scripts/cli click --role menuitem --name "/^Pop stash/"`
   Look for: the page settles; take a snapshot to read what it shows.
7. `.agents/skills/web-verify/scripts/cli click --role button --name "Pop stash"`
   Look for: the button “Working…” is disabled; the alert reads /would be overwritten/.

Then `.agents/skills/web-verify/scripts/cli snapshot` and `.agents/skills/web-verify/scripts/cli screenshot` record the end state, and `.agents/skills/web-verify/scripts/cli network` lists the requests the page sent.

## What proves it works

- `apps/web/spec/integration/git-actions-follow-receipt.test.tsx` (Browser Mode integration): a commit made while the live connection is down shows its outcome once the app reconnects and reads the receipt; a stash pop refused while the live connection is down shows what Git said once the app reconnects and reads the receipt.
- The tests read back what the server kept through the kit: `server.commits()`, `server.text()`.

## Gotchas

- The tests hold or drop the live connection or a request to reach a race; the CLI cannot, so an agent drives the ordinary path and leaves the race to the tests.
