import type { DesktopCredentials } from '@porcelain/contracts/desktop';
import {
  parseRemotes,
  type Remote,
  type RemoteStatus,
} from '@porcelain/client/access/rules';
export {
  parseRemotes,
  remoteStatus,
  withRemote,
  type Remote,
} from '@porcelain/client/access/rules';
export { remoteLink } from '@porcelain/client/access/rules';

export function remoteStatusVariant(status: RemoteStatus) {
  if (status.kind === 'online') return 'secondary';
  if (status.kind === 'checking') return 'outline';
  return 'destructive';
}

export function remoteLiveOpen(status: RemoteStatus, desktop: boolean) {
  return desktop && status.kind === 'online';
}

export function remoteKey(
  remote: Pick<Remote, 'environmentId' | 'credential'>,
) {
  return `${remote.environmentId}:${remote.credential}`;
}

export function syncRemoteConnections<Connection>(
  remotes: readonly Remote[],
  current: readonly { remote: Remote; connection: Connection }[],
  open: (remote: Remote) => Connection,
) {
  const next = remotes.map((remote) => {
    const kept = current.find(
      (entry) =>
        entry.remote.environmentId === remote.environmentId &&
        entry.remote.address === remote.address &&
        entry.remote.credential === remote.credential,
    );
    return { remote, connection: kept ? kept.connection : open(remote) };
  });
  const closed = current
    .filter(
      (entry) => !next.some((kept) => kept.connection === entry.connection),
    )
    .map((entry) => entry.connection);
  return { next, closed };
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

type SavedRemotes =
  | { kind: 'readable'; remotes: Remote[] | undefined }
  | { kind: 'unreadable'; message: string };

export function savedRemotes(saved: DesktopCredentials): SavedRemotes {
  if (saved.status === 'unreadable')
    return { kind: 'unreadable', message: saved.message };
  if (saved.status === 'empty') return { kind: 'readable', remotes: undefined };
  try {
    return { kind: 'readable', remotes: parseRemotes(JSON.parse(saved.value)) };
  } catch {
    return {
      kind: 'unreadable',
      message: 'The saved remote computers are not in a form this app reads.',
    };
  }
}
