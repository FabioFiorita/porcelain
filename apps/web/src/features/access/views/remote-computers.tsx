import { AsyncResult } from 'effect/reactivity';
import { Cause, Option } from 'effect';
import {
  ChevronRightIcon,
  CircleIcon,
  GlobeIcon,
  KeyRoundIcon,
} from 'lucide-react';
import { useState, type ReactNode } from 'react';
import {
  connectionErrorMessage,
  remoteStatusText,
  type Environment,
  type Remote,
  type RemoteStatus,
} from '@porcelain/client/access/rules';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { FieldLegend, FieldSet } from '@/components/ui/field';
import { Input } from '@/components/ui/input';
import { TruncatedText } from '@/shared/views/truncated-text';
import { Item, ItemContent, ItemGroup } from '@/components/ui/item';
import { submitForm } from '@/shared/lib/submit-form';
import { cn } from '@/shared/lib/utils';
import { SettingsHeading } from '@/shared/views/settings-heading';
import { type Connection } from '@/shared/workspace/connection';
import { useAddRemote, useReadSavedEnvironments } from '../commands/remotes';
import { useRemoteStatus } from '../queries/remotes';
import { usePairedAccess, useRemoteAccess } from '../queries/share';
import { computerSummary } from '../rules/settings';
import { useConnectedContext, useSavedEnvironments } from '../store';
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
    <ComputerRow
      name={name}
      label={name}
      openLabel={`Open ${name}`}
      onOpen={() => onOpen(remote.environmentId)}
      status={status.kind}
      description={
        <>
          {remoteStatusText(status)} ·{' '}
          <span className="font-mono">{remote.address}</span> ·{' '}
          <span className="font-mono">{remote.environmentId.slice(0, 8)}</span>
        </>
      }
      update={showUpdates && update && <SettingsUpdateRow row={update} />}
    />
  );
}

