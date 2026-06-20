# Plan 001: README reflects the app that actually shipped

> **Executor instructions**: Follow this plan step by step. Run every
> verification command and confirm the expected result before moving to the
> next step. If anything in the "STOP conditions" section occurs, stop and
> report — do not improvise. When done, update the status row for this plan
> in `plans/README.md`.
>
> **Drift check (run first)**: `git diff --stat b224765..HEAD -- README.md`
> If `README.md` changed since this plan was written, compare the "Current state"
> excerpts against the live file before proceeding; on a mismatch, treat it as a
> STOP condition.

## Status

- **Priority**: P1
- **Effort**: S
- **Risk**: LOW
- **Depends on**: none
- **Category**: docs
- **Planned at**: commit `b224765`, 2026-06-20

## Why this matters

The public-facing `README.md` states Porcelain has **no embedded terminal "on
purpose"** and lists itself as "not a terminal." That is now false: the app ships
a first-class embedded terminal (real PTYs via `node-pty` + xterm.js, a Terminal
sidebar tab, terminal tabs that survive in split view, and agent-curated saved
**Actions** the human runs). The Features list also omits several shipped
capabilities (repo-wide Search, the project Board, whole-feature review over an
MCP agent channel, and multi-window). A README that contradicts a flagship
feature is the most visible "actively wrong doc" in the repo — worse than a
missing doc, because a reader trusts it. This plan brings the README in line with
the shipped product. It changes **only documentation**; no code behavior moves.

## Current state

`README.md` (repo root). The two wrong claims and the stale Features list:

- Line 12 (positioning sentence):
  > It's a fast, focused **viewer** — not an editor, not a terminal — built to read code and review changes alongside your agent and your real terminal (Ghostty, Warp, whatever you like).
- Lines 18 (the "Why Porcelain" terminal bullet), verbatim:
  > - **A terminal *companion*, not a terminal.** Porcelain has no embedded terminal on purpose — it can't beat Ghostty or Warp and won't try. The git actions it does offer (quick commands, commits) run in-app with output shown inline.
- The "## Features" list (lines ~22–29) currently lists: flow-ordered diff review, Git, fast file viewer, monorepo navigation, Cmd+P/Cmd+F/find-references, liquid-glass UI, auto-updating builds. It omits: **embedded terminal + Actions**, **repo-wide Search (⌘2)**, **project Board**, **whole-feature review (agent/MCP channel)**, **multi-window (one repo per window)**.

What actually shipped (ground truth — do not re-describe mechanics, just make the
prose accurate). These are confirmed in the codebase and `CLAUDE.md`'s
Nomenclature table:

- **Embedded terminal**: real PTYs via `node-pty` (`src/main/terminal-manager.ts`),
  xterm.js renderer, a Terminal sidebar tab and `terminal` tab kind, split-view
  terminals, terminal sessions that **outlive their tabs**. Added 2026-06-16,
  explicitly reversing the old "never a terminal" rule (see
  `.agents/skills/architecture/SKILL.md` "Embedded terminal").
- **Actions**: saved named shell commands the agent curates and the **human runs**
  with one click in the embedded terminal (`~/.porcelain/actions.json`).
- **Search tab (⌘2)**: repo-wide code search.
- **Project Board**: per-repo todo/doing/done cards, two-way with the agent over MCP.
- **Feature review**: widen a change to the whole feature (changed / context /
  shipped files) in flow order, fed by an agent over an MCP channel; plus review
  comments app→agent.
- **Multi-window**: one repo per window (File → New Window, ⌘⌥N).

(The terminal is a *companion* terminal — it exists to run your coding agent and
its tasks beside the review surface, not to replace Ghostty/Warp. Keep that
nuance; the product is still "review-first," it just no longer claims to have no
terminal.)

## Commands you will need

| Purpose   | Command          | Expected on success |
|-----------|------------------|---------------------|
| Lint/format | `pnpm lint`    | exit 0 (Biome also checks Markdown formatting) |
| Build (sanity) | `pnpm build` | exit 0 (README is not compiled, but run once at the end) |

(Markdown isn't typechecked or tested. `pnpm lint` is the only gate that touches
it — Biome formats Markdown. There is no doc test.)

## Scope

**In scope** (the only file you should modify):
- `README.md`

