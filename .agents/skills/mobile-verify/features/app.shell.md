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
  - 'worktree-drawer'
  - 'drawer-settings'
  - 'Close Settings'
tests:
  - apps/mobile/src/shared/rules/side-drawer.spec.ts
  - apps/mobile/src/shared/rules/list-detail.spec.ts
api: []
---

# app.shell

Phones and tablets share one native tab bar with four fixed tabs for the selected worktree: Walkthrough, Changes, Files and History. The platform draws it (iOS tab bar, adapting to the iPad sidebar; Android Material navigation bar). Each tab has its own stack and keeps its place when you switch tabs. The worktrees live in a drawer, as in the Claude app: swipe right on a tab's root screen, tap the sidebar button on the left of the header (`Show worktrees`), or tap the worktree title (`worktree-switch`, the worktree's name over "project · computer" with a down chevron). The content slides aside and dims; tapping it, swiping left or Android Back closes the drawer, and choosing a worktree closes it and every tab follows. The drawer (`worktree-drawer`) holds the worktree list with its own search field and, at the bottom, Settings (`drawer-settings`), which opens Settings as a modal with Close Settings. On Android the first 24 units from the left edge stay with the system Back gesture, so the swipe starts just inside the screen. A tablet at least 1000 units wide keeps the drawer pinned beside the content as a sidebar; the header button hides and shows it. The pull request has no tab: it opens from the Walkthrough and from the Pull request row on Changes.

With no worktree chosen (first launch) the drawer opens by itself and each tab shows "No worktree selected" with Choose worktree. A pairing link or `/settings` deep link opens Settings.

## How to get to it (user POV)

Launch the app. Tap the tabs at the bottom. Swipe right or tap the sidebar button for the worktrees and Settings.

## Driving it with agent-device

1. Fresh install (start with `--manual-pairing`): the drawer is open with Add computer and Try the demo. Settings at its bottom → Computers → Add computer reaches pairing.
2. Paired: choose a worktree in the drawer; it closes and the tab shows it. Each tab's title reads the worktree; `worktree-switch` and `Show worktrees` open the drawer; a rightward swipe on the content (start at least 24 units in on Android) opens it; a leftward swipe or a tap on the dimmed content closes it. On a pushed screen the swipe does not open the drawer (Back keeps it).
3. In each tab push a screen (a file, a changed file, a commit), switch tabs and back: the pushed screen and scroll are kept.
4. Tablet (Android tablet emulator): landscape pins the drawer beside the content; `Hide worktrees` hides it and `Show worktrees` brings it back. Portrait slides it over like a phone. Files, Changes, History and Settings show their list beside the content when the content is at least 700 units wide.
5. iPad keyboard: ⌘0–⌘3 switch Walkthrough, Changes, Files, History; ⌘, opens Settings.

## Gotchas

- Expo Router shares one route folder `(walkthrough,changes,files,history)` across the four tabs, so a push from a tab stays in that tab.
- The drawer is Porcelain's own (`components/ui/side-drawer.tsx`, Reanimated and the responder system), not a native drawer; iPad sidebar adaptation and the iOS swipe feel need an iOS run.
