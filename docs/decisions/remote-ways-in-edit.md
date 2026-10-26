# Edit another computer's ways in

Status: proposed for 0.72.0; implementation waits for approval. This is a design sketch, with TypeScript signatures and throwing stubs inside this document. Nothing is wired into the application. The stubs must not ship as an implementation.

## Decision

Give an already paired device a separate, owner-granted permission to edit this computer's ways in. Keep `trusted` as permission to update the service. Use the existing remote-access settings owner and route reconciliation, and keep pairing, device revocation, trust, naming and MCP behind their existing boundaries.

The public contract changes and the database migration below need approval. No production contract, migration, dependency or policy is changed by this sketch.

## Grounding

At the design base, `packages/contracts/src/access/api.ts` puts GET/PATCH `/api/remote-access` in the administration group shared by host and owner. `apps/server/src/http/scopes/host.ts` requires authentication and a local request; `owner.ts` relies on the private Unix listener. The paired TCP scope never includes owner MCP.

`SetRemoteAccessUseCase` owns the remote-access lane, commits settings through `SetRemoteAccessService`, closes invalid tunnel connections and schedules `OpenRemoteRoutesService`. The latter also persists an allocated Tailscale port: it is an existing writer that must stay inside the same settings lane. `RemoteAccessStore` owns persisted settings; `RouteStateStore` owns observed status. Requested settings and observed reachability are different facts.

`AuthorizeServiceUpdateService` checks `trusted` for updates only. `RevokeAccessUseCase` and `SetDeviceTrustUseCase` use the access lane. Device authentication binds credentials to a route class, and revocation closes that device's connections. A forwarded loopback socket is not evidence of local ownership.

Web `RemoteAccessGate` currently interprets any successful remote-access read as permission to show naming, pairing and devices. That inference must be removed when remote reads become possible. Desktop remote settings currently show saved addresses in `SavedWaysIn`; mobile's `ThisComputer` and `EnvironmentConnections` do not administer server listeners. Saved client connections must remain distinct from server ways in.

## Usage first

These are the three intended caller boundaries. The relative imports below refer to the sketch modules in subsequent sections; implementation will move them to their named owners.

### `usage.ts`

```ts
import { Effect } from 'effect';
import { AtomRegistry } from 'effect/reactivity';
import type { RuntimeConnection } from '@porcelain/client/transport';
import { setRemoteAccess } from './client.ts';
import { SetRemoteAccessUseCase } from './server.ts';
import { SetWaysInPermissionUseCase } from './permission.ts';
import type { Editor, EditRequest, RequestAuthority } from './contract.ts';

export function saveWaysIn(
  registry: AtomRegistry.AtomRegistry,
  connection: RuntimeConnection,
  editor: Editor,
) {
  registry.set(setRemoteAccess(connection), {
    expected: editor.editing.fingerprint,
    change: {
      cloudflare: true,
      cloudflareHostname: 'porcelain.example.com',
    },
  });
}

export const patchWaysIn = Effect.fn('PatchWaysIn')(function* (
  authority: RequestAuthority,
  payload: EditRequest,
) {
  const operation = yield* SetRemoteAccessUseCase;
  return yield* operation.execute({ authority, change: payload });
});

export const allowWaysInEditing = Effect.fn('AllowWaysInEditing')(function* (
  deviceId: string,
) {
  const operation = yield* SetWaysInPermissionUseCase;
  return yield* operation.execute({ id: deviceId, allowed: true });
});
```

The first caller is shared by web/desktop and native view adapters. The second runs after authentication, origin policy and local recognition; `authority` comes from `RequestCaller` and `RequestConnection`, never JSON. The third is reachable only through the owner listener or authenticated local-host scope. It grants no permission to the caller to grant permissions remotely.

## Chosen shape: direct, explicitly delegated editing

### `contract.ts`

