---
route: /
selectors:
  - "README.md"
  - "Find a file by name"
  - "No file matches that name."
tests:
  - apps/web/spec/integration/files-quick-open.test.tsx
api:
  - GET /api/worktrees/:worktreeId/paths
  - GET /api/worktrees/:worktreeId/text
---

# files.quick-open

## What it is

Quick open finds a worktree file by name and opens it, and finds no file an ignore rule hides.

## How a user reaches it

- Review → Files → Mod+P → Find a file by name
- Shortcut: `Mod+P`

## Driving it

Start an instance first: `.agents/skills/web-verify/scripts/cli start`.

### 1. Quick open finds a worktree file by name and opens it

```sh
.agents/skills/web-verify/scripts/cli open /
```

After `open`, look for: the treeitem “README.md” shows.
1. `.agents/skills/web-verify/scripts/cli press ControlOrMeta+p`
   Look for: the combobox “Find a file by name” shows.
2. `.agents/skills/web-verify/scripts/cli fill --role combobox --name "Find a file by name" "quick"`
   Look for: the page settles; take a snapshot to read what it shows.
3. `.agents/skills/web-verify/scripts/cli click --role option --name "quick-target.md"`
   Look for: the heading “Quick target” shows.

Then `.agents/skills/web-verify/scripts/cli snapshot` and `.agents/skills/web-verify/scripts/cli screenshot` record the end state, and `.agents/skills/web-verify/scripts/cli network` lists the requests the page sent.

### 2. Quick open finds no file an ignore rule hides

```sh
.agents/skills/web-verify/scripts/cli open /
```

1. `.agents/skills/web-verify/scripts/cli press ControlOrMeta+p`
   Look for: the combobox “Find a file by name” shows.
2. `.agents/skills/web-verify/scripts/cli fill --role combobox --name "Find a file by name" "build.log"`
   Look for: the text “No file matches that name.” shows.

Then `.agents/skills/web-verify/scripts/cli snapshot` and `.agents/skills/web-verify/scripts/cli screenshot` record the end state, and `.agents/skills/web-verify/scripts/cli network` lists the requests the page sent.

## What proves it works

- `apps/web/spec/integration/files-quick-open.test.tsx` (Browser Mode integration): quick open finds a worktree file by name and opens it; quick open finds no file an ignore rule hides.
- The tests read back what the server kept through the kit: `server.paths()`.

## Gotchas

- None known.
