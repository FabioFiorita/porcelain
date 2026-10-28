import { Cause, Option } from 'effect';
import { AsyncResult } from 'effect/reactivity';
import type { ReactNode } from 'react';
import { FieldLegend, FieldSet } from '@/components/ui/field';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Spinner } from '@/components/ui/spinner';
import {
  connectionErrorMessage,
  waysInRefusal,
  type RemoteAccess,
} from '@porcelain/client/access/rules';
import { useRemoteAccess } from '../queries/share';
import { RemoteRoutes } from './remote-routes';
import { type Connection } from '@/shared/workspace/connection';

export function WaysInGate({
  connection,
  children,
}: {
  connection: Connection;
  children: (remote: RemoteAccess) => ReactNode;
}) {
  const remote = useRemoteAccess(connection);
  const answer = Option.getOrUndefined(AsyncResult.value(remote));
  if (answer === null)
    return (
      <p className="text-xs text-muted-foreground">
        {waysInRefusal(connection.address)}
      </p>
    );
  if (AsyncResult.isFailure(remote))
    return (
      <Alert variant="destructive">
        <AlertDescription>
          {connectionErrorMessage(Cause.squash(remote.cause))}
        </AlertDescription>
      </Alert>
    );
  if (!answer) return <Spinner />;
  return children(answer);
}

export function WaysIn({ connection }: { connection: Connection }) {
  return (
    <FieldSet id="ways-in">
      <FieldLegend variant="label">Ways in</FieldLegend>
      <WaysInGate connection={connection}>
        {(remote) => <RemoteRoutes connection={connection} remote={remote} />}
      </WaysInGate>
    </FieldSet>
  );
}
