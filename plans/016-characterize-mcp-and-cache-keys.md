# Plan 016: Characterization tests for the MCP dispatch and the feature cache keys

> **Executor instructions**: Follow this plan step by step. Run every
> verification command and confirm the expected result before moving on. If
> anything in "STOP conditions" occurs, stop and report. When done, update the
> status row in `plans/README.md`.
>
> **Drift check (run first)**: `git diff --stat e1f8d02..HEAD -- src/mcp/server.ts src/main/api.ts`
> If either changed since this plan was written, compare the "Current state"
> excerpts against the live code; on a mismatch, treat it as a STOP condition.

## Status

- **Priority**: P2
- **Effort**: M
- **Risk**: LOW
- **Category**: tests
- **Depends on**: none (but unblocks safe refactors of `api.ts` and the flow code)
- **Planned at**: commit `e1f8d02`, 2026-06-16

## Why this matters

Two of the most consequential pieces of the codebase have **zero** test coverage:

1. The MCP server's `callTool` dispatcher (`src/mcp/server.ts`) — the agent→app
   write path. It maps tool names to writes of the shared `~/.porcelain/review-sets.json`,
   enforces the `repoPath is required` guard, and rejects unknown tools. A
   regression here corrupts the user's real review-set file, and both the protocol
   layer (`protocol.ts`) and the file layer (`review-file.ts`) are tested in
   isolation while the glue that joins them is not.
2. The feature/flow **cache keys** in `src/main/api.ts` — the memoization the 3 s
   poll depends on. The keys are hand-built `JSON.stringify([...])` strings; if one
   ever omits a field that affects the view, the poll serves a stale view and the
   suite stays green. `api.ts` is the highest-churn module in the repo (≈31
   commits) and has no test.

Both need a small testability extraction first (the MCP `callTool` is wired to
stdin and can't be imported safely; `api.ts` imports `electron` so it can't be
imported into a Node test at all). After this plan, the agent-write dispatch and
the cache-key construction are pure, importable, and characterized.

## Current state

### MCP dispatch (`src/mcp/server.ts`)

`callTool` and its `asString` helper are module-scoped and NOT exported; the file
also wires `readline` to `process.stdin` at module top level, so importing it into
a test would attach a stdin listener. Relevant code (`src/mcp/server.ts:17-71`):

```ts
function asString(value: unknown): string | undefined {
  return typeof value === 'string' ? value : undefined
}

async function callTool(name: string, args: Record<string, unknown>): Promise<string> {
  const repoPath = asString(args.repoPath)
  if (!repoPath) throw new Error('repoPath is required')
  if (name === 'set_feature_review') { … setReview(repoPath, reviewName, files) … }
  if (name === 'add_review_files') { … addReviewFiles(repoPath, files) … }
  if (name === 'clear_feature_review') { … clearReview(repoPath) … }
  if (name === 'get_feature_review') { return describeReview(repoPath, readReview(repoPath)) }
  throw new Error(`unknown tool: ${name}`)
}
…
let chain: Promise<void> = Promise.resolve()
const rl = createInterface({ input: process.stdin })
rl.on('line', (line) => { chain = chain.then(() => processLine(line)) })
```

The MCP server (`src/mcp/`) must stay **dependency-free** (Node builtins only) per
the audit invariant — it runs under a plain `node`. `callTool` imports only from
`./review-file` (also builtins-only), so extracting it keeps that invariant.

The test pattern to mirror is `src/mcp/review-file.test.ts`: it redirects
`PORCELAIN_REVIEW_SETS` to a temp file in `beforeEach`/`afterEach` and reads the
file back to assert writes landed.

### Cache keys (`src/main/api.ts`)

`api.ts` imports `electron` (`dialog`, `shell`) at the top, so it CANNOT be
imported into a vitest (Node) test. The key construction is inline in two places:

