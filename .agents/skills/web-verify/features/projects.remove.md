---
route: /
selectors:
  - "Toggle Sidebar"
  - "repository"
  - "Remove from Porcelain"
  - "Cancel"
  - "No projects registered"
tests:
  - apps/web/spec/e2e/projects-remove.e2e.ts
api:
  - DELETE /api/projects/:projectId
---

# projects.remove

## What it is

Removing a project after confirming takes it out of the navigator and the server forgets it, while cancelling keeps it.

## How a user reaches it

- sidebar → project → right-click → Remove from Porcelain → confirm

## Driving it

Start an instance first: `.agents/skills/web-verify/scripts/cli start`.

### 1. Cancelling the removal of a project keeps it in the navigator and on the server

```sh
.agents/skills/web-verify/scripts/cli open /
```

1. `.agents/skills/web-verify/scripts/cli click --role button --name "Toggle Sidebar"`
   Look for: the button “repository” shows.
2. `.agents/skills/web-verify/scripts/cli click --role button --name "repository" --button right`
   Look for: the page settles; take a snapshot to read what it shows.
3. `.agents/skills/web-verify/scripts/cli click --role menuitem --name "Remove from Porcelain"`
   Look for: the page settles; take a snapshot to read what it shows.
4. `.agents/skills/web-verify/scripts/cli click --role button --name "Cancel"`
   Look for: the button “repository” shows.

Then `.agents/skills/web-verify/scripts/cli snapshot` and `.agents/skills/web-verify/scripts/cli screenshot` record the end state, and `.agents/skills/web-verify/scripts/cli network` lists the requests the page sent.

### 2. Removing a project takes it out of the navigator and the server forgets it

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
   Look for: the text “No projects registered” shows.

Then `.agents/skills/web-verify/scripts/cli snapshot` and `.agents/skills/web-verify/scripts/cli screenshot` record the end state, and `.agents/skills/web-verify/scripts/cli network` lists the requests the page sent.

## What proves it works

- `apps/web/spec/e2e/projects-remove.e2e.ts` (Playwright e2e): cancelling the removal of a project keeps it in the navigator and on the server; removing a project takes it out of the navigator and the server forgets it.
- The tests read back what the server kept through the kit: `server.inventory()`, `server.project()`.

## Gotchas

- None known.
