# 0003: Drizzle persistence and Fastify transport

Status: accepted.

Use Drizzle for database schema, queries, transactions, and migration execution. SQLite remains owned
by the environment's server. Environment, project, and worktree rows have separate tables; worktrees
reference their project through a foreign key. Inventory replacement is transactional, including
removal of no-longer-reported worktrees. Presentation order is stored explicitly.

Use stable Drizzle ORM and Kit releases with the `better-sqlite3` driver. Pin exact versions in
`apps/server/package.json`; prefer stable dependencies unless a prerelease has an explicitly agreed
benefit. pnpm permits Drizzle Kit's esbuild loader and disables the SQLite driver's automatic build;
`better-sqlite3` bundles native prebuilds.
The SQLite driver is a native dependency: installation and future packaging must be validated on
each supported server runtime and platform. The database remains server-owned, not a client dependency.

TypeScript schemas own table definitions. Drizzle Kit generates checked-in SQL migrations and snapshots;
review generated SQL before applying it. The unreleased rebuild uses a generated baseline for the
current schema, without data backfills or legacy storage for earlier development iterations. The
baseline may be regenerated until there is a released upgrade contract. Previous development
databases are unsupported; use fresh disposable state after a baseline change. Startup verifies the complete
applied migration history against the shipped migration prefix before changing the database,
rejecting unknown, newer, or divergent history. Migration history owns schema compatibility;
there is no independent application schema version. Unsupported development data must be retained
for deliberate recovery or replacement, never automatically deleted. Do not use schema push for
application upgrades. Migration assets are resolved relative to the module and must accompany any
future packaged server.

Fastify owns HTTP routing, response serialization, and server shutdown hooks. The application factory
initializes inventory before returning a Fastify instance, and closing that instance closes inventory.
The first route is `GET /health`, returning only `{ "status": "ok" }`. Its Zod schema lives in the
explicit `@porcelain/contracts/health` export; the Fastify Zod provider handles validation/serialization.
Database schemas stay server-private and are not transport contracts.

The factory does not listen automatically. The [local executable](0005-local-server-startup.md)
and disposable integration tests bind loopback ports. Authenticated inventory endpoints and their shared contracts follow the
[HTTP decision](0004-inventory-http.md). There is no deployment configuration, WebSocket, or client yet. Health success establishes initialized application availability, not
repository reachability or access authorization.

pnpm owns workspace dependency management; [the Git package decision](0006-git-package-and-task-cache.md) adds Turborepo task caching.
