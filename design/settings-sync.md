# Sync Reviews & Git settings through their computer

Decision required before implementation. This is an isolated API sketch: every operation body throws `not implemented`; no route, migration, database, application import or behavior is changed. The proposed public HTTP contract and the database migration below need approval. The stubs must never land by themselves.

## Problem and current owners

The five values are `pullStrategy`, `collapseSpecs`, `archiveDeleteWorktree`, `archiveDeleteLocalBranch` and `archiveDeleteRemoteBranch`. `packages/client/src/features/preferences/store/saved-preferences.ts` currently stores these alongside device preferences. The web adapter in `apps/web/src/features/preferences/store.ts` uses `Atom.kvs`; the mobile adapter in `apps/mobile/src/features/preferences/store.ts` uses the shared `PreferencesStore` and a storage port. Therefore changing one device does not change another.

The values already affect more than Settings: web review/file grouping reads `collapseSpecs`; the Git menu reads `pullStrategy`; both archive sheets derive defaults with `archiveOptions`. Those consumers must migrate with the settings controls. General settings, sidebar expansion and the remembered commit model stay device-local. Mobile currently also shows Commit model in Reviews & Git and does not expose Spec files there; this design syncs the five named values without turning that existing UI discrepancy into an extra redesign.

## Usage first

The caller chooses the actual computer's `RuntimeConnection`, reads one atom and writes one command atom. Changing a setting requires the revision the caller saw. Initial import is a separate explicit command with revision zero; merely opening Settings never writes.

Module names in the examples below are local to this sketch. During implementation the canonical schemas belong in `packages/access/src/models`, wire envelopes in `packages/contracts/src/access`, services and the store port in `packages/access`, SQLite in `packages/storage`, HTTP use cases/routes in `apps/server`, and atoms in `packages/client/src/features/preferences`. Each application supplies its selected connection and renders the result. No new package or dependency is needed.

## Chosen shape: a server-owned record

Each server owns one optional settings record for its environment. Every paired device connected to that server reads the same record. Different computers can have different settings; there is no account-wide or computer-to-computer replication. A desktop or mobile app with several paired computers shows an explicit computer selector for Reviews & Git, remembers it only as local UI state, and uses the worktree's connection for all review, pull and archive consumers. With no selected worktree, the selector still names the computer being edited. A plain browser remains scoped to its one computer.

Reads return `unconfigured` or `configured` with a positive revision and all five values. Saves either initialize the whole record or apply a nonempty typed partial change with an expected positive revision. The partial schema is derived from the full schema: there is no second field list. A single SQLite transaction checks the revision, preserves omitted fields, saves all values and increments the revision. A stale or duplicate save returns `SettingsConflict` with the current snapshot; the caller displays it and asks the user to apply their choice again. No automatic conflict replay or retry.

Reuse the existing confirmed-resource, per-connection atom runtime, write queue, query-key invalidation and live-notice path. Local atom state is a confirmed cache, not another authority. Use one new environment-scoped notice, `{ type: 'review-git-settings' }`, delivered to paired live connections without a project/worktree subscription. Subscribe/read on connection, invalidate on the notice and refetch on live reconnect so a missed notice cannot strand a cache. Save responses refresh the submitting client's confirmed snapshot. Queue subsequent edits against the newest confirmed revision or leave controls disabled while saving; do not submit another edit with a revision already in flight.

## Proposed public contract and authorization

- `GET /api/review-git-settings` returns `SettingsSnapshot`. It requires pairing and returns 401 for an absent or revoked session.
- `PATCH /api/review-git-settings` accepts `SaveSettings` and returns `ConfiguredSettings`. It uses the same paired/client request boundaries. Writes require the owner or a currently trusted paired device; network locality alone grants no write privilege. An untrusted paired device can read and gets 403 on save. Check current device state inside the access lane at commit time, not once when opening Settings.
- Invalid enums, non-booleans, an empty change, negative/fractional/unsafe revisions, missing fields, undefined values and unknown/excess keys return 400 through native schemas and the API's existing strict parse options. No arbitrary preference keys cross the wire.
- Revision mismatch, including two first imports, returns 409 with `SettingsConflict.current`. Unreachable/request failure, unsupported older servers and access failures remain distinct client states. The sketch's client failure names describe those states; the implementation should reuse existing transport/auth error owners when mapping them.

