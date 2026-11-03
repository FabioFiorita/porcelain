---
screen: /
selectors:
  - 'Reviews'
  - 'Worktrees'
  - 'Settings'
  - 'Close Settings'
  - 'review-inbox'
  - 'worktree-navigator'
  - 'Select a review'
  - 'Select a worktree'
tests:
  - apps/mobile/src/shared/rules/list-detail.spec.ts
api: []
---

# app.shell

Phones and iPad share one native tab shell with two tabs, Reviews and Worktrees. Each tab is its own stack: a screen pushed from it (Review, Files, History, a published review, a pull request) stays in that tab, and native Back/swipe returns. A gear button labelled Settings on the left of both tab roots opens Settings as a modal. The development client is ready on Reviews within 30 seconds of a cold launch.

## How to get to it (user POV)

- Launch the app on an iPhone, Android phone or iPad; choose Reviews or Worktrees in the tab bar.
- Settings: the gear on the left of the Reviews or Worktrees header.

## Driving it with agent-device

Preconditions: [surface baseline](README.md).

1. Cold-launch. Expect Reviews selected with the `review-inbox` screen (Reading reviews…, No reviews or review rows, or Pair a computer when unpaired), ready within 30 seconds.
2. Select Worktrees: its large title and `worktree-navigator` appear. Open a worktree and push Review; select Reviews and back to Worktrees: the Worktrees stack still shows Review. Native Back returns to the worktree, then Worktrees.
3. Open a review row from Reviews: the published review pushes inside Reviews and Back returns to the inbox. Retain a screenshot with both tabs visible.
4. From each tab root press Settings: Settings opens as a modal over the tabs. Close Settings returns to the same tab and stack position.
5. Cold-launch through the card's Metro URL after selecting Worktrees and confirm the destination and selected tab visually within the 30-second budget.
6. iPad: the two tabs sit in a top bar with a Show Sidebar button. Portrait: the sidebar slides over the page and a tap outside closes it. Landscape (`orientation landscape-left`): the sidebar stays open beside the page, and every tab root and pushed screen starts to its right with no text under it; Hide Sidebar gives the page the full width. Rotate with a review open and check both orientations.
7. iPad list beside detail: on an iPad whose content area is at least 700pt wide (portrait and landscape beside the open sidebar), each tab root shows its list in a 340pt column beside the selected item. Reviews: choosing a row opens that worktree's review overview on the right (Select a review until one is chosen); the pane follows the app's current worktree, so choosing another worktree in Worktrees shows that worktree's review there. Worktrees: choosing a row shows its Review, Files and History beside the list (Select a worktree until one is chosen). Rows that select in place have no chevron. A walkthrough stop shows the review's decisions column beside the decision. Everything else still pushes full width over the split. iPhone, Android phones and narrow multitasking windows keep pushing.

Automated coverage: none named; retain the live action and readback evidence.

## Gotchas

- Native selected-tab traits may be absent; use a screenshot and the header title. Reapply development-menu flags after cold launch so overlays do not cover controls.
- A cold link to a shared route (`/review`, `/files`, `/history`, `/reviews/[reviewId]`, …) lands in the Reviews tab.
- The list-beside-detail layout lives inside each tab's stack (`ListDetail`), not in a native split view: Expo Router's split view is alpha and must be the root navigator, which the native tabs already are. The native header already moves beside the landscape sidebar while React Native content does not, so `TabStack` keeps each stack inside the left and right safe area and the columns sit inside it.
- A tablet is decided by `expo-device` (iPad, or an Android tablet), then by the measured content width; see `shared/rules/list-detail.ts`.
