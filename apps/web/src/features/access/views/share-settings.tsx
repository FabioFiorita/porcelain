import { Cause, Option } from 'effect';
import { RetryAlert } from '@/shared/views/retry-alert';
import { AsyncResult } from 'effect/reactivity';
import { PencilIcon } from 'lucide-react';
import { useState, type ReactNode } from 'react';
import { Item, ItemActions, ItemContent } from '@/components/ui/item';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  SettingsGroup,
  SettingsSection,
} from '@/shared/views/settings-section';
import { TruncatedText } from '@/shared/views/truncated-text';
import { desktopShell } from '@/shared/shell';
import { usePairedAccess, useRetryPairedAccess } from '../queries/share';
import {
  chosenEnvironmentIcon,
  connectionErrorMessage,
  environmentIcon,
} from '@porcelain/client/access/rules';
import type { Environment, PairedAccess } from '@porcelain/client/access/rules';
import { useConnectedContext } from '../store';
import { ConnectionHistory } from './connection-history';
import { DisconnectBrowser } from './disconnect-browser';

import { useDesktopCapabilities } from '../queries/app-update';
import { EnvironmentName } from './environment-name';
import { EnvironmentIconPicker } from './environment-icon-picker';
import { useSetEnvironmentIcon } from '../commands/share';
import { ServiceUpdateSettings } from './service-update';
import { AppUpdateSettings } from './app-update';
import { PairDevice } from './pair-device';
import { PairedDevices } from './paired-devices';
import { WaysIn, WaysInGate } from './ways-in';
import { type Connection } from '@/shared/workspace/connection';

function SharingGate({
  connection,
  children,
}: {
  connection: Connection;
  children: (access: PairedAccess, failure?: string) => ReactNode;
}) {
  const access = usePairedAccess(connection);
  const retry = useRetryPairedAccess(connection);
  const answer = Option.getOrUndefined(AsyncResult.value(access));
  if (answer === null)
    return (
      <p className="text-xs text-muted-foreground">
        This device cannot manage sharing. Allow it from a device with sharing
        access.
      </p>
    );
  const failure = AsyncResult.isFailure(access)
    ? connectionErrorMessage(Cause.squash(access.cause))
    : undefined;
  if (!answer)
    return failure ? (
      <RetryAlert message={failure} waiting={access.waiting} onRetry={retry} />
    ) : null;
  return children(answer, failure);
}

export function ComputerUpdate({ prominent = false }: { prominent?: boolean }) {
  const capabilities = useDesktopCapabilities();
  const desktop = Option.getOrUndefined(
    AsyncResult.value(capabilities),
  )?.isDesktopShell;
  if (desktop === true) return <AppUpdateSettings prominent={prominent} />;
  if (desktop === false) return <ServiceUpdateSettings prominent={prominent} />;
  return null;
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
  const canEditIdentity = access?.canEditIdentity === true;
  const named = `${environment.custom}:${environment.name}`;
  const [renamingFrom, setRenamingFrom] = useState<string | null>(null);
  const [returning, setReturning] = useState(false);
  const served = new URL(connection.address);
  const address = /^https?:$/.test(served.protocol) ? served.origin : undefined;
  const renaming = renamingFrom === named;
  const [iconChange, setIcon] = useSetEnvironmentIcon(connection);

  return (
    <>
      <SettingsSection id="overview" title="Overview">
        <SettingsGroup>
          <Item>
            <ItemContent className="min-w-0">
              <div className="flex min-w-0 flex-wrap items-center gap-x-2 gap-y-1">
                <span className="min-w-0 text-sm leading-5 font-medium wrap-anywhere">
                  {environment.name}
                </span>
                <Badge variant="secondary">This computer</Badge>
              </div>
              <div className="flex min-w-0 items-center gap-1.5 text-xs leading-4.5 text-muted-foreground">
                <span
                  aria-hidden
                  className="size-1.5 shrink-0 rounded-full bg-add-fg"
                />
                <span className="shrink-0 text-foreground-2">Online</span>
                {address && (
                  <>
                    <span aria-hidden>·</span>
                    <TruncatedText
                      text={address}
                      className="min-w-0 font-mono"
                    />
                  </>
                )}
              </div>
              {canEditIdentity && AsyncResult.isFailure(iconChange) && (
                <Alert variant="destructive" className="mt-2 max-w-160">
                  <AlertDescription>
                    {connectionErrorMessage(Cause.squash(iconChange.cause))}
                  </AlertDescription>
                </Alert>
              )}
              {canEditIdentity && renaming && (
                <div className="mt-2">
                  <EnvironmentName
                    connection={connection}
                    environment={environment}
                    onCancel={() => setRenamingFrom(null)}
                  />
                </div>
              )}
            </ItemContent>
            {canEditIdentity && !renaming && (
              <ItemActions>
                <span className="flex items-center gap-1 text-muted-foreground">
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
              </ItemActions>
            )}
          </Item>
          <Item>
            <ItemContent>
              <ComputerUpdate prominent />
              <ConnectionHistory environmentId={connection.environmentId} />
            </ItemContent>
          </Item>
        </SettingsGroup>
      </SettingsSection>
      <WaysIn connection={connection} />
      <DevicesSettings connection={connection} />
      {!desktopShell && (
        <SettingsSection id="this-browser" title="This browser">
          <SettingsGroup>
            <Item>
              <ItemContent>
                <DisconnectBrowser computer={environment.name} />
              </ItemContent>
            </Item>
          </SettingsGroup>
        </SettingsSection>
      )}
    </>
  );
}

export function DevicesSettings({ connection }: { connection: Connection }) {
  const paired = Option.getOrUndefined(
    AsyncResult.value(usePairedAccess(connection)),
  );
  return (
    <SettingsSection
      id="devices"
      title="Devices"
      count={paired?.devices.length}
    >
      <SharingGate connection={connection}>
        {(access, failure) => (
          <WaysInGate connection={connection}>
            {(remote) => (
              <fieldset
                disabled={failure !== undefined}
                className="flex min-w-0 flex-col gap-3"
              >
                {failure && (
                  <Alert variant="destructive">
                    <AlertDescription>{failure}</AlertDescription>
                  </Alert>
                )}
                <section
                  aria-label="Pair a device"
                  className="flex min-w-0 flex-col gap-2.5 rounded-lg border bg-card p-3"
                >
                  <h3 className="text-xs leading-snug font-medium">
                    Pair a device
                  </h3>
                  <PairDevice
                    connection={connection}
                    remote={remote}
                    disabled={failure !== undefined}
                  />
                </section>
                <PairedDevices
                  connection={connection}
                  access={access}
                  disabled={failure !== undefined}
                />
              </fieldset>
            )}
          </WaysInGate>
        )}
      </SharingGate>
    </SettingsSection>
  );
}
