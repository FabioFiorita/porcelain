---
screen: /worktree
selectors:
  - 'worktree-screen'
  - 'Walkthrough'
  - 'Reading worktree…'
  - 'Changes'
  - 'Files'
  - 'History'
  - 'worktree-pull-request'
  - 'Another worktree is selected'
  - 'Select this worktree'
tests:
  - packages/client/src/features/projects/rules/workspace-selection.spec.ts
  - apps/mobile/src/features/projects/rules/worktree-section.spec.ts
  - packages/client/src/features/walkthroughs/rules/walkthrough.spec.ts
api:
  - GET /api/inventory
  - GET /api/worktrees/:worktreeId/walkthrough
  - GET /api/worktrees/:worktreeId/branch-changes
---

# projects.worktree

Tapping a worktree in Worktrees selects it as the workspace and pushes its Worktree page straight into content, titled with the worktree and with "project · computer" as the title's second line. The destinations are Walkthrough, Changes, Files and History, with the web's icons (a checklist, a diff, stacked documents and a clock; SF Symbols on iOS, Material Symbols on Android). On a phone the platform top bar never shows more than two buttons on the right, whatever the title or destination (`phoneTopBar` in `apps/mobile/src/features/projects/rules/worktree-switcher.ts`): first the current destination's icon in the selected style (filled on iOS, brand blue on both platforms; it is not a menu), then three dots opening the native menu, which lists the other three destinations and, under a divider, the page's own actions: Files' New file and New folder, History's Fetch and Pull (disabled with their reasons when they cannot run). Before the destination is known only the three dots show, listing all four. On a tablet the bar keeps one group of four icon buttons, always in that order, the current one selected (iOS) and tinted brand blue, and the destination's own actions follow them: Files' Create file or folder (or an open file's document actions), History's Git actions with a branch icon (SF Symbols `arrow.triangle.branch`, Material `call_split`). Content starts directly under the top bar. A worktree with a walkthrough run for its current branch opens on Walkthrough (the same rule as the web's first tab), any other on Changes; until the walkthrough read answers nothing is selected and the page says Reading worktree…. The destination you choose is remembered per worktree for the session. Each destination keeps its scroll position and state; Files searches inside its content. A worktree whose branch matches a GitHub pull request shows a Pull request #n row above Changes. Files, commits, diffs and the pull request push over the page with their own top bars.

On tablets with at least 700 units of content width the page sits beside the worktree list in landscape. The only platform-drawn bar there is the Worktrees screen's, so the four buttons and the destination's actions sit on its right, above the page, and the page keeps the worktree name and caption as its first row. In portrait the page takes the full width and the top bar's Show worktrees button slides the list in over it, dimming the page; choosing a worktree or one of the four destinations, tapping the dimmed page, Hide worktrees or Android Back closes it, as Mail and Notes do. With no worktree selected the list stays beside the empty page, since there is nothing to read yet. The list keeps the native top bar's title and search; in portrait, focusing search slides the list in, closing the list cancels the search, and while the list is open its keyboard shortcuts belong to it even after returning from another screen. Files searches inside its column.

## How to get to it (user POV)

- Worktrees → tap a worktree card.

## Driving it with agent-device

Preconditions: [surface baseline](README.md).

1. In Worktrees tap a worktree: the page pushes with its two-line title and the four top-bar buttons Walkthrough, Changes, Files and History, with or without a run. A worktree with a walkthrough run opens on Walkthrough selected; one without a run opens on Changes selected. Independently read the saved selection: that worktree and computer are selected. Without a walkthrough run, even a clean worktree opens on Changes.
2. On a phone, check each destination shows exactly two buttons: its own icon, selected, and three dots. From the three dots choose each of the other destinations; on Files the menu also holds New file and New folder (create one and see it open), on History Fetch and Pull (give the fixture repository an upstream as in [git-actions.menu](git-actions.menu.md) step 2, then run both and check `git rev-list --left-right --count HEAD...@{upstream}`). On a tablet switch between all four buttons and back; the selected one always matches the page, in light and dark. Create file or folder and the search field exist only on Files; the Pull request #n row exists only on Changes. Expand a folder, type a search, scroll Changes: all three are as you left them after switching away and back, including the text in the native search field.
3. Open a file from Files, a changed file from Changes and a commit from History; Back returns to the same section and position. Choose a section, go back to Worktrees and reopen: the same section shows.
4. For a branch matched to a GitHub PR, `worktree-pull-request` reads Pull request #n and opens the [PR document](reviews.pull-request.md); without a matching PR it is absent.
5. Back returns to Worktrees with its search, filters and expansion. Tap another worktree: the page and every section follow the new selection.
6. On a tablet in landscape, choose a worktree: the page shows beside the list with the four buttons in the top bar. Rotate to portrait: the page fills the width with the same worktree, destination and state. Show worktrees slides the list over the page; choose another worktree: the list closes and the page shows it. Show worktrees again, then tap the dimmed page (and on Android press Back), and once more choose Files in the top bar: each closes the list. Rotate back to landscape: the list is beside the page again, with the same worktree and destination. Opening a file in Files folds the list (Show worktrees brings it back); see [Files](files.files.md) step 10. Check long names and larger text: on a phone the title keeps the room beside the two buttons.

Automated coverage: `workspace-selection.spec.ts`, `worktree-section.spec.ts`.

## Gotchas

- The title reflects the card at the moment it was tapped; sections read the current workspace. Selection failures stay on Worktrees: see [Worktrees](projects.worktrees.md).
