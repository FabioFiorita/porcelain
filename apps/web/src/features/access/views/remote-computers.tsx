import { Cause } from 'effect';
import { AsyncResult } from 'effect/reactivity';
import { KeyRoundIcon, MonitorIcon, ChevronRightIcon } from 'lucide-react';
import { useState } from 'react';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import {
  Empty,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from '@/components/ui/empty';
import { FieldLegend, FieldSet } from '@/components/ui/field';
import { Input } from '@/components/ui/input';
import {
  Item,
  ItemContent,
  ItemDescription,
  ItemGroup,
} from '@/components/ui/item';
import { submitForm } from '@/shared/lib/submit-form';
import { useAddRemote, useReadSavedEnvironments } from '../commands/remotes';
import { useRemoteStatus } from '../queries/remotes';
import { connectionErrorMessage } from '@porcelain/client/access/rules';
import { type Remote } from '@porcelain/client/access/rules';
import { useSavedEnvironments } from '../store';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';

const statusFilters = [
  { value: 'all', label: 'All computers' },
  { value: 'online', label: 'Online' },
  { value: 'offline', label: 'Offline' },
  { value: 'attention', label: 'Needs attention' },
];

function RemoteRow({
  remote,
  search,
  filter,
  onOpen,
}: {
  remote: Remote;
  search: string;
  filter: string;
  onOpen: (environmentId: string) => void;
}) {
  const status = useRemoteStatus(remote);
  const name = status.kind === 'online' ? status.name : remote.name;
  if (
    !`${name} ${remote.address} ${remote.environmentId}`
      .toLowerCase()
      .includes(search.trim().toLowerCase()) ||
    (filter === 'online' && status.kind !== 'online') ||
    (filter === 'offline' && status.kind !== 'offline') ||
    (filter === 'attention' &&
      (status.kind === 'online' || status.kind === 'checking'))
  )
    return null;
  return (
    <Item variant="outline" size="sm" role="listitem" aria-label={name}>
      <ItemContent>
        <Button
          variant="ghost"
          className="h-auto w-full justify-between text-left"
          onClick={() => onOpen(remote.environmentId)}
        >
          <span className="min-w-0">
            <span className="block truncate font-medium">{name}</span>
            <span className="block truncate text-xs text-muted-foreground">
              {remote.address} · {remote.environmentId.slice(0, 8)}
            </span>
          </span>
          <ChevronRightIcon />
        </Button>
      </ItemContent>
    </Item>
  );
}

function AddRemote() {
  const [link, setLink] = useState('');
  const add = useAddRemote(() => setLink(''));
  const { status } = useSavedEnvironments();
  return (
    <Item variant="outline">
      <ItemContent>
        <ItemDescription>
          On the other computer, run porcelain pair and paste the link it
          prints. This app keeps its own credential for that computer.
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
  onOpen,
}: {
  onOpen: (environmentId: string) => void;
}) {
  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState('all');
  const { remotes, error: unreadable } = useSavedEnvironments();
  const restore = useReadSavedEnvironments();
  return (
    <>
      {unreadable !== undefined && (
        <Alert variant="destructive">
          <KeyRoundIcon />
          <AlertTitle>Saved remote computers could not be read</AlertTitle>
          <AlertDescription>
            Porcelain keeps them as they are and saves no change over them.
            Allow Porcelain to read its saved credentials, then try again.{' '}
            {unreadable}
            <Button
              variant="outline"
              disabled={restore.result.waiting}
              onClick={() => restore.read()}
            >
              Read saved environments
            </Button>
          </AlertDescription>
        </Alert>
      )}
      <FieldSet>
        <FieldLegend variant="label">Add a remote computer</FieldLegend>
        <ItemGroup>
          <AddRemote />
        </ItemGroup>
      </FieldSet>
      <FieldSet>
        <FieldLegend variant="label">Remote computers</FieldLegend>
        <div className="flex gap-2">
          <Input
            aria-label="Search remote computers"
            placeholder="Search name or address"
            value={search}
            onChange={(event) => setSearch(event.target.value)}
          />
          <Select
            items={statusFilters}
            value={filter}
            onValueChange={(value) => {
              if (value) setFilter(value);
            }}
          >
            <SelectTrigger aria-label="Computer status">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {statusFilters.map((item) => (
                <SelectItem key={item.value} value={item.value}>
                  {item.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        {remotes.length === 0 ? (
          <Empty>
            <EmptyHeader>
              <EmptyMedia variant="icon">
                <MonitorIcon />
              </EmptyMedia>
              <EmptyTitle>No remote computers yet</EmptyTitle>
              <EmptyDescription>
                Add one to review its projects from this app, next to the
                projects on this computer.
              </EmptyDescription>
            </EmptyHeader>
          </Empty>
        ) : (
          <ItemGroup aria-label="Remote computers" className="peer">
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
                  search={search}
                  filter={filter}
                  onOpen={onOpen}
                />
              ))}
          </ItemGroup>
        )}
        {remotes.length > 0 && (
          <p
            className="text-sm text-muted-foreground peer-has-[[role=listitem]]:hidden"
            role="status"
          >
            No computers match this search and filter.
          </p>
        )}
      </FieldSet>
    </>
  );
}
