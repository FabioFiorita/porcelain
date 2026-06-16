# Plan 010: Fix `-z` rename parsing in `parseStatus` and `parseNumstat`

> **Executor instructions**: Follow this plan step by step. Run every
> verification command and confirm the expected result before moving to the
> next step. If anything in the "STOP conditions" section occurs, stop and
> report — do not improvise. When done, update the status row for this plan
> in `plans/README.md`.
>
> **Drift check (run first)**: `git diff --stat e1f8d02..HEAD -- src/main/diff.ts src/main/git.ts`
> If `src/main/diff.ts` changed since this plan was written, compare the
> "Current state" excerpts against the live code before proceeding; on a
> mismatch, treat it as a STOP condition.

## Status

- **Priority**: P1
- **Effort**: S
- **Risk**: LOW
- **Depends on**: none
- **Category**: bug
- **Planned at**: commit `e1f8d02`, 2026-06-16

## Why this matters

When a file is renamed and the rename is **staged**, `git status --porcelain=v1 -z`
emits the entry as TWO NUL-delimited fields (`R  <newpath>\0<oldpath>\0`), but
`parseStatus` treats every NUL-delimited segment as a complete `XY path` entry.
The old-path segment becomes a **phantom changed file**: its first 3 characters
are sheared off (`entry.slice(3)` on a bare path), its status code is garbage so
it falls through to `'modified'`, and its staged/unstaged flags are derived from
the wrong bytes. That phantom row appears in the Changes list, the flow grouping,
and the feature view; clicking it opens a diff for a path that doesn't exist.

The same NUL-delimited rename shape breaks `parseNumstat`: `git diff --numstat -z`
emits a renamed-with-edits file as `adds\tdels\t\0<old>\0<new>\0` (empty path on
the stat line, old + new following as separate records), so the +/− counts are
dropped and the file shows no line counts in the Changes list.

After this plan, a staged rename produces exactly one correct row (the new path,
status `renamed`) with no phantom, and a renamed-with-edits file keeps its +/−
counts. This is pure-parser work with a clean unit-test story.

## Current state

- `src/main/diff.ts` — pure git-output parsers. Two are wrong for renames; a
  third (`parseNameStatus`) already handles renames correctly and is the pattern
  to mirror.
- `src/main/git.ts` — feeds these parsers the exact `-z` commands (confirmed):
  - `gitStatus` (line 104-109): `git status --porcelain=v1 -uall -z` → `parseStatus`
  - `gitNumstat` (line 111-113): `git diff HEAD --numstat -z` → `parseNumstat`

`parseStatus` as it exists today (`src/main/diff.ts:36-53`):

```ts
export function parseStatus(porcelainZ: string): ChangedFile[] {
  return porcelainZ
    .split('\0')
    .filter(Boolean)
    .map((entry) => {
      const xy = entry.slice(0, 2)
      const path = entry.slice(3)
      if (xy === '??') return { path, status: 'untracked' as const, staged: false, unstaged: true }
      const code = xy.trim().charAt(0)
      // X = index (staged) column, Y = working-tree (unstaged) column.
      return {
        path,
        status: statusByCode[code] ?? ('modified' as const),
        staged: xy.charAt(0) !== ' ',
        unstaged: xy.charAt(1) !== ' ',
      }
    })
}
```

`statusByCode` (`src/main/diff.ts:29-34`): `{ M:'modified', A:'added', D:'deleted', R:'renamed' }`.

`parseNameStatus` — the CORRECT rename-handling pattern to mirror (`src/main/diff.ts:76-90`):

```ts
export function parseNameStatus(out: string): ChangedFile[] {
  const parts = out.split('\0').filter(Boolean)
  const files: ChangedFile[] = []
  for (let i = 0; i < parts.length; i += 2) {
    const code = parts[i]?.charAt(0) ?? ''
    let path = parts[i + 1]
    if (code === 'R') {
      // renames carry old and new path; show the new one
      path = parts[i + 2]
      i += 1
    }
    if (path) files.push({ path, status: statusByCode[code] ?? 'modified' })
  }
  return files
}
```

`parseNumstat` as it exists today (`src/main/diff.ts:99-112`):

```ts
export function parseNumstat(out: string): DiffStat[] {
  return out
    .split('\0')
    .filter(Boolean)
    .map((entry) => {
      const [additions = '-', deletions = '-', path = ''] = entry.split('\t')
      return {
        path,
        additions: additions === '-' ? 0 : Number(additions),
        deletions: deletions === '-' ? 0 : Number(deletions),
      }
    })
    .filter((s) => s.path !== '')
}
```