```ts
import { Schema } from 'effect';
import {
  readRemoteAccessResponseSchema,
  setRemoteAccessRequestSchema,
} from '../../packages/contracts/src/access/remote-access.ts';
import { deviceRouteSchema } from '../../packages/contracts/src/access/pairing.ts';
import { principalSchema } from '../../packages/contracts/src/access/principal.ts';

const fingerprintSchema = Schema.String.check(
  Schema.isPattern(/^[a-f0-9]{64}$/),
).pipe(Schema.brand('WaysInSettingsFingerprint'));

export const editorSchema = Schema.Struct({
  ...readRemoteAccessResponseSchema.fields,
  editing: Schema.Struct({
    fingerprint: fingerprintSchema,
    protectedRoute: Schema.NullOr(
      Schema.Literals(['lan', 'tailnet', 'cloudflare']),
    ),
  }),
});

export const editRequestSchema = Schema.Struct({
  expected: fingerprintSchema,
  change: setRemoteAccessRequestSchema,
});

export const waysInPermissionSchema = Schema.Struct({
  id: Schema.String.check(Schema.isUUID()),
  allowed: Schema.Boolean,
});

export const requestAuthoritySchema = Schema.Struct({
  viewer: principalSchema,
  local: Schema.Boolean,
  route: deviceRouteSchema,
});

export class WaysInPermissionRequiredError extends Schema.TaggedError<WaysInPermissionRequiredError>()(
  'WaysInPermissionRequiredError',
  {},
) {}

export class WaysInChangedError extends Schema.TaggedError<WaysInChangedError>()(
  'WaysInChangedError',
  {},
) {}

export class RemoteRouteInUseError extends Schema.TaggedError<RemoteRouteInUseError>()(
  'RemoteRouteInUseError',
  {},
) {}

export type Editor = typeof editorSchema.Type;
export type EditRequest = typeof editRequestSchema.Type;
export type WaysInPermission = typeof waysInPermissionSchema.Type;
export type RequestAuthority = typeof requestAuthoritySchema.Type;
```

Wire schemas belong in `packages/contracts/src/access/remote-access.ts`; the permission request belongs beside device administration. The sketch references current canonical schemas by repository-relative paths, because they are not all public exports. Implementation uses local imports inside their owner and updates the public exports for consumers. Authority and permission business models/errors belong in `packages/access`, with the contracts importing their canonical schemas. `requestAuthoritySchema` illustrates the internal boundary only; it is not an HTTP payload or a second principal.

GET/PATCH keep their existing paths but move into one `remoteAccess` API group. On TCP that group joins the paired scope with `recognizeLocalRequest` and the existing Bearer-only cross-origin policy. Owner composes the same handlers privately, passing an owner principal and loopback connection. All remaining administration stays host/owner only. Do not relax `requireLocalDevice`, compose owner into TCP, or keep a second host PATCH handler.

GET returns `Editor` only to an owner, a currently usable local device, or a currently usable device with explicit ways-in permission. Denied paired callers receive 403 without LAN/router/hostname metadata and retain their saved-address view. Invalid, expired, route-mismatched or revoked credentials receive 401. GET success grants no pairing, naming or device-list authority. Those controls keep a separate local-host gate.

PATCH replaces the flat request with `{ expected, change }` and returns `Editor`. It retains existing hostname/network validation errors, adds 403 `WaysInPermissionRequiredError`, and uses 409 for `WaysInChangedError` and `RemoteRouteInUseError`. These error responses contain no current configuration. A permission denial clears retained privileged query data. A 409 requires a fresh read and another explicit save, never an automatic replay.

### `domain.ts`

