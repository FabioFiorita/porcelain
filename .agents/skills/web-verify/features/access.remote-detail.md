---
route: /settings/$section/$environmentId
shell: desktop
selectors:
  - "Remote computers"
  - "Search remote computers"
  - "Computer status"
  - "Computer settings"
  - "Overview"
  - "Address"
  - "Environment ID"
  - "Porcelain version"
  - "Forget on this app"
  - "Back"
tests:
  - apps/web/spec/e2e/access-remote-detail.desktop.e2e.ts
api:
  - GET /api/environment
  - GET /api/session
  - POST /api/pair
---

# access.remote-detail

## What it is

Desktop Settings keeps Remote computers as a compact list. Each row opens `/settings/remotes/<environmentId>` with the current name as the third breadcrumb label. Existing status, address, version, remote update and Forget controls live on detail. Browser mode remains scoped to its host and redirects this route to its default Settings section. An extra segment on any other Settings section shows the recoverable not-found view at the original URL.

## Driving it

Start one disposable desktop-mode web instance and pair two disposable remote servers, using the fixture pairing links. Give them the same name; verify that their row addresses and short IDs distinguish them. Stop one remote by its captured ownership, keeping the other online.

1. Open Settings › Remote computers. Search by name, address or ID; choose All computers, Online, Offline or Needs attention from Computer status. Rows keep saved-name ordering as statuses change. An empty result says No computers match this search and filter.
2. Focus a row button and scroll the list. Open it. Observe the environment ID in the URL and the name in the breadcrumb. Opening detail focuses its Settings main region before paint, so Escape immediately returns to the list after either a click or Tab+Enter, online or offline. Back and the Remote computers breadcrumb return to the same search, filter, scroll and row focus. Browser Back does too.
3. Open the detail URL directly and reload. Online detail shows its address, identity, version and existing update permission controls. Offline detail keeps its saved name, address, identity and device ID, labels them Stale and says the current version is unavailable; no version is saved in the current format.
4. From a workspace, click the button named for the remote computer in the sidebar footer, online or offline. The workspace outage button Computer settings opens the same exact detail. Opening settings never selects another project or review. Browser Back returns directly to that workspace, and Forward reopens detail: it follows the pages actually visited. In-page Back or Escape goes to the list; Back again returns to the workspace that opened Settings. No unvisited list is inserted into browser history.
5. With an unsavable draft on that remote, choose Forget on this app. The explanation allows saving or discarding drafts and stays readable at 480px. The existing command refuses with Save or discard unsaved file drafts before disconnecting. The computer, draft and disk text stay. Discard the conflicting draft using Reload in the editor, then return to detail and Forget. It returns to the list and removes only this app’s saved connection; host credentials and sharing remain. When the originating row has been removed, focus moves to the surviving list region so Escape can still leave Settings. Check successful Forget then Escape after both list and direct detail entry.

## Evidence boundary

Use web verification for these views, and desktop verification separately for the trusted renderer and credential bridge. Pairing and status fixtures use loopback cross-origin remotes; real LAN, Tailscale and Cloudflare reachability are separate. The named test covers navigation, list return, offline presentation, targeted entry points, review context and draft protection. Status query lifecycle belongs to #308.
