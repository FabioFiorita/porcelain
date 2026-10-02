---
route: /
selectors:
  - "Review"
  - "History"
tests:
  - apps/web/spec/integration/history-open-commit.test.tsx
api:
  - GET /api/worktrees/:worktreeId/commits
  - GET /api/worktrees/:worktreeId/commits/:oid/files
  - POST /api/worktrees/:worktreeId/commits/:oid/diffs
---

# history.open-commit

## What it is

Opening a commit from History shows its message, the files it changed with the diff of each text file, and a binary change listed without a code preview that says why.

## How a user reaches it

- Review → History → commit

## Driving it

Start an instance first: `.agents/skills/web-verify/scripts/cli start`.

### 1. Opening a commit from History shows its message, its file and the diff of the line it added

Before driving, on the instance (the sample repository and project home are in the instance file):

- commit everything in the sample repository as “Add a binary logo”

```sh
.agents/skills/web-verify/scripts/cli open /
```

1. `.agents/skills/web-verify/scripts/cli click --role button --name "Review"`
   Look for: the page settles; take a snapshot to read what it shows.
2. `.agents/skills/web-verify/scripts/cli click --role tab --name "History"`
   Look for: the heading “Add a binary logo” shows; the text “1 file changed” shows; the text “A change to review.” shows.

Then `.agents/skills/web-verify/scripts/cli snapshot` and `.agents/skills/web-verify/scripts/cli screenshot` record the end state, and `.agents/skills/web-verify/scripts/cli network` lists the requests the page sent.

### 2. A binary file in a commit is listed without a code preview and says it is a binary change

Before driving, on the instance (the sample repository and project home are in the instance file):

- write `logo.bin` in the sample repository
- commit everything in the sample repository as “Add a binary logo”

```sh
.agents/skills/web-verify/scripts/cli open /
```

1. `.agents/skills/web-verify/scripts/cli click --role button --name "Review"`
   Look for: the page settles; take a snapshot to read what it shows.
2. `.agents/skills/web-verify/scripts/cli click --role tab --name "History"`
   Look for: the heading “Add a binary logo” shows; the text “logo.bin” shows; the text “added · Binary change” shows.

Then `.agents/skills/web-verify/scripts/cli snapshot` and `.agents/skills/web-verify/scripts/cli screenshot` record the end state, and `.agents/skills/web-verify/scripts/cli network` lists the requests the page sent.

## What proves it works

- `apps/web/spec/integration/history-open-commit.test.tsx` (Browser Mode integration): opening a commit from History shows its message, its file and the diff of the line it added; a binary file in a commit is listed without a code preview and says it is a binary change.
- The tests read back what the server kept through the kit: `server.commits()`.

## Gotchas

- The CLI browser is phone width (414 by 896), so the review panel opens from the Review button instead of standing beside the document.
