# Plan 003: Make the config store durable and race-free

> **Executor instructions**: Follow this plan step by step. Run every
> verification command and confirm the expected result before moving to the
> next step. If anything in the "STOP conditions" section occurs, stop and
> report — do not improvise. When done, update the status row for this plan
> in `plans/README.md`.
>
> **Drift check (run first)**: `git diff --stat 864f014..HEAD -- src/main/config-store.ts src/main/api.ts`
> If either in-scope file changed since this plan was written, compare the
> "Current state" excerpts against the live code before proceeding; on a
> mismatch, treat it as a STOP condition.

## Status

- **Priority**: P1
- **Effort**: M
- **Risk**: LOW
- **Depends on**: none
- **Category**: bug
- **Planned at**: commit `864f014`, 2026-06-12

## Why this matters

The app config (`userData/config.json`) holds the user's per-repo setup: hidden
paths, pins, recents, and custom flow layers. Two defects threaten it:

1. **Non-atomic write + silent reset.** `saveConfig` writes the file with a
   single `writeFile` (no temp+rename). A crash or power loss mid-write truncates
   the file; on next launch `loadConfig` catches the parse error and silently
   returns `emptyConfig`, **discarding every saved setting** with no warning.
   For a tool whose differentiator is per-repo folder hiding, that is silent loss
   of the user's core configuration.
2. **Read-modify-write race.** Every config mutation does
   `saveConfig(withX(await loadConfig(), …))` over a single shared in-memory
   `cached` object. Two overlapping mutations both read the same base and the
   later write clobbers the earlier change. (Batch-hide happens to be safe — it
   awaits sequentially — but independent concurrent actions, e.g. pin-while-hide
   or two windows, drop writes.)

Both are fixed by routing all config reads/writes through a small persistence
module that (a) writes atomically via temp-file + rename, (b) backs up a corrupt
file instead of silently resetting, and (c) serializes read-modify-write updates.

## Current state

- `src/main/config-store.ts` — the whole store today:

```1:24:src/main/config-store.ts
import { app } from 'electron'
import { readFile, writeFile } from 'fs/promises'
import { join } from 'path'
import { type AppConfig, appConfigSchema, emptyConfig } from './repo-config'

const configPath = (): string => join(app.getPath('userData'), 'config.json')

let cached: AppConfig | null = null

export async function loadConfig(): Promise<AppConfig> {
  if (cached) return cached
  try {
    const raw = await readFile(configPath(), 'utf8')
    cached = appConfigSchema.parse(JSON.parse(raw))
  } catch {
    cached = emptyConfig
  }
  return cached
}

export async function saveConfig(config: AppConfig): Promise<void> {
  cached = config
  await writeFile(configPath(), JSON.stringify(config, null, 2), 'utf8')
}
```

- `src/main/api.ts` — the read-modify-write call sites. `recordRecent`:

```84:86:src/main/api.ts
async function recordRecent(path: string): Promise<void> {
  await saveConfig(withRecentRepo(await loadConfig(), path))
}
```

  and the five mutation procedures (`hidePath`, `unhidePath`, `pinPath`,
  `unpinPath`, `setRepoLayers`), each shaped like:

```173:195:src/main/api.ts
  hidePath: t.procedure
    .input(z.object({ repoPath: z.string(), path: z.string() }))
    .mutation(async ({ input }) => {
      await saveConfig(withHiddenPath(await loadConfig(), input.repoPath, input.path))
    }),

  unhidePath: t.procedure
    .input(z.object({ repoPath: z.string(), path: z.string() }))
    .mutation(async ({ input }) => {
      await saveConfig(withoutHiddenPath(await loadConfig(), input.repoPath, input.path))
    }),

  pinPath: t.procedure
    .input(z.object({ repoPath: z.string(), path: z.string() }))
    .mutation(async ({ input }) => {
      await saveConfig(withPinnedPath(await loadConfig(), input.repoPath, input.path))
    }),

  unpinPath: t.procedure
    .input(z.object({ repoPath: z.string(), path: z.string() }))
    .mutation(async ({ input }) => {
      await saveConfig(withoutPinnedPath(await loadConfig(), input.repoPath, input.path))
    }),
```

  and `setRepoLayers` (around lines 314-332):

