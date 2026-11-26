---
screen: /
selectors:
  - 'Walkthrough'
  - 'Changes'
  - 'Files'
  - 'History'
  - 'worktree-switch'
  - 'Choose worktree'
  - 'Show worktrees'
  - 'Hide worktrees'
  - 'Show sidebar'
  - 'Hide sidebar'
  - 'Settings'
  - 'worktree-drawer'
  - 'rail-walkthrough'
  - 'Close Settings'
tests:
  - apps/mobile/src/shared/rules/side-drawer.spec.ts
  - apps/mobile/src/shared/rules/list-detail.spec.ts
api: []
---

# app.shell

A phone has a native tab bar with four fixed tabs for the selected worktree: Walkthrough, Changes, Files and History (Android Material navigation bar, iOS tab bar). A tablet has no tab bar: the same four sections live in a sidebar. On iPad the platform draws it (the tab bar's sidebar form, `preferredPlacement: sidebar`, iPadOS 27 or later; earlier iPadOS shows its top tab bar with a sidebar button). On an Android tablet Porcelain draws it: an 80-unit rail of section icons with labels (`rail-walkthrough`…) is always on screen and holds the only copy of the sections. At least 1000 units wide (landscape) the worktree list is pinned beside the rail; `Hide sidebar` hides the list, leaving the rail, and `Show sidebar` brings it back. Narrower (portrait) the rail stays and the worktree drawer slides over it. Each section has its own stack and keeps its place when you switch. The header's left toolbar holds the sidebar or worktrees button and Settings on every section root, phone and tablet; the right side keeps each section's own actions. Settings opens as a modal with Close Settings.

The worktrees live in a drawer on phones, portrait Android tablets and iPads, as in the Claude app: swipe right on a section's root screen, tap the sidebar button on the left of the header (`Show worktrees`), or tap the worktree title (`worktree-switch`, the worktree's name over "project · computer" with a down chevron). The content slides aside and dims; tapping it, swiping left or Android Back closes the drawer, and choosing a worktree closes it and every section follows. The drawer (`worktree-drawer`) holds only the worktree list with its own search field. On Android the first 24 units from the left edge stay with the system Back gesture, so the swipe starts just inside the screen. The pull request has no section: it opens from the Walkthrough and from the Pull request row on Changes.

With no worktree chosen (first launch) the drawer opens by itself and each section shows "No worktree selected" with Choose worktree. A pairing link or `/settings` deep link opens Settings.

## How to get to it (user POV)

Launch the app. On a phone tap the tabs at the bottom; on a tablet tap the sections in the sidebar or rail. Swipe right or tap the sidebar button for the worktrees; Settings is the gear on the left of the header.

## Driving it with agent-device

1. Fresh install (start with `--manual-pairing`): the drawer is open with Add computer and Try the demo. Close it; Settings on the left of the header → Computers → Add computer reaches pairing.
2. Paired: choose a worktree in the drawer; it closes and the section shows it. Each section's title reads the worktree; `worktree-switch` and `Show worktrees` open the drawer; a rightward swipe on the content (start at least 24 units in on Android) opens it; a leftward swipe or a tap on the dimmed content closes it. On a pushed screen the swipe does not open the drawer (Back keeps it).
3. In each section push a screen (a file, a changed file, a commit), switch sections and back: the pushed screen and scroll are kept. The selected section stays marked on pushed screens.
4. Android tablet, landscape: no tab bar; the rail holds the sections and the pinned sidebar beside it holds only the worktrees. `Hide sidebar` leaves the rail; `Show sidebar` restores it. Portrait: the rail stays at the left and `Show worktrees` slides the worktree list over it (no sections or Settings inside). Rotate with a file open in Files: it stays beside the tree. Android Back from a section root returns to the previous section. Files, Changes, History, the Walkthrough and Settings show their list beside the content when the content is at least 700 units wide; the list column narrows to 42% of the width (280–340 units).
5. iPad keyboard: ⌘0–⌘3 switch Walkthrough, Changes, Files, History; ⌘, opens Settings.

## Gotchas

- Expo Router shares one route folder `(walkthrough,changes,files,history)` across the four tabs, so a push from a tab stays in that tab.
- The drawer and the Android tablet sidebar and rail are Porcelain's own (`components/ui/side-drawer.tsx`, `components/ui/rail.tsx`), not native; the iPad tab sidebar, its placement and the iOS swipe feel need an iOS run. Android hides the native tab bar on tablets (`NativeTabs hidden`), never the triggers, so section links keep working.