```ts
import { Context, Effect, Layer } from 'effect';
import { DeviceStore } from '@porcelain/access/ports';
import type { DeviceNotFoundError } from '@porcelain/access/errors';
import type {
  RequestAuthority,
  WaysInPermission,
  WaysInPermissionRequiredError,
} from './contract.ts';

export class AuthorizeWaysInService extends Context.Service<
  AuthorizeWaysInService,
  {
    readonly execute: (
      input: RequestAuthority,
    ) => Effect.Effect<void, WaysInPermissionRequiredError>;
  }
>()('@porcelain/access/AuthorizeWaysInService') {
  static readonly layer = Layer.effect(
    AuthorizeWaysInService,
    Effect.gen(function* () {
      yield* DeviceStore;
      return {
        execute: Effect.fn('AuthorizeWaysInService.execute')(
          (_input: RequestAuthority): Effect.Effect<void, WaysInPermissionRequiredError> => {
            throw new Error('not implemented');
          },
        ),
      };
    }),
  );
}

export class SetWaysInPermissionService extends Context.Service<
  SetWaysInPermissionService,
  {
    readonly execute: (
      input: WaysInPermission,
    ) => Effect.Effect<WaysInPermission, DeviceNotFoundError>;
  }
>()('@porcelain/access/SetWaysInPermissionService') {
  static readonly layer = Layer.effect(
    SetWaysInPermissionService,
    Effect.gen(function* () {
      yield* DeviceStore;
      return {
        execute: Effect.fn('SetWaysInPermissionService.execute')(
          (_input: WaysInPermission): Effect.Effect<WaysInPermission, DeviceNotFoundError> => {
            throw new Error('not implemented');
          },
        ),
      };
    }),
  );
}
```

The implementation resolves its ports in the Layer and exposes one named `Effect.fn` execute operation. Every device path rechecks current usability and permission after acquiring the lanes, including a locally authenticated device revoked while queued. Owner is the only principal without a device record. Use the existing device-lifetime rules and clock; an HTTP identity is not a cached permission grant. A nonlocal loopback-class request is denied rather than treated as owner.

Add `canEditWaysIn` to the existing device model/store with a database column defaulting to false. Existing devices, trusted devices and newly redeemed pairings start false. No pairing-code field or inherited grant is added. Add host/owner-only POST `/access/ways-in-permission` (TCP prefix `/api`) with `WaysInPermission`; device listings report the stored bit. Its use case writes under the access lane and refuses missing/revoked devices. Existing trust operations never modify it. Device revocation makes it unusable immediately; there is no second credentials store.

### `server.ts`

```ts
import { Context, Effect, Layer } from 'effect';
import {
  ReadRemoteAccessService,
  SetRemoteAccessService,
  OpenRemoteRoutesService,
  CloseTunnelConnectionsService,
  ReadEnvironmentService,
} from '@porcelain/access/services';
import type { SetRemoteAccessRequest } from '@porcelain/contracts/access';
import { AuthorizeWaysInService } from './domain.ts';
import type {
  Editor,
  EditRequest,
  RequestAuthority,
  WaysInChangedError,
  WaysInPermissionRequiredError,
  RemoteRouteInUseError,
} from './contract.ts';

type ExistingValidationFailure = Effect.Error<
  ReturnType<SetRemoteAccessService['Service']['execute']>
>;

export class ReadRemoteAccessUseCase extends Context.Service<
  ReadRemoteAccessUseCase,
  {
    readonly execute: (
      authority: RequestAuthority,
    ) => Effect.Effect<Editor, WaysInPermissionRequiredError>;
  }
>()('@porcelain/server/ReadRemoteAccessUseCase') {
  static readonly layer = Layer.effect(
    ReadRemoteAccessUseCase,
    Effect.gen(function* () {
      yield* AuthorizeWaysInService;
      yield* ReadRemoteAccessService;
      throw new Error('not implemented');
    }),
  );
}

export class SetRemoteAccessUseCase extends Context.Service<
  SetRemoteAccessUseCase,
  {
    readonly execute: (input: {
      authority: RequestAuthority;
      change: EditRequest;
    }) => Effect.Effect<
      Editor,
      | ExistingValidationFailure
      | WaysInPermissionRequiredError
      | WaysInChangedError
      | RemoteRouteInUseError
    >;
  }
>()('@porcelain/server/SetRemoteAccessUseCase') {
  static readonly layer = Layer.effect(
    SetRemoteAccessUseCase,
    Effect.gen(function* () {
      yield* AuthorizeWaysInService;
      yield* SetRemoteAccessService;
      yield* OpenRemoteRoutesService;
      yield* CloseTunnelConnectionsService;
      yield* ReadEnvironmentService;
      throw new Error('not implemented');
    }),
  );
}

export function protectIngress(
  authority: RequestAuthority,
  change: SetRemoteAccessRequest,
): Effect.Effect<void, RemoteRouteInUseError> {
  throw new Error('not implemented');
}
```

