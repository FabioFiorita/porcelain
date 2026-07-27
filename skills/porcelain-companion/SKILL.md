---
name: porcelain-companion
description: Drive Porcelain — the review layer for agentic coding — via the bundled CLI (~/.porcelain/porcelain). Use for the Feature Review (Intent · Execution · Evidence), project board, saved terminal actions, repo notes, review-flow layers, review comments, and syncing companion setup across local/remote environments. Use whenever the human mentions Porcelain, the Feature/Board/Terminal tabs, review comments, monorepo hide/pin, or you need to publish a review and close the loop.
---

# Porcelain companion

Porcelain is where agent work becomes **trusted** work. You talk to it through one CLI; this skill is the manual. Read a **reference** only when you need depth for that surface — keep this index in mind always.

## The CLI

```text
~/.porcelain/porcelain
```

Installed automatically on every app/daemon launch (no MCP, no registration). Run from **inside the repo** (git toplevel of cwd); use `--repo <absolute path>` only for another checkout. `help` / `<noun> --help` list verbs.

```bash
~/.porcelain/porcelain help
```

## Surface map — when → what → reference

| When | Do | Reference |
|------|----|-----------|
| Finished (or mid) a multi-file feature; human should review the *whole* story | Publish **the Review**: Intent + Execution, then Evidence after you validate | [feature-review.md](references/feature-review.md) → [intent](references/intent.md) · [execution](references/execution.md) · [evidence](references/evidence.md) · [excalidraw](references/excalidraw.md) |
| Human left line/file comments or asked what they reviewed | `comments list` / `answer` / `resolve`; `reviewed list` (read-only) | [feature-review.md](references/feature-review.md) |
| Pick up queued work; track progress; capture follow-ups | **Board** list/create/move | [board.md](references/board.md) |
| Starting work; "check my notes" | `notes get` (human scratchpad — **read-only**) | [notes.md](references/notes.md) |
| Common commands should be one click for the human | Curate **actions** (you define; human runs) | [actions.md](references/actions.md) |
| Changes tab grouping wrong; monorepo layout; too many files in Other | Tune **flow layers** (repo-wide regex) | [layers.md](references/layers.md) |
| Seed Mac ↔ remote companion data (board, actions, notes, layers, hide/pin) | Copy deliberately with path remap | [sync-environments.md](references/sync-environments.md) |

## Everyday CLI cheatsheet

```bash
# Plan / progress
~/.porcelain/porcelain board list
~/.porcelain/porcelain board create --title "…" [--body "…"] [--status todo|doing|done]
~/.porcelain/porcelain board move --id <id> --status doing|done

# Context
~/.porcelain/porcelain notes get

# The Review
~/.porcelain/porcelain review set --name "…" --thesis "…" --files '[…]' --sections '[…]'
~/.porcelain/porcelain evidence prepare --title "…"   # then Write index.html in the printed dir
~/.porcelain/porcelain comments list
~/.porcelain/porcelain comments resolve --id <id>
~/.porcelain/porcelain reviewed list

# Terminal actions (definitions only)
~/.porcelain/porcelain actions list
~/.porcelain/porcelain actions create --title "…" --command "…"

# Changes-tab flow grouping
~/.porcelain/porcelain layers get
~/.porcelain/porcelain layers set --layers - <<'JSON'
[ { "label": "…", "pattern": "…" } ]
JSON
```

## Standing rules

1. **Close the loop with evidence** — after a meaningful feature, publish Intent + Execution, then real Evidence (what you actually ran). Don't invent proof.
2. **Notes are the human's** — read only; put actionable work on the board.
3. **Actions are human-executed** — never invent an `actions run`; you only CRUD definitions.
4. **Hide/pin** live in daemon `config.json` today (not CLI yet) — see [sync-environments.md](references/sync-environments.md) when remapping across hosts.
5. **No secrets** in board, notes, or evidence.

## Finish a feature (default path)

1. `board move` → doing (if you started from a card).
2. Implement; keep the board honest.
3. Publish Review: `review set` (+ optional Intent canvas) — details in [feature-review.md](references/feature-review.md).
4. Validate → `evidence prepare` + write HTML + `evidence check`.
5. Handle `comments list`; resolve when addressed.
6. `board move` → done.
