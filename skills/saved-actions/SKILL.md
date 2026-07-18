---
name: saved-actions
description: Curate Porcelain's saved actions — named shell commands (dev server, tests, storybook, …) the human runs in the app's embedded terminal with one click. Use to add or edit the project's common commands so they're one click away. You define them; only the human runs them.
---

# Porcelain saved actions

Porcelain has saved "actions" — named shell commands the human runs in the embedded terminal with one click (dev server, storybook, test watcher, …). Curate them so the project's common commands are one click away for the human.

Talk to Porcelain through the bundled CLI at `~/.porcelain/porcelain` — installed automatically and kept fresh on every app launch (no registration, no MCP config). Run it from **inside the repo** and it targets that repo automatically (git toplevel of the cwd); add `--repo <absolute path>` only to point at a different checkout.

- `~/.porcelain/porcelain actions list` → the saved actions, each with an id, title, command, and optional cwd.
- `~/.porcelain/porcelain actions create --title <s> --command <s> [--cwd <p>]` → add one (e.g. `--title "Storybook" --command "pnpm --filter web storybook"`).
- `~/.porcelain/porcelain actions update --id <id> [--title <s>] [--command <s>] [--cwd <p>]` → edit one (empty-string `--cwd` clears it).
- `~/.porcelain/porcelain actions delete --id <id>` → remove one.

You DEFINE actions; only the human runs them (there is no run command). When you discover the project's common commands (from package.json scripts, the README, or what the human asks you to run repeatedly), offer to save them as actions.
