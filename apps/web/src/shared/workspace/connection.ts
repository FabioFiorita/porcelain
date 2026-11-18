import { useAtomValue } from '@effect/atom-react';
import { Atom } from 'effect/reactivity';
import type { RemoteStatus } from '@porcelain/client/access/rules';
import type { EnvironmentConnection } from '@porcelain/client/access';

export type Connection = EnvironmentConnection;

export type ConnectionContext = {
  connection: Connection;
  remoteStatus?: Atom.Atom<RemoteStatus> | undefined;
};

const localOnline = Atom.make(true);
const remoteOnline = Atom.family((status: Atom.Atom<RemoteStatus>) =>
  status.pipe(Atom.map(({ kind }) => kind === 'online')),
);

export function workspaceWriteAvailability({
  remoteStatus,
}: ConnectionContext) {
  return remoteStatus ? remoteOnline(remoteStatus) : localOnline;
}

export function useWorkspaceWriteBlock(context: ConnectionContext) {
  return useAtomValue(workspaceWriteAvailability(context))
    ? undefined
    : 'Computer is offline';
}

export function requireConnection(connection: Connection | null): Connection {
  if (!connection) throw new Error('A connected environment is required');
  return connection;
}
