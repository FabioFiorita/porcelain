# Plan 019: Tokenize the arbitrary font-size literals into a named scale

> **Executor instructions**: Follow step by step. Run every verification command and
> confirm the expected result. If a "STOP condition" occurs, stop and report. When
> done, update this plan's row in `plans/README.md`.
>
> **Drift check (run first)**:
> `git diff --stat b224765..HEAD -- src/renderer/src/assets/main.css`
> If it changed since this plan was written, compare against "Current state"; on a
> mismatch, STOP. Also re-run the literal census (Step 0) — counts may have shifted.

## Status

- **Priority**: P3
- **Effort**: M
- **Risk**: LOW (pixel-identical) — but touches ~38 files
- **Depends on**: none
- **Category**: tech-debt (design system)
- **Planned at**: commit `b224765`, 2026-06-20

## Why this matters

Colors in this app are thoroughly tokenized (an exemplary dual-theme system in
`main.css`), but the **type scale is not**: arbitrary `text-[Npx]` literals appear
~97 times across ~38 files, in 7 distinct sizes (`10px`×42, `13px`×30, `12.5px`×10,
`11px`×10, `9px`×3, `8.5px`×1, `10.5px`×1). The prior codebase audit named this "the
one real design-system gap." Promoting these to named theme sizes makes the
micro-scale a single source of truth and stops ad-hoc per-component sizes from
creeping in. This is a **pixel-identical** refactor (every literal maps to the same
rem), so it must produce **zero** visual change.

## Current state

Run the census to see the live numbers (they should match the table above):
```
grep -rhoE "text-\[[0-9.]+px\]" src/renderer/src | sort | uniq -c | sort -rn
grep -rEl "text-\[[0-9.]+px\]" src/renderer/src      # the ~38 files
```
The app is Tailwind CSS v4 with a tokenized `@theme` block in
`src/renderer/src/assets/main.css`. Tailwind v4 generates a `text-<name>` utility for
each `--text-<name>` theme variable. The default `text-xs` (0.75rem = 12px) and
`text-sm` (14px) are in use elsewhere and stay; this plan only tokenizes the **custom
sub-`xs`** sizes currently written as `text-[Npx]`.

## The mapping (pixel-identical — px ÷ 16 = rem)

| Literal        | rem (exact)   | Suggested token / utility |
|----------------|---------------|---------------------------|
| `text-[8.5px]` | `0.53125rem`  | `--text-4xs` → `text-4xs` |
| `text-[9px]`   | `0.5625rem`   | `--text-3xs` → `text-3xs` |
| `text-[10px]`  | `0.625rem`    | `--text-2xs` → `text-2xs` |
| `text-[10.5px]`| `0.65625rem`  | `--text-2xs-plus`? (one-off) |
| `text-[11px]`  | `0.6875rem`   | `--text-xxs` → `text-xxs`  |
| `text-[12.5px]`| `0.78125rem`  | `--text-xs-plus`? (between xs/sm) |
| `text-[13px]`  | `0.8125rem`   | `--text-xs2` → `text-xs2`  |

The exact rem values are mandatory (pixel-identical). The **names** are yours to
choose — pick a consistent, documented scheme and apply it uniformly. The two
one-offs (`10.5px`, `12.5px`) are awkward to name semantically; either give them a
token too (keeps the grep clean) or, **with a note in the PR**, leave those two as
literals if a name would be misleading — but prefer tokenizing all seven so the grep
done-criterion is clean. Do **not** "round" a one-off to a neighbor (that's a visual
change).

## Commands you will need

| Purpose   | Command                       | Expected on success |
|-----------|-------------------------------|---------------------|
| Census    | `grep -rhoE "text-\[[0-9.]+px\]" src/renderer/src \| sort \| uniq -c` | counts per size |
| Typecheck | `pnpm typecheck`              | exit 0 |
| Lint      | `pnpm lint`                   | exit 0 |
| Tests     | `pnpm test`                   | all pass |
| Build     | `pnpm build`                  | exit 0 |
| Visual (release gate) | `pnpm test:e2e`   | **no snapshot diffs** (proves pixel-identical) |

