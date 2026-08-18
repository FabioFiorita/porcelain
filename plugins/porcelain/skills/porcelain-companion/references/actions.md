# Saved actions

Porcelain has saved **actions** — named shell commands the human runs in the embedded terminal with one click (dev server, storybook, test watcher, …). Curate them so the project's common commands are one click away for the human.

Actions belong to the **Project**, not to a checkout: they live in the owning Environment daemon's store (`$PORCELAIN_HOME/projects/<projectId>/actions.json`), so an action survives `git worktree remove` and every Worktree of the Project shares one list. Nothing is written into the repository.

Talk to Porcelain through the `porcelain` MCP tools. Every call takes `workspace` — the absolute path of the checkout, or `{projectId, worktreeId}` when the daemon runs on another host. A repository Porcelain has never opened has no Project id yet, so the tool says so instead of inventing one — open it in Porcelain once, then retry.

- `porcelain_context` with `include: ["actions"]` → the saved actions, each with an id, title, command, and optional `where`.
- `porcelain_action` with `op: "save"` and no `id` → add one (e.g. title "Storybook", command `pnpm --filter web storybook`).
- `porcelain_action` with `op: "save"` and an `id` → edit one.
- `porcelain_action` with `op: "delete"` and an `id` → remove one.

An Action you save arrives **untrusted**. The human reads the command text and approves it before
it can run, and editing the command drops that approval again — the command text is what runs, so
the command text is what gets trusted.

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