**Key facts about the `-z` rename wire formats** (these are what the new tests assert):

- `git status --porcelain=v1 -z`, staged rename: the entry is `XY <newpath>` in
  the first NUL field, then `<oldpath>` as the very next NUL field. Example for
  staging a rename of `original.ts` → `renamed.ts`:
  `"R  renamed.ts\0original.ts\0"`. The new path is in the `R` segment; the old
  path is the trailing segment that must be **consumed and skipped** (it is not a
  separate changed file).
- `git diff --numstat -z`, renamed-with-edits: `"<adds>\t<dels>\t\0<oldpath>\0<newpath>\0"`.
  The numstat line's path field is **empty** (note the trailing `\t` before the
  NUL); `<oldpath>` and `<newpath>` follow as their own NUL records. The counts
  belong to `<newpath>`. (A pure rename with no content change emits `0\t0\t\0…`
  and may be dropped — only renamed-WITH-edits needs its counts preserved.)

Convention to match: these parsers are plain functions with no error handling and
tests in `src/main/diff.test.ts` using inline `\0`/`\t` string fixtures (see the
existing `parseStatus`/`parseNumstat`/`parseNameStatus` describe blocks). Match
that exact style.

## Commands you will need

| Purpose   | Command                  | Expected on success |
|-----------|--------------------------|---------------------|
| Install   | `pnpm install`           | exit 0              |
| Typecheck | `pnpm typecheck`         | exit 0, no errors   |
| Test (this file) | `pnpm test diff`  | all pass incl. new cases |
| Test (all) | `pnpm test`             | all pass            |
| Lint      | `pnpm lint`              | exit 0              |
| Build     | `pnpm build`             | exit 0              |

## Scope

**In scope** (the only files you should modify):
- `src/main/diff.ts` — fix `parseStatus` and `parseNumstat`
- `src/main/diff.test.ts` — add rename cases

**Out of scope** (do NOT touch):
- `src/main/git.ts` — the commands are already correct; do not change the flags.
- `parseNameStatus` — already correct; leave it as the reference.
- Any renderer code — the Changes list consumes `ChangedFile`/`DiffStat`
  unchanged; the shape does not change.

## Git workflow

Per `CLAUDE.md` hard rule 8, **commit straight to `main` — never create a
branch**. Run the full gate (below) before committing. Conventional Commits
style; example matching the repo log: `fix(diff): handle renamed files in the -z status and numstat parsers`.
Do NOT push unless the operator asks.

## Steps

### Step 1: Fix `parseStatus` to consume the old-path segment on renames/copies

Rewrite `parseStatus` to iterate the NUL segments with an index instead of
`.map`, so that when a segment's status code is `R` (renamed) or `C` (copied),
the **next** segment is treated as the old path and skipped. Keep the existing
behavior for `??` (untracked) and all other codes identical. Target shape:

```ts
export function parseStatus(porcelainZ: string): ChangedFile[] {
  const segments = porcelainZ.split('\0').filter(Boolean)
  const files: ChangedFile[] = []
  for (let i = 0; i < segments.length; i++) {
    const entry = segments[i] ?? ''
    const xy = entry.slice(0, 2)
    const path = entry.slice(3)
    if (xy === '??') {
      files.push({ path, status: 'untracked', staged: false, unstaged: true })
      continue
    }
    const code = xy.trim().charAt(0)
    // Renames/copies carry the old path as the next NUL field; the new path is
    // in this segment. Consume the old-path field so it isn't read as a file.
    if (code === 'R' || code === 'C') i += 1
    files.push({
      path,
      status: statusByCode[code] ?? 'modified',
      staged: xy.charAt(0) !== ' ',
      unstaged: xy.charAt(1) !== ' ',
    })
  }
  return files
}
```

**Verify**: `pnpm test diff` → existing `parseStatus` cases still pass (you have
not added the new ones yet).

### Step 2: Fix `parseNumstat` to attribute rename counts to the new path

Rewrite `parseNumstat` to iterate NUL records with an index. When a record splits
into `[additions, deletions, path]` with an **empty** `path` (the rename case),
the next two records are `<old>` and `<new>`; attribute the counts to `<new>` and
advance the index by 2. Otherwise behave exactly as today. Target shape:

```ts
export function parseNumstat(out: string): DiffStat[] {
  const records = out.split('\0').filter(Boolean)
  const stats: DiffStat[] = []
  for (let i = 0; i < records.length; i++) {
    const [additions = '-', deletions = '-', path = ''] = (records[i] ?? '').split('\t')
    const adds = additions === '-' ? 0 : Number(additions)
    const dels = deletions === '-' ? 0 : Number(deletions)
    if (path === '') {
      // Rename: this record is `adds\tdels\t`; the next two records are old, new.
      const newPath = records[i + 2]
      i += 2
      if (newPath) stats.push({ path: newPath, additions: adds, deletions: dels })
      continue
    }
    stats.push({ path, additions: adds, deletions: dels })
  }
  return stats
}
```

**Verify**: `pnpm test diff` → existing `parseNumstat` case still passes.

### Step 3: Add rename test cases

In `src/main/diff.test.ts`, extend the existing `describe('parseStatus', …)` and
`describe('parseNumstat', …)` blocks with the rename fixtures. Match the inline
`\0`/`\t` string style already used in the file.

Add to `parseStatus`:

```ts
it('treats a staged rename as one row (new path) without a phantom old-path row', () => {
  // `git status --porcelain=v1 -z` emits a staged rename as `R  <new>\0<old>\0`.
  const out = 'R  renamed.ts\0original.ts\0 M other.ts\0'
  expect(parseStatus(out)).toEqual([
    { path: 'renamed.ts', status: 'renamed', staged: true, unstaged: false },
    { path: 'other.ts', status: 'modified', staged: false, unstaged: true },
  ])
})
```

Add to `parseNumstat`:

```ts
it('attributes rename-with-edit counts to the new path', () => {
  // `git diff --numstat -z` emits a renamed-with-edits file as
  // `adds\tdels\t\0<old>\0<new>\0` (empty path on the stat line).
  const out = '2\t1\t\0old.ts\0new.ts\0'
  expect(parseNumstat(out)).toEqual([{ path: 'new.ts', additions: 2, deletions: 1 }])
})
```

**Verify**: `pnpm test diff` → all pass, including the 2 new cases.

### Step 4: Run the full gate

**Verify**: `pnpm lint && pnpm typecheck && pnpm test && pnpm build` → all exit 0.

## Test plan

- New tests in `src/main/diff.test.ts`:
  - `parseStatus`: a staged rename yields one `renamed` row for the new path and
    no phantom row for the old path; a following normal entry still parses.
  - `parseNumstat`: a renamed-with-edits record attributes its counts to the new
    path.
- Use the existing `describe` blocks in the same file as the structural pattern
  (inline NUL/tab string fixtures, `toEqual` on the full array).
- Verification: `pnpm test diff` → all pass including the new cases; `pnpm test`
  → full suite green (187+ tests).

## Done criteria

Machine-checkable. ALL must hold:

- [ ] `pnpm typecheck` exits 0
- [ ] `pnpm test` exits 0; the 2 new `diff.test.ts` cases exist and pass
- [ ] `pnpm lint` exits 0
- [ ] `pnpm build` exits 0
- [ ] No files outside the in-scope list are modified (`git status`)
- [ ] `plans/README.md` status row updated

## STOP conditions

Stop and report back (do not improvise) if:

- The `parseStatus`/`parseNumstat`/`parseNameStatus` code in `src/main/diff.ts`
  does not match the "Current state" excerpts (the file drifted).
- The existing `diff.test.ts` cases fail after your change (you changed behavior
  for the non-rename path — that must stay identical).
- `gitStatus`/`gitNumstat` in `src/main/git.ts` no longer pass `-z` (the wire
  format assumption is then invalid — report instead of guessing).

## Maintenance notes

- For the reviewer: confirm the non-rename behavior is byte-identical (the two
  existing `parseStatus` tests and the existing `parseNumstat` test must pass
  untouched) — the fix is purely additive handling for `R`/`C` and empty-path
  records.
- If a future change adds copy-detection (`-C`) to `gitStatus`/`gitNumstat`, the
  `C` code is already handled in `parseStatus`; verify `parseNumstat` copies use
  the same empty-path wire shape (they do, in git's `-z` output).
- Optional: append a one-line bullet to the `history` skill noting the `-z`
  rename-parsing fix (this is a bug fix, not an architectural decision, so a
  skill update is not strictly required by hard rule 4).
