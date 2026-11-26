import { useAtomRefresh } from '@effect/atom-react';
import { RetryAlert } from '@/shared/views/retry-alert';
import { readServiceUpdate } from '@porcelain/client/access';
import { Cause } from 'effect';
import { AsyncResult } from 'effect/reactivity';
import { connectionErrorMessage } from '@porcelain/client/access/rules';
import { useServiceUpdate } from '../queries/share';
import { type Connection } from '@/shared/workspace/connection';
import { useLocalConnection } from '../store';
import { useSettingsUpdates } from '../queries/settings-updates';
import { SettingsUpdateRow } from './settings-update-row';

function ServiceUpdate({
  connection,
  prominent,
}: {
  connection: Connection;
  prominent: boolean;
}) {
  const { rows } = useSettingsUpdates();
  const row = rows.find(
    ({ target }) =>
      target.kind === 'service' && target.id === connection.environmentId,
  );
  const result = useServiceUpdate(connection);
  const refresh = useAtomRefresh(readServiceUpdate(connection));
  if (row) return <SettingsUpdateRow row={row} prominent={prominent} />;
  if (AsyncResult.isFailure(result))
    return (
      <RetryAlert
        message={connectionErrorMessage(Cause.squash(result.cause))}
        waiting={result.waiting}
        onRetry={refresh}
      />
    );
  return null;
}

export function ServiceUpdateSettings({
  prominent = false,
}: {
  prominent?: boolean;
}) {
  const connection = useLocalConnection();
  return (
    connection && (
      <ServiceUpdate connection={connection} prominent={prominent} />
    )
  );
}

export function RemoteServiceUpdate({
  connection,
}: {
  connection: Connection;
}) {
  return <ServiceUpdate connection={connection} prominent />;
}
