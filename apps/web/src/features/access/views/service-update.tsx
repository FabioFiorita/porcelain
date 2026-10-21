import { Cause } from 'effect';
import { AsyncResult } from 'effect/reactivity';
import { connectionErrorMessage } from '@porcelain/client/access/rules';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { useServiceUpdate } from '../queries/share';
import { Spinner } from '@/components/ui/spinner';
import { type Connection } from '@/shared/workspace/connection';
import { useLocalConnection } from '../store';
import { useSettingsUpdates } from '../queries/settings-updates';
import { SettingsUpdateRow } from './settings-update-row';

function ServiceUpdate({ connection }: { connection: Connection }) {
  const { rows } = useSettingsUpdates();
  const row = rows.find(
    ({ target }) =>
      target.kind === 'service' && target.id === connection.environmentId,
  );
  const result = useServiceUpdate(connection);
  if (row) return <SettingsUpdateRow row={row} />;
  if (AsyncResult.isFailure(result))
    return (
      <Alert variant="destructive">
        <AlertDescription>
          {connectionErrorMessage(Cause.squash(result.cause))}
        </AlertDescription>
      </Alert>
    );
  return <Spinner />;
}

export function ServiceUpdateSettings() {
  const connection = useLocalConnection();
  return connection && <ServiceUpdate connection={connection} />;
}

export function RemoteServiceUpdate({
  connection,
}: {
  connection: Connection;
}) {
  return <ServiceUpdate connection={connection} />;
}