```330:332:src/main/api.ts
    .mutation(async ({ input }) => {
      await saveConfig(withRepoLayers(await loadConfig(), input.repoPath, input.layers))
    }),
```

- `src/main/api.ts` imports from `./config-store` (line 8):

```8:8:src/main/api.ts
import { loadConfig, saveConfig } from './config-store'
```

- The `withX` pure helpers (`withRecentRepo`, `withHiddenPath`, `withoutHiddenPath`,
  `withPinnedPath`, `withoutPinnedPath`, `withRepoLayers`) live in
  `src/main/repo-config.ts` and are already unit-tested in
  `src/main/repo-config.test.ts`. **Do not change them.**

- **Conventions to follow** (verified during recon):
  - Pure/logic modules in `src/main/` with sibling Vitest tests; see
    `src/main/repo-config.test.ts` for the `describe`/`it`/`expect` style.
  - Main process owns OS/fs access. `config-store.ts` is the only place that
    knows the config lives on disk under `userData` — keep that boundary.
  - Strict TS: **no `any`, no `as` casts of any kind** (banned repo-wide). Use
    real zod schemas in tests instead of casting fixtures.
  - No explanatory code comments (user rule); a single short `/** */` doc header
    per exported function is fine (match `repo-config.ts`).
  - Promises: never `void` a promise; use `async`/`await`. Bare fire-and-forget
    calls are only acceptable where the existing code already does so.

## Commands you will need

| Purpose   | Command                              | Expected on success |
|-----------|--------------------------------------|---------------------|
| Install   | `pnpm install`                       | exit 0              |
| Typecheck | `pnpm typecheck`                     | exit 0, no errors   |
| Test (one)| `pnpm test src/main/json-store.test.ts` | all pass         |
| Test (all)| `pnpm test`                          | all pass            |
| Lint      | `pnpm lint`                          | exit 0              |
| Build     | `pnpm build`                         | exit 0              |

## Scope

**In scope** (the only files you should modify/create):
- `src/main/json-store.ts` (create — durable, serialized JSON persistence)
- `src/main/json-store.test.ts` (create)
- `src/main/config-store.ts` (rewrite as a thin wrapper over the new module)
- `src/main/api.ts` (migrate the 6 read-modify-write call sites to `updateConfig`)

**Out of scope** (do NOT touch):
- `src/main/repo-config.ts` and its tests — the `withX` helpers and the zod
  `appConfigSchema` are correct; reuse them unchanged.
- Read-only `loadConfig` callers (`readDir`, `recentRepos`, `pinnedEntries`,
  `gitFlow`, `repoLayers`) — they stay on `loadConfig`; only the
  load→mutate→save *pairs* change.
- Any change to the on-disk JSON shape — existing `config.json` files must still
  load.

## Git workflow

- Branch: `advisor/003-durable-race-free-config-store`
- Commit message style: `fix: persist config atomically and serialize updates`
- Do NOT push or open a PR unless the operator instructed it.

## Steps

### Step 1: Create the durable, serialized JSON store

Create `src/main/json-store.ts`. It must be **electron-free** (so it is unit
testable) and accept the file path as a getter (the real path needs `app` to be
ready). Behavior:

- `load()`: return the cache if present; otherwise read+parse the file. A missing
  file returns `empty` (normal first-run). A file that exists but fails to
  parse is renamed to `${path}.corrupt-${Date.now()}` and `empty` is returned.
- `writeJsonAtomic`: write to `${path}.tmp`, then `rename` over the real path.
- `update(mutate)`: serialize updates through a promise chain so each update
  reads the result of the previous one, applies `mutate`, writes atomically, and
  refreshes the cache. This prevents lost updates from concurrent callers.

Target shape:

