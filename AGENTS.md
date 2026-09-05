# Porcelain

Porcelain is a companion for developers working with coding agents. See
[product intent](docs/product.md) for its purpose and [domain language](docs/glossary.md) for
terminology. Read the owning code and tests to understand current behavior.

## Code map

- `packages/contracts`: shared request, response, and data definitions.
- `packages/client-runtime`: client transport and behavior shared across clients.
- `apps/daemon`: backend capabilities used by the clients.

- `plugins/porcelain`: the shipped MCP connector and skills for using Porcelain.

## Development

See [docs/development.md](docs/development.md) for setup and commands. Consult
[remote-access](docs/remote-access.md) and [release](docs/release.md) guidance when working on
those operations.

Use isolated development data. Never use the installed application's data or credentials as test
fixtures. Stop only processes owned by the task.

Use interactive browser, computer, or device inspection when requested. Automated tests remain
part of normal verification.
Use the task's assigned checkout. Use an isolated worktree for concurrent work.

## Proof and delivery

Format changed files and run the automated checks appropriate to the change. Tests should protect
meaningful behavior, not mirror implementation details. Once checks pass, repeat or broaden them
only when new changes, failures, or a concrete unresolved concern justify it.

Preserve unrelated work. Clean up temporary resources when the task is finished. Report what
changed, what was checked, and any remaining uncertainty. Commit, push, open pull requests,
publish, or release when requested.

Keep documentation focused on product intent, terminology, setup, and consequential decisions.
Explain implementation through clear code and meaningful tests. Keep temporary plans and session
notes out of committed documentation.
