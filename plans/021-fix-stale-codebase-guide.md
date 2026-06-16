# Plan 021: Fix stale `CODEBASE_GUIDE.md` references (deleted plans + Glaze source)

> **Executor instructions**: Follow this plan step by step. Run every
> verification command and confirm the expected result before moving on. If
> anything in "STOP conditions" occurs, stop and report. When done, update the
> status row in `plans/README.md`.
>
> **Drift check (run first)**: `git diff --stat e1f8d02..HEAD -- docs/CODEBASE_GUIDE.md`
> If it changed since this plan was written, re-locate the lines by their text
> (not line number) before editing.

## Status

- **Priority**: P3
- **Effort**: S
- **Risk**: LOW
- **Category**: docs
- **Depends on**: none
- **Planned at**: commit `e1f8d02`, 2026-06-16

## Why this matters

`docs/CODEBASE_GUIDE.md` is the human onboarding guide and stamps itself as the
authority for several subsystems. Two of its references are now actively wrong:

1. It describes `plans/` as "design/improvement plans (001–005), kept after
   implementation" — but those numbered plans were deleted, and the directory's
   contents change as advisor runs come and go. Pinning specific numbers and
   asserting "kept after implementation" is misleading.
2. It cites `plans/005-glaze-design-system.md` as the source for the Glaze design
   system — a **dead file reference**. The Glaze system's actual source of truth is
   the `architecture` skill (the "what") and the `history` skill (the "why"), per
   the guide's own "skills are the source of truth" framing.

Actively-wrong docs are worse than missing ones (the playbook's rule); a reader
following the guide to understand Glaze hits a 404. After this plan, the guide
points at living sources.

## Current state

`docs/CODEBASE_GUIDE.md` line ~185 (directory tour):

```
├── plans/             ← design/improvement plans (001–005), kept after implementation.
```

`docs/CODEBASE_GUIDE.md` lines ~485-486 (chrome section):

```
- The sidebars and main panel are **floating tiles** over that vibrancy "void" (8px gaps) — the
  "Glaze" design system (`plans/005-glaze-design-system.md`).
```

`docs/CODEBASE_GUIDE.md` line ~3 (header) — verify this against the `releasing`
skill (a possible second staleness): it claims the guide re-syncs as **"step 2 of
the `releasing` skill's runbook"**:

```
> **Last synced: v0.6.0.** This guide re-syncs against the code on every release (it's step 2 of
> the `releasing` skill's runbook), …
```

Read `.agents/skills/releasing/SKILL.md` and check which numbered step actually
syncs the guide; if it isn't step 2, fix the number (Step 3 below).

## Commands you will need

| Purpose   | Command          | Expected on success |
|-----------|------------------|---------------------|
| Lint      | `pnpm lint`      | exit 0 (markdown isn't Biome-linted, but confirms nothing else broke) |

(No build/test needed — this is documentation only.)

## Scope

**In scope**:
- `docs/CODEBASE_GUIDE.md` — three small text fixes.

**Out of scope** (do NOT touch):
- Any source file.
- The `architecture` / `history` / `releasing` skills — only READ the releasing
  skill to verify the step number; do not edit the skills here.
- The "Last synced: v0.6.0" version stamp — leave it (it's maintained by the
  release process).

## Git workflow

Per `CLAUDE.md` hard rule 8, **commit straight to `main` — never branch**.
Conventional Commits; example: `docs: fix stale plans/ and Glaze references in the codebase guide`.

## Steps

### Step 1: Make the `plans/` tour line accurate and number-agnostic

Replace the `plans/` directory-tour line with a generic description that doesn't
pin numbers or assert a keep/delete convention:

```
├── plans/             ← advisor-generated implementation plans (see plans/README.md), regenerated per audit.
```

### Step 2: Re-point the Glaze citation at the living source

Replace the Glaze parenthetical so it cites the skills (the source of truth),
not the deleted plan file:

```
- The sidebars and main panel are **floating tiles** over that vibrancy "void" (8px gaps) — the
  "Glaze" design system (see the `architecture` skill's Glaze notes and the `history` skill).
```

### Step 3: Verify and fix the runbook step number (header)

Read `.agents/skills/releasing/SKILL.md` and find which numbered step syncs the
codebase guide. If the header's "it's step 2 of the `releasing` skill's runbook"
does not match, correct the number. If you cannot unambiguously determine the
step, make it number-agnostic instead:

```
> … This guide re-syncs against the code on every release (a step in the `releasing` skill's runbook), …
```

**Verify**: `grep -n "plans/005\|001–005\|(001-005)" docs/CODEBASE_GUIDE.md` →
no matches (the dead references are gone).

### Step 4: Confirm nothing else broke

**Verify**: `pnpm lint` → exit 0.

## Test plan

- Documentation-only; no unit tests. Verification is the grep showing the dead
  references are gone and `pnpm lint` still passing.

## Done criteria

Machine-checkable. ALL must hold:

- [ ] `grep -n "plans/005-glaze" docs/CODEBASE_GUIDE.md` → no match
- [ ] `grep -n "001–005\|(001-005)" docs/CODEBASE_GUIDE.md` → no match
- [ ] The Glaze reference cites the `architecture`/`history` skills
- [ ] The header's runbook-step claim matches the `releasing` skill (or is made
      number-agnostic)
- [ ] `pnpm lint` exits 0
- [ ] Only `docs/CODEBASE_GUIDE.md` (and `plans/README.md`) modified (`git status`)
- [ ] `plans/README.md` status row updated

## STOP conditions

Stop and report back (do not improvise) if:

- The guide has been regenerated since this plan was written and no longer contains
  these references (then this plan is already satisfied — mark it DONE/REJECTED with
  a note).
- The `releasing` skill's structure makes the "which step syncs the guide" question
  ambiguous — use the number-agnostic wording and note it.

## Maintenance notes

- For the reviewer: the guide claims to self-sync on release; this fix removes the
  dead references now so it's correct before the next release reconciles it.
- If the project decides `plans/` should be git-ignored or always deleted after
  execution, revisit this tour line to match that decision.
