# Contributing

Porcelain has web, Electron, daemon, and mobile surfaces. Issues and focused pull requests are
welcome. The project is changing quickly; explain the behavior you
are changing and the proof you ran rather than preserving an old pattern for its own sake.

## Start here

1. Read [AGENTS.md](AGENTS.md) for the short operating map.
2. Read [docs/development.md](docs/development.md) for setup, validation, and parallel worktrees.
3. Read the focused operational document only when its branch applies:
   [remote access](docs/remote-access.md), [release](docs/release.md), or
   [architecture](docs/architecture.md) for cross-package changes.

## Setup

```sh
pnpm install
pnpm dev:daemon
```

`pnpm dev:daemon` uses the development home and playground boundary. It does not grant access to
production Porcelain state. Use `pnpm dev` for the Electron client and the mobile commands in
`apps/mobile/package.json` for native work.

## Changes

Keep a change coherent and small enough to review. Run the closest useful formatter, typecheck,
test, build, or runtime proof for the behavior you touched. Browser, Electron, and mobile proof
are chosen by the affected surface; no single command is required for every change. Describe
what you ran and any uncertainty in the pull request.

Use a managed worktree when work must proceed in parallel:

```sh
pnpm worktree create <slug>
pnpm worktree list
```

Worktrees are isolated branches with their own development port, home, channels, and playground.
See [docs/development.md](docs/development.md) for the handoff and cleanup flow.

## Pull requests

- Explain the user-visible outcome and why the change belongs here.
- Keep unrelated cleanup separate from product behavior.
- Include focused validation and runtime evidence when relevant.
- Resolve conflicts against current `main`; historical docs are not architectural authority.

## License

By contributing, you agree your work is licensed under the [MIT License](LICENSE).