The existing use cases acquire both access and remote-access lanes before authorizing and reading or committing; bootstrap supplies existing `Lanes` and `LaneKeys`. No caller does a separate authorize-then-write sequence. PATCH checks permission, the snapshot fingerprint, and ingress protection before calling the existing settings service. Fingerprint calculation and comparison share one access-domain owner and the same locked snapshot as the returned view.

The fingerprint is an opaque digest of canonical persisted settings and the host's observed LAN identity relevant to enabling LAN, not of polling status. It is not an authorization token. It avoids another persisted revision counter. A changed network forces a fresh read before pinning LAN. Read captures that network and the view coherently; write must validate and use the same captured host network, rather than sample it again after comparison. Interface name/subnet alone are insufficient: retain the existing router hardware identity check.

Revocation and permission changes serialize against the commit through the access lane. If revocation wins, no settings save occurs; if a save commits first, revocation blocks subsequent operations and does not roll the committed change back. Background reconciliation keeps its existing remote-access lane, never nests acquisition of access inside it, and cannot bypass the settings owner. The Tailscale port write also changes the fingerprint; a conservative conflict is acceptable. Local CLI/owner callers use the same new request and snapshot rule; remove the old flat payload at every caller.

For a nonlocal request, reject any supplied field belonging to its ingress route: `lan` on LAN, `tailnet` or `tailnetHostname` on Tailscale, and `cloudflare` or `cloudflareHostname` on a tunnel. Map server route `tunnel` to settings key `cloudflare` in one domain rule. The protected route is returned by GET for explanation; the server recomputes it on PATCH. Local/owner edits may change every route. To change the protected route remotely, first use another already paired route; credentials do not transfer between route classes.

This prevents a requested cut-off, not arbitrary network failure. Saved is distinct from reachable: the response can still say starting, paused or failed. Reuse the existing listener/probe owners, and prove that editing another route does not unnecessarily replace the ingress listener or invalidate its tunnel connection. A lost response has an unknown outcome: refresh through the existing connection flow, show confirmed server settings when reachable, and do not automatically resend. Back leaves Settings without forgetting the computer; local-owner controls remain the recovery path if every remote route becomes unavailable.

### `permission.ts`

```ts
import { Context, Effect, Layer } from 'effect';
import { SetWaysInPermissionService } from './domain.ts';
import type { DeviceNotFoundError } from '@porcelain/access/errors';
import type { WaysInPermission } from './contract.ts';

export class SetWaysInPermissionUseCase extends Context.Service<
  SetWaysInPermissionUseCase,
  {
    readonly execute: (
      input: WaysInPermission,
    ) => Effect.Effect<WaysInPermission, DeviceNotFoundError>;
  }
>()('@porcelain/server/SetWaysInPermissionUseCase') {
  static readonly layer = Layer.effect(
    SetWaysInPermissionUseCase,
    Effect.gen(function* () {
      yield* SetWaysInPermissionService;
      throw new Error('not implemented');
    }),
  );
}
```

The permission-write domain service owns the bit through `DeviceStore`, following `SetDeviceTrustService`. The server use case supplies the access lane and resolves that service. Extend the existing store capability; do not introduce a parallel grant registry.

### `client.ts`

```ts
import type { RuntimeConnection } from '@porcelain/client/transport';
import type { ConnectionError, RequestError } from '@porcelain/client/transport';
import type { Atom } from 'effect/reactivity';
import type { Editor, EditRequest } from './contract.ts';

export function setRemoteAccess(
  connection: RuntimeConnection,
): Atom.AtomResultFn<EditRequest, Editor, ConnectionError | RequestError> {
  throw new Error('not implemented');
}
```

