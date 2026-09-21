# Inventory HTTP boundary

Every inventory operation is authenticated before request parsing or application access. A browser uses the credential of its paired device through an HttpOnly cookie. Agents enter through the local owner socket, whose data-directory permissions are the credential. Health and pairing entry points are the deliberately public exceptions.

Registration accepts a server-side checkout path and is idempotent. Discovery and folder browsing are bounded conveniences rather than a complete machine index; direct path entry remains available. Inventory exposes stable Porcelain identities and last-known unavailable entries, while filesystem identity evidence and Git administrative paths remain server-private.

Responses use shared contracts and fixed public errors. Errors never expose raw diagnostics, diagnostic paths, causes, or stacks, and authenticated responses are not cached. A disconnected read can be cancelled. Disconnecting cannot roll back a write the application already accepted, so mutating operations define their own retry or receipt semantics.
