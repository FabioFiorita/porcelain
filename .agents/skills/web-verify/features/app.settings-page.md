---
route: /settings/$section
shell: desktop
selectors:
  - 'Settings'
  - 'Settings sections'
  - 'General'
  - 'Reviews & Git'
  - 'Computers'
  - 'Open This computer'
  - 'Name of this computer'
  - 'Devices'
  - 'Back'
tests:
  - apps/web/spec/e2e/app-settings-page.desktop.e2e.ts
  - apps/web/spec/e2e/app-settings-history.e2e.ts
api: []
---

# app.settings-page

Settings replaces the workspace with a section sidebar and breadcrumb. Section navigation replaces the current entry; opening a computer detail adds a detail entry. Back or Escape returns detail to Computers, then leaves Settings for its originating workspace. Switching from a detail to another section still allows one Escape to leave Settings. Escape while typing keeps the field and Settings open.

## Driving it

Start a desktop verification instance and open Settings from the workspace sidebar. Expect heading General and no Review content region. Choose Reviews & Git; General's Diff layout is absent and Pull strategy appears. Back returns to the exact workspace and title.

Reopen Settings, click Computers and Open This computer. Focus Name of this computer and press Escape: remain on detail. Click Devices and press Escape: return to the review. From detail without switching sections, Escape returns to the focusable Computers list; another Escape leaves Settings.

For direct-entry history, open `/settings/general` in a fresh tab of the paired browser, open Computers → This computer, then select General and Computers again. Back and Escape return to the workspace even though Settings had no predecessor. As a negative control, enter Settings from a distinct not-found URL and repeat: both controls return to that exact predecessor. The named history spec covers all four cases.

Finally remove the instance's only project through its project context menu and confirmation. Settings still opens on General. Back returns to the originating URL and Worktree not found, while the repository remains on disk. Run this destructive fixture case last.

## What proves it works

The named E2E covers section isolation, Back, ignored Escape in an input, Escape after leaving detail for Devices, and opening Settings without registered projects. Parent owns running the final changed E2Es.
