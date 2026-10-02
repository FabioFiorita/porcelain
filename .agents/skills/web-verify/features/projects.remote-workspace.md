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
  - "Review"
  - "Files"
  - "README.md"
  - "Open file"
  - "Source"
  - "Review summary"
tests:
  - apps/web/spec/e2e/projects-remote-workspace.desktop.e2e.ts
api:
  - DELETE /api/worktrees/:worktreeId/reviewed
  - DELETE /api/worktrees/:worktreeId/reviewed-bulk
  - GET /api/environment
  - GET /api/inventory
  - GET /api/live
  - GET /api/worktrees/:worktreeId/review
  - GET /api/worktrees/:worktreeId/reviewed
  - GET /api/worktrees/:worktreeId/text
  - POST /api/live/tickets
  - POST /api/pair
  - PUT /api/worktrees/:worktreeId/reviewed
  - PUT /api/worktrees/:worktreeId/reviewed-bulk
---

# projects.remote-workspace

## What it is

The desktop app lists another computer under its own name and status in the sidebar, apart from this computer's projects, and opens its worktree in the full review workspace over that computer's own credential, with the machine in the tab title: a change marked reviewed lands on that computer only, what changes there shows live through a live ticket without a reload, and its HTML summary loads from that computer with working links to its review layers.

## How a user reaches it

- Settings → Remote computers → Add, then Toggle Sidebar → the remote computer → its worktree

## Driving it

Start an instance first: `.agents/skills/web-verify/scripts/cli start --desktop`.

### The desktop app opens another computer’s worktree and HTML review, marks a change reviewed there and shows what changes on it live

Before driving, on the instance (the sample repository and project home are in the instance file):

- write `README.md` in the sample repository on the remote computer
- as the agent, publish a review titled “Remote review layer” through the Porcelain MCP tools on the remote computer

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
   Look for: the text “Online” shows; the button shows; the button is gone; the button shows; the button is gone.
8. `.agents/skills/web-verify/scripts/cli click --role button --name "/Main worktree/"`
   Look for: the page settles; take a snapshot to read what it shows.
9. `.agents/skills/web-verify/scripts/cli click --role button --name "Review"`
   Look for: the page settles; take a snapshot to read what it shows.
10. `.agents/skills/web-verify/scripts/cli click --role tab --name "Files"`
   Look for: the treeitem “README.md” shows.
11. `.agents/skills/web-verify/scripts/cli click --role treeitem --name "README.md" --button right`
   Look for: the page settles; take a snapshot to read what it shows.
12. `.agents/skills/web-verify/scripts/cli click --role menuitem --name "Open file"`
   Look for: the page settles; take a snapshot to read what it shows.
13. `.agents/skills/web-verify/scripts/cli click --role tab --name "Source"`
   Look for: the tab “Source” has aria-selected="true"; the text “Rewritten on the other computer while it is open.” shows.
14. `.agents/skills/web-verify/scripts/cli click --role button --name "Review"`
   Look for: the page settles; take a snapshot to read what it shows.
15. `.agents/skills/web-verify/scripts/cli click --role tab --name "Review"`
   Look for: the page settles; take a snapshot to read what it shows.
16. `.agents/skills/web-verify/scripts/cli click --role button --name "Review summary"`
   Look for: the page settles; take a snapshot to read what it shows.
17. `.agents/skills/web-verify/scripts/cli click --role link --name "Open remote layer"`
   Look for: the page settles; take a snapshot to read what it shows.

Then `.agents/skills/web-verify/scripts/cli snapshot` and `.agents/skills/web-verify/scripts/cli screenshot` record the end state, and `.agents/skills/web-verify/scripts/cli network` lists the requests the page sent.

## What proves it works

- `apps/web/spec/e2e/projects-remote-workspace.desktop.e2e.ts` (Playwright e2e): the desktop app opens another computer’s worktree and HTML review, marks a change reviewed there and shows what changes on it live.
- The tests read back what the server kept through the kit: `server.inventory()`, `server.liveTicketHits()`, `server.project()`, `server.reviewedFiles()`, `server.text()`.

## Gotchas

- Only the desktop app shows this; start the instance with `.agents/skills/web-verify/scripts/cli start --desktop`, which serves the web in the desktop Vite mode.
- The CLI browser is phone width (414 by 896), so the review panel opens from the Review button instead of standing beside the document.
- The tests start a second disposable server as the remote computer; the CLI starts one server, so pairing a remote needs a second instance started with `start` and a pairing link issued on it.
