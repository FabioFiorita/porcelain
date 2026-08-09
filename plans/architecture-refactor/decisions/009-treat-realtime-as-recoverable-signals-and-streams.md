# 009 — Treat realtime as recoverable signals and streams

- **Status:** Accepted
- **Accepted:** 2026-08-09

## Context

The authenticated `/session` WebSocket currently carries coarse application invalidations,
session-scoped filesystem watch registrations, and stateful terminal request/reply and byte streams.
These responsibilities benefit from one authenticated connection but have different correctness,
ordering, recovery, and ownership semantics.

Web and mobile separately map application events to stale queries. A healthy socket also does not
prove that every relevant resource is watched: some filesystem notifications are sent only to the
session that registered paths. Treating socket connectivity as a freshness guarantee can therefore
leave query data stale.

WebSocket delivery is ordered while one connection remains healthy, but it is not a durable event
log. Porcelain must not claim replay or exactly-once behavior it does not provide.

## Decision

One authenticated session socket carries three explicitly distinct protocol categories—typed change
notifications, declarative subscription registrations, and stateful streams—while clients treat
notifications as best-effort freshness signals and recover authoritative state through queries.

Electron-native shell events remain on the shell channel because they represent window and updater
behavior rather than daemon product domains.

## Change notifications

A change notification states that authoritative daemon-owned data changed. It does not carry the
authoritative entity by default and does not perform a required workflow step.

Notifications:

- are defined and runtime-validated in `packages/contracts`;
- use canonical product-domain vocabulary and typed discriminators;
- carry enough domain scope to identify affected queries precisely;
- may include a path, project, Review, terminal, or other stable public identifier when relevant;
- are idempotent for consumers and safe to process more than once;
- map exhaustively to typed query identities in `packages/client-runtime`;
- are applied by one query adapter in each client rather than feature components.

```text
contract change notification
              ↓
client-runtime affected-query mapping
          ↙                         ↘
Web query adapter             mobile query adapter
          ↓                         ↓
precise TanStack Query invalidation or reconciliation
```

Full entity payloads are avoided because they create a second data synchronization protocol beside
request/response queries. A notification may carry a revision or result hint when it enables safe
deduplication or reconciliation, but queries remain authoritative.

## Publication ownership

For a change produced by an application operation:

```text
perform and confirm the durable change
              ↓
publish the resulting domain change fact
```

- The coordinating operation makes resulting change facts explicit.
- Routers do not publish domain notifications.
- Persistence and host adapters do not secretly broadcast product events.
- Publication occurs only after the corresponding state change succeeds.
- A multi-domain operation exposes every resulting change fact rather than relying on collaborator
  side effects that are invisible in the workflow.
- Notification-delivery failure does not reverse an already successful durable operation. It is
  observed and clients recover through query refresh.

Changes originating outside a Porcelain operation, such as an agent editing a watched file, enter
through an infrastructure watcher. A dedicated adapter translates the observed host change into the
same domain notification vocabulary. Raw `fs.watch` details do not become public event contracts.

The first exemplar will establish whether operations return change facts to a publisher wrapper or
invoke an injected post-success publisher. Whichever shape is chosen must keep publication visible,
ordered after success, nonthrowing after commitment, and consistent across domains.

## Declarative subscriptions and watches

Some host observation is expensive or meaningful only while resources are active. Clients express
their desired interests declaratively through one session-level subscription manager.

- Components and screens do not open sockets or send raw watch commands through local effects.
- Feature adapters register semantic interests with the session manager.
- The manager combines, deduplicates, reference-counts, and bounds registrations.
- Removing one consumer does not remove an interest still held by another.
- Registration messages are idempotent and communicate the complete desired set where practical.
- The manager re-registers desired interests after every reconnect.
- Daemon watcher resources are session-owned and cleaned up on disconnect.
- Security, path normalization, and resource caps remain enforced at the daemon boundary.

Socket health and watch coverage are separate state. A connected client with no registration for a
resource has no push-freshness guarantee for that resource.

## Stateful streams

Terminal messages are stateful stream protocol, not change notifications. They retain explicit
commands, correlation identifiers, attachment, ordered output, exit state, lifecycle, and recovery
semantics.

