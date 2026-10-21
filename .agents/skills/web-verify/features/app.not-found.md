---
route: /$
selectors:
  - 'Page not found'
  - 'Worktree not found'
  - 'This URL has an invalid or unavailable worktree ID.'
  - 'Open available worktree'
  - 'Back to workspace'
  - 'Toggle Sidebar'
  - 'Projects and worktrees'
  - 'Settings'
tests:
  - apps/web/spec/e2e/app-routing.e2e.ts
api:
  - GET /api/inventory
---

# app.not-found

Unknown URLs show Page not found inside the paired app shell. The project navigator, Settings button and Settings shortcut still work. Back to workspace opens `/`, which selects an available worktree or shows the empty workspace. Unpaired browsers follow the normal pairing flow.

Start one web instance and pair. At desktop width (1024 × 640), navigate to `/nonexistent-route`, `/<projectId>/<worktreeId>/remotes` and `/settings/unknown/extra`. Each URL stays visible, shows Page not found, keeps navigation Projects and worktrees, and has a Back to workspace link. Follow it and observe Review content. At phone width (414 × 896), Toggle Sidebar reveals the same navigator.

Navigate to `/<projectId>/invalid-worktree`, `/<projectId>/remotes` and `/?worktree=invalid-worktree`. Observe Worktree not found and the explanation that the URL has an invalid or unavailable worktree ID. Open available worktree links directly to an available workspace; it is absent when none exists. Back to workspace remains available. The app never claims another worktree is the invalid ID.

Navigate to `/settings/unknown` and the removed slugs `/settings/appearance`, `/settings/computer`, `/settings/connection`, `/settings/updates`, `/settings/ways-in` and `/settings/remotes`. Observe Page not found without a silent redirect. Press Alt+Shift+S to enter `/settings/general`; Back returns to the not-found view. Computers and Devices are valid sections in both shells. An extra segment on General remains not found.

Repeat in desktop mode for manual routing verification. The named spec proves the shared routing promises in the web shell. The Electron bridge itself requires desktop verification. A fresh unpaired browser visiting an unknown URL ends on `/pair`, with This browser is not paired.
