---
name: porcelain-companion
description: Drive Porcelain — the review layer for agentic coding — via the bundled CLI (~/.porcelain/porcelain). Use for the Review (Intent · Process · Execution · Evidence) as the start and end of a unit of work (features, bugs, chores, investigations), the global Tasks table, project board, saved terminal actions, repo notes, review-flow layers, review comments, and syncing companion setup across local/remote environments. Use whenever the human mentions Porcelain, the Review/Tasks/Board/Terminal tabs, review comments, monorepo hide/pin, or you need to publish a review and close the loop.
version: 0.52.1
license: MIT
---

# Porcelain companion

Porcelain is where agent work becomes **trusted** work. It is a **review companion**, not the
agent host and not the editor: you keep writing where you already write; you publish the Review
here. You talk to Porcelain through one CLI; this skill is the manual.

**The Review is the home for an intentionally published unit of work** — not a post-hoc dump after
shipping. When a human requests Companion work or an agent deliberately publishes a Review, the
story starts with Intent, grows through Process and Execution, and ends with Evidence. Board is the queue of cards; Review is
the **one active story** per repo. Ordinary code edits do not create, clear, or complete a Review.

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
  review.md            The Review end to end: Intent · Process · Execution · Evidence, lifecycle,
                       publish flow, mediums, comments, reviewed marks
  tasks.md             The daemon-wide table of work across Projects (replaces Board)
  board.md             The retiring per-repo queue of cards (todo/doing/done)
  actions.md           Saved terminal commands you curate and the human runs
  notes.md             The human's per-repo scratchpad (read-only)
  layers.md            Repo-wide Changes-tab flow grouping (regex layers)
  scope.md             Monorepo hide/pin
  git-visibility.md    What git carries: the opt-in .porcelain/ Git overlay and how to promote a
                       Canvas or Project defaults into it, plus .gitignore and info/exclude
  sync-environments.md Seeding companion data across Mac ↔ remote
  worktrees.md         Working in a harness worktree
  migrate.md           The one-time move of a repo's legacy .porcelain/ companion into the
                       daemon-root Project store (Canvases, Tasks, Actions, hide/pin)
```

## Scripts

```bash
node <skill>/scripts/check-evidence.mjs [--repo <abs path>]
```

Run `check-evidence.mjs` before claiming an intentionally published Review complete. It reports an empty pack, missing CSS, `<script>` tags,
remote assets, broken local media references (including `../assets/…`), invalid `.url` gallery links, the gallery count, and the
inlined size against the 4 MB read cap — all of which fail **silently** in the sandboxed Evidence
tab. Fix what it reports and run it again.

## When → what

| When | Do |
|------|----|
| **Human requests Companion work / deliberate publication** | `review set` with **name + thesis**; clear an existing Review only for an explicitly requested replacement |
| **During an intentionally published Review** | Grow Execution (files/notes); light Intent updates; handle comments |
| **Claim an intentionally published Review complete** | Complete Execution + real Evidence (checks · `results/` docs · `assets/` gallery); `check-evidence.mjs`; do not invent proof |
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

# The Review — intentional start → grow → Evidence to finish
~/.porcelain/porcelain review clear
~/.porcelain/porcelain review set --name "…" --thesis "…"        # name + thesis is a full start
~/.porcelain/porcelain review set --name "…" --thesis "…" --files '[…]' --sections '[…]'
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

1. **Explicit publication only** — Companion is an explicit product-surface procedure, not an
   automatic session lifecycle. Do not clear another active Review automatically. Create or clear
   a Review only when the human requests Companion work or the agent deliberately publishes a
   Review. `review set` with **name + thesis** is a complete Intent-first start; `--files` and
   `--sections` are optional. Works for **bugs, features, chores, and investigations** — not
   features only.
2. **Ordinary code edits** — Follow root `AGENTS.md`; do not create, clear, or complete a Review.
3. **During an intentionally published Review** — Grow Execution as you touch files; Intent updates are fine. Human comments and
   reviewed marks are app → agent (`comments` / `reviewed list`).
4. **End of an intentionally published Review** — Complete Execution + **real Evidence** before claiming done: an
   `evidence check` per thing you ran, Results documents for what needs narrating, screenshots or
   recordings in `assets/`. Run `check-evidence.mjs`. Don't invent proof.
5. **Intentional replacement** — Never leave another agent's Intent or old evidence under a new
   document. If the human requests replacing an active Review, clear it before starting the
   replacement; otherwise leave it untouched.
6. **Notes are the human's** — read only; put actionable work on the board.
7. **Actions are human-executed** — never invent an `actions run`; you only CRUD definitions.
8. **Hide/pin via `scope`** — same channel the app uses (`<repo>/.porcelain/scope.json`,
   repo-relative paths).
9. **No secrets** in board, notes, or evidence.
10. **Board ≠ Review** — Board is a queue of cards; Review is one active story. Optional: move a
    card to Doing, then start a Review only when publication is requested. Do not turn Review into
    a second kanban.

## Lifecycle

**Start when publication is requested:** `board move` → doing (if you started from a card) →
`review set --name "…" --thesis "…"`; if another Review is active, clear it only for an explicitly
requested replacement → implement, keeping the board honest.

**End of an intentionally published Review:** **`review set`** again with full Execution (files +
notes + sections that match what shipped) → validate → `evidence check` per thing you ran →
`evidence prepare` → write `results/` documents + drop screenshots or recordings in `assets/` →
`evidence results-order` → `check-evidence.mjs` → handle `comments list` → `board move` → done
once the human has signed off.

Full detail: [review.md](references/review.md).
