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
  - "This computer"
  - "Main worktree"
  - "Mark "
  - "Unmark "
  - "Review"
  - "Files"
  - "Open file"
  - "Source"
  - "Review summary"
  - "Review layer "
  - "Name of this computer"
  - "Save"
  - "Rename project"
  - "Name"
  - "Rename"
  - "Ways in"
  - "Local network"
  - "Devices"
  - "Device name"
  - "Create pairing link"
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

The desktop app lists a remote computer as its own group in the sidebar, by name and status, apart from This computer's projects, and opens its worktree in the full review workspace over that computer's own credential, with the computer's name in the tab title: a reviewed mark lands on that computer only, a change on its disk shows live (through a live ticket) without a reload, and its HTML review summary loads from it with working links to its review layers.

## How a user reaches it

- Desktop shell only. Settings → `Remote computers` (`/settings/remotes`) → `Pairing link` → `Add`; then the sidebar (phone width: `Toggle Sidebar`, or `ControlOrMeta+b`) → group "<computer name>" → a worktree row of its project.
- Route `/remotes/<environmentId>/<projectId>/<worktreeId>` (full page load works once the remote is saved; it redirects to `/` when the remote is unknown or the shell is not desktop).
- An offline remote shows its status badge and `Open Remote computers` instead of projects.

## Driving it

`C=.agents/skills/web-verify/scripts/cli`. Two desktop instances, set up as below.

### Setup: a second computer

Two desktop instances stand in for two computers: B (the remote computer) and A (this desktop app). Every command then needs `--instance <id>`.

1. `$C start --desktop` (B), then `$C start --desktop` (A). Note each instance id (`$B`, `$A`), B's web URL from its `web http://127.0.0.1:<port>` line (`$B_WEB`) and each `repository` path (`$REPO_B`, `$REPO_A`).
2. Name B so its rows differ from A's (both default to the host name): `$C --instance $B open /settings/computer`, `$C --instance $B fill --role textbox --name "Name of this computer" "Remote box"`, `$C --instance $B click --role button --name "Save"`.
   Look for: Page Title "Settings · Remote box".
3. Mint a pairing link on B: `$C --instance $B click --role button --name "Ways in"`, `$C --instance $B click --role switch --name "Local network"`, `$C --instance $B click --role button --name "Devices"`, `$C --instance $B fill --role textbox --name "Device name" "Remote computer"`, `$C --instance $B click --role button --name "Create pairing link"`.
   Look for: a paragraph holding `http://192.168.1.20:<port>/pair#c=pcp_…&e=…`. `192.168.1.20` is B's fake LAN address and nothing listens there, so build `$LINK` from `$B_WEB` followed by the `/pair#…` part. The link works once, for a few minutes.
4. Add B on A: `$C --instance $A open /settings/remotes`, `$C --instance $A fill --role textbox --name "Pairing link" "$LINK"`, `$C --instance $A click --role button --name "Add"`.
   Look for: list "Remote computers" with listitem "Remote box" containing "Online" and "http://127.0.0.1:<B port> · Porcelain 1.0.0".
5. Optional, for names that never collide: rename B's project (`$C --instance $B open /`, `Toggle Sidebar`, right-click button "repository", menuitem "Rename project", fill "Name" "remote-sample", "Rename"). Without it both groups hold a project "repository", and B's worktree row is told apart by its path: `--name "/<B's porcelain-dev-… folder>.*Main worktree/"`.

### Open the remote worktree

