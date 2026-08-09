# 015 — Make a clean pre-launch cutover

- **Status:** Accepted
- **Accepted:** 2026-08-09

## Context

Porcelain has not launched publicly. Existing compatibility code, migrations, legacy wire names,
dual representations, and deprecated fields protect development history rather than deployed users.
Carrying them through a major architecture refactor would make the target harder to understand and
would require every future contributor to distinguish current truth from formats that no released
product needs.

At the same time, many behaviors informally called fallbacks are actually permanent correctness:
reconnecting after network loss, rejecting malformed external data, bounding large files, handling
missing resources, recovering query freshness, and failing closed at security boundaries. A clean
launch removes historical compatibility, not the real world's failure modes.

## Decision

The refactored pre-launch product supports one explicitly versioned wire protocol, one target storage
format per owner, and one application path; it preserves no pre-launch compatibility aliases,
migrations, deprecated representations, or completed-domain fallback paths, while retaining explicit
resilience, recovery, safety, and platform behavior.

## Compatibility code removed

The target architecture contains no:

- legacy procedure, event, command, discriminator, or field aliases;
- deprecated contract fields retained for an earlier client;
- local client mirrors of superseded schemas;
- old WebSocket notification envelopes;
- dual reads, dual writes, shadow persistence, or “try new then old” access;
- discovery of obsolete data locations;
- home-to-project or active-Review format migrations;
- legacy Evidence document shapes or readers;
- coercion of old persisted records into the new format;
- defaults whose only purpose is filling fields absent in a superseded representation;
- tests whose only protected behavior is pre-launch compatibility;
- transitional adapters after their bounded domain migration is complete.

Existing public procedure names and persisted aliases are therefore not stability constraints during
the refactor. Decisions 001, 005, 009, 012, and 013 remain accepted in their architectural substance,
but any clause requiring pre-launch wire-name, client-version, event-envelope, or persisted-alias
compatibility is superseded by this decision.

The exhaustive inventory still records old names and paths so migration specifications can delete
them completely. They are migration inputs, not target aliases.

## Resilience retained

These behaviors model permanent operating conditions and remain:

- session reconnect, subscription restoration, and missed-notification recovery;
- bounded polling or focus refresh where realtime coverage is incomplete;
- file, message, memory, watcher, process, and other resource limits;
- invalid untrusted input rejection and corrupt-data detection;
- unavailable network, filesystem, Git, process, and platform outcomes;
- typed native-error normalization;
- fail-closed authentication, authorization, path, URL, and active-content rules;
- platform-specific adapters required by supported systems;
- intentional empty states and product defaults;
- explicit mixed-effect ordering, recovery, and compensation;
- terminal reattachment and scrollback recovery.

The classification rule is:

```text
“Earlier Porcelain wrote or called this” → remove before launch
“A supported runtime can genuinely do this” → model and prove explicitly
```

A behavior is not deleted merely because its function or comment currently uses the word fallback.
The inventory classifies its reason first.

## Fresh storage

Every target persisted root has an explicit format version beginning at `1`, a strict schema, and one
owner.

- Only the current format is accepted before launch.
- An incompatible version produces a clear diagnostic rather than silent conversion.
- Unknown or malformed data follows the owning domain's explicit corruption policy; it is never
  guessed into the current model.
- Intentional defaults are created by the current domain, not inferred from old files.
- Development has a deliberate reset and seed path for clean target state.
- No migration framework is introduced until a released format actually requires one.

Versioning is foundation, not compatibility baggage. After the first public release, a new accepted
decision will define supported upgrade windows and migration policy from real deployment needs.

## Fresh protocol

The daemon handshake exposes an exact protocol version. Web, mobile, CLI, and daemon are migrated to
the target contract together.

- Matching protocol versions communicate normally.
- A mismatch fails clearly with an update-required outcome.
- The daemon does not emulate pre-launch clients.
- Clients do not retry through an old transport or procedure name.
- Procedure and notification names adopt the canonical domain vocabulary selected by the exhaustive
  inventory.
- Contract output and error schemas have one current representation.

