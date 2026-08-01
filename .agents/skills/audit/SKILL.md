---
name: audit
metadata:
  internal: true
description: Porcelain's earned invariants — the security, correctness, performance, and packaging rules the codebase must never silently regress. Read before changing the main process, IPC, config, git plumbing, file reads, external URLs, packaging, or data-fetching wiring, and when reviewing a diff.
---

# Porcelain — invariants to preserve

Constraints the codebase **earned**: most were a bug, a crash, or a security gap before the fix
landed. Breaking one rarely fails a test; it fails in production. Read the invariant before touching
its area; verify it after. The `AGENTS.md` hard rules are assumed.

This file is a router. The invariants themselves live in `reference/` — read the file(s) that match
the area you're touching or reviewing before you act, not the whole set every time.

## How to verify

`pnpm verify` is the gate before any commit (hard rule 3). Three rules across the reference files are
lint-enforced by `scripts/lint-audit.mjs` — the `isSafeExternalUrl` gate, `GIT_OPTIONAL_LOCKS=0`, and
the hook env scrub — so they fail `pnpm lint`, not a review. Everything else (dep placement, IPC shape,
read limits, the bind rules, channel write safety, packaging) needs a human or agent read of the diff.
When reviewing, walk the relevant reference files against the changed files.

## Reference

| File | Read it when |
|---|---|
| `reference/network-boundary.md` | Touching the main/renderer process split, `readFile`/external-URL guards, the daemon's listener/bind/auth/CORS/CSP surface, or a spawned PTY's environment. |
| `reference/agent-channels.md` | Touching `apps/desktop/src/cli/`, any `~/.porcelain/*.json` channel (review sets, comments, board, actions, layers, notes, reviewed, feature-view, scope), agent-authored review content (diagrams/HTML/prose rendering), loop evidence, or CLI install/boot wiring. |
| `reference/git-and-config.md` | Touching `config.json` persistence (`json-store`) or anything that spawns `git` (env, locks, staging, quick commands, status flags). |
| `reference/data-ipc.md` | Touching tRPC routers/transports, the WS session, `utilityProcess` daemon lifecycle, or IPC shape generally. |
| `reference/performance.md` | Touching the file viewer/diff virtualization, the file tree, Vite dep pre-bundling, or any polling/watcher/cache tuning on a large repo. |
| `reference/packaging.md` | Changing `dependencies`/`devDependencies` placement, electron-builder config or signing, or anything involving `node-pty` or `trash`. |
