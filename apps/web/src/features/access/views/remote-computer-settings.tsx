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
import { DevicesSettings } from './share-settings';
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from '@/components/ui/collapsible';
import { WaysIn } from './ways-in';
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
      <Alert
        data-unavailable-page={
          status === 'ready' ? 'Computer unavailable' : undefined
        }
      >
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
    <div className="settings-computer grid min-w-0 items-start gap-x-8 gap-y-6 lg:grid-cols-[minmax(0,1fr)_--spacing(62)]">
      <FieldSet className="lg:col-span-2">
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
              <Collapsible>
                <CollapsibleTrigger
                  render={<Button variant="ghost" size="sm" />}
                >
                  Details
                </CollapsibleTrigger>
                <CollapsibleContent>
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
                      <dt className="text-muted-foreground">
                        Porcelain version
                      </dt>
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
                        <dd className="break-all font-mono">
                          {remote.deviceId}
                        </dd>
                      </div>
                    )}
                  </dl>
                </CollapsibleContent>
              </Collapsible>
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
      {online && entry && (
        <>
          <WaysIn connection={entry.connection} />
          <DevicesSettings connection={entry.connection} />
        </>
      )}
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
                  Removes this computer from this app. Other devices keep their
                  access.
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
    </div>
  );
}
