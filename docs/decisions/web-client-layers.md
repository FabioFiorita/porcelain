# Web client layers

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

Development runs against the real disposable server. API mocks remain controlled test fixtures for
empty, delayed, cancelled and failed operations. View specs mount the real router, query cache and
session provider, asserting rendered outcomes and fixture changes. These specs complement real
Git/HTTP/browser tests; they do not establish persistence or authentication correctness.

Import boundaries are enforced by the existing dependency gate. Views cannot import API modules,
wire contracts, the transport package or Query infrastructure. Domain and API code cannot import React
layers; query code cannot import presentation. These import rules complement review and do not prove
the absence of indirect IO or product rules in arbitrary functions.
