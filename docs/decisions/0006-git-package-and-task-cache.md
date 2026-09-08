# Git package and task caching

Status: accepted.

`packages/git` is a private Node package with explicit public subpaths. It owns checkout-bound discovery,
inspection, history and mutation adapters, their errors, narrow capability interfaces, command inputs
and results. It has no dependency on server code, HTTP contracts or persistence. Discovery reports Git
metadata; the server assigns Porcelain IDs. Command execution receives a command identifier, intent
and inspected preview; expiry, request idempotency, durable receipts, project blocks and queues stay in
the server. Database and domain packages are not introduced.

Turborepo schedules package typechecks and coverage tasks. The Git suite is independent; server
integration tests depend on Git's task hash and dependency typechecks. Contracts have their own schema specs; tooling has a separate root task.
Shared test configuration, compiler settings, runner scripts, the workspace lock and runtime fingerprint
participate in invalidation. Inputs default to all package files; reducing these requires proof that
omitted files cannot affect the check. Consumer checks must invalidate when their dependencies change.

The wrapper fingerprints OS, architecture, OS release, Node version, Git build information, OpenSSL
version, effective Git configuration and relevant Git/SSH/locale/CI-image environment values. Only the
hash is passed to Turbo; configuration and credentials must not be logged. Use the package scripts,
not bare `turbo`, for trusted cache keys. Toolchain binaries and external helper implementations are
trusted inputs; this is not a sandbox or a claim that arbitrary external state can be cached safely.
CI's runner image identity participates in the fingerprint. Deployment tests remain uncached.

CI checkout does not persist its per-run authentication token in Git configuration, preventing
credential rotation from invalidating otherwise identical checks. CI uses a pinned GitHub cache action to persist `.turbo/cache`, separated by platform and dependency
lock. There is no external cache account or credential requirement. Fork pull requests follow GitHub's
cache access restrictions. A task cache hit restores coverage outputs, not only console logs.

Scoped Vitest runs emit normalized Istanbul JSON. Server coverage includes its Git and contract
executions; the always-run merger combines coverage by file and source location, so percentages are
not averaged and files are not counted twice. The existing 90% statements/lines, 85% functions and
80% branches floors remain global. Missing reports fail, and low combined coverage fails even when
individual task results were cached. Reports and JUnit outputs are uploaded for both CI platforms.

The cache regression runs the real Turbo executable against a disposable workspace with lightweight
commands: it proves repeated hits, output restoration, server-only reuse, Git-to-server invalidation,
and shared-config/runtime invalidation. Boundary fixtures reject package-to-server imports and
implementation imports from use cases. The real HTTP workflow selects a linked worktree from inventory,
lists and reads its files, inspects Git state/history, and retains identity and metadata after restart.
No browser or remote deployment proof is implied by these tests.
