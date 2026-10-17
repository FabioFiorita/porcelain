import { ENVIRONMENT_PROTOCOL } from '@porcelain/contracts/shared';
import type { ReadEnvironmentResponse } from '@porcelain/contracts/access';
import * as Redacted from 'effect/Redacted';
import * as Schema from 'effect/Schema';

export type RemoteAnswer =
  | { kind: 'described'; environment: ReadEnvironmentResponse }
  | { kind: 'foreign' }
  | { kind: 'unauthorized' }
  | { kind: 'unreachable' }
  | { kind: 'reconnecting' };

const connectionRouteSchema = Schema.Struct({
  address: Schema.String,
  credential: Schema.RedactedFromValue(Schema.String),
  deviceId: Schema.optional(Schema.String),
});
export type ConnectionRoute = typeof connectionRouteSchema.Type;
const remoteSchema = Schema.Struct({
  ...connectionRouteSchema.fields,
  environmentId: Schema.String,
  name: Schema.String,
  alternateRoutes: Schema.optional(Schema.Array(connectionRouteSchema)),
  operationIdentity: Schema.optional(Schema.String),
});
export type Remote = typeof remoteSchema.Type;

function routeFields({
  address,
  credential,
  deviceId,
}: ConnectionRoute): ConnectionRoute {
  return { address, credential, ...(deviceId ? { deviceId } : {}) };
}

export function connectionRoutes(
  remote: ConnectionRoute & {
    readonly alternateRoutes?: readonly ConnectionRoute[] | undefined;
  },
): readonly ConnectionRoute[] {
  return [
    routeFields(remote),
    ...(remote.alternateRoutes ?? []).map(routeFields),
  ];
}

export function operationJournalKey(remote: Remote): string | undefined {
  return (
    remote.operationIdentity ??
    (remote.deviceId
      ? JSON.stringify([remote.environmentId, remote.address, remote.deviceId])
      : undefined)
  );
}

export function withConnectionRoutes(
  remote: Remote,
  routes: readonly ConnectionRoute[],
): Remote {
  const [first, ...rest] = routes;
  if (!first)
    throw new Error('A saved environment needs at least one connection.');
  return {
    environmentId: remote.environmentId,
    name: remote.name,
    ...routeFields(first),
    ...(operationJournalKey(remote)
      ? { operationIdentity: operationJournalKey(remote) }
      : {}),
    ...(rest.length ? { alternateRoutes: rest.map(routeFields) } : {}),
  };
}

export function connectionRouteTitle(address: string): string {
  const host = URL.parse(address)?.hostname ?? '';
  return host.endsWith('.ts.net')
    ? 'Tailscale'
    : /^(10\.|192\.168\.|172\.(1[6-9]|2\d|3[01])\.)/.test(host)
      ? 'LAN'
      : 'Network';
}

export function serializeRemotes(remotes: readonly Remote[]): string {
  return JSON.stringify(Schema.encodeSync(Schema.Array(remoteSchema))(remotes));
}

export type RemoteStatus =
  | { kind: 'checking' }
  | { kind: 'reconnecting' }
  | { kind: 'online'; name: string; version?: string | undefined }
  | { kind: 'offline' }
  | { kind: 'needs-pairing' }
  | { kind: 'other-server' }
  | { kind: 'incompatible' };

export function remoteStatus(
  remote: Pick<Remote, 'environmentId'>,
  answer: RemoteAnswer | undefined,
): RemoteStatus {
  if (answer === undefined) return { kind: 'checking' };
  if (answer.kind === 'reconnecting') return { kind: 'reconnecting' };
  if (answer.kind === 'foreign') return { kind: 'other-server' };
  if (answer.kind === 'unauthorized') return { kind: 'needs-pairing' };
  if (answer.kind === 'unreachable') return { kind: 'offline' };
  const { environment } = answer;
  if (environment.environmentId !== remote.environmentId)
    return { kind: 'other-server' };
  if (environment.protocol !== ENVIRONMENT_PROTOCOL)
    return { kind: 'incompatible' };
  return {
    kind: 'online',
    name: environment.name,
    version: environment.version,
  };
}