## Scope

**In scope**:
- `src/renderer/src/assets/main.css` (add the `--text-*` tokens to the `@theme` block)
- The ~38 renderer files containing `text-[Npx]` literals (replace each with the named
  utility)

**Out of scope** (do NOT touch):
- `text-xs` / `text-sm` and other default Tailwind sizes already in use — unchanged.
- Any non-font-size arbitrary value (`size-[7px]`, `left-[3px]`, `w-[...]`, etc.) — out
  of scope (the flow-spine geometry is a separate item).
- Colors, spacing, radius tokens — unchanged.
- Any rem value other than the exact px÷16 mapping (no rounding, no "cleanup" of sizes).

## Git workflow

- Commit straight to `main`; do not branch. A single commit is fine; or one commit for
  the tokens + one for the sweep.
- Conventional Commits, e.g. `refactor(design): tokenize the micro font-size scale`.
- Do NOT push unless instructed.

## Steps

### Step 0: Census

Run the two `grep`s above; record the per-size counts and the file list. This is your
checklist.

### Step 1: Define the tokens in `@theme`

In `main.css`'s `@theme` block, add a `--text-<name>` for each distinct size with the
**exact** rem from the mapping table. Add a short comment that these are the app's
sub-`xs` micro-scale (pixel values noted).

### Step 2: Replace literals, one size at a time

For each size, replace every `text-[Npx]` with its `text-<name>` utility across the
file list. Do one size fully, run `pnpm typecheck` + `pnpm build`, then the next —
this keeps each step verifiable and the blast radius small. Use the census grep after
each size to confirm that size is gone.

### Step 3: Confirm no literals remain

**Verify**: `grep -rE "text-\[[0-9.]+px\]" src/renderer/src` → no matches (or only the
two one-offs you deliberately left, documented in the PR).

### Step 4: Gate + visual proof

**Verify**: `pnpm verify` → all four pass.
**Verify (strongly recommended — this is the real proof of pixel-identity)**:
`pnpm test:e2e` → **zero** snapshot diffs. Because the rem values are identical, the
rendered pixels must be unchanged; any e2e visual diff means a wrong rem (a bug) — do
**not** `--update-snapshots` to paper over it. If you cannot run e2e, spot-check a few
screens in `pnpm dev` and state in the PR that e2e wasn't run.

## Test plan

- No new unit tests (it's a styling token refactor). The **e2e visual baselines** are
  the test: identical rem ⇒ identical screenshots ⇒ zero diff. A diff is a regression.
- Verification: the census grep is clean (Step 3) + `pnpm verify` + `pnpm test:e2e`
  with no snapshot changes (Step 4).

## Done criteria

ALL must hold:

- [ ] `main.css` `@theme` defines a named token for each tokenized size with the exact
      px÷16 rem
- [ ] `grep -rE "text-\[[0-9.]+px\]" src/renderer/src` is clean (modulo any
      deliberately-documented one-offs)
- [ ] `pnpm verify` passes
- [ ] `pnpm test:e2e` shows **no** visual snapshot diffs (or, if not run, the PR says so
      and a manual spot-check was done)
- [ ] `plans/README.md` status row updated

## STOP conditions

Stop and report if:

- `pnpm test:e2e` shows a visual diff after the change — a rem value is wrong; fix the
  rem, do NOT update the snapshot.
- A literal uses a size not in the mapping table (the census found a new one) — add a
  token for it (exact rem); don't fold it into a neighbor.
- The number of touched files is far larger than ~38 — re-scope and report; something
  else matched the grep.

## Maintenance notes

- After this, a new sub-`xs` size should be added as a token in `@theme`, not as a
  `text-[Npx]` literal — consider a brief note in the design section of a skill, or a
  Biome rule if arbitrary font sizes recur.
- The flow-spine magic geometry (`size-[7px]`, `left-[3px]`, `left-[7px]` in
  `feature-list.tsx`) is a separate, deferred design-token item (the prior audit's
  "D2") — not in scope here.
- A reviewer should confirm the e2e baselines did not change (the proof of pixel
  identity).
