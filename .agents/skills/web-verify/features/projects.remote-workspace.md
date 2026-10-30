---
route: /remotes/$environmentId/$projectId/$worktreeId
shell: desktop
selectors:
  - 'Toggle Sidebar'
  - 'Settings'
  - 'Computers'
  - 'Pairing link'
  - 'Add'
  - 'Close Settings'
  - 'Online'
  - 'This computer'
  - 'Main worktree'
  - 'Computer:'
  - 'Mark '
  - 'Unmark '
  - 'Review'
  - 'Files'
  - 'Open file'
  - 'Source'
  - 'Briefing'
  - 'Agent summary'
  - 'Review summary'
  - 'Review walkthrough'
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

The desktop app lists projects from local and remote computers together, each with a visible computer badge, and opens its worktree in the full review workspace over that computer's own credential, with the computer's name in the tab title: a reviewed mark lands on that computer only, a change on its disk shows live (through a live ticket) without a reload, and its HTML review summary loads from it with links that open its decisions in the walkthrough.

## How to get to it (user POV)

- Desktop shell only. Settings → `Computers` (`/settings/computers`) → `Pairing link` → `Add`; then the sidebar (phone width: `Toggle Sidebar`, or `ControlOrMeta+b`) → project with the remote computer badge → its worktree card.
- Route `/remotes/<environmentId>/<projectId>/<worktreeId>` (full page load works once the remote is saved; it redirects to `/` when the remote is unknown or the shell is not desktop).
- An unavailable remote retains honest unavailable navigation states and its existing Settings recovery.

## Driving it with browser

Preconditions: [surface baseline](README.md).

Required instance mode: `--desktop`.

### Setup: a second computer

1. `$C remote start`
   Expect: "remote computer Remote journey computer, project remote-sample", its `remote address http://127.0.0.1:<port>` and `remote repository <path>` (call it `$REMOTE_REPO`). It is a second disposable server with the sample project, renamed so no name collides with this computer's.
2. `LINK=$($C remote pairing-link | head -1)`, then navigate to `/settings/computers`, replace the contents of textbox named `Pairing link` with the expanded value `$LINK` and click button `Add`
   Expect: Text 'Online' is visible; list "Computers" with listitem "Remote journey computer" holding "http://127.0.0.1:<remote port> · Porcelain 1.0.0" and "Online".

### Open the remote worktree

1. Click button `Close Settings`, then click button `Toggle Sidebar`
   Expect: repository and remote-sample project headers, each with its own visible computer badge. The remote main card belongs to Remote journey computer and its full path is `$REMOTE_REPO`.
2. Click the main worktree card whose accessible label includes remote-sample and Remote journey computer
   Expect: the sheet closes; URL `/remotes/<remote environmentId>/<projectId>/<worktreeId>?entry=handoff` (call its path and query `$REMOTE_PAGE`); title "Changes — remote-sample · Remote journey computer"; button "Mark README.md as reviewed".

### A reviewed mark lands on the remote only

3. Click button `Mark README.md as reviewed`
   Expect: button "Unmark README.md as unreviewed" [pressed]; File review actions contains "Unmark all".
4. `$C server reviewed-files --remote` and `$C server reviewed-files`
   Expect: the remote's `marks` holds README.md; this computer's `marks` is `[]`. Inspect HTTP traffic lists `PUT /api/worktrees/<remote worktreeId>/reviewed` and `POST /api/live/tickets` sent to the remote address with 200; no `PUT …/reviewed` to this computer's web address.

### The remote's disk shows live

5. Click button `Review`, click tab `Files`, Right-click treeitem `README.md`, click menuitem `Open file`
   Expect: title "README.md — remote-sample · Remote journey computer".
6. Click tab `Source`
   Expect: the code shows "# Sample repository" and "A change to review.".
7. Disk on the remote: `printf '# Sample repository\n\nRewritten on the other computer while it is open.\n' > "$REMOTE_REPO/README.md"`, then wait for '/Rewritten on the other computer/'
   Look for (no reload): the code shows "Rewritten on the other computer while it is open."; `tail -1 "$REPO/README.md"` still prints `A change to review.`.

### The remote's HTML review summary

8. `$C agent publish-review "Remote review layer" --remote --summary-html '<html><body><h1>Remote summary</h1><a href="#layer-1">Open remote layer</a></body></html>'`
   Expect: "the agent's publish-review reached the server".
9. Click tab `Review`, then navigate to `$REMOTE_PAGE`
   Expect: the handoff tab "Review" shows region "Review walkthrough" with tab "Walkthrough" selected. Click the "Agent summary" tab; the heading "Remote summary" appears inside frame "Review summary", and a screenshot shows the heading and the link "Open remote layer". Inspect HTTP traffic lists `GET /api/worktrees/<remote worktreeId>/review` 200 from the remote address.
10. Click link named `Open remote layer` inside frame 'Review summary'
    Expect: tab "Walkthrough" selected again and region "1. Remote review layer" visible; URL still `…?entry=handoff`; title "Changes — remote-sample · Remote journey computer".

### This computer is untouched

11. Navigate to `/`
    Expect: the local workspace with button "Mark README.md as reviewed" (this computer's README carries no mark).

### Observable proof

Read both servers: only remote marks/text change. Remote summary opens its decision; local README/marks remain unchanged.

Automated coverage: `projects-remote-workspace.desktop.e2e.ts`.

## Gotchas

- Requires --desktop; remotes persist in browser storage. Use Main worktree plus project/computer identity to distinguish cards.
- Use a fresh full review read for late summary frames. A repeated agent publish may refuse “The review changed; reload before retrying”; inspect before republishing.
