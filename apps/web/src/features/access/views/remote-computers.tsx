import { Cause } from 'effect';
import { AsyncResult } from 'effect/reactivity';
import {
  remoteStatusNote,
  remoteStatusText,
} from '@porcelain/client/access/rules';
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
import {
  useAddRemote,
  useForgetRemote,
  useReadSavedEnvironments,
} from '../commands/remotes';
import { useRemoteStatus } from '../queries/remotes';
import { connectionErrorMessage } from '@porcelain/client/access/rules';
import { remoteStatusVariant } from '../rules/remotes';
import { type Remote } from '@porcelain/client/access/rules';
import { useSavedEnvironments } from '../store';

function RemoteRow({ remote }: { remote: Remote }) {
  const status = useRemoteStatus(remote);
  const forget = useForgetRemote(remote);
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
          disabled={forget.result.waiting}
          onClick={() => forget.submit()}
        >
          <Trash2Icon />
        </Button>
      </ItemActions>
      {(note || AsyncResult.isFailure(forget.result)) && (
        <ItemFooter>
          <ItemDescription>
            {AsyncResult.isFailure(forget.result)
              ? connectionErrorMessage(Cause.squash(forget.result.cause))
              : note}
          </ItemDescription>
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

export function RemoteComputers() {
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
