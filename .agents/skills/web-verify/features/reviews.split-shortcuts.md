---
route: /
selectors:
  - "Review"
  - "Files"
  - "README.md"
  - "Open file"
tests:
  - apps/web/spec/integration/reviews-split-shortcuts.test.tsx
api:
  - GET /api/worktrees/:worktreeId/directory
  - GET /api/worktrees/:worktreeId/text
---

# reviews.split-shortcuts

## What it is

In a split view the tab shortcuts act on the focused pane alone, and opening the split registers them once.

## How a user reaches it

- Review → Files → README.md → Open file → tab → Open to the side
- Shortcut: `Alt+W`

## Driving it

Start an instance first: `.agents/skills/web-verify/scripts/cli start`.

### In a split view Alt+W closes the tab of the focused pane alone, and opening the split registers the tab shortcuts once

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
5. `.agents/skills/web-verify/scripts/cli click --role tab --button right`
   Look for: the page settles; take a snapshot to read what it shows.
6. `.agents/skills/web-verify/scripts/cli click --role menuitem --name "/Open to the side/"`
   Look for: the tab shows.
7. `.agents/skills/web-verify/scripts/cli click --role tab`
   Look for: the page settles; take a snapshot to read what it shows.
8. `.agents/skills/web-verify/scripts/cli press Alt+w`
   Look for: the region “Right pane” is gone; the tab shows.

Then `.agents/skills/web-verify/scripts/cli snapshot` and `.agents/skills/web-verify/scripts/cli screenshot` record the end state, and `.agents/skills/web-verify/scripts/cli network` lists the requests the page sent.

## What proves it works

- `apps/web/spec/integration/reviews-split-shortcuts.test.tsx` (Browser Mode integration): in a split view Alt+W closes the tab of the focused pane alone, and opening the split registers the tab shortcuts once.

## Gotchas

- The CLI browser is phone width (414 by 896), so the review panel opens from the Review button instead of standing beside the document.
