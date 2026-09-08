# 0004: Inventory HTTP boundary

Status: accepted.

The server factory requires a configured bearer token. Inventory routes authenticate before parsing
request bodies or accessing application operations. Health remains public. Tokens must contain at least
32 URL-safe characters (letters, digits, dot, underscore, tilde, hyphen); provisioning must generate
cryptographically random tokens. Length validation alone does not establish entropy. Tokens are supplied
by the caller, never returned by the API, and remain outside the inventory database.

There is one trusted principal per server in this slice: possession of the token grants access to
register any checkout the server process can inspect. Tokens do not identify individual users.
Pairing, token provisioning and rotation UX, TLS, CORS for separately hosted browser clients, and
remote listeners remain separate work. The [local executable](0005-local-server-startup.md) binds loopback only. Bearer tokens require a protected transport outside
disposable loopback tests. The factory does not open a listener.

## Operations

| Method and path | Request | Success |
| --- | --- | --- |
| GET /inventory | No body | 200 inventory snapshot |
| POST /projects | JSON object with absolute server-side checkout path in `path` | 200 registered project |
| POST /inventory/refresh | No body | 200 refreshed inventory |

Registration returns 200 for both a new project and an already registered project. Relative paths,
unknown request fields, empty paths, and NUL-containing paths are rejected. Absolute-path interpretation
belongs to the server platform, not the client. A successful registration does not refresh unrelated
projects. GET returns the current snapshot; POST refresh requests fresh Git inspection.

Inventory includes environment identity and projects with IDs, names, availability, and worktrees.
Worktrees expose IDs, paths, main-checkout status, branches, and availability. Internal filesystem
identity evidence and Git metadata directory paths are excluded by explicit HTTP mappers and response
schemas. Unavailable entries retain last-known information. No multi-environment aggregation occurs
on the server.

The schemas in `packages/contracts` own public request/response data. Server models remain private.
The shared client transport will consume these contracts when introduced.

## Failures and evidence

Responses use public codes: 401 UNAUTHORIZED, 400 INVALID_REQUEST, 422 REPOSITORY_UNAVAILABLE,
503 SERVICE_UNAVAILABLE for application shutdown/cancellation/deadline, and 500 INTERNAL_ERROR
for unexpected failures. Raw exception messages, paths from diagnostics, causes, and stacks are not
returned. Inventory route responses disable caching. Internal discovery diagnostics remain server-owned.

Operations retain the application deadline and serialization guarantees. Disconnecting an HTTP client
does not roll back or cancel an accepted operation in this slice; a client uncertain about registration
can retry and receive the existing project identity. Refresh may persist completed projects before a
later failure, as defined by the inventory decision.

HTTP integration specs cover authentication, invalid input, safe failures, duplicate registration,
restart persistence, unavailable repositories, and real loopback registration. They do not establish
production TLS, remote access, or browser/Electron/mobile behavior.