function AddRemote() {
  const [link, setLink] = useState('');
  const add = useAddRemote(() => setLink(''));
  const { status } = useSavedEnvironments();
  return (
    <Item>
      <ItemContent>
        <p className="text-ui leading-5 text-foreground-2">
          On the other computer, run{' '}
          <code className="rounded-sm bg-muted px-1.5 py-px font-mono text-xs leading-4.5 font-medium text-foreground inset-ring inset-ring-border">
            porcelain pair
          </code>{' '}
          and paste the link it prints. This device keeps its own credential for
          that computer.
        </p>
        <form
          className="mt-2.5 flex flex-col gap-2 sm:flex-row"
          onSubmit={(event) => submitForm(event, () => add.submit(link))}
        >
          <div className="min-w-0 flex-1 font-mono">
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
          </div>
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

function ThisComputerSummary({ connection }: { connection: Connection }) {
  const remote = Option.getOrUndefined(
    AsyncResult.value(useRemoteAccess(connection)),
  );
  const paired = Option.getOrUndefined(
    AsyncResult.value(usePairedAccess(connection)),
  );
  return remote && paired
    ? `Online · ${computerSummary(remote, paired.devices.length)}`
    : 'Online · Connected computer';
}

export function RemoteComputers({
  environment,
  onOpen,
  showUpdates,
}: {
  environment: Environment;
  showUpdates: boolean;
  onOpen: (environmentId: string, hash?: string) => void;
}) {
  const { connection } = useConnectedContext();
  const { remotes, error: unreadable } = useSavedEnvironments();
  const restore = useReadSavedEnvironments();
  useSettingsUpdatesEntry();
  const { targets, count, batch, run } = useSettingsUpdates();
  return (
    <>
      <SettingsHeading
        section="Settings"
        title="Computers"
        lead="Every computer this app is paired with. In the Mac app and on iPhone and iPad, their worktrees share one sidebar, and Update updates them all."
      >
        <p className="mt-3.5 flex max-w-160 items-start gap-2 text-ui leading-5 text-muted-foreground">
          <GlobeIcon aria-hidden className="mt-0.75 size-3.5 shrink-0" />
          In a browser, a tab opens one computer: its sidebar shows that
          computer’s worktrees, and each other computer opens in its own tab.
        </p>
      </SettingsHeading>
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
      <section
        aria-labelledby="computers-heading"
        className="flex min-w-0 flex-col gap-2"
      >
        <div className="mb-1.5 flex min-h-7 items-center justify-between gap-2">
          <h2
            id="computers-heading"
            className="flex items-center gap-1 text-xs leading-4 font-medium text-muted-foreground"
          >
            Computers
            <span className="tabular-nums">{remotes.length + 1}</span>
          </h2>
          <Button
            size="sm"
            disabled={batch.running || count === 0}
            onClick={() => run(targets)}
          >
            Update all ({count})
          </Button>
        </div>
        <ItemGroup aria-label="Computers">
          <ComputerRow
            name={environment.name}
            label={`This computer: ${environment.name}`}
            openLabel={`Open This computer: ${environment.name}`}
            onOpen={() => onOpen('this-computer')}
            status="online"
            badge={<Badge variant="secondary">This computer</Badge>}
            description={<ThisComputerSummary connection={connection} />}
            update={showUpdates && <ComputerUpdate />}
          />
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
        <p className="mt-0.5 text-xs leading-4 text-muted-foreground">
          Services update from npm and restart. The Mac app updates itself.
        </p>
      </section>
      <FieldSet>
        <FieldLegend variant="label">Add computer</FieldLegend>
        <ItemGroup>
          <AddRemote />
        </ItemGroup>
      </FieldSet>
      <p className="-mt-3.5 text-ui leading-5 text-muted-foreground">
        To pair a phone, tablet or browser with this computer, open{' '}
        <button
          type="button"
          className="rounded-sm font-medium text-foreground underline underline-offset-3 outline-none focus-visible:ring-3 focus-visible:ring-ring/30"
          onClick={() => onOpen('this-computer', 'devices')}
        >
          {environment.name} › Devices
        </button>
        .
      </p>
    </>
  );
}

const hollow = (
  <CircleIcon
    aria-hidden
    strokeWidth={3.5}
    className="size-2.5 text-border-strong"
  />
);

function dot(color: string) {
  return <span aria-hidden className={cn('size-2 rounded-full', color)} />;
}

const statusDots: Record<RemoteStatus['kind'], ReactNode> = {
  online: dot('bg-add-fg'),
  checking: hollow,
  reconnecting: hollow,
  offline: hollow,
  'needs-pairing': dot('bg-destructive'),
  'other-server': dot('bg-destructive'),
  incompatible: dot('bg-warn'),
};

function ComputerRow({
  name,
  label,
  openLabel,
  status,
  badge,
  description,
  update,
  onOpen,
}: {
  name: string;
  label: string;
  openLabel: string;
  status: RemoteStatus['kind'];
  badge?: ReactNode;
  description: ReactNode;
  update: ReactNode;
  onOpen: () => void;
}) {
  return (
    <Item
      role="listitem"
      aria-label={label}
      className="relative grid min-h-15 grid-cols-[--spacing(4)_minmax(0,1fr)_--spacing(7)] sm:grid-cols-[--spacing(4)_minmax(0,1fr)_auto_--spacing(7)]"
    >
      <span
        aria-hidden
        className="flex h-5 w-4 items-center justify-center self-start"
      >
        {statusDots[status]}
      </span>
      <div className="min-w-0">
        <div className="flex min-w-0 items-center gap-2">
          <TruncatedText
            text={name}
            className="text-sm leading-5 font-medium"
            renderTrigger={(text) => (
              <button
                type="button"
                aria-label={openLabel}
                onClick={onOpen}
                className="min-w-0 rounded-sm text-left outline-none after:absolute after:inset-0 focus-visible:ring-3 focus-visible:ring-ring/30"
              >
                {text}
              </button>
            )}
          />
          {badge}
        </div>
        <p className="mt-0.5 text-xs leading-4.5 text-muted-foreground">
          {description}
        </p>
      </div>
      {update && (
        <div className="relative col-span-2 col-start-2 row-start-2 min-w-0 sm:col-span-1 sm:col-start-3 sm:row-start-1">
          {update}
        </div>
      )}
      <ChevronRightIcon
        aria-hidden
        className="col-start-3 row-start-1 size-4 justify-self-center text-muted-foreground sm:col-start-4"
      />
    </Item>
  );
}
