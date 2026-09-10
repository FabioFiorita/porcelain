# Web client layers and mock development

The web client separates presentation from its environment connection and data lifecycle.
Views compose shadcn components, keep drafts and selection interactions, and call query hooks.
Query hooks own port calls, cache identity, refresh mutations and safe error messages. Required
inventory uses Suspense; successful connection seeds that inventory before mounting the connected
view. A failed refresh retains the previous snapshot and reports that it may be stale.

Domain code contains pure presentation rules and view-facing types inferred from existing contracts.
API resources expose a cohesive port with live and mock implementations. The live inventory adapter
delegates transport and validation to `packages/client`; these responsibilities remain portable.
React integration stays in the web app until another actual client needs shared query definitions.
Routes own URL validation and route pending/error handling. Bootstrap owns adapter selection and providers.

The workspace provider owns session credentials and cancellation, independently of view lifetimes.
Every completed login or disconnect invalidates older login attempts. Disconnect aborts the connected
session, clears Query state and removes selection through Router. Tokens never appear in query keys. The browser uses a server-issued HttpOnly session cookie and validates it on reload;
disconnect clears the cookie before dropping the local connection. The existing automatic/manual playground login follows the same lifecycle.

Mock mode is explicit through `VITE_API_MODE=mock`; normal builds and the real playground use live
transport. Mock builds dynamically include disposable inventory fixtures and development controls.
Fixtures implement the same port, return independent snapshots, support cancellation and let developers
reproduce empty, unavailable, delayed and failed operations. They reset on reload. They establish client
behavior, not Git, HTTP, authentication or persistence correctness. Real-backend smoke remains required.

View specs mount the real router, query cache, session provider and mock-backed API. They do not replace
query hooks. Assertions cover rendered outcomes and fixture changes. Mock browser smoke runs separately
from live smoke and has no backend process. Production modules remain checked by Knip and dependency
boundaries; generated builds and vendored components retain their existing exclusions.

Import boundaries are enforced by the existing dependency gate. Views cannot import API modules,
wire contracts, the transport package or Query infrastructure. Domain and API code cannot import React
layers; query code cannot import presentation. These import rules complement review and do not prove
the absence of indirect IO or product rules in arbitrary functions.
