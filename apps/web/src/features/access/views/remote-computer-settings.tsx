import { Cause } from 'effect';
import { AsyncResult } from 'effect/reactivity';
import type { Remote } from '@porcelain/client/access/rules';
import {
  connectionErrorMessage,
  remoteStatusNote,
  remoteStatusText,
} from '@porcelain/client/access/rules';
import { TruncatedText } from '@/shared/views/truncated-text';
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
import { SavedWaysIn } from './saved-ways-in';
import { RemoteServiceUpdate } from './service-update';

export function RemoteComputerName({ remote }: { remote: Remote }) {
  const status = useRemoteStatus(remote);
  const name = status.kind === 'online' ? status.name : remote.name;
  return <TruncatedText text={name} className="block min-w-0" />;
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
            : 'This computer is no longer saved on this app. Return to Computers to add it again.'}
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
              <ItemTitle className="min-w-0 flex-wrap">
                <span className="min-w-0">{name}</span>{' '}
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
                  <dt className="text-muted-foreground">Computer ID</dt>
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
                <RemoteServiceUpdate connection={entry.connection} />
              </ItemContent>
            </Item>
          )}
        </ItemGroup>
      </FieldSet>
      <SavedWaysIn remote={remote} />
      {!online && (
        <Item variant="outline">
          <ItemContent>
            <ItemTitle>Pair again</ItemTitle>
            <p className="text-sm text-muted-foreground">
              On this computer, run porcelain pair. Return to Computers and add
              the new link to replace this app’s saved connection.
            </p>
          </ItemContent>
        </Item>
      )}
      <FieldSet>
        <FieldLegend variant="label">Danger zone</FieldLegend>
        <div className="rounded-2xl border border-destructive/30">
          <ItemGroup>
            <Item variant="outline">
              <ItemContent>
                <ItemTitle>Forget {name}</ItemTitle>
                <p className="text-sm text-muted-foreground">
                  Removes this computer and its saved credential from this app.
                  It does not revoke host credentials or stop sharing on that
                  computer. Save or discard unsaved file drafts before
                  forgetting this computer.
                </p>
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
                      {connectionErrorMessage(
                        Cause.squash(forget.result.cause),
                      )}
                    </AlertDescription>
                  </Alert>
                )}
              </ItemContent>
            </Item>
          </ItemGroup>
        </div>
      </FieldSet>
    </>
  );
}
