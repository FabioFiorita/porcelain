---
name: porcelain-companion
description: Drive Porcelain — the review layer for agentic coding — via the bundled CLI (~/.porcelain/porcelain). Use for the Review (Intent · Execution · Evidence) as the start and end of a unit of work (features, bugs, chores, investigations), project board, saved terminal actions, repo notes, review-flow layers, review comments, and syncing companion setup across local/remote environments. Use whenever the human mentions Porcelain, the Review/Board/Terminal tabs, review comments, monorepo hide/pin, or you need to publish a review and close the loop.
version: 0.51.0
license: MIT
---

# Porcelain companion

Porcelain is where agent work becomes **trusted** work. It is a **review companion**, not the
agent host and not the editor: you keep writing where you already write; you publish the Review
here. You talk to Porcelain through one CLI; this skill is the manual.

**The Review is the home for a unit of work** — not a post-hoc dump after shipping. Humans and
agents **start** (Intent) and **end** (Execution + Evidence) here. Board is the queue of cards;
Review is the **one active story** per repo.

## The CLI

```text
~/.porcelain/porcelain
```

Installed automatically on every app/daemon launch. Run from **inside the repo** (git toplevel of
cwd); use `--repo <absolute path>` only for another checkout. `help` / `<noun> --help` list verbs.

```bash
~/.porcelain/porcelain help
```

## References

Read one when you need depth for that surface. Each is complete on its own.

```
references/
  review.md            The Review end to end: Intent · Execution · Evidence, lifecycle,
                       publish flow, mediums, comments, reviewed marks
  board.md             The queue of cards (todo/doing/done)
  actions.md           Saved terminal commands you curate and the human runs
  notes.md             The human's per-repo scratchpad (read-only)
  layers.md            Repo-wide Changes-tab flow grouping (regex layers)
  scope.md             Monorepo hide/pin
  git-visibility.md    What git carries, .porcelain/.gitignore and info/exclude
  sync-environments.md Seeding companion data across Mac ↔ remote
  worktrees.md         Working in a harness worktree
```

## Scripts

```bash
node <skill>/scripts/check-evidence.mjs [--repo <abs path>]
```

Run it before claiming a unit done. It reports an empty pack, missing CSS, `<script>` tags,
remote assets, broken image references (including `../assets/…`), the gallery count, and the
inlined size against the 4 MB read cap — all of which fail **silently** in the sandboxed Evidence
tab. Fix what it reports and run it again.

## When → what

| When | Do |
|------|----|
| **Start of session** / pick up a unit | `review clear` if the previous unit is done → `review set` with **name + thesis** |
| **Mid-session** | Grow Execution (files/notes); light Intent updates; handle comments |
| **End of session** / claim done | Complete Execution + real Evidence (checks · `results/` docs · `assets/` gallery); `check-evidence.mjs`; do not invent proof |
| Human left comments or asked what they reviewed | `comments list` / `answer` / `resolve`; `reviewed list` (read-only) |
| Pick up queued work; capture follow-ups | **Board** list/create/move (queue only — not a second Review) |
| Starting work; "check my notes" | `notes get` (human scratchpad — **read-only**) |
| Common commands should be one click for the human | Curate **actions** (you define; human runs) |
| Changes tab grouping wrong; too many files in Other | Tune **flow layers** (repo-wide regex) |
| Monorepo tree too noisy | **Scope** hide/pin |
| Seed Mac ↔ remote companion data | Copy deliberately with path remap |
| Working in a harness worktree | Target the right checkout; publish the Review **in** the worktree |
| "What does git carry / why is this ignored?" | Read and edit `.porcelain/.gitignore` and `info/exclude` **directly** — no CLI verb needed |

## Everyday CLI cheatsheet

```bash
# Plan / progress (Board = queue; Review = one active story)
~/.porcelain/porcelain board list
~/.porcelain/porcelain board create --title "…" [--body "…"] [--status todo|doing|done]
~/.porcelain/porcelain board move --id <id> --status doing|done

# Context
~/.porcelain/porcelain notes get

# The Review — clear → Intent-first start → grow → Evidence to finish
~/.porcelain/porcelain review clear
~/.porcelain/porcelain review set --name "…" --thesis "…"        # name + thesis is a full start
~/.porcelain/porcelain review set --name "…" --thesis "…" --files '[…]' --sections '[…]'
~/.porcelain/porcelain review set-canvas --medium html --html-file ./intent.html   # optional
~/.porcelain/porcelain intent prepare                 # seeds why/approach/decisions tabs
~/.porcelain/porcelain intent prepare --tabs why,approach,decisions   # or your own list
~/.porcelain/porcelain intent order --files why.md,approach.md
~/.porcelain/porcelain evidence prepare --title "…"   # makes checks + results/ + assets/
~/.porcelain/porcelain evidence check --label "pnpm test" --status pass --detail "…"
~/.porcelain/porcelain evidence results-order --files index.html,run-log.md
~/.porcelain/porcelain evidence results-list
~/.porcelain/porcelain evidence assets-list           # sizes + what will not render
~/.porcelain/porcelain evidence get
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

1. **Start of session** — If the previous unit is done (or this is a new unit), **`review clear`
   first** (drops the active set **and** the evidence pack under `.porcelain/active-review/`;
   the app **Archive** path keeps history under `.porcelain/reviews/`). Then `review set` with **name + thesis** — that alone is
   a complete Intent-first start; `--files` and `--sections` are optional. Works for **bugs,
   features, chores, and investigations** — not features only.
2. **During** — Grow Execution as you touch files; Intent updates are fine. Human comments and
   reviewed marks are app → agent (`comments` / `reviewed list`).
3. **End of session** — Complete Execution + **real Evidence** before claiming done: an
   `evidence check` per thing you ran, Results documents for what needs narrating, screenshots in
   `assets/`. Run `check-evidence.mjs`. Don't invent proof.
4. **Clear before a new unit** — Never leave another agent's Intent or old evidence under a new
   document. If the human still has a previous unit open, clear it (or ask) before starting.
5. **Notes are the human's** — read only; put actionable work on the board.
6. **Actions are human-executed** — never invent an `actions run`; you only CRUD definitions.
7. **Hide/pin via `scope`** — same channel the app uses (`<repo>/.porcelain/scope.json`,
   repo-relative paths).
8. **No secrets** in board, notes, or evidence.
9. **Board ≠ Review** — Board is a queue of cards; Review is one active story. Optional: move a
   card to Doing, then start Review with that title as the name. Do not turn Review into a second
   kanban.

## Lifecycle

**Start:** `board move` → doing (if you started from a card) → **`review clear`** if the previous
unit is done → **`review set --name "…" --thesis "…"`** → implement, keeping the board honest.

**End:** **`review set`** again with full Execution (files + notes + sections that match what
shipped) → validate → `evidence check` per thing you ran → `evidence prepare` → write `results/`
documents + drop screenshots in `assets/` → `evidence results-order` → `check-evidence.mjs` →
handle `comments list` → `board move` → done once the human has signed off → human Clear (or you
`review clear` before the **next** unit).

Full detail: [review.md](references/review.md).
