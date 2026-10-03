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

Two instances: the remote computer B and the desktop app A. `C=.agents/skills/web-verify/scripts/cli; $C start --desktop` (B; id `$B`, repository `REPO_B`), then `$C start --desktop` (A; id `$A`, repository `REPO_A`). Every command needs `--instance`.

### Setup

1. Name B: `$C --instance $B open /settings/computer`, `$C --instance $B fill --role textbox --name "Name of this computer" "Remote journey computer"`, `$C --instance $B click --role button --name "Save"`. Look for: Page Title "Settings · Remote journey computer".
2. Rename B's project so it differs from A's "repository": `$C --instance $B open /`, `$C --instance $B click --role button --name "Toggle Sidebar"`, `$C --instance $B click --role button --name "repository" --button right`, `$C --instance $B click --role menuitem --name "Rename project"`, `$C --instance $B fill --role textbox --name "Name" "remote-sample"`, `$C --instance $B click --role button --name "Rename"`. Look for: project button "remote-sample".
3. CLI gap: a pairing link issued on B for A's browser. Needed: `cli pairing-link --instance $B --label "Remote computer"`.
4. CLI gap for step 12: an agent review on B. Needed: `cli agent publish-review --instance $B "Remote review layer" --files changed --html '<html><body><h1>Remote summary</h1><a href="#layer-1">Open remote layer</a></body></html>'`.

### Add the remote and open its worktree

1. `$C --instance $A open /settings/remotes`
   Look for: main "Settings"; textbox "Pairing link".
2. `$C --instance $A fill --role textbox --name "Pairing link" "<link from setup 3>"`, then `$C --instance $A click --role button --name "Add"`
   Look for: list "Remote computers" with listitem "Remote journey computer".
3. `$C --instance $A click --role button --name "Back"`, then `$C --instance $A click --role button --name "Toggle Sidebar"`
   Look for: group "This computer" holding project button "repository" only; group "Remote journey computer" with text "Online" holding project button "remote-sample" only.
4. `$C --instance $A click --role button --name "/remote-sample.*Main worktree/"`
   Look for: Page URL `/remotes/<B environmentId>/<projectId>/<worktreeId>`; Page Title "Changes — remote-sample · Remote journey computer"; the sheet closes; button "Mark README.md as reviewed".

### A reviewed mark lands on B only

5. `$C --instance $A click --role button --name "Mark README.md as reviewed"`
   Look for: button "Unmark README.md as unreviewed" (enabled).
6. `$C --instance $A network`
   Look for: `PUT /api/worktrees/<worktreeId>/reviewed` sent to B's address (`127.0.0.1:<B port>`), status 200; none to A's own server.

### B's disk shows live

7. `$C --instance $A click --role button --name "Review"`, then `$C --instance $A click --role tab --name "Files"`
   Look for: treeitem "README.md".
8. `$C --instance $A click --role treeitem --name "README.md" --button right`, then `$C --instance $A click --role menuitem --name "Open file"`
   Look for: README.md opens as a file document.
9. `$C --instance $A click --role tab --name "Source"`
   Look for: tab "Source" selected, showing "# Sample repository" and "A change to review."; `$C --instance $A network` lists `POST /api/live/tickets` and `GET /api/live` to B's address.
10. Disk on B: `printf '# Sample repository\n\nRewritten on the other computer while it is open.\n' > "$REPO_B/README.md"`
    Look for (no reload): text "Rewritten on the other computer while it is open." in the open document. `cat "$REPO_A/README.md"` still ends with "A change to review.".

### B's HTML review summary

11. Run the agent publish from setup 4 (CLI gap).
12. `$C --instance $A click --role button --name "Review"`, then `$C --instance $A click --role tab --name "Review"` (the Changes tab is labelled "Review" once a review exists), then `$C --instance $A click --role button --name "Review summary"`
    Look for: region "Published review" holding the summary iframe titled "Review summary"; a `screenshot` shows the heading "Remote summary" and the link "Open remote layer" inside it, and `network` shows the summary loaded from B's address.
13. CLI gap: click inside the frame. Needed: `cli click --frame "Review summary" --role link --name "Open remote layer"`.
    Look for: region "Review layer Remote review layer".

### This computer is untouched

14. `$C --instance $A open /`
    Look for: Page Title "Changes — repository"; button "Mark README.md as reviewed" (A's README carries no mark).

## What proves it works

- End state: the mark exists on B only (step 6 network targets B; step 14 shows A unmarked; `$C --instance $B open /` shows "Unmark README.md as unreviewed" on B); B's rewrite appears in A without a reload while A's own README is unchanged; the summary link opens B's review layer.
- `apps/web/spec/e2e/projects-remote-workspace.desktop.e2e.ts`: the remote group lists only the remote project and This computer only the local one; its main worktree opens at `/remotes/<environmentId>/<projectId>/<worktreeId>` with the remote's name in the title; marking README.md reviewed records it on the remote server and leaves this server's marks empty; with the Source tab open the remote server records live ticket hits, a rewrite on the remote shows without reload and this server's text is unchanged; after the agent publishes "Remote review layer" on the remote, the summary's link opens region "Review layer Remote review layer" (read through `server.reviewedFiles()`, `server.liveTicketHits()`, `server.text()`, `server.inventory()` on both servers).

## Gotchas

- Unreachable through the CLI as it stands: it needs a second computer paired to A's browser and an agent publishing a review there. Needed: `cli pairing-link --instance <remote id> --label "Remote computer"`, `cli agent publish-review --instance <remote id> "<title>" --files changed --html '<html>…</html>'`, and `cli click --frame "<iframe title>" …` for the link inside the summary frame. Steps 1–10 and 14 run once the pairing link exists.
- Desktop shell only: start both with `start --desktop`; A keeps remotes in browser `localStorage` (no Electron bridge).
- The worktree row's accessible name concatenates branch label, path, project name, status and hidden "Main worktree"; both groups have a main worktree, so use the regex `/remote-sample.*Main worktree/`, which only B's row matches. Without the rename in setup 2 both projects are "repository" and every project address is ambiguous.
- Phone width: the review sidebar is the `Review` sheet; the tree and the "Review" surface tab live there.
