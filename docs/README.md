# Porcelain docs

Reference only — **what is**. Plans and anything with a TODO live in `plans/` until they ship.
Every file here must be indexed below; `pnpm lint` enforces it.

## Product

| File | What |
|------|------|
| [product.md](product.md) | Product story: audience, pillars, what Porcelain is and is not |
| [marketing.md](marketing.md) | Voice and copy rules for README and marketing surfaces |
| [remote-setup.md](remote-setup.md) | Running the daemon on a remote host: install, exposure, pairing, always-on |

## Internals

Contributor architecture. Start with `architecture.md`; the rest are deep dives.

| File | What |
|------|------|
| [internals/architecture.md](internals/architecture.md) | Package charter: daemon · cli · web · shell · mobile, surfaces, boundaries |
| [internals/domain-architecture.md](internals/domain-architecture.md) | Active domain-first migration rules, boundaries, ratchets, and testing ownership |
| [internals/one-architecture.md](internals/one-architecture.md) | Daemon procedures → hooks → components, WS, tabs, data-flow traps |
| [internals/app-shell.md](internals/app-shell.md) | Multi-window Electron shell, stateless daemon router, window chrome |
| [internals/terminal.md](internals/terminal.md) | Terminal / PTY — the deliberate bend in the one architecture |
| [internals/composition.md](internals/composition.md) | Renderer JSX defaults (shadcn on Base UI) |
| [internals/nomenclature.md](internals/nomenclature.md) | Bare nouns: tab names → entry-point files |
| [internals/repo.md](internals/repo.md) | Repo layout, aliases, packaging facts, shadcn re-apply |
| [internals/architecture-dispatch.md](internals/architecture-dispatch.md) | Execution-group dispatcher: manifests, fresh Grok/Claude Personal processes, worktree base |
| [internals/agent-foundations.md](internals/agent-foundations.md) | Cross-cutting foundation owners, exact proof paths, and mechanical removal gates |

## Security and correctness invariants

Earned security/correctness/performance constraints live with their current domain owners and
focused procedures. The mechanically enforceable boundary rules are checked by
`scripts/lint-security-boundaries.mjs`; the owner/proof map is
[`internals/agent-foundations.md`](internals/agent-foundations.md).
