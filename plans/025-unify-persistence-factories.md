# Plan 025: One durable-JSON factory — fold the hand-copied stores onto `createHomeChannel`

> **Executor instructions**: Follow this plan step by step. Run every
> verification command and confirm the expected result before moving to the
> next step. If anything in the "STOP conditions" section occurs, stop and
> report — do not improvise. When done, update the status row for this plan
> in `plans/README.md` — unless a reviewer dispatched you and told you they
> maintain the index.
>
> **Drift check (run first)**: `git diff --stat 113e373..HEAD -- src/backend/home-channel.ts src/backend/json-store.ts src/backend/reviewed-store.ts src/backend/layers-store.ts src/backend/artifact-store.ts src/backend/review-store.ts src/backend/config-store.ts`
> If any in-scope file changed since this plan was written, compare the
> "Current state" excerpts against the live code before proceeding; on a
> mismatch, treat it as a STOP condition.

## Status

- **Priority**: P1
- **Effort**: M
- **Risk**: MED
- **Depends on**: none (plan 026 depends on THIS)
- **Category**: tech-debt (+ a security hardening rider)
- **Planned at**: commit `113e373`, 2026-07-05

## Why this matters

The durability-critical read/parse/atomic-write/serialized-mutate logic for the
`~/.porcelain` agent channels exists in **one factory and four hand-rolled
copies**. A fix or hardening applied to the factory silently misses the copies —
and the copies are already missing two features the factory family has grown
elsewhere: corrupt-file backup (only `json-store.ts` has it) and any size guard
(only `artifact-store.ts` caps reads, and these files are written by an external
process). This plan makes `createHomeChannel` the single engine (with
corrupt-backup, an optional post-parse transform, an optional mtime-keyed cache,
and a size cap), migrates the copies onto it, and retires `json-store.ts`.

Plan 026 (poll-path dedup) then gets its channel-read caching for free from the
mtime cache added here.

## Current state

- [src/backend/home-channel.ts](../src/backend/home-channel.ts) — the factory
  (env-overridable path, zod-validated read → empty on invalid, atomic
  tmp+rename write, serialized `mutate`). Used by **five** stores:
  `board-store.ts`, `actions-store.ts`, `comment-store.ts`, `notes-store.ts`,
  `feature-snapshot-store.ts`. Its full read/write/mutate core (`home-channel.ts:28-59`):

```ts
const readAll = async (): Promise<T> => {
  try {
    return opts.schema.parse(JSON.parse(await readFile(path(), 'utf8')))
  } catch {
    // absent, unparseable, or schema-invalid — treat as empty
    return opts.empty()
  }
}

const writeAll = async (all: T): Promise<void> => {
  const p = path()
  await mkdir(dirname(p), { recursive: true })
  const tmp = `${p}.tmp`
  await writeFile(tmp, JSON.stringify(all, null, 2))
  await rename(tmp, p)
}

// Serialize app-side read-modify-write so two quick mutations never drop a write.
let chain: Promise<void> = Promise.resolve()
const mutate = <R>(fn: (all: T) => R): Promise<R> => { /* chained readAll→fn→writeAll */ }
```

- [src/backend/reviewed-store.ts](../src/backend/reviewed-store.ts) `:31-62` —
  a **verbatim copy** of that trio (same code, same comments), plus domain fns
  (`markReviewed`/`unmarkReviewed`/`clearReviewedPaths`/`migrateReviewedFromConfig`).
- [src/backend/layers-store.ts](../src/backend/layers-store.ts) `:44-82` — the
  same copied trio, plus a post-parse filter the factory can't express today
  (`layers-store.ts:34-42`):

```ts
function compilable(layer: Layer): boolean {
  if (layer.label.trim() === '' || layer.pattern === '') return false
  try { new RegExp(layer.pattern); return true } catch { return false }
}
// readAll(): parses the file, then per-repo `layers.filter(compilable)`
```

  This filter is a **security invariant** (audit skill: an MCP-written invalid
  pattern must be dropped, not thrown, or one bad write breaks every grouping
  view). It must survive the migration exactly.
