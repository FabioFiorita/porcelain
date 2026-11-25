import { Cause, Option } from 'effect';
import { AsyncResult } from 'effect/reactivity';
import type { ReactNode } from 'react';
import { SettingsSection } from '@/shared/views/settings-section';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import {
  connectionErrorMessage,
  waysInRefusal,
  type RemoteAccess,
} from '@porcelain/client/access/rules';
import { useRemoteAccess, useRetryRemoteAccess } from '../queries/share';
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
  const retry = useRetryRemoteAccess(connection);
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
          <Button
            size="sm"
            variant="outline"
            disabled={remote.waiting}
            onClick={retry}
          >
            Try again
          </Button>
        </AlertDescription>
      </Alert>
    );
  if (!answer) return null;
  return children(answer);
}

export function WaysIn({ connection }: { connection: Connection }) {
  return (
    <SettingsSection id="ways-in" title="Ways in">
      <WaysInGate connection={connection}>
        {(remote) => <RemoteRoutes connection={connection} remote={remote} />}
      </WaysInGate>
    </SettingsSection>
  );
}
