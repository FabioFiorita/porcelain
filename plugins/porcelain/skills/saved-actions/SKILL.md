---
name: saved-actions
description: Curate Porcelain's saved actions — named shell commands (dev server, tests, storybook, …) the human runs in the app's embedded terminal with one click. Use to add or edit the project's common commands so they're one click away. You define them; only the human runs them.
---

# Porcelain saved actions

Porcelain has saved "actions" — named shell commands the human runs in the embedded terminal with one click (dev server, storybook, test watcher, …). Curate them so the project's common commands are one click away for the human.

Call the `porcelain` MCP tools with `repoPath` set to the ABSOLUTE path of the repo you're working in (your cwd):

- `list_actions` — `{ repoPath }` → the saved actions, each with an id, title, command, and optional cwd.
- `create_action` — `{ repoPath, title, command, cwd? }` → add one (e.g. title "Storybook", command "pnpm --filter web storybook").
- `update_action` — `{ repoPath, id, title?, command?, cwd? }` → edit one (empty-string cwd clears it).
- `delete_action` — `{ repoPath, id }`.

You DEFINE actions; only the human runs them (there is no run tool). When you discover the project's common commands (from package.json scripts, the README, or what the human asks you to run repeatedly), offer to save them as actions.
