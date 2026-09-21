# Local server startup

The network listener defaults to loopback and widens only through explicit validated configuration. All API routes live under `/api`; a built web root is served only when an absolute path is supplied. Browser-facing requests validate the effective host and reject unsafe cross-origin writes. Forwarded headers are not trusted, so reverse-proxy deployment needs a separate trusted-proxy and public-origin contract.

One process owns a data directory. Owner operations use a Unix socket inside that directory, where owner-only directory permissions are the credential; nothing on the network can reach them. Startup refuses a directory owned by another user or readable beyond its owner.

The owner socket also proves liveness. A socket that answers prevents another start; one that no longer answers may be removed. The otherwise racy probe-and-bind window is protected by a short advisory lock implemented with an exclusive SQLite transaction, which the kernel releases if the process dies. This avoids PID-reuse errors and leaves no manual crash-recovery step.

Startup validates configuration, claims the directory, opens the application, and then listens. SIGINT and SIGTERM close both network and owner listeners and the application before ownership is released. A partial startup unwinds the same resources exactly once.
