---
name: audit
version: 0.49.0
metadata:
  internal: true
description: Earned security, correctness, performance, and packaging invariants. Load before changing main process, IPC, config, git plumbing, file reads, external URLs, packaging, agent channels, or data-fetching wiring — not for ordinary UI or pure feature work.
---

# Audit

Constraints the codebase earned the hard way. Breaking one rarely fails a unit test; it fails in
production. Read the matching reference before you act; check it after.

Root `AGENTS.md` hard rules are assumed.

## How to verify

Commit gate is `pnpm lint` (includes audit). Full bar before push/CI is `pnpm verify`. Three rules
are lint-enforced by `scripts/lint-audit.mjs` (`isSafeExternalUrl`, `GIT_OPTIONAL_LOCKS=0`, hook env
scrub). Everything else needs a read of the diff against the references below.

## Reference

| File | When |
|---|---|
| `reference/network-boundary.md` | Main/renderer split, `readFile`/external URLs, daemon bind/auth/CORS/CSP, PTY env |
| `reference/agent-channels.md` | CLI, `~/.porcelain` channels, review content, loop evidence |
| `reference/git-and-config.md` | `config.json` / `json-store`, anything that spawns `git` |
| `reference/data-ipc.md` | tRPC, WS session, `utilityProcess` daemon lifecycle |
| `reference/performance.md` | Viewer/diff virtualization, file tree, Vite pre-bundle, polling/watchers |
| `reference/packaging.md` | Dep placement, electron-builder/signing, `node-pty`, `trash` |
