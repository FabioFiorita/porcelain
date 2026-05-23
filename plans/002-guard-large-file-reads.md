# Plan 002: Guard large-file reads with a size limit

> **Executor instructions**: Follow this plan step by step. Run every
> verification command and confirm the expected result before moving to the
> next step. If anything in the "STOP conditions" section occurs, stop and
> report — do not improvise. When done, update the status row for this plan
> in `plans/README.md`.
>
> **Drift check (run first)**: `git diff --stat 864f014..HEAD -- src/main/api.ts src/renderer/src/components/shell/viewer.tsx`
> If either in-scope file changed since this plan was written, compare the
> "Current state" excerpts against the live code before proceeding; on a
> mismatch, treat it as a STOP condition.

## Status

- **Priority**: P1
- **Effort**: M
- **Risk**: LOW-MED
- **Depends on**: none
- **Category**: perf
- **Planned at**: commit `864f014`, 2026-06-12

## Why this matters

Porcelain's headline principle is "performance is a feature: must stay fast on a
50 GB monorepo." But the `readFile` procedure reads the **entire** file into
memory before doing anything else: for an image it base64-encodes the whole
buffer into a data URL shipped over IPC, and for text it builds a full UTF-8
string. The binary check only inspects the first 8000 bytes — *after* the whole
file is already in memory. A single click on a large generated file, log, build
artifact, or high-res asset (all common in big monorepos) can freeze or OOM the
main process and flood the IPC channel. Adding a size guard turns that
worst-case click into an instant, graceful "file too large" view.

## Current state

- `src/main/api.ts` — the `FileView` union and the `readFile` procedure:

```56:71:src/main/api.ts
export type FileView =
  | { type: 'text'; content: string }
  | { type: 'image'; dataUrl: string }
  | { type: 'binary'; size: number }

const IMAGE_MIME: Record<string, string> = {
  png: 'image/png',
  jpg: 'image/jpeg',
  jpeg: 'image/jpeg',
  gif: 'image/gif',
  webp: 'image/webp',
  svg: 'image/svg+xml',
  ico: 'image/x-icon',
  bmp: 'image/bmp',
  avif: 'image/avif',
}
```

```239:251:src/main/api.ts
  readFile: t.procedure.input(z.string()).query(async ({ input }): Promise<FileView> => {
    const ext = input.split('.').at(-1)?.toLowerCase() ?? ''
    const imageMime = IMAGE_MIME[ext]
    if (imageMime) {
      const buffer = await readFile(input)
      return { type: 'image', dataUrl: `data:${imageMime};base64,${buffer.toString('base64')}` }
    }
    const buffer = await readFile(input)
    if (buffer.subarray(0, 8000).includes(0)) {
      return { type: 'binary', size: buffer.length }
    }
    return { type: 'text', content: buffer.toString('utf8') }
  }),
```

- `stat` is already imported in `api.ts` (used by `openRepoPath`, `pinnedEntries`):

```4:5:src/main/api.ts
import { readdir, readFile, stat, writeFile } from 'fs/promises'
import { basename, join } from 'path'
```

- `src/renderer/src/components/shell/viewer.tsx` — `FileContent` renders the union
  with an if-chain; the `too-large` branch must be added here:

```329:356:src/renderer/src/components/shell/viewer.tsx
function FileContent({ path, line }: { path: string; line?: number }): React.JSX.Element {
  const { data: view, error } = trpc.readFile.useQuery(path)

  if (error) {
    return <p className="p-4 text-sm text-destructive">{error.message}</p>
  }
  if (view === undefined) {
    return <p className="p-4 text-sm text-muted-foreground">Loading…</p>
  }

  if (view.type === 'image') {
    return (
      <div className="flex h-full items-center justify-center p-8">
        <img src={view.dataUrl} alt={path} className="max-h-full max-w-full object-contain" />
      </div>
    )
  }

  if (view.type === 'binary') {
    return (
      <div className="flex h-full items-center justify-center text-sm text-muted-foreground">
        Binary file · {(view.size / 1024).toFixed(1)} KB
      </div>
    )
  }

  return <TextFileView path={path} content={view.content} line={line} />
}
```

- **Conventions to follow** (verified during recon):
  - Pure logic in its own `src/main/*.ts` module with a sibling Vitest test;
    model after `src/main/fuzzy.ts` / `fuzzy.test.ts`.
  - tRPC types: `FileView` is a discriminated union exported from `api.ts` and
    consumed in the renderer via `trpc.readFile.useQuery`. Adding a variant is
    automatically type-checked across the boundary — no casts (banned).
  - The repo follows an exhaustive-handling rule for unions; the renderer's
    if-chain must gain the new branch so every variant is handled.
  - No explanatory code comments (user rule). No `any`.

## Commands you will need

| Purpose   | Command                              | Expected on success |
|-----------|--------------------------------------|---------------------|
| Install   | `pnpm install`                       | exit 0              |
| Typecheck | `pnpm typecheck`                     | exit 0, no errors   |
| Test (one)| `pnpm test src/main/read-limits.test.ts` | all pass        |
| Test (all)| `pnpm test`                          | all pass            |
| Lint      | `pnpm lint`                          | exit 0              |
| Build     | `pnpm build`                         | exit 0              |

## Scope

