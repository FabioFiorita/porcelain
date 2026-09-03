# Porcelain

Porcelain is the review layer beside agentic coding tools. A daemon owns repositories, Worktrees,
Git state, terminals, review data, and remote access; browser, Electron, and mobile are clients.
Agents keep running in their native harnesses. Porcelain helps a human understand what changed,
why it changed, where attention belongs, and what was actually proved.

## Product boundaries

- Changes is authoritative for diffs, status, staging, History, and reviewed state. A Review Canvas
  explains the larger Why and How; comments hold focused context.
- Files pins and hidden paths are the human's navigation choices. Preserve them unless asked to
  change them.
- Each daemon is authoritative for its own Environment. A client may show several Environments,
  but selecting a remote one must not rebind or impersonate the local daemon.
- Cross-process data belongs in `packages/contracts`. Reusable client transport and query semantics
  belong in `packages/client-runtime`; the daemon owns capabilities; clients present them.
- The shipped plugin is self-contained and only adapts Porcelain-owned collaboration and remote-host
  operations. Use the harness's native browser, terminal, device, and execution tools.

## Safety

Never use production `~/.porcelain`, its listener, real repositories, credentials, or processes as
development fixtures. Run `pnpm dev:env` before starting Porcelain. Development must resolve to the
primary development profile or an isolated managed Worktree with `PORCELAIN_DEV` and a disposable
playground. A linked checkout that unexpectedly resolves to the primary profile must be adopted or
bootstrapped before launch; do not repair isolation by pointing it at production state.

This machine may run production and several development profiles at once. Stop only a PID or
managed service that this task started or whose ownership was verified. Never kill by process-name
pattern. Do not run `pnpm dev` and `pnpm dev:daemon` against the same profile simultaneously.

## Development and proof

Read [docs/development.md](docs/development.md) before setup, runtime work, or parallel Worktrees.
Read [docs/architecture.md](docs/architecture.md) for a cross-runtime change and
[docs/remote-access.md](docs/remote-access.md) for exposure or pairing. Release work follows
[docs/release.md](docs/release.md).

Use the smallest proof that demonstrates the affected behavior: focused tests for logic, daemon
procedures for server behavior, a real browser or Electron path for client behavior, and native
runtime evidence for mobile behavior. A build or mock is not runtime proof. Format changed files,
run the closest useful checks while iterating, and use `pnpm verify` before delivery when the scope
warrants it. Report the command, observed result, affected surfaces checked, and remaining
uncertainty. Remove task-owned fixtures, evidence, and processes.

When the same work appears on more than one surface, check each affected owner: Files, Changes,
Git/History, Canvas/comments, browser/Electron, mobile, remote Environments, contracts, and agent
integration. Do not generalize evidence from one surface to another.

## Delivery

Work directly on `main` for one direct change or use `pnpm worktree create <slug>` for isolated
work. Keep changes coherent, preserve unrelated state, and commit when ready. Do not push, open a
pull request, publish, or release without explicit authorization.

Use Porcelain's companion tools when this checkout and task call for them. Create a Decision Canvas
only for a material unresolved choice. Use one Review Canvas for a coherent completed unit that
benefits from a shared explanation, then update that same Canvas after the clean commit until it is
bound to the exact commit for History. Changes remains the authority for the diff. Agents may
define Actions, but only the human chooses whether to run them.

Prefer the smallest current model over preserved alternatives. Documentation should carry product
intent, ownership, non-obvious invariants, public operations, and navigation; code, contracts,
scripts, configuration, and tests remain authoritative for implementation details. Remove obsolete
paths and historical arguments instead of teaching new sessions how the system used to work.

Tests should protect user-visible behavior, compatibility, safety, accessibility, and non-obvious
invariants. Do not freeze incidental implementation details or aesthetic choices merely because
they were discussed or happen to be true today; a harmless alternative should not make a test fail.
Keep only the rationale needed to understand the current constraint. Do not preserve the journey,
superseded decisions, or speculative alternatives in tests, comments, docs, skills, or agent
instructions after the code has settled on one current model.
