import { PendingButton } from '@/shared/views/pending-button';
import { AsyncResult } from 'effect/reactivity';
import { Link } from '@tanstack/react-router';
import { Cause, Option } from 'effect';
import { ChevronRightIcon, CircleIcon, KeyRoundIcon } from 'lucide-react';
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
import { Input } from '@/components/ui/input';
import { TruncatedText } from '@/shared/views/truncated-text';
import { Item, ItemContent } from '@/components/ui/item';
import { submitForm } from '@/shared/lib/submit-form';
import { cn } from '@/shared/lib/utils';
import {
  plainClick,
  SettingsGroup,
  SettingsSection,
} from '@/shared/views/settings-section';
import { type Connection } from '@/shared/workspace/connection';
import { useAddRemote, useReadSavedEnvironments } from '../commands/remotes';
import { useRemoteStatus } from '../queries/remotes';
import { usePairedAccess, useRemoteAccess } from '../queries/share';
import { computerReach } from '../rules/settings';
import { useConnectedContext, useSavedEnvironments } from '../store';
import {
  useSettingsUpdates,
  useSettingsUpdatesEntry,
} from '../queries/settings-updates';
import { useAppUpdateState } from '../queries/app-update';
import { appUpdateProgress } from '../rules/app-update';
import { SettingsUpdateRow } from './settings-update-row';
import { ComputerUpdate } from './share-settings';

function byComputerName(left: Remote, right: Remote) {
  return (
    left.name.localeCompare(right.name) ||
    left.environmentId.localeCompare(right.environmentId)
  );
}

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
      update={
        showUpdates &&
        (update ? (
          <SettingsUpdateRow row={update} />
        ) : (
          status.kind === 'offline' && (
            <p className="text-xs leading-4 text-muted-foreground">
              Version unavailable while offline
            </p>
          )
        ))
      }
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
              placeholder="https://porcelain.fabiofiorita.com/open/pair#c=…"
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
  if (!remote || !paired) return 'Online · Connected computer';
  const { devices, reach, unreachable } = computerReach(
    remote,
    paired.devices.length,
  );
  return (
    <>
      <span className="block">{`Online · ${devices}`}</span>
      <span className="block">
        {reach}
        {unreachable && (
          <>
            {' '}
            <Link
              to="/settings/$section/$environmentId"
              params={{ section: 'computers', environmentId: 'this-computer' }}
              hash="ways-in"
              className="relative rounded-sm font-medium whitespace-nowrap text-foreground underline underline-offset-2 outline-none focus-visible:ring-2 focus-visible:ring-ring"
            >
              Turn on a way in
            </Link>
          </>
        )}
      </span>
    </>
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
  const { connection } = useConnectedContext();
  const { remotes, error: unreadable } = useSavedEnvironments();
  const restore = useReadSavedEnvironments();
  useSettingsUpdatesEntry();
  const { targets, count, batch, run, retry, checking } = useSettingsUpdates();
  const [asked, setAsked] = useState<'no' | 'asked' | 'checking'>('no');
  if (asked === 'asked' && checking) setAsked('checking');
  if (asked === 'checking' && !checking) setAsked('no');
  const appBusy = appUpdateProgress(useAppUpdateState()) !== undefined;
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
      <SettingsSection
        id="computers"
        title="Computers"
        count={remotes.length + 1}
        className="@container"
        action={
          <>
            <PendingButton
              pending={asked !== 'no' && checking}
              size="sm"
              variant="outline"
              disabled={batch.running || checking || appBusy}
              onClick={() => {
                setAsked('asked');
                retry();
              }}
            >
              Check for updates
            </PendingButton>
            {remotes.length > 0 && (
              <Button
                size="sm"
                disabled={batch.running || count === 0}
                onClick={() => run(targets)}
              >
                Update all ({count})
              </Button>
            )}
          </>
        }
      >
        <SettingsGroup aria-label="Computers">
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
          {[...remotes].sort(byComputerName).map((remote) => (
            <RemoteRow
              key={remote.environmentId}
              remote={remote}
              showUpdates={showUpdates}
              onOpen={onOpen}
            />
          ))}
        </SettingsGroup>
      </SettingsSection>
      <SettingsSection id="add-computer" title="Add computer">
        <SettingsGroup>
          <AddRemote />
        </SettingsGroup>
      </SettingsSection>
      <p className="text-ui leading-5 text-muted-foreground">
        To pair a phone, tablet or browser with this computer, open{' '}
        <Link
          to="/settings/$section/$environmentId"
          params={{ section: 'computers', environmentId: 'this-computer' }}
          hash="devices"
          className="rounded-sm font-medium text-foreground underline underline-offset-3 outline-none focus-visible:ring-3 focus-visible:ring-ring/30"
        >
          {environment.name} › Devices
        </Link>
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
      className="relative grid grid-cols-[--spacing(4)_minmax(0,1fr)_--spacing(7)] @2xl:grid-cols-[--spacing(4)_minmax(0,1fr)_auto_--spacing(7)]"
    >
      <span
        aria-hidden
        className="flex h-5 w-4 items-center justify-center self-start"
      >
        {statusDots[status]}
      </span>
      <div className="min-w-0 self-start">
        <div className="flex min-w-0 items-center gap-2">
          <TruncatedText
            text={name}
            className="text-sm leading-5 font-medium"
            renderTrigger={(text) => (
              <button
                type="button"
                aria-label={openLabel}
                onClick={onOpen}
                className="flex min-w-0 rounded-sm text-left outline-none after:absolute after:inset-0 focus-visible:ring-3 focus-visible:ring-ring/30"
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
        <div className="relative col-span-2 col-start-2 row-start-2 min-w-0 @2xl:col-span-1 @2xl:col-start-3 @2xl:row-start-1 @2xl:max-w-80">
          {update}
        </div>
      )}
      <ChevronRightIcon
        aria-hidden
        className="col-start-3 row-start-1 size-4 justify-self-center text-muted-foreground @2xl:col-start-4"
      />
    </Item>
  );
}

