---
route: /
selectors:
  - "Review"
  - "History"
  - "Merge commit"
  - "topic"
  - "Commit graph"
  - "Open graph"
tests:
  - apps/web/spec/integration/history-list.test.tsx
api:
  - GET /api/worktrees/:worktreeId/commits
---

# history.list

## What it is

The History list gives each commit its message, short id, author, age and ref chips without a graph beside it, and marks a merge commit with a merge icon.

## How a user reaches it

- Review → History

## Driving it

Start an instance first: `.agents/skills/web-verify/scripts/cli start`.

### History lists each commit message without a graph beside it and marks a merge commit with a merge icon

Before driving, on the instance (the sample repository and project home are in the instance file):

- create the branch `topic`
- switch the sample repository to `topic`
- write `topic.md` in the sample repository
- commit everything in the sample repository as “Add the topic notes”
- switch the sample repository to `undefined`
- write `steps.md` in the sample repository
- commit everything in the sample repository as “undefined”
- merge `topic` with a merge commit

```sh
.agents/skills/web-verify/scripts/cli open /
```

1. `.agents/skills/web-verify/scripts/cli click --role button --name "Review"`
   Look for: the page settles; take a snapshot to read what it shows.
2. `.agents/skills/web-verify/scripts/cli click --role tab --name "History"`
   Look for: the img “Merge commit” shows; the text shows; the img “Merge commit” is gone; the text “topic” shows; the list “Commit graph” is gone; the button “Open graph” shows.

Then `.agents/skills/web-verify/scripts/cli snapshot` and `.agents/skills/web-verify/scripts/cli screenshot` record the end state, and `.agents/skills/web-verify/scripts/cli network` lists the requests the page sent.

## What proves it works

- `apps/web/spec/integration/history-list.test.tsx` (Browser Mode integration): History lists each commit message without a graph beside it and marks a merge commit with a merge icon.
- The tests read back what the server kept through the kit: `server.commits()`.

## Gotchas

- The CLI browser is phone width (414 by 896), so the review panel opens from the Review button instead of standing beside the document.
