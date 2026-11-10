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

Tapping a worktree in Worktrees selects it as the workspace and pushes its Worktree page straight into content, titled with the worktree and with "project · computer" as the title's second line. One native segmented control directly under the opaque top bar (a SwiftUI segmented picker on iOS, Material segmented buttons on Android) switches sections. The first is Walkthrough when the current branch has a walkthrough run (the same rule as the web's first tab), otherwise Changes; until the walkthrough read answers the page says Reading worktree…. A guided worktree opens on Walkthrough, whose top-bar Changes button pushes the plain [Changes list](projects.worktree-changes.md); otherwise it opens on Changes with Walkthrough one tap away. The section you choose is remembered per worktree for the session and falls back to the first one when it is no longer offered. Changes no longer shows the old published-review overview; see [Walkthrough](reviews.walkthrough-page.md). Each section keeps its scroll position and state, and owns its native top-bar actions: Files has Create file or folder and the native search field. A worktree whose branch matches a GitHub pull request shows a Pull request #n row above Changes. Files, commits, diffs and the pull request push over the page.

On tablets with at least 700 units of content width the page sits beside the worktree list. The list keeps the native top bar's title and search, so the worktree name and caption sit beside the segmented control and Files searches inside its column.

## How to get to it (user POV)

- Worktrees tab → tap a worktree card.

## Driving it with agent-device

Preconditions: [surface baseline](README.md).

1. In Worktrees tap a worktree: the page pushes with its two-line title and segmented control. A worktree with a walkthrough run opens on Walkthrough, Files, History; one without a run shows Changes, Walkthrough, Files, History. Independently read the saved selection: that worktree and computer are selected. Without a walkthrough run, even a clean worktree opens on Changes.
2. Switch Changes, Files and History and back. Create file or folder and the search field exist only on Files; Refresh review and the Pull request #n row exist only on Changes. Expand a folder, type a search, scroll Changes: all three are as you left them after switching away and back, including the text in the native search field.
3. Open a file from Files, a changed file from Changes and a commit from History; Back returns to the same section and position. Choose a section, go back to Worktrees and reopen: the same section shows.
4. For a branch matched to a GitHub PR, `worktree-pull-request` reads Pull request #n and opens the [PR document](reviews.pull-request.md); without a matching PR it is absent.
5. Back returns to Worktrees with its search, filters and expansion. Tap another worktree: the page and every section follow the new selection.
6. With a worktree page open, select another worktree from the Reviews tab and return: Another worktree is selected offers Select this worktree, which restores the page.
7. On a tablet, in landscape and portrait, choose a worktree: the page shows beside the list and rotating keeps the section and its state. Opening a file in Files folds the list (Show worktrees brings it back); see [Files](files.files.md) step 10. Check long names and larger text.

Automated coverage: `workspace-selection.spec.ts`, `worktree-section.spec.ts`.

## Gotchas

- The title reflects the card at the moment it was tapped; sections read the current workspace. Selection failures stay on Worktrees: see [Worktrees](projects.worktrees.md).
