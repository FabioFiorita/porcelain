import { Cause } from 'effect';
import { AsyncResult } from 'effect/reactivity';
import type { Remote } from '@porcelain/client/access/rules';
import {
  connectionErrorMessage,
  remoteStatusNote,
  remoteStatusText,
} from '@porcelain/client/access/rules';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { FieldLegend, FieldSet } from '@/components/ui/field';
import {
  Item,
  ItemContent,
  ItemDescription,
  ItemGroup,
  ItemTitle,
} from '@/components/ui/item';
import { useForgetRemote } from '../commands/remotes';
import { useRemoteStatus } from '../queries/remotes';
import { remoteStatusVariant } from '../rules/remotes';
import { useRemoteConnection, useSavedEnvironments } from '../store';
import { RemoteServiceUpdate } from './service-update';

export function RemoteComputerName({ remote }: { remote: Remote }) {
  const status = useRemoteStatus(remote);
  return status.kind === 'online' ? status.name : remote.name;
}

export function RemoteComputerSettings({
  environmentId,
  onForgotten,
}: {
  environmentId: string;
  onForgotten: () => void;
}) {
  const { remotes, status, error } = useSavedEnvironments();
  const remote = remotes.find((item) => item.environmentId === environmentId);
  if (!remote)
    return (
      <Alert>
        <AlertDescription>
          {status !== 'ready'
            ? (error ?? 'Reading saved remote computers…')
            : 'This computer is no longer saved on this app. Return to Remote computers to add it again.'}
        </AlertDescription>
      </Alert>
    );
  return <RemoteDetails remote={remote} onForgotten={onForgotten} />;
}

function RemoteDetails({
  remote,
  onForgotten,
}: {
  remote: Remote;
  onForgotten: () => void;
}) {
  const status = useRemoteStatus(remote);
  const entry = useRemoteConnection(remote.environmentId);
  const forget = useForgetRemote(remote, onForgotten);
  const online = status.kind === 'online';
  const name = online ? status.name : remote.name;
  const note = remoteStatusNote(status);
  return (
    <>
      <FieldSet>
        <FieldLegend variant="label">Overview</FieldLegend>
        <ItemGroup>
          <Item variant="outline">
            <ItemContent>
              <ItemTitle>
                {name}{' '}
                <Badge variant={remoteStatusVariant(status)}>
                  {remoteStatusText(status)}
                </Badge>
              </ItemTitle>
              {note && <ItemDescription>{note}</ItemDescription>}
              {!online && (
                <p className="text-sm text-muted-foreground">
                  Saved details · Stale. This computer has not been verified
                  online.
                </p>
              )}
              <dl className="grid gap-3 text-sm">
                <div>
                  <dt className="text-muted-foreground">Address</dt>
                  <dd className="break-all font-mono">{remote.address}</dd>
                </div>
                <div>
                  <dt className="text-muted-foreground">Environment ID</dt>
                  <dd className="break-all font-mono">
                    {remote.environmentId}
                  </dd>
                </div>
                <div>
                  <dt className="text-muted-foreground">Porcelain version</dt>
                  <dd>
                    {online
                      ? (status.version ?? 'Not reported')
                      : 'Unavailable while this computer is not online'}
                  </dd>
                </div>
                {remote.deviceId && (
                  <div>
                    <dt className="text-muted-foreground">
                      This app’s device ID
                    </dt>
                    <dd className="break-all font-mono">{remote.deviceId}</dd>
                  </div>
                )}
              </dl>
            </ItemContent>
          </Item>
          {online && entry && (
            <Item variant="outline">
              <ItemContent>
                <RemoteServiceUpdate
                  connection={entry.connection}
                  name={name}
                  deviceId={remote.deviceId}
                />
              </ItemContent>
            </Item>
          )}
        </ItemGroup>
      </FieldSet>
      {!online && (
        <Item variant="outline">
          <ItemContent>
            <ItemTitle>Pair again</ItemTitle>
            <ItemDescription>
              On this computer, run porcelain pair. Return to Remote computers
              and add the new link to replace this app’s saved connection.
            </ItemDescription>
          </ItemContent>
        </Item>
      )}
      <FieldSet>
        <FieldLegend variant="label">Forget on this app</FieldLegend>
        <Item variant="outline">
          <ItemContent>
            <ItemDescription>
              Removes this computer and its saved credential from this app. It
              does not revoke host credentials or stop sharing on that computer.
              Unsaved drafts must be saved before it can be forgotten.
            </ItemDescription>
            <Button
              variant="destructive"
              className="w-fit"
              disabled={forget.result.waiting}
              onClick={() => void forget.submit()}
            >
              {forget.result.waiting ? 'Forgetting…' : 'Forget on this app'}
            </Button>
            {AsyncResult.isFailure(forget.result) && (
              <Alert variant="destructive">
                <AlertDescription>
                  {connectionErrorMessage(Cause.squash(forget.result.cause))}
                </AlertDescription>
              </Alert>
            )}
          </ItemContent>
        </Item>
      </FieldSet>
    </>
  );
}