This decision permits breaking wire changes during the refactor. A bounded migration must update all
repository-owned participants before its completion and leave the repository gates green.

## Incremental migration

The repository continues shipping through incremental commits, but a completed domain cannot retain
two architectures. When temporary scaffolding is necessary, the same bounded migration specification
must include its removal:

```text
introduce target path
    ↓
move every participating caller and persisted writer
    ↓
prove target behavior from clean state
    ↓
delete legacy path, schema, migration, and compatibility tests
```

Temporary scaffolding records its exact removal step and cannot be deferred to an unspecified follow-
up. Cross-domain dependency ordering may split implementation into several specifications, but the
legacy path remains explicitly owned and the final cutover specification is part of the same planned
batch before execution begins.

## Existing data and destructive scope

This architecture decision does not itself delete filesystem data. Current development channels,
production companion data, repo-local Reviews, Board cards, Actions, or other human-authored material
remain untouched during planning.

The eventual reset specification must:

- enumerate exact storage roots and file classes;
- distinguish disposable generated/development state from human-authored material;
- define whether material is intentionally discarded, exported, or backed up;
- use a clean target seed after reset;
- obtain any additional destructive authorization required for data outside disposable development
  homes.

The shipped application will not read old data merely because a backup exists.

## Testing implications

- Target tests begin from empty or explicitly seeded version-1 state.
- Contract tests exercise only the target wire and explicit version mismatch.
- Migration and deprecated-shape tests are deleted with their implementation.
- Clean-start tests prove default state is intentional and complete.
- Corruption tests prove strict rejection or the domain's current recovery policy without legacy
  coercion.
- Repository-wide search proves removed procedure names, fields, paths, and adapters have no runtime
  callers.
- Resilience tests remain and are renamed where “fallback” obscures their permanent responsibility.

## Rationale

- No public user or released client requires pre-launch compatibility.
- One code and data path makes the new architecture teachable and mechanically enforceable.
- Canonical product vocabulary can reach contracts and persisted state without permanent aliases.
- Fresh versioning prepares the first release for future compatibility decisions without implementing
  speculative migrations now.
- Explicit classification prevents a cleanup slogan from deleting real recovery or security.
- Atomic domain cutovers keep incremental development workable without institutionalizing dual paths.

## Rejected alternatives

- **Preserve all existing data and wire formats.** Development history becomes permanent product
  complexity before any public promise exists.
- **Remove every function described as fallback.** Real disconnects, missing resources, corrupt
  input, and platform failures become crashes or stale state.
- **Support old and new until after launch.** There is no clear deletion event, so the dual path is
  likely to ship.
- **Add a general migration framework now.** Speculative infrastructure precedes the first stable
  persisted format.
- **Silently reset incompatible data at startup.** Human-authored local work can disappear without an
  explicit destructive decision.
- **Perform one repository-wide big-bang rewrite.** Domain-atomic cutovers can preserve buildability
  and proof while still ending with one path.
- **Omit format and protocol versions because this is version one.** The first post-launch evolution
  would have no reliable boundary for detecting mismatch.

## Consequences

- Earlier compatibility clauses are superseded and must be annotated or amended during plan cleanup.
- Procedure, event, CLI, and persisted vocabulary can be renamed to the canonical inventory target.
- Migration inventory must classify every current migration, deprecated field, fallback branch,
  alias, and compatibility test as delete, resilience, product default, or temporary scaffolding.
- Domain specifications become cross-package atomic units more often because no old client path
  remains after completion.
- Development data will eventually reset to target version-1 state through a separately reviewed
  specification.
- A post-launch compatibility policy is intentionally deferred until the first stable public format
  exists.

## Enforcement and proof

Architecture gates should reject deprecated target names, dual-path imports, unversioned persisted
roots, local schema mirrors, and completed-domain legacy allowlist entries. Exact forbidden-name and
path lists come from the exhaustive inventory and disappear when a more structural rule replaces
them.

The clean cutover is complete only when every target domain starts from version-1 seed data, every
repository-owned client speaks the exact target protocol, old names and migration code have no runtime
references, compatibility-only tests are gone, and resilience behavior remains covered under its
permanent architectural owner.