**In scope** (the only files you should modify/create):
- `src/main/read-limits.ts` (create — the size constant + pure predicate)
- `src/main/read-limits.test.ts` (create)
- `src/main/api.ts` (modify: extend `FileView`, guard `readFile`)
- `src/renderer/src/components/shell/viewer.tsx` (modify: render the new branch)

**Out of scope** (do NOT touch):
- `gitFlow` in `api.ts` (lines ~269-301) already has its own per-file 1 MB cap
  for import parsing; leave it. Its threshold is independent of viewer reads.
- `gitDiffFile` / `synthesizeAddDiff` — diff rendering is a separate path; do not
  add size guards there in this plan.
- `VirtualRows` and syntax highlighting — virtualization already handles long
  files row-by-row; the issue is the read/transfer, not rendering.

## Git workflow

- Branch: `advisor/002-guard-large-file-reads`
- Commit message style: `feat: cap file reads and show a too-large view`
- Do NOT push or open a PR unless the operator instructed it.

## Steps

### Step 1: Add the size limit as a pure, testable module

Create `src/main/read-limits.ts`:

```ts
/** Files larger than this are not read into memory for viewing. */
export const MAX_READ_BYTES = 10 * 1024 * 1024

export function exceedsReadLimit(size: number): boolean {
  return size > MAX_READ_BYTES
}
```

**Verify**: `pnpm typecheck` → exit 0.

### Step 2: Test the predicate

Create `src/main/read-limits.test.ts` (model after `src/main/fuzzy.test.ts`):

- `exceedsReadLimit(0)` → `false`
- `exceedsReadLimit(MAX_READ_BYTES)` → `false` (boundary: equal is allowed)
- `exceedsReadLimit(MAX_READ_BYTES + 1)` → `true`

**Verify**: `pnpm test src/main/read-limits.test.ts` → all pass.

### Step 3: Add the `too-large` variant and guard `readFile`

In `src/main/api.ts`:

1. Extend the `FileView` union with `| { type: 'too-large'; size: number }`.
2. Import the new helpers at the top of the file (add to existing import block;
   no inline imports): `import { exceedsReadLimit } from './read-limits'`.
3. At the start of the `readFile` query body, `stat` the path and short-circuit
   before reading the bytes:

```ts
  readFile: t.procedure.input(z.string()).query(async ({ input }): Promise<FileView> => {
    const info = await stat(input)
    if (exceedsReadLimit(info.size)) {
      return { type: 'too-large', size: info.size }
    }
    const ext = input.split('.').at(-1)?.toLowerCase() ?? ''
    // ... rest unchanged ...
  }),
```

Leave the existing image/binary/text logic exactly as-is below the guard.

**Verify**: `pnpm typecheck` → exit 0. (Expect a type error in `viewer.tsx` until
Step 4 — that is the union forcing you to handle the new case. If `viewer.tsx`
does NOT error, STOP: the union may not be reaching the renderer as expected.)

### Step 4: Render the `too-large` branch in the viewer

In `src/renderer/src/components/shell/viewer.tsx`, add a branch in `FileContent`
(place it next to the `binary` branch) that mirrors the existing "Binary file"
styling. Show MB for large files:

```tsx
  if (view.type === 'too-large') {
    return (
      <div className="flex h-full items-center justify-center text-sm text-muted-foreground">
        File too large to preview · {(view.size / (1024 * 1024)).toFixed(1)} MB
      </div>
    )
  }
```

**Verify**: `pnpm typecheck` → exit 0; `pnpm lint` → exit 0.

## Test plan

- New `src/main/read-limits.test.ts` covering below/at/above the limit (Step 2).
- The `readFile` procedure itself reads the filesystem and is not unit-tested in
  this repo (no fs-based tests exist); do **not** add one. The pure predicate is
  the testable unit. Manual verification (optional, if a dev build is available):
  open a >10 MB file and confirm the "File too large" view appears instantly.
- Verification: `pnpm test` → all prior tests pass plus the new predicate tests.

## Done criteria

ALL must hold:

- [ ] `pnpm typecheck` exits 0
- [ ] `pnpm lint` exits 0
- [ ] `pnpm test` exits 0; `src/main/read-limits.test.ts` exists and passes
- [ ] `pnpm build` exits 0
- [ ] `FileView` in `api.ts` includes the `too-large` variant and `readFile`
      `stat`s before reading bytes
- [ ] `viewer.tsx` `FileContent` handles `view.type === 'too-large'`
- [ ] No files outside the in-scope list are modified (`git status`)
- [ ] `plans/README.md` status row for 002 updated

## STOP conditions

Stop and report back (do not improvise) if:

- The `readFile` procedure or `FileView` union no longer matches the "Current
  state" excerpts.
- Adding the union variant does NOT produce a type error in `viewer.tsx` before
  Step 4 (means the renderer isn't consuming the union the way this plan assumes).
- You find other procedures that read whole files for the viewer and would need
  the same guard — report them rather than expanding scope.
- A verification command fails twice after a reasonable fix attempt.

## Maintenance notes

- `MAX_READ_BYTES` is a single threshold for all file kinds. If image previews
  later need a different (smaller) cap than text, split the constant rather than
  lowering it globally — diffs and code views rely on the text path.
- A reviewer should confirm the `stat` happens before any `readFile`, so the big
  buffer is never allocated for oversized files.
- If a "load anyway" affordance is ever added, it must go through a separate
  procedure with its own cap — don't remove this guard from `readFile`.