```ts
import { readFile, rename, writeFile } from 'fs/promises'

async function readJson<T>(path: string, parse: (raw: unknown) => T, empty: T): Promise<T> {
  let raw: string
  try {
    raw = await readFile(path, 'utf8')
  } catch {
    return empty
  }
  try {
    return parse(JSON.parse(raw))
  } catch {
    await rename(path, `${path}.corrupt-${Date.now()}`).catch(() => {})
    return empty
  }
}

async function writeJsonAtomic(path: string, value: unknown): Promise<void> {
  const tmp = `${path}.tmp`
  await writeFile(tmp, JSON.stringify(value, null, 2), 'utf8')
  await rename(tmp, path)
}

export interface JsonStore<T> {
  load: () => Promise<T>
  update: (mutate: (current: T) => T) => Promise<T>
}

export function createJsonStore<T>(opts: {
  path: () => string
  parse: (raw: unknown) => T
  empty: T
}): JsonStore<T> {
  let cached: T | null = null
  let queue: Promise<unknown> = Promise.resolve()

  const load = async (): Promise<T> => {
    if (cached !== null) return cached
    cached = await readJson(opts.path(), opts.parse, opts.empty)
    return cached
  }

  const update = (mutate: (current: T) => T): Promise<T> => {
    const next = queue.then(async () => {
      const updated = mutate(await load())
      await writeJsonAtomic(opts.path(), updated)
      cached = updated
      return updated
    })
    queue = next.catch(() => {})
    return next
  }

  return { load, update }
}
```

**Verify**: `pnpm typecheck` → exit 0.

### Step 2: Test the store with a real temp file

Create `src/main/json-store.test.ts`. This is the repo's first fs-touching test;
keep it self-contained with `os.tmpdir()` and clean up after. Use a real zod
schema for `parse` (no casts). Cover:

- **missing file → empty**: `load()` on a path that doesn't exist returns the
  empty value.
- **roundtrip**: `update` then a fresh store's `load` returns the written value.
- **corruption is recovered, not lost**: write invalid JSON (e.g. `"{ broken"`)
  to the path, then `load()` returns empty AND a sibling `*.corrupt-*` file now
  exists (assert via `fs.readdir` on the temp dir).
- **no lost updates under concurrency**: starting from `{ n: 0 }`, run
  `await Promise.all(Array.from({ length: 10 }, () => store.update((c) => ({ n: c.n + 1 }))))`
  and assert the final value is `{ n: 10 }`.

Sketch:

```ts
import { mkdtemp, readdir, rm, writeFile } from 'fs/promises'
import { tmpdir } from 'os'
import { join } from 'path'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { z } from 'zod'
import { createJsonStore } from './json-store'

const schema = z.object({ n: z.number() })
type Doc = z.infer<typeof schema>
const empty: Doc = { n: 0 }
const parse = (raw: unknown): Doc => schema.parse(raw)

let dir: string
beforeEach(async () => {
  dir = await mkdtemp(join(tmpdir(), 'porcelain-json-'))
})
afterEach(async () => {
  await rm(dir, { recursive: true, force: true })
})
// ... describe/it blocks per case above, each creating
// createJsonStore({ path: () => join(dir, 'doc.json'), parse, empty })
```

**Verify**: `pnpm test src/main/json-store.test.ts` → all pass (4+ cases).

### Step 3: Rewrite `config-store.ts` as a thin wrapper

Replace the body of `src/main/config-store.ts` so it delegates to the store and
exposes `loadConfig` + a new `updateConfig`. Drop the old `saveConfig`.

```ts
import { app } from 'electron'
import { join } from 'path'
import { createJsonStore } from './json-store'
import { type AppConfig, appConfigSchema, emptyConfig } from './repo-config'

const store = createJsonStore<AppConfig>({
  path: () => join(app.getPath('userData'), 'config.json'),
  parse: (raw) => appConfigSchema.parse(raw),
  empty: emptyConfig,
})

export const loadConfig = store.load
export const updateConfig = store.update
```

