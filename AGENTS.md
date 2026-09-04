# Porcelain

Porcelain helps a human review agent work. The daemon owns repositories, Git, terminals,
review data, and remote access; browser, Electron, and mobile are clients. Agents use their
harness's native tools for coding, browsing, computer use, and devices.

[Product intent](docs/product.md) explains the audience, purpose, and desired experience. Use it
for product decisions; inspect code to determine which capabilities exist today.

## Product boundaries

- Changes owns diffs, status, staging, History, and reviewed state. Canvases explain the larger
  why and how; comments carry focused context.
- Preserve the human's Files pins, hidden paths, and reviewed marks unless asked to change them.
- Each daemon owns its Environment. Selecting a remote Environment must not rebind the local daemon.
- Cross-process data belongs in `packages/contracts`; reusable client transport and query semantics
  belong in `packages/client-runtime`. The daemon owns capabilities; clients present them.
- The shipped plugin adapts only Porcelain collaboration and remote-host operations.

## Development

Use [docs/architecture.md](docs/architecture.md) to locate owning code and
[docs/glossary.md](docs/glossary.md) for domain terms. Read contracts, implementation, and nearby
tests to understand behavior. Read [docs/development.md](docs/development.md) for setup and runtime work,
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
change, failure, or unresolved concern justifies it. Each test should catch a meaningful behavioral,
compatibility, accessibility, safety, or invariant regression. Do not lock in incidental aesthetics
or implementation choices: a harmless alternative should pass. Mutation scores alone do not prove
a test is useful. Keep comments about current constraints, not the discussion that produced them.

Canvas use and timing follow the user's needs. Reveal is an opt-in flow connecting a completed-work
explanation, ordered Changes, focused comments, and evidence; do not require a planning Canvas.
Use the shipped companion skill for available operations. When writing a Review Canvas, keep its
id and bind it to the exact clean commit for History.
Agents may define and edit Actions; only the human chooses to run them.

Preserve unrelated state, remove task-owned fixtures and processes, and commit coherent work when
ready. Report what changed, checks and observed results, and remaining uncertainty. Do not push,
open a pull request, publish, or release without explicit authorization.

Keep docs thin: domain language, source navigation, operational guidance, and consequential decisions.
Code, schemas, scripts, and tests establish implementation behavior. Improve unclear code instead of
mirroring it in prose. Preserve real alternatives and tradeoffs in focused decision records; remove
session diaries and obsolete implementation descriptions. See
[the documentation decision](docs/decisions/documentation.md).