Use the existing access lane for authorization and the mutation, followed by a committed live notice. The SQLite store alone owns atomic initialization and compare-and-save. Persistence failures remain defects, matching nearby SQLite stores; they must not publish success or a change notice. The domain services each retain one named `execute` and a static Layer, with dependencies supplied through Layers. The sketches omit HTTP composition and event publication bodies deliberately; implementation must keep them in the server use case, not views or the storage adapter.

## Database migration and first-device import

Add one native additive migration to `packages/storage/src/db/migrate.ts` (use the next available sequence at implementation time) creating `review_git_settings` with `singleton INTEGER PRIMARY KEY CHECK(singleton = 1)`, `revision INTEGER NOT NULL CHECK(revision > 0)` and `settings TEXT NOT NULL`. The payload is the canonical Schema-validated five-field record; validate it on read as well as write. No rows are seeded during database upgrade: the server cannot read device storage. Do not edit legacy migration history or rewrite existing tables. Use the existing SQLite transaction/migrator path and reject incompatible database histories as today. The sketch does not execute this migration.

On an upgraded but unconfigured server, show this device's existing five decoded values as an import preview. The user explicitly chooses “Use these settings for this computer”; initialization atomically inserts revision 1. A new device previews the existing defaults (Merge, specs not grouped, all three archive deletions on), with the deletion choices visible before confirmation. Two devices confirming concurrently produce one winner and one conflict; a later device always reads the winner and never silently imports over it.

Retain the original local record until import succeeds and preserve the six unrelated local fields. Once configured, all five server-owned fields leave the local writable preferences shape and every current consumer moves to the server-backed source. Local legacy decoding exists only to supply an explicit first-import candidate; it never merges into or overwrites a configured record. The implementation must remove the old five local setters/callers in the same change. A failed or ambiguous import is recovered by rereading the server, not resubmitting automatically.

Until import is confirmed, show the preview but disable operations that need these defaults (Pull and creating an archive plan); Fetch/Push and manual review reading remain available. Once configured, live read failures can retain last confirmed values for viewing and spec grouping, with a persistent unavailable notice; disable setting saves, Pull and archive-plan creation until a fresh read succeeds. A plan already shown remains the user's explicit selection and keeps existing server validation/dirty-work acknowledgement. Never silently replace an unreadable server value with a device default.

An older server without the route shows “Update this computer to sync settings” and disables the new settings/operations requiring them. Older clients keep their preexisting local behavior and do not write this record; the new server cannot force old clients to consume it. That mixed-version limitation must be disclosed during rollout. Additive schema alone does not promise executable downgrade: this repository rejects unknown native migration history, so after upgrade an older server binary may refuse to start. Use the existing database backup/restore or forward upgrade path, not manual row/table deletion.

## Alternative: device replicas with a synchronization log

A structurally different shape keeps a writable device-local replica with `{ deviceId, values, pendingEdits, observedSequences }`; edits carry device identity, a sequence, a logical clock, a field and a correlated value. `editReplica(replica, edit): Replica` and `exchangeWithServer(replica, environmentId): Promise<Replica>` both have bodies that throw `not implemented` in the discarded scratch sketch. A server log accepts idempotent edits, and every replica merges snapshots and replays its outbox. Application callers can change values offline and exchange later.

It loses because the feature asks devices sharing a server to agree, not for offline editing. This alternative needs durable outboxes, merge ordering, per-device cursors, retention and separate migration of every platform store. Concurrent edits to archive deletion defaults become a merge policy. A typed field/value union can prevent malformed edits but cannot remove the multiple writers. No running prototype is needed to distinguish the ownership and durable-state costs; this checkpoint makes no latency or runtime claims.

## Red-flag screen

