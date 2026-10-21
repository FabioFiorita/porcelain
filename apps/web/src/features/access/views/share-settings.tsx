import { Cause, Option } from 'effect';
import { AsyncResult } from 'effect/reactivity';
import type { ReactNode } from 'react';
import { FieldLegend, FieldSet } from '@/components/ui/field';
import {
  Item,
  ItemContent,
  ItemDescription,
  ItemTitle,
  ItemGroup,
} from '@/components/ui/item';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Spinner } from '@/components/ui/spinner';
import { desktopShell } from '@/shared/shell';
import { useRemoteAccess } from '../queries/share';
import { connectionErrorMessage } from '@porcelain/client/access/rules';
import type { Environment, RemoteAccess } from '@porcelain/client/access/rules';
import { useConnectedContext } from '../store';
import { DisconnectBrowser } from './disconnect-browser';

import { useDesktopCapabilities } from '../queries/app-update';
import { EnvironmentName } from './environment-name';
import { ServiceUpdateSettings } from './service-update';
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

export function ComputerUpdate() {
  const capabilities = useDesktopCapabilities();
  const desktop = Option.getOrUndefined(
    AsyncResult.value(capabilities),
  )?.isDesktopShell;
  if (desktop === true) return <AppUpdateSettings />;
  if (desktop === false) return <ServiceUpdateSettings />;
  return <Spinner />;
}

export function ComputerSettings({
  environment,
}: {
  environment: Environment;
}) {
  const { connection } = useConnectedContext();

  return (
    <>
      <FieldSet>
        <FieldLegend variant="label">Overview</FieldLegend>
        <ItemGroup>
          <Item variant="outline">
            <ItemContent>
              <ComputerName connection={connection} environment={environment} />
            </ItemContent>
          </Item>
          <Item>
            <ItemContent>
              <ItemTitle>Connection</ItemTitle>
              <ItemDescription className="break-all">
                Connected · {new URL(connection.address).origin}
              </ItemDescription>
            </ItemContent>
          </Item>
          <Item variant="outline">
            <ItemContent>
              <ComputerUpdate />
            </ItemContent>
          </Item>
        </ItemGroup>
      </FieldSet>
      <WaysInSettings />
      {!desktopShell && (
        <FieldSet>
          <FieldLegend variant="label">This browser</FieldLegend>
          <ItemGroup>
            <Item>
              <ItemContent>
                <DisconnectBrowser />
              </ItemContent>
            </Item>
          </ItemGroup>
        </FieldSet>
      )}
    </>
  );
}

function ComputerName({
  connection,
  environment,
}: {
  connection: Connection;
  environment: Environment;
}) {
  const remote = useRemoteAccess(connection);
  const access = Option.getOrUndefined(AsyncResult.value(remote));
  if (access)
    return (
      <EnvironmentName connection={connection} environment={environment} />
    );
  return (
    <>
      <ItemTitle>Name</ItemTitle>
      <ItemDescription>{environment.name}</ItemDescription>
    </>
  );
}

export function WaysInSettings() {
  const { connection } = useConnectedContext();
  return (
    <FieldSet id="ways-in">
      <FieldLegend variant="label">Ways in</FieldLegend>
      <RemoteAccessGate connection={connection}>
        {(remote) => <RemoteRoutes connection={connection} remote={remote} />}
      </RemoteAccessGate>
    </FieldSet>
  );
}

export function DevicesSettings({ environment }: { environment: Environment }) {
  const { connection } = useConnectedContext();
  return (
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
                    connect it to {environment.name}. Each link works once, for
                    a few minutes.
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
  );
}