Future high-frequency or bidirectional streams receive their own typed protocol category rather than
being encoded as large notifications. Stream state may update a dedicated client runtime directly
when query invalidation would be the wrong abstraction.

The same socket is a transport optimization and authentication boundary; it does not make every
message semantically interchangeable.

## Delivery and recovery guarantees

Change-notification delivery is:

- ordered within one healthy WebSocket connection;
- best effort and non-durable;
- safe under duplicate handling;
- not exactly once;
- not replayed for a disconnected client.

The daemon provides an instance epoch and a monotonically increasing notification sequence. A new
epoch identifies daemon replacement. A sequence gap means the client cannot prove freshness. The
protocol migration must preserve compatibility with existing clients until the richer envelope is
available everywhere.

On reconnect, epoch change, or detected gap, the client:

1. re-registers its desired watches and subscriptions;
2. reattaches recoverable stateful streams according to their protocol;
3. invalidates daemon-derived query data at the appropriate environment scope;
4. refetches active queries through normal TanStack Query behavior.

Because notifications are not durable, even reconnecting to the same epoch requires freshness
recovery unless a future accepted decision introduces replay from a confirmed sequence.

Terminal recovery remains distinct: clients reattach to daemon-owned sessions and consume the
authoritative scrollback snapshot before live output.

## Polling and focus refresh

Polling is a deliberate recovery or coverage mechanism:

- queries with complete active watch coverage need not poll routinely;
- watch-dependent queries may use backstop polling while the socket is unavailable;
- sources the daemon cannot reliably observe may require bounded polling even with a healthy socket;
- foreground or focus refresh remains available where platform lifecycle creates uncertainty;
- cross-client polling semantics live with shared query definitions when genuinely common;
- components do not create independent intervals.

Every query that relies on realtime freshness documents its coverage and fallback. “The socket is
open” is never sufficient justification for infinite freshness.

## Rationale

- Request/response queries remain one authoritative data model.
- Typed scoped notifications replace duplicated coarse invalidation maps.
- Explicit subscriptions make watcher resource ownership and coverage inspectable.
- Streams retain the richer lifecycle they require.
- Honest best-effort guarantees produce deterministic reconnect recovery instead of assumed delivery.
- Required business behavior remains visible in operations rather than hidden in event handlers.

## Rejected alternatives

- **Send complete entities in every event.** A second synchronization and conflict-resolution system
  emerges beside TanStack Query.
- **Treat events as required business commands.** Workflow ordering and failure disappear from the
  coordinating operation.
- **Let adapters emit product events implicitly.** A write's observable consequences cannot be
  understood from its application operation.
- **Let every component manage a socket or watcher.** Registrations leak, duplicate, race, and fail
  to recover consistently.
- **Use socket connectivity as freshness proof.** Targeted watches and unobservable sources leave
  uncovered data stale.
- **Promise exactly-once or durable replay.** The current transport cannot provide either guarantee.
- **Treat terminal bytes as query invalidations.** Ordered stream state loses correlation, replay,
  and lifecycle semantics.
- **Remove all polling.** Missed notifications and uncovered host changes would have no recovery
  path.

## Consequences

- The coarse `AppEvent` enum must evolve into domain-scoped notification contracts through a
  compatibility migration.
- Web and mobile invalidation maps converge in client-runtime.
- Session clients gain centralized declarative interest registration and deterministic rehydration.
- The daemon session handshake gains instance epoch and sequence information.
- Existing targeted file watchers remain a useful mechanism but publish domain meaning rather than
  leaking watcher implementation vocabulary.
- Notification publication becomes an explicit application concern; its exact helper shape is set
  by the first exemplar.
- Reconnect may refetch more data than an ideal replayable system, intentionally favoring correctness
  over a premature durable event log.

## Enforcement and proof

Contract exhaustiveness checks should cover every notification and stream message. Client-runtime's
notification-to-query mapping must be exhaustive over the contract union. Import rules should keep
feature components away from raw session, watcher, and query-client APIs.

Each migrated realtime flow must prove operation or external-watcher publication, contract
validation, shared affected-query mapping, Web and mobile application, duplicate safety, reconnect
registration, and missed-notification recovery. Stream migrations additionally prove attachment,
ordering, termination, and recovery semantics appropriate to that stream.
