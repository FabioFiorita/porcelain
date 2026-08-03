---
name: porcelain-companion
description: Drive Porcelain — the review layer for agentic coding — via the bundled CLI (~/.porcelain/porcelain). Use for the Review (Intent · Execution · Evidence) as the start and end of a unit of work (features, bugs, chores, investigations), project board, saved terminal actions, repo notes, review-flow layers, review comments, and syncing companion setup across local/remote environments. Use whenever the human mentions Porcelain, the Review/Board/Terminal tabs, review comments, monorepo hide/pin, or you need to publish a review and close the loop.
---

# Porcelain companion

Porcelain is where agent work becomes **trusted** work. It is a **review companion**, not the agent host and not the editor: you keep writing where you already write; you publish the Review here. You talk to Porcelain through one CLI; this skill is the manual. Read a **reference** only when you need depth for that surface — keep this index in mind always.

**The Review is the home for a unit of work** — not only a post-hoc dump after shipping. Humans and agents **start** (Intent) and **end** (Execution + Evidence) here. Board is the queue of cards; Review is the **one active story** per repo.

## The CLI

```text
~/.porcelain/porcelain
```

Installed automatically on every app/daemon launch. Run from **inside the repo** (git toplevel of cwd); use `--repo <absolute path>` only for another checkout. `help` / `<noun> --help` list verbs.

```bash
~/.porcelain/porcelain help
```

## Surface map — when → what → reference

| When | Do | Reference |
|------|----|-----------|
| **Start of session** / pick up a unit (feature, bug, chore, investigation) | `review clear` if previous unit is done → `review set` with **name + thesis** (Intent-first; Execution may be thin) | [feature-review.md](references/feature-review.md) → [intent](references/intent.md) · [execution](references/execution.md) · [evidence](references/evidence.md) · [excalidraw](references/excalidraw.md) |
| **Mid-session** | Grow Execution (files/notes); optional light Intent updates; human comments / reviewed marks | same |
| **End of session** / claim done | Complete Execution + real Evidence; do not invent proof | [evidence.md](references/evidence.md) |
| Human left line/file comments or asked what they reviewed | `comments list` / `answer` / `resolve`; `reviewed list` (read-only) | [feature-review.md](references/feature-review.md) |
| Pick up queued work; track progress; capture follow-ups | **Board** list/create/move (queue only — not a second Review) | [board.md](references/board.md) |
| Starting work; "check my notes" | `notes get` (human scratchpad — **read-only**) | [notes.md](references/notes.md) |
| Common commands should be one click for the human | Curate **actions** (you define; human runs) | [actions.md](references/actions.md) |
| Changes tab grouping wrong; monorepo layout; too many files in Other | Tune **flow layers** (repo-wide regex) | [layers.md](references/layers.md) |
| Monorepo tree too noisy; hide sibling apps / pin the one you care about | **Scope** hide/pin | [scope.md](references/scope.md) |
| Seed Mac ↔ remote companion data (board, actions, notes, layers, hide/pin) | Copy deliberately with path remap | [sync-environments.md](references/sync-environments.md) |
| Working in a harness worktree; it opened empty; reviewing worktree work | Seed the new repo path deliberately; publish the Review **in** the worktree, carry it into the PR | [worktrees.md](references/worktrees.md) |

## Everyday CLI cheatsheet

```bash
# Plan / progress (Board = queue; Review = one active story)
~/.porcelain/porcelain board list
~/.porcelain/porcelain board create --title "…" [--body "…"] [--status todo|doing|done]
~/.porcelain/porcelain board move --id <id> --status doing|done

# Context
~/.porcelain/porcelain notes get

# The Review — lifecycle: clear → Intent-first start → grow → Evidence to finish
~/.porcelain/porcelain review clear
~/.porcelain/porcelain review set --name "…" --thesis "…" --files '[…]' --sections '[…]'
~/.porcelain/porcelain review set-canvas --medium html --html-file ./intent.html   # optional; only for THIS unit
~/.porcelain/porcelain evidence prepare --title "…"   # then Write index.html + its own CSS in the printed dir
~/.porcelain/porcelain comments list
~/.porcelain/porcelain comments resolve --id <id>
~/.porcelain/porcelain reviewed list

# Terminal actions (definitions only)
~/.porcelain/porcelain actions list
~/.porcelain/porcelain actions create --title "…" --command "…" [--where primary|local]

# Changes-tab flow grouping
~/.porcelain/porcelain layers get
~/.porcelain/porcelain layers set --layers - <<'JSON'
[ { "label": "…", "pattern": "…" } ]
JSON

# Monorepo hide / pin (repo-relative paths)
~/.porcelain/porcelain scope list
~/.porcelain/porcelain scope hide --path apps/legacy
~/.porcelain/porcelain scope pin --path apps/web
```

## Standing rules

1. **Start of session** — If the previous unit is done (or this is a new unit), **`review clear` first** (drops the active set **and** `.porcelain/evidence/`; the app **Archive** path keeps history under `.porcelain/reviews/`). Then `review set` with **name + thesis** (+ optional light sections/files). This is Intent-first scope, not a fake-complete Review. Works for **bugs, features, chores, and investigations** — not features only.
2. **During** — Grow Execution as you touch files; Intent mid-session updates are OK. Human comments and reviewed marks are app → agent (`comments` / `reviewed list`).
3. **End of session** — Complete Execution + **real Evidence** before claiming done. Don't invent proof.
4. **Clear before a new unit** — Never leave another agent's Intent board or old evidence under a new document. If the human still has a previous unit open, clear it (or ask) before starting.
5. **Notes are the human's** — read only; put actionable work on the board.
6. **Actions are human-executed** — never invent an `actions run`; you only CRUD definitions.
7. **Hide/pin via `scope`** — same channel the app uses (`~/.porcelain/scope.json`); remap paths when syncing hosts ([scope.md](references/scope.md), [sync-environments.md](references/sync-environments.md)).
8. **No secrets** in board, notes, or evidence.
9. **Board ≠ Review** — Board is a queue of cards; Review is one active story. Optional: move a card to Doing, then start Review with that title as the name. Do not turn Review into a second kanban.

## Lifecycle paths

### Start of session (agent)

1. `board move` → doing (if you started from a card).
2. **`review clear`** if the previous unit is done.
3. **`review set --name "…" --thesis "…"`** — Intent-first; `--files` / `--sections` may be empty or light.
4. Implement; keep the board honest.

### End of session (agent)

1. **`review set`** again with full Execution (files + notes + sections that match what shipped).
2. Validate → `evidence prepare` + write HTML + `evidence check` (`prepare`/`set` start from an empty evidence dir).
3. Handle `comments list`; resolve when addressed.
4. `board move` → done when the human has signed off (or as they prefer).
5. Human Clear (or you `review clear` before the **next** unit).

Details: [feature-review.md](references/feature-review.md).