This replaces the existing shared command's request type, queue and snapshot result, with no second write path. Keep `readRemoteAccess` and its settling poll in the same shared owner. The client distinguishes permission-required, unsupported protocol, unreachable, loading, failure and current editor data. It refreshes on Settings entry, retry and reconnect; it never interprets a stale success as current permission. Views consume the existing atom runtime; no shell stores another configuration copy.

Web browser Settings shows only the computer in that link. Desktop Settings opens a selected paired computer's live editor; mobile adds the same editor to the selected computer's detail. Existing Add/Prefer/Remove connection actions still edit saved client routes only. No new sidebar, context-menu or keyboard entry point is proposed. The permission toggle appears only in the local computer's paired-device controls, separate from service-update trust. Both local and remote views explain the protected route and preserve existing route labels and accessibility names.

## Contract and migration decision

1. Migrate `devices.can_edit_ways_in` with default false. Map missing legacy state to false, never from `trusted`. Restore/restart must preserve explicit permission and revocation.
2. Replace GET/PATCH schemas, split `remoteAccess` out of administration, and add the host/owner permission command. Migrate generated clients, CLI and fixture callers together; delete the old flat PATCH shape and shared remote-read-as-host-authority inference.
3. Bump `ENVIRONMENT_PROTOCOL` from 2 to 3 because the PATCH payload and required GET result change. Existing remote connection/pairing checks already require protocol equality. Older/newer/unknown protocol disables editing with a compatibility explanation. Check the plain-browser restoration path too; equality checks on remote discovery alone are insufficient. No client guesses permission from a version string or retries the old payload.

## Alternative screened and rejected

Shape B stores a proposed edit and waits for a local owner to approve each exact proposal. Its data is `Proposal = { id, deviceId, expected, change, expiresAt, state: pending | accepted | rejected | expired }`; `submit(change): Effect<Proposal>`, `decide(id, accept): Effect<Proposal>` and `read(id): Effect<Proposal>` would each have throwing bodies in a sketch. The owner decides and applies through the existing settings use case. The device never gets ongoing edit authority.

This is structurally different: an owner-mediated workflow, rather than a delegated operation. It reduces standing authority but requires proposal persistence, expiry, owner notification, a decision surface and result observation. It also makes remote editing unavailable while no owner is present. None of those owners exist for ways in, so it loses to the smaller permission and existing writer. No runtime prototype distinguishes these trust/workflow choices; no listener or device experiment was run to make the choice.

| Red flag | Direct delegation | Owner-approved proposals |
| --- | --- | --- |
| Several caller calls for one operation | One PATCH; host-only grant is a separate administration operation | Submit, notify, decide and observe |
| Internal detail shared across modules | Domain owns permission, fingerprint and ingress mapping; views receive explanation | Exact proposal identity/expiry crosses several consumers |
| State with multiple writers | Existing settings services under one lane; one device permission store | Adds proposal lifecycle plus existing settings writer |
| Two ways to do the same task | One GET/PATCH handler used by owner, host and delegate | Proposed edit and immediate local edit must converge |
| Importable internals | Existing package exports and injected services only | Requires a new exported proposal boundary |
| Hand-maintained list | One route mapping in domain, checked exhaustively | Adds status transitions/expiry coordination |

Accepted tradeoffs: local opt-in is required; permission persists until removed; remote callers cannot edit their ingress route; stale saves fail rather than merge; a protocol bump requires coordinated app/server updates. These are recommendations for approval, not shipped guarantees.

## Deliberate exclusions

No remote pairing, permission delegation, trust editing, rename, revoke, MCP exposure, service-update permission change, arbitrary shell execution, tunnel process installation/configuration, OS firewall control, credential transfer, automatic connection enrollment, offline edits, deferred proposals, rollback timer or guaranteed reachability. Existing Tailscale Serve and cloudflared setup remain host-side tasks. No existing device gains authority through upgrade.

## Open questions

