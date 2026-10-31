import { Cause, Option } from 'effect';
import { AsyncResult } from 'effect/reactivity';
import { PencilIcon } from 'lucide-react';
import { useState, type ReactNode } from 'react';
import { FieldLegend, FieldSet } from '@/components/ui/field';
import { Item, ItemContent, ItemGroup } from '@/components/ui/item';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Spinner } from '@/components/ui/spinner';
import { SettingsHeading } from '@/shared/views/settings-heading';
import { TruncatedText } from '@/shared/views/truncated-text';
import { desktopShell } from '@/shared/shell';
import { usePairedAccess } from '../queries/share';
import {
  chosenEnvironmentIcon,
  connectionErrorMessage,
  environmentIcon,
} from '@porcelain/client/access/rules';
import type { Environment, PairedAccess } from '@porcelain/client/access/rules';
import { useConnectedContext } from '../store';
import { DisconnectBrowser } from './disconnect-browser';

import { useDesktopCapabilities } from '../queries/app-update';
import { EnvironmentName } from './environment-name';
import { EnvironmentIconPicker } from './environment-icon-picker';
import { useSetEnvironmentIcon } from '../commands/share';
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

export function ComputerUpdate({ prominent = false }: { prominent?: boolean }) {
  const capabilities = useDesktopCapabilities();
  const desktop = Option.getOrUndefined(
    AsyncResult.value(capabilities),
  )?.isDesktopShell;
  if (desktop === true) return <AppUpdateSettings prominent={prominent} />;
  if (desktop === false) return <ServiceUpdateSettings prominent={prominent} />;
  return <Spinner />;
}

export function ComputerSettings({
  environment,
}: {
  environment: Environment;
}) {
  const { connection } = useConnectedContext();
  const access = Option.getOrUndefined(
    AsyncResult.value(usePairedAccess(connection)),
  );
  const named = `${environment.custom}:${environment.name}`;
  const [renamingFrom, setRenamingFrom] = useState<string | null>(null);
  const [returning, setReturning] = useState(false);
  const served = new URL(connection.address);
  const address = /^https?:$/.test(served.protocol) ? served.origin : undefined;
  const renaming = renamingFrom === named;
  const [iconChange, setIcon] = useSetEnvironmentIcon(connection);

  return (
    <>
      <SettingsHeading
        section="Computers"
        title={environment.name}
        lead="Devices pair with this computer here, and your agents reach Porcelain through it."
        status={
          <>
            <span
              aria-hidden
              className="size-2 shrink-0 rounded-full bg-add-fg"
            />
            <span>Online</span>
            <span aria-hidden className="text-muted-foreground">
              ·
            </span>
            <Badge variant="secondary">This computer</Badge>
            {address && (
              <>
                <span aria-hidden className="text-muted-foreground">
                  ·
                </span>
                <TruncatedText
                  text={address}
                  className="font-mono text-xs text-muted-foreground"
                />
              </>
            )}
          </>
        }
        action={
          access &&
          !renaming && (
            <span className="mt-1 flex items-center gap-1 text-muted-foreground">
              <EnvironmentIconPicker
                icon={environmentIcon(environment)}
                pending={iconChange.waiting}
                onChange={(icon) => setIcon(chosenEnvironmentIcon(icon))}
              />
              <Button
                variant="ghost"
                size="sm"
                ref={
                  returning
                    ? (element: HTMLButtonElement | null) => {
                        if (!element) return;
                        element.focus();
                        setReturning(false);
                      }
                    : undefined
                }
                onClick={() => {
                  setReturning(true);
                  setRenamingFrom(named);
                }}
              >
                <PencilIcon />
                Rename
              </Button>
            </span>
          )
        }
      >
        {access && AsyncResult.isFailure(iconChange) && (
          <Alert variant="destructive" className="mt-4 max-w-160">
            <AlertDescription>
              {connectionErrorMessage(Cause.squash(iconChange.cause))}
            </AlertDescription>
          </Alert>
        )}
        {access && renaming && (
          <div className="mt-4">
            <EnvironmentName
              connection={connection}
              environment={environment}
              onCancel={() => setRenamingFrom(null)}
            />
          </div>
        )}
      </SettingsHeading>
      <div className="settings-computer grid min-w-0 items-start gap-x-8 gap-y-6 lg:grid-cols-[minmax(0,1fr)_--spacing(62)]">
        <ItemGroup aria-label="Version">
          <Item variant="outline">
            <ItemContent>
              <ComputerUpdate prominent />
            </ItemContent>
          </Item>
        </ItemGroup>
        <WaysIn connection={connection} />
        <DevicesSettings />
        <AgentsSetting />
        {!desktopShell && (
          <FieldSet>
            <FieldLegend variant="label">
              <span className="flex items-center gap-2">
                <span>This browser</span>
                <Badge variant="outline">Shown in a browser tab</Badge>
              </span>
            </FieldLegend>
            <ItemGroup>
              <Item>
                <ItemContent>
                  <DisconnectBrowser computer={environment.name} />
                </ItemContent>
              </Item>
            </ItemGroup>
          </FieldSet>
        )}
      </div>
    </>
  );
}

function DevicesSettings() {
  const { connection } = useConnectedContext();
  const paired = Option.getOrUndefined(
    AsyncResult.value(usePairedAccess(connection)),
  );
  return (
    <HostGate connection={connection}>
      {(access) => (
        <WaysInGate connection={connection}>
          {(remote) => (
            <>
              <FieldSet id="devices" className="min-w-0">
                <FieldLegend variant="label">
                  <span className="flex items-center gap-1">
                    Devices
                    {paired && (
                      <span className="tabular-nums">
                        {paired.devices.length}
                      </span>
                    )}
                  </span>
                </FieldLegend>
                <PairedDevices connection={connection} access={access} />
              </FieldSet>
              <aside
                aria-label="Pair a device"
                className="flex min-w-0 flex-col gap-2.5 rounded-xl border bg-card p-3 shadow-pop lg:col-start-2 lg:row-span-2 lg:row-start-3"
              >
                <div>
                  <p className="text-ui leading-4.5 font-semibold">
                    Pair a device
                  </p>
                  <p className="mt-0.5 text-xs leading-4.25 text-muted-foreground">
                    A link works once, for a few minutes.
                  </p>
                </div>
                <PairDevice connection={connection} remote={remote} />
              </aside>
            </>
          )}
        </WaysInGate>
      )}
    </HostGate>
  );
}