- [src/backend/artifact-store.ts](../src/backend/artifact-store.ts) and
  [src/backend/review-store.ts](../src/backend/review-store.ts) — read-mostly
  channels (the MCP authors them; the app's only write is the user-initiated
  clear) that re-inline the mkdir+tmp+rename block inside
  `clearArtifact`/`clearReviewSet` instead of using a channel `mutate`.
  `artifact-store.ts` also enforces `MAX_HTML_BYTES` (1.5 MB) per entry on read
  — an audit-skill invariant to preserve verbatim.
- [src/backend/json-store.ts](../src/backend/json-store.ts) — the SECOND
  factory, used only by `config-store.ts`. It has what home-channel lacks
  (`json-store.ts:10-15`, `38-42`):

```ts
try {
  return parse(JSON.parse(raw))
} catch {
  await rename(path, `${path}.corrupt-${Date.now()}`).catch(() => {})   // corrupt backup
  return empty
}
// ...
const load = async (): Promise<T> => {
  if (cached !== null) return cached          // in-memory cache (app is sole writer)
  cached = await readJson(opts.path(), opts.parse, opts.empty)
  return cached
}
```

- Exemplar factory consumer to imitate: [src/backend/board-store.ts](../src/backend/board-store.ts)
  `:32-40` (`createHomeChannel({ envVar, fileName, schema, empty })`, then
  `channel.readAll()` / `channel.mutate(...)` in domain functions).

**The one real trap** (why `home-channel` never cached): the channel files are
written by the external MCP process, so a naive in-memory cache serves stale
data. `config.json` is app-sole-writer, so `json-store`'s cache is safe there.
The unification must make caching **mode-selectable**:
`'none'` (default), `'mtime'` (stat each read; re-parse only when
mtime/size changed — safe with external writers), `'memory'` (config only).

Audit-skill invariants that must hold after this plan (re-read
`.agents/skills/audit/SKILL.md` §"Config persistence" and the channel bullets
before starting):

- All writes stay atomic tmp+rename; app-side read-modify-write stays serialized.
- The app's ONLY writes to review-sets and artifacts remain the two clears.
- `readLayers` still drops uncompilable patterns; `readArtifact` still drops
  oversized html and never throws.
- Corrupt-file handling must never throw on read (empty + backup, exactly like
  `json-store` does today for config).

