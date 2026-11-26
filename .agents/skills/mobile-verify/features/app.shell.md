---
screen: /
selectors:
  - 'Walkthrough'
  - 'Changes'
  - 'Files'
  - 'History'
  - 'Settings'
  - 'worktree-switch'
  - 'Choose a worktree'
  - 'Choose worktree'
tests:
  - apps/mobile/src/shared/rules/start-path.spec.ts
  - apps/mobile/src/shared/rules/list-detail.spec.ts
api: []
---

# app.shell

Phones and tablets share one native tab bar with five fixed tabs: Walkthrough, Changes, Files and History for the selected worktree, then Settings. The platform draws it (iOS tab bar, adapting to the iPad sidebar; Android Material navigation bar). Each worktree tab has its own stack and keeps its place when you switch tabs. The header title of every worktree tab is a button showing the worktree's name over "project · computer" with a small down chevron; it pushes the full-page [Worktrees](projects.worktrees.md) selector over the tabs. The pull request has no tab: it opens from the Walkthrough and from the Pull request row on Changes, so the five tabs never move.

The first launch with no worktree chosen opens the selector; Back from it shows the tabs with "Choose a worktree" and one Choose worktree button. Later launches open the Walkthrough tab of the remembered worktree. A pairing link or `/settings` deep link opens the Settings tab.

## How to get to it (user POV)

Launch the app. Tap the tabs at the bottom. Tap the title to change worktree.

## Driving it with agent-device

1. Fresh install (start without pairing, `--manual-pairing`): the Worktrees selector shows first with Add computer. Back: the tab bar shows five tabs; Walkthrough shows Pair a computer. Settings tab → Computers → Add computer reaches pairing.
2. Paired: choose a worktree in the selector; it returns to the tabs. Each worktree tab's title reads the worktree and "project · computer"; `worktree-switch` pushes the selector; choosing another worktree returns to the same tab with every tab following the new worktree.
3. In each tab push a screen (a file, a changed file, a commit), switch tabs and back: the pushed screen and scroll are kept. Tapping the current tab again pops to its root.
4. Tablet (Android tablet emulator), landscape and portrait: the tab bar stays; Files, Changes and History show their list beside the content when the content is at least 700 units wide.
5. iPad keyboard: ⌘0–⌘3 switch Walkthrough, Changes, Files, History; ⌘, opens Settings.

## Gotchas

- Expo Router shares one route folder `(walkthrough,changes,files,history)` across the four worktree tabs, so a push from a tab stays in that tab.
- iPad sidebar adaptation and iOS tab bar minimise behaviour need an iOS run.
