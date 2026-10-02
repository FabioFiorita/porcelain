---
route: /
selectors:
  - "Review"
  - "Branch"
  - "Comment"
  - "Waiting for the agent"
tests:
  - apps/web/spec/e2e/changes-review-branch.e2e.ts
api:
  - DELETE /api/worktrees/:worktreeId/reviewed
  - DELETE /api/worktrees/:worktreeId/reviewed-bulk
  - GET /api/worktrees/:worktreeId/branch-bases
  - GET /api/worktrees/:worktreeId/branch-changes
  - GET /api/worktrees/:worktreeId/comments
  - GET /api/worktrees/:worktreeId/reviewed
  - POST /api/worktrees/:worktreeId/branch-changes/diffs
  - POST /api/worktrees/:worktreeId/comments
  - POST /api/worktrees/:worktreeId/comments/:threadId/replies
  - PUT /api/worktrees/:worktreeId/comments/:threadId/resolution
  - PUT /api/worktrees/:worktreeId/reviewed
  - PUT /api/worktrees/:worktreeId/reviewed-bulk
---

# changes.review-branch

## What it is

Reviewing the branch lists every file committed since it forked from the default branch, opens the diff of one, marks it reviewed in the branch review without touching the uncommitted review, and saves a comment on it against the branch comparison.

## How a user reaches it

- Review → Changes → Branch → file

## Driving it

Start an instance first: `.agents/skills/web-verify/scripts/cli start`.

### 1. Reviewing the branch lists the files committed since the default branch and opens the diff of one

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
2. `.agents/skills/web-verify/scripts/cli click --role tab --name "Branch"`
   Look for: the text “1 commit on feature since main” shows; the button “README.md · modified” shows.
3. `.agents/skills/web-verify/scripts/cli click --role button --name "notes.md · added"`
   Look for: the text “notes.md · on the branch” shows; the text “second line” shows.

Then `.agents/skills/web-verify/scripts/cli snapshot` and `.agents/skills/web-verify/scripts/cli screenshot` record the end state, and `.agents/skills/web-verify/scripts/cli network` lists the requests the page sent.

### 2. Marking a branch file reviewed keeps the mark in the branch review only

```sh
.agents/skills/web-verify/scripts/cli open /
```

1. `.agents/skills/web-verify/scripts/cli click --role button --name "Mark notes.md as reviewed"`
   Look for: the button “Unmark notes.md as unreviewed” is enabled.

Then `.agents/skills/web-verify/scripts/cli snapshot` and `.agents/skills/web-verify/scripts/cli screenshot` record the end state, and `.agents/skills/web-verify/scripts/cli network` lists the requests the page sent.

### 3. A comment on a branch file is saved against the branch and waits for the agent

```sh
.agents/skills/web-verify/scripts/cli open /
```

1. `.agents/skills/web-verify/scripts/cli click --role button --name "Comment on notes.md (added)"`
   Look for: the page settles; take a snapshot to read what it shows.
2. `.agents/skills/web-verify/scripts/cli fill --role textbox --name "Comment" "Why a second line?"`
   Look for: the page settles; take a snapshot to read what it shows.
3. `.agents/skills/web-verify/scripts/cli click --role button --name "Comment"`
   Look for: the text “Waiting for the agent” shows.

Then `.agents/skills/web-verify/scripts/cli snapshot` and `.agents/skills/web-verify/scripts/cli screenshot` record the end state, and `.agents/skills/web-verify/scripts/cli network` lists the requests the page sent.

## What proves it works

- `apps/web/spec/e2e/changes-review-branch.e2e.ts` (Playwright e2e): reviewing the branch lists the files committed since the default branch and opens the diff of one; marking a branch file reviewed keeps the mark in the branch review only; a comment on a branch file is saved against the branch and waits for the agent.
- The tests read back what the server kept through the kit: `server.branchChanges()`, `server.commentThreads()`, `server.reviewedFiles()`.

## Gotchas

- The CLI browser is phone width (414 by 896), so the review panel opens from the Review button instead of standing beside the document.
