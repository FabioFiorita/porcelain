# Architecture

Porcelain runs a Node server beside repositories and presents their review state in a web client.
The server owns Git access, private SQLite data and authentication. The browser consumes its HTTP
API. Electron and mobile are future clients; their packaging and platform integration are deferred.

Start tracing server behavior at [application composition](../apps/server/src/app.ts), and browser
behavior at [routing](../apps/web/src/routes/router.tsx). Package manifests own public exports and
[dependency checks](../scripts/boundary-rules.ts) own import boundaries.

The server separates use cases from HTTP, persistence and filesystem/Git adapters. Dependencies
are explicit; routes and pure rules remain functions. Git adapters bind to a checkout, while the
server owns Porcelain identity, operation coordination and private review metadata.

Runtime contracts belong in `packages/contracts`; `packages/client` owns portable transport and
validation. Share additional behavior only when another implemented consumer needs it.

In the web app, routes own navigation, views own rendering and drafts, query hooks own server
state and mutation consequences, domain code owns pure presentation rules, and API adapters own
transport. TanStack Query is authoritative for cached server data. See the
[web decision](decisions/web-client-layers.md) for the rationale.

The README describes product purpose; active Notion tasks describe agreed changes still to build.
[Decisions](decisions) preserve reasoning and constraints that are not apparent from code.
Prefer the owning implementation and executable boundaries when tracing current behavior.
