---
route: /settings/$section
shell: desktop
selectors:
  - 'Settings'
  - 'Settings sections'
  - 'General'
  - 'Reviews & Git'
  - 'Computers'
  - 'Open This computer:'
  - 'Name of this computer'
  - 'Documents open as'
  - 'Close Settings'
tests:
  - apps/web/spec/e2e/app-settings-page.desktop.e2e.ts
  - apps/web/spec/e2e/app-settings-history.e2e.ts
api: []
---

# app.settings-page

Settings replaces the workspace while keeping the worktree sidebar, with section navigation inside the page, a breadcrumb and Close in its top bar.

## How to get to it (user POV)

- Workspace sidebar → Settings; Alt+Shift+S; desktop native Settings menu. Close / Escape returns.

## Driving it with browser

Preconditions: [surface baseline](README.md).

Section navigation replaces the current entry; opening a computer detail adds a detail entry. Close or Escape returns detail to Computers, then leaves Settings for its originating workspace. Switching from a detail to another section still allows one Escape to leave Settings. Escape while typing keeps the field and Settings open.

Start a desktop verification instance and open Settings from the workspace sidebar. Expect heading General and no Review content region. Choose Reviews & Git; General's Diff layout is absent and Pull strategy appears. Close returns to the exact workspace and title.

Reopen Settings, click Computers and Open This computer: <name>. Click Rename, focus Name of this computer and press Escape: the field closes and you remain on detail. Click General and press Escape: return to the review. From detail without switching sections, Escape returns to the focusable Computers list; another Escape leaves Settings.

For direct-entry history, open `/settings/general` in a fresh tab of the paired browser, open Computers → This computer, then select General and Computers again. Close and Escape return to the workspace even though Settings had no predecessor. As a negative control, enter Settings from a distinct not-found URL and repeat: both controls return to that exact predecessor.

Finally remove the instance's only project through its project context menu and confirmation. Settings still opens on General. Close returns to the originating URL and Worktree not found, while the repository remains on disk. Run this destructive fixture case last.

Automated coverage: `app-settings-page.desktop.e2e.ts`, `app-settings-history.e2e.ts`.

## Gotchas

- Full navigation can discard in-memory drafts/history. Use the entry specified by each case.
