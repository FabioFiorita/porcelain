import type { DesktopCredentials } from '@porcelain/contracts/desktop';
import {
  parseRemotes,
  type Remote,
  type RemoteStatus,
} from '@porcelain/client/access/rules';

export function remoteStatusVariant(status: RemoteStatus) {
  if (status.kind === 'online') return 'secondary';
  if (status.kind === 'checking') return 'outline';
  return 'destructive';
}

export function remoteLiveOpen(status: RemoteStatus, desktop: boolean) {
  return desktop && status.kind === 'online';
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
