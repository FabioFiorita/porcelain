import type { RemoteConnection } from '@porcelain/client/access';
import { Cause, Option } from 'effect';
import { AsyncResult } from 'effect/reactivity';
import { remoteStatusText } from '@porcelain/client/access/rules';
import type { ReactNode } from 'react';
import { FieldLegend, FieldSet } from '@/components/ui/field';
import {
  Item,
  ItemContent,
  ItemDescription,
  ItemGroup,
  ItemTitle,
} from '@/components/ui/item';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Spinner } from '@/components/ui/spinner';
import { desktopShell } from '@/shared/shell';
import { useRemoteAccess } from '../queries/share';
import { connectionErrorMessage } from '@porcelain/client/access/rules';
import type { Environment, RemoteAccess } from '@porcelain/client/access/rules';
import { useLocalConnection, useRemoteConnections } from '../store';
import { useRemoteStatus } from '../queries/remotes';

import { useAppUpdateCapability } from '../queries/app-update';
import { EnvironmentName } from './environment-name';
import { RemoteServiceUpdate, ServiceUpdateSettings } from './service-update';
import { AppUpdateSettings } from './app-update';
import { PairDevice } from './pair-device';
import { PairedDevices } from './paired-devices';
import { RemoteRoutes } from './remote-routes';
import { type Connection } from '@/shared/workspace/connection';

function RemoteAccessGate({
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
        Sharing is managed from a browser on the computer that runs Porcelain.
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

function useDesktopConnection() {
  const connection = useLocalConnection();
  return desktopShell ? connection : null;
}

export function ComputerSettings({
  environment,
}: {
  environment: Environment;
}) {
  const connection = useDesktopConnection();
  const desktop = Option.getOrUndefined(
    AsyncResult.value(useAppUpdateCapability()),
  );
  return (
    connection && (
      <>
        <ItemGroup>
          <Item variant="outline">
            <ItemContent>
              <EnvironmentName
                connection={connection}
                environment={environment}
              />
            </ItemContent>
          </Item>
        </ItemGroup>
        <FieldSet>
          <FieldLegend variant="label">Updates</FieldLegend>
          <ItemGroup>
            <Item variant="outline">
              <ItemContent>
                {(() => {
                  if (desktop === true) {
                    return <AppUpdateSettings />;
                  }
                  if (desktop === false) {
                    return <ServiceUpdateSettings />;
                  }
                  return <Spinner />;
                })()}
              </ItemContent>
            </Item>
          </ItemGroup>
        </FieldSet>
        <RemoteUpdates />
      </>
    )
  );
}

function RemoteUpdateRow({ entry }: { entry: RemoteConnection }) {
  const status = useRemoteStatus(entry.remote);
  const name = status.kind === 'online' ? status.name : entry.remote.name;
  return (
    <Item variant="outline" role="listitem" aria-label={name}>
      <ItemContent>
        <ItemTitle>{name}</ItemTitle>
        {status.kind === 'online' ? (
          <RemoteServiceUpdate
            connection={entry.connection}
            name={name}
            deviceId={entry.remote.deviceId}
          />
        ) : (
          <ItemDescription>
            {remoteStatusText(status)}. Its update shows here once it answers.
          </ItemDescription>
        )}
      </ItemContent>
    </Item>
  );
}

function RemoteUpdates() {
  const remotes = useRemoteConnections();
  return (
    remotes.length > 0 && (
      <FieldSet>
        <FieldLegend variant="label">Remote computers</FieldLegend>
        <ItemGroup aria-label="Remote computer updates">
          {remotes.map((entry) => (
            <RemoteUpdateRow key={entry.remote.environmentId} entry={entry} />
          ))}
        </ItemGroup>
      </FieldSet>
    )
  );
}

export function WaysInSettings() {
  const connection = useDesktopConnection();
  return (
    connection && (
      <RemoteAccessGate connection={connection}>
        {(remote) => <RemoteRoutes connection={connection} remote={remote} />}
      </RemoteAccessGate>
    )
  );
}

export function DevicesSettings({ environment }: { environment: Environment }) {
  const connection = useDesktopConnection();
  return (
    connection && (
      <RemoteAccessGate connection={connection}>
        {(remote) => (
          <>
            <FieldSet>
              <FieldLegend variant="label">Pair a device</FieldLegend>
              <ItemGroup>
                <Item variant="outline">
                  <ItemContent>
                    <ItemDescription>
                      Open the link or scan the code on the other device to
                      connect it to {environment.name}. Each link works once,
                      for a few minutes.
                    </ItemDescription>
                    <PairDevice connection={connection} remote={remote} />
                  </ItemContent>
                </Item>
              </ItemGroup>
            </FieldSet>
            <FieldSet>
              <FieldLegend variant="label">Paired devices</FieldLegend>
              <PairedDevices connection={connection} />
            </FieldSet>
          </>
        )}
      </RemoteAccessGate>
    )
  );
}
