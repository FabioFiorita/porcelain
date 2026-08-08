---
name: audit
version: 0.52.1
metadata:
  internal: true
description: Earned security, correctness, performance, and packaging invariants. Load before changing main process, IPC, config, git plumbing, file reads, external URLs, packaging, agent channels, or data-fetching wiring — not for ordinary UI or pure feature work.
---

# Audit

Constraints the codebase earned the hard way. Breaking one rarely fails a unit test; it fails in
production. This skill is a router: read the matching invariants doc before you act; check it after.

Root `AGENTS.md` hard rules are assumed.

## How to verify

Commit gate is `pnpm lint` (includes audit). Full bar before push/CI is `pnpm verify`. Three rules
are lint-enforced by `scripts/lint-audit.mjs` (`isSafeExternalUrl`, `GIT_OPTIONAL_LOCKS=0`, hook env
scrub). Everything else needs a read of the diff against the invariants below.

## Invariants (docs/internals/audit/)

| File | When |
|---|---|
| `docs/internals/audit/network-boundary.md` | Main/renderer split, `readFile`/external URLs, daemon bind/auth/CORS/CSP, PTY env |
| `docs/internals/audit/agent-channels.md` | CLI, `~/.porcelain` channels, review content, loop evidence |
| `docs/internals/audit/git-and-config.md` | `config.json` / `json-store`, anything that spawns `git` |
| `docs/internals/audit/data-ipc.md` | tRPC, WS session, `utilityProcess` daemon lifecycle |
| `docs/internals/audit/performance.md` | Viewer/diff virtualization, file tree, Vite pre-bundle, polling/watchers |
| `docs/internals/audit/packaging.md` | Dep placement, electron-builder/signing, `node-pty`, `trash` |
