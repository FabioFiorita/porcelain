# Plan 011: Constrain agent-supplied review-set paths to the repo

> **Executor instructions**: Follow this plan step by step. Run every
> verification command and confirm the expected result before moving to the
> next step. If anything in the "STOP conditions" section occurs, stop and
> report — do not improvise. When done, update the status row for this plan in
> `plans/README.md`.
>
> **Drift check (run first)**: `git diff --stat e1f8d02..HEAD -- src/main/review-store.ts src/main/review-set.ts src/main/api.ts`
> If any of these changed since this plan was written, compare the "Current
> state" excerpts against the live code before proceeding; on a mismatch, treat
> it as a STOP condition.

## Status

- **Priority**: P1
- **Effort**: S
- **Risk**: LOW
- **Category**: security
- **Depends on**: none
- **Planned at**: commit `e1f8d02`, 2026-06-16

## Why this matters

The feature-view "review set" is a JSON file (`~/.porcelain/review-sets.json`)
authored by an **external process** — the MCP server the user's coding agent
spawns. Porcelain's own audit invariants already state this file is re-validated
with zod on every read *because an external process owns it*. But the per-file
`path` is validated only as `z.string().min(1)` — a non-empty string, with **no
containment check**. Those paths flow straight into a file read:
`readFile(join(repoPath, path), 'utf8')` (in `readSourcesInto`, `src/main/api.ts:134`),
and the contents are rendered into the feature view / reading surface.

So a review set whose entry is `path: "../../../../etc/ssh/id_rsa"` (or any
absolute path) makes `join(repoPath, path)` resolve **outside the repo**, and the
file's contents are read and displayed. A compromised or prompt-injected agent
that can write this file can exfiltrate arbitrary local file contents into the
viewer. This is the one external-input → `readFile` path that the project's
"arbitrary local absolute-path reads are by-design" exemption does **not** cover
(that exemption is for paths the *trusted renderer* asks for; this input comes
from an *untrusted external file*).

After this plan, review-set entries whose path is absolute or escapes the repo
root (`..`) are dropped at the read/validation boundary, so only repo-relative,
repo-contained files can ever be read through the agent channel. Legitimate
review sets (which always use repo-relative paths) are unaffected.

## Current state

- `src/main/review-store.ts` — the app's read side of the agent channel.
  `readReviewSet(repoPath)` reads the file, `reviewSetsSchema.parse`s it, and
  returns the entry for `repoPath`. This is the trust boundary: it already
  re-validates because an external process owns the file. The containment check
  belongs HERE (it has `repoPath`, and both feature procedures go through it).

  Current `readReviewSet` (`src/main/review-store.ts:22-32`):

  ```ts
  export async function readReviewSet(repoPath: string): Promise<ReviewSet | null> {
    try {
      const raw = await readFile(reviewSetsPath(), 'utf8')
      const all = reviewSetsSchema.parse(JSON.parse(raw))
      return all[repoPath] ?? null
    } catch {
      // absent, unparseable, or schema-invalid (an external process owns this file) —
      // treat as "no agent set" and fall back to the static baseline
      return null
    }
  }
  ```

- `src/main/review-set.ts` — the zod schema + `ReviewSet`/`ReviewSetFile` types.
  `reviewSetFileSchema.path` is `z.string().min(1)` (`src/main/review-set.ts:15-19`).
  `ReviewSet` is `{ name: string; files: ReviewSetFile[] }`.

- `src/main/api.ts` — the consumers. `readSourcesInto` reads each path under the
  repo (`src/main/api.ts:125-141`):

  ```ts
  const content = await readFile(join(repoPath, path), 'utf8')
  ```

  and the review-set paths reach it via `gatherFeature` → `buildFeatureFromGather`
  (`g.reviewSet?.files.map((file) => file.path)`, `src/main/api.ts:179`). Both
  `featureView` and `featureReading` call `gatherFeature` → `readReviewSet`, so a
  guard in `readReviewSet` covers both.

- `src/main/review-store.test.ts` — existing test file for this module; follow
  its structure (it redirects `PORCELAIN_REVIEW_SETS` to a temp file). Node's
  `path` module is already the dependency style here (`join`, `dirname` imported
  from `node:path`).

