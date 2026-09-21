# Drizzle persistence and Fastify transport

Drizzle owns the server's SQLite schema, queries, transactions, and migration execution. Database schemas stay private to the server; runtime HTTP contracts live in `packages/contracts`. Fastify owns routing, validation, serialization, and listener shutdown, while application operations remain usable without HTTP.

Generated SQL migrations and snapshots are checked in and reviewed before use. Startup verifies that the applied migration history is a known prefix before changing the database, rejecting unknown, newer, or divergent histories. Existing application data is migrated in place; it is never silently deleted or replaced because a schema changed. Do not use schema push against application state.

The SQLite driver is a native dependency, so packaging must be validated on every supported server runtime and platform. Migration assets are resolved relative to the server module and must accompany a packaged server.
