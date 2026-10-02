---
route: /
selectors:
  - "Review"
  - "Comments"
  - "Comment on the whole change"
  - "Whole change"
  - "Comment"
  - "Branch"
  - "Comment on the whole branch"
  - "Whole branch"
tests:
  - apps/web/spec/integration/reviews-change-comment.test.tsx
api:
  - POST /api/worktrees/:worktreeId/comments
---

# reviews.change-comment

## What it is

A comment on the whole uncommitted change is saved without a file and waits for the agent, and one on the whole branch is saved against its base and the tip it was read at.

## How a user reaches it

- Review → Comments → Comment on the whole change (Uncommitted) or Comment on the whole branch (Branch)

## Driving it

Start an instance first: `.agents/skills/web-verify/scripts/cli start`.

### The reviewer comments on the whole uncommitted change and then on the whole branch

Before driving, on the instance (the sample repository and project home are in the instance file):

- create the branch `feature`
- switch the sample repository to `feature`
- write `notes.md` in the sample repository
- commit everything in the sample repository as “Add notes”

```sh
.agents/skills/web-verify/scripts/cli open /
```

1. `.agents/skills/web-verify/scripts/cli click --role button --name "Review"`
   Look for: the page settles; take a snapshot to read what it shows.
2. `.agents/skills/web-verify/scripts/cli click --role tab --name "Comments"`
   Look for: the page settles; take a snapshot to read what it shows.
3. `.agents/skills/web-verify/scripts/cli click --role button --name "Comment on the whole change"`
   Look for: the text “Whole change” shows; the button “Comment” is disabled.
4. `.agents/skills/web-verify/scripts/cli fill --role textbox --name "Comment" "Split this into two commits"`
   Look for: the page settles; take a snapshot to read what it shows.
5. `.agents/skills/web-verify/scripts/cli click --role button --name "Comment"`
   Look for: the text “Split this into two commits” shows.
6. `.agents/skills/web-verify/scripts/cli click --role tab --name "Branch"`
   Look for: the button “Comment on the whole branch” is enabled.
7. `.agents/skills/web-verify/scripts/cli click --role button --name "Comment on the whole branch"`
   Look for: the page settles; take a snapshot to read what it shows.
8. `.agents/skills/web-verify/scripts/cli fill --role textbox --name "Comment" "Ready to merge once the notes are in"`
   Look for: the page settles; take a snapshot to read what it shows.
9. `.agents/skills/web-verify/scripts/cli click --role button --name "Comment"`
   Look for: the text “Ready to merge once the notes are in” shows; the text “Whole branch” shows.

Then `.agents/skills/web-verify/scripts/cli snapshot` and `.agents/skills/web-verify/scripts/cli screenshot` record the end state, and `.agents/skills/web-verify/scripts/cli network` lists the requests the page sent.

## What proves it works

- `apps/web/spec/integration/reviews-change-comment.test.tsx` (Browser Mode integration): the reviewer comments on the whole uncommitted change and then on the whole branch.
- The tests read back what the server kept through the kit: `server.branchChanges()`, `server.commentThreads()`.

## Gotchas

- The CLI browser is phone width (414 by 896), so the review panel opens from the Review button instead of standing beside the document.
