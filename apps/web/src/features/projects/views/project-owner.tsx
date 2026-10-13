import type { ReactNode } from 'react';
import { Cause } from 'effect';
import { AsyncResult } from 'effect/reactivity';
import type { RemoteConnection } from '@porcelain/client/access';
import {
  connectionErrorMessage,
  remoteStatusNote,
  remoteStatusText,
} from '@porcelain/client/access/rules';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { useRemoteConnection, useRemoteStatus } from '@/features/access/index';
import { type Connection } from '@/shared/workspace/connection';

type Owner = { connection: Connection; unavailable: string | undefined };
type Owned = { children: (owner: Owner) => ReactNode };

export function ProjectOwner({
  remote,
  connection,
  children,
}: Owned & { remote: string | null; connection: Connection }) {
  return remote === null ? (
    children({ connection, unavailable: undefined })
  ) : (
    <PairedOwner environmentId={remote}>{children}</PairedOwner>
  );
}

function PairedOwner({
  environmentId,
  children,
}: Owned & { environmentId: string }) {
  const entry = useRemoteConnection(environmentId);
  return entry && <RemoteOwner entry={entry}>{children}</RemoteOwner>;
}

function RemoteOwner({ entry, children }: Owned & { entry: RemoteConnection }) {
  const status = useRemoteStatus(entry.remote);
  return children({
    connection: entry.connection,
    unavailable:
      status.kind === 'online'
        ? undefined
        : `${remoteStatusText(status)}. ${remoteStatusNote(status) ?? 'Wait for this computer to answer before changing its projects.'}`,
  });
}

export function ProjectCommandProblem({
  unavailable,
  result,
}: {
  unavailable: string | undefined;
  result: AsyncResult.AsyncResult<unknown, unknown>;
}) {
  const problem =
    unavailable ??
    (AsyncResult.isFailure(result)
      ? connectionErrorMessage(Cause.squash(result.cause))
      : undefined);
  return (
    problem && (
      <Alert variant="destructive">
        <AlertDescription>{problem}</AlertDescription>
      </Alert>
    )
  );
}