**Verify**: `pnpm typecheck` → expect errors ONLY in `src/main/api.ts` (it still
imports/uses `saveConfig`). That is expected and fixed in Step 4. If errors
appear in any other file, STOP.

### Step 4: Migrate the read-modify-write call sites in `api.ts`

In `src/main/api.ts`:

1. Change the import on line 8 from `import { loadConfig, saveConfig } from './config-store'`
   to `import { loadConfig, updateConfig } from './config-store'`.
2. Rewrite each load→mutate→save pair to a single `updateConfig` call:

   - `recordRecent`:
     ```ts
     async function recordRecent(path: string): Promise<void> {
       await updateConfig((config) => withRecentRepo(config, path))
     }
     ```
   - `hidePath` → `await updateConfig((config) => withHiddenPath(config, input.repoPath, input.path))`
   - `unhidePath` → `await updateConfig((config) => withoutHiddenPath(config, input.repoPath, input.path))`
   - `pinPath` → `await updateConfig((config) => withPinnedPath(config, input.repoPath, input.path))`
   - `unpinPath` → `await updateConfig((config) => withoutPinnedPath(config, input.repoPath, input.path))`
   - `setRepoLayers` → `await updateConfig((config) => withRepoLayers(config, input.repoPath, input.layers))`

Leave all read-only `loadConfig` callers unchanged.

**Verify**: `pnpm typecheck` → exit 0; `pnpm lint` → exit 0; `pnpm test` → all
pass; `pnpm build` → exit 0. Confirm no remaining references to `saveConfig`:
`grep -rn "saveConfig" src/` → no matches.

## Test plan

- New `src/main/json-store.test.ts` covering: missing-file→empty, roundtrip,
  corrupt-file backup+recovery, and no-lost-updates concurrency (Step 2).
- Structural pattern: `src/main/repo-config.test.ts` for style; this test adds
  `beforeEach`/`afterEach` + a temp dir, which is new for this repo (see
  Maintenance notes).
- Verification: `pnpm test` → all prior 56 tests still pass plus the new cases.

## Done criteria

ALL must hold:

- [ ] `pnpm typecheck` exits 0
- [ ] `pnpm lint` exits 0
- [ ] `pnpm test` exits 0; `src/main/json-store.test.ts` exists and passes
- [ ] `pnpm build` exits 0
- [ ] `grep -rn "saveConfig" src/` returns no matches
- [ ] `config.json` is written via temp-file + rename (no direct `writeFile` to
      the real config path remains in `config-store.ts`)
- [ ] All 6 mutation/`recordRecent` sites use `updateConfig`
- [ ] No files outside the in-scope list are modified (`git status`)
- [ ] `plans/README.md` status row for 003 updated

## STOP conditions

Stop and report back (do not improvise) if:

- `config-store.ts` or the `api.ts` call sites no longer match the "Current
  state" excerpts.
- Typecheck errors after Step 3 appear in files **other than** `api.ts`.
- The fs-based test pattern (temp dirs in Vitest) is judged to conflict with a
  repo testing convention you discover — report it; the production fix in
  `json-store.ts` / `config-store.ts` is still correct without the test, but do
  not invent a different testing approach without flagging it.
- A verification command fails twice after a reasonable fix attempt.

## Maintenance notes

- This introduces the **first fs-touching unit test** in the repo (all existing
  tests are pure). A reviewer should confirm that fits the project's testing
  conventions; if the team prefers pure-only tests, the concurrency/atomicity
  logic in `createJsonStore` can alternatively be exercised with an injected
  in-memory reader/writer — but the current approach is simpler and real.
- `createJsonStore` is generic; if another on-disk store is ever needed, reuse it
  rather than hand-rolling another `writeFile`.
- The corrupt-file backups (`config.json.corrupt-*`) accumulate in `userData` on
  repeated corruption. That's intentional (don't destroy the user's only copy of
  their settings), but a future cleanup pass could prune old ones.
- A reviewer should verify the serialization actually chains (each `update`
  awaits the prior) — this is the part that fixes the lost-update race.
