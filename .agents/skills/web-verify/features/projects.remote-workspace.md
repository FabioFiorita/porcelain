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

`C=.agents/skills/web-verify/scripts/cli; $C start --desktop`; `REPO` is the repository path it printed.

### Setup: a second computer

1. `$C remote start`
   Look for: "remote computer Remote journey computer, project remote-sample", its `remote address http://127.0.0.1:<port>` and `remote repository <path>` (call it `$REMOTE_REPO`). It is a second disposable server with the sample project, renamed so no name collides with this computer's.
2. `LINK=$($C remote pairing-link | head -1)`, then `$C open /settings/remotes`, `$C fill --role textbox --name "Pairing link" "$LINK"` and `$C click --role button --name "Add"`
   Look for: `$C wait --text "Online"` returns; list "Remote computers" with listitem "Remote journey computer" holding "http://127.0.0.1:<remote port> · Porcelain 1.0.0" and "Online".

### Open the remote worktree

1. `$C click --role button --name "Back"`, then `$C click --role button --name "Toggle Sidebar"`
   Look for: group "This computer" holding project "repository" only; group "Remote journey computer" with button "Remote journey computer Online" holding project "remote-sample" only (its worktree row's path is `$REMOTE_REPO`).
2. `$C click --role button --name "/remote-sample.*Main worktree/"`
   Look for: the sheet closes; Page URL `/remotes/<remote environmentId>/<projectId>/<worktreeId>?entry=handoff` (call its path and query `$REMOTE_PAGE`); Page Title "Changes — remote-sample · Remote journey computer"; button "Mark README.md as reviewed".

### A reviewed mark lands on the remote only

3. `$C click --role button --name "Mark README.md as reviewed"`
   Look for: button "Unmark README.md as unreviewed" [pressed]; button "Unmark all".
4. `$C server reviewed-files --remote` and `$C server reviewed-files`
   Look for: the remote's `marks` holds README.md; this computer's `marks` is `[]`. `$C network` lists `PUT /api/worktrees/<remote worktreeId>/reviewed` and `POST /api/live/tickets` sent to the remote address with 200; no `PUT …/reviewed` to this computer's web address.

### The remote's disk shows live

5. `$C click --role button --name "Review"`, `$C click --role tab --name "Files"`, `$C click --role treeitem --name "README.md" --button right`, `$C click --role menuitem --name "Open file"`
   Look for: Page Title "README.md — remote-sample · Remote journey computer".
6. `$C click --role tab --name "Source"`
   Look for: the code shows "# Sample repository" and "A change to review.".
7. Disk on the remote: `printf '# Sample repository\n\nRewritten on the other computer while it is open.\n' > "$REMOTE_REPO/README.md"`, then `$C wait --text "/Rewritten on the other computer/"`
   Look for (no reload): the code shows "Rewritten on the other computer while it is open."; `tail -1 "$REPO/README.md"` still prints `A change to review.`.

### The remote's HTML review summary

8. `$C agent publish-review "Remote review layer" --remote --summary-html '<html><body><h1>Remote summary</h1><a href="#layer-1">Open remote layer</a></body></html>'`
   Look for: "the agent's publish-review reached the server".
9. `$C click --role tab --name "Review Close Review"`, then `$C open "$REMOTE_PAGE"`
   Look for: the handoff tab "Review" shows region "Published review" holding the summary frame; `$C wait --frame "Review summary" --role heading --name "Remote summary"` returns, and a `screenshot` shows the heading and the link "Open remote layer". `$C network` lists `GET /api/worktrees/<remote worktreeId>/review` 200 from the remote address.
10. `$C click --frame "Review summary" --role link --name "Open remote layer"`
    Look for: Page URL `…?entry=layer%3A<layerId>`; Page Title "Review — remote-sample · Remote journey computer"; `$C wait --role region --name "Review layer Remote review layer"` returns.

### This computer is untouched

11. `$C open /`
    Look for: the local workspace with button "Mark README.md as reviewed" (this computer's README carries no mark).

## What proves it works

- End state: the mark exists on the remote only (step 4 reads both servers; step 11 shows this computer unmarked); the remote's rewrite appears without a reload while this computer's README is unchanged; the summary loaded from the remote opens its review layer.
- `apps/web/spec/e2e/projects-remote-workspace.desktop.e2e.ts`: the remote group lists only the remote project and This computer only the local one; its main worktree opens at `/remotes/<environmentId>/<projectId>/<worktreeId>` with the remote's name in the title; marking README.md reviewed records it on the remote server and leaves this server's marks empty; with the Source tab open the remote server records live ticket hits, a rewrite on the remote shows without reload and this server's text is unchanged; after the agent publishes "Remote review layer" on the remote, the summary's link opens region "Review layer Remote review layer" (read through `server.reviewedFiles()`, `server.liveTicketHits()`, `server.text()`, `server.inventory()` on both servers).

## Gotchas

- The disposable servers sign a summary link for 2 seconds (`summaryLinkLifetimeMs`), counted from the review read: a summary frame mounted later stays blank. Step 9 makes the summary tab the active one and reloads, so the frame loads with the review read; clicking through the sheet to "Review summary" takes longer than the link lives.
- Desktop shell only: start with `start --desktop`; the app keeps remotes in browser `localStorage` (no Electron bridge).
- The worktree row's accessible name concatenates branch label, path, project name, status and hidden "Main worktree"; both groups have a main worktree, so use the regex `/remote-sample.*Main worktree/`, which only the remote's row matches.
- `agent publish-review` publishes once per worktree; a second publish on the same instance is refused ("The review changed; reload before retrying").
- Phone width: the review sidebar is the `Review` sheet; the tree and the "Review" surface tab live there.
