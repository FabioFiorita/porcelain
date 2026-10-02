---
route: /
selectors:
  - "Toggle Sidebar"
  - "repository"
  - "Remove from Porcelain"
  - "No projects registered"
  - "Select a worktree"
  - "Open project"
  - "Folder path"
tests:
  - apps/web/spec/e2e/projects-open-linked-worktree.e2e.ts
api:
  - DELETE /api/projects/:projectId
  - POST /api/projects
---

# projects.open-linked-worktree

## What it is

Opening a repository with a linked worktree from the empty workspace shows the worktree the dialog opened, and leaves no empty workspace behind in the history.

## How a user reaches it

- empty workspace → sidebar → Open project → Browse for a folder → repository with a linked worktree → Open

## Driving it

Start an instance first: `.agents/skills/web-verify/scripts/cli start`.

### Opening a repository with a linked worktree from the empty workspace after a reload shows the worktree it opened, leaving no empty workspace to go back to

Before driving, on the instance (the sample repository and project home are in the instance file):

- add a linked worktree `linked` beside the sample repository

```sh
.agents/skills/web-verify/scripts/cli open /
```

1. `.agents/skills/web-verify/scripts/cli click --role button --name "Toggle Sidebar"`
   Look for: the page settles; take a snapshot to read what it shows.
2. `.agents/skills/web-verify/scripts/cli click --role button --name "repository" --button right`
   Look for: the page settles; take a snapshot to read what it shows.
3. `.agents/skills/web-verify/scripts/cli click --role menuitem --name "Remove from Porcelain"`
   Look for: the page settles; take a snapshot to read what it shows.
4. `.agents/skills/web-verify/scripts/cli click --role button --name "Remove from Porcelain"`
   Look for: the text “No projects registered” shows; the text “Select a worktree” shows.
5. `.agents/skills/web-verify/scripts/cli click --role button --name "Toggle Sidebar"`
   Look for: the page settles; take a snapshot to read what it shows.
6. `.agents/skills/web-verify/scripts/cli click --role button --name "Open project"`
   Look for: the navigation “Folder path” shows.
7. `.agents/skills/web-verify/scripts/cli click --role button`
   Look for: the page settles; take a snapshot to read what it shows.
8. `.agents/skills/web-verify/scripts/cli click --role dialog --name "Open project"`
   Look for: the dialog “Open project” is gone; the button “/Main worktree/” shows.

Then `.agents/skills/web-verify/scripts/cli snapshot` and `.agents/skills/web-verify/scripts/cli screenshot` record the end state, and `.agents/skills/web-verify/scripts/cli network` lists the requests the page sent.

## What proves it works

- `apps/web/spec/e2e/projects-open-linked-worktree.e2e.ts` (Playwright e2e): opening a repository with a linked worktree from the empty workspace after a reload shows the worktree it opened, leaving no empty workspace to go back to.
- The tests read back what the server kept through the kit: `server.inventory()`, `server.project()`.

## Gotchas

- None known.
