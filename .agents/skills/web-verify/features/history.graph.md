---
route: /
selectors:
  - "Review"
  - "History"
  - "Open graph"
  - "Merge commit"
  - "topic"
tests:
  - apps/web/spec/e2e/history-graph.e2e.ts
api:
  - GET /api/worktrees/:worktreeId/commits
  - GET /api/worktrees/:worktreeId/commits/:oid/files
---

# history.graph

## What it is

Open graph opens the commit graph of the branch as a document tab with its lanes, merges and refs, the tab comes back after a reload, and clicking a commit in it opens that commit.

## How a user reaches it

- Review → History → Open graph → commit

## Driving it

Start an instance first: `.agents/skills/web-verify/scripts/cli start`.

### Open graph opens the commit graph as a tab that comes back after a reload, and clicking the merge commit in it opens its document

Before driving, on the instance (the sample repository and project home are in the instance file):

- create the branch `topic`
- switch the sample repository to `topic`
- write `topic.md` in the sample repository
- commit everything in the sample repository as “Add the topic notes”
- switch the sample repository to `undefined`
- write `steps.md` in the sample repository
- commit everything in the sample repository as “Write the review steps”
- merge `topic` with a merge commit

```sh
.agents/skills/web-verify/scripts/cli open /
```

1. `.agents/skills/web-verify/scripts/cli click --role button --name "Review"`
   Look for: the page settles; take a snapshot to read what it shows.
2. `.agents/skills/web-verify/scripts/cli click --role tab --name "History"`
   Look for: the page settles; take a snapshot to read what it shows.
3. `.agents/skills/web-verify/scripts/cli click --role button --name "Open graph"`
   Look for: the tab “/^Graph/” has aria-selected="true"; the img “Merge commit” shows; the text “topic” shows; the tab “/^Graph/” has aria-selected="true".
4. `.agents/skills/web-verify/scripts/cli click --role button --name "/^Merge commit ?Merge branch 'topic'/"`
   Look for: the heading “/^Merge branch 'topic'/” shows; the tab “/^Graph/” has aria-selected="false".

Then `.agents/skills/web-verify/scripts/cli snapshot` and `.agents/skills/web-verify/scripts/cli screenshot` record the end state, and `.agents/skills/web-verify/scripts/cli network` lists the requests the page sent.

## What proves it works

- `apps/web/spec/e2e/history-graph.e2e.ts` (Playwright e2e): Open graph opens the commit graph as a tab that comes back after a reload, and clicking the merge commit in it opens its document.
- The tests read back what the server kept through the kit: `server.commits()`.

## Gotchas

- The CLI browser is phone width (414 by 896), so the review panel opens from the Review button instead of standing beside the document.
