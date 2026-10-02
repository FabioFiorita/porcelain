---
route: /
selectors:
  - "Review"
  - "Discard"
  - "Restore"
  - "Look again"
tests:
  - apps/web/spec/integration/git-actions-discard.test.tsx
api:
  - POST /api/worktrees/:worktreeId/git/actions
---

# git-actions.discard

## What it is

Discarding a changed file returns it to the last commit and Restore brings the change back, while a file that changed after the dialog opened is refused and keeps its newer text.

## How a user reaches it

- Review → changed file → Discard → Discard, then Restore

## Driving it

Start an instance first: `.agents/skills/web-verify/scripts/cli start`.

### 1. Discarding a changed file returns it to the last commit, and Restore brings the change back

```sh
.agents/skills/web-verify/scripts/cli open /
```

1. `.agents/skills/web-verify/scripts/cli click --role button --name "Review"`
   Look for: the page settles; take a snapshot to read what it shows.
2. `.agents/skills/web-verify/scripts/cli click --role button --name "Discard"`
   Look for: the text “Discarded README.md” shows.
3. `.agents/skills/web-verify/scripts/cli click --role button --name "Restore"`
   Look for: the text “Restored README.md” shows.

Then `.agents/skills/web-verify/scripts/cli snapshot` and `.agents/skills/web-verify/scripts/cli screenshot` record the end state, and `.agents/skills/web-verify/scripts/cli network` lists the requests the page sent.

### 2. Discarding a file that changed after the dialog opened is refused and keeps the newer text

Before driving, on the instance (the sample repository and project home are in the instance file):

- write `README.md` in the sample repository

```sh
.agents/skills/web-verify/scripts/cli open /
```

1. `.agents/skills/web-verify/scripts/cli click --role button --name "Review"`
   Look for: the page settles; take a snapshot to read what it shows.
2. `.agents/skills/web-verify/scripts/cli click --role button --name "Discard"`
   Look for: the alert reads /Look at the diff again before discarding\./; the button “Look again” shows.

Then `.agents/skills/web-verify/scripts/cli snapshot` and `.agents/skills/web-verify/scripts/cli screenshot` record the end state, and `.agents/skills/web-verify/scripts/cli network` lists the requests the page sent.

## What proves it works

- `apps/web/spec/integration/git-actions-discard.test.tsx` (Browser Mode integration): discarding a changed file returns it to the last commit, and Restore brings the change back; discarding a file that changed after the dialog opened is refused and keeps the newer text.
- The tests read back what the server kept through the kit: `server.text()`.

## Gotchas

- The CLI browser is phone width (414 by 896), so the review panel opens from the Review button instead of standing beside the document.