| Screen | Server-owned record | Device replicas |
| --- | --- | --- |
| Caller coordinates several calls for one operation | One command owns save and confirmed-cache refresh | Replica owner must hide local edit, exchange and acknowledgement |
| One internal detail known by several modules | Revision belongs to the wire envelope; SQL merge/initialization stays in one store | Sequence, logical clock and replay rules cross client, server and platform storage |
| State has more than one writer | One durable server owner; devices submit conditional commands | Every writable replica plus the server log participates in authority |
| Two ways to do one task | Replace all five local setters; explicit legacy import only before initialization | Local edits and remote merges both change settings |
| Internals importable from outside | Existing package role boundaries; sketches use local modules only | Requires a carefully restricted replica protocol and storage API |
| A list kept in sync by hand | Derive partial schema from canonical fields; no device list | Active device cursors and log retention must be reconciled |

## Tradeoffs accepted and deliberately excluded

Accept a computer selector, an explicit first import, conflicts that require review, and no offline writes. These make the single authority visible and avoid last-writer-wins surprises for destructive defaults. Scope is per computer, not per repository, device identity or account.

No General preference sync; no theme, diff, wrapping, document-default, commit-model or navigator-expansion sync. No cloud account, hub election, durable client outbox, cross-computer broadcast, background import, automatic retry, new package, rule change or dependency. No changes to archive execution, trust policy for other operations or Git action validation. No new mobile layout work beyond eventual controls needed for the approved five values and computer selection.

## Open questions for approval

1. **Scope:** approve one settings record per computer, with an explicit target selector in multi-computer apps, rather than one global set across all computers? This is the main architectural choice.
2. **Migration:** approve the empty singleton table and explicit first-device import, including visibly confirming existing archive deletion choices? The alternative is server defaults on upgrade, which loses existing per-device choices.
3. **Availability and rollout:** approve blocking Pull/archive-plan defaults until initialization and while server settings are unavailable, plus the stated limitation for older clients? This avoids acting on unconfirmed destructive defaults but changes availability.
4. **Write authority and conflicts:** approve owner/trusted-only writes on every route and 409 conflicts requiring a deliberate resave, including conflicts between edits to different fields?

## Design state matrix

All rows below are design assertions for approval, not feature runtime proof. No application, database or devices are changed by this sketch.

| State | Expected after implementation | web 1440 | web 414 | desktop | Android | Test (file:case) | Result |
| --- | --- | --- | --- | --- | --- | --- | --- |
| Both pull strategies; all 16 boolean combinations | Save/read exact values across two devices | N/A sketch | N/A sketch | N/A sketch | N/A no devices | Future schema/client/server cases | Design only |
| No server row; first/new device; existing false defaults | Explicit preview/import; no opening-time write | N/A sketch | N/A sketch | N/A sketch | N/A no devices | Future migration/import cases | Design only |
| Two imports or stale/disjoint/double saves | One atomic winner; 409 returns current snapshot | N/A sketch | N/A sketch | N/A sketch | N/A no devices | Future real SQLite concurrent save cases | Design only |
| Empty/invalid/excess patch; invalid revision | 400; no storage or notice | N/A sketch | N/A sketch | N/A sketch | N/A no devices | Future HTTP validation cases | Design only |
| Read/save failure, timeout, ambiguous response, retry | Preserve confirmed view; disable mutations; explicit reread/recovery | N/A sketch | N/A sketch | N/A sketch | N/A no devices | Future failure/recovery cases | Design only |
| Unpaired, paired-untrusted, trusted, revoked; local/LAN/remote | Read requires pairing; save owner/trusted; same policy on all routes | N/A sketch | N/A sketch | N/A sketch | N/A no devices | Future auth/commit-time revocation cases | Design only |
| Live change/reconnect; switch computers during a request | Refetch environment cache; late A response never changes B | N/A sketch | N/A sketch | N/A sketch | N/A no devices | Future notice and connection-identity cases | Design only |
| Old/equal/new server/client; unknown capabilities; executable downgrade | Unsupported explicit; no sync promise to old clients; migration guard retained | N/A sketch | N/A sketch | N/A sketch | N/A no devices | Future compatibility cases | Design only |
| Long computer labels, many computers, 414 width, both themes | Target remains named and reachable; existing settings navigation retained | N/A sketch | N/A sketch | N/A sketch | N/A no devices | Future surface checks after approval | Design only |
| General settings, sidebar, commit model; archive acknowledgements | Retain local behavior and existing operation safety | N/A sketch | N/A sketch | N/A sketch | N/A no devices | Future regression cases | Design only |

