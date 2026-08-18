# Saved actions

Porcelain has saved **actions** — named shell commands the human runs in the embedded terminal with one click (dev server, storybook, test watcher, …). Curate them so the project's common commands are one click away for the human.

Actions belong to the **Project**, not to a checkout: they live in the owning Environment daemon's store (`$PORCELAIN_HOME/projects/<projectId>/actions.json`), so an action survives `git worktree remove` and every Worktree of the Project shares one list. Nothing is written into the repository.

Talk to Porcelain through the bundled CLI at `~/.porcelain/porcelain` — installed automatically and kept fresh on every app launch. Run it from **inside the repo** and it targets that repo's Project automatically (git plumbing plus the Hub inventory the daemon already wrote); add `--repo <absolute path>` only to point at a different checkout. A repository Porcelain has never opened has no Project id yet, so the CLI says so instead of inventing one — open it in Porcelain once, then retry.

- `~/.porcelain/porcelain actions list` → the saved actions, each with an id, title, command, and optional `where`.
- `~/.porcelain/porcelain actions create --title <s> --command <s> [--where primary|local]` → add one (e.g. `--title "Storybook" --command "pnpm --filter web storybook"`).
- `~/.porcelain/porcelain actions update --id <id> [--title <s>] [--command <s>] [--where primary|local]` → edit one.
- `~/.porcelain/porcelain actions delete --id <id>` → remove one.

**`where`** (optional, default `primary`):

| value | Meaning |
|---|---|
| `primary` | Run on **this window's machine** (the daemon the human is looking at) — the default. |
| `local` | Run on **This device** (the machine running the Mac app) when the window is remote-bound. Use for Mac-only tools (Xcode, iOS simulator) while the repo lives on a remote box. Ignored when the window is already local. |

You **define** actions; only the human runs them (there is no run command). Running takes an explicit Environment + Worktree: the human either has a Worktree selected in the Hub, or Porcelain asks which checkout before anything executes. It never picks one. When you discover the project's common commands (from package.json scripts, the README, or what the human asks you to run repeatedly), offer to save them as actions.

## The human accepts a command before it runs

A command the human has not accepted **on this machine** does not run on one click: the row shows a shield instead of a play arrow, and clicking opens the full command with *Run and remember*.

What this means for you:

- **An action you create requires human acceptance before it runs.** That is expected, not an error. Tell the human you added it so they know why it is asking.
- **Editing an existing command withdraws its acceptance.** Do not rewrite a command the human already trusts just to tidy it — change it when the command is actually wrong, and say so.
- **Retitling is free** — trust is keyed to the command text, not the label.
- **Never** try to work around the gate (no wrapper action that runs another, no encoding the real command elsewhere). It exists so the human is never surprised by what a click does.

## Safety

- Never invent an execute/run verb.
- The full command is always visible in the app before the human clicks Play.
- Prefer commands that work on the daemon host the human is using (drop or rewrite Mac-only tools when syncing to Linux — or mark them `--where local` so they only run on the Mac).
