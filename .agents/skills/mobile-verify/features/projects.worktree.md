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

Tapping a worktree in Worktrees selects it as the workspace and pushes its Worktree page straight into content, titled with the worktree and with "project · computer" as the title's second line. The platform top bar holds one group of four icon buttons on the right, always in this order: Walkthrough, Changes, Files and History (the web's icons: a checklist, a diff, stacked documents and a clock; SF Symbols on iOS, Material Symbols on Android). The current destination is selected: on iOS the bar item's own selected state, on both platforms tinted in the brand blue while the others stay muted. When the four buttons and a readable title do not fit together (`worktreeSwitcherForm` in `apps/mobile/src/features/projects/rules/worktree-switcher.ts` decides from the bar width, text size, title length and the bar's other items, reserving room for one destination action so switching never changes the form), the four collapse into one menu button drawn by the platform: its icon is the current destination's icon in the brand blue (the three dots while nothing is current), and it opens a native menu of the four destinations with their icons and names, the current one checked. A short title on a regular phone and every tablet keep the four buttons; a long title, the Small Phone or larger text collapse them. Content starts directly under the top bar. A worktree with a walkthrough run for its current branch opens on Walkthrough (the same rule as the web's first tab), any other on Changes; until the walkthrough read answers the buttons show with none selected and the page says Reading worktree…. The destination you choose is remembered per worktree for the session. Each destination keeps its scroll position and state; its own top-bar actions follow the four buttons after a small gap: Files adds Create file or folder (or an open file's document actions on a tablet) and searches inside its content, History adds Git actions. A worktree whose branch matches a GitHub pull request shows a Pull request #n row above Changes. Files, commits, diffs and the pull request push over the page with their own top bars.

On tablets with at least 700 units of content width the page sits beside the worktree list. The only platform-drawn bar there is the Worktrees screen's, so the four buttons and the destination's actions sit on its right, above the page, and the page keeps the worktree name and caption as its first row.

## How to get to it (user POV)

- Worktrees → tap a worktree card.

## Driving it with agent-device

Preconditions: [surface baseline](README.md).

1. In Worktrees tap a worktree: the page pushes with its two-line title and the four top-bar buttons Walkthrough, Changes, Files and History, with or without a run. A worktree with a walkthrough run opens on Walkthrough selected; one without a run opens on Changes selected. Independently read the saved selection: that worktree and computer are selected. Without a walkthrough run, even a clean worktree opens on Changes.
2. Switch between all four buttons and back; the selected one always matches the page, in light and dark. On a worktree with a long title (after `walkthrough sample`) or on the Small Phone, expect the single menu button instead, showing the current destination's icon; open it, check the current destination is checked, and choose each of the four. Create file or folder and the search field exist only on Files; the Pull request #n row exists only on Changes. Expand a folder, type a search, scroll Changes: all three are as you left them after switching away and back, including the text in the native search field.
3. Open a file from Files, a changed file from Changes and a commit from History; Back returns to the same section and position. Choose a section, go back to Worktrees and reopen: the same section shows.
4. For a branch matched to a GitHub PR, `worktree-pull-request` reads Pull request #n and opens the [PR document](reviews.pull-request.md); without a matching PR it is absent.
5. Back returns to Worktrees with its search, filters and expansion. Tap another worktree: the page and every section follow the new selection.
6. On a tablet, in landscape and portrait, choose a worktree: the page shows beside the list with the four buttons in the top bar, and rotating keeps the destination and its state. Opening a file in Files folds the list (Show worktrees brings it back); see [Files](files.files.md) step 10. Check long names and larger text: the title keeps at least about sixteen characters, and the four buttons collapse into the menu rather than cutting it shorter.

Automated coverage: `workspace-selection.spec.ts`, `worktree-section.spec.ts`.

## Gotchas

- The title reflects the card at the moment it was tapped; sections read the current workspace. Selection failures stay on Worktrees: see [Worktrees](projects.worktrees.md).