Tests that exist and must stay green: `home-channel` behavior is asserted
indirectly by `board-store.test.ts`, `actions-store.test.ts`,
`comment-store.test.ts`, `notes-store.test.ts`, `feature-snapshot-store.test.ts`;
the copies have `reviewed-store.test.ts`, `layers-store.test.ts`,
`artifact-store.test.ts`, `review-store.test.ts`; config has
`json-store.test.ts` + `config-store.test.ts` (redirected via env vars like
`PORCELAIN_BOARD`; each store's `*Path()` honors its env var).

## Commands you will need

| Purpose   | Command                              | Expected on success |
|-----------|--------------------------------------|---------------------|
| Install   | `pnpm install`                       | exit 0              |
| Targeted  | `pnpm test -- home-channel`          | all pass            |
| Stores    | `pnpm test -- src/backend`           | all pass            |
| Full gate | `pnpm verify`                        | exit 0              |

## Scope

**In scope**:
- `src/backend/home-channel.ts` (+ create `src/backend/home-channel.test.ts`)
- `src/backend/reviewed-store.ts`, `src/backend/layers-store.ts`,
  `src/backend/artifact-store.ts`, `src/backend/review-store.ts`
- `src/backend/config-store.ts`
- `src/backend/json-store.ts` + `src/backend/json-store.test.ts` (delete both at the end)

**Out of scope**:
- `src/mcp/**` — the MCP side is dependency-free BY DESIGN and duplicates this
  logic deliberately (documented). Never import backend code from `src/mcp`.
- The five stores already on the factory (board/actions/comment/notes/
  feature-snapshot) — they only gain behavior via the factory itself; don't
  edit their files unless the factory signature change requires a one-line call-site tweak.
- Any schema/shape change to the channel files on disk.
- Per-store test rationalization (recorded as a follow-up; do NOT delete
  existing store tests in this plan).

## Git workflow

- Commit straight to `main` (branch creation is hook-blocked; `pnpm verify`
  hook-enforced). Do NOT push. Suggested: one commit per step group, e.g.
  `refactor: grow createHomeChannel (corrupt backup, transform, mtime cache, size cap) + tests`
  then `refactor: fold reviewed/layers/artifact/review stores and config onto the one factory; retire json-store`.

## Steps

### Step 1: Grow the factory

Extend `createHomeChannel<T>`'s options in `home-channel.ts`:

```ts
export function createHomeChannel<T>(opts: {
  envVar: string
  fileName: string
  schema: ZodType<T>
  empty: () => T
  /** Post-parse hook (e.g. layers' compilable-pattern filter). Runs inside readAll. */
  transform?: (parsed: T) => T
  /** 'none' (default) | 'mtime' (stat-guarded, safe w/ external writers) | 'memory' (app-sole-writer only). */
  cache?: 'none' | 'mtime' | 'memory'
  /** Skip (treat as empty, stderr-warn once) files larger than this. */
  maxBytes?: number
}): HomeChannel<T>
```

Behavior to implement, matching the existing style of the file:

- **Corrupt backup**: on a read that parses/validates as garbage (JSON.parse or
  schema throws), rename the file to `${path}.corrupt-${Date.now()}`
  best-effort (`.catch(() => {})`) and return `empty()` — port the exact
  semantics from `json-store.ts:10-15`. A *missing* file is NOT corrupt (no
  rename; just empty).
- **maxBytes**: `stat` before reading; if `size > maxBytes`, `console.error` a
  one-line warning and return `empty()`. `mutate` on an oversized file
  therefore rewrites it from empty — acceptable (matches artifact-store's
  drop-on-invalid posture); note it in the code comment.
- **cache 'mtime'**: keep `{ mtimeMs, size, value }`; on read, `stat` and reuse
  `value` when both match; invalidate inside `writeAll` (own writes update the
  stamp). `mutate` must re-read through the same path (a stat is cheap).
- **cache 'memory'**: `json-store`'s semantics — read once, then always serve
  memory; writes update it.
- Cache + transform compose: transform runs before the value is cached.

**Verify**: `pnpm typecheck` → exit 0 (existing five callers compile unchanged —
all new options are optional).

### Step 2: Factory tests

Create `src/backend/home-channel.test.ts` (model the env-redirect + tmpdir
harness on `src/backend/board-store.test.ts`). Cases:

1. absent file → empty; 2. round-trip write/read; 3. corrupt file → empty AND a
`.corrupt-*` sibling appears; 4. schema-invalid → empty + backup; 5. two
concurrent `mutate`s both land (serialization); 6. `transform` filters on read;
7. `maxBytes` exceeded → empty + no throw; 8. `'mtime'` cache: second read with
no change does not re-parse (spy on `schema.parse` or count via a wrapped
transform), an external overwrite (write the file directly) IS picked up;
9. `'memory'` cache serves the first read forever until `writeAll`.

**Verify**: `pnpm test -- home-channel` → 9+ tests pass.

### Step 3: Migrate the two verbatim copies

- `reviewed-store.ts`: delete its inline `readAll`/`writeAll`/`mutate`
  (`:31-62`), construct `createHomeChannel({ envVar: 'PORCELAIN_REVIEWED',
  fileName: 'reviewed.json', schema: reviewedSchema, empty: () => ({}) })`, and
  route the domain functions through `channel.readAll`/`channel.mutate`. Keep
  `reviewedPath = channel.path` exported (the MCP twin + tests rely on the env var).
- `layers-store.ts`: same, passing the compilable filter as `transform` — the
  per-repo filtering (`layers.filter(compilable)`, dropping now-empty repos)
  moves into the transform whole. Keep `compilable` and the schema exported as
  they are today if anything imports them (check with grep).

**Verify**: `pnpm test -- reviewed-store layers-store` → all existing tests
pass unchanged (they redirect via env vars, so behavior parity is what's tested).

### Step 4: Route the two clear-writes through the factory

In `artifact-store.ts` and `review-store.ts`, replace the inlined
mkdir+tmp+rename block inside `clearArtifact`/`clearReviewSet` with a channel
`mutate` that deletes the repo's entry. Preserve exactly: the read-side
validation posture (artifact's `MAX_HTML_BYTES` drop — now expressible as
`transform` + `maxBytes` if it maps cleanly, otherwise leave its read custom and
use the channel only for the write), and the invariant that these are the app's
ONLY writes to those files.

**Verify**: `pnpm test -- artifact-store review-store` → pass;
`grep -n "writeFile" src/backend/artifact-store.ts src/backend/review-store.ts`
→ no direct writeFile remains.

### Step 5: Migrate config and retire json-store

- `config-store.ts`: swap `createJsonStore` for `createHomeChannel` with
  `cache: 'memory'`. Config's path comes from `initConfigDir`, not
  `~/.porcelain` — if the factory's `envVar`/`fileName` shape can't express the
  config path cleanly, generalize the option to `path: () => string`
  (keeping `envVar`/`fileName` as the convenience form) rather than forcing it.
  Preserve `loadConfig`/`updateConfig` signatures — callers must not change.
- Delete `src/backend/json-store.ts` and `src/backend/json-store.test.ts`
  (its cases are now covered by `home-channel.test.ts`; port any case that isn't
  before deleting).

**Verify**: `grep -rn "json-store" src/` → no matches; `pnpm test -- config-store` → pass.

### Step 6: Full gate + invariant walk

Run the audit-skill checks touched by this plan: layers invalid-pattern drop
(`layers-store.test.ts` still green), artifact oversized-html drop
(`artifact-store.test.ts` still green), and
`grep -rn "createServer\|listen(" src/mcp` → still nothing.

**Verify**: `pnpm verify` → exit 0.

## Test plan

Step 2's nine factory cases (new), plus the four migrated stores' existing
suites passing unchanged. Pattern: `board-store.test.ts` harness.

## Done criteria

- [ ] `pnpm verify` exits 0
- [ ] `src/backend/json-store.ts` no longer exists; `grep -rn "json-store" src/` → 0 hits
- [ ] `grep -c "async function readAll" src/backend/*.ts` → only `home-channel.ts`
      (and `artifact-store.ts`/`review-store.ts` only if Step 4 kept their custom read)
- [ ] `pnpm test -- home-channel` shows the corrupt-backup and mtime-cache cases passing
- [ ] All pre-existing store tests pass without edits to their assertions
- [ ] `plans/README.md` status row updated

## STOP conditions

- Any existing store test needs its **assertions** changed to pass — that means
  behavior drifted, not just plumbing; report the diff.
- `config-store.ts`'s path shape genuinely doesn't fit even with a `path`
  option — report rather than forking a third factory.
- You find another module with its own inline tmp+rename JSON write outside the
  listed files (grep `rename(tmp` across `src/backend`) — report it; don't
  expand scope silently.

## Maintenance notes

- Future channels MUST be built on `createHomeChannel` — a reviewer seeing a new
  `readAll` in a store file should reject it. Consider (follow-up, not now) a
  Biome `noRestrictedImports`-style guard or a grep in the audit skill's verify
  lines.
- The per-store durability tests are now redundant with the factory tests —
  a follow-up may slim them to domain-behavior only (recorded in the index as
  deferred; do it only after this plan has soaked).
- Plan 026 consumes the `'mtime'` cache for the poll path — if you change the
  cache semantics, re-check 026's assumptions.