1. Permission owner: approve a separate persistent device permission, default false, rather than broadening service-update trust? Recommendation: separate permission.
2. Route protection: approve rejecting edits to the route carrying a remote request, including hostname changes and LAN repinning? Recommendation: reject and explain how to reconnect through a separately paired route.
3. Contract: approve protocol 3 and the default-false device-column migration as one coordinated rollout? Recommendation: fail closed on mixed protocols, with compatibility UI and a browser-restoration check.

## Verification matrix for implementation

These are design obligations, not executed runtime evidence. Every surface cell is N/A for this unwired sketch; the implementation must execute the applicable rows on web 1440/414, desktop and Android, plus iOS when available.

| State | Expected | web 1440 | web 414 | desktop | Android | Test (file:case) | Result |
| --- | --- | --- | --- | --- | --- | --- | --- |
| Owner / usable local device | All ways editable; other administration remains local | N/A | N/A | N/A | N/A | Planned access-owner / host-authority controls | Specified |
| Paired permission false or absent, with either trust value | 403, no privileged metadata, no write | N/A | N/A | N/A | N/A | Planned ways-in authorization table | Specified |
| Paired permission true, trusted false/true | Edit other routes on LAN, Tailscale and tunnel | N/A | N/A | N/A | N/A | Planned HTTP positive controls per route | Specified |
| Unpaired, unknown, idle-expired, revoked, wrong-route credential | 401, no settings/permission mutation | N/A | N/A | N/A | N/A | Planned HTTP negative controls | Specified |
| Revoke or permission removal races queued save, including local device | Recheck in lanes; ordered commit or denial | N/A | N/A | N/A | N/A | Planned real-store lane race | Specified |
| Self-grant, forwarded loopback, cross-origin cookie write, TCP owner MCP | Denied; Bearer delegate may edit only its allowed resource | N/A | N/A | N/A | N/A | Planned scope/origin sweep | Specified |
| Every route off / starting / on / paused / failed | Render requested and observed facts; no promise of reachability | N/A | N/A | N/A | N/A | Planned all status and failure-reason table | Specified |
| Empty/invalid/oversized hostname; missing hostname/network/router identity | Existing schema/domain rejection; no save | N/A | N/A | N/A | N/A | Planned existing validation controls | Specified |
| Ingress field supplied, hostname edit or LAN repin | 409 for remote; local owner can recover | N/A | N/A | N/A | N/A | Planned ingress table and listener continuity | Specified |
| Host network changes, another edit, Tailscale allocation, double submit | Fresh fingerprint conflict; explicit reread/save | N/A | N/A | N/A | N/A | Planned coherent snapshot/CAS controls | Specified |
| Timeout, offline, partial reconciliation failure, lost response, retry | Unknown outcome or failed status; refresh, no blind replay | N/A | N/A | N/A | N/A | Planned transport recovery journey | Specified |
| Permission removed while view retains success | Clear privileged data on denial; never enable from stale answer | N/A | N/A | N/A | N/A | Planned query refresh/retention controls | Specified |
| First run, no saved routes, absent optional metadata | Disabled/explanatory empty states; local pairing recovery | N/A | N/A | N/A | N/A | Planned empty-state journey | Specified |
| Equal / older / newer / unknown protocol; varied release versions | Only equal protocol edits; version offer unrelated | N/A | N/A | N/A | N/A | Planned remote + browser compatibility controls | Specified |
| Long names/URLs, many computers, narrow width, light/dark, keyboard/touch | Reachable labelled controls, readable errors and way back | N/A | N/A | N/A | N/A | Planned surface/accessibility proof | Specified |
| Restart, legacy database, restore, revoked device retained | Default false or preserved explicit bit; trust never promotes | N/A | N/A | N/A | N/A | Planned migration/restore controls | Specified |

No behavioral tests are added for throwing signatures. Extract and typecheck the TypeScript blocks, inspect the diff for production changes, and run the normal static gate. Runtime, native, physical LAN/Tailscale/Cloudflare and recovery guarantees remain unproven until implementation.
