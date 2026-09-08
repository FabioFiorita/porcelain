# Porcelain

A review workspace for code produced by agents working in other tools.

This branch is a deliberate rebuild. It contains engineering tooling and a runnable review server; client applications are not implemented. Product scope includes local/remote worktrees, Files with pins/hides, ordered diff review,
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
Drizzle owns persistence and migrations. The Fastify factory provides public health and authenticated
inventory operations with shared contracts. See the [HTTP decision](docs/decisions/0004-inventory-http.md)
for bearer authentication and endpoint behavior, and the
[persistence decision](docs/decisions/0003-drizzle-and-fastify.md) for storage.
The server executable and loopback workflow checks are described in [development](docs/development.md).
Git adapters live in `packages/git`; the server owns orchestration and persistence.
Client styling and artifact sharing remain undecided.