1. `$C --instance $A click --role button --name "Back"`, then `$C --instance $A click --role button --name "Toggle Sidebar"`
   Look for: group "This computer" holding A's project only; group "Remote box" with button "Remote box Online" holding B's project only (its path under B's `porcelain-dev-…` folder).
2. `$C --instance $A click --role button --name "/remote-sample.*Main worktree/"` (or the path regex from setup step 5)
   Look for: the sheet closes; Page URL `/remotes/<B environmentId>/<projectId>/<worktreeId>`; Page Title "Changes — <B project> · Remote box"; button "Mark README.md as reviewed".

### A reviewed mark lands on B only

3. `$C --instance $A click --role button --name "Mark README.md as reviewed"`
   Look for: button "Unmark README.md as unreviewed" [pressed]; button "Unmark all".
4. `$C --instance $A network`
   Look for: `PUT /api/worktrees/<B worktreeId>/reviewed` sent to B's address (`127.0.0.1:<B port>`) with status 200, and `POST /api/live/tickets` to B's address; no `PUT …/reviewed` to A's own address.

### B's disk shows live

5. `$C --instance $A click --role button --name "Review"`, `$C --instance $A click --role tab --name "Files"`, `$C --instance $A click --role treeitem --name "README.md" --button right`, `$C --instance $A click --role menuitem --name "Open file"`
   Look for: Page Title "README.md — <B project> · Remote box".
6. `$C --instance $A click --role tab --name "Source"`
   Look for: the code shows "# Sample repository" and "A change to review.".
7. Disk on B: `printf '# Sample repository\n\nRewritten on the other computer while it is open.\n' > "$REPO_B/README.md"`, then `$C --instance $A snapshot`
   Look for (no reload): the code shows "Rewritten on the other computer while it is open."; `tail -1 "$REPO_A/README.md"` still prints `A change to review.`.

### B's HTML review summary (agent action)

8. CLI gap: an agent review on B. Needed: `cli agent publish-review --instance $B "Remote review layer" --files changed --html '<html><body><h1>Remote summary</h1><a href="#layer-1">Open remote layer</a></body></html>'`.
9. Then `$C --instance $A click --role button --name "Review"`, `$C --instance $A click --role tab --name "Review"` (the Changes tab is labelled "Review" once a review exists), `$C --instance $A click --role button --name "Review summary"`
   Look for: region "Published review" holding the summary iframe; a `screenshot` shows the heading "Remote summary" and the link "Open remote layer"; `network` shows the summary loaded from B's address.
10. CLI gap: a click inside the frame. Needed: `cli click --frame "Review summary" --role link --name "Open remote layer"`.
    Look for: region "Review layer Remote review layer".

### This computer is untouched

11. `$C --instance $A open /`
    Look for: Page Title "Changes — repository"; button "Mark README.md as reviewed" (A's README carries no mark).

## What proves it works

- End state: the mark exists on B only (step 4 network targets B; step 11 shows A unmarked; `$C --instance $B open /` shows "Unmark README.md as unreviewed" on B); B's rewrite appears in A without a reload while A's own README is unchanged; the summary link opens B's review layer.
- `apps/web/spec/e2e/projects-remote-workspace.desktop.e2e.ts`: the remote group lists only the remote project and This computer only the local one; its main worktree opens at `/remotes/<environmentId>/<projectId>/<worktreeId>` with the remote's name in the title; marking README.md reviewed records it on the remote server and leaves this server's marks empty; with the Source tab open the remote server records live ticket hits, a rewrite on the remote shows without reload and this server's text is unchanged; after the agent publishes "Remote review layer" on the remote, the summary's link opens region "Review layer Remote review layer" (read through `server.reviewedFiles()`, `server.liveTicketHits()`, `server.text()`, `server.inventory()` on both servers).

## Gotchas

- Reachable through two `start --desktop` instances (setup above, proven live) up to step 7 and step 11. The published summary (steps 8 to 10) needs an agent action on B and a click inside its frame: `cli agent publish-review --instance $B …` and `cli click --frame "Review summary" …`.
- Desktop shell only: start both with `start --desktop`; A keeps remotes in browser `localStorage` (no Electron bridge).
- The worktree row's accessible name concatenates branch label, path, project name, status and hidden "Main worktree"; both groups have a main worktree, so use the regex `/remote-sample.*Main worktree/`, which only B's row matches. Without the rename in setup 2 both projects are "repository" and every project address is ambiguous.
- Phone width: the review sidebar is the `Review` sheet; the tree and the "Review" surface tab live there.
