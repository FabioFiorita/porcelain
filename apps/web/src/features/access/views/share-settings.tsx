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
import { usePairedAccess } from '../queries/share';
import { connectionErrorMessage } from '@porcelain/client/access/rules';
import type { Environment, PairedAccess } from '@porcelain/client/access/rules';
import { useConnectedContext } from '../store';
import { DisconnectBrowser } from './disconnect-browser';

import { useDesktopCapabilities } from '../queries/app-update';
import { EnvironmentName } from './environment-name';
import { ServiceUpdateSettings } from './service-update';
import { AppUpdateSettings } from './app-update';
import { PairDevice } from './pair-device';
import { AgentsSetting } from './agents-setting';
import { PairedDevices } from './paired-devices';
import { WaysIn, WaysInGate } from './ways-in';
import { type Connection } from '@/shared/workspace/connection';

function HostGate({
  connection,
  children,
}: {
  connection: Connection;
  children: (access: PairedAccess) => ReactNode;
}) {
  const access = usePairedAccess(connection);
  const answer = Option.getOrUndefined(AsyncResult.value(access));
  if (answer === null)
    return (
      <p className="text-xs text-muted-foreground">
        Sharing is managed from a browser on the computer that runs Porcelain.
      </p>
    );
  if (AsyncResult.isFailure(access))
    return (
      <Alert variant="destructive">
        <AlertDescription>
          {connectionErrorMessage(Cause.squash(access.cause))}
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
      <div className="space-y-3">
        <h1 className="break-words text-4xl font-semibold tracking-tight">
          <span className="text-muted-foreground">Computers.</span>{' '}
          {environment.name}
        </h1>
        <p className="text-base">
          Devices pair with this computer here, and your agents reach Porcelain
          through it.
        </p>
      </div>
      <div className="settings-computer grid min-w-0 items-start gap-7 lg:grid-cols-3">
        <FieldSet>
          <FieldLegend variant="label">Overview</FieldLegend>
          <ItemGroup>
            <Item variant="outline">
              <ItemContent>
                <ComputerName
                  connection={connection}
                  environment={environment}
                />
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
        <WaysIn connection={connection} />
        <DevicesSettings environment={environment} />
        <AgentsSetting />
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
      </div>
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
  const paired = usePairedAccess(connection);
  const access = Option.getOrUndefined(AsyncResult.value(paired));
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

function DevicesSettings({ environment }: { environment: Environment }) {
  const { connection } = useConnectedContext();
  return (
    <HostGate connection={connection}>
      {(access) => (
        <WaysInGate connection={connection}>
          {(remote) => (
            <>
              <FieldSet className="min-w-0">
                <FieldLegend variant="label">Paired devices</FieldLegend>
                <PairedDevices connection={connection} access={access} />
              </FieldSet>
              <aside className="min-w-0 rounded-xl border bg-card p-3 lg:col-start-3 lg:row-start-3 lg:row-span-2">
                <FieldSet className="min-w-0">
                  <FieldLegend variant="label">Pair a device</FieldLegend>
                  <ItemGroup>
                    <Item variant="outline">
                      <ItemContent>
                        <ItemDescription>
                          Open the link or scan the code on the other device to
                          connect it to {environment.name}. Each link works
                          once, for a few minutes.
                        </ItemDescription>
                        <PairDevice connection={connection} remote={remote} />
                      </ItemContent>
                    </Item>
                  </ItemGroup>
                </FieldSet>
              </aside>
            </>
          )}
        </WaysInGate>
      )}
    </HostGate>
  );
}
