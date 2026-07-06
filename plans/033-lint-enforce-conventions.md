# Plan 033: Lint-enforce "named exports only" (the repo's own rule: Biome over prose)

> **Executor instructions**: Follow this plan step by step. Run every
> verification command and confirm the expected result before moving to the
> next step. If anything in the "STOP conditions" section occurs, stop and
> report — do not improvise. When done, update the status row for this plan
> in `plans/README.md` — unless a reviewer dispatched you and told you they
> maintain the index.
>
> **Drift check (run first)**: `git diff --stat 113e373..HEAD -- biome.json .agents/skills/architecture/SKILL.md`
> If either file changed since this plan was written, compare the
> "Current state" excerpts against the live code before proceeding; on a
> mismatch, treat it as a STOP condition.

## Status

- **Priority**: P3
- **Effort**: S
- **Risk**: LOW
- **Depends on**: none
- **Category**: dx
- **Planned at**: commit `113e373`, 2026-07-05

## Why this matters

CLAUDE.md hard-rule 4 says: "prefer enforcing a rule in Biome over writing it
in prose (a lint rule can't rot or be ignored)." The architecture skill states
three conventions as prose: named exports only (sole default: `App`), handlers
named by intent (never `handleX`), and explicit return types. Of these, exactly
one is cleanly machine-enforceable with Biome today — `noDefaultExport` — and
it's currently not enabled, so the convention rides on reviewer vigilance. This
plan enables it with the minimal override set, and *records* why the other two
stay prose (so the next audit doesn't re-open the question).

## Current state

`biome.json` linter block (verbatim):

```json
"linter": {
  "enabled": true,
  "rules": {
    "preset": "recommended",
    "suspicious": { "noExplicitAny": "error" }
  }
},
```

plus two `overrides` entries (import fences for Electron and lib/trpc —
`biome.json:31-76`; the pattern to imitate for scoped rules). `files.includes`
already excludes `.agents`, `marketing`, `plugins/porcelain/server.js`,
`src/renderer/src/components/ui` (vendored shadcn), and CSS.

Known default exports in lintable files (verified by grep at the planned-at
commit):

- `src/renderer/src/App.tsx` — the sanctioned sole app default export.
- `src/renderer/src/env.d.ts` — ambient/type declaration file.
- Config files export default by tool contract: `electron.vite.config.ts`,
  `vitest.config.ts`, `playwright.config.ts` (verify the actual set with the
  grep in Step 1 — e2e helpers or `e2e/tsconfig`-adjacent files may add to it).

The convention source: `.agents/skills/architecture/SKILL.md:95` — "Named
exports only (`export function PascalCase()`); the sole default export is
`App`."

Why the other two stay prose (record, don't attempt):

- **No-`handleX` naming**: Biome 2.5's `useNamingConvention` enforces case
  style, not name *content*; there is no clean rule for banning a prefix on
  function names without custom-plugin machinery this repo doesn't have.
- **Explicit return types**: Biome 2.5 has no stable equivalent of
  `explicit-function-return-type`. (If the installed Biome has gained
  `useExplicitType` or similar in `nursery` since, see STOP conditions — do
  not enable nursery rules without the maintainer's say.)

## Commands you will need

| Purpose   | Command       | Expected on success |
|-----------|---------------|---------------------|
| Lint      | `pnpm lint`   | exit 0              |
| Full gate | `pnpm verify` | exit 0              |

## Scope

**In scope**:
- `biome.json`
- `.agents/skills/architecture/SKILL.md` (one-phrase annotation)
- Source files ONLY if Step 1 finds a stray default export that violates the
  convention (convert it to a named export — expected count: zero)

**Out of scope**:
- `useNamingConvention` or any `nursery` rule — recorded as considered-and-not-done.
- The vendored `components/ui/**` (already excluded from Biome).
- Any behavioral code change.

## Git workflow

- Commit straight to `main` (hook-enforced verify; branches hook-blocked). Do NOT push.
- Message: `dx: lint-enforce named-exports-only (noDefaultExport) with the sanctioned override set`

## Steps

### Step 1: Inventory the actual default exports

```
grep -rln "export default" src e2e scripts *.ts --include='*.ts' --include='*.tsx' 2>/dev/null
```

Compare against the expected list in Current state. Any file NOT on that list
and NOT a tool-contract config is a convention violation: convert it to a named
export and fix its importers (expected: none — the audit found only `App.tsx`
and `env.d.ts` under `src/`).

**Verify**: the inventory matches expectations (or the conversions compile:
`pnpm typecheck` → exit 0).

### Step 2: Enable the rule with scoped overrides

In `biome.json`, add to the root rules:

```json
"style": { "noDefaultExport": "error" }
```

and a NEW override entry (modeled on the existing ones) exempting the
sanctioned files:

```json
{
  "includes": [
    "src/renderer/src/App.tsx",
    "**/*.config.ts",
    "**/*.d.ts",
    "playwright.config.ts"
  ],
  "linter": { "rules": { "style": { "noDefaultExport": "off" } } }
}
```

Adjust the `includes` to exactly what Step 1's inventory justified — no broader.
(Note the existing root `style` key usage in overrides — the root `rules` block
currently has no `style` key; add it alongside `suspicious`.)

**Verify**: `pnpm lint` → exit 0. Sabotage check (do, verify, revert): add
`export default 1` to any `src/backend/*.ts` file → `pnpm lint` FAILS with
`noDefaultExport`.

### Step 3: Annotate the prose

In `.agents/skills/architecture/SKILL.md:95`, change "Named exports only
(`export function PascalCase()`); the sole default export is `App`." to append
"(lint-enforced: `noDefaultExport`)". Do NOT delete the sentence — the skill
still carries the *why*; the rule carries the enforcement. Optionally append,
after the handlers-naming sentence, "(prose-only: Biome can't ban a name
prefix)" — one phrase, no more.

**Verify**: `pnpm verify` → exit 0.

## Test plan

The sabotage check in Step 2 is the test (lint rules don't get unit tests).

## Done criteria

- [ ] `pnpm verify` exits 0
- [ ] `grep -n "noDefaultExport" biome.json` → present at error level + one scoped override
- [ ] The sabotage check failed lint, then was reverted (`git status` clean of it)
- [ ] Architecture skill line annotated
- [ ] No files outside the in-scope list modified (plus any Step 1 conversions, listed in the commit message)
- [ ] `plans/README.md` status row updated

## STOP conditions

- Step 1's inventory turns up default exports in genuinely ambiguous territory
  (e.g. a build script where the tool contract is unclear) — list them and ask,
  don't guess the override.
- Enabling the rule floods errors from a directory the `files.includes` was
  assumed to exclude — re-check the excludes rather than adding blanket overrides.
- The installed Biome rejects `noDefaultExport` under `style` (schema drift
  across Biome versions) — check `pnpm exec biome explain noDefaultExport` for
  the correct group; report if it's moved to a group that changes semantics.

## Maintenance notes

- New tool configs that require default exports will trip the rule — extend the
  override's `includes` deliberately (that's the point: additions are now a
  visible diff on `biome.json`, not silent drift).
- If Biome stabilizes an explicit-return-type rule in a future major, revisit
  the second prose convention then (recorded here so the next audit finds it).
