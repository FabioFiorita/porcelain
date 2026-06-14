---
name: audit
description: Porcelain's hard-won invariants — the security, correctness, performance, and type-safety rules the codebase must never silently regress. Read before changing the main process, IPC, config persistence, git plumbing, file reads, external-URL handling, packaging, or data-fetching wiring; and when reviewing a change for regressions. Each invariant says what to preserve, why it exists, and how to verify you didn't break it. The chronology behind each lives in the `history` skill.
---

# Porcelain — invariants to preserve

A "don't regress these" checklist. These are constraints the codebase **earned**
— most were a bug, a crash, or a security gap before the fix landed. Breaking one
rarely fails a test; it fails in production. Before touching the listed area, read
the invariant; after, verify it still holds. The 7 hard rules in `CLAUDE.md` are
assumed — this skill is the codebase-specific layer beneath them.

## Security & process boundary

- **External URLs go through `isSafeExternalUrl`** (`src/main/external-url.ts`,
  http/https/mailto allowlist). Every `shell.openExternal` / `setWindowOpenHandler`
  path is gated. Extend `ALLOWED_PROTOCOLS` deliberately; never drop the guard.
  *Why:* an unfiltered `openExternal` runs `file://`/custom-scheme URLs from
  rendered content. *Verify:* new external-link code calls the guard.
- **`readFile` stats before it reads** and returns `{type:'too-large'}` above
  `MAX_READ_BYTES` (10 MB, `src/main/read-limits.ts`). Never read the bytes of an
  oversized file. *Why:* a multi-GB file in a 50 GB monorepo OOMs the main process.
- **Main process = the only OS/git/fs surface.** Renderer is pure UI, no Node APIs.
  `@main/*` imports in the renderer are **type-only** (`import type`) — never
  runtime-import main code. *Why:* runtime coupling leaks Node into the bundle.
- **Never write into the user's work repos.** Per-repo state lives in the app config
  under `userData` (`~/Library/Application Support/porcelain`), keyed by repo path.
- **Dev never opens or mutates real repos.** `pnpm dev` sets `userData` to
  `porcelain-dev` before any config read and seeds recents with
  `~/Code/porcelain-playground` (`src/main/dev-config.ts`). Verification/testing
  happens in the playground, never against the user's work repos.

## Config persistence

- **All config writes go through `createJsonStore`** (`src/main/json-store.ts`):
  atomic tmp+rename writes, corrupt files backed up to `.corrupt-*`, and
  `updateConfig(mutate)` serializes read-modify-write. Never reintroduce a bare
  load→mutate→save pair. *Why:* concurrent mutations dropped writes; a crash
  mid-write corrupted `config.json`. Read-only callers may use `loadConfig`.
- **Hidden-path filtering happens in the MAIN process** (`visibleFilePaths` in
  `repo-config.ts`, tested), not the renderer — the renderer must never receive
  paths the user hid.

## Git plumbing

- **Every git invocation sets `GIT_OPTIONAL_LOCKS=0`** (`runGit` in `src/main/git.ts`).
  *Why:* the 3s `gitStatus`/`gitFlow` background polls otherwise rewrite `.git/index`
  under a lock, racing the user's own `pull`/`commit` and failing it with
  `fatal: Unable to write index.`. The flag disables only optional refreshes;
  required locks for real mutations are untouched. Don't remove it.
- **Commit never auto-stages.** `gitCommit` = `git commit -m` on **staged** changes
  only; staging is explicit (`gitStageAll` / `gitStageFile` / `gitUnstageFile`).
  Porcelain is a review tool — silently `git add -A` on commit is surprising.
- **Quick commands run a whitelist** (`QUICK_COMMANDS` in `git.ts`), never arbitrary
  shell. New quick actions are added to the whitelist, not passed through.

## Data fetching & IPC

- **IPC is tRPC via electron-trpc, pinned to tRPC v10** (`@trpc/*@^10`). electron-trpc
  0.7 reads v10 internals (`_def.query`); **v11 silently breaks every call** with
  NOT_FOUND. Don't upgrade until electron-trpc supports v11. Never raw
  `ipcMain`/`ipcRenderer`; never cast (`as unknown as` is banned repo-wide).
- **Components never import `@renderer/lib/trpc`** (Biome `noRestrictedImports`
  override on `components/**`). All server access goes through domain hooks
  (`hooks/use-<domain>.ts`) that own their post-mutation invalidation. The vanilla
  client is sanctioned only in `stores/repo.ts` and `use-app-events.ts`.
- **Never `void` a promise** to silence a floating-promise lint — use `async`/`await`
  or `await Promise.all([...])` for invalidation/prefetch/clipboard.

## Performance (must stay fast on a 50 GB monorepo)

- **Never render all lines of a file.** File viewer and diffs render through
  `VirtualRows` (`@tanstack/react-virtual`); Shiki tokenizes only mounted rows.
- **Never index what isn't visible.** File tree = lazy per-directory `readDir` on
  expand; nothing indexed up front. `git ls-files` is cached/stale-while-revalidate.
- **`optimizeDeps.entries` must cover `src/**/*.{ts,tsx}`** so every `@base-ui/react/*`
  entry is pre-bundled. *Why:* a dep discovered lazily mid-session re-optimizes,
  loads a second React copy, and crashes with "Invalid hook call".
- **Git queries are live, fs queries are cached.** `gitFlow` (staleTime 0 + 3s poll)
  and `gitDiffFile` (staleTime 0) must reflect the working tree; fs-backed queries
  keep the 30s default. The 3s poll is cheap only because main memoizes flow on a
  status+numstat+layers key (`flowCache`) — don't break that key.

## Packaging

- **Main/preload deps stay in `dependencies`; renderer-only libs in `devDependencies`.**
  electron-vite externalizes main/preload imports and electron-builder copies them
  *whole* into `app.asar`; Vite bundles renderer libs regardless of section.
  Misplacing a dep either bloats the bundle (~100 MB regression) or breaks the
  packaged app at runtime. *Verify:* a dep imported by `src/main`/`src/preload`
  must be in `dependencies`.
- **Never map an empty `CSC_LINK` into the release env.** A defined-but-empty value
  makes electron-builder attempt signing and die with `<projectDir> not a file` —
  set it real or omit it entirely. (See the `releasing` skill.)

## How to verify

- The gate before any commit: `pnpm lint && pnpm typecheck && pnpm test && pnpm build`
  must all pass (hard rule 3).
- Invariants above that the gate does **not** catch (security guards, git env flags,
  dep placement, the v10 pin) need a human/agent read of the diff — that's what this
  skill is for. When reviewing, walk this list against the changed files.
