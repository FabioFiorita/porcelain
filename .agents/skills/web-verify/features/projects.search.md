---
route: /
selectors:
  - "Search projects and worktrees"
  - "Workspace search results"
  - "Clear search"
tests:
  - apps/web/spec/e2e/projects-search.e2e.ts
api:
  - GET /api/inventory
---

# projects.search

## What it is

The project navigator finds workspaces by project, branch, computer or full path. All whitespace-separated terms must match, ignoring case. Web and the Mac renderer use the same matcher as the mobile picker. Each result keeps its project, computer, path, current selection and review status. A failed computer has its own status and does not block results from others.

## How a user reaches it

Open the project navigator (`Toggle Sidebar` or Mod+B at phone width). Tab to the searchbox `Search projects and worktrees`. ArrowDown enters results; ArrowUp returns from the first result to search; Enter selects. `Clear search` or Escape restores normal navigation without changing its expansion state or active workspace. Escape in the now-empty search can dismiss the surrounding drawer normally.

## Driving it

Start `$C start` for web or `$C start --desktop` for the shared desktop renderer, then pair a fresh browser with the card. Desktop mode supplies remote computers but does not prove Electron keyboard or focus behavior.

1. Prepare many real repositories and linked worktrees under the card's disposable project home; register them through `POST /api/projects` with the fixture credential. Use identical branch names in multiple projects, and `git worktree add --force` to create two checkouts of one branch at different paths. Read `GET /api/inventory` independently to retain the exact identities.
2. For remote coverage use `$C remote start` and add `$C remote pairing-link --trusted` through Settings → Remote computers → Pairing link → Add. Keep a second unreachable saved computer in this disposable browser. Return with Back. The browser adapter stores this fixture in `porcelain.remotes`; never alter an installed application's data.
3. Collapse a project, note the selected worktree and URL, then focus `Search projects and worktrees` with Tab. Search a project and branch, mixing case and spaces. Look for matching workspaces under their project and computer, with complete paths distinguishing duplicate branches. Search the computer name and a path suffix separately. Online, unavailable and current states remain recognizable.
4. ArrowDown from search focuses the first enabled result; ArrowDown and ArrowUp traverse enabled results across projects/computers. Enter selects its exact project/worktree on its computer through normal workspace navigation. A result for an unavailable repository/worktree is disabled. The failed computer keeps its status and settings action while healthy results remain usable.
5. Clear with `Clear search`. Look for the selected URL unchanged and the project still collapsed. Search an unknown term: each readable computer explicitly reports no matching workspaces. Escape clears the query and focuses search without selecting anything. At phone width, dismissing/reopening the drawer keeps selection and expansion (the transient query resets).
6. Capture desktop-width screenshots in light and dark, and record search → select → clear. Retain the inventory readback and the selected URL. Mac native focus/keyboard behavior requires `desktop-verify` on macOS; renderer mode on Linux cannot prove it.

## What proves it works

- `projects-search.e2e.ts` uses a real linked worktree and actual routed app: keyboard focus and selection reach its exact ID, a failed search and Escape keep the original URL, and clearing after selection preserves the new URL and collapsed project.
- `packages/client/src/features/projects/rules/workspace-search.spec.ts` promises matching across project/branch/computer/path, case and whitespace handling, exact identities and availability, current-first order, empty results and immutable inputs. Mobile's `workspace-browser.spec.ts` retains its presentation promise and consumes the shared matcher in its view.
- Live proof must name the inventory size and distinguish browser renderer verification from native desktop verification.
