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

Desktop Settings keeps Remote computers as a compact list. Each row opens `/settings/remotes/<environmentId>` with the current name as the third breadcrumb label. Existing status, address, version, remote update and Forget controls live on detail. Browser mode remains scoped to its host and redirects this route to its default Settings section.

## Driving it

Start one disposable desktop-mode web instance and pair two disposable remote servers, using the fixture pairing links. Give them the same name; verify that their row addresses and short IDs distinguish them. Stop one remote by its captured ownership, keeping the other online.

1. Open Settings › Remote computers. Search by name, address or ID; choose All computers, Online, Offline or Needs attention from Computer status. Rows keep saved-name ordering as statuses change. An empty result says No computers match this search and filter.
2. Focus a row button and scroll the list. Open it. Observe the environment ID in the URL and the name in the breadcrumb. Back and the Remote computers breadcrumb return to the same search, filter, scroll and row focus. Browser Back does too.
3. Open the detail URL directly and reload. Online detail shows its address, identity, version and existing update permission controls. Offline detail keeps its saved name, address, identity and device ID, labels them Stale and says the current version is unavailable; no version is saved in the current format.
4. From a workspace, right-click a computer header and choose Computer settings. Its sidebar outage button and workspace outage button open the same exact detail. Opening settings never selects another project or review. Back goes to the list; Back again returns to the workspace that opened Settings.
5. With an unsavable draft on that remote, choose Forget on this app. The existing command refuses with Save or discard unsaved file drafts before disconnecting. The computer, draft and disk text stay. With no unsaved draft, Forget returns to the list and removes only this app’s saved connection; host credentials and sharing remain.

## Evidence boundary

Use web verification for these views, and desktop verification separately for the trusted renderer and credential bridge. Pairing and status fixtures use loopback cross-origin remotes; real LAN, Tailscale and Cloudflare reachability are separate. The named test covers navigation, list return, offline presentation, targeted entry points, review context and draft protection. Status query lifecycle belongs to #308.
