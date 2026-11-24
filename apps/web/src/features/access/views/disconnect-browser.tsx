import { PendingButton } from '@/shared/views/pending-button';
import { Cause } from 'effect';
import { AsyncResult } from 'effect/reactivity';
import { useConnectedContext } from '../store';
import { UnplugIcon } from 'lucide-react';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { useDisconnect } from '../commands/disconnect';
import { connectionErrorMessage } from '@porcelain/client/access/rules';

export function DisconnectBrowser({ computer }: { computer: string }) {
  const { connection } = useConnectedContext();
  const { result: disconnect, submit } = useDisconnect(connection);
  return (
    <div className="flex flex-col gap-3">
      <div className="settings-danger flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between sm:gap-6">
        <div className="min-w-0">
          <p className="text-sm leading-5 font-medium">
            Disconnect this browser
          </p>
          <p className="mt-0.5 text-ui leading-4.5 text-muted-foreground">
            Ends its session on {computer}. Pair it again with a new link.
          </p>
        </div>
        <PendingButton
          pending={disconnect.waiting}
          variant="outline"
          size="sm"
          className="shrink-0 self-start sm:self-auto"
          aria-label="Disconnect this browser"
          onClick={submit}
        >
          <UnplugIcon />
          Disconnect
        </PendingButton>
      </div>
      {AsyncResult.isFailure(disconnect) && (
        <Alert variant="destructive">
          <AlertDescription>
            {connectionErrorMessage(Cause.squash(disconnect.cause))}
          </AlertDescription>
        </Alert>
      )}
    </div>
  );
}
