# Porcelain

Porcelain helps a human review agent work. The daemon owns repositories, Git, terminals,
review data, and remote access; browser, Electron, and mobile are clients. Agents use their
harness's native tools for coding, browsing, computer use, and devices.

This repository is developed with OpenAI Codex. Other agents' plugin manifests and compatibility
code support Porcelain users; they do not require development setup for those agents in this repo.

## Product boundaries

- Changes owns diffs, status, staging, History, and reviewed state. Canvases explain the larger
  why and how; comments carry focused context.
- Preserve the human's Files pins, hidden paths, and reviewed marks unless asked to change them.
- Each daemon owns its Environment. Selecting a remote Environment must not rebind the local daemon.
- Cross-process data belongs in `packages/contracts`; reusable client transport and query semantics
  belong in `packages/client-runtime`. The daemon owns capabilities; clients present them.
- The shipped plugin adapts only Porcelain collaboration and remote-host operations.

## Development

Read [docs/development.md](docs/development.md) for setup and runtime work,
[docs/architecture.md](docs/architecture.md) for cross-runtime changes,
[docs/remote-access.md](docs/remote-access.md) for exposure or pairing, and
[docs/release.md](docs/release.md) for releases.

Run `pnpm dev:env` before launching. Use a development profile with `PORCELAIN_DEV` and a disposable
playground; never use production `~/.porcelain`, its listener, repositories, or credentials as
fixtures. Adopt or bootstrap an unmanaged linked checkout before launching it. Stop only processes
this task started or whose ownership is verified. Do not run `pnpm dev` and `pnpm dev:daemon` on the
same profile together.

Choose the available browser, computer, or native device tools that fit the affected surface.
Routine local development and verification within the task do not need another permission request.
Work directly on `main` for one direct change, or use `pnpm worktree create <slug>` for isolation.

## Proof and delivery

Use the smallest checks that demonstrate the change. Client behavior needs evidence from the
relevant browser, Electron, or native mobile runtime; a build or mock alone does not prove it.
Check each affected owner when behavior crosses surfaces, and name any surface left unverified.
Format changed files. Use `pnpm verify` for broad changes; expand passing checks only when a new
change, failure, or unresolved concern justifies it. Tests should protect behavior and invariants,
not incidental implementation details or aesthetic choices.

Use companion tools when shared review context helps. A Decision Canvas is for a material unresolved
choice; a Review Canvas explains a coherent completed unit. Keep the same Review Canvas and bind it
to the exact clean commit for History. Agents may define Actions; only the human chooses to run them.

Preserve unrelated state, remove task-owned fixtures and processes, and commit coherent work when
ready. Report what changed, checks and observed results, and remaining uncertainty. Do not push,
open a pull request, publish, or release without explicit authorization.

Keep documentation focused on current intent, ownership, invariants, and public operations.
Code, schemas, scripts, and tests own implementation details; remove obsolete alternatives and
historical rationale once the current design is clear.
