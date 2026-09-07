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
review generated SQL before applying it. SQL remains appropriate for migration data transformations
and SQLite pragmas. The initial Drizzle migration bridges version-1 JSON records into relational rows,
preserving environment, project, and worktree IDs. The stable migration journal retains the original
applied timestamp and SQL so RC-created databases do not replay that migration. A follow-up
transaction rebuilds the tables to align physical constraints and index names with the stable snapshot,
preserving all rows. Migration failure rolls back the data transformation.
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