**Out of scope** (do NOT touch):
- Any source file, `CLAUDE.md`, or the skills under `.agents/skills/` — those are
  already accurate; this plan only fixes the README.
- The "Develop", "Install", "Common scripts", and "License" sections — they are
  correct. Leave them as-is.
- Do **not** add screenshots or new images (none exist to reference).

## Git workflow

- Commit straight to `main` (this repo commits directly to `main`; do not create a
  branch — the git-guard hook hard-blocks branch creation).
- Conventional Commits style; example from `git log`: `docs: trim Nomenclature to vocabulary`.
  Use something like `docs: bring README in line with shipped terminal/search/board/feature review`.
- Do NOT push unless the operator instructs it.

## Steps

### Step 1: Fix the positioning sentence (line ~12)

Rewrite the "not an editor, not a terminal" clause so it no longer denies the
terminal. Keep the "viewer-first / review-first" identity. Suggested replacement
(adapt wording, keep it tight):

> It's a fast, focused **viewer and review surface** — not an editor — built to
> read code and review changes alongside your coding agent, with an embedded
> terminal to run the agent right beside the diff.

### Step 2: Replace the "no embedded terminal" bullet (line ~18)

Replace the bullet that says "Porcelain has no embedded terminal on purpose" with
one that describes the shipped terminal + Actions accurately. Suggested:

> - **An embedded terminal for your agent.** Run your coding agent (and its
>   tasks) in a real PTY right beside the review surface — sessions outlive their
>   tabs, so a background dev server keeps running when you close the tab. Saved
>   **Actions** (named commands your agent curates) are one click away.

### Step 3: Add the missing Features bullets

In the "## Features" list, add bullets for the shipped-but-undocumented features.
Suggested additions (match the existing bullet voice — bold lead, em-dash, terse):

> - **Embedded terminal & Actions** — real PTYs (xterm.js + node-pty), split-view
>   terminals, sessions that outlive their tabs, and saved Actions your agent
>   curates and you run
> - **Repo-wide search** (⌘2) and **project board** — todo/doing/done cards
> - **Whole-feature review** — widen a diff to the entire feature in flow order
>   (changed · context · shipped files), fed by your agent over a local MCP channel
> - **Multi-window** — one repo per window

### Step 4: Reconcile the "review changes alongside your real terminal" framing

Search the README for any remaining phrase implying Porcelain has no terminal or
that you bring your *own* terminal as the only option (e.g. "your real terminal
(Ghostty, Warp…)"). The companion terminal is fine to mention, but remove any
phrasing that says Porcelain itself has none. Adjust to "alongside your coding
agent" or note the in-app terminal complements, not replaces, your daily driver.

**Verify**: `grep -niE "no embedded terminal|not a terminal" README.md` → **no matches**.

### Step 5: Lint + build sanity

**Verify**: `pnpm lint` → exit 0 (Biome may reformat the Markdown; let it).
**Verify**: `pnpm build` → exit 0 (sanity that nothing else broke).

## Test plan

- No automated tests exist for docs. Verification is the two `grep`s above plus
  `pnpm lint`.
- Manual read-through: the Features list now names terminal, Actions, search,
  board, feature review, and multi-window; no sentence claims the app has no
  terminal.

## Done criteria

ALL must hold:

- [ ] `grep -niE "no embedded terminal|not a terminal" README.md` returns no matches
- [ ] The "## Features" list contains bullets for the embedded terminal/Actions,
      search/board, whole-feature review, and multi-window
- [ ] `pnpm lint` exits 0
- [ ] `pnpm build` exits 0
- [ ] Only `README.md` is modified (`git status --porcelain` shows only `README.md`)
- [ ] `plans/README.md` status row updated

## STOP conditions

Stop and report back (do not improvise) if:

- `README.md` has already been substantially rewritten since `b224765` (the
  "Current state" excerpts don't match) — the doc may already be fixed.
- You're unsure whether a feature listed here actually shipped — check
  `CLAUDE.md`'s Nomenclature table; if a feature isn't there, omit it rather than
  inventing it.

## Maintenance notes

- Keep the README's feature list in sync the next time a `TabKind` is added — the
  Nomenclature table in `CLAUDE.md` is the source of truth for what's shipped.
- A reviewer should confirm the prose still reads as "review-first," not "we're an
  IDE now" — the terminal is a companion, and the product principle (no editor/
  LSP/autocomplete) is unchanged.
