import { Cause, Option } from 'effect';
import { AsyncResult } from 'effect/reactivity';
import { useState } from 'react';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Spinner } from '@/components/ui/spinner';
import { useStartServiceUpdate } from '../commands/share';
import { useServiceUpdate } from '../queries/share';
import { connectionErrorMessage } from '@porcelain/client/access/rules';
import {
  type ServiceUpdate,
  serviceUpdateOutcome,
  serviceUpdateProgress,
} from '@porcelain/client/access/rules';
import { useLocalConnection } from '../store';
import { type Connection } from '@/shared/workspace/connection';

type UpdateTarget =
  | { kind: 'local' }
  | { kind: 'remote'; name: string; deviceId?: string | undefined };

function trustHint(target: UpdateTarget): string {
  if (target.kind === 'local')
    return 'Only a browser on the computer that runs Porcelain, or a device its owner trusts, can update it.';
  return target.deviceId
    ? `Trust this app on ${target.name} to update it from here: run porcelain trust ${target.deviceId} there.`
    : `Trust this app on ${target.name} to update it from here: run porcelain devices there, then porcelain trust with this app's id.`;
}

function Outcome({
  state,
  started,
}: {
  state: ServiceUpdate;
  started: boolean;
}) {
  const outcome = serviceUpdateOutcome(state);
  if (outcome?.kind === 'updated')
    return (
      <div className="flex flex-wrap items-center justify-between gap-2">
        <Alert className="min-w-0 flex-1">
          <AlertDescription>
            {`Updated from ${outcome.from} to ${outcome.target}.${started ? ' Reload to use the new version here.' : ''}`}
          </AlertDescription>
        </Alert>
        {started && (
          <Button
            size="sm"
            variant="outline"
            onClick={() => window.location.reload()}
          >
            Reload
          </Button>
        )}
      </div>
    );
  if (outcome?.kind === 'failed')
    return (
      <Alert variant="destructive">
        <AlertDescription>
          <p>
            The update to {outcome.target} failed, so Porcelain still runs{' '}
            {state.version ?? 'the version it had'}.
          </p>
          <p>{outcome.reason}</p>
        </AlertDescription>
      </Alert>
    );
  return null;
}

function Offer({
  connection,
  target,
  state,
  onStart,
}: {
  connection: Connection;
  target: UpdateTarget;
  state: ServiceUpdate;
  onStart: () => void;
}) {
  const [start, startUpdate] = useStartServiceUpdate(connection);
  const { latest } = state;
  if (!state.available || latest === null || latest === undefined)
    return (
      <p className="text-xs text-muted-foreground">
        {latest === null || latest === undefined
          ? 'Could not check for a newer version.'
          : 'This is the newest version.'}
      </p>
    );
  return (
    <div className="flex flex-col gap-2">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-sm">Porcelain {latest} is available.</p>
        {state.canUpdate && (
          <Button
            size="sm"
            disabled={start.waiting}
            onClick={() => {
              onStart();
              startUpdate(latest);
            }}
          >
            {start.waiting && <Spinner />}
            Update to {latest}
          </Button>
        )}
      </div>
      {!state.canUpdate && (
        <p className="text-xs text-muted-foreground">{trustHint(target)}</p>
      )}
      {AsyncResult.isFailure(start) && (
        <Alert variant="destructive">
          <AlertDescription>
            {connectionErrorMessage(Cause.squash(start.cause))}
          </AlertDescription>
        </Alert>
      )}
    </div>
  );
}

function UpdateContent({
  connection,
  target,
}: {
  connection: Connection;
  target: UpdateTarget;
}) {
  const update = useServiceUpdate(connection);
  const [started, setStarted] = useState(false);
  const state = Option.getOrUndefined(AsyncResult.value(update));
  if (!state)
    return AsyncResult.isFailure(update) ? (
      <Alert variant="destructive">
        <AlertDescription>
          {connectionErrorMessage(Cause.squash(update.cause))}
        </AlertDescription>
      </Alert>
    ) : (
      <Spinner />
    );
  const progress = serviceUpdateProgress(state, AsyncResult.isFailure(update));
  return (
    <div className="flex flex-col gap-3">
      <p className="text-sm font-medium">
        Porcelain {state.version ?? 'development build'}
      </p>
      {(() => {
        if (!state.managed) {
          return (
            <p className="text-xs text-muted-foreground">
              This server runs outside the installed service. Update it with
              npm, then run porcelain service update.
            </p>
          );
        }
        if (progress) {
          return (
            <div aria-live="polite" className="flex items-center gap-2 text-sm">
              <Spinner />
              <p>{progress}</p>
            </div>
          );
        }
        return (
          <>
            <Outcome
              state={state}
              started={started && target.kind === 'local'}
            />
            <Offer
              connection={connection}
              target={target}
              state={state}
              onStart={() => setStarted(true)}
            />
          </>
        );
      })()}
    </div>
  );
}

export function ServiceUpdateSettings() {
  const connection = useLocalConnection();
  return (
    connection && (
      <UpdateContent connection={connection} target={{ kind: 'local' }} />
    )
  );
}

export function RemoteServiceUpdate({
  connection,
  name,
  deviceId,
}: {
  connection: Connection;
  name: string;
  deviceId?: string | undefined;
}) {
  return (
    <UpdateContent
      connection={connection}
      target={{ kind: 'remote', name, deviceId }}
    />
  );
}
