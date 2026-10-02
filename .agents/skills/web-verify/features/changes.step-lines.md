---
route: /
selectors:
  - "Code changed since the review was written."
tests:
  - apps/web/spec/integration/changes-step-lines.test.tsx
api:
  - GET /api/worktrees/:worktreeId/changes/lines
  - GET /api/worktrees/:worktreeId/review
---

# changes.step-lines

## What it is

A published review step that points at worktree lines shows those lines as they are on disk, and says the code changed once another writer rewrites them.

## How a user reaches it

- Review → Review → layer → step, after an agent published a review

## Driving it

Start an instance first: `.agents/skills/web-verify/scripts/cli start`.

### 1. A review step that points at worktree lines shows those lines from disk

```sh
.agents/skills/web-verify/scripts/cli open /
```

After `open`, look for: the text “A change to review.” shows.

Then `.agents/skills/web-verify/scripts/cli snapshot` and `.agents/skills/web-verify/scripts/cli screenshot` record the end state, and `.agents/skills/web-verify/scripts/cli network` lists the requests the page sent.

### 2. A review step whose lines another writer changed says so instead of showing stale lines

Before driving, on the instance (the sample repository and project home are in the instance file):

- write `README.md` in the sample repository

```sh
.agents/skills/web-verify/scripts/cli open /
```

After `open`, look for: the text “A change to review.” shows.
After `open`, look for: the text “Code changed since the review was written.” shows.
After `open`, look for: the text “A change to review.” is gone.

Then `.agents/skills/web-verify/scripts/cli snapshot` and `.agents/skills/web-verify/scripts/cli screenshot` record the end state, and `.agents/skills/web-verify/scripts/cli network` lists the requests the page sent.

## What proves it works

- `apps/web/spec/integration/changes-step-lines.test.tsx` (Browser Mode integration): a review step that points at worktree lines shows those lines from disk; a review step whose lines another writer changed says so instead of showing stale lines.
- The tests read back what the server kept through the kit: `server.publishedReview()`.

## Gotchas

- None known.
