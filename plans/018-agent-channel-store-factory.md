# Plan 018: Extract a shared factory for the agent-channel stores

> **Executor instructions**: Follow step by step. Run every verification command and
> confirm the expected result. If a "STOP condition" occurs, stop and report. When
> done, update this plan's row in `plans/README.md`.
>
> **Drift check (run first)**:
> `git diff --stat b224765..HEAD -- src/main/comment-store.ts src/main/board-store.ts src/main/actions-store.ts src/main/notes-store.ts`
> If any changed since this plan was written, compare against "Current state"; on a
> mismatch, STOP.

## Status

- **Priority**: P3
- **Effort**: M
- **Risk**: MED
- **Depends on**: none
- **Category**: tech-debt
- **Planned at**: commit `b224765`, 2026-06-20

## Why this matters

The four app-side agent-channel stores — `comment-store`, `board-store`,
`actions-store`, `notes-store` — each hand-roll the **same** plumbing: a
`*Path()` env-override block, `readAll`/`writeAll` (mkdir + tmp + atomic rename),
and a serialized `mutate`/`chain` read-modify-write. That's ~30 duplicated lines × 4.
A `createHomeChannel<T>({ envVar, fileName, schema, empty })` factory collapses the
plumbing into one place, making the next channel trivial and guaranteeing all four
share identical atomicity + serialization semantics (an `audit` invariant: every
channel write is atomic). The per-channel domain functions stay in their own files.

## Current state

`src/main/comment-store.ts` is the canonical shape — every store mirrors this
plumbing:
```ts
export function commentsPath(): string {
  return process.env.PORCELAIN_COMMENTS ?? join(homedir(), '.porcelain', 'comments.json')
}
async function readAll(): Promise<ReviewComments> {
  try { return reviewCommentsSchema.parse(JSON.parse(await readFile(commentsPath(), 'utf8'))) }
  catch { return {} }                                   // absent/unparseable/invalid → empty
}
async function writeAll(all: ReviewComments): Promise<void> {
  const path = commentsPath()
  await mkdir(dirname(path), { recursive: true })
  const tmp = `${path}.tmp`
  await writeFile(tmp, JSON.stringify(all, null, 2))
  await rename(tmp, path)
}
let chain: Promise<void> = Promise.resolve()
function mutate<T>(fn: (all: ReviewComments) => T): Promise<T> {
  const run = chain.then(async () => { const all = await readAll(); const r = fn(all); await writeAll(all); return r })
  chain = run.then(() => undefined, () => undefined)
  return run
}
```
The env vars + filenames per store (confirmed):
- `comment-store` → `PORCELAIN_COMMENTS`, `comments.json`, schema `reviewCommentsSchema`, empty `{}`
- `board-store` → `PORCELAIN_BOARD`, `board.json`
- `actions-store` → `PORCELAIN_ACTIONS`, `actions.json`
- `notes-store` → `PORCELAIN_NOTES`, `notes.json` (value shape is `Record<repoPath, string>`, not an array — the **plumbing** is identical, only the per-repo value type differs)

Each store has a sibling test: `comment-store.test.ts`, `board-store.test.ts`,
`actions-store.test.ts`, `notes-store.test.ts` — these are the safety net; they must
pass unchanged.

> **Read all four store files yourself before starting** — confirm each matches the
> canonical plumbing. `notes-store` also has a one-time `migrateNotesFromConfig`
> (keep it in `notes-store`, outside the factory).

## The factory to add

Create `src/main/home-channel.ts`:
```ts
import { mkdir, readFile, rename, writeFile } from 'node:fs/promises'
import { homedir } from 'node:os'
import { dirname, join } from 'node:path'
import type { ZodType } from 'zod'

export interface HomeChannel<T> {
  path(): string
  readAll(): Promise<T>
  writeAll(all: T): Promise<void>
  mutate<R>(fn: (all: T) => R): Promise<R>
}

/**
 * The shared plumbing for an agent-channel JSON file under ~/.porcelain: an
 * env-overridable path, schema-validated read (empty on absent/invalid), atomic
 * tmp+rename write, and an in-process serialized read-modify-write so two quick
 * mutations never drop a write. Each channel layers its domain functions on top.
 */
export function createHomeChannel<T>(opts: {
  envVar: string
  fileName: string
  schema: ZodType<T>
  empty: () => T
}): HomeChannel<T> {
  const path = (): string => process.env[opts.envVar] ?? join(homedir(), '.porcelain', opts.fileName)
  const readAll = async (): Promise<T> => {
    try { return opts.schema.parse(JSON.parse(await readFile(path(), 'utf8'))) }
    catch { return opts.empty() }
  }
  const writeAll = async (all: T): Promise<void> => {
    const p = path()
    await mkdir(dirname(p), { recursive: true })
    const tmp = `${p}.tmp`
    await writeFile(tmp, JSON.stringify(all, null, 2))
    await rename(tmp, p)
  }
  let chain: Promise<void> = Promise.resolve()
  const mutate = <R>(fn: (all: T) => R): Promise<R> => {
    const run = chain.then(async () => { const all = await readAll(); const r = fn(all); await writeAll(all); return r })
    chain = run.then(() => undefined, () => undefined)
    return run
  }
  return { path, readAll, writeAll, mutate }
}
```
Then each store builds on it, e.g. `comment-store.ts`:
```ts
const channel = createHomeChannel({
  envVar: 'PORCELAIN_COMMENTS', fileName: 'comments.json',
  schema: reviewCommentsSchema, empty: () => ({}),
})
export const commentsPath = channel.path   // keep the exported name if other code/tests import it
// readComments/addComment/... call channel.readAll() / channel.mutate(...)
```
**Preserve every store's exported function names and signatures** (the renderer and
the tests import them) — only the *internal* plumbing moves into the factory.

