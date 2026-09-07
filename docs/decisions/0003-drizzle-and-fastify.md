# 0003: Drizzle persistence and Fastify transport

Status: accepted.

Use Drizzle for database schema, queries, transactions, and migration execution. SQLite remains owned
by the environment's server. Environment, project, and worktree rows have separate tables; worktrees
reference their project through a foreign key. Inventory replacement is transactional, including
removal of no-longer-reported worktrees. Presentation order is stored explicitly.

Drizzle ORM and Kit are pinned to the same 1.0 release candidate because its official `node:sqlite`
adapter preserves the built-in Node driver. This is an explicit prerelease dependency; upgrades need
focused compatibility checks on the pinned Node and TypeScript versions. No alternate native SQLite
driver is introduced. pnpm permits esbuild's installation script for Drizzle Kit's schema loader.

TypeScript schemas own table definitions. Drizzle Kit generates checked-in SQL migrations and snapshots;
review generated SQL before applying it. SQL remains appropriate for migration data transformations
and SQLite pragmas. The initial Drizzle migration bridges version-1 JSON records into relational rows,
preserving environment, project, and worktree IDs. Migration failure rolls back the data transformation.
The application rejects unsupported database versions before migration. Do not use schema push for
application upgrades. Migration assets are resolved relative to the module and must accompany any
future packaged server.

Fastify owns HTTP routing, response serialization, and server shutdown hooks. The application factory
initializes inventory before returning a Fastify instance, and closing that instance closes inventory.
The first route is `GET /health`, returning only `{ "status": "ok" }`. Its Zod schema lives in the
explicit `@porcelain/contracts/health` export; the Fastify Zod provider handles validation/serialization.
Database schemas stay server-private and are not transport contracts.

The factory does not listen automatically. Only disposable integration tests bind an ephemeral loopback
port. There is no executable entrypoint, deployment configuration, inventory endpoint, WebSocket,
authentication, or client yet. Those require connection/authentication and protocol decisions before
repository access is exposed. Health success establishes initialized application availability, not
repository reachability or access authorization.

There are now two packages with type-check tasks and no build dependency graph. Recursive pnpm tasks
suffice; Turborepo remains deferred until build ordering or reusable task outputs justify it.
