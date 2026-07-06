# Plan 024: Re-point the skills at the post-daemon-split reality (doc-truth pass)

> **Executor instructions**: Follow this plan step by step. Run every
> verification command and confirm the expected result before moving to the
> next step. If anything in the "STOP conditions" section occurs, stop and
> report — do not improvise. When done, update the status row for this plan
> in `plans/README.md` — unless a reviewer dispatched you and told you they
> maintain the index.
>
> **Drift check (run first)**: `git diff --stat 113e373..HEAD -- .agents/skills/audit/SKILL.md .agents/skills/architecture/SKILL.md .agents/skills/product/SKILL.md README.md src/backend/server.ts`
> If any in-scope file changed since this plan was written, compare the
> "Current state" excerpts against the live code before proceeding; on a
> mismatch, treat it as a STOP condition.

## Status

- **Priority**: P1
- **Effort**: S
- **Risk**: LOW
- **Depends on**: none
- **Category**: docs
- **Planned at**: commit `113e373`, 2026-07-05

## Why this matters

This repo runs on an agent workflow where the `audit` skill is the invariant
checklist an agent reads **before** touching security/git/config code, and
CLAUDE.md hard-rule 4 requires skills to be updated in the same commit as the
decisions they record. The daemon split (v0.18–0.19) moved the backend from
`src/main/` to `src/backend/`, but the audit skill still points at least five
invariants at `src/main/<module>.ts` paths that no longer exist — contradicting
its own `*Verify:*` grep lines, which already say `src/backend`. Separately, the
architecture skill cites `plans/remote-environments.md` (deleted in commit
`c02e48c`; `plans/` was cleared), and two "no port opened" sentences predate the
daemon listener. An agent following these pointers opens nonexistent files or
carries a false mental model of the network surface.

## Current state

Verified stale pointers (doc line → code truth), all confirmed by grep at the
planned-at commit:

| Doc location | Says | Truth |
|---|---|---|
| `.agents/skills/audit/SKILL.md:16` | `src/main/external-url.ts` | `src/backend/external-url.ts` |
| `.agents/skills/audit/SKILL.md:22` | `src/main/read-limits.ts` | `src/backend/read-limits.ts` |
| `.agents/skills/audit/SKILL.md:101` | `src/main/review-store.ts` | `src/backend/review-store.ts` |
| `.agents/skills/audit/SKILL.md:246` | `src/main/json-store.ts` | `src/backend/json-store.ts` |
| `.agents/skills/audit/SKILL.md:257` | `runGit` in `src/main/git.ts` | `src/backend/git.ts` |

Reproduce the list yourself (this is also the after-fix verify):

```
grep -n 'src/main/external-url\|src/main/read-limits\|src/main/review-store\|src/main/json-store\|src/main/git\.ts\|src/main/review-watch' .agents/skills/audit/SKILL.md
```

Dangling plan references (the file was deleted; `plans/` now holds only this
run's plans):

- `.agents/skills/architecture/SKILL.md:43` — "Phase 2+ of `plans/remote-environments.md` points the same client…"
- `.agents/skills/architecture/SKILL.md:49` — "The Beelink runbook consumes it (`plans/remote-environments.md` Phase 4)."
- Code comments also reference it: `src/backend/server.ts:57` ("plans/remote-environments.md Phase 2") and `src/backend/server.ts:286` ("Phase 4").
- Find them all: `grep -rn 'plans/remote-environments' .agents src CLAUDE.md README.md`

Stale "no port" phrasing (true only of the *MCP agent channel*, not the app —
the daemon listens on 127.0.0.1 and optionally the tailnet since v0.19):

- `.agents/skills/product/SKILL.md:17` — "…the app never opens a network port."
- `README.md:44` — "…an MCP server and skills that run locally, with no port
  opened and no telemetry."

Also semantically stale: `.agents/skills/audit/SKILL.md:24` — "**Main process =
the only OS/git/fs surface.**" Post-split, the **daemon** (`src/backend`) owns
git/fs; `src/main` keeps only the Electron-native rump (dialogs, windows,
updater, plugin installer). The invariant's *intent* (renderer = pure UI, no
Node APIs) is unchanged.

Missing feature coverage: `product/SKILL.md`'s core-features list has no entry
for remote access (tailnet bind, browser client, remote-daemon pointing) —
the headline of v0.19 per `CHANGELOG.md`.

Docs philosophy that applies (CLAUDE.md hard-rule 4): skills carry decisions and
traps, not mechanics; when fixing a pointer, do NOT expand it into a mechanics
paraphrase — change the path, keep the sentence.

## Commands you will need

