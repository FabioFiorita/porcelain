import {
  KeyRoundIcon,
  MonitorIcon,
  ServerIcon,
  Trash2Icon,
} from 'lucide-react';
import { useState } from 'react';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
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
  ItemActions,
  ItemContent,
  ItemDescription,
  ItemFooter,
  ItemGroup,
  ItemMedia,
  ItemTitle,
} from '@/components/ui/item';
import { submitForm } from '@/shared/lib/submit-form';
import { useAddRemote, useForgetRemote } from '../commands/remotes';
import { useRemoteStatus } from '../queries/remotes';
import { connectionErrorMessage } from '../rules/connection-error-message';
import {
  remoteStatusNote,
  remoteStatusText,
  remoteStatusVariant,
  type Remote,
} from '../rules/remotes';
import { useRemotesStore } from '../store';

function RemoteRow({ remote }: { remote: Remote }) {
  const status = useRemoteStatus(remote);
  const forget = useForgetRemote();
  const note = remoteStatusNote(status);
  const name = status.kind === 'online' ? status.name : remote.name;
  return (
    <Item variant="outline" role="listitem" aria-label={name}>
      <ItemMedia variant="icon">
        <ServerIcon />
      </ItemMedia>
      <ItemContent>
        <ItemTitle>{name}</ItemTitle>
        <ItemDescription>
          {remote.address}
          {status.kind === 'online' && status.version
            ? ` · Porcelain ${status.version}`
            : ''}
        </ItemDescription>
      </ItemContent>
      <ItemActions>
        <Badge variant={remoteStatusVariant(status)}>
          {remoteStatusText(status)}
        </Badge>
        <Button
          variant="ghost"
          size="icon-sm"
          aria-label={`Remove ${name}`}
          disabled={forget.isPending}
          onClick={() => forget.onSubmit(remote)}
        >
          <Trash2Icon />
        </Button>
      </ItemActions>
      {(note || forget.error) && (
        <ItemFooter>
          <ItemDescription>
            {forget.error ? connectionErrorMessage(forget.error) : note}
          </ItemDescription>
        </ItemFooter>
      )}
    </Item>
  );
}

function AddRemote() {
  const [link, setLink] = useState('');
  const add = useAddRemote();
  return (
    <Item variant="outline">
      <ItemContent>
        <ItemDescription>
          On the other computer, run porcelain pair and paste the link it
          prints. This app keeps its own credential for that computer.
        </ItemDescription>
        <form
          className="flex flex-col gap-2 sm:flex-row"
          onSubmit={(event) =>
            submitForm(event, () =>
              add.submit(link, { onSuccess: () => setLink('') }),
            )
          }
        >
          <Input
            aria-label="Pairing link"
            placeholder="http://192.168.1.20:4738/pair#c=…"
            value={link}
            disabled={add.isPending}
            onChange={(event) => {
              add.reset();
              setLink(event.target.value);
            }}
          />
          <Button
            type="submit"
            className="shrink-0"
            disabled={add.isPending || link.trim() === ''}
          >
            {add.isPending ? 'Pairing…' : 'Add'}
          </Button>
        </form>
        {add.error && (
          <Alert variant="destructive">
            <AlertDescription>
              {connectionErrorMessage(add.error)}
            </AlertDescription>
          </Alert>
        )}
      </ItemContent>
    </Item>
  );
}

export function RemoteComputers() {
  const remotes = useRemotesStore((state) => state.remotes);
  const unreadable = useRemotesStore((state) => state.unreadable);
  return (
    <>
      {unreadable !== undefined && (
        <Alert variant="destructive">
          <KeyRoundIcon />
          <AlertTitle>Saved remote computers could not be read</AlertTitle>
          <AlertDescription>
            Porcelain keeps them as they are and saves no change over them.
            Allow Porcelain to use its Keychain item, then reopen the app. A
            computer added now lasts until the app quits. {unreadable}
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
          <ItemGroup aria-label="Remote computers">
            {remotes.map((remote) => (
              <RemoteRow key={remote.environmentId} remote={remote} />
            ))}
          </ItemGroup>
        )}
      </FieldSet>
    </>
  );
}
