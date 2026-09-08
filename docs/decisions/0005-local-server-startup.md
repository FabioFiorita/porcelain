# 0005: Local server startup

Status: accepted.

The server executable binds only to `127.0.0.1`. `PORCELAIN_DATA_DIRECTORY` must be an
absolute path, `PORCELAIN_PORT` an explicit integer from 0 to 65535 (0 requests an available
port), and `PORCELAIN_TOKEN` a caller-provided token satisfying the existing HTTP contract.
There is no default data directory. Token generation, pairing, remote listeners, and service
installation remain separate work. Tokens must be generated cryptographically and never logged.

Startup validates configuration, claims the data directory, initializes inventory, and then
listens. A JSON line containing `address` on stdout indicates readiness. Failure exits nonzero
with a bounded diagnostic on stderr that does not echo configuration or raw errors.
SIGINT and SIGTERM cancel startup or close the listener and application before releasing ownership.
HTTP connections get five seconds to drain before remaining sockets are closed, including incomplete
request bodies. Application work still must unwind before ownership is released.

An exclusive `server.lock` file in the canonical data directory prevents cooperating executable
instances from opening the same inventory. Its PID is diagnostic only. Successful shutdown and
failed startup release ownership after resources close. Crashes leave the file in place. There
is no automatic stale-lock takeover: PID reuse and delayed processes make inferred ownership unsafe.
An operator must establish that the previous owner has stopped before removing this one file.
Removing a live owner's file, replacing its data directory, and running direct application factories
against an executable-owned directory are unsupported. Ownership assumes a local filesystem with
atomic exclusive file creation. The low-level application and HTTP factories remain available for
isolated embedding/tests; their caller owns process coordination.

OS-managed locking is deferred. The current slice uses disposable development state and manual
crash recovery so the server can be exercised without another native dependency. Revisit automatic
lock release when introducing Electron process supervision or persistent home-server operation.
At that point, evaluate a maintained macOS/Linux implementation and prove that a running owner
rejects competitors, a killed owner permits restart without cleanup, and competing restarts produce
exactly one owner. PID checks or time-based expiry alone must not establish abandoned ownership.

Process smoke specs use disposable Git repositories and data directories to verify real HTTP,
authentication, inventory persistence, concurrent startup refusal, shutdown signals, and explicit
crash recovery. CI runs those specs on Linux and macOS. This does not prove packaging, service
supervision, remote connectivity, or a client UI.