The total value space is 32: two pull strategies multiplied by four independent booleans. “All 16 boolean combinations” refers only to the boolean fields.

## Chosen TypeScript sketch

These are proposed modules, not imports into the running application. The call sites were written first. To check signatures, extract the four TypeScript blocks as named under a temporary `design/settings-sync/` directory; its relative `RuntimeConnection` imports refer to the existing shared client type. Keep extracted files out of the commit. The operation stubs intentionally throw.

### call-sites.ts

```ts
import type { AtomRegistry } from 'effect/reactivity';
import type { RuntimeConnection } from '../../packages/client/src/shared/api/connection.ts';
import { readReviewGitSettings, saveReviewGitSettings } from './client.ts';
import type { ConfiguredSettings, ReviewGitSettings } from './model.ts';

export function reviewsGitSettingsPage(
  registry: AtomRegistry.AtomRegistry,
  connection: RuntimeConnection,
) {
  return registry.get(readReviewGitSettings(connection));
}

export function choosePullStrategy(
  registry: AtomRegistry.AtomRegistry,
  connection: RuntimeConnection,
  current: ConfiguredSettings,
) {
  registry.set(saveReviewGitSettings(connection), {
    kind: 'change',
    expectedRevision: current.revision,
    change: { pullStrategy: 'rebase' },
  });
}

export function importThisDeviceSettings(
  registry: AtomRegistry.AtomRegistry,
  connection: RuntimeConnection,
  settings: ReviewGitSettings,
) {
  registry.set(saveReviewGitSettings(connection), {
    kind: 'initialize',
    expectedRevision: 0,
    settings,
  });
}
```

### model.ts

```ts
import { Schema, Struct } from 'effect';

export const reviewGitSettingsSchema = Schema.Struct({
  pullStrategy: Schema.Literals(['merge', 'rebase']),
  collapseSpecs: Schema.Boolean,
  archiveDeleteWorktree: Schema.Boolean,
  archiveDeleteLocalBranch: Schema.Boolean,
  archiveDeleteRemoteBranch: Schema.Boolean,
});
export type ReviewGitSettings = typeof reviewGitSettingsSchema.Type;

const revisionSchema = Schema.Int.check(Schema.isGreaterThan(0)).check(
  Schema.isLessThanOrEqualTo(Number.MAX_SAFE_INTEGER),
);
export const configuredSettingsSchema = Schema.Struct({
  kind: Schema.Literal('configured'),
  revision: revisionSchema,
  settings: reviewGitSettingsSchema,
});
export type ConfiguredSettings = typeof configuredSettingsSchema.Type;
export const settingsSnapshotSchema = Schema.Union([
  Schema.Struct({ kind: Schema.Literal('unconfigured') }),
  configuredSettingsSchema,
]);
export type SettingsSnapshot = typeof settingsSnapshotSchema.Type;

const changeSchema = reviewGitSettingsSchema
  .mapFields(Struct.map(Schema.optionalKey))
  .check(Schema.isMinProperties(1));
export const saveSettingsSchema = Schema.Union([
  Schema.Struct({
    kind: Schema.Literal('initialize'),
    expectedRevision: Schema.Literal(0),
    settings: reviewGitSettingsSchema,
  }),
  Schema.Struct({
    kind: Schema.Literal('change'),
    expectedRevision: revisionSchema,
    change: changeSchema,
  }),
]);
export type SaveSettings = typeof saveSettingsSchema.Type;

export class SettingsConflict extends Schema.TaggedError<SettingsConflict>()(
  'SettingsConflict',
  { current: settingsSnapshotSchema },
) {}

export class SettingsUnavailable extends Schema.TaggedError<SettingsUnavailable>()(
  'SettingsUnavailable',
  {
    reason: Schema.Literals([
      'unsupported-server',
      'offline',
      'request-failed',
    ]),
  },
) {}

export class SettingsAccessDenied extends Schema.TaggedError<SettingsAccessDenied>()(
  'SettingsAccessDenied',
  { reason: Schema.Literals(['unpaired', 'untrusted', 'revoked']) },
) {}

export type ReadFailure = SettingsUnavailable | SettingsAccessDenied;
export type SaveFailure = ReadFailure | SettingsConflict;
```

