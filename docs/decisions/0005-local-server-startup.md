# 0005: Local server startup

Status: accepted.

The server executable defaults to `127.0.0.1`; `PORCELAIN_HOST` is an explicit, validated opt-in
for another listener address, including a LAN bind such as `0.0.0.0`. `PORCELAIN_DATA_DIRECTORY`
must be an absolute path, `PORCELAIN_PORT` an explicit integer from 0 to 65535 (0 requests an
available port), and `PORCELAIN_TOKEN` a caller-provided token satisfying the existing HTTP
contract. There is no default data directory. `PORCELAIN_WEB_ROOT`, when supplied, must be an
absolute path and enables GET/HEAD hosting of a built web app; it never defaults to a user or
working directory. Token generation, pairing, remote listeners, and service installation remain
separate work. Tokens must be generated cryptographically and never logged.

Startup validates configuration, claims the data directory, initializes inventory, and then
listens. A JSON line containing `address` on stdout indicates readiness. Failure exits nonzero
with a bounded diagnostic on stderr that does not echo configuration or raw errors.
SIGINT and SIGTERM cancel startup or close the listener and application before releasing ownership.
HTTP connections get five seconds to drain before remaining sockets are closed, including incomplete
request bodies. Application work still must unwind before ownership is released.

One server owns a data directory, and the owner socket is the proof: a start that connects and
gets an answer refuses; a socket file that nothing answers on is what a crash leaves, and the next
start removes it. No PID is consulted, so PID reuse cannot fool it.

Deciding "stale, remove, bind" is not atomic, so that window is held under an advisory lock taken
on a file used for nothing else. Without it two starters can both find a dead socket and the second
deletes the first one's live one, because no probe distinguishes a crashed starter from a live one
that has not bound yet. The lock is an exclusive SQLite transaction because Node exposes no `flock`
and SQLite already ships here; what matters is that it locks through `fcntl`, so the kernel releases
it when the holder dies and a crash needs no cleanup. It is waited for by polling rather than inside
SQLite, whose wait would block the event loop. This replaces the lifetime-held `server.lock`, which
required an operator to remove it after every crash.

Owner operations are served only on a Unix socket in the data directory, so file permissions are
the credential and nothing on the network can reach them. Because socket modes are not portable,
the containing directory is the boundary: startup refuses a data directory that another user owns
or that is readable beyond its owner, since `mkdir` never tightens an existing directory. The socket
is then narrowed to 0600 and confirmed before the owner door counts as ready. A composite runtime
owns both listeners and the application: on any partial start it closes both doors, then the
application exactly once.

Routes exist once, under `/api`. Browser-facing requests are checked before anything reads them:
`Host` must be loopback, the address the connection arrived on, or a name given on the command line,
and an unsafe method carrying an `Origin` that is not this server's own is refused. Forwarded
headers are never trusted, so running behind a reverse proxy needs an explicit trusted-proxy and
public-origin contract that does not exist yet.

Process smoke specs use disposable Git repositories and data directories to verify real HTTP,
authentication, inventory persistence, concurrent startup refusal, shutdown signals, and restart
after a crash with no recovery step. CI runs those specs on Linux and macOS. This does not prove packaging, service
supervision, remote connectivity, or a client UI.
