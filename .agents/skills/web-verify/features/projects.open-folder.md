---
route: /
selectors:
  - "Toggle Sidebar"
  - "Open project"
  - "plain"
  - "No subfolders."
  - "Pick a folder that is a Git repository."
  - "Up"
  - "Every worktree appears in the sidebar."
tests:
  - apps/web/spec/e2e/projects-open-folder.e2e.ts
api:
  - GET /api/projects/folders
  - POST /api/projects
---

# projects.open-folder

## What it is

Browsing the server folders from the Open project dialog opens a Git repository as a registered project in the navigator, and a folder that is not a repository cannot be opened.

## How a user reaches it

- sidebar → Open project → Browse for a folder → folder → Open

## Driving it

Start an instance first: `.agents/skills/web-verify/scripts/cli start`.

### 1. A folder that is not a Git repository cannot be opened by browsing

Before driving, on the instance (the sample repository and project home are in the instance file):

- make the plain folder `plain` in the project home

```sh
.agents/skills/web-verify/scripts/cli open /
```

1. `.agents/skills/web-verify/scripts/cli click --role button --name "Toggle Sidebar"`
   Look for: the page settles; take a snapshot to read what it shows.
2. `.agents/skills/web-verify/scripts/cli click --role button --name "Open project"`
   Look for: the page settles; take a snapshot to read what it shows.
3. `.agents/skills/web-verify/scripts/cli click --role button --name "plain"`
   Look for: the text “No subfolders.” shows; the text “Pick a folder that is a Git repository.” shows; the button “Open plain” is disabled.

Then `.agents/skills/web-verify/scripts/cli snapshot` and `.agents/skills/web-verify/scripts/cli screenshot` record the end state, and `.agents/skills/web-verify/scripts/cli network` lists the requests the page sent.

### 2. Browsing to a Git repository opens it as a project in the navigator and the server registers it

Before driving, on the instance (the sample repository and project home are in the instance file):

- make the Git repository `browsed` in the project home
- make the plain folder `plain` in the project home

```sh
.agents/skills/web-verify/scripts/cli open /
```

1. `.agents/skills/web-verify/scripts/cli click --role button --name "Toggle Sidebar"`
   Look for: the page settles; take a snapshot to read what it shows.
2. `.agents/skills/web-verify/scripts/cli click --role button --name "Open project"`
   Look for: the page settles; take a snapshot to read what it shows.
3. `.agents/skills/web-verify/scripts/cli click --role button --name "plain"`
   Look for: the text “No subfolders.” shows.
4. `.agents/skills/web-verify/scripts/cli click --role button --name "Up"`
   Look for: the page settles; take a snapshot to read what it shows.
5. `.agents/skills/web-verify/scripts/cli click --role button --name "browsed"`
   Look for: the text “Every worktree appears in the sidebar.” shows.
6. `.agents/skills/web-verify/scripts/cli click --role button --name "Open browsed"`
   Look for: the dialog “Open project” is gone; the button “browsed” shows.

Then `.agents/skills/web-verify/scripts/cli snapshot` and `.agents/skills/web-verify/scripts/cli screenshot` record the end state, and `.agents/skills/web-verify/scripts/cli network` lists the requests the page sent.

## What proves it works

- `apps/web/spec/e2e/projects-open-folder.e2e.ts` (Playwright e2e): a folder that is not a Git repository cannot be opened by browsing; browsing to a Git repository opens it as a project in the navigator and the server registers it.
- The tests read back what the server kept through the kit: `server.inventory()`.

## Gotchas

- None known.
