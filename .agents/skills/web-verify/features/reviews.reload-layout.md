---
route: /
selectors:
  - "Pin"
  - "Review"
  - "Changes"
  - "All changes"
tests:
  - apps/web/spec/e2e/reviews-reload-layout.e2e.ts
api:
  - GET /api/worktrees/:worktreeId/text
  - POST /api/worktrees/:worktreeId/changes/diffs
---

# reviews.reload-layout

## What it is

Open tabs, a pinned tab and a collapsed diff are restored after the page reloads.

## How a user reaches it

- Review → Files → open two files → tab → right-click → Pin → collapse a diff → reload

## Driving it

Start an instance first: `.agents/skills/web-verify/scripts/cli start`.

### Open tabs, a pinned tab and a collapsed diff come back after a reload

Before driving, on the instance (the sample repository and project home are in the instance file):

- write `notes.md` in the sample repository

```sh
.agents/skills/web-verify/scripts/cli open /
```

1. `.agents/skills/web-verify/scripts/cli click --role tab --name "/README.md/" --button right`
   Look for: the page settles; take a snapshot to read what it shows.
2. `.agents/skills/web-verify/scripts/cli click --role menuitem --name "Pin"`
   Look for: the page settles; take a snapshot to read what it shows.
3. `.agents/skills/web-verify/scripts/cli click --role button --name "Review"`
   Look for: the page settles; take a snapshot to read what it shows.
4. `.agents/skills/web-verify/scripts/cli click --role tab --name "Changes"`
   Look for: the page settles; take a snapshot to read what it shows.
5. `.agents/skills/web-verify/scripts/cli click --role button --name "All changes"`
   Look for: the tab “/notes.md/” shows.

Then `.agents/skills/web-verify/scripts/cli snapshot` and `.agents/skills/web-verify/scripts/cli screenshot` record the end state, and `.agents/skills/web-verify/scripts/cli network` lists the requests the page sent.

## What proves it works

- `apps/web/spec/e2e/reviews-reload-layout.e2e.ts` (Playwright e2e): open tabs, a pinned tab and a collapsed diff come back after a reload.

## Gotchas

- The CLI browser is phone width (414 by 896), so the review panel opens from the Review button instead of standing beside the document.
