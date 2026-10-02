---
route: /remotes/$environmentId/$projectId/$worktreeId
shell: desktop
selectors:
  - "Toggle Sidebar"
  - "Settings"
  - "Remote computers"
  - "Pairing link"
  - "Add"
  - "Back"
  - "Online"
  - "Open project"
  - "This computer"
  - "elsewhere"
  - "Browse for a repository on the Porcelain server."
  - "here"
tests:
  - apps/web/spec/e2e/projects-open-remote.desktop.e2e.ts
api:
  - GET /api/environment
  - GET /api/inventory
  - GET /api/projects/folders
  - POST /api/pair
  - POST /api/projects
---

# projects.open-remote

## What it is

With a remote computer added, the desktop app's Open project button becomes a menu of This computer and each remote computer by name: choosing a remote computer browses that computer's own folders and registers the repository on it alone, then opens its worktree, while This computer still opens a project on this computer.

## How a user reaches it

- Toggle Sidebar → Open project → the remote computer → Browse for a folder → folder → Open

## Driving it

Start an instance first: `.agents/skills/web-verify/scripts/cli start --desktop`.

### 1. The desktop app opens a project on another computer from the Open project menu and shows its worktree

Before driving, on the instance (the sample repository and project home are in the instance file):

- make the Git repository `elsewhere` in the project home on the remote computer

```sh
.agents/skills/web-verify/scripts/cli open /
```

1. `.agents/skills/web-verify/scripts/cli click --role button --name "Toggle Sidebar"`
   Look for: the page settles; take a snapshot to read what it shows.
2. `.agents/skills/web-verify/scripts/cli click --role button --name "Settings"`
   Look for: the page settles; take a snapshot to read what it shows.
3. `.agents/skills/web-verify/scripts/cli click --role button --name "Remote computers"`
   Look for: the page settles; take a snapshot to read what it shows.
4. `.agents/skills/web-verify/scripts/cli fill --role textbox --name "Pairing link" "<await app.remoteLink()>"`
   Look for: the page settles; take a snapshot to read what it shows.
5. `.agents/skills/web-verify/scripts/cli click --role button --name "Add"`
   Look for: the listitem shows.
6. `.agents/skills/web-verify/scripts/cli click --role button --name "Back"`
   Look for: the page settles; take a snapshot to read what it shows.
7. `.agents/skills/web-verify/scripts/cli click --role button --name "Toggle Sidebar"`
   Look for: the text “Online” shows.
8. `.agents/skills/web-verify/scripts/cli click --role button --name "Open project"`
   Look for: the menuitem “This computer” is enabled.
9. `.agents/skills/web-verify/scripts/cli click --role menuitem`
   Look for: the text “Browse for a repository on <other.environment.name>.” shows.
10. `.agents/skills/web-verify/scripts/cli click --role button --name "elsewhere"`
   Look for: the page settles; take a snapshot to read what it shows.
11. `.agents/skills/web-verify/scripts/cli click --role button --name "Open elsewhere"`
   Look for: the dialog “Open project” is gone; the button “elsewhere” shows.

Then `.agents/skills/web-verify/scripts/cli snapshot` and `.agents/skills/web-verify/scripts/cli screenshot` record the end state, and `.agents/skills/web-verify/scripts/cli network` lists the requests the page sent.

### 2. This computer in the Open project menu still opens a project on this computer

Before driving, on the instance (the sample repository and project home are in the instance file):

- make the Git repository `here` in the project home

```sh
.agents/skills/web-verify/scripts/cli open /
```

1. `.agents/skills/web-verify/scripts/cli click --role button --name "Open project"`
   Look for: the page settles; take a snapshot to read what it shows.
2. `.agents/skills/web-verify/scripts/cli click --role menuitem --name "This computer"`
   Look for: the text “Browse for a repository on the Porcelain server.” shows.
3. `.agents/skills/web-verify/scripts/cli click --role button --name "here"`
   Look for: the page settles; take a snapshot to read what it shows.
4. `.agents/skills/web-verify/scripts/cli click --role button --name "Open here"`
   Look for: the dialog “Open project” is gone; the button “here” shows.

Then `.agents/skills/web-verify/scripts/cli snapshot` and `.agents/skills/web-verify/scripts/cli screenshot` record the end state, and `.agents/skills/web-verify/scripts/cli network` lists the requests the page sent.

## What proves it works

- `apps/web/spec/e2e/projects-open-remote.desktop.e2e.ts` (Playwright e2e): the desktop app opens a project on another computer from the Open project menu and shows its worktree; This computer in the Open project menu still opens a project on this computer.
- The tests read back what the server kept through the kit: `server.inventory()`.

## Gotchas

- Only the desktop app shows this; start the instance with `.agents/skills/web-verify/scripts/cli start --desktop`, which serves the web in the desktop Vite mode.
- The tests start a second disposable server as the remote computer; the CLI starts one server, so pairing a remote needs a second instance started with `start` and a pairing link issued on it.