function OutlineComputer({
  environmentId,
  name,
  status,
  state,
  selected,
  onOpen,
  children,
}: {
  environmentId: string;
  name: string;
  status: RemoteStatus['kind'];
  state: string;
  selected: boolean;
  onOpen: (environmentId: string) => void;
  children: ReactNode;
}) {
  return (
    <>
      <Link
        to="/settings/$section/$environmentId"
        params={{ section: 'computers', environmentId }}
        aria-current={selected ? 'page' : undefined}
        aria-label={`${name}, ${state}`}
        onClick={(event) => {
          if (!plainClick(event)) return;
          event.preventDefault();
          onOpen(environmentId);
        }}
        className={cn(
          'flex h-7 w-full min-w-0 items-center gap-2 rounded-md pr-2 pl-2.5 text-left text-muted-foreground outline-none hover:bg-muted hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring/30',
          selected &&
            'bg-secondary font-medium text-foreground hover:bg-secondary',
        )}
      >
        <span
          aria-hidden
          className="flex size-3.5 shrink-0 items-center justify-center"
        >
          {statusDots[status]}
        </span>
        <TruncatedText text={name} className="min-w-0 text-xs leading-4" />
      </Link>
      {selected && children}
    </>
  );
}

function OutlineRemote({
  remote,
  selected,
  onOpen,
  children,
}: {
  remote: Remote;
  selected: boolean;
  onOpen: (environmentId: string) => void;
  children: ReactNode;
}) {
  const status = useRemoteStatus(remote);
  return (
    <OutlineComputer
      environmentId={remote.environmentId}
      name={status.kind === 'online' ? status.name : remote.name}
      status={status.kind}
      state={remoteStatusText(status)}
      selected={selected}
      onOpen={onOpen}
    >
      {children}
    </OutlineComputer>
  );
}

export function ComputersOutline({
  selected,
  onOpen,
  children,
}: {
  selected: string | undefined;
  onOpen: (environmentId: string) => void;
  children: ReactNode;
}) {
  const { remotes } = useSavedEnvironments();
  return (
    <div className="flex flex-col gap-0.5">
      <OutlineComputer
        environmentId="this-computer"
        name="This computer"
        status="online"
        state="Online"
        selected={selected === 'this-computer'}
        onOpen={onOpen}
      >
        {children}
      </OutlineComputer>
      {[...remotes].sort(byComputerName).map((remote) => (
        <OutlineRemote
          key={remote.environmentId}
          remote={remote}
          selected={selected === remote.environmentId}
          onOpen={onOpen}
        >
          {children}
        </OutlineRemote>
      ))}
    </div>
  );
}
