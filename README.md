# Porcelain

A review workspace for code produced by agents working in other tools.

This branch is a deliberate rebuild. It contains engineering tooling and a server inventory foundation, not a runnable
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

The server inventory foundation initializes environment identity in SQLite, registers existing Git
repositories, and discovers their main and linked worktrees. See the [inventory decision](docs/decisions/0002-environment-inventory.md).
There is no server process entrypoint, transport, or UI yet. Authentication, HTTP framework, styling,
and artifact sharing details remain undecided.
