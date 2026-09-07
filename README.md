# Porcelain

A review workspace for code produced by agents working in other tools.

This branch is a deliberate rebuild. It currently contains the engineering foundation, not a runnable
application. Product scope includes local/remote worktrees, Files with pins/hides, ordered diff review,
Git/history, shareable HTML artifacts, and MCP comments across Electron, web, and Expo clients.

- [Product scope](docs/product.md)
- [Architecture](docs/architecture.md)
- [Development and checks](docs/development.md)
- [Foundation decision](docs/decisions/0001-foundation.md)

Start with Node from `.node-version` and the pnpm version in `package.json`:

```sh
npx --yes pnpm@12.3.4 install --frozen-lockfile
```

The next product session should design the environment/project/worktree identity and registration
rules with the maintainer before implementing inventory. Authentication, persistence, HTTP framework,
styling, and artifact sharing details are not yet selected.
