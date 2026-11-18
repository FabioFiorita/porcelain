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
  - 'Reconnecting'
  - 'Done'
  - 'Git actions'
  - 'Create file or folder'
  - 'This computer'
  - 'Main worktree'
  - 'Computer:'
  - 'Mark '
  - 'Unmark '
  - 'Review'
  - 'Files'
  - 'Open file'
  - 'Source'
  - 'Walkthrough'
tests:
  - apps/web/spec/integration/access-remote-access.test.tsx
  - apps/web/spec/e2e/access-remote-detail.desktop.e2e.ts
api:
  - DELETE /api/worktrees/:worktreeId/reviewed
  - DELETE /api/worktrees/:worktreeId/reviewed-bulk
  - GET /api/environment
  - GET /api/inventory
  - GET /api/live
  - GET /api/worktrees/:worktreeId/reviewed
  - GET /api/worktrees/:worktreeId/text
  - POST /api/live/tickets
  - POST /api/pair
  - PUT /api/worktrees/:worktreeId/reviewed
  - PUT /api/worktrees/:worktreeId/reviewed-bulk
---

# projects.remote-workspace

The desktop app lists projects from local and remote computers together, each with a visible computer badge, and opens its worktree in the full review workspace over that computer's own credential, with the computer's name in the tab title: a reviewed mark lands on that computer only, a change on its disk shows live (through a live ticket) without a reload. Walkthroughs load from that computer.

## How to get to it (user POV)

- Desktop shell only. Settings → `Computers` (`/settings/computers`) → `Pairing link` → `Add`; then the sidebar (phone width: `Toggle Sidebar`, or `ControlOrMeta+b`) → project with the remote computer badge → its worktree card.
- Route `/remotes/<environmentId>/<projectId>/<worktreeId>` (full page load works once the remote is saved; it redirects to `/` when the remote is unknown or the shell is not desktop).
- An unavailable remote retains honest unavailable navigation states and its existing Settings recovery.
- Once the app shows a worktree on this computer, the open review, Files panel, and editor stay mounted through connection checks, reconnects and offline periods. Writes are disabled until the computer is online. A computer that needs pairing or an update, reports a different identity, or has never shown a worktree in this session still uses the existing recovery flow.

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
   Expect: the sheet closes; URL `/remotes/<remote environmentId>/<projectId>/<worktreeId>?entry=review` (call its path and query `$REMOTE_PAGE`); title "Review — remote-sample · Remote journey computer"; button "Mark README.md as reviewed".

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

### This computer is untouched

8. Navigate to `/`
   Expect: the local workspace with button "Mark README.md as reviewed" (this computer's README carries no mark).

### The computer drops off the network

At 1440px wide with both sidebars open, open README.md from Files, choose Edit, and type a draft. Before autosave, close the remote live WebSocket and refuse both replacement sockets and HTTP requests to that remote origin. Confirm a failed remote health check.

- Review content, the Files tree, the selected README.md tab, and the draft stay visible at the same address. Done, Git actions and Create file or folder are disabled and describe why.
- The remote project's computer badge shows Reconnecting only after two seconds. The draft still says Unsaved changes. Check the remote README on disk to confirm the draft never reached it.
- Add a file on the remote disk while it is unreachable. Restore HTTP and the WebSocket. The reconnect badge clears, the new file appears in the same tree, Done becomes enabled, and the editor retains the draft.

### Observable proof

Read both servers: only remote marks/text change. Remote summary opens its decision; local README/marks remain unchanged.

Automated coverage: `access-remote-detail.desktop.e2e.ts`.

## Gotchas

- Requires --desktop; remotes persist in browser storage. Use Main worktree plus project/computer identity to distinguish cards.
