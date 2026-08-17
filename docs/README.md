# Porcelain docs

Reference only — **what is**. Plans and anything with a TODO live in `plans/` until they ship.
Every file here must be indexed below; `pnpm lint` enforces it.

## Product

| File | What |
|------|------|
| [product.md](product.md) | Product story: audience, pillars, what Porcelain is and is not |
| [marketing.md](marketing.md) | Voice and copy rules for README and marketing surfaces |
| [remote-setup.md](remote-setup.md) | Running the daemon on a remote host: install, exposure, pairing, always-on |

## Surfaces

Behavioural contracts for the pillars. Read the one that owns a surface before changing it.

| File | What |
|------|------|
| [surfaces/navigator.md](surfaces/navigator.md) | The left rail: worktrees as peers, creation destination, create/dispose hooks |
| [surfaces/worktree-profile.md](surfaces/worktree-profile.md) | Pins, hides, and layer order as one object; mechanism not policy |
| [surfaces/canvas.md](surfaces/canvas.md) | The agent's free HTML surface, its templates, its evidence, and its sandbox |
| [surfaces/tasks.md](surfaces/tasks.md) | The cross-project board and why Quick Add outranks every field |
| [surfaces/git.md](surfaces/git.md) | Changeset, diff, commit, history, composer — and why breadth is the failure |

## Internals

Contributor architecture. Start with `architecture.md`; the rest are deep dives.

| File | What |
|------|------|
| [internals/architecture.md](internals/architecture.md) | Package charter: daemon · cli · web · shell · mobile, surfaces, boundaries |
| [internals/domain-architecture.md](internals/domain-architecture.md) | Landed domain architecture, boundaries, state ownership, and testing rules |
| [internals/one-architecture.md](internals/one-architecture.md) | Daemon procedures → hooks → components, WS, tabs, data-flow traps |
| [internals/app-shell.md](internals/app-shell.md) | Multi-window Electron shell, stateless daemon router, window chrome |
| [internals/terminal.md](internals/terminal.md) | Terminal / PTY — the deliberate bend in the one architecture |
| [internals/composition.md](internals/composition.md) | Renderer JSX defaults (shadcn on Base UI) |
| [internals/nomenclature.md](internals/nomenclature.md) | Bare nouns: tab names → entry-point files |
| [internals/repo.md](internals/repo.md) | Repo layout, aliases, packaging facts, shadcn re-apply |
| [internals/agent-foundations.md](internals/agent-foundations.md) | Cross-cutting foundation owners, exact proof paths, and mechanical removal gates |
| [internals/quality-metrics.md](internals/quality-metrics.md) | Coverage, complexity, dead code: what `pnpm quality` measures and why coverage is a floor |

## Architecture decisions

| File | What |
|------|------|
| [adr/0001-one-window-multi-environment-hub.md](adr/0001-one-window-multi-environment-hub.md) | One persistent Hub across local and remote Environments |
| [adr/0002-daemon-root-project-store.md](adr/0002-daemon-root-project-store.md) | Daemon-root project data with explicit Git promotion |
| [adr/0003-worktree-core-object-and-profile.md](adr/0003-worktree-core-object-and-profile.md) | The worktree is the core object and carries a pin/hide/layer profile |
| [adr/0004-canvas-is-the-primitive.md](adr/0004-canvas-is-the-primitive.md) | Canvas is the primitive; the Review is a skill-shipped template |
| [adr/0005-shell-layout.md](adr/0005-shell-layout.md) | Navigator left, viewer centre, panel tabs right, terminal strip below |
| [adr/0006-profiles-are-personal.md](adr/0006-profiles-are-personal.md) | Profiles are personal and die with the worktree; promoted focus retired |
| [adr/0007-agents-compute-evidence.md](adr/0007-agents-compute-evidence.md) | Agents compute the numbers; Porcelain renders them and runs nothing |

## Security and correctness invariants

Earned security/correctness/performance constraints live with their current domain owners and
focused procedures. The mechanically enforceable boundary rules are checked by
`scripts/lint-security-boundaries.mjs`; the owner/proof map is
[`internals/agent-foundations.md`](internals/agent-foundations.md).
