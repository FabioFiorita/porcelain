import { Cause } from 'effect';
import { AsyncResult } from 'effect/reactivity';
import { KeyRoundIcon, MonitorIcon, ChevronRightIcon } from 'lucide-react';
import { useState } from 'react';
import {
  connectionErrorMessage,
  remoteStatusText,
  type Environment,
  type Remote,
} from '@porcelain/client/access/rules';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { FieldLegend, FieldSet } from '@/components/ui/field';
import { Input } from '@/components/ui/input';
import {
  Item,
  ItemContent,
  ItemDescription,
  ItemGroup,
  ItemFooter,
} from '@/components/ui/item';
import { submitForm } from '@/shared/lib/submit-form';
import { useAddRemote, useReadSavedEnvironments } from '../commands/remotes';
import { useRemoteStatus } from '../queries/remotes';
import { useSavedEnvironments } from '../store';
import {
  useSettingsUpdates,
  useSettingsUpdatesEntry,
} from '../queries/settings-updates';
import { SettingsUpdateRow } from './settings-update-row';
import { ComputerUpdate } from './share-settings';

function RemoteRow({
  remote,
  onOpen,
  showUpdates,
}: {
  remote: Remote;
  showUpdates: boolean;
  onOpen: (environmentId: string) => void;
}) {
  const status = useRemoteStatus(remote);
  const name = status.kind === 'online' ? status.name : remote.name;
  const { rows } = useSettingsUpdates();
  const update = rows.find(
    ({ target }) =>
      target.kind === 'service' && target.id === remote.environmentId,
  );
  return (
    <Item size="sm" role="listitem" aria-label={name}>
      <ItemContent>
        <Button
          variant="ghost"
          className="h-auto w-full justify-between whitespace-normal text-left"
          aria-label={`Open ${name}`}
          onClick={() => onOpen(remote.environmentId)}
        >
          <span className="min-w-0">
            <span className="block truncate font-medium">{name}</span>
            <span className="block break-all text-xs font-normal text-muted-foreground">
              {remoteStatusText(status)} · {remote.address} ·{' '}
              {remote.environmentId.slice(0, 8)}
            </span>
          </span>
          <ChevronRightIcon className="shrink-0" />
        </Button>
      </ItemContent>
      {showUpdates && update && (
        <ItemFooter>
          <div className="w-full">
            <SettingsUpdateRow row={update} />
          </div>
        </ItemFooter>
      )}
    </Item>
  );
}

function AddRemote() {
  const [link, setLink] = useState('');
  const add = useAddRemote(() => setLink(''));
  const { status } = useSavedEnvironments();
  return (
    <Item>
      <ItemContent>
        <ItemDescription>
          On the other computer, run porcelain pair and paste the link it
          prints. This device keeps its own credential for that computer.
        </ItemDescription>
        <form
          className="flex flex-col gap-2 sm:flex-row"
          onSubmit={(event) => submitForm(event, () => add.submit(link))}
        >
          <Input
            aria-label="Pairing link"
            placeholder="http://192.168.1.20:4738/pair#c=…"
            value={link}
            disabled={add.result.waiting || status !== 'ready'}
            onChange={(event) => {
              add.reset();
              setLink(event.target.value);
            }}
          />
          <Button
            type="submit"
            className="shrink-0"
            disabled={
              add.result.waiting || status !== 'ready' || link.trim() === ''
            }
          >
            {add.result.waiting ? 'Pairing…' : 'Add'}
          </Button>
        </form>
        {AsyncResult.isFailure(add.result) && (
          <Alert variant="destructive">
            <AlertDescription>
              {connectionErrorMessage(Cause.squash(add.result.cause))}
            </AlertDescription>
          </Alert>
        )}
      </ItemContent>
    </Item>
  );
}

export function RemoteComputers({
  environment,
  onOpen,
  showUpdates,
}: {
  environment: Environment;
  showUpdates: boolean;
  onOpen: (environmentId: string) => void;
}) {
  const { remotes, error: unreadable } = useSavedEnvironments();
  const restore = useReadSavedEnvironments();
  useSettingsUpdatesEntry();
  const { targets, count, batch, run } = useSettingsUpdates();
  return (
    <>
      {unreadable !== undefined && (
        <Alert variant="destructive">
          <KeyRoundIcon />
          <AlertTitle>Saved computers could not be read</AlertTitle>
          <AlertDescription>
            Porcelain keeps them as they are and saves no change over them.
            Allow Porcelain to read its saved credentials, then try again.{' '}
            {unreadable}
            <Button
              variant="outline"
              disabled={restore.result.waiting}
              onClick={() => restore.read()}
            >
              Read saved computers
            </Button>
          </AlertDescription>
        </Alert>
      )}
      <FieldSet>
        <FieldLegend variant="label">Computers</FieldLegend>
        <div className="flex justify-end">
          <Button
            size="sm"
            disabled={batch.running || count === 0}
            onClick={() => run(targets)}
          >
            Update all ({count})
          </Button>
        </div>
        <ItemGroup aria-label="Computers">
          <Item size="sm" role="listitem" aria-label="This computer">
            <ItemContent>
              <Button
                variant="ghost"
                className="h-auto w-full justify-between whitespace-normal text-left"
                aria-label="Open This computer"
                onClick={() => onOpen('this-computer')}
              >
                <span className="min-w-0">
                  <span className="flex flex-wrap items-center gap-2">
                    <MonitorIcon className="size-4" />
                    {environment.name}
                    <Badge variant="secondary">This computer</Badge>
                  </span>
                  <span className="block text-xs font-normal text-muted-foreground">
                    Online · Connected computer
                  </span>
                </span>
                <ChevronRightIcon className="shrink-0" />
              </Button>
            </ItemContent>
            {showUpdates && (
              <ItemFooter>
                <div className="w-full">
                  <ComputerUpdate />
                </div>
              </ItemFooter>
            )}
          </Item>
          {[...remotes]
            .sort(
              (a, b) =>
                a.name.localeCompare(b.name) ||
                a.environmentId.localeCompare(b.environmentId),
            )
            .map((remote) => (
              <RemoteRow
                key={remote.environmentId}
                remote={remote}
                showUpdates={showUpdates}
                onOpen={onOpen}
              />
            ))}
        </ItemGroup>
        <p className="text-xs text-muted-foreground">
          Services update from npm and restart. The Mac app updates itself.
        </p>
      </FieldSet>
      <FieldSet>
        <FieldLegend variant="label">Add computer</FieldLegend>
        <ItemGroup>
          <AddRemote />
        </ItemGroup>
      </FieldSet>
    </>
  );
}
