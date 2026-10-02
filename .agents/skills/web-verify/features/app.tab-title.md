---
route: /
selectors:
  - "Review"
  - "Files"
  - "README.md"
  - "Open file"
  - "History"
tests:
  - apps/web/spec/e2e/app-tab-title.e2e.ts
api:
  - GET /api/inventory
  - GET /api/worktrees/:worktreeId/commits
  - GET /api/worktrees/:worktreeId/text
---

# app.tab-title

## What it is

The browser tab is titled after the open file, commit or surface, followed by the project.

## How a user reaches it

- The browser tab while a worktree is open → Files → README.md → Open file, then History → a commit

## Driving it

Start an instance first: `.agents/skills/web-verify/scripts/cli start`.

### The browser tab follows the open surface, file and commit

Before driving, on the instance (the sample repository and project home are in the instance file):

- commit everything in the sample repository as “Name the tab after the commit”

```sh
.agents/skills/web-verify/scripts/cli open /
```

1. `.agents/skills/web-verify/scripts/cli click --role button --name "Review"`
   Look for: the page settles; take a snapshot to read what it shows.
2. `.agents/skills/web-verify/scripts/cli click --role tab --name "Files"`
   Look for: the page settles; take a snapshot to read what it shows.
3. `.agents/skills/web-verify/scripts/cli click --role treeitem --name "README.md" --button right`
   Look for: the page settles; take a snapshot to read what it shows.
4. `.agents/skills/web-verify/scripts/cli click --role menuitem --name "Open file"`
   Look for: the page settles; take a snapshot to read what it shows.
5. `.agents/skills/web-verify/scripts/cli click --role button --name "Review"`
   Look for: the page settles; take a snapshot to read what it shows.
6. `.agents/skills/web-verify/scripts/cli click --role tab --name "History"`
   Look for: the page settles; take a snapshot to read what it shows.

Then `.agents/skills/web-verify/scripts/cli snapshot` and `.agents/skills/web-verify/scripts/cli screenshot` record the end state, and `.agents/skills/web-verify/scripts/cli network` lists the requests the page sent.

## What proves it works

- `apps/web/spec/e2e/app-tab-title.e2e.ts` (Playwright e2e): the browser tab follows the open surface, file and commit.
- The tests read back what the server kept through the kit: `server.commits()`, `server.project()`.

## Gotchas

- The CLI browser is phone width (414 by 896), so the review panel opens from the Review button instead of standing beside the document.