| Purpose   | Command          | Expected on success |
|-----------|------------------|---------------------|
| Full gate | `pnpm verify`    | exit 0 (docs edits can't fail it, but the hook requires it before commit) |
| Verify fix | the two greps in Steps 1–2 | zero matches |

## Scope

**In scope** (the only files you should modify):
- `.agents/skills/audit/SKILL.md`
- `.agents/skills/architecture/SKILL.md`
- `.agents/skills/product/SKILL.md`
- `README.md`
- `src/backend/server.ts` (comment text only — two references)

**Out of scope**:
- `.claude/skills/*` — these are **symlinks** to `.agents/skills/*`; editing the
  target updates both. Do not de-symlink or copy.
- Any behavioral code change. If a doc claim and the code genuinely conflict
  beyond what's listed here, that's a STOP, not an edit.
- `marketing/` — the public site is a separate surface (recorded as a separate
  low-priority finding; not this plan).
- The `releasing` skill and `CLAUDE.md` — spot-checked clean for these issues.

## Git workflow

- Commit straight to `main` (branch creation is hook-blocked; `pnpm verify`
  is hook-enforced before commit). Do NOT push.
- Message style: `docs: re-point the audit/architecture skills at src/backend and drop the deleted plans/remote-environments.md references; scope the "no port" claim to the MCP channel`

## Steps

### Step 1: Fix the five `src/main/` pointers in the audit skill

In `.agents/skills/audit/SKILL.md`, change exactly the module directory in the
five locations listed in Current state (`src/main/external-url.ts` →
`src/backend/external-url.ts`, etc.). Leave the surrounding sentences intact.

Also update line 24's boundary sentence to name the real owner, keeping the
same rhythm, e.g.:

> **The daemon (`src/backend`) is the only OS/git/fs surface; `src/main` keeps
> only the Electron-native rump.** Renderer is pure UI, no Node APIs. …

(keep the existing type-only-imports sentence that follows it unchanged).

**Verify**: `grep -n 'src/main/external-url\|src/main/read-limits\|src/main/review-store\|src/main/json-store\|src/main/git\.ts' .agents/skills/audit/SKILL.md` → no matches.

### Step 2: Remove the dangling plan references

- `.agents/skills/architecture/SKILL.md:43` — replace "Phase 2+ of
  `plans/remote-environments.md` points the same client at a *remote* daemon"
  with "the remote-environments phases (shipped v0.18–0.19) point the same
  client at a *remote* daemon".
- `.agents/skills/architecture/SKILL.md:49` — the Beelink runbook reference:
  the runbook content lives in the git history of commit `600f110` and the
  `releasing` skill is its natural home if it's still needed. For THIS plan just
  reword to drop the dead path (e.g. "The Beelink runbook (commit `600f110`)
  consumes it"). Migrating the runbook into a skill is out of scope.
- `src/backend/server.ts:57` and `:286` — reword the two comments to drop the
  `plans/remote-environments.md` path (e.g. "…(remote-environments Phase 2,
  replacing the per-app-run token…)"). Comment-only change; no code.

**Verify**: `grep -rn 'plans/remote-environments' .agents src CLAUDE.md README.md` → no matches.

### Step 3: Scope the "no port" claims and add the missing feature bullet

- `.agents/skills/product/SKILL.md:17`: change "the app never opens a network
  port" → "the **agent channel** opens no network port (the MCP server is
  stdio-only; the daemon's token-gated loopback/tailnet listener is a separate,
  documented surface — see the `audit` skill)".
- `README.md:44`: change "with no port opened and no telemetry" → "over stdio —
  the agent channel opens no port — and with no telemetry".
- Add one bullet to `product/SKILL.md`'s Core features list (after the
  terminal bullet), using exactly this copy:

  > - **Remote access** — the same client, three ways in: the Mac app on a local
  >   daemon, the Mac app pointed at a remote daemon (Settings → Remote access),
  >   or any browser on the tailnet served by the daemon itself. One token-gated
  >   daemon surface either way; PTYs and review state live daemon-side, so they
  >   survive reconnects and follow you across devices.

- Add one sentence to README's feature list mentioning remote access /
  browser client (match the README's existing bullet voice; keep it to one
  bullet).

**Verify**: `grep -n 'never opens a network port' .agents/skills/product/SKILL.md` → no match; `grep -n 'no port opened' README.md` → no match.

### Step 4: Full gate

**Verify**: `pnpm verify` → exit 0.

## Test plan

No code tests — this is a docs plan. The greps in Steps 1–3 are the regression
checks; they are also listed in Done criteria so a future audit can re-run them.

## Done criteria

- [ ] All three verify-greps (Steps 1–3) return zero matches
- [ ] `ls -la .claude/skills/` still shows symlinks into `.agents/skills/` (unchanged)
- [ ] `pnpm verify` exits 0
- [ ] No files outside the in-scope list are modified (`git status`)
- [ ] `plans/README.md` status row updated

## STOP conditions

- A `src/main/<module>` pointer in the audit skill refers to a module that
  exists in **neither** `src/main` nor `src/backend` — that's real drift beyond
  this plan's inventory; report it.
- You find yourself rewriting more than a sentence or two around any pointer —
  the plan is path surgery, not a rewrite. Report the urge instead.
- The `plans/remote-environments.md` grep surfaces hits in files not listed in
  scope (other skills, e2e) — list them in your report; fix only the in-scope ones.

## Maintenance notes

- The root cause is hard-rule 4 discipline (skills updated in the same commit as
  the move). A reviewer of future `src/backend`↔`src/main` moves should grep the
  skills for the moved filename before approving.
- Deferred: relocating the Beelink runbook content into the `releasing` skill
  (needs a maintainer call on whether it's still live), and the marketing-site
  refresh (separate finding, recorded in the index).
