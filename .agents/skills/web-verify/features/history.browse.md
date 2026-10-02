---
route: /
selectors:
  - "Review"
  - "History"
  - "Start of history."
tests:
  - apps/web/spec/integration/history-browse.test.tsx
api:
  - GET /api/worktrees/:worktreeId/commits
---

# history.browse

## What it is

History lists the checked-out branch down to the start of history, shows a commit made on disk as it lands, and drops it when the worktree switches to a branch without it.

## How a user reaches it

- Review → History
- Shortcut: `Alt+3`

## Driving it

Start an instance first: `.agents/skills/web-verify/scripts/cli start`.

### 1. History shows a commit made on disk above the start of history, and the server lists it as the newest commit

Before driving, on the instance (the sample repository and project home are in the instance file):

- create the branch `before-commit`
- commit everything in the sample repository as “Commit made on disk”

```sh
.agents/skills/web-verify/scripts/cli open /
```

1. `.agents/skills/web-verify/scripts/cli click --role button --name "Review"`
   Look for: the page settles; take a snapshot to read what it shows.
2. `.agents/skills/web-verify/scripts/cli click --role tab --name "History"`
   Look for: the text “Start of history.” shows; the text “before-commit” shows.

Then `.agents/skills/web-verify/scripts/cli snapshot` and `.agents/skills/web-verify/scripts/cli screenshot` record the end state, and `.agents/skills/web-verify/scripts/cli network` lists the requests the page sent.

### 2. Switching the worktree to a branch without that commit drops it from History

Before driving, on the instance (the sample repository and project home are in the instance file):

- create the branch `before-commit`
- commit everything in the sample repository as “Commit made on disk”
- switch the sample repository to `before-commit`

```sh
.agents/skills/web-verify/scripts/cli open /
```

1. `.agents/skills/web-verify/scripts/cli click --role button --name "Review"`
   Look for: the page settles; take a snapshot to read what it shows.
2. `.agents/skills/web-verify/scripts/cli click --role tab --name "History"`
   Look for: the button “/^Commit made on disk/” shows; the button “/^Commit made on disk/” is gone.

Then `.agents/skills/web-verify/scripts/cli snapshot` and `.agents/skills/web-verify/scripts/cli screenshot` record the end state, and `.agents/skills/web-verify/scripts/cli network` lists the requests the page sent.

## What proves it works

- `apps/web/spec/integration/history-browse.test.tsx` (Browser Mode integration): History shows a commit made on disk above the start of history, and the server lists it as the newest commit; switching the worktree to a branch without that commit drops it from History.

## Gotchas

- The CLI browser is phone width (414 by 896), so the review panel opens from the Review button instead of standing beside the document.
