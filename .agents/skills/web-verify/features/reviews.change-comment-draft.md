---
route: /
selectors:
  - "Review"
  - "Comments"
  - "Branch"
  - "Comment on the whole branch"
  - "Comment"
tests:
  - apps/web/spec/integration/reviews-change-comment-draft.test.tsx
api:
  - GET /api/worktrees/:worktreeId/branch-bases
  - GET /api/worktrees/:worktreeId/branch-changes
  - POST /api/worktrees/:worktreeId/comments
---

# reviews.change-comment-draft

## What it is

A comment on the whole branch being written survives a new commit on the branch and is saved against the tip the branch has when it is posted.

## How a user reaches it

- Review → Comments → Branch → Comment on the whole branch, while the agent commits

## Driving it

Start an instance first: `.agents/skills/web-verify/scripts/cli start`.

### A whole-branch comment being written survives a new commit and is saved at the new tip

Before driving, on the instance (the sample repository and project home are in the instance file):

- create the branch `feature`
- switch the sample repository to `feature`
- write `notes.md` in the sample repository
- commit everything in the sample repository as “Add notes”
- write `notes.md` in the sample repository
- commit everything in the sample repository as “Extend notes”

```sh
.agents/skills/web-verify/scripts/cli open /
```

1. `.agents/skills/web-verify/scripts/cli click --role button --name "Review"`
   Look for: the page settles; take a snapshot to read what it shows.
2. `.agents/skills/web-verify/scripts/cli click --role tab --name "Comments"`
   Look for: the page settles; take a snapshot to read what it shows.
3. `.agents/skills/web-verify/scripts/cli click --role tab --name "Branch"`
   Look for: the page settles; take a snapshot to read what it shows.
4. `.agents/skills/web-verify/scripts/cli click --role button --name "Comment on the whole branch"`
   Look for: the page settles; take a snapshot to read what it shows.
5. `.agents/skills/web-verify/scripts/cli fill --role textbox --name "Comment" "Split the notes before merging"`
   Look for: the textbox “Comment” holds draft.
6. `.agents/skills/web-verify/scripts/cli click --role button --name "Comment"`
   Look for: the text “Split the notes before merging” shows.

Then `.agents/skills/web-verify/scripts/cli snapshot` and `.agents/skills/web-verify/scripts/cli screenshot` record the end state, and `.agents/skills/web-verify/scripts/cli network` lists the requests the page sent.

## What proves it works

- `apps/web/spec/integration/reviews-change-comment-draft.test.tsx` (Browser Mode integration): a whole-branch comment being written survives a new commit and is saved at the new tip.
- The tests read back what the server kept through the kit: `server.branchChanges()`, `server.commentThreads()`.

## Gotchas

- The CLI browser is phone width (414 by 896), so the review panel opens from the Review button instead of standing beside the document.