### server.ts

```ts
import { Context, Effect, Layer } from 'effect';
import type { SqlClient } from 'effect/sql';
import type {
  ConfiguredSettings,
  SaveSettings,
  SettingsConflict,
  SettingsSnapshot,
} from './model.ts';

export class ReviewGitSettingsStore extends Context.Service<
  ReviewGitSettingsStore,
  {
    readonly read: () => Effect.Effect<SettingsSnapshot>;
    readonly save: (
      input: SaveSettings,
    ) => Effect.Effect<ConfiguredSettings, SettingsConflict>;
  }
>()('@porcelain/access/ReviewGitSettingsStore') {}

export class ReadReviewGitSettingsService extends Context.Service<
  ReadReviewGitSettingsService,
  {
    readonly execute: () => Effect.Effect<SettingsSnapshot>;
  }
>()('@porcelain/access/ReadReviewGitSettingsService') {
  static readonly layer: Layer.Layer<
    ReadReviewGitSettingsService,
    never,
    ReviewGitSettingsStore
  > = Layer.effect(
    ReadReviewGitSettingsService,
    Effect.gen(function* () {
      yield* ReviewGitSettingsStore;
      return {
        execute: Effect.fn('ReadReviewGitSettingsService.execute')(
          function* (): Effect.fn.Return<SettingsSnapshot> {
            throw new Error('not implemented');
          },
        ),
      };
    }),
  );
}

export class SaveReviewGitSettingsService extends Context.Service<
  SaveReviewGitSettingsService,
  {
    readonly execute: (
      input: SaveSettings,
    ) => Effect.Effect<ConfiguredSettings, SettingsConflict>;
  }
>()('@porcelain/access/SaveReviewGitSettingsService') {
  static readonly layer: Layer.Layer<
    SaveReviewGitSettingsService,
    never,
    ReviewGitSettingsStore
  > = Layer.effect(
    SaveReviewGitSettingsService,
    Effect.gen(function* () {
      yield* ReviewGitSettingsStore;
      return {
        execute: Effect.fn('SaveReviewGitSettingsService.execute')(function* (
          _input: SaveSettings,
        ): Effect.fn.Return<ConfiguredSettings, SettingsConflict> {
          throw new Error('not implemented');
        }),
      };
    }),
  );
}

export function sqliteReviewGitSettingsStoreLayer(): Layer.Layer<
  ReviewGitSettingsStore,
  never,
  SqlClient.SqlClient
> {
  throw new Error('not implemented');
}
```

### client.ts

```ts
import type { AsyncResult, Atom } from 'effect/reactivity';
import type { RuntimeConnection } from '../../packages/client/src/shared/api/connection.ts';
import type {
  ConfiguredSettings,
  ReadFailure,
  SaveFailure,
  SaveSettings,
  SettingsSnapshot,
} from './model.ts';

export function readReviewGitSettings(
  _connection: RuntimeConnection,
): Atom.Atom<AsyncResult.AsyncResult<SettingsSnapshot, ReadFailure>> {
  throw new Error('not implemented');
}

export function saveReviewGitSettings(
  _connection: RuntimeConnection,
): Atom.Writable<
  AsyncResult.AsyncResult<ConfiguredSettings, SaveFailure>,
  SaveSettings
> {
  throw new Error('not implemented');
}
```
