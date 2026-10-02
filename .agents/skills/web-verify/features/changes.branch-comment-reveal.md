---
route: /
selectors:
  - "Review"
  - "Branch"
  - "checkpoint"
  - "Comment"
tests:
  - apps/web/spec/e2e/changes-branch-comment-reveal.e2e.ts
api:
  - GET /api/worktrees/:worktreeId/branch-bases
  - GET /api/worktrees/:worktreeId/branch-changes
  - GET /api/worktrees/:worktreeId/comments
  - POST /api/worktrees/:worktreeId/comments
  - POST /api/worktrees/:worktreeId/comments/:threadId/replies
  - PUT /api/worktrees/:worktreeId/comments/:threadId/resolution
---

# changes.branch-comment-reveal

## What it is

Showing a comment written on the branch review opens its file against the base the comment was written against, even after the reviewer chose another base.

## How a user reaches it

- Review → Changes → Comments → branch comment

## Driving it

Start an instance first: `.agents/skills/web-verify/scripts/cli start`.

### Showing a branch comment opens its file against the base it was written against

Before driving, on the instance (the sample repository and project home are in the instance file):

- create the branch `checkpoint`
- create the branch `feature`
- switch the sample repository to `feature`
- write `notes.md` in the sample repository
- commit everything in the sample repository as “Add notes”

```sh
.agents/skills/web-verify/scripts/cli open /
```

1. `.agents/skills/web-verify/scripts/cli click --role button --name "Review"`
   Look for: the page settles; take a snapshot to read what it shows.
2. `.agents/skills/web-verify/scripts/cli click --role tab --name "Branch"`
   Look for: the page settles; take a snapshot to read what it shows.
3. `.agents/skills/web-verify/scripts/cli click --role button --name "Compare against the default branch"`
   Look for: the page settles; take a snapshot to read what it shows.
4. `.agents/skills/web-verify/scripts/cli click --role option --name "checkpoint"`
   Look for: the page settles; take a snapshot to read what it shows.
5. `.agents/skills/web-verify/scripts/cli click --role button --name "notes.md · added"`
   Look for: the page settles; take a snapshot to read what it shows.
6. `.agents/skills/web-verify/scripts/cli click --role button --name "Comment on notes.md (added)"`
   Look for: the page settles; take a snapshot to read what it shows.
7. `.agents/skills/web-verify/scripts/cli fill --role textbox --name "Comment" "Against the checkpoint"`
   Look for: the page settles; take a snapshot to read what it shows.
8. `.agents/skills/web-verify/scripts/cli click --role button --name "Comment"`
   Look for: the page settles; take a snapshot to read what it shows.
9. `.agents/skills/web-verify/scripts/cli click --role button --name "Review"`
   Look for: the page settles; take a snapshot to read what it shows.
10. `.agents/skills/web-verify/scripts/cli click --role button --name "Compare against checkpoint"`
   Look for: the page settles; take a snapshot to read what it shows.
11. `.agents/skills/web-verify/scripts/cli click --role option --name "/^main/u"`
   Look for: the page settles; take a snapshot to read what it shows.
12. `.agents/skills/web-verify/scripts/cli click --role tab --name "/^Comments/u"`
   Look for: the page settles; take a snapshot to read what it shows.
13. `.agents/skills/web-verify/scripts/cli click --role button --name "/^notes\\.md Whole file/u"`
   Look for: the page settles; take a snapshot to read what it shows.

Then `.agents/skills/web-verify/scripts/cli snapshot` and `.agents/skills/web-verify/scripts/cli screenshot` record the end state, and `.agents/skills/web-verify/scripts/cli network` lists the requests the page sent.

## What proves it works

- `apps/web/spec/e2e/changes-branch-comment-reveal.e2e.ts` (Playwright e2e): showing a branch comment opens its file against the base it was written against.
- The tests read back what the server kept through the kit: `server.branchChanges()`, `server.commentThreads()`.

## Gotchas

- The CLI browser is phone width (414 by 896), so the review panel opens from the Review button instead of standing beside the document.