- `gitFlow` (`src/main/api.ts:405`): `const key = JSON.stringify([files, stats, layers])`
- `gatherFeature` (`src/main/api.ts:155`): `const key = JSON.stringify([files, stats, layers, reviewSet])`

`files` is `ChangedFile[]` (from `./diff`), `stats` is `DiffStat[]` (from `./diff`),
`layers` is `Layer[]` (from `./flow`), `reviewSet` is `ReviewSet | null` (from
`./review-set`). Extracting these into a pure module (no electron import) makes
them testable AND removes the duplicated key shape.

Pure-main-logic tests live next to source as `*.test.ts` and import the unit by
name (see `flow.test.ts`, `feature-view.test.ts`).

## Commands you will need

| Purpose   | Command                  | Expected on success |
|-----------|--------------------------|---------------------|
| Install   | `pnpm install`           | exit 0              |
| Typecheck | `pnpm typecheck`         | exit 0              |
| Test (mcp) | `pnpm test tools`       | new dispatch tests pass |
| Test (key) | `pnpm test feature-key` | new key tests pass  |
| Test (all) | `pnpm test`             | all pass            |
| Lint      | `pnpm lint`              | exit 0              |
| Build     | `pnpm build`             | exit 0 (server.js still emits) |

## Scope

**In scope**:
- `src/mcp/tools.ts` (create) — extract `callTool` + `asString`
- `src/mcp/server.ts` — import `callTool` from `./tools` instead of defining it
- `src/mcp/tools.test.ts` (create) — dispatch tests
- `src/main/feature-key.ts` (create) — extract `flowKey` + `featureKey`
- `src/main/api.ts` — use the extracted key functions (no behavior change)
- `src/main/feature-key.test.ts` (create) — key-stability tests

**Out of scope** (do NOT touch):
- `src/mcp/protocol.ts`, `src/mcp/review-file.ts` — already tested; unchanged.
- The MCP server's stdin wiring (the `readline`/`chain` loop) — keep it in
  `server.ts`; only `callTool`/`asString` move.
- Any cache *behavior* in `api.ts` — only the key *construction* is extracted; the
  `Map`s, the hit/miss checks, and the stringify-as-key approach stay identical.
- Do NOT add an npm dependency to `src/mcp/**`.

## Git workflow

Per `CLAUDE.md` hard rule 8, **commit straight to `main` — never branch**. Run the
full gate before committing. Conventional Commits; example:
`test(mcp,api): characterize the tool dispatch and feature cache keys`.

## Steps

### Step 1: Extract the MCP `callTool` dispatcher into `src/mcp/tools.ts`