function text(value: object, key: string): string | undefined {
  const field: unknown = Reflect.get(value, key);
  return typeof field === 'string' ? field : undefined;
}

function savedRoute(value: unknown): ConnectionRoute | undefined {
  if (!value || typeof value !== 'object') return undefined;
  const address = text(value, 'address');
  const credential = text(value, 'credential');
  const deviceId = text(value, 'deviceId');
  return address && credential
    ? {
        address,
        credential: Redacted.make(credential),
        ...(deviceId ? { deviceId } : {}),
      }
    : undefined;
}

function savedRemote(value: unknown): Remote[] {
  if (!value || typeof value !== 'object') return [];
  const environmentId = text(value, 'environmentId');
  const name = text(value, 'name');
  const route = savedRoute(value);
  const alternatives: unknown = Reflect.get(value, 'alternateRoutes');
  return environmentId && name !== undefined && route
    ? [
        {
          environmentId,
          name,
          ...route,
          ...(text(value, 'operationIdentity')
            ? { operationIdentity: text(value, 'operationIdentity') }
            : {}),
          ...(Array.isArray(alternatives)
            ? {
                alternateRoutes: alternatives.flatMap((value: unknown) => {
                  const saved = savedRoute(value);
                  return saved ? [saved] : [];
                }),
              }
            : {}),
        },
      ]
    : [];
}

export function parseRemotes(value: unknown): Remote[] {
  return Array.isArray(value) ? value.flatMap(savedRemote) : [];
}

export function withRemote(remotes: readonly Remote[], remote: Remote) {
  const previous = remotes.find(
    (entry) => entry.environmentId === remote.environmentId,
  );
  if (!previous) return [...remotes, remote];
  const incoming = connectionRoutes(remote);
  const routes = connectionRoutes(previous).map(
    (route) => incoming.find((next) => next.address === route.address) ?? route,
  );
  routes.push(
    ...incoming.filter(
      (route) => !routes.some((saved) => saved.address === route.address),
    ),
  );
  return [
    ...remotes.filter((entry) => entry.environmentId !== remote.environmentId),
    withConnectionRoutes({ ...previous, name: remote.name }, routes),
  ];
}

const sameCredential = Redacted.makeEquivalence<string>(
  (left, right) => left === right,
);

export function sameRemoteConnection(left: Remote, right: Remote): boolean {
  return (
    left.environmentId === right.environmentId &&
    left.address === right.address &&
    sameCredential(left.credential, right.credential) &&
    left.deviceId === right.deviceId &&
    (left.alternateRoutes ?? []).length ===
      (right.alternateRoutes ?? []).length &&
    (left.alternateRoutes ?? []).every((route, index) => {
      const other = right.alternateRoutes?.[index];
      return (
        other !== undefined &&
        route.address === other.address &&
        route.deviceId === other.deviceId &&
        sameCredential(route.credential, other.credential)
      );
    })
  );
}

export function remoteStatusText(status: RemoteStatus): string {
  switch (status.kind) {
    case 'checking':
      return 'Checking';
    case 'reconnecting':
      return 'Reconnecting';
    case 'online':
      return 'Online';
    case 'offline':
      return 'Offline';
    case 'needs-pairing':
      return 'Needs pairing';
    case 'other-server':
      return 'Another server';
    case 'incompatible':
      return 'Update needed';
  }
}

export function remoteStatusNote(status: RemoteStatus): string | undefined {
  switch (status.kind) {
    case 'offline':
      return 'It did not answer. Check that it runs and that this device reaches its address.';
    case 'needs-pairing':
      return 'It no longer accepts this app. Run porcelain pair on it and add the new link.';
    case 'other-server':
      return 'Another Porcelain answers at this address now, so this app stays away from it.';
    case 'incompatible':
      return 'It runs a Porcelain this app cannot talk to. Update both to the same version.';
    default:
      return undefined;
  }
}