## Commands you will need

| Purpose   | Command                                         | Expected on success |
|-----------|-------------------------------------------------|---------------------|
| Tests     | `pnpm test -- comment-store board-store actions-store notes-store` | all pass |
| Typecheck | `pnpm typecheck`                                | exit 0 |
| Lint      | `pnpm lint`                                     | exit 0 |
| Full gate | `pnpm verify`                                   | all four pass |

## Scope

**In scope**:
- `src/main/home-channel.ts` (create the factory)
- `src/main/comment-store.ts`, `board-store.ts`, `actions-store.ts`, `notes-store.ts`
  (replace internal plumbing with the factory; keep all exports + domain logic)

**Out of scope** (do NOT touch):
- The **MCP-side** files (`src/mcp/*-file.ts`) — they're a separate process with their
  own copies; **this plan does not unify across the process boundary** (the MCP server
  must stay dependency-free and can't import `src/main`). Leave them as-is.
- `createJsonStore`/`json-store.ts` (the `userData` config store) — that's a different
  store (single object, not the per-repo home-dir channels). Do not merge them.
- Any store's exported function names/signatures, domain logic, schemas, or
  `migrateNotesFromConfig`.
- The atomic-write / serialized-mutate semantics — they must be byte-for-byte
  equivalent (the factory copies them exactly).

## Git workflow

- Commit straight to `main`; do not branch. Consider one commit per store after the
  factory lands, so each migration is independently reviewable.
- Conventional Commits, e.g. `refactor(stores): share createHomeChannel across the agent channels`.
- Do NOT push unless instructed.

## Steps

### Step 1: Create the factory

Add `src/main/home-channel.ts` as above. Typecheck.

### Step 2: Migrate `comment-store` first (it's the canonical one)

Replace its `commentsPath`/`readAll`/`writeAll`/`mutate` with a `createHomeChannel`
instance; rewrite the domain functions (`readComments`/`addComment`/`editComment`/
`deleteComment`/`setCommentResolved`) to call `channel.readAll()`/`channel.mutate()`.
Keep `commentsPath` exported (alias `channel.path`) if anything imports it.

**Verify**: `pnpm test -- comment-store` → passes unchanged.

### Step 3: Migrate `board-store`, `actions-store`, `notes-store`

Apply the same migration to each, one at a time, verifying its test after each:
`pnpm test -- board-store`, `... actions-store`, `... notes-store`. For `notes-store`,
keep `migrateNotesFromConfig` in the store file (it's domain logic, not plumbing) and
have it use `channel.writeAll`/`readAll`.

### Step 4: Full gate

**Verify**: `pnpm test -- comment-store board-store actions-store notes-store` → all
pass. **Verify**: `pnpm verify` → all four pass.

## Test plan

- The four existing store test files are the safety net: they exercise read/write/
  mutate + the domain functions. They must pass **unchanged** — do not edit them
  (if a test needs editing to pass, the refactor changed behavior; STOP).
- Verification: `pnpm test -- comment-store board-store actions-store notes-store` +
  `pnpm verify`.

## Done criteria

ALL must hold:

- [ ] `src/main/home-channel.ts` exports `createHomeChannel`
- [ ] All four stores use it; none retains its own `readAll`/`writeAll`/`mutate`/`chain`
- [ ] Every store's exported function names + signatures are unchanged
- [ ] The four store tests pass **without modification**
- [ ] `pnpm verify` passes
- [ ] The MCP-side `src/mcp/*-file.ts` files are untouched
- [ ] `plans/README.md` status row updated

## STOP conditions

Stop and report if:

- Any store test requires editing to pass — the refactor changed behavior; revert and
  report what differs.
- A store's plumbing turns out to differ meaningfully from the canonical (e.g. a
  different empty value, a non-atomic write, extra serialization) — note the
  difference; the factory must accommodate it via options, not by changing the store's
  semantics.
- `notes-store`'s value shape (`Record<repoPath, string>`) doesn't fit the generic `T`
  cleanly — it should (the factory is generic over the whole-file type `T`); if it
  fights the types, report rather than weakening the types with a cast (`as` is banned).

## Maintenance notes

- The next agent channel added on the app side should use `createHomeChannel` from the
  start — that's the payoff.
- The MCP-side duplication remains by necessity (separate dependency-free process). If
  the channel set grows, consider a *copy* of this factory under `src/mcp/` (not a
  shared import) — but that's a separate decision.
- A reviewer should confirm the atomic tmp+rename and the serialized `mutate` chain
  survived the extraction intact (the `audit` channel-write invariant).