Create `src/mcp/tools.ts` containing `asString` and `callTool` exactly as they are
in `server.ts` today (move, don't rewrite), with `callTool` `export`ed:

```ts
import {
  addReviewFiles,
  clearReview,
  describeReview,
  readReview,
  setReview,
  toReviewFiles,
} from './review-file'

function asString(value: unknown): string | undefined {
  return typeof value === 'string' ? value : undefined
}

export async function callTool(name: string, args: Record<string, unknown>): Promise<string> {
  // …move the existing body verbatim…
}
```

Then in `src/mcp/server.ts`, delete the local `asString` + `callTool` and import:

```ts
import { callTool } from './tools'
```

(Keep the `readline`/`processLine`/`chain` wiring in `server.ts`; `processLine`
still calls `handleRpc(message, callTool)`.)

**Verify**: `pnpm typecheck` → exit 0. `pnpm build` → exit 0 and
`ls out/main/mcp/server.js` exists (the build still emits the bundled server).

### Step 2: Test the dispatch in `src/mcp/tools.test.ts`

Create `src/mcp/tools.test.ts`, modeled on `src/mcp/review-file.test.ts` (temp
`PORCELAIN_REVIEW_SETS`, read the file back):

```ts
import { readFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { rmSync } from 'node:fs'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { callTool } from './tools'

const dir = join(tmpdir(), 'porcelain-tools-test')
const file = join(dir, 'review-sets.json')

beforeEach(() => {
  process.env.PORCELAIN_REVIEW_SETS = file
  rmSync(dir, { recursive: true, force: true })
})
afterEach(() => {
  delete process.env.PORCELAIN_REVIEW_SETS
  rmSync(dir, { recursive: true, force: true })
})
const read = (): Record<string, { name: string; files: unknown[] }> =>
  JSON.parse(readFileSync(file, 'utf8'))

describe('callTool', () => {
  it('requires repoPath', async () => {
    await expect(callTool('set_feature_review', { files: [] })).rejects.toThrow('repoPath is required')
  })
  it('rejects an unknown tool', async () => {
    await expect(callTool('bogus', { repoPath: '/repo' })).rejects.toThrow('unknown tool')
  })
  it('set_feature_review writes a repo-keyed set', async () => {
    await callTool('set_feature_review', { repoPath: '/repo', name: 'X', files: [{ path: 'a.ts' }] })
    expect(read()['/repo']).toEqual({ name: 'X', files: [{ path: 'a.ts' }] })
  })
  it('add_review_files merges into the existing set', async () => {
    await callTool('set_feature_review', { repoPath: '/repo', files: [{ path: 'a.ts' }] })
    await callTool('add_review_files', { repoPath: '/repo', files: [{ path: 'b.ts' }] })
    expect(read()['/repo']?.files).toEqual([{ path: 'a.ts' }, { path: 'b.ts' }])
  })
  it('clear_feature_review removes the set', async () => {
    await callTool('set_feature_review', { repoPath: '/repo', files: [{ path: 'a.ts' }] })
    await callTool('clear_feature_review', { repoPath: '/repo' })
    expect(read()['/repo']).toBeUndefined()
  })
  it('get_feature_review describes the stored set', async () => {
    await callTool('set_feature_review', { repoPath: '/repo', name: 'X', files: [{ path: 'a.ts' }] })
    const text = await callTool('get_feature_review', { repoPath: '/repo' })
    expect(text).toContain('Feature review "X" for /repo')
  })
})
```

**Verify**: `pnpm test tools` → all pass.

### Step 3: Extract the cache-key construction into `src/main/feature-key.ts`

Create `src/main/feature-key.ts` (no electron import — only type imports):

```ts
import type { ChangedFile, DiffStat } from './diff'
import type { Layer } from './flow'
import type { ReviewSet } from './review-set'

/** Cache key for the flow view: any change to status, numstat, or layers busts it. */
export function flowKey(
  files: readonly ChangedFile[],
  stats: readonly DiffStat[],
  layers: readonly Layer[],
): string {
  return JSON.stringify([files, stats, layers])
}

/** Cache key for the feature view/reading: the flow inputs PLUS the agent review set. */
export function featureKey(
  files: readonly ChangedFile[],
  stats: readonly DiffStat[],
  layers: readonly Layer[],
  reviewSet: ReviewSet | null,
): string {
  return JSON.stringify([files, stats, layers, reviewSet])
}
```

In `src/main/api.ts`:
- import: `import { featureKey, flowKey } from './feature-key'`
- in `gitFlow`, replace `const key = JSON.stringify([files, stats, layers])` with
  `const key = flowKey(files, stats, layers)`
- in `gatherFeature`, replace `const key = JSON.stringify([files, stats, layers, reviewSet])`
  with `const key = featureKey(files, stats, layers, reviewSet)`

**Verify**: `pnpm typecheck` → exit 0; `pnpm test` → the full suite still passes
(behavior is unchanged — same string output).

### Step 4: Test the keys in `src/main/feature-key.test.ts`

```ts
import { describe, expect, it } from 'vitest'
import type { ChangedFile, DiffStat } from './diff'
import { DEFAULT_LAYERS } from './flow'
import { featureKey, flowKey } from './feature-key'

const files: ChangedFile[] = [{ path: 'a.ts', status: 'modified', staged: false, unstaged: true }]
const stats: DiffStat[] = [{ path: 'a.ts', additions: 1, deletions: 0 }]

describe('flowKey', () => {
  it('is stable for identical inputs', () => {
    expect(flowKey(files, stats, DEFAULT_LAYERS)).toBe(flowKey(files, stats, DEFAULT_LAYERS))
  })
  it('changes when status, stats, or layers change', () => {
    const base = flowKey(files, stats, DEFAULT_LAYERS)
    expect(flowKey([], stats, DEFAULT_LAYERS)).not.toBe(base)
    expect(flowKey(files, [], DEFAULT_LAYERS)).not.toBe(base)
    expect(flowKey(files, stats, DEFAULT_LAYERS.slice(0, 1))).not.toBe(base)
  })
})

describe('featureKey', () => {
  it('changes when the review set changes (so an agent write busts the cache)', () => {
    const none = featureKey(files, stats, DEFAULT_LAYERS, null)
    const withSet = featureKey(files, stats, DEFAULT_LAYERS, { name: 'X', files: [{ path: 'b.ts' }] })
    expect(withSet).not.toBe(none)
  })
})
```

**Verify**: `pnpm test feature-key` → all pass.

### Step 5: Run the full gate

**Verify**: `pnpm lint && pnpm typecheck && pnpm test && pnpm build` → all exit 0.

## Test plan

- `src/mcp/tools.test.ts`: repoPath guard, unknown-tool rejection, and each of the
  four tools round-tripping through the temp `review-sets.json`.
- `src/main/feature-key.test.ts`: `flowKey`/`featureKey` are stable for identical
  inputs and change when any contributing field changes (incl. the review set).
- Patterns: `src/mcp/review-file.test.ts` (temp-file redirect) and `flow.test.ts`
  (pure-logic, import-by-name).
- Verification: `pnpm test tools`, `pnpm test feature-key`, then `pnpm test` (full
  suite green, count increased by the new tests).

## Done criteria

Machine-checkable. ALL must hold:

- [ ] `pnpm typecheck` exits 0
- [ ] `pnpm test` exits 0; `tools.test.ts` and `feature-key.test.ts` exist and pass
- [ ] `pnpm lint` exits 0
- [ ] `pnpm build` exits 0 AND `out/main/mcp/server.js` exists (the MCP server
      still builds after the extraction)
- [ ] `grep -n "callTool" src/mcp/server.ts` shows it imported from `./tools`
      (not defined locally)
- [ ] `grep -n "flowKey\|featureKey" src/main/api.ts` shows both used
- [ ] `src/mcp/**` has no new npm import (only `node:*` + `./review-file`)
- [ ] No files outside the in-scope list are modified (`git status`)
- [ ] `plans/README.md` status row updated

## STOP conditions

Stop and report back (do not improvise) if:

- After moving `callTool`, `pnpm build` fails to emit `out/main/mcp/server.js` or
  the server's entry wiring breaks (report the build error — do NOT add a bundler
  config change to work around it without flagging).
- `api.ts`'s key construction doesn't match the "Current state" excerpts (it
  drifted — confirm the new key produces a byte-identical string to the old inline
  one before swapping).
- The extracted `callTool` needs anything from `server.ts` besides `asString` and
  the `review-file` imports (it should not).

## Maintenance notes

- For the reviewer: confirm `featureKey`/`flowKey` produce the *same* string the
  inline `JSON.stringify` did (no behavior change — this is characterization, not a
  fix). Confirm `src/mcp/tools.ts` imports only builtins + `review-file` (the
  dependency-free invariant).
- This plan unblocks plan 017 (flow refactor) and the deferred test in plan 014 by
  giving the cache keys and the MCP dispatch a regression net.
- If `flowKey` and `featureKey` ever need to diverge in what they hash (e.g. a new
  per-repo setting joins the view), update both the helper and these tests
  together.
