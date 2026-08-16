---
name: porcelain-companion
description: Drive Porcelain's daemon-root Review Canvas, Tasks, Actions, and explicit Canvas/project overlays through the bundled CLI. Use when the human asks to publish or inspect a Review, record Tasks or Actions, promote daemon data, or close the evidence loop.
version: 0.53.0
license: MIT
---

# Porcelain companion

Porcelain is an explicit product-surface procedure where agent work becomes trusted work. The daemon owns the
canonical state; the app and browser render it. Repo-local companion files are explicit tracked
overlays, not a live Review database.

## Start with the CLI

```text
~/.porcelain/porcelain
```

Run it inside the target checkout so Porcelain can resolve its Project and Worktree. Use
`--repo <absolute path>` only for another checkout. Read `help` when a verb is not listed here.

## References

Load the reference that matches the task:

```text
references/review.md             Review Canvas: Intent · Process · Execution · Evidence
references/tasks.md              daemon-wide Tasks
references/actions.md            Project Actions (definitions; the human runs them)
references/git-visibility.md      private state and tracked Canvas/project overlays
references/worktrees.md           targeting a Worktree from a harness checkout
references/sync-environments.md   daemon/Project setup across environments
```


## Everyday commands

```bash
# Review Canvas — one daemon-root Review template per Project
~/.porcelain/porcelain review set --name "…" --thesis "…"
~/.porcelain/porcelain review set --name "…" --thesis "…" --files '[…]' --sections '[…]'
~/.porcelain/porcelain review get
~/.porcelain/porcelain review clear                    # explicit replacement only

# Tasks — daemon-wide rows, optionally linked to a Project and Worktree
~/.porcelain/porcelain tasks list
~/.porcelain/porcelain tasks add --title "…" [--status todo|doing|done|blocked]
~/.porcelain/porcelain tasks update --id <id> [--status <status>]
~/.porcelain/porcelain tasks done --id <id>

# Actions — definitions only; the human accepts and runs them in the app
~/.porcelain/porcelain actions list
~/.porcelain/porcelain actions create --title "…" --command "…" [--where primary|local]
~/.porcelain/porcelain actions update --id <id> [--title "…"] [--command "…"]
~/.porcelain/porcelain actions delete --id <id>

# Explicit tracked overlays
~/.porcelain/porcelain canvas list
~/.porcelain/porcelain canvas promote --id <canvas-id>
~/.porcelain/porcelain project promote-overrides
```

## The loop

1. For an intentionally published unit, write the Review Canvas with `review set`. It writes the
   Review template into the daemon-root Project store; it does not create a repo-local lifecycle.
2. Keep Intent (thesis), Process (sections), and Execution (declared files) current as the work
   changes. The Review is a Canvas with four tabs, not a queue and not an editor.
3. Close the loop with real Evidence: checks, Results documents, and an image gallery. Evidence
   belongs to the daemon-root Canvas bundle and is shown by the Evidence tab.
4. Record follow-ups that are outside the Canvas story as daemon-owned Tasks.

## Rules

- Ordinary code edits follow root AGENTS.md; they do not create, clear, or complete a Review.
- Create or clear a Review only when the human requests Companion work or the agent deliberately
  publishes a Review. Do not clear another active Review automatically.
- Complete Evidence validation before claiming an intentionally published Review complete.
- Clear or replace a Review only when the human explicitly requests replacement.
- A Task is a daemon-wide work row; it is not a Review and is not a per-repo board.
- Actions are definitions. Never invent an execute verb or bypass the human acceptance gate.
- Hide and pin through the app's Files surface; project defaults are private daemon state until an
  explicit `project promote-overrides` writes `.porcelain/project.json`. Promote a Canvas
  deliberately when the team should receive it in git; promotion never commits.
- Keep secrets out of Canvas, Tasks, Actions, and project overrides.
- Work in an isolated Playground for development daemons. Never aim proof at production port 43117
  or a real checkout.

For the full Review Canvas procedure, read [references/review.md](references/review.md).
