import { ENVIRONMENT_PROTOCOL } from '@porcelain/contracts/shared';
import type { ReadEnvironmentResponse } from '@porcelain/contracts/access';
import { Redacted, Schema } from 'effect';

export type RemoteAnswer =
  | { kind: 'described'; environment: ReadEnvironmentResponse }
  | { kind: 'unauthorized' }
  | { kind: 'unreachable' };

const remoteSchema = Schema.Struct({
  environmentId: Schema.String,
  name: Schema.String,
  address: Schema.String,
  credential: Schema.RedactedFromValue(Schema.String),
  deviceId: Schema.optional(Schema.String),
});
export type Remote = typeof remoteSchema.Type;

// This codec is the browser/desktop storage boundary. In-memory remotes stay
// redacted; the persisted JSON remains the format existing installations read.
export function serializeRemotes(remotes: readonly Remote[]): string {
  return JSON.stringify(Schema.encodeSync(Schema.Array(remoteSchema))(remotes));
}

export type RemoteStatus =
  | { kind: 'checking' }
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

function savedRemote(value: unknown): Remote[] {
  if (!value || typeof value !== 'object') return [];
  const environmentId = text(value, 'environmentId');
  const name = text(value, 'name');
  const address = text(value, 'address');
  const credential = text(value, 'credential');
  const deviceId = text(value, 'deviceId');
  return environmentId && name !== undefined && address && credential
    ? [
        {
          environmentId,
          name,
          address,
          credential: Redacted.make(credential),
          ...(deviceId ? { deviceId } : {}),
        },
      ]
    : [];
}

export function parseRemotes(value: unknown): Remote[] {
  return Array.isArray(value) ? value.flatMap(savedRemote) : [];
}

export function withRemote(remotes: readonly Remote[], remote: Remote) {
  return [
    ...remotes.filter((entry) => entry.environmentId !== remote.environmentId),
    remote,
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
    left.deviceId === right.deviceId
  );
}

export function remoteStatusText(status: RemoteStatus): string {
  switch (status.kind) {
    case 'checking':
      return 'Checking';
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
      return 'It did not answer. Check that it runs and that this computer reaches its address.';
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
