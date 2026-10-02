---
route: /
selectors:
  - "Change no longer present"
tests:
  - apps/web/spec/integration/files-move.test.tsx
api:
  - GET /api/worktrees/:worktreeId/directory
  - POST /api/worktrees/:worktreeId/files
---

# files.move

## What it is

Dragging a file onto a folder in the tree moves it into that folder on disk without opening it, and dragging one onto a folder that already holds that name is refused and keeps both files.

## How a user reaches it

- Review → Files → drag a file onto a folder

## Driving it

Start an instance first: `.agents/skills/web-verify/scripts/cli start`.

### 1. Dragging a file onto a folder in the tree moves it into that folder on disk

```sh
.agents/skills/web-verify/scripts/cli open /
```

After `open`, look for: the treeitem “move-me.md” is gone.
After `open`, look for: the text “Change no longer present” is gone.

Then `.agents/skills/web-verify/scripts/cli snapshot` and `.agents/skills/web-verify/scripts/cli screenshot` record the end state, and `.agents/skills/web-verify/scripts/cli network` lists the requests the page sent.

### 2. Dragging a file onto a folder that already holds that name is refused and keeps both files

```sh
.agents/skills/web-verify/scripts/cli open /
```

After `open`, look for: the alert reads 'An entry already exists at that path'.
After `open`, look for: the treeitem “clash.md” shows.

Then `.agents/skills/web-verify/scripts/cli snapshot` and `.agents/skills/web-verify/scripts/cli screenshot` record the end state, and `.agents/skills/web-verify/scripts/cli network` lists the requests the page sent.

## What proves it works

- `apps/web/spec/integration/files-move.test.tsx` (Browser Mode integration): dragging a file onto a folder in the tree moves it into that folder on disk; dragging a file onto a folder that already holds that name is refused and keeps both files.
- The tests read back what the server kept through the kit: `server.directory()`, `server.text()`.

## Gotchas

- The CLI has no drag command; the tests drag one tree item onto another, and an agent checks the result through `.agents/skills/web-verify/scripts/cli snapshot` after moving the file another way.