The relevant audit invariant (from the `audit` skill, "Security & process
boundary"): *"The MCP agent channel adds NO inbound network surface … The app
reads and watches one file … which it re-validates with zod on every read because
an external process owns it."* This plan strengthens that re-validation with path
containment.

## Commands you will need

| Purpose   | Command                          | Expected on success |
|-----------|----------------------------------|---------------------|
| Install   | `pnpm install`                   | exit 0              |
| Typecheck | `pnpm typecheck`                 | exit 0              |
| Test (this module) | `pnpm test review-store` | all pass incl. new cases |
| Test (all) | `pnpm test`                     | all pass            |
| Lint      | `pnpm lint`                      | exit 0              |
| Build     | `pnpm build`                     | exit 0              |

## Scope

**In scope**:
- `src/main/review-store.ts` — add a pure containment helper + filter the read set
- `src/main/review-store.test.ts` — add containment cases
- `.agents/skills/audit/SKILL.md` and `.agents/skills/history/SKILL.md` — record
  the new invariant (Step 4; this is a security invariant, so hard rule 4 applies)

**Out of scope** (do NOT touch):
- `src/main/review-set.ts` — the zod schema stays as-is; the containment check
  needs `repoPath`, which the schema doesn't have, so it lives in the read side.
- `src/mcp/**` — the MCP server (writer) is a separate dependency-free process;
  do not change it. The guard is on the app's READ side by design.
- `src/main/api.ts` — no change; it inherits the filtered set through
  `readReviewSet`.

## Git workflow

Per `CLAUDE.md` hard rule 8, **commit straight to `main` — never branch**. Run the
full gate before committing. Conventional Commits; example:
`fix(review-store): drop review-set paths that escape the repo root`.
Do NOT push unless asked.

## Steps

### Step 1: Add a pure containment helper

In `src/main/review-store.ts`, add (and `export`, so it's unit-testable) a pure
function that decides whether a review-set entry path is a repo-relative,
repo-contained file. Import the needed `node:path` functions at the top of the
file (the module already imports from `node:path`).

```ts
import { dirname, isAbsolute, join, relative, resolve } from 'node:path'
// (the file already imports `dirname` and `join` from 'node:path'; add the rest)

/**
 * True when `entryPath` (a path from the external, MCP-authored review-set file)
 * stays inside `repoPath`. Rejects absolute paths and `..`-escapes — the file is
 * owned by an untrusted external process, so its paths must be repo-contained
 * before they reach `readFile(join(repoPath, entryPath))`.
 */
export function isRepoContained(repoPath: string, entryPath: string): boolean {
  if (isAbsolute(entryPath)) return false
  const rel = relative(repoPath, resolve(repoPath, entryPath))
  return rel !== '' && !rel.startsWith('..') && !isAbsolute(rel)
}
```

**Verify**: `pnpm typecheck` → exit 0 (the helper compiles; it's not used yet).

### Step 2: Filter the review set in `readReviewSet`

After the zod parse, drop any file whose path is not repo-contained before
returning the set:

```ts
export async function readReviewSet(repoPath: string): Promise<ReviewSet | null> {
  try {
    const raw = await readFile(reviewSetsPath(), 'utf8')
    const all = reviewSetsSchema.parse(JSON.parse(raw))
    const set = all[repoPath]
    if (!set) return null
    return { ...set, files: set.files.filter((file) => isRepoContained(repoPath, file.path)) }
  } catch {
    // absent, unparseable, or schema-invalid (an external process owns this file) —
    // treat as "no agent set" and fall back to the static baseline
    return null
  }
}
```

**Verify**: `pnpm test review-store` → existing cases still pass.

### Step 3: Add containment tests

In `src/main/review-store.test.ts`, add cases that write a review set with a mix
of safe and escaping paths (via the `PORCELAIN_REVIEW_SETS` temp-file pattern the
file already uses) and assert the escaping ones are dropped. Also add direct unit
tests for `isRepoContained`. Example shape (adapt imports/temp-file setup to match
the existing test file):

```ts
import { isRepoContained, readReviewSet } from './review-store'

describe('isRepoContained', () => {
  it('accepts repo-relative paths', () => {
    expect(isRepoContained('/repo', 'src/a.ts')).toBe(true)
    expect(isRepoContained('/repo', 'a/../b.ts')).toBe(true) // normalizes inside
  })
  it('rejects absolute paths and parent escapes', () => {
    expect(isRepoContained('/repo', '/etc/passwd')).toBe(false)
    expect(isRepoContained('/repo', '../../../etc/passwd')).toBe(false)
    expect(isRepoContained('/repo', '.')).toBe(false) // the repo dir itself, not a file
  })
})

describe('readReviewSet path containment', () => {
  it('drops review-set entries that escape the repo', async () => {
    // write { '/repo': { name, files: [{path:'src/a.ts'}, {path:'../../secret'}] } }
    // to the temp PORCELAIN_REVIEW_SETS file, then:
    const set = await readReviewSet('/repo')
    expect(set?.files.map((f) => f.path)).toEqual(['src/a.ts'])
  })
})
```

**Verify**: `pnpm test review-store` → all pass including the new cases.

### Step 4: Record the invariant in the skills

This adds a security invariant, so per `CLAUDE.md` hard rule 4 update the home
skill and the decision log in the same commit.

- In `.agents/skills/audit/SKILL.md`, under "Security & process boundary", add a
  bullet (place it near the existing MCP-agent-channel invariant):

  > - **Agent-channel review-set paths are repo-contained on read.**
  >   `readReviewSet` (`src/main/review-store.ts`) drops any review-set entry whose
  >   path is absolute or escapes `repoPath` (`isRepoContained`), because the file
  >   is authored by an external process and its paths flow into
  >   `readFile(join(repoPath, path))`. *Why:* without it, a malicious/injected
  >   review set could read arbitrary local files into the feature view. *Verify:*
  >   new code that reads agent-supplied paths routes through the filtered set.

- In `.agents/skills/history/SKILL.md`, append a dateless bullet at the end:

  > - **Review-set paths constrained to the repo** (advisor plan 011): the
  >   agent-authored `~/.porcelain/review-sets.json` is re-validated with zod on
  >   read, but per-file `path` was only `min(1)`; `readReviewSet` now drops
  >   absolute/`..`-escaping paths (`isRepoContained`) before they reach
  >   `readFile(join(repoPath, path))` in the feature procedures. Closes the one
  >   external-input→read path the "local reads are by-design" exemption didn't
  >   cover.

**Verify**: `pnpm lint` → exit 0 (markdown isn't linted by Biome, but this
confirms nothing else broke).

### Step 5: Run the full gate

**Verify**: `pnpm lint && pnpm typecheck && pnpm test && pnpm build` → all exit 0.

## Test plan

- New tests in `src/main/review-store.test.ts`:
  - `isRepoContained`: accepts repo-relative (including paths that normalize back
    inside via `..`), rejects absolute paths, parent-escapes, and the repo dir
    itself.
  - `readReviewSet`: a stored set containing one safe and one escaping path returns
    only the safe path.
- Pattern: the existing `review-store.test.ts` (and `review-file.test.ts`) temp-
  file + `PORCELAIN_REVIEW_SETS` redirect.
- Verification: `pnpm test review-store` → all pass; `pnpm test` → full suite green.

## Done criteria

Machine-checkable. ALL must hold:

- [ ] `pnpm typecheck` exits 0
- [ ] `pnpm test` exits 0; new containment cases exist and pass
- [ ] `pnpm lint` exits 0
- [ ] `pnpm build` exits 0
- [ ] `grep -n "isRepoContained" src/main/review-store.ts` shows the helper used
      inside `readReviewSet`
- [ ] The `audit` and `history` skills each have the new bullet
- [ ] No files outside the in-scope list are modified (`git status`)
- [ ] `plans/README.md` status row updated

## STOP conditions

Stop and report back (do not improvise) if:

- `readReviewSet` no longer matches the "Current state" excerpt (the read side
  was refactored — re-confirm where the trust boundary is before adding the guard).
- You find an app-side code path that reads `reviewSet.files[].path` WITHOUT going
  through `readReviewSet` (the guard would then be incomplete — report it).
- Filtering breaks an existing `review-store.test.ts` case that legitimately uses
  a repo-relative path (it should not — report if so).

## Maintenance notes

- For the reviewer: confirm the guard is on the READ side (`readReviewSet`), not
  the schema — the schema can't see `repoPath`. Confirm `featureView` and
  `featureReading` both reach the filtered set (they both call `gatherFeature` →
  `readReviewSet`).
- The `exploreFeature` procedure reads files too, but it walks only paths in
  `git ls-files` (the repo's tracked set), so it's already repo-bounded — no guard
  needed there.
- If a future feature lets the agent declare files outside the repo deliberately,
  this guard must be revisited with an explicit, reviewed allowance — do not
  loosen it casually.
